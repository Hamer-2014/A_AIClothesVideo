import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export function getDatabaseUrl({ allowTestFallback = true } = {}) {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    if (allowTestFallback && process.env.NODE_ENV === "test") {
      return "postgres://test:test@example.neon.tech/test";
    }

    throw new Error("DATABASE_URL is required to create the database client.");
  }

  return databaseUrl;
}

export function createDbClient(databaseUrl = getDatabaseUrl()) {
  const pool = new Pool({ connectionString: databaseUrl });

  return drizzle(pool, { schema });
}

let cachedDb: ReturnType<typeof createDbClient> | undefined;

export function getDb() {
  cachedDb ??= createDbClient();

  return cachedDb;
}
