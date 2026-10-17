import { unfriend } from "@/server/friends";
import { withUser } from "@/server/http";

type Params = { params: Promise<{ id: string }> };

export function DELETE(request: Request, { params }: Params) {
  return withUser(request, async ({ db, user }) => {
    await unfriend(db, user.id, (await params).id);
    return new Response(null, { status: 204 });
  });
}
