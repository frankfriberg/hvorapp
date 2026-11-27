import { beforeEach, describe, expect, it } from "vitest";
import {
  avatarType,
  createSession,
  deleteAccount,
  endSession,
  getAvatar,
  setAvatar,
  signIn,
  type User,
  userForToken,
} from "./accounts";
import type { Db } from "./db";
import {
  acceptRequest,
  dropRequest,
  listFriends,
  requestFriend,
  unfriend,
} from "./friends";
import { migrate } from "./migrate";
import { pglite } from "./pglite";
import {
  moveSeat,
  mySeat,
  parseSeat,
  parseShareHours,
  shareSeat,
  stopSharingSeat,
} from "./shares";

let db: Db;
let ada: User;
let bo: User;

beforeEach(async () => {
  db = await pglite();
  await migrate(db);
  ada = await signIn(db, "apple", "ada-sub", "Ada");
  bo = await signIn(db, "google", "bo-sub", "Bo");
});

async function makeFriends() {
  await requestFriend(db, bo.id, ada.inviteCode);
  await acceptRequest(db, ada.id, bo.id);
}

describe("accounts", () => {
  it("signs the same identity in to the same user, keeping the first name", async () => {
    const again = await signIn(db, "apple", "ada-sub", "Someone else");
    expect(again).toEqual(ada);
  });

  it("fills a name the provider didn't send the first time", async () => {
    const nameless = await signIn(db, "apple", "c-sub");
    expect(nameless.name).toBe("");
    expect((await signIn(db, "apple", "c-sub", "Cy")).name).toBe("Cy");
  });

  it("resolves a session token to its user until it ends", async () => {
    const token = await createSession(db, ada.id);
    expect(await userForToken(db, token)).toEqual(ada);
    await endSession(db, token);
    expect(await userForToken(db, token)).toBeNull();
  });

  it("deletes an account with its friendships", async () => {
    await makeFriends();
    await deleteAccount(db, ada.id);
    expect((await listFriends(db, bo.id)).friends).toEqual([]);
  });
});

describe("friends", () => {
  it("opening an invite link sends a request the owner must accept", async () => {
    expect(await requestFriend(db, bo.id, ada.inviteCode)).toEqual({
      status: "requested",
      to: { id: ada.id, name: "Ada", avatarUrl: null },
    });
    expect((await listFriends(db, ada.id)).incoming).toEqual([
      { id: bo.id, name: "Bo", avatarUrl: null },
    ]);
    expect((await listFriends(db, bo.id)).outgoing).toEqual([
      { id: ada.id, name: "Ada", avatarUrl: null },
    ]);
    expect((await listFriends(db, ada.id)).friends).toEqual([]);

    expect(await acceptRequest(db, ada.id, bo.id)).toBe(true);
    const adas = await listFriends(db, ada.id);
    expect(adas.friends.map((f) => f.name)).toEqual(["Bo"]);
    expect(adas.incoming).toEqual([]);
    expect((await listFriends(db, bo.id)).friends.map((f) => f.name)).toEqual([
      "Ada",
    ]);
  });

  it("opening the link of someone who already asked me makes us friends", async () => {
    await requestFriend(db, ada.id, bo.inviteCode);
    expect(await requestFriend(db, bo.id, ada.inviteCode)).toMatchObject({
      status: "friends",
    });
    expect((await listFriends(db, ada.id)).outgoing).toEqual([]);
  });

  it("only the person asked can accept", async () => {
    await requestFriend(db, bo.id, ada.inviteCode);
    expect(await acceptRequest(db, bo.id, ada.id)).toBe(false);
  });

  it("rejects my own link and unknown links", async () => {
    expect(await requestFriend(db, ada.id, ada.inviteCode)).toEqual({
      status: "own-link",
    });
    expect(await requestFriend(db, ada.id, "nope")).toEqual({
      status: "unknown-link",
    });
  });

  it("declining removes the request; unfriending removes the friendship", async () => {
    await requestFriend(db, bo.id, ada.inviteCode);
    await dropRequest(db, ada.id, bo.id);
    expect((await listFriends(db, ada.id)).incoming).toEqual([]);

    await makeFriends();
    await unfriend(db, bo.id, ada.id);
    expect((await listFriends(db, ada.id)).friends).toEqual([]);
  });
});

