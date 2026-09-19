/**
 * Applies a .sql file from supabase/migrations/ directly against the live
 * Postgres database. Writing a migration file into that folder does NOT
 * apply it by itself — Supabase only runs migrations on `supabase db push`
 * (needs `supabase login` + `supabase link`) or against a local `supabase
 * start` stack. This script is the no-CLI-auth alternative: it connects
 * straight to Postgres and runs the file's SQL.
 *
 * Usage:
 *   npm install pg --no-save
 *   node scripts/run-migration.cjs supabase/migrations/00008_whatsapp_order_channel.sql
 *
 * Requires SUPABASE_DB_URL in the project-root .env — get it from:
 *   Supabase Dashboard -> Project Settings -> Database -> Connection string (URI)
 *   e.g. postgresql://postgres:[YOUR-PASSWORD]@db.<project-ref>.supabase.co:5432/postgres
 */
const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf8");
  envConfig.split("\n").forEach((line) => {
    const parts = line.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim();
      if (key && !key.startsWith("#")) {
        process.env[key] = val;
      }
    }
  });
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error("Usage: node scripts/run-migration.cjs <path-to-migration.sql>");
  process.exit(1);
}

const sqlPath = path.resolve(__dirname, "..", migrationFile);
if (!fs.existsSync(sqlPath)) {
  console.error(`Migration file not found: ${sqlPath}`);
  process.exit(1);
}

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error(
    "Missing SUPABASE_DB_URL in .env. Add it from Supabase Dashboard -> " +
      "Project Settings -> Database -> Connection string (URI), e.g.\n" +
      "SUPABASE_DB_URL=postgresql://postgres:[YOUR-PASSWORD]@db.<project-ref>.supabase.co:5432/postgres"
  );
  process.exit(1);
}

let Client;
try {
  ({ Client } = require("pg"));
} catch {
  console.error("The 'pg' package is not installed. Run: npm install pg --no-save");
  process.exit(1);
}

async function main() {
  const sql = fs.readFileSync(sqlPath, "utf8");
  console.log(`Applying ${path.basename(sqlPath)} to ${connectionString.replace(/:[^:@]+@/, ":****@")} ...`);

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log("Migration applied successfully.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
