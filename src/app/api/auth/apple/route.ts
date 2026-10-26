import { error, readJson, startSession } from "@/server/http";
import { verifyAppleToken } from "@/server/identity";

export async function POST(request: Request) {
  const body = (await readJson(request)) as {
    identityToken?: unknown;
    name?: unknown;
  } | null;
  if (typeof body?.identityToken !== "string") {
    return error(400, "identityToken is required");
  }

  let sub: string;
  try {
    ({ sub } = await verifyAppleToken(body.identityToken));
  } catch {
    return error(401, "Invalid Apple token");
  }
  return startSession(
    "apple",
    sub,
    typeof body.name === "string" ? body.name : undefined,
  );
}
