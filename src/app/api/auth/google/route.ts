import { error, readJson, startSession } from "@/server/http";
import { verifyGoogleToken } from "@/server/identity";

export async function POST(request: Request) {
  const body = (await readJson(request)) as { idToken?: unknown } | null;
  if (typeof body?.idToken !== "string") {
    return error(400, "idToken is required");
  }

  try {
    const { sub, name, picture } = await verifyGoogleToken(body.idToken);
    return startSession("google", sub, name, picture);
  } catch {
    return error(401, "Invalid Google token");
  }
}
