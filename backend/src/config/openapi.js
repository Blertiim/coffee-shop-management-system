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
    { name: "Guest Ordering" },
    { name: "Orders" },
    { name: "Products" },
    { name: "Categories" },
    { name: "Inventory" },
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
      post: {
        tags: ["Auth"],
        summary: "Login with email and password",
      },
    },
    "/api/auth/pos-login": {
      post: {
        tags: ["Auth"],
        summary: "POS PIN login for waiter and manager accounts",
      },
    },
    "/api/auth/pos-staff": {
      get: {
        tags: ["Auth"],
        summary: "List active POS staff profiles",
      },
    },
    "/api/products": {
      get: {
        tags: ["Products"],
        summary: "List products",
        security: [{ bearerAuth: [] }],
      },
      post: {
        tags: ["Products"],
        summary: "Create product",
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/categories": {
      get: {
        tags: ["Categories"],
        summary: "List categories",
        security: [{ bearerAuth: [] }],
      },
      post: {
        tags: ["Categories"],
        summary: "Create category",
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/orders": {
      post: {
        tags: ["Orders"],
        summary: "Create order",
        security: [{ bearerAuth: [] }],
      },
      get: {
        tags: ["Orders"],
        summary: "List orders",
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/orders/{id}/receipt": {
      get: {
        tags: ["Orders"],
        summary: "Download invoice or receipt PDF",
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/dashboard/stats": {
      get: {
        tags: ["Dashboard"],
        summary: "Dashboard totals and KPIs",
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/dashboard/advanced-report": {
      get: {
        tags: ["Dashboard"],
        summary: "Advanced daily, monthly, product, and employee analytics",
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/dashboard/export/report.csv": {
      get: {
        tags: ["Dashboard"],
        summary: "Export analytics as Excel-friendly CSV",
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/dashboard/export/report.pdf": {
      get: {
        tags: ["Dashboard"],
        summary: "Export analytics report as PDF",
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/system/alerts": {
      get: {
        tags: ["System"],
        summary: "List open or resolved system alerts",
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/system/audit-logs": {
      get: {
        tags: ["System"],
        summary: "Read the audit trail",
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/system/realtime": {
      get: {
        tags: ["System"],
        summary: "Server-Sent Events stream for live updates",
      },
    },
    "/api/system/backup/snapshot": {
      get: {
        tags: ["System"],
        summary: "Download a full JSON system snapshot",
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/guest/tables/{tableId}/access": {
      get: {
        tags: ["Guest Ordering"],
        summary: "Create or fetch a QR guest ordering token for a table",
        security: [{ bearerAuth: [] }],
      },
    },
    "/api/guest/access/{token}/menu": {
      get: {
        tags: ["Guest Ordering"],
        summary: "Public menu payload for a table QR token",
      },
    },
    "/api/guest/access/{token}/order": {
      post: {
        tags: ["Guest Ordering"],
        summary: "Submit or append a guest order from a QR session",
      },
    },
  },
});

module.exports = {
  buildOpenApiSpec,
};
