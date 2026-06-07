import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });
config({ path: ".env" });

export function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to run Drizzle migrations.");
  }

  return process.env.DATABASE_URL;
}

export const migrationConfig = defineConfig({
  schema: "./src/lib/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: requireDatabaseUrl(),
  },
  migrations: {
    table: "__drizzle_migrations",
    schema: "public",
  },
});
