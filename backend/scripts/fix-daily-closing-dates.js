/*
 * One-off repair for daily closings that were saved one day early.
 *
 * DailyClosing.date is a calendar-date column, which Prisma writes in UTC,
 * but the old code handed it LOCAL midnight. In any timezone ahead of UTC
 * that lands on the previous calendar day, so a day closed on 15/09 was
 * stored - and listed, and printed on the PDF - as 14/09.
 *
 * The code no longer does that (see src/utils/business-day.js), but rows
 * written by the old code are still one day early. This script moves them.
 * The money and order figures are untouched: they were always calculated for
 * the correct day, only the label on them was wrong.
 *
 *   npm run fix:closing-dates                        # show what would change
 *   npm run fix:closing-dates -- --apply             # fix the dates
 *   npm run fix:closing-dates -- --apply --drop-duplicates
 *                                                    # also delete closings
 *                                                    # that duplicate a day
 *
 * How a row is judged, rather than blindly shifting everything:
 *
 *   stored date == the day it was closed on      -> already correct, left alone
 *   stored date + 1 == the day it was closed on  -> old bug, shifted forward
 *   anything else (a day closed later on)        -> reported, not touched,
 *                                                   because there is no way to
 *                                                   tell which day was meant
 *
 * That makes the script safe to run twice: once a row is correct it is skipped.
 */

require("dotenv").config();

const prisma = require("../src/config/prisma");

const MARKER_KEY = "dailyClosingDateFixAppliedAt";

const args = process.argv.slice(2);
const shouldApply = args.includes("--apply");
const dropDuplicates = args.includes("--drop-duplicates");

const toDateKey = (date) => date.toISOString().slice(0, 10);

const addOneDayKey = (key) => {
  const [year, month, day] = key.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return toDateKey(next);
};

const keyToCalendarDate = (key) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

// The calendar date on the wall clock of the machine that created the row -
// which is the day the manager pressed "Mbyll Diten".
const localDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

