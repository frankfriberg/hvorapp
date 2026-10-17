import type { Db } from "./db";

/** An in-process Postgres; in memory when `dataDir` is omitted (tests). */
export async function pglite(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite(dataDir);
  return {
    query: async <T>(text: string, params: unknown[] = []) =>
      (await pg.query<T>(text, params)).rows,
    exec: async (script) => {
      await pg.transaction((tx) => tx.exec(script));
    },
  };
}
