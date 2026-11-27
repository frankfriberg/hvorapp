import "server-only";
import { AVATAR_MAX_BYTES } from "@shared/api";
import {
  avatarType,
  createSession,
  type Provider,
  setAvatar,
  signIn,
  type User,
  userForToken,
} from "./accounts";
import { type Db, getDb } from "./db";

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status });

export const error = (status: number, message: string) =>
  json({ error: message }, status);

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function bearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

type Authed = (args: {
  request: Request;
  db: Db;
  user: User;
}) => Promise<Response>;

/** Runs `handler` for a signed-in user, or answers 401. */
export async function withUser(
  request: Request,
  handler: Authed,
): Promise<Response> {
  const token = bearer(request);
  if (!token) return error(401, "Not signed in");
  const db = await getDb();
  const user = await userForToken(db, token);
  if (!user) return error(401, "Not signed in");
  return handler({ request, db, user });
}

/**
 * Signs the identity in and answers with a new session token. A `picture`
 * from the provider becomes the profile photo of someone who has none.
 */
export async function startSession(
  provider: Provider,
  sub: string,
  name?: string,
  picture?: string,
): Promise<Response> {
  const db = await getDb();
  let user = await signIn(db, provider, sub, name);
  if (picture && !user.avatarUrl) {
    const avatar = await fetchPicture(picture);
    if (avatar) user = await setAvatar(db, user.id, avatar);
  }
  const token = await createSession(db, user.id);
  return json({ token, user });
}

/** A provider's picture as a profile photo, or null when it won't do. */
async function fetchPicture(url: string) {
  try {
    // Google serves its pictures at any size: ask for a small square.
    const sized = url.replace(/=s\d+(-c)?$/, "=s256-c");
    const response = await fetch(sized, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const type = avatarType(bytes);
    return type && bytes.length <= AVATAR_MAX_BYTES ? { bytes, type } : null;
  } catch {
    return null;
  }
}
