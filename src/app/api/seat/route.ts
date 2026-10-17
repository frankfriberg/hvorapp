import { error, json, readJson, withUser } from "@/server/http";
import { parseSeat, shareSeat, stopSharingSeat } from "@/server/shares";

/** Shares my seat with my friends: `{ arena, gridX, gridY }`. */
export function PUT(request: Request) {
  return withUser(request, async ({ db, user }) => {
    const seat = parseSeat(await readJson(request));
    if (!seat) return error(400, "Not a seat");
    return json({ ...seat, ...(await shareSeat(db, user.id, seat)) });
  });
}

export function DELETE(request: Request) {
  return withUser(request, async ({ db, user }) => {
    await stopSharingSeat(db, user.id);
    return new Response(null, { status: 204 });
  });
}
