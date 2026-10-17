import { beforeEach, describe, expect, it } from "vitest";
import {
  createSession,
  deleteAccount,
  endSession,
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
import { mySeat, parseSeat, shareSeat, stopSharingSeat } from "./shares";

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
      to: { id: ada.id, name: "Ada" },
    });
    expect((await listFriends(db, ada.id)).incoming).toEqual([
      { id: bo.id, name: "Bo" },
    ]);
    expect((await listFriends(db, bo.id)).outgoing).toEqual([
      { id: ada.id, name: "Ada" },
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

  it("are visible to friends for four hours", async () => {
    await makeFriends();
    await shareSeat(db, ada.id, seat, noon);

    const at = (iso: string) => listFriends(db, bo.id, new Date(iso));
    expect((await at("2026-10-17T15:59:00Z")).friends[0].seat).toMatchObject(
      seat,
    );
    expect((await at("2026-10-17T16:00:00Z")).friends[0].seat).toBeNull();
  });

  it("are not visible to people who aren't friends", async () => {
    await requestFriend(db, bo.id, ada.inviteCode);
    await shareSeat(db, ada.id, seat, noon);
    expect((await listFriends(db, bo.id, noon)).friends).toEqual([]);
  });

  it("can be replaced and stopped", async () => {
    await shareSeat(db, ada.id, seat, noon);
    await shareSeat(db, ada.id, { ...seat, gridX: 11 }, noon);
    expect(await mySeat(db, ada.id, noon)).toMatchObject({ gridX: 11 });
    await stopSharingSeat(db, ada.id);
    expect(await mySeat(db, ada.id, noon)).toBeNull();
  });

  it("must be a known arena and on the grid", () => {
    expect(parseSeat(seat)).toEqual(seat);
    expect(parseSeat({ ...seat, arena: "elsewhere" })).toBeNull();
    expect(parseSeat({ ...seat, gridX: -1 })).toBeNull();
    expect(parseSeat({ ...seat, gridY: 1.5 })).toBeNull();
    expect(parseSeat({ ...seat, gridY: 1000 })).toBeNull();
    expect(parseSeat("salen")).toBeNull();
  });
});
