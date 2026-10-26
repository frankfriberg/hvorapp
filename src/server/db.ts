import "server-only";
import { migrate } from "./migrate";
import { pglite } from "./pglite";

/** The one thing the server needs from a database: run SQL, get rows. */
export type Db = {
  query<T>(text: string, params?: unknown[]): Promise<T[]>;
  /** Runs a script of several statements, without parameters, in one transaction. */
  exec(script: string): Promise<void>;
};

const cache = globalThis as { hvorDb?: Promise<Db> };

/**
 * Production reads DATABASE_URL (Vercel Postgres). Without it, development
 * runs an in-process Postgres (PGlite) in `.pglite/`, migrated on start, so
 * the app runs with no database to set up.
 */
export function getDb(): Promise<Db> {
  cache.hvorDb ??= connect();
  return cache.hvorDb;
}

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const sql = postgres(url);
    return {
      query: async <T>(text: string, params: unknown[] = []) =>
        (await sql.unsafe(text, params as never[])) as unknown as T[],
      exec: async (script) => {
        await sql.begin((tx) => tx.unsafe(script).simple());
      },
    };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is not set");
  }

  const db = await pglite(".pglite");
  await migrate(db);
  return db;
}
