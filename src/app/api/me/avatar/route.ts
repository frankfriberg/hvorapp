import { AVATAR_MAX_BYTES } from "@shared/api";
import { avatarType, setAvatar } from "@/server/accounts";
import { error, json, withUser } from "@/server/http";

/** Sets my profile photo: the body is the JPEG or PNG itself. */
export function PUT(request: Request) {
  return withUser(request, async ({ db, user }) => {
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.length > AVATAR_MAX_BYTES) return error(413, "Photo too large");
    const type = avatarType(bytes);
    if (!type) return error(415, "Not a JPEG or PNG");
    return json({ user: await setAvatar(db, user.id, { bytes, type }) });
  });
}

/** Removes my profile photo. */
export function DELETE(request: Request) {
  return withUser(request, async ({ db, user }) =>
    json({ user: await setAvatar(db, user.id, null) }),
  );
}
