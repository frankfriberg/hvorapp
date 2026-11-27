import Constants from "expo-constants";

export type * from "@shared/api";

// The web app serves the API. EXPO_PUBLIC_API_URL points a development build
// at a local server instead (http://localhost:9100 from the simulator).
const baseUrl: string =
  process.env.EXPO_PUBLIC_API_URL ?? Constants.expoConfig?.extra?.webUrl;

/** A path the API hands out, such as an avatar's, as a full URL. */
export const webUrl = (path: string) =>
  /^https?:\/\//.test(path) ? path : `${baseUrl}${path}`;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Options = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Sent as JSON, or as is when a Blob (an image upload). */
  body?: unknown;
  token?: string | null;
};

/** Calls the Hvor API; resolves to the JSON body, or undefined for 204. */
export async function api<T>(
  path: string,
  { method = "GET", body, token }: Options = {},
): Promise<T> {
  const blob = body instanceof Blob;
  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      ...(body !== undefined && {
        "Content-Type": blob ? body.type : "application/json",
      }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : blob ? body : JSON.stringify(body),
  });

  if (!response.ok) {
    const { error } = await response.json().catch(() => ({ error: "" }));
    throw new ApiError(response.status, error || response.statusText);
  }
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}
