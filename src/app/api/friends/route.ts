import { listFriends } from "@/server/friends";
import { json, withUser } from "@/server/http";

/** My friends with their shared seats, and open requests both ways. */
export function GET(request: Request) {
  return withUser(request, async ({ db, user }) =>
    json(await listFriends(db, user.id)),
  );
}
