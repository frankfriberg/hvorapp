"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

/**
 * Server action to mark updates as read by setting a cookie with current timestamp.
 */
export async function markUpdatesAsRead() {
  const cookieStore = await cookies();

  cookieStore.set("updatesLastVisited", Date.now().toString(), {
    maxAge: 60 * 60 * 24 * 365, // 1 year
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  // Revalidate the layout to update the badge
  revalidatePath("/", "layout");
}
