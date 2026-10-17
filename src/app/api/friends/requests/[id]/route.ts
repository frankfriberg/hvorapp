import { acceptRequest, dropRequest } from "@/server/friends";
import { error, withUser } from "@/server/http";

type Params = { params: Promise<{ id: string }> };

/** Accepts the request from user `id`. */
export function POST(request: Request, { params }: Params) {
  return withUser(request, async ({ db, user }) => {
    const { id } = await params;
    const accepted = await acceptRequest(db, user.id, id);
    return accepted
      ? new Response(null, { status: 204 })
      : error(404, "No such request");
  });
}

/** Declines the request from user `id`, or withdraws mine to them. */
export function DELETE(request: Request, { params }: Params) {
  return withUser(request, async ({ db, user }) => {
    await dropRequest(db, user.id, (await params).id);
    return new Response(null, { status: 204 });
  });
}
