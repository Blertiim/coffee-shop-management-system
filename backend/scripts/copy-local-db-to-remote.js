/*
 * Copies the whole local database into the online (production) one.
 *
 * Why not mysqldump: Windows MySQL stores table names lowercased while the
 * online server keeps Prisma's exact casing ("Product", not "product"), so a
 * dump taken here imports as a second, parallel set of tables that the app
 * never reads. Going through Prisma avoids that completely, and copies rows
 * with their original ids so every relation still points at the right row.
 *
 * Setup - create backend/.env.remote (git ignores it) with the online URL,
 * the same value as DATABASE_URL in Render:
 *
 *   TARGET_DATABASE_URL="mysql://user:password@host:port/database?ssl-mode=REQUIRED"
 *
 * Then, from the backend folder:
 *
 *   npm run copy:db                      # compare only, writes nothing
 *   npm run copy:db -- --apply --replace # wipe the online data, then copy
 *   npm run copy:db -- --apply           # copy without wiping (may hit
 *                                        # duplicate-key errors)
 *
 * --replace deletes every row in the online database first. That is the point
 * when it is a staging/demo database, and a disaster when it is not, so it
 * only ever runs when both flags are passed explicitly.
 */

require("dotenv").config();
require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env.remote"),
});

const { PrismaClient } = require("@prisma/client");

const args = process.argv.slice(2);
const shouldApply = args.includes("--apply");
const shouldReplace = args.includes("--replace");
const allowLocalTarget = args.includes("--allow-local-target");
const onlyArgument = args.find((value) => value.startsWith("--only="));
const onlyModels = onlyArgument
  ? onlyArgument
      .slice("--only=".length)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  : null;

const CHUNK_SIZE = 500;

// Parents before children, so every foreign key already has its row to point
// at. Deleting walks this list backwards.
const MODELS = [
  "user",
  "category",
  "employee",
  "supplier",
  "ingredient",
  "expense",
  "systemAlert",
  "systemSetting",
  "product",
  "table",
  "recipe",
  "recipeItem",
  "order",
  "orderItem",
  "reservation",
  "stockIntake",
  "stockIntakeItem",
  "stockMovement",
  "inventory",
  "supplierOrder",
  "supplierOrderItem",
  "shift",
  "auditLog",
  "dailyClosing",
  "tableAccessToken",
];

const describeUrl = (url) => {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || "3306"}${parsed.pathname}`;
  } catch (error) {
    return "(unreadable connection string)";
  }
};

const isLocalUrl = (url) => {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch (error) {
    return false;
  }
};

const chunk = (rows) => {
  const chunks = [];

  for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
    chunks.push(rows.slice(index, index + CHUNK_SIZE));
  }

  return chunks;
};

async function main() {
  const sourceUrl = process.env.DATABASE_URL;
  const targetUrl = process.env.TARGET_DATABASE_URL;

  if (!sourceUrl) {
    throw new Error("DATABASE_URL is missing - is backend/.env there?");
  }

  if (!targetUrl) {
    throw new Error(
      "TARGET_DATABASE_URL is missing. Create backend/.env.remote with:\n" +
        '  TARGET_DATABASE_URL="mysql://user:password@host:port/database"',
    );
  }

  if (sourceUrl === targetUrl) {
    throw new Error(
      "TARGET_DATABASE_URL is the same as DATABASE_URL - that would copy the " +
        "local database onto itself. Use the online connection string.",
    );
  }

  if (isLocalUrl(targetUrl) && !allowLocalTarget) {
    throw new Error(
      `The target (${describeUrl(targetUrl)}) looks like a local database. ` +
        "If that is really what you want, add --allow-local-target.",
    );
  }

  const models = onlyModels
    ? MODELS.filter((model) =>
        onlyModels.some(
          (requested) => requested.toLowerCase() === model.toLowerCase(),
        ),
      )
    : MODELS;

  if (!models.length) {
    throw new Error(
      `--only matched no known table. Known: ${MODELS.join(", ")}`,
    );
  }

  const source = new PrismaClient({
    datasources: { db: { url: sourceUrl } },
  });
  const target = new PrismaClient({
    datasources: { db: { url: targetUrl } },
  });

  try {
    console.log(`FROM (local):  ${describeUrl(sourceUrl)}`);
    console.log(`TO   (online): ${describeUrl(targetUrl)}\n`);

    const sourceCounts = {};
    const targetCounts = {};

    for (const model of models) {
      sourceCounts[model] = await source[model].count();
      targetCounts[model] = await target[model].count();
    }

    console.log("table                    local   online");
    console.log("------------------------------------------");
    for (const model of models) {
      console.log(
        `${model.padEnd(24)} ${String(sourceCounts[model]).padStart(5)}   ${String(
          targetCounts[model],
        ).padStart(6)}`,
      );
    }

    const onlineRows = Object.values(targetCounts).reduce(
      (sum, value) => sum + value,
      0,
    );

    if (!shouldApply) {
      console.log(
        `\nNothing was written. The online database currently holds ${onlineRows} row(s).` +
          "\nRe-run with --apply --replace to overwrite it with the local data.",
      );
      return;
    }

    if (shouldReplace) {
      console.log("\nClearing the online database...");

      for (const model of [...models].reverse()) {
        const { count } = await target[model].deleteMany({});

        if (count) {
          console.log(`  cleared ${model}: ${count} row(s)`);
        }
      }
    } else if (onlineRows > 0) {
      console.log(
        "\nNote: copying into a database that already has rows, without --replace." +
          "\nRows with an id that already exists there will fail.",
      );
    }

    console.log("\nCopying...");

    for (const model of models) {
      const rows = await source[model].findMany();

      if (!rows.length) {
        continue;
      }

      let copied = 0;

      for (const batch of chunk(rows)) {
        const result = await target[model].createMany({ data: batch });
        copied += result.count;
      }

      console.log(`  ${model}: ${copied} row(s)`);
    }

    console.log("\nChecking the result...");

    const mismatches = [];

    for (const model of models) {
      const finalCount = await target[model].count();

      if (finalCount !== sourceCounts[model]) {
        mismatches.push(
          `${model}: local ${sourceCounts[model]}, online ${finalCount}`,
        );
      }
    }

    if (mismatches.length) {
      console.log("\nThese tables do not match:");
      mismatches.forEach((line) => console.log(`  ${line}`));
      process.exitCode = 1;
      return;
    }

    console.log("\nDone - every table matches the local database.");
  } finally {
    await source.$disconnect();
    await target.$disconnect();
  }
}

main().catch((error) => {
  console.error(`\nCopy failed: ${error.message}`);
  process.exitCode = 1;
});
