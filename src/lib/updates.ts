import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import matter from "gray-matter";

export interface Update {
  slug: string;
  title: string;
  date: string;
  content: string;
}

const updatesDirectory = path.join(process.cwd(), "updates");

/**
 * Retrieves all updates from the markdown files in the updates directory.
 *
 * Reads every `.md` file in `/updates`, parses frontmatter (`title`, `date`)
 * and content, and returns them sorted by date descending (newest first).
 * Files missing a string `title` or `date` are skipped with a warning.
 *
 * Wrapped in React `cache()` so the directory is read at most once per request
 * even though it is consumed both in the root layout (for the unread badge) and
 * on the `/updates` page. Server-side only (uses `node:fs`).
 *
 * @remarks
 * - File naming convention: `YYYY-MM-DD-slug.md`
 * - `date` may include a time component for precise unread-badge timing.
 */
export const getUpdates = cache((): Update[] => {
  const fileNames = fs.readdirSync(updatesDirectory);

  return fileNames
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName): Update | null => {
      const slug = fileName.replace(/\.md$/, "");
      const fullPath = path.join(updatesDirectory, fileName);
      const { data, content } = matter(fs.readFileSync(fullPath, "utf8"));

      if (typeof data.title !== "string" || typeof data.date !== "string") {
        console.warn(
          `Skipping update "${fileName}": missing "title" or "date" frontmatter.`,
        );
        return null;
      }

      return { slug, title: data.title, date: data.date, content };
    })
    .filter((update): update is Update => update !== null)
    .sort((a, b) => {
      if (a.date < b.date) return 1;
      if (a.date > b.date) return -1;
      return 0;
    });
});

/**
 * Gets the latest update.
 *
 * @returns {Update | null} The latest update, or null if none exist
 */
export function getLatestUpdate(): Update | null {
  const updates = getUpdates();
  return updates.length > 0 ? updates[0] : null;
}

/**
 * Server-side utility to check if the user has read the latest update.
 * Compares the latest update's date with the last-visit timestamp cookie.
 *
 * @returns {boolean} True if there is an unread update, false otherwise
 */
export function hasUnreadUpdates(
  latestUpdate: Update | null,
  updatesLastVisited: string | undefined,
): boolean {
  if (!latestUpdate) return false;
  if (!updatesLastVisited) return true;

  const lastVisitTimestamp = Number.parseInt(updatesLastVisited, 10);
  const updateTimestamp = new Date(latestUpdate.date).getTime();

  return lastVisitTimestamp < updateTimestamp;
}
