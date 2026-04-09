require("dotenv").config();

const fs = require("fs/promises");
const path = require("path");

const prisma = require("../src/config/prisma");

const defaultOutputDir = path.resolve(__dirname, "..", "backups");
const backupOutputDir = process.env.BACKUP_OUTPUT_DIR
  ? path.resolve(process.env.BACKUP_OUTPUT_DIR)
  : defaultOutputDir;
const backupSyncDir = process.env.BACKUP_SYNC_DIR
  ? path.resolve(process.env.BACKUP_SYNC_DIR)
  : "";

const stamp = new Date().toISOString().replace(/[:]/g, "-");

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const run = async () => {
  await ensureDir(backupOutputDir);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    users: await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    categories: await prisma.category.findMany(),
    products: await prisma.product.findMany(),
    tables: await prisma.table.findMany(),
    orders: await prisma.order.findMany({
      include: {
        items: true,
      },
    }),
    inventory: await prisma.inventory.findMany(),
    alerts: await prisma.systemAlert.findMany({
      orderBy: { createdAt: "desc" },
    }),
    auditLogs: await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 5000,
    }),
  };

  const fileName = `system-backup-${stamp}.json`;
  const outputPath = path.join(backupOutputDir, fileName);

  await fs.writeFile(outputPath, JSON.stringify(snapshot, null, 2), "utf8");

  let syncedPath = null;

  if (backupSyncDir) {
    await ensureDir(backupSyncDir);
    syncedPath = path.join(backupSyncDir, fileName);
    await fs.copyFile(outputPath, syncedPath);
  }

  console.log(
    JSON.stringify({
      success: true,
      outputPath,
      syncedPath,
    })
  );
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
