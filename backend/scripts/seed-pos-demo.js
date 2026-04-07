require("dotenv").config();

const bcrypt = require("bcryptjs");
const prisma = require("../src/config/prisma");

const DEFAULT_MANAGER_PIN = "1111";
const DEFAULT_WAITER_PIN = "1234";

const STAFF_PROFILES = [
  {
    fullName: "Meti Manager",
    email: "meti.manager@pos.local",
    role: "manager",
    pin: DEFAULT_MANAGER_PIN,
  },
  {
    fullName: "Mili Waiter",
    email: "mili.waiter@pos.local",
    role: "waiter",
    pin: DEFAULT_WAITER_PIN,
  },
  {
    fullName: "Egzon Waiter",
    email: "egzon.waiter@pos.local",
    role: "waiter",
    pin: DEFAULT_WAITER_PIN,
  },
];

const TABLE_LOCATIONS = [
  { label: "Main Hall", numbers: [1, 2, 3, 4, 5, 6, 7, 8, 19, 20] },
  { label: "Terrace 1", numbers: [9, 10, 11, 12, 13, 14, 21, 22] },
  { label: "Terrace 2", numbers: [15, 16, 17, 18, 23, 24] },
];

const CATALOG = [
  {
    category: "Coffee",
    description: "Hot coffee and warm beverages",
    products: [
      { name: "Espresso", price: 1.0, stock: 220 },
      { name: "Double Espresso", price: 1.6, stock: 220 },
      { name: "Macchiato", price: 1.0, stock: 200 },
      { name: "Large Macchiato", price: 1.3, stock: 200 },
      { name: "Cappuccino", price: 1.5, stock: 180 },
      { name: "Latte", price: 1.7, stock: 170 },
      { name: "Flat White", price: 1.8, stock: 170 },
      { name: "Americano", price: 1.2, stock: 190 },
      { name: "Mocha", price: 2.0, stock: 160 },
      { name: "Turkish Coffee", price: 1.3, stock: 160 },
      { name: "Nescafe", price: 1.2, stock: 160 },
      { name: "Hot Chocolate", price: 1.6, stock: 150 },
      { name: "Tea", price: 1.0, stock: 210 },
    ],
  },
  {
    category: "Beer",
    description: "Beer selection",
    products: [
      { name: "Peja", price: 2.2, stock: 160 },
      { name: "Prishtina", price: 2.2, stock: 120 },
      { name: "Heineken", price: 2.6, stock: 140 },
      { name: "Corona", price: 3.2, stock: 100 },
      { name: "Stella Artois", price: 2.9, stock: 120 },
      { name: "Tuborg", price: 2.5, stock: 110 },
      { name: "Birra e Vogel", price: 1.8, stock: 180 },
      { name: "Birra e Madhe", price: 2.8, stock: 140 },
    ],
  },
  {
    category: "Soft Drinks",
    description: "Soft drinks and juices",
    products: [
      { name: "Coca-Cola", price: 1.8, stock: 220 },
      { name: "Coca-Cola Zero", price: 1.8, stock: 140 },
      { name: "Fanta", price: 1.8, stock: 180 },
      { name: "Sprite", price: 1.8, stock: 170 },
      { name: "Schweppes", price: 2.0, stock: 120 },
      { name: "Iced Tea Peach", price: 2.0, stock: 130 },
      { name: "Iced Tea Lemon", price: 2.0, stock: 130 },
      { name: "Red Bull", price: 2.8, stock: 120 },
      { name: "Water 0.5L", price: 1.0, stock: 260 },
      { name: "Water 1L", price: 1.5, stock: 180 },
      { name: "Sparkling Water", price: 1.6, stock: 150 },
      { name: "Orange Juice", price: 2.2, stock: 130 },
      { name: "Apple Juice", price: 2.2, stock: 130 },
    ],
  },
  {
    category: "Alcohol",
    description: "Spirits and wine",
    products: [
      { name: "Rakia", price: 2.0, stock: 140 },
      { name: "Whiskey", price: 3.5, stock: 110 },
      { name: "Vodka", price: 3.2, stock: 110 },
      { name: "Gin", price: 3.2, stock: 100 },
      { name: "Tequila", price: 3.8, stock: 90 },
      { name: "Jagermeister", price: 3.6, stock: 90 },
      { name: "Jack Daniel's", price: 4.0, stock: 100 },
      { name: "Johnnie Walker", price: 4.0, stock: 100 },
      { name: "Ballantine's", price: 3.8, stock: 100 },
      { name: "Absolute Vodka", price: 3.9, stock: 90 },
      { name: "Grey Goose", price: 4.8, stock: 80 },
      { name: "Wine Glass", price: 2.6, stock: 130 },
      { name: "Red Wine Bottle", price: 18.0, stock: 45 },
      { name: "White Wine Bottle", price: 18.0, stock: 45 },
    ],
  },
  {
    category: "Ice Cream",
    description: "Ice cream desserts",
    products: [
      { name: "Vanilla Ice Cream", price: 2.0, stock: 100 },
      { name: "Chocolate Ice Cream", price: 2.0, stock: 100 },
      { name: "Strawberry Ice Cream", price: 2.0, stock: 100 },
      { name: "Mixed Ice Cream", price: 2.4, stock: 100 },
      { name: "Ice Cream Cup Small", price: 2.2, stock: 90 },
      { name: "Ice Cream Cup Large", price: 3.0, stock: 80 },
      { name: "Banana Split", price: 3.8, stock: 70 },
    ],
  },
];

