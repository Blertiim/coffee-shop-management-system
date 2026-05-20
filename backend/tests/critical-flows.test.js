process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "coffee-shop-test-secret";
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS || "*";

require("dotenv").config();

const assert = require("node:assert/strict");
const { after, before, describe, it } = require("node:test");
const bcrypt = require("bcryptjs");

const app = require("../src/app");
const prisma = require("../src/config/prisma");

const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const testState = {
  categoryId: null,
  managerId: null,
  waiterId: null,
  productIds: [],
  tableIds: [],
  orderIds: [],
};

let server;
let baseUrl;
let managerToken;

const wait = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const request = async (path, { token, method = "GET", body } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => null);

  return {
    body: payload,
    data: payload?.data ?? payload,
    response,
  };
};

const expectOk = async (path, options) => {
  const result = await request(path, options);

  assert.equal(
    result.response.ok,
    true,
    `${options?.method || "GET"} ${path} failed: ${JSON.stringify(result.body)}`
  );

  return result.data;
};

const createProduct = async ({ name, stock, price = 2.5 }) => {
  const product = await prisma.product.create({
    data: {
      name: `${name} ${runId}`,
      description: "Integration test product",
      price,
      stock,
      stockUnit: "cope",
      categoryId: testState.categoryId,
      isAvailable: true,
    },
  });
  testState.productIds.push(product.id);
  return product;
};

const createTable = async (offset) => {
  const table = await prisma.table.create({
    data: {
      number: 900000 + offset + Math.floor(Math.random() * 10000),
      capacity: 4,
      location: "Integration Test",
      status: "available",
    },
  });
  testState.tableIds.push(table.id);
  return table;
};

const loginAsManager = async () => {
  const login = await expectOk("/api/auth/login", {
    method: "POST",
    body: {
      email: `manager-${runId}@test.local`,
      password: "2468",
    },
  });

  return login.token;
};

const waitForAuditLog = async (predicate) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const match = logs.find(predicate);

    if (match) {
      return match;
    }

    await wait(50);
  }

  return null;
};

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const passwordHash = await bcrypt.hash("2468", 10);

  const [category, manager, waiter] = await prisma.$transaction([
    prisma.category.create({
      data: {
        name: `Integration Test ${runId}`,
        description: "Critical flow tests",
      },
    }),
    prisma.user.create({
      data: {
        fullName: `Integration Manager ${runId}`,
        email: `manager-${runId}@test.local`,
        password: passwordHash,
        role: "manager",
        status: "active",
      },
    }),
    prisma.user.create({
      data: {
        fullName: `Integration Waiter ${runId}`,
        email: `waiter-${runId}@test.local`,
        password: passwordHash,
        role: "waiter",
        status: "active",
      },
    }),
  ]);

  testState.categoryId = category.id;
  testState.managerId = manager.id;
  testState.waiterId = waiter.id;
  managerToken = await loginAsManager();
});

after(async () => {
  await prisma.order.deleteMany({
    where: {
      OR: [
        { id: { in: testState.orderIds } },
        { tableId: { in: testState.tableIds } },
      ],
    },
  });
  await prisma.tableAccessToken.deleteMany({
    where: { tableId: { in: testState.tableIds } },
  });
  await prisma.table.deleteMany({
    where: { id: { in: testState.tableIds } },
  });
  await prisma.product.deleteMany({
    where: { id: { in: testState.productIds } },
  });
  await prisma.category.deleteMany({
    where: { id: testState.categoryId || 0 },
  });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorId: { in: [testState.managerId, testState.waiterId].filter(Boolean) } },
        { route: { contains: "/api/guest/access/" } },
      ],
    },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [testState.managerId, testState.waiterId].filter(Boolean) } },
  });
  await prisma.$disconnect();
  await new Promise((resolve) => server.close(resolve));
});

