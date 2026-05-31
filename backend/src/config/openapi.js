const jsonBody = (schema, example, required = true) => ({
  required,
  content: {
    "application/json": {
      schema,
      ...(example ? { example } : {}),
    },
  },
});

const pathParam = (name, schema, description) => ({
  name,
  in: "path",
  required: true,
  schema,
  description,
});

const queryParam = (name, schema, description) => ({
  name,
  in: "query",
  required: false,
  schema,
  description,
});

const idParam = (name = "id", description = "Numeric resource id") =>
  pathParam(name, { type: "integer", minimum: 1 }, description);

const tokenParam = () =>
  pathParam("token", { type: "string" }, "Guest QR access token");

const dateQueryParams = [
  queryParam("from", { type: "string", format: "date", example: "2026-05-31" }, "Start date"),
  queryParam("to", { type: "string", format: "date", example: "2026-05-31" }, "End date"),
];

const operation = ({
  tag,
  summary,
  flow,
  keywords = [],
  code,
  security = true,
  parameters = [],
  requestBody,
  responses,
}) => ({
  tags: [tag],
  summary,
  ...(parameters.length ? { parameters } : {}),
  ...(requestBody ? { requestBody } : {}),
  responses: responses || {
    200: { description: "Successful response" },
    ...(security ? { 401: { description: "Missing or invalid JWT token" } } : {}),
    500: { description: "Server error" },
  },
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
    schemas: {
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "meti.manager@pos.local" },
          password: { type: "string", example: "1111" },
        },
      },
      PosLoginRequest: {
        type: "object",
        required: ["userId", "pin"],
        properties: {
          userId: { type: "integer", minimum: 1, example: 15 },
          pin: { type: "string", minLength: 4, maxLength: 4, example: "1234" },
        },
      },
      OrderItemInput: {
        type: "object",
        required: ["productId", "quantity"],
        properties: {
          productId: { type: "integer", minimum: 1, example: 1 },
          quantity: { type: "integer", minimum: 1, example: 2 },
        },
      },
      CreateOrderRequest: {
        type: "object",
        required: ["tableId", "items"],
        properties: {
          tableId: { type: "integer", minimum: 1, example: 1 },
          employeeId: { type: "integer", minimum: 1, nullable: true, example: 1 },
          paymentMethod: { type: "string", enum: ["cash", "card"], nullable: true, example: "cash" },
          discountType: { type: "string", enum: ["percent", "fixed"], nullable: true, example: "percent" },
          discountValue: { type: "number", minimum: 0, nullable: true, example: 10 },
          items: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/components/schemas/OrderItemInput" },
          },
        },
      },
      AppendOrderItemsRequest: {
        type: "object",
        required: ["items"],
        properties: {
          items: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/components/schemas/OrderItemInput" },
          },
        },
      },
      OrderStatusRequest: {
        type: "object",
        required: ["status"],
        properties: {
          status: {
            type: "string",
            enum: ["pending", "preparing", "served", "pending_payment", "paid", "cancelled"],
            example: "preparing",
          },
        },
      },
      CompletePaymentRequest: {
        type: "object",
        properties: {
          paymentMethod: { type: "string", enum: ["cash", "card"], example: "card" },
        },
      },
      TransferOrderRequest: {
        type: "object",
        required: ["tableId"],
        properties: {
          tableId: { type: "integer", minimum: 1, example: 2 },
        },
      },
      DiscountRequest: {
        type: "object",
        properties: {
          discountType: { type: "string", enum: ["percent", "fixed"], nullable: true, example: "fixed" },
          discountValue: { type: "number", minimum: 0, nullable: true, example: 2.5 },
        },
      },
      ProductRequest: {
        type: "object",
        required: ["name", "price", "categoryId"],
        properties: {
          name: { type: "string", example: "Espresso" },
          description: { type: "string", nullable: true, example: "Short coffee" },
          price: { type: "number", minimum: 0, example: 1.5 },
          stock: { type: "integer", minimum: 0, example: 50 },
          stockUnit: { type: "string", enum: ["cope", "shishe", "litra", "kg"], example: "cope" },
          unitsPerPackage: { type: "integer", minimum: 1, nullable: true, example: 12 },
          imageUrl: { type: "string", nullable: true, example: "" },
          categoryId: { type: "integer", minimum: 1, example: 1 },
          directStockIngredientId: { type: "integer", minimum: 1, nullable: true, example: null },
          isAvailable: { type: "boolean", example: true },
        },
      },
      ProductStockRequest: {
        type: "object",
        description: "Send either stock for absolute value or delta for increase/decrease.",
        properties: {
          stock: { type: "integer", minimum: 0, example: 40 },
          delta: { type: "integer", example: 5 },
        },
      },
      CategoryRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", example: "Coffee" },
        },
      },
      SupplierRequest: {
        type: "object",
        required: ["companyName", "contactName", "phone"],
        properties: {
          companyName: { type: "string", example: "Cafe Supplier LLC" },
          contactName: { type: "string", example: "Arben Supplier" },
          phone: { type: "string", example: "+38344123456" },
          email: { type: "string", format: "email", nullable: true, example: "supplier@example.com" },
          address: { type: "string", nullable: true, example: "Prishtine" },
          productType: { type: "string", nullable: true, example: "Coffee and drinks" },
        },
      },
      SupplierOrderRequest: {
        type: "object",
        required: ["supplierId", "items"],
        properties: {
          supplierId: { type: "integer", minimum: 1, example: 1 },
          employeeId: { type: "integer", minimum: 1, nullable: true, example: 1 },
          invoiceNumber: { type: "string", nullable: true, example: "INV-001" },
          orderDate: { type: "string", format: "date-time", example: "2026-05-31T10:00:00.000Z" },
          expectedDate: { type: "string", format: "date-time", nullable: true, example: "2026-06-02T10:00:00.000Z" },
          status: { type: "string", enum: ["pending", "approved", "delivered", "cancelled"], example: "delivered" },
          notes: { type: "string", nullable: true, example: "Morning stock delivery" },
          items: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["productId", "quantity", "unitPrice"],
              properties: {
                productId: { type: "integer", minimum: 1, example: 1 },
                quantity: { type: "integer", minimum: 1, example: 10 },
                unitPrice: { type: "number", minimum: 0, example: 2.5 },
                unit: { type: "string", nullable: true, example: "paketa" },
                stockUnitsPerPurchaseUnit: { type: "integer", minimum: 1, example: 12 },
                stockQuantity: { type: "integer", minimum: 1, example: 120 },
              },
            },
          },
        },
      },
      GuestOrderRequest: {
        type: "object",
        required: ["items"],
        properties: {
          items: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/components/schemas/OrderItemInput" },
          },
        },
      },
      WaiterRequest: {
        type: "object",
        required: ["fullName", "pin"],
        properties: {
          fullName: { type: "string", example: "Mili Waiter" },
          pin: { type: "string", minLength: 4, maxLength: 4, example: "1234" },
        },
      },
      TableRequest: {
        type: "object",
        required: ["number", "capacity", "location"],
        properties: {
          number: { type: "integer", minimum: 1, example: 1 },
          capacity: { type: "integer", minimum: 1, example: 4 },
          location: { type: "string", example: "Main Hall" },
          assignedWaiterId: { type: "integer", minimum: 1, nullable: true, example: null },
          status: {
            type: "string",
            enum: ["available", "occupied", "reserved", "pending_payment", "paid"],
            example: "available",
          },
        },
      },
      AssignTableRequest: {
        type: "object",
        properties: {
          waiterId: { type: "integer", minimum: 1, nullable: true, example: 15 },
        },
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
        requestBody: jsonBody({ $ref: "#/components/schemas/LoginRequest" }, {
          email: "meti.manager@pos.local",
          password: "1111",
        }),
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
        requestBody: jsonBody({ $ref: "#/components/schemas/PosLoginRequest" }, {
          userId: 15,
          pin: "1234",
        }),
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
        requestBody: jsonBody({ $ref: "#/components/schemas/ProductRequest" }, {
          name: "Espresso",
          description: "Short coffee",
          price: 1.5,
          stock: 50,
          stockUnit: "cope",
          unitsPerPackage: null,
          imageUrl: "",
          categoryId: 1,
          directStockIngredientId: null,
          isAvailable: true,
        }),
      }),
    },
    "/api/products/{id}/stock": {
      patch: operation({
        tag: "Stock",
        summary: "Update product stock manually",
        flow: "Stock and Invoices",
        keywords: ["stock", "inventory", "manager"],
        code: code("backend/src/modules/products/product.routes.js", 14),
        parameters: [idParam("id", "Product id")],
        requestBody: jsonBody({ $ref: "#/components/schemas/ProductStockRequest" }, {
          stock: 40,
        }),
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
        requestBody: jsonBody({ $ref: "#/components/schemas/CategoryRequest" }, {
          name: "Coffee",
        }),
      }),
    },
    "/api/orders": {
      post: operation({
        tag: "Orders",
        summary: "Create order from POS or guest ordering",
        flow: "POS to Dashboard",
        keywords: ["banak", "pos", "order", "dashboard", "sales"],
        code: code("backend/src/modules/orders/order.routes.js", 9),
        requestBody: jsonBody({ $ref: "#/components/schemas/CreateOrderRequest" }, {
          tableId: 1,
          employeeId: null,
          paymentMethod: "cash",
          discountType: null,
          discountValue: null,
          items: [{ productId: 1, quantity: 2 }],
        }),
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
        parameters: [idParam("id", "Order id")],
      }),
    },
    "/api/orders/{id}/receipt": {
      get: operation({
        tag: "Orders",
        summary: "Download invoice or receipt PDF",
        flow: "POS to Dashboard",
        keywords: ["invoice", "pdf", "receipt", "banak"],
        code: code("backend/src/modules/orders/order.routes.js", 23),
        parameters: [idParam("id", "Order id")],
      }),
    },
    "/api/orders/{id}/items": {
      post: operation({
        tag: "Orders",
        summary: "Append items to an active order",
        flow: "POS to Dashboard",
        keywords: ["banak", "pos", "order", "items"],
        code: code("backend/src/modules/orders/order.routes.js", 24),
        parameters: [idParam("id", "Order id")],
        requestBody: jsonBody({ $ref: "#/components/schemas/AppendOrderItemsRequest" }, {
          items: [{ productId: 1, quantity: 1 }],
        }),
      }),
    },
    "/api/orders/{id}/generate-invoice": {
      patch: operation({
        tag: "Orders",
        summary: "Move order to pending payment",
        flow: "POS to Dashboard",
        keywords: ["invoice", "payment", "banak"],
        code: code("backend/src/modules/orders/order.routes.js", 25),
        parameters: [idParam("id", "Order id")],
      }),
    },
    "/api/orders/{id}/transfer-table": {
      patch: operation({
        tag: "Orders",
        summary: "Transfer an active order to another table",
        flow: "POS to Dashboard",
        keywords: ["transfer", "table", "banak"],
        code: code("backend/src/modules/orders/order.routes.js", 30),
        parameters: [idParam("id", "Order id")],
        requestBody: jsonBody({ $ref: "#/components/schemas/TransferOrderRequest" }, {
          tableId: 2,
        }),
      }),
    },
    "/api/orders/{id}/discount": {
      patch: operation({
        tag: "Orders",
        summary: "Apply or clear a discount on an active order",
        flow: "POS to Dashboard",
        keywords: ["discount", "coupon", "banak"],
        code: code("backend/src/modules/orders/order.routes.js", 35),
        parameters: [idParam("id", "Order id")],
        requestBody: jsonBody({ $ref: "#/components/schemas/DiscountRequest" }, {
          discountType: "fixed",
          discountValue: 2.5,
        }),
      }),
    },
    "/api/orders/{id}/complete-payment": {
      patch: operation({
        tag: "Orders",
        summary: "Complete payment and free the table",
        flow: "POS to Dashboard",
        keywords: ["payment", "paid", "banak"],
        code: code("backend/src/modules/orders/order.routes.js", 40),
        parameters: [idParam("id", "Order id")],
        requestBody: jsonBody({ $ref: "#/components/schemas/CompletePaymentRequest" }, {
          paymentMethod: "card",
        }, false),
      }),
    },
    "/api/orders/{id}/status": {
      patch: operation({
        tag: "Orders",
        summary: "Update order status",
        flow: "POS to Dashboard",
        keywords: ["pending", "approved", "delivered", "order"],
        code: code("backend/src/modules/orders/order.routes.js", 45),
        parameters: [idParam("id", "Order id")],
        requestBody: jsonBody({ $ref: "#/components/schemas/OrderStatusRequest" }, {
          status: "preparing",
        }),
      }),
    },
    "/api/dashboard/stats": {
      get: operation({
        tag: "Dashboard",
        summary: "Dashboard totals and KPIs",
        flow: "POS to Dashboard",
        keywords: ["dashboard", "banak", "sales", "totals", "kpi"],
        code: code("backend/src/modules/dashboard/dashboard.routes.js", 11),
        parameters: dateQueryParams,
      }),
    },
    "/api/dashboard/orders": {
      get: operation({
        tag: "Dashboard",
        summary: "Dashboard orders by date range",
        flow: "POS to Dashboard",
        keywords: ["dashboard", "orders", "date", "banak"],
        code: code("backend/src/modules/dashboard/dashboard.routes.js", 14),
        parameters: [
          ...dateQueryParams,
          queryParam("limit", { type: "integer", minimum: 1, maximum: 200, example: 120 }, "Maximum rows"),
        ],
      }),
    },
    "/api/dashboard/invoices": {
      get: operation({
        tag: "Dashboard",
        summary: "Dashboard invoices by date range",
        flow: "POS to Dashboard",
        keywords: ["dashboard", "invoice", "sales", "receipt"],
        code: code("backend/src/modules/dashboard/dashboard.routes.js", 15),
        parameters: [
          ...dateQueryParams,
          queryParam("limit", { type: "integer", minimum: 1, maximum: 200, example: 120 }, "Maximum rows"),
        ],
      }),
    },
    "/api/dashboard/revenue-trend": {
      get: operation({
        tag: "Dashboard",
        summary: "Revenue trend for charts",
        flow: "POS to Dashboard",
        keywords: ["dashboard", "chart", "revenue", "sales"],
        code: code("backend/src/modules/dashboard/dashboard.routes.js", 17),
        parameters: dateQueryParams,
      }),
    },
    "/api/dashboard/advanced-report": {
      get: operation({
        tag: "Dashboard",
        summary: "Advanced daily, monthly, product, and employee analytics",
        flow: "POS to Dashboard",
        keywords: ["report", "analytics", "dashboard", "sales"],
        code: code("backend/src/modules/dashboard/dashboard.routes.js", 20),
        parameters: dateQueryParams,
      }),
    },
    "/api/dashboard/export/report.csv": {
      get: operation({
        tag: "Dashboard",
        summary: "Export analytics as Excel-friendly CSV",
        flow: "POS to Dashboard",
        keywords: ["report", "csv", "excel"],
        code: code("backend/src/modules/dashboard/dashboard.routes.js", 21),
        parameters: dateQueryParams,
      }),
    },
    "/api/dashboard/export/report.pdf": {
      get: operation({
        tag: "Dashboard",
        summary: "Export analytics report as PDF",
        flow: "POS to Dashboard",
        keywords: ["report", "pdf"],
        code: code("backend/src/modules/dashboard/dashboard.routes.js", 22),
        parameters: dateQueryParams,
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
        requestBody: jsonBody({ $ref: "#/components/schemas/SupplierRequest" }, {
          companyName: "Cafe Supplier LLC",
          contactName: "Arben Supplier",
          phone: "+38344123456",
          email: "supplier@example.com",
          address: "Prishtine",
          productType: "Coffee and drinks",
        }),
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
        summary: "Create incoming invoice and apply package-to-stock conversion when delivered",
        flow: "Stock and Invoices",
        keywords: ["save invoice", "incoming invoice", "stock", "package", "kg", "liter", "cope"],
        code: code("backend/src/modules/supplierOrders/supplier-order.routes.js", 15),
        requestBody: jsonBody({ $ref: "#/components/schemas/SupplierOrderRequest" }, {
          supplierId: 1,
          employeeId: null,
          invoiceNumber: "INV-001",
          status: "delivered",
          items: [
            {
              productId: 1,
              quantity: 10,
              unitPrice: 2.5,
              unit: "paketa",
              stockUnitsPerPurchaseUnit: 12,
            },
          ],
        }),
      }),
    },
    "/api/supplier-orders/{id}/pdf": {
      get: operation({
        tag: "Stock",
        summary: "Download incoming supplier invoice PDF",
        flow: "Stock and Invoices",
        keywords: ["incoming invoice", "pdf", "supplier"],
        code: code("backend/src/modules/supplierOrders/supplier-order.routes.js", 13),
        parameters: [idParam("id", "Supplier order id")],
      }),
    },
    "/api/system/alerts": {
      get: operation({
        tag: "System",
        summary: "List open or resolved system alerts",
        flow: "Stock and Invoices",
        keywords: ["stock alert", "dashboard", "system"],
        code: code("backend/src/modules/system/system.routes.js", 29),
        parameters: [
          queryParam("status", { type: "string", enum: ["open", "resolved"], example: "open" }, "Alert status"),
          queryParam("limit", { type: "integer", minimum: 1, maximum: 200, example: 40 }, "Maximum rows"),
        ],
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
        parameters: [
          queryParam("token", { type: "string" }, "JWT token used for the realtime stream"),
          queryParam("channels", { type: "string", example: "orders,tables,dashboard" }, "Comma-separated realtime channels"),
        ],
      }),
    },
    "/api/guest/tables/{tableId}/access": {
      get: operation({
        tag: "Guest Ordering",
        summary: "Create or fetch a QR guest ordering token for a table",
        flow: "Guest Ordering",
        keywords: ["qr", "guest", "table", "menu"],
        code: code("backend/src/modules/guest/guest.routes.js", 9),
        parameters: [idParam("tableId", "Table id")],
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
        parameters: [tokenParam()],
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
        parameters: [tokenParam()],
        requestBody: jsonBody({ $ref: "#/components/schemas/GuestOrderRequest" }, {
          items: [{ productId: 1, quantity: 2 }],
        }),
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
        requestBody: jsonBody({ $ref: "#/components/schemas/WaiterRequest" }, {
          fullName: "Mili Waiter",
          pin: "1234",
        }),
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
        requestBody: jsonBody({ $ref: "#/components/schemas/TableRequest" }, {
          number: 1,
          capacity: 4,
          location: "Main Hall",
          assignedWaiterId: null,
          status: "available",
        }),
      }),
    },
    "/api/tables/{id}/assignment": {
      patch: operation({
        tag: "Tables",
        summary: "Assign one table to a waiter",
        flow: "Staff and Tables",
        keywords: ["table assignment", "waiter", "banak"],
        code: code("backend/src/modules/tables/table.routes.js", 15),
        parameters: [idParam("id", "Table id")],
        requestBody: jsonBody({ $ref: "#/components/schemas/AssignTableRequest" }, {
          waiterId: 15,
        }),
      }),
    },
  },
});

module.exports = {
  buildOpenApiSpec,
};