async function main() {
  const marker = await prisma.systemSetting.findUnique({
    where: { key: MARKER_KEY },
  });

  if (marker) {
    console.log(`(This repair last ran on ${marker.value}.)\n`);
  }

  const closings = await prisma.dailyClosing.findMany({
    orderBy: { date: "desc" },
    include: { closedBy: { select: { fullName: true } } },
  });

  if (!closings.length) {
    console.log("No daily closings found - nothing to repair.");
    return;
  }

  const rows = closings.map((closing) => {
    const storedKey = toDateKey(closing.date);
    const closedOnKey = localDateKey(closing.createdAt);

    let verdict;

    if (storedKey === closedOnKey) {
      verdict = "correct";
    } else if (addOneDayKey(storedKey) === closedOnKey) {
      verdict = "shift";
    } else {
      verdict = "unclear";
    }

    return {
      id: closing.id,
      storedKey,
      closedOnKey,
      closedAt: closing.createdAt,
      closedBy: closing.closedBy ? closing.closedBy.fullName : "-",
      targetKey: verdict === "shift" ? addOneDayKey(storedKey) : storedKey,
      verdict,
    };
  });

  // Two rows wanting the same date are two closings of the same day, one of
  // them mislabelled by the old bug. Nothing is deleted without being asked.
  const byTarget = new Map();

  for (const row of rows) {
    const existing = byTarget.get(row.targetKey) || [];
    existing.push(row);
    byTarget.set(row.targetKey, existing);
  }

  const duplicates = [];

  for (const [targetKey, group] of byTarget) {
    if (group.length < 2) {
      continue;
    }

    // Keep the row that is already correct; failing that, the newest one.
    const keeper =
      group.find((row) => row.verdict === "correct") ||
      group.slice().sort((left, right) => right.closedAt - left.closedAt)[0];

    for (const row of group) {
      if (row !== keeper) {
        row.verdict = "duplicate";
        row.duplicateOf = keeper.id;
        duplicates.push({ row, keeper, targetKey });
      }
    }
  }

  const label = {
    correct: "already correct",
    shift: "one day early -> will be fixed",
    duplicate: "same day as another closing",
    unclear: "cannot tell - left alone",
  };

  console.log("  id   stored       closed on    what it is");
  console.log("  ---------------------------------------------------------");

  for (const row of rows) {
    const arrow = row.verdict === "shift" ? ` -> ${row.targetKey}` : "";

    console.log(
      `  #${String(row.id).padEnd(4)} ${row.storedKey}   ${row.closedOnKey}   ` +
        `${label[row.verdict]}${arrow}`,
    );
  }

  const toShift = rows.filter((row) => row.verdict === "shift");
  const unclear = rows.filter((row) => row.verdict === "unclear");

  // Work out the moves against a live picture of which dates are taken, so a
  // move is only attempted when its date is genuinely free. Highest target
  // first: in a run of consecutive days, each row moves into the date the row
  // above it has just left.
  const heldBy = new Map();

  for (const row of rows) {
    if (dropDuplicates && row.verdict === "duplicate") {
      continue; // about to be deleted, so its date frees up
    }

    heldBy.set(row.storedKey, row.id);
  }

  const plannedMoves = [];
  const blockedMoves = [];

  for (const row of toShift
    .slice()
    .sort((left, right) => (left.targetKey < right.targetKey ? 1 : -1))) {
    const holder = heldBy.get(row.targetKey);

    if (holder !== undefined && holder !== row.id) {
      blockedMoves.push({ row, holder });
      continue;
    }

    heldBy.delete(row.storedKey);
    heldBy.set(row.targetKey, row.id);
    plannedMoves.push(row);
  }

  if (duplicates.length) {
    console.log("\nDuplicates:");

    for (const { row, keeper, targetKey } of duplicates) {
      console.log(
        `  #${row.id} (stored ${row.storedKey}) is the same day as #${keeper.id}, ` +
          `which already holds ${targetKey}.`,
      );
    }

    console.log(
      dropDuplicates
        ? "  --drop-duplicates was passed, so these will be DELETED."
        : "  They block the dates below from being fixed. Re-run with\n" +
            "  --apply --drop-duplicates to delete them, or delete them by hand\n" +
            "  from the closing history first.",
    );
  }

  if (unclear.length) {
    console.log(
      "\nLeft alone (closed on a different day than they are dated, so the\n" +
        "intended day cannot be worked out automatically):",
    );
    unclear.forEach((row) =>
      console.log(
        `  #${row.id}: dated ${row.storedKey}, closed on ${row.closedOnKey} by ${row.closedBy}`,
      ),
    );
  }

  if (blockedMoves.length) {
    console.log("\nCannot be fixed yet:");
    blockedMoves.forEach(({ row, holder }) =>
      console.log(
        `  #${row.id} needs ${row.targetKey}, but #${holder} is sitting on it.`,
      ),
    );
  }

  if (!plannedMoves.length && !(dropDuplicates && duplicates.length)) {
    console.log("\nNothing to change.");
    return;
  }

  if (!shouldApply) {
    console.log(
      `\nNothing was changed. Re-run with --apply${
        duplicates.length ? " --drop-duplicates" : ""
      } to write these corrections.`,
    );
    return;
  }

  if (dropDuplicates && duplicates.length) {
    console.log("\nDeleting duplicates...");

    for (const { row } of duplicates) {
      await prisma.dailyClosing.delete({ where: { id: row.id } });
      console.log(`  deleted #${row.id} (was dated ${row.storedKey})`);
    }
  }

  if (plannedMoves.length) {
    console.log("\nFixing dates...");

    for (const row of plannedMoves) {
      await prisma.dailyClosing.update({
        where: { id: row.id },
        data: { date: keyToCalendarDate(row.targetKey) },
      });
      console.log(`  #${row.id}: ${row.storedKey} -> ${row.targetKey}`);
    }
  }

  if (blockedMoves.length) {
    console.log(
      `\n${blockedMoves.length} date(s) were left as they are - see above for ` +
        "what is in the way.",
    );
  }

  const appliedAt = new Date().toISOString();

  await prisma.systemSetting.upsert({
    where: { key: MARKER_KEY },
    update: { value: appliedAt },
    create: { key: MARKER_KEY, value: appliedAt },
  });

  console.log("\nDone.");
}

main()
  .catch((error) => {
    console.error(
      "\nDaily closing date repair failed:",
      error.message || error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