describe("shared seats", () => {
  const seat = { arena: "salen", gridX: 10, gridY: 20 } as const;
  const noon = new Date("2026-10-17T12:00:00Z");

  it("are visible to friends for as long as they're shared", async () => {
    await makeFriends();
    await shareSeat(db, ada.id, seat, 4, noon);

    const at = (iso: string) => listFriends(db, bo.id, new Date(iso));
    expect((await at("2026-10-17T15:59:00Z")).friends[0].seat).toMatchObject(
      seat,
    );
    expect((await at("2026-10-17T16:00:00Z")).friends[0].seat).toBeNull();
  });

  it("are not visible to people who aren't friends", async () => {
    await requestFriend(db, bo.id, ada.inviteCode);
    await shareSeat(db, ada.id, seat, 1, noon);
    expect((await listFriends(db, bo.id, noon)).friends).toEqual([]);
  });

  it("can be replaced and stopped", async () => {
    await shareSeat(db, ada.id, seat, 1, noon);
    await shareSeat(db, ada.id, { ...seat, gridX: 11 }, 1, noon);
    expect(await mySeat(db, ada.id, noon)).toMatchObject({ gridX: 11 });
    await stopSharingSeat(db, ada.id);
    expect(await mySeat(db, ada.id, noon)).toBeNull();
  });

  it("move, live, keeping when they end, only while shared", async () => {
    const live = { ...seat, arena: "brunstad", live: true } as const;
    expect(await moveSeat(db, ada.id, live, noon)).toBeNull();
    const { expiresAt } = await shareSeat(db, ada.id, live, 2, noon);
    const later = new Date("2026-10-17T13:00:00Z");
    expect(await moveSeat(db, ada.id, { ...live, gridX: 12 }, later)).toEqual({
      expiresAt,
    });
    expect(await mySeat(db, ada.id, later)).toMatchObject({
      arena: "brunstad",
      gridX: 12,
      live: true,
    });
    const after = new Date("2026-10-17T14:00:00Z");
    expect(await moveSeat(db, ada.id, live, after)).toBeNull();
  });

  it("must be a known arena and on the grid", () => {
    expect(parseSeat(seat)).toEqual(seat);
    expect(parseSeat({ ...seat, arena: "elsewhere" })).toBeNull();
    expect(parseSeat({ ...seat, arena: "brunstad", live: true })).toEqual({
      ...seat,
      arena: "brunstad",
      live: true,
    });
    expect(parseSeat({ ...seat, live: false })).toEqual(seat);
    expect(parseSeat({ ...seat, live: "yes" })).toBeNull();
    expect(parseSeat({ ...seat, gridX: -1 })).toBeNull();
    expect(parseSeat({ ...seat, gridY: 1.5 })).toEqual({ ...seat, gridY: 1.5 });
    expect(parseSeat({ ...seat, gridY: "1" })).toBeNull();
    expect(parseSeat({ ...seat, gridY: Number.NaN })).toBeNull();
    expect(parseSeat({ ...seat, gridY: 1000 })).toBeNull();
    expect(parseSeat("salen")).toBeNull();
  });

  it("are shared for an hour unless asked for one of the other lengths", () => {
    expect(parseShareHours({ ...seat })).toBe(1);
    expect(parseShareHours({ ...seat, hours: 2 })).toBe(2);
    expect(parseShareHours({ ...seat, hours: 4 })).toBe(4);
    expect(parseShareHours({ ...seat, hours: 3 })).toBeNull();
    expect(parseShareHours({ ...seat, hours: "1" })).toBeNull();
  });
});

describe("avatars", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

  it("tells JPEG and PNG from anything else by their first bytes", () => {
    expect(avatarType(jpeg)).toBe("image/jpeg");
    expect(avatarType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0]))).toBe(
      "image/png",
    );
    expect(avatarType(new Uint8Array([0x47, 0x49, 0x46]))).toBeNull();
  });

  it("gives each new photo a new URL, and none once removed", async () => {
    expect(ada.avatarUrl).toBeNull();
    const first = await setAvatar(db, ada.id, {
      bytes: jpeg,
      type: "image/jpeg",
    });
    const second = await setAvatar(db, ada.id, {
      bytes: jpeg,
      type: "image/jpeg",
    });
    expect(first.avatarUrl).toMatch(`/api/avatars/${ada.id}?v=`);
    expect(second.avatarUrl).not.toBe(first.avatarUrl);
    expect(await getAvatar(db, ada.id)).toEqual({
      bytes: jpeg,
      type: "image/jpeg",
    });

    expect((await setAvatar(db, ada.id, null)).avatarUrl).toBeNull();
    expect(await getAvatar(db, ada.id)).toBeNull();
  });

  it("shows friends' photos", async () => {
    await makeFriends();
    const { avatarUrl } = await setAvatar(db, ada.id, {
      bytes: jpeg,
      type: "image/jpeg",
    });
    const { friends } = await listFriends(db, bo.id);
    expect(friends[0].avatarUrl).toBe(avatarUrl);
  });
});
