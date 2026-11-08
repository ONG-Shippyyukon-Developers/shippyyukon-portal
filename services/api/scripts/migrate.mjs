import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const migrationDirectory = fileURLToPath(
  new URL("../src/db/migrations/", import.meta.url)
);
const connectionString =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.SBOX_DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.SBOX_POSTGRES_URL_NON_POOLING;

if (!connectionString) {
  throw new Error(
    "Set DATABASE_URL_UNPOOLED or POSTGRES_URL_NON_POOLING to the direct Neon connection."
  );
}

const databaseUrl = new URL(connectionString);
if (
  !databaseUrl.hostname.endsWith(".neon.tech") ||
  databaseUrl.hostname.includes("-pooler")
) {
  throw new Error("Migrations require a direct Neon PostgreSQL connection.");
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: true },
  connectionTimeoutMillis: 10_000,
});

const applyMigrations = process.argv.includes("--apply");
const dryRun = !applyMigrations || process.argv.includes("--dry-run");
if (applyMigrations && process.env.MIGRATION_TARGET !== "development") {
  throw new Error(
    "Applying migrations requires MIGRATION_TARGET=development."
  );
}
if (applyMigrations) {
  const sandboxProjectId = process.env.SBOX_NEON_PROJECT_ID;
  const sandboxDirectHost = process.env.SBOX_PGHOST_UNPOOLED;
  if (
    sandboxProjectId !== "solitary-shape-57091143" ||
    !sandboxDirectHost ||
    databaseUrl.hostname !== sandboxDirectHost
  ) {
    throw new Error(
      "Applying migrations requires the configured Shippiyyukon sandbox project's unpooled host."
    );
  }
}
if (applyMigrations && process.argv.includes("--dry-run")) {
  throw new Error("Choose either --apply or --dry-run, not both.");
}

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(migrationDirectory))
    .filter((file) => /^\d{4}_[a-z0-9_]+\.sql$/.test(file))
    .sort();

  if (files.length === 0) {
    throw new Error("No versioned SQL migrations were found.");
  }

  const pending = [];
  for (const file of files) {
    const alreadyApplied = await client.query(
      "SELECT 1 FROM public.schema_migrations WHERE version = $1",
      [file]
    );
    if (alreadyApplied.rowCount) {
      process.stdout.write(`Already applied: ${file}\n`);
      continue;
    }

    const sql = await readFile(path.join(migrationDirectory, file), "utf8");
    try {
      await client.query(sql);
    } catch (error) {
      if (error.position) {
        const line = sql.slice(0, Number(error.position) - 1).split("\n").length;
        error.migrationLocation = `${file}:${line}`;
      }
      throw error;
    }
    await client.query(
      "INSERT INTO public.schema_migrations (version) VALUES ($1)",
      [file]
    );
    pending.push(file);
  }

  const bootstrapEmail = process.env.CTO_DEV_BOOTSTRAP_EMAIL
    ?.trim()
    .toLowerCase();
  if (bootstrapEmail) {
    if (
      bootstrapEmail.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bootstrapEmail)
    ) {
      throw new Error("CTO_DEV_BOOTSTRAP_EMAIL must be a valid email address.");
    }

    const configured = await client.query(
      `SELECT allowed_email
         FROM public.cto_dev_bootstrap_config
        WHERE singleton_id = TRUE
        FOR UPDATE`
    );
    if (configured.rowCount === 0) {
      await client.query(
        `INSERT INTO public.cto_dev_bootstrap_config
           (singleton_id, allowed_email, configured_by_db_role)
         VALUES (TRUE, $1, session_user)`,
        [bootstrapEmail]
      );
    } else if (configured.rows[0].allowed_email !== bootstrapEmail) {
      throw new Error(
        "CTO_DEV_BOOTSTRAP_EMAIL does not match the existing bootstrap allowlist."
      );
    }
  }

  if (dryRun) {
    await client.query("ROLLBACK");
    process.stdout.write(
      `Validated and rolled back ${pending.length} migration(s).\n`
    );
  } else {
    await client.query("COMMIT");
    for (const file of pending) process.stdout.write(`Applied: ${file}\n`);
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  process.stderr.write(
    `Database migration failed (${error.code ?? error.name ?? "unknown error"})` +
      `${error.migrationLocation ? ` at ${error.migrationLocation}` : ""}` +
      `${error.message ? `: ${error.message}` : ""}\n`
  );
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
