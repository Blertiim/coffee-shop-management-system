require("dotenv").config();

const fs = require("fs/promises");
const path = require("path");

const prisma = require("../src/config/prisma");

const defaultOutputDir = path.resolve(__dirname, "..", "reports");
const reportOutputDir = process.env.REPORT_OUTPUT_DIR
  ? path.resolve(process.env.REPORT_OUTPUT_DIR)
  : defaultOutputDir;
const reportSyncDir = process.env.REPORT_SYNC_DIR
  ? path.resolve(process.env.REPORT_SYNC_DIR)
  : "";

const toStartOfDay = (date) => {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

const toEndOfDayExclusive = (date) => {
  const nextDate = toStartOfDay(date);
  nextDate.setDate(nextDate.getDate() + 1);
  return nextDate;
};

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const escapeCsv = (value) => {
  const text = String(value ?? "");

  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
};

const run = async () => {
  await ensureDir(reportOutputDir);

  const targetDate = new Date();
  const from = toStartOfDay(targetDate);
  const to = toEndOfDayExclusive(targetDate);
  const dateKey = from.toISOString().slice(0, 10);

  const paidOrders = await prisma.order.findMany({
    where: {
      status: "paid",
      updatedAt: {
        gte: from,
        lt: to,
      },
    },
    include: {
      user: {
        select: {
          fullName: true,
        },
      },
      table: {
        select: {
          number: true,
        },
      },
      items: {
        include: {
          product: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      updatedAt: "asc",
    },
  });

  const totalRevenue = paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const lines = [
    ["Report Date", dateKey],
    ["Paid Orders", paidOrders.length],
    ["Total Revenue", totalRevenue.toFixed(2)],
    [],
    ["Order ID", "Table", "Waiter", "Total", "Updated At", "Items"],
    ...paidOrders.map((order) => [
      order.id,
      order.table?.number || "",
      order.user?.fullName || "",
      Number(order.total || 0).toFixed(2),
      order.updatedAt.toISOString(),
      order.items
        .map((item) => `${item.product?.name || "Product"} x${item.quantity}`)
        .join(" | "),
    ]),
  ];

  const csv = lines.map((row) => row.map(escapeCsv).join(",")).join("\n");
  const fileName = `daily-sales-${dateKey}.csv`;
  const outputPath = path.join(reportOutputDir, fileName);

  await fs.writeFile(outputPath, csv, "utf8");

  let syncedPath = null;

  if (reportSyncDir) {
    await ensureDir(reportSyncDir);
    syncedPath = path.join(reportSyncDir, fileName);
    await fs.copyFile(outputPath, syncedPath);
  }

  console.log(
    JSON.stringify({
      success: true,
      date: dateKey,
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
