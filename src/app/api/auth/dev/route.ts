import { error, readJson, startSession } from "@/server/http";

/**
 * Signs in by name alone, for development and simulators without Apple or
 * Google credentials. Off unless HVOR_DEV_AUTH=1, and never in production.
 */
export async function POST(request: Request) {
  if (
    process.env.HVOR_DEV_AUTH !== "1" ||
    process.env.VERCEL_ENV === "production"
  ) {
    return error(404, "Not found");
  }

  const body = (await readJson(request)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return error(400, "name is required");
  return startSession("dev", name.toLowerCase(), name);
}
