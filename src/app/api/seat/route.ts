import { error, json, readJson, withUser } from "@/server/http";
import {
  moveSeat,
  parseSeat,
  parseShareHours,
  shareSeat,
  stopSharingSeat,
} from "@/server/shares";

/** Shares my seat with my friends: a `ShareSeatRequest`. */
export function PUT(request: Request) {
  return withUser(request, async ({ db, user }) => {
    const body = await readJson(request);
    const seat = parseSeat(body);
    if (!seat) return error(400, "Not a seat");
    const hours = parseShareHours(body);
    if (!hours) return error(400, "Not a share length");
    return json({ ...seat, ...(await shareSeat(db, user.id, seat, hours)) });
  });
}

/** Moves my shared seat, as a live location does: a `MoveSeatRequest`. */
export function PATCH(request: Request) {
  return withUser(request, async ({ db, user }) => {
    const seat = parseSeat(await readJson(request));
    if (!seat) return error(400, "Not a seat");
    const moved = await moveSeat(db, user.id, seat);
    if (!moved) return error(404, "No seat shared");
    return json({ ...seat, ...moved });
  });
}

export function DELETE(request: Request) {
  return withUser(request, async ({ db, user }) => {
    await stopSharingSeat(db, user.id);
    return new Response(null, { status: 204 });
  });
}
