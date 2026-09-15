/*
 * Prepares the database for a real install: clears every trace of testing and
 * of the demo accounts, then creates the real staff, tables and menu from
 * handover-setup.json.
 *
 * Why this exists: seed-pos-demo.js creates staff with PINs that are written
 * in the repository (manager 1111, waiters 1234/5678/2468), plus a demo menu
 * and test orders. Handing that over means anyone who has seen the project
 * knows the manager PIN, and the reports start out full of test money.
 *
 *   copy handover-setup.example.json to handover-setup.json and fill it in
 *
 *   npm run handover:prepare            # show what would happen, change nothing
 *   npm run handover:prepare -- --apply # do it
 *
 * Runs against DATABASE_URL in backend/.env. Point that at whichever database
 * is being handed over (local, or the online one) and check the host it prints
 * before passing --apply - this deletes data.
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const prisma = require("../src/config/prisma");

const args = process.argv.slice(2);
const shouldApply = args.includes("--apply");
const keepMenu = args.includes("--keep-menu");

const SETUP_FILE = path.join(__dirname, "..", "handover-setup.json");

// The waiter screen only knows these three sections (MONITOR_SECTIONS in
// TableSelectionScreen.jsx maps them to Salla / Terrasa1 / Terrasa2). A table
// saved under any other location simply never shows up for the waiters, so
// the setup file is checked against this list instead of failing silently.
const ALLOWED_TABLE_LOCATIONS = ["Main Hall", "Terrace 1", "Terrace 2"];

const POS_ROLES = ["manager", "waiter"];

// PINs published in the repo's demo seed - refused outright, and the reason
// this script exists.
const DEMO_PINS = ["1111", "1234", "5678", "2468"];
const DEMO_EMAIL_SUFFIX = "@pos.local";

// Everything that is transaction/history data: always cleared, in an order
// that respects the foreign keys.
const TEST_DATA_MODELS = [
  "orderItem",
  "order",
  "dailyClosing",
  "expense",
  "auditLog",
  "systemAlert",
  "stockMovement",
  "stockIntakeItem",
  "stockIntake",
  "supplierOrderItem",
  "supplierOrder",
  "reservation",
  "shift",
  "tableAccessToken",
  "inventory",
];

// The menu and floor plan: cleared and rebuilt from the setup file, unless
// --keep-menu is passed.
const CATALOG_MODELS = [
  "recipeItem",
  "recipe",
  "product",
  "category",
  "ingredient",
  "supplier",
  "table",
];

const describeUrl = (url) => {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || "3306"}${parsed.pathname}`;
  } catch (error) {
    return "(unreadable connection string)";
  }
};

const slugifyEmail = (fullName, index) => {
  const slug = fullName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");

  return `${slug || `staf${index + 1}`}@bar.local`;
};

const readSetup = () => {
  if (!fs.existsSync(SETUP_FILE)) {
    throw new Error(
      "handover-setup.json is missing.\n" +
        "Copy handover-setup.example.json to handover-setup.json and fill in the\n" +
        "real staff, tables and menu.",
    );
  }

  let setup;

  try {
    setup = JSON.parse(fs.readFileSync(SETUP_FILE, "utf8"));
  } catch (error) {
    throw new Error(`handover-setup.json is not valid JSON: ${error.message}`);
  }

  const problems = [];
  const staff = Array.isArray(setup.staff) ? setup.staff : [];
  const tables = Array.isArray(setup.tables) ? setup.tables : [];
  const menu = Array.isArray(setup.menu) ? setup.menu : [];

  if (!staff.length) {
    problems.push("staff: at least one manager is needed to log in");
  }

  if (!staff.some((member) => member.role === "manager")) {
    problems.push('staff: nobody has "role": "manager"');
  }

  const seenPins = new Set();
  const seenEmails = new Set();

  staff.forEach((member, index) => {
    const label = member.fullName || `staff #${index + 1}`;

    if (!member.fullName || typeof member.fullName !== "string") {
      problems.push(`staff #${index + 1}: fullName is missing`);
    }

    if (!POS_ROLES.includes(member.role)) {
      problems.push(
        `${label}: role must be "manager" or "waiter" (got ${JSON.stringify(member.role)})`,
      );
    }

    if (!/^\d{4,6}$/.test(String(member.pin || ""))) {
      problems.push(`${label}: pin must be 4-6 digits`);
    } else if (DEMO_PINS.includes(String(member.pin))) {
      problems.push(
        `${label}: pin ${member.pin} is one of the demo PINs from the repository - pick another`,
      );
    } else if (seenPins.has(String(member.pin))) {
      problems.push(`${label}: pin ${member.pin} is used by two people`);
    } else {
      seenPins.add(String(member.pin));
    }

    const email = member.email || slugifyEmail(member.fullName || "", index);

    if (seenEmails.has(email)) {
      problems.push(`${label}: email ${email} is used twice`);
    }

    seenEmails.add(email);
  });

  const seenNumbers = new Set();

  tables.forEach((group, index) => {
    if (!ALLOWED_TABLE_LOCATIONS.includes(group.location)) {
      problems.push(
        `tables #${index + 1}: location must be one of ${ALLOWED_TABLE_LOCATIONS.map(
          (value) => `"${value}"`,
        ).join(", ")} (got ${JSON.stringify(group.location)}) - ` +
          "the waiter screen shows no other section",
      );
    }

    if (!Array.isArray(group.numbers) || !group.numbers.length) {
      problems.push(`tables #${index + 1}: numbers must be a non-empty list`);
      return;
    }

    group.numbers.forEach((number) => {
      if (!Number.isInteger(number) || number <= 0) {
        problems.push(
          `tables #${index + 1}: table number ${JSON.stringify(number)} is not a positive whole number`,
        );
        return;
      }

      if (seenNumbers.has(number)) {
        problems.push(`table number ${number} appears twice`);
      }

      seenNumbers.add(number);
    });
  });

  const seenProducts = new Set();

  menu.forEach((section, index) => {
    if (!section.category) {
      problems.push(`menu #${index + 1}: category name is missing`);
    }

    const products = Array.isArray(section.products) ? section.products : [];

    if (!products.length) {
      problems.push(`menu "${section.category}": has no products`);
    }

    products.forEach((product) => {
      if (!product.name) {
        problems.push(`menu "${section.category}": a product has no name`);
        return;
      }

      if (typeof product.price !== "number" || product.price < 0) {
        problems.push(`product "${product.name}": price must be a number`);
      }

      if (seenProducts.has(product.name)) {
        problems.push(`product "${product.name}" appears twice`);
      }

      seenProducts.add(product.name);
    });
  });

  if (problems.length) {
    throw new Error(
      `handover-setup.json needs fixing:\n  - ${problems.join("\n  - ")}`,
    );
  }

  return { ...setup, staff, tables, menu };
};

async function main() {
  console.log(`Database: ${describeUrl(process.env.DATABASE_URL || "")}\n`);

  const setup = readSetup();
  const tableCount = setup.tables.reduce(
    (sum, group) => sum + group.numbers.length,
    0,
  );
  const productCount = setup.menu.reduce(
    (sum, section) => sum + section.products.length,
    0,
  );

  const modelsToClear = keepMenu
    ? TEST_DATA_MODELS
    : [...TEST_DATA_MODELS, ...CATALOG_MODELS];

  console.log("Will be deleted:");

  let totalToDelete = 0;

  for (const model of modelsToClear) {
    const count = await prisma[model].count();
    totalToDelete += count;

    if (count) {
      console.log(`  ${model.padEnd(20)} ${count} row(s)`);
    }
  }

  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: DEMO_EMAIL_SUFFIX } },
    select: { id: true, fullName: true, email: true },
  });

  const otherUsers = await prisma.user.findMany({
    where: { NOT: { email: { endsWith: DEMO_EMAIL_SUFFIX } } },
    select: { id: true, fullName: true, email: true, role: true },
  });

  if (demoUsers.length) {
    console.log(`  demo staff           ${demoUsers.length} account(s):`);
    demoUsers.forEach((user) =>
      console.log(`    - ${user.fullName} (${user.email})`),
    );
  }

  if (!totalToDelete && !demoUsers.length) {
    console.log("  (nothing - the database is already clean)");
  }

  if (otherUsers.length) {
    console.log(
      `\nKept as they are (not demo accounts, ${otherUsers.length}):`,
    );
    otherUsers.forEach((user) =>
      console.log(`  - ${user.fullName} (${user.email}) [${user.role}]`),
    );
    console.log(
      "  Staff from handover-setup.json is added/updated by name+role, so an\n" +
        "  existing account with the same name keeps its id and gets the new PIN.",
    );
  }

  console.log("\nWill be created from handover-setup.json:");
  console.log(`  bar name   ${setup.barName || "(unchanged)"}`);
  console.log(
    `  staff      ${setup.staff.length} (${setup.staff
      .map((member) => `${member.fullName}/${member.role}`)
      .join(", ")})`,
  );
  console.log(
    `  tables     ${tableCount} across ${setup.tables.length} section(s)`,
  );
  console.log(
    keepMenu
      ? "  menu       kept as it is (--keep-menu)"
      : `  menu       ${productCount} product(s) in ${setup.menu.length} category(ies)`,
  );

  if (!shouldApply) {
    console.log(
      "\nNothing was changed. Re-run with --apply to clear and set up the database.",
    );
    return;
  }

  console.log("\nClearing...");

  for (const model of modelsToClear) {
    const { count } = await prisma[model].deleteMany({});

    if (count) {
      console.log(`  ${model}: ${count} row(s) deleted`);
    }
  }

  if (demoUsers.length) {
    const { count } = await prisma.user.deleteMany({
      where: { email: { endsWith: DEMO_EMAIL_SUFFIX } },
    });
    console.log(`  demo staff: ${count} account(s) deleted`);
  }

  console.log("\nSetting up...");

  for (const member of setup.staff) {
    const email = member.email || slugifyEmail(member.fullName, 0);
    const passwordHash = await bcrypt.hash(String(member.pin), 10);
    const existing =
      (await prisma.user.findUnique({ where: { email } })) ||
      (await prisma.user.findFirst({
        where: { fullName: member.fullName, role: member.role },
      }));

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          fullName: member.fullName,
          email,
          password: passwordHash,
          role: member.role,
          status: "active",
        },
      });
      console.log(`  staff updated: ${member.fullName} (${member.role})`);
    } else {
      await prisma.user.create({
        data: {
          fullName: member.fullName,
          email,
          password: passwordHash,
          role: member.role,
          status: "active",
        },
      });
      console.log(`  staff created: ${member.fullName} (${member.role})`);
    }
  }

  for (const group of setup.tables) {
    for (const number of group.numbers) {
      await prisma.table.upsert({
        where: { number },
        update: {
          capacity: group.capacity || 4,
          location: group.location,
          status: "available",
        },
        create: {
          number,
          capacity: group.capacity || 4,
          location: group.location,
          status: "available",
        },
      });
    }

    console.log(
      `  tables: ${group.numbers.length} in ${group.location} (${group.numbers.join(", ")})`,
    );
  }

  if (!keepMenu) {
    for (const section of setup.menu) {
      const category = await prisma.category.upsert({
        where: { name: section.category },
        update: { description: section.description || null },
        create: {
          name: section.category,
          description: section.description || null,
        },
      });

      for (const product of section.products) {
        await prisma.product.create({
          data: {
            name: product.name,
            description: product.description || null,
            price: product.price,
            stock: Number.isInteger(product.stock) ? product.stock : 0,
            categoryId: category.id,
            isAvailable: true,
          },
        });
      }

      console.log(
        `  menu: ${section.products.length} product(s) in ${section.category}`,
      );
    }
  }

  if (setup.barName) {
    await prisma.systemSetting.upsert({
      where: { key: "barName" },
      update: { value: setup.barName },
      create: { key: "barName", value: setup.barName },
    });
    console.log(`  bar name: ${setup.barName}`);
  }

  console.log(
    "\nDone. The database now holds only the real staff, tables and menu." +
      "\nCheck the PIN of each person in handover-setup.json, then delete that file" +
      "\nor keep it somewhere private - it has the PINs in plain text.",
  );
}

main()
  .catch((error) => {
    console.error(`\n${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
