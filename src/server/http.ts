import "server-only";
import {
  createSession,
  type Provider,
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

/** Signs the identity in and answers with a new session token. */
export async function startSession(
  provider: Provider,
  sub: string,
  name?: string,
): Promise<Response> {
  const db = await getDb();
  const user = await signIn(db, provider, sub, name);
  const token = await createSession(db, user.id);
  return json({ token, user });
}
