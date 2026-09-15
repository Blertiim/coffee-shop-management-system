/*
 * One-off repair for daily closings saved one day early.
 *
 * DailyClosing.date is a calendar-date column, which Prisma writes in UTC,
 * but the old code handed it LOCAL midnight. In any timezone ahead of UTC
 * that lands on the previous calendar day, so a day closed on 15/09 was
 * stored - and listed, and printed on the PDF - as 14/09.
 *
 * dashboard.controller.js no longer does that, but rows written by the old
 * code are still one day early. This script moves each of them forward by one
 * day. The money and order figures are untouched: they were always calculated
 * for the correct local day, only the label on them was wrong.
 *
 *   node scripts/fix-daily-closing-dates.js            # show what would change
 *   node scripts/fix-daily-closing-dates.js --apply    # actually change it
 *
 * Run it once, before closing any new day. It records that it ran and refuses
 * to run a second time (--force overrides, but a second run would shift the
 * same rows one day too far).
 */

require("dotenv").config();

const prisma = require("../src/config/prisma");

const MARKER_KEY = "dailyClosingDateFixAppliedAt";

const args = process.argv.slice(2);
const shouldApply = args.includes("--apply");
const force = args.includes("--force");
const idsArgument = args.find((value) => value.startsWith("--ids="));
const onlyIds = idsArgument
  ? idsArgument
      .slice("--ids=".length)
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value))
  : null;

const toDateKey = (date) => date.toISOString().slice(0, 10);

const addOneDay = (date) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
};

const localDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const todayUtcKey = toDateKey(
  new Date(
    Date.UTC(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate(),
    ),
  ),
);

async function main() {
  const marker = await prisma.systemSetting.findUnique({
    where: { key: MARKER_KEY },
  });

  if (marker && !force) {
    console.log(
      `This repair already ran on ${marker.value}. Nothing to do.\n` +
        "(Running it again would move the same closings one more day forward.\n" +
        " Use --force only if you are sure that is what you want.)",
    );
    return;
  }

  const closings = await prisma.dailyClosing.findMany({
    orderBy: { date: "desc" },
    include: { closedBy: { select: { fullName: true } } },
  });

  const candidates = closings.filter(
    (closing) => !onlyIds || onlyIds.includes(closing.id),
  );

  if (!candidates.length) {
    console.log("No daily closings found - nothing to repair.");
    return;
  }

  console.log(
    `Found ${candidates.length} daily closing(s). Proposed correction:\n`,
  );

  const plan = [];

  for (const closing of candidates) {
    const currentKey = toDateKey(closing.date);
    const correctedDate = addOneDay(closing.date);
    const correctedKey = toDateKey(correctedDate);
    const closedOnKey = localDateKey(closing.createdAt);
    const notes = [];

    if (correctedKey > todayUtcKey) {
      notes.push("SKIPPED: correction would land in the future");
    }

    if (closedOnKey === correctedKey) {
      notes.push("matches the day it was closed on");
    }

    console.log(
      `  #${closing.id}  ${currentKey} -> ${correctedKey}` +
        `  (closed ${closing.createdAt.toLocaleString()}` +
        `${closing.closedBy ? ` by ${closing.closedBy.fullName}` : ""})` +
        `${notes.length ? `  [${notes.join("; ")}]` : ""}`,
    );

    if (correctedKey <= todayUtcKey) {
      plan.push({ id: closing.id, correctedDate, currentKey, correctedKey });
    }
  }

  if (!shouldApply) {
    console.log(
      "\nNothing was changed. Re-run with --apply to write these corrections.",
    );
    return;
  }

  if (!plan.length) {
    console.log("\nNothing to apply.");
    return;
  }

  // Newest first: a closing only moves onto a date the closing above it has
  // already vacated, so consecutive closed days don't collide on the way.
  for (const entry of plan) {
    await prisma.dailyClosing.update({
      where: { id: entry.id },
      data: { date: entry.correctedDate },
    });
    console.log(
      `  fixed #${entry.id}: ${entry.currentKey} -> ${entry.correctedKey}`,
    );
  }

  const appliedAt = new Date().toISOString();

  await prisma.systemSetting.upsert({
    where: { key: MARKER_KEY },
    update: { value: appliedAt },
    create: { key: MARKER_KEY, value: appliedAt },
  });

  console.log(`\nDone - ${plan.length} closing(s) corrected.`);
}

main()
  .catch((error) => {
    console.error("Daily closing date repair failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