describe("critical API flows", () => {
  it("covers auth login, protected route access, POS staff, and POS login", async () => {
    const login = await expectOk("/api/auth/login", {
      method: "POST",
      body: {
        email: `manager-${runId}@test.local`,
        password: "2468",
      },
    });

    assert.equal(typeof login.token, "string");
    assert.equal(login.user.role, "manager");

    const protectedRoute = await expectOk("/api/test", {
      token: login.token,
    });
    assert.equal(protectedRoute.user.role, "manager");

    const posStaff = await expectOk("/api/auth/pos-staff");
    assert.equal(
      posStaff.some((profile) => profile.id === testState.waiterId && profile.role === "waiter"),
      true
    );

    const posLogin = await expectOk("/api/auth/pos-login", {
      method: "POST",
      body: {
        userId: testState.waiterId,
        pin: "2468",
      },
    });

    assert.equal(typeof posLogin.token, "string");
    assert.equal(posLogin.user.role, "waiter");
  });

  it("covers order creation, stock deduction, invoice generation, payment, and audit logging", async () => {
    const product = await createProduct({
      name: "Order Flow Coffee",
      stock: 8,
      price: 3,
    });
    const table = await createTable(1);

    const createdOrder = await expectOk("/api/orders", {
      token: managerToken,
      method: "POST",
      body: {
        tableId: table.id,
        paymentMethod: "cash",
        items: [{ productId: product.id, quantity: 2 }],
      },
    });
    testState.orderIds.push(createdOrder.id);

    assert.equal(createdOrder.status, "pending");
    assert.equal(createdOrder.total, 6);

    const afterCreateProduct = await prisma.product.findUnique({
      where: { id: product.id },
    });
    assert.equal(afterCreateProduct.stock, 6);

    const invoiceOrder = await expectOk(`/api/orders/${createdOrder.id}/generate-invoice`, {
      token: managerToken,
      method: "PATCH",
    });
    assert.equal(invoiceOrder.status, "pending_payment");

    const paidOrder = await expectOk(`/api/orders/${createdOrder.id}/complete-payment`, {
      token: managerToken,
      method: "PATCH",
      body: { paymentMethod: "card" },
    });
    assert.equal(paidOrder.status, "paid");
    assert.equal(paidOrder.paymentMethod, "card");

    const afterPaymentProduct = await prisma.product.findUnique({
      where: { id: product.id },
    });
    assert.equal(afterPaymentProduct.stock, 6);

    const finalTable = await prisma.table.findUnique({
      where: { id: table.id },
    });
    assert.equal(finalTable.status, "available");

    const auditLog = await waitForAuditLog(
      (log) =>
        log.route === `/api/orders/${createdOrder.id}/complete-payment` &&
        log.method === "PATCH" &&
        log.statusCode === 200
    );
    assert.ok(auditLog, "complete payment should be written to audit logs");
  });

  it("covers guest QR access, menu retrieval, guest order submission, and stock deduction", async () => {
    const product = await createProduct({
      name: "Guest Flow Juice",
      stock: 5,
      price: 4,
    });
    const table = await createTable(2);

    const access = await expectOk(`/api/guest/tables/${table.id}/access`, {
      token: managerToken,
    });
    assert.equal(access.table.id, table.id);
    assert.equal(typeof access.token, "string");

    const menu = await expectOk(`/api/guest/access/${access.token}/menu`);
    assert.equal(
      menu.products.some((menuProduct) => menuProduct.id === product.id),
      true
    );

    const guestOrder = await expectOk(`/api/guest/access/${access.token}/order`, {
      method: "POST",
      body: {
        items: [{ productId: product.id, quantity: 3 }],
      },
    });
    testState.orderIds.push(guestOrder.id);

    assert.equal(guestOrder.status, "pending");
    assert.equal(guestOrder.paymentMethod, "guest_qr");
    assert.equal(guestOrder.total, 12);

    const afterGuestOrderProduct = await prisma.product.findUnique({
      where: { id: product.id },
    });
    assert.equal(afterGuestOrderProduct.stock, 2);

    const occupiedTable = await prisma.table.findUnique({
      where: { id: table.id },
    });
    assert.equal(occupiedTable.status, "occupied");
  });
});
