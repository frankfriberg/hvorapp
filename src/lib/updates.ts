import fs from "node:fs";
import path from "node:path";
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
 * Reads all `.md` files from the `/updates` directory at the project root,
 * parses their frontmatter (title, date) and content, and returns them as
 * an array of Update objects sorted by date in descending order (newest first).
 *
 * @returns {Update[]} Array of update objects sorted by date (newest first)
 *
 * @example
 * ```tsx
 * const updates = getUpdates();
 * // Returns:
 * // [
 * //   {
 * //     slug: "2024-11-21-welcome",
 * //     title: "Velkommen til Hvor!",
 * //     date: "2024-11-21",
 * //     content: "Markdown content..."
 * //   },
 * //   ...
 * // ]
 * ```
 *
 * @remarks
 * - Expects markdown files to have frontmatter with `title` and `date` fields
 * - File naming convention: `YYYY-MM-DD-slug.md`
 * - Date format in frontmatter should be `YYYY-MM-DD`
 * - This function runs at build time (server-side only)
 *
 * @throws {Error} If the updates directory doesn't exist or files cannot be read
 */
export function getUpdates(): Update[] {
  const fileNames = fs.readdirSync(updatesDirectory);
  const allUpdates = fileNames
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName) => {
      const slug = fileName.replace(/\.md$/, "");

      const fullPath = path.join(updatesDirectory, fileName);
      const fileContents = fs.readFileSync(fullPath, "utf8");

      const { data, content } = matter(fileContents);

      return {
        slug,
        title: data.title,
        date: data.date,
        content,
      };
    });

  return allUpdates.sort((a, b) => {
    if (a.date < b.date) {
      return 1;
    }
    return -1;
  });
}
