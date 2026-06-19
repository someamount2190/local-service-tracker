import { defineConfig } from "drizzle-kit";

// Used by drizzle-kit for generating SQL migrations from src/db/schema.ts.
// Runtime schema setup is handled idempotently in src/db/migrate.ts so this is
// optional, but it keeps schema.ts the single source of truth.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/placeholder",
  },
});
