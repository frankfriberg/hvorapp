import { deleteAccount, rename } from "@/server/accounts";
import { error, json, readJson, withUser } from "@/server/http";
import { mySeat } from "@/server/shares";

export function GET(request: Request) {
  return withUser(request, async ({ db, user }) =>
    json({ user, seat: await mySeat(db, user.id) }),
  );
}

/** Renames me: `{ name }`. */
export function PATCH(request: Request) {
  return withUser(request, async ({ db, user }) => {
    const body = (await readJson(request)) as { name?: unknown } | null;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return error(400, "name is required");
    return json({ user: await rename(db, user.id, name) });
  });
}

/** Deletes my account and everything shared from it. */
export function DELETE(request: Request) {
  return withUser(request, async ({ db, user }) => {
    await deleteAccount(db, user.id);
    return new Response(null, { status: 204 });
  });
}
