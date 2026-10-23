import { getAvatar } from "@/server/accounts";
import { getDb } from "@/server/db";
import { error } from "@/server/http";

type Params = { params: Promise<{ id: string }> };

// Ids are random UUIDs, handed out only to friends and people with a request
// between them, so a photo isn't behind sign-in: an image view can load it.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Someone's profile photo; its URL changes with it, so it caches for good. */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!UUID.test(id)) return error(404, "No photo");
  const avatar = await getAvatar(await getDb(), id);
  if (!avatar) return error(404, "No photo");
  return new Response(avatar.bytes, {
    headers: {
      "Content-Type": avatar.type,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
