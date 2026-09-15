/*
 * Day boundaries for the business, in the bar's own timezone.
 *
 * Every "today", "yesterday", daily total and daily closing depends on where
 * a day starts and ends. Using the server's own clock for that looks fine in
 * development (the laptop is in the bar's timezone) and quietly breaks in
 * production: Render runs in UTC, so "today" would flip at 02:00 local time
 * and every order taken between midnight and 02:00 would be counted - and
 * reported, and closed - on the previous day.
 *
 * So the timezone is stated explicitly here instead of being inherited from
 * whatever machine happens to run the code. Override it with BUSINESS_TIMEZONE
 * if the bar is somewhere else.
 */

const DEFAULT_TIME_ZONE = "Europe/Belgrade"; // same offset as Kosovo, incl. DST

const businessTimeZone = process.env.BUSINESS_TIMEZONE || DEFAULT_TIME_ZONE;

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: businessTimeZone,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const pad = (value) => String(value).padStart(2, "0");

// What the wall clock in the bar reads at a given instant.
const getZonedParts = (date) => {
  const parts = {};

  for (const { type, value } of partsFormatter.formatToParts(date)) {
    if (type !== "literal") {
      parts[type] = value;
    }
  }

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // Some ICU versions report midnight as hour 24 with hour12: false.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
};

// How far the bar's clock is from UTC at that instant (+2h in summer here,
// +1h in winter - read, never assumed).
const getOffsetMs = (date) => {
  const parts = getZonedParts(date);
  const asIfUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asIfUtc - (date.getTime() - date.getMilliseconds());
};

// The instant at which a calendar day begins in the bar's timezone. Resolved
// twice because the offset itself can differ between the instant we are asked
// about and midnight of that day (the two DST weekends).
const startOfDayFromCalendar = (year, month, day) => {
  const localMidnight = Date.UTC(year, month - 1, day);
  let utcMs = localMidnight - getOffsetMs(new Date(localMidnight));
  utcMs = localMidnight - getOffsetMs(new Date(utcMs));

  return new Date(utcMs);
};

const startOfBusinessDay = (date) => {
  const { year, month, day } = getZonedParts(date);
  return startOfDayFromCalendar(year, month, day);
};

// Exclusive end of the day: the next day's start. Taken by stepping well into
// the next day and snapping back, so a 23-hour or 25-hour DST day is handled
// without special cases.
const endOfBusinessDayExclusive = (date) => {
  const start = startOfBusinessDay(date);
  return startOfBusinessDay(new Date(start.getTime() + 26 * 60 * 60 * 1000));
};

// "2026-09-15" as the bar reads the calendar at that instant.
const businessDateKey = (date) => {
  const { year, month, day } = getZonedParts(date);
  return `${year}-${pad(month)}-${pad(day)}`;
};

// Value for a calendar-date column (@db.Date), which Prisma writes in UTC:
// UTC midnight of the same calendar date the bar is having.
const businessCalendarDate = (date) => {
  const { year, month, day } = getZonedParts(date);
  return new Date(Date.UTC(year, month - 1, day));
};

// Accepts "YYYY-MM-DD" (read as that calendar day in the bar's timezone) or
// anything the Date constructor understands. Returns null when unparseable so
// the caller can raise its own validation error.
const parseBusinessDate = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const [year, month, day] = value.trim().split("-").map(Number);
    const parsed = startOfDayFromCalendar(year, month, day);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

module.exports = {
  businessTimeZone,
  businessCalendarDate,
  businessDateKey,
  endOfBusinessDayExclusive,
  parseBusinessDate,
  startOfBusinessDay,
};
