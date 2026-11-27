import { error, json, readJson, withUser } from "@/server/http";
import {
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

export function DELETE(request: Request) {
  return withUser(request, async ({ db, user }) => {
    await stopSharingSeat(db, user.id);
    return new Response(null, { status: 204 });
  });
}
