const operation = ({ tag, summary, flow, keywords = [], code, security = true }) => ({
  tags: [tag],
  summary,
  ...(security ? { security: [{ bearerAuth: [] }] } : {}),
  "x-flow": flow,
  "x-keywords": keywords,
  "x-code": code,
});

const code = (file, line) => ({ file, line });

const buildOpenApiSpec = (baseUrl) => ({
  openapi: "3.1.0",
  info: {
    title: "Cafe Management System API",
    version: "1.0.0",
    description:
      "Production-ready API documentation for the cafe management platform, including POS, manager analytics, guest QR ordering, audit logs, alerts, and export endpoints.",
  },
  servers: [
    {
      url: baseUrl,
      description: "Current API server",
    },
  ],
  tags: [
    { name: "Auth" },
    { name: "Dashboard" },
    { name: "Orders" },
    { name: "Products" },
    { name: "Categories" },
    { name: "Stock" },
    { name: "Suppliers" },
    { name: "Guest Ordering" },
    { name: "Staff" },
    { name: "Tables" },
    { name: "System" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  paths: {
    "/api/auth/login": {
      post: operation({
        tag: "Auth",
        summary: "Login with email and password",
        flow: "Login and Access",
        keywords: ["manager login", "admin login", "token"],
        code: code("backend/src/modules/auth/auth.routes.js", 33),
        security: false,
      }),
    },
    "/api/auth/pos-login": {
      post: operation({
        tag: "Auth",
        summary: "POS PIN login for waiter and manager accounts",
        flow: "POS to Dashboard",
        keywords: ["banak", "pos", "pin", "waiter", "manager"],
        code: code("backend/src/modules/auth/auth.routes.js", 35),
        security: false,
      }),
    },
    "/api/auth/pos-staff": {
      get: operation({
        tag: "Auth",
        summary: "List active POS staff profiles",
        flow: "POS to Dashboard",
        keywords: ["banak", "pos", "staff", "waiter"],
        code: code("backend/src/modules/auth/auth.routes.js", 34),
        security: false,
      }),
    },
    "/api/products": {
      get: operation({
        tag: "Products",
        summary: "List products used by POS, manager, stock, and menu screens",
        flow: "Stock and Invoices",
        keywords: ["products", "menu", "stock", "banak"],
        code: code("backend/src/modules/products/product.routes.js", 10),
      }),
      post: operation({
        tag: "Products",
        summary: "Create product",
        flow: "Stock and Invoices",
        keywords: ["manager", "product", "create"],
        code: code("backend/src/modules/products/product.routes.js", 12),
      }),
    },
    "/api/products/{id}/stock": {
      patch: operation({
        tag: "Stock",
        summary: "Update product stock manually",
        flow: "Stock and Invoices",
        keywords: ["stock", "inventory", "manager"],
        code: code("backend/src/modules/products/product.routes.js", 14),
      }),
    },
    "/api/categories": {
      get: operation({
        tag: "Categories",
        summary: "List product categories",
        flow: "Stock and Invoices",
        keywords: ["categories", "menu"],
        code: code("backend/src/modules/categories/category.routes.js", 10),
      }),
      post: operation({
        tag: "Categories",
        summary: "Create category",
        flow: "Stock and Invoices",
        keywords: ["manager", "category"],
        code: code("backend/src/modules/categories/category.routes.js", 12),
      }),
    },
    "/api/orders": {
      post: operation({
        tag: "Orders",
        summary: "Create order from POS or guest ordering",
        flow: "POS to Dashboard",
        keywords: ["banak", "pos", "order", "dashboard", "sales"],
        code: code("backend/src/modules/orders/order.routes.js", 9),
      }),
      get: operation({
        tag: "Orders",
        summary: "List orders for manager dashboard",
        flow: "POS to Dashboard",
        keywords: ["dashboard", "orders", "banak", "sales"],
        code: code("backend/src/modules/orders/order.routes.js", 10),
      }),
    },
    "/api/orders/{id}": {
      get: operation({
        tag: "Orders",
        summary: "Get one order with its items",
        flow: "POS to Dashboard",
        keywords: ["order details", "invoice", "dashboard"],
        code: code("backend/src/modules/orders/order.routes.js", 22),
      }),
    },
    "/api/orders/{id}/receipt": {
      get: operation({
        tag: "Orders",
        summary: "Download invoice or receipt PDF",
        flow: "POS to Dashboard",
        keywords: ["invoice", "pdf", "receipt", "banak"],
        code: code("backend/src/modules/orders/order.routes.js", 23),
      }),
    },
    "/api/orders/{id}/status": {
      patch: operation({
        tag: "Orders",
        summary: "Update order status",
        flow: "POS to Dashboard",
        keywords: ["pending", "approved", "delivered", "order"],
        code: code("backend/src/modules/orders/order.routes.js", 45),
      }),
    },
    "/api/dashboard/stats": {
      get: operation({
        tag: "Dashboard",
        summary: "Dashboard totals and KPIs",
        flow: "POS to Dashboard",
        keywords: ["dashboard", "banak", "sales", "totals", "kpi"],
        code: code("backend/src/modules/dashboard/dashboard.routes.js", 11),
      }),
    },
    "/api/dashboard/orders": {
      get: operation({
        tag: "Dashboard",
        summary: "Dashboard orders by date range",
        flow: "POS to Dashboard",
        keywords: ["dashboard", "orders", "date", "banak"],
        code: code("backend/src/modules/dashboard/dashboard.routes.js", 14),
      }),
    },
    "/api/dashboard/invoices": {
      get: operation({
        tag: "Dashboard",
        summary: "Dashboard invoices by date range",
        flow: "POS to Dashboard",
        keywords: ["dashboard", "invoice", "sales", "receipt"],
        code: code("backend/src/modules/dashboard/dashboard.routes.js", 15),
      }),
    },
    "/api/dashboard/revenue-trend": {
      get: operation({
        tag: "Dashboard",
        summary: "Revenue trend for charts",
        flow: "POS to Dashboard",
        keywords: ["dashboard", "chart", "revenue", "sales"],
        code: code("backend/src/modules/dashboard/dashboard.routes.js", 17),
      }),
    },
    "/api/dashboard/advanced-report": {
      get: operation({
        tag: "Dashboard",
        summary: "Advanced daily, monthly, product, and employee analytics",
        flow: "POS to Dashboard",
        keywords: ["report", "analytics", "dashboard", "sales"],
        code: code("backend/src/modules/dashboard/dashboard.routes.js", 20),
      }),
    },
    "/api/dashboard/export/report.csv": {
      get: operation({
        tag: "Dashboard",
        summary: "Export analytics as Excel-friendly CSV",
        flow: "POS to Dashboard",
        keywords: ["report", "csv", "excel"],
        code: code("backend/src/modules/dashboard/dashboard.routes.js", 21),
      }),
    },
    "/api/dashboard/export/report.pdf": {
      get: operation({
        tag: "Dashboard",
        summary: "Export analytics report as PDF",
        flow: "POS to Dashboard",
        keywords: ["report", "pdf"],
        code: code("backend/src/modules/dashboard/dashboard.routes.js", 22),
      }),
    },
    "/api/suppliers": {
      get: operation({
        tag: "Suppliers",
        summary: "List suppliers",
        flow: "Stock and Invoices",
        keywords: ["supplier", "incoming invoice", "stock"],
        code: code("backend/src/modules/suppliers/supplier.routes.js", 12),
      }),
      post: operation({
        tag: "Suppliers",
        summary: "Create supplier",
        flow: "Stock and Invoices",
        keywords: ["supplier", "create"],
        code: code("backend/src/modules/suppliers/supplier.routes.js", 14),
      }),
    },
    "/api/supplier-orders": {
      get: operation({
        tag: "Stock",
        summary: "List incoming supplier invoices",
        flow: "Stock and Invoices",
        keywords: ["incoming invoice", "stock", "supplier", "history"],
        code: code("backend/src/modules/supplierOrders/supplier-order.routes.js", 12),
      }),
      post: operation({
        tag: "Stock",
        summary: "Create incoming invoice and increase stock when delivered",
        flow: "Stock and Invoices",
        keywords: ["save invoice", "incoming invoice", "stock", "kg", "liter", "cope"],
        code: code("backend/src/modules/supplierOrders/supplier-order.routes.js", 15),
      }),
    },
    "/api/supplier-orders/{id}/pdf": {
      get: operation({
        tag: "Stock",
        summary: "Download incoming supplier invoice PDF",
        flow: "Stock and Invoices",
        keywords: ["incoming invoice", "pdf", "supplier"],
        code: code("backend/src/modules/supplierOrders/supplier-order.routes.js", 13),
      }),
    },
    "/api/system/alerts": {
      get: operation({
        tag: "System",
        summary: "List open or resolved system alerts",
        flow: "Stock and Invoices",
        keywords: ["stock alert", "dashboard", "system"],
        code: code("backend/src/modules/system/system.routes.js", 29),
      }),
    },
    "/api/system/realtime": {
      get: operation({
        tag: "System",
        summary: "Server-Sent Events stream for live updates",
        flow: "POS to Dashboard",
        keywords: ["realtime", "dashboard", "orders", "banak"],
        code: code("backend/src/modules/system/system.routes.js", 27),
        security: false,
      }),
    },
    "/api/guest/tables/{tableId}/access": {
      get: operation({
        tag: "Guest Ordering",
        summary: "Create or fetch a QR guest ordering token for a table",
        flow: "Guest Ordering",
        keywords: ["qr", "guest", "table", "menu"],
        code: code("backend/src/modules/guest/guest.routes.js", 9),
      }),
    },
    "/api/guest/access/{token}/menu": {
      get: operation({
        tag: "Guest Ordering",
        summary: "Public menu payload for a table QR token",
        flow: "Guest Ordering",
        keywords: ["qr", "guest", "menu", "public"],
        code: code("backend/src/modules/guest/guest.routes.js", 21),
        security: false,
      }),
    },
    "/api/guest/access/{token}/order": {
      post: operation({
        tag: "Guest Ordering",
        summary: "Submit or append a guest order from a QR session",
        flow: "Guest Ordering",
        keywords: ["qr", "guest", "order"],
        code: code("backend/src/modules/guest/guest.routes.js", 22),
        security: false,
      }),
    },
    "/api/staff/waiters": {
      get: operation({
        tag: "Staff",
        summary: "List waiters",
        flow: "Staff and Tables",
        keywords: ["waiter", "staff", "manager"],
        code: code("backend/src/modules/staff/staff.routes.js", 12),
      }),
      post: operation({
        tag: "Staff",
        summary: "Create waiter",
        flow: "Staff and Tables",
        keywords: ["waiter", "staff"],
        code: code("backend/src/modules/staff/staff.routes.js", 13),
      }),
    },
    "/api/tables": {
      get: operation({
        tag: "Tables",
        summary: "List tables",
        flow: "Staff and Tables",
        keywords: ["tables", "banak", "waiter"],
        code: code("backend/src/modules/tables/table.routes.js", 11),
      }),
      post: operation({
        tag: "Tables",
        summary: "Create table",
        flow: "Staff and Tables",
        keywords: ["tables", "manager"],
        code: code("backend/src/modules/tables/table.routes.js", 13),
      }),
    },
    "/api/tables/{id}/assignment": {
      patch: operation({
        tag: "Tables",
        summary: "Assign one table to a waiter",
        flow: "Staff and Tables",
        keywords: ["table assignment", "waiter", "banak"],
        code: code("backend/src/modules/tables/table.routes.js", 15),
      }),
    },
  },
});

module.exports = {
  buildOpenApiSpec,
};
