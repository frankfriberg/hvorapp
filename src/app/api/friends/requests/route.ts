import { requestFriend } from "@/server/friends";
import { error, json, readJson, withUser } from "@/server/http";

/** Asks the owner of an invite link to be friends: `{ code }`. */
export function POST(request: Request) {
  return withUser(request, async ({ db, user }) => {
    const body = (await readJson(request)) as { code?: unknown } | null;
    if (typeof body?.code !== "string") return error(400, "code is required");
    return json(await requestFriend(db, user.id, body.code));
  });
}
