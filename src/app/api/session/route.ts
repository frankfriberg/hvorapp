import { endSession } from "@/server/accounts";
import { bearer, withUser } from "@/server/http";

/** Signs this device out. */
export function DELETE(request: Request) {
  return withUser(request, async ({ db }) => {
    await endSession(db, bearer(request) as string);
    return new Response(null, { status: 204 });
  });
}
