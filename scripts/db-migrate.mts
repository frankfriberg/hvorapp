// Applies pending db/migrations/*.sql to DATABASE_URL.
//
//   DATABASE_URL=postgres://… npm run db:migrate
//
// Development needs no run: without DATABASE_URL the app migrates its local
// PGlite database on start.
import postgres from "postgres";
import { migrate } from "../src/server/migrate.ts";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const sql = postgres(url, { onnotice: () => {} });
const applied = await migrate({
  query: async (text, params = []) =>
    (await sql.unsafe(text, params as never[])) as never,
  exec: async (script) => {
    await sql.begin((tx) => tx.unsafe(script).simple());
  },
});
console.log(applied.length ? `applied ${applied.join(", ")}` : "up to date");
await sql.end();
