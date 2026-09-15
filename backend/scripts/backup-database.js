/*
 * Full database backup, meant to run every night unattended.
 *
 * backup:snapshot writes a JSON snapshot which is useful for reading, but it
 * deliberately leaves out password hashes, so it cannot restore a working
 * system. This one runs mysqldump, which can: one .sql file that recreates
 * everything, staff logins included.
 *
 *   npm run backup:db             # the local database (DATABASE_URL in .env)
 *   npm run backup:db -- --remote # the live online one (TARGET_DATABASE_URL
 *                                 # in .env.remote, the same file copy:db uses)
 *
 * --remote is the one that matters when the bar runs online: the data then
 * lives on somebody else's server, and a free database plan is not a safety
 * net. Schedule it from a machine that is on every night.
 *
 * Writes into BACKUP_OUTPUT_DIR (default backend/backups), copies the file to
 * BACKUP_SYNC_DIR when that is set - point it at a USB disk or a synced
 * folder, because a backup that lives only on the same machine does not
 * survive that machine - and deletes dumps older than BACKUP_RETENTION_DAYS
 * (default 30).
 *
 * To restore, with the app stopped:
 *
 *   mysql -u USER -p DATABASE < backups\the-file.sql
 *
 * Test that once, on a spare database, before relying on any of this.
 */

require("dotenv").config();
require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env.remote"),
});

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const useRemote = args.includes("--remote");

const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS || 30);

const outputDir = process.env.BACKUP_OUTPUT_DIR
  ? path.resolve(process.env.BACKUP_OUTPUT_DIR)
  : path.join(__dirname, "..", "backups");
const syncDir = process.env.BACKUP_SYNC_DIR
  ? path.resolve(process.env.BACKUP_SYNC_DIR)
  : "";

// Where mysqldump usually hides on Windows (XAMPP, then the MySQL installer),
// plus whatever is on PATH.
const MYSQLDUMP_CANDIDATES = [
  process.env.MYSQLDUMP_PATH,
  "mysqldump",
  "C:\\xampp\\mysql\\bin\\mysqldump.exe",
  "C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysqldump.exe",
  "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe",
  "C:\\wamp64\\bin\\mysql\\mysql8.0.31\\bin\\mysqldump.exe",
  "/usr/bin/mysqldump",
  "/usr/local/bin/mysqldump",
].filter(Boolean);

const findMysqldump = () => {
  for (const candidate of MYSQLDUMP_CANDIDATES) {
    const probe = spawnSync(candidate, ["--version"], { encoding: "utf8" });

    if (!probe.error && probe.status === 0) {
      return candidate;
    }
  }

  return null;
};

const parseDatabaseUrl = (value) => {
  const parsed = new URL(value);

  return {
    host: parsed.hostname,
    port: parsed.port || "3306",
    user: decodeURIComponent(parsed.username || ""),
    password: decodeURIComponent(parsed.password || ""),
    database: parsed.pathname.replace(/^\//, ""),
    isLocal: ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname),
  };
};

const timestamp = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");

  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`
  );
};

const formatSize = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

const pruneOldBackups = () => {
  if (!(RETENTION_DAYS > 0)) {
    return [];
  }

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const removed = [];

  for (const name of fs.readdirSync(outputDir)) {
    if (!/^db-.*\.sql$/.test(name)) {
      continue;
    }

    const filePath = path.join(outputDir, name);

    if (fs.statSync(filePath).mtimeMs < cutoff) {
      fs.unlinkSync(filePath);
      removed.push(name);
    }
  }

  return removed;
};

const run = () => {
  const connectionUrl = useRemote
    ? process.env.TARGET_DATABASE_URL
    : process.env.DATABASE_URL;

  if (!connectionUrl) {
    throw new Error(
      useRemote
        ? "TARGET_DATABASE_URL is missing. Create backend/.env.remote with the\n" +
            "online connection string (the same DATABASE_URL that is set in Render):\n" +
            '  TARGET_DATABASE_URL="mysql://user:password@host:port/database"'
        : "DATABASE_URL is missing - is backend/.env there?",
    );
  }

  const db = parseDatabaseUrl(connectionUrl);

  if (useRemote && db.isLocal) {
    throw new Error(
      `--remote was passed but TARGET_DATABASE_URL points at ${db.host}, ` +
        "which is this machine. Check backend/.env.remote.",
    );
  }

  const mysqldump = findMysqldump();

  if (!mysqldump) {
    throw new Error(
      "mysqldump was not found. Install the MySQL client tools, or set\n" +
        "MYSQLDUMP_PATH in backend/.env to the full path of mysqldump.exe\n" +
        "(with XAMPP it is usually C:\\xampp\\mysql\\bin\\mysqldump.exe).",
    );
  }

  fs.mkdirSync(outputDir, { recursive: true });

  // The label keeps online and local dumps apart in the same folder, so an
  // online backup is never mistaken for a local one when restoring.
  const fileName = `db-${useRemote ? "online" : "local"}-${db.database}-${timestamp()}.sql`;
  const filePath = path.join(outputDir, fileName);

  const dumpArgs = [
    `--host=${db.host}`,
    `--port=${db.port}`,
    `--user=${db.user}`,
    "--single-transaction", // consistent snapshot without locking the bar out
    "--routines",
    "--triggers",
    "--default-character-set=utf8mb4",
    db.database,
  ];

  if (!db.isLocal) {
    dumpArgs.unshift("--ssl-mode=REQUIRED");
  }

  console.log(`Backing up ${db.database} from ${db.host}:${db.port}`);
  console.log(`Using ${mysqldump}`);

  // The password goes through the environment, not the command line, so it
  // does not show up in the process list or in the scheduler's logs.
  const dump = spawnSync(mysqldump, dumpArgs, {
    env: { ...process.env, MYSQL_PWD: db.password },
    maxBuffer: 1024 * 1024 * 1024,
  });

  if (dump.error) {
    throw new Error(`Could not run mysqldump: ${dump.error.message}`);
  }

  if (dump.status !== 0) {
    throw new Error(
      `mysqldump failed (exit ${dump.status}):\n${dump.stderr.toString().trim()}`,
    );
  }

  fs.writeFileSync(filePath, dump.stdout);

  const { size } = fs.statSync(filePath);

  // A dump that was cut off halfway looks like a file and restores like a
  // disaster, so the footer mysqldump writes at the very end is checked.
  const tail = fs.readFileSync(filePath, "utf8").slice(-400);

  if (!tail.includes("Dump completed")) {
    throw new Error(
      `The dump looks incomplete (no "Dump completed" at the end of ${fileName}).\n` +
        "It was kept so you can look at it, but do not rely on it.",
    );
  }

  console.log(`Saved ${fileName} (${formatSize(size)})`);

  if (syncDir) {
    try {
      fs.mkdirSync(syncDir, { recursive: true });
      fs.copyFileSync(filePath, path.join(syncDir, fileName));
      console.log(`Copied to ${syncDir}`);
    } catch (copyError) {
      console.error(
        `WARNING: the second copy failed (${copyError.message}). ` +
          "The backup exists only on this machine.",
      );
      process.exitCode = 1;
    }
  } else {
    console.log(
      "BACKUP_SYNC_DIR is not set, so this backup exists only on this machine.",
    );
  }

  const removed = pruneOldBackups();

  if (removed.length) {
    console.log(
      `Deleted ${removed.length} backup(s) older than ${RETENTION_DAYS} days.`,
    );
  }

  console.log("Backup finished.");
};

try {
  run();
} catch (error) {
  console.error(`\nBackup FAILED: ${error.message}`);
  process.exitCode = 1;
}
