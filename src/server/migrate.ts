import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Db } from "./db";

const MIGRATIONS = join(process.cwd(), "db/migrations");

/**
 * Applies every `db/migrations/*.sql` not yet recorded in
 * `schema_migrations`, in file-name order, each in its own transaction with
 * its record.
 */
export async function migrate(db: Db): Promise<string[]> {
  await db.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const applied = new Set(
    (
      await db.query<{ name: string }>("SELECT name FROM schema_migrations")
    ).map((row) => row.name),
  );

  const pending = (await readdir(MIGRATIONS))
    .filter((name) => name.endsWith(".sql") && !applied.has(name))
    .sort();

  for (const name of pending) {
    const sql = await readFile(join(MIGRATIONS, name), "utf8");
    await db.exec(
      `${sql}\nINSERT INTO schema_migrations (name) VALUES ('${name}');`,
    );
  }
  return pending;
}