const ensureUser = async (profile) => {
  const passwordHash = await bcrypt.hash(profile.pin, 10);
  const existingUser = await prisma.user.findUnique({
    where: { email: profile.email },
  });

  if (!existingUser) {
    return prisma.user.create({
      data: {
        fullName: profile.fullName,
        email: profile.email,
        password: passwordHash,
        role: profile.role,
        status: "active",
      },
    });
  }

  return prisma.user.update({
    where: { email: profile.email },
    data: {
      fullName: profile.fullName,
      password: passwordHash,
      role: profile.role,
      status: "active",
    },
  });
};

const ensureTables = async () => {
  for (const location of TABLE_LOCATIONS) {
    for (const number of location.numbers) {
      const existingTable = await prisma.table.findUnique({
        where: { number },
      });

      if (!existingTable) {
        await prisma.table.create({
          data: {
            number,
            capacity: location.label === "Terrace 2" ? 6 : 4,
            location: location.label,
            status: "available",
          },
        });
      } else {
        await prisma.table.update({
          where: { number },
          data: {
            capacity: location.label === "Terrace 2" ? 6 : 4,
            location: location.label,
          },
        });
      }
    }
  }
};

const ensureCatalog = async () => {
  for (const section of CATALOG) {
    const category = await prisma.category.upsert({
      where: { name: section.category },
      update: {
        description: section.description,
      },
      create: {
        name: section.category,
        description: section.description,
      },
    });

    for (const item of section.products) {
      const existingProduct = await prisma.product.findFirst({
        where: { name: item.name },
      });

      if (!existingProduct) {
        await prisma.product.create({
          data: {
            name: item.name,
            description: `${item.name} - ${section.category}`,
            price: item.price,
            stock: item.stock,
            categoryId: category.id,
            isAvailable: true,
          },
        });
      } else {
        await prisma.product.update({
          where: { id: existingProduct.id },
          data: {
            price: item.price,
            stock: item.stock,
            categoryId: category.id,
            isAvailable: true,
          },
        });
      }
    }
  }
};

const assignTablesToWaiters = async (waiters) => {
  const allTables = await prisma.table.findMany({
    orderBy: { number: "asc" },
    select: { id: true, number: true },
  });

  if (!allTables.length || !waiters.length) {
    return;
  }

  for (let index = 0; index < allTables.length; index += 1) {
    const table = allTables[index];
    const waiter = waiters[index % waiters.length];

    await prisma.table.update({
      where: { id: table.id },
      data: {
        assignedWaiterId: waiter.id,
      },
    });
  }
};

async function main() {
  const createdUsers = [];

  for (const profile of STAFF_PROFILES) {
    const user = await ensureUser(profile);
    createdUsers.push(user);
  }

  await ensureTables();
  await ensureCatalog();

  const waiterUsers = createdUsers.filter((user) => user.role === "waiter");
  await assignTablesToWaiters(waiterUsers);

  console.log("POS demo data seeded successfully.");
  console.log(`Manager PIN: ${DEFAULT_MANAGER_PIN} (${STAFF_PROFILES[0].email})`);
  console.log(
    `Waiter PIN: ${DEFAULT_WAITER_PIN} (${STAFF_PROFILES
      .filter((profile) => profile.role === "waiter")
      .map((profile) => profile.email)
      .join(", ")})`
  );
}

main()
  .catch((error) => {
    console.error("POS demo seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
