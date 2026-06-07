import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

type MigrationFile = {
  name: string;
  filePath: string;
};

const prismaDir = __dirname;
const migrationsDir = path.join(prismaDir, "migrations");
const databasePath = path.join(prismaDir, "dev.db");

function getMigrationFiles(): MigrationFile[] {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      filePath: path.join(migrationsDir, entry.name, "migration.sql")
    }))
    .filter((entry) => fs.existsSync(entry.filePath))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function checksumOf(contents: string) {
  return createHash("sha256").update(contents).digest("hex");
}

async function main() {
  fs.mkdirSync(prismaDir, { recursive: true });

  const database = new DatabaseSync(databasePath);

  try {
    database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS "_demo_migrations" (
        "name" TEXT NOT NULL PRIMARY KEY,
        "checksum" TEXT NOT NULL,
        "appliedAt" TEXT NOT NULL
      );
    `);

    const findAppliedMigration = database.prepare(
      'SELECT "name", "checksum" FROM "_demo_migrations" WHERE "name" = ?'
    );
    const insertAppliedMigration = database.prepare(
      'INSERT INTO "_demo_migrations" ("name", "checksum", "appliedAt") VALUES (?, ?, ?)'
    );

    const migrationFiles = getMigrationFiles();

    if (migrationFiles.length === 0) {
      console.log("[migrate] no migration files found.");
      return;
    }

    for (const migration of migrationFiles) {
      const sql = fs.readFileSync(migration.filePath, "utf8").trim();

      if (!sql) {
        console.log(`[migrate] skipped empty migration ${migration.name}`);
        continue;
      }

      const checksum = checksumOf(sql);
      const applied = findAppliedMigration.get(migration.name) as
        | { name: string; checksum: string }
        | undefined;

      if (applied) {
        if (applied.checksum !== checksum) {
          throw new Error(
            `Migration ${migration.name} was already applied with a different checksum.`
          );
        }

        console.log(`[migrate] already applied ${migration.name}`);
        continue;
      }

      database.exec("BEGIN");

      try {
        database.exec(sql);
        insertAppliedMigration.run(migration.name, checksum, new Date().toISOString());
        database.exec("COMMIT");
        console.log(`[migrate] applied ${migration.name}`);
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    }

    console.log(`[migrate] database ready at ${databasePath}`);
  } finally {
    database.close();
  }
}

main().catch((error) => {
  console.error("[migrate] failed", error);
  process.exitCode = 1;
});
