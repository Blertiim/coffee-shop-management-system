const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./modules/auth/auth.routes");
const categoryRoutes = require("./modules/categories/category.routes");
const dashboardRoutes = require("./modules/dashboard/dashboard.routes");
const employeeRoutes = require("./modules/employees/employee.routes");
const expenseRoutes = require("./modules/expenses/expense.routes");
const inventoryRoutes = require("./modules/inventory/inventory.routes");
const orderRoutes = require("./modules/orders/order.routes");
const productRoutes = require("./modules/products/product.routes");
const reservationRoutes = require("./modules/reservations/reservation.routes");
const shiftRoutes = require("./modules/shifts/shift.routes");
const staffRoutes = require("./modules/staff/staff.routes");
const supplierOrderRoutes = require("./modules/supplierOrders/supplier-order.routes");
const supplierRoutes = require("./modules/suppliers/supplier.routes");
const systemRoutes = require("./modules/system/system.routes");
const tableRoutes = require("./modules/tables/table.routes");
const guestRoutes = require("./modules/guest/guest.routes");
const authMiddleware = require("./middlewares/auth.middleware");
const requestActivityMiddleware = require("./middlewares/request-activity.middleware");
const {
  globalErrorHandler,
  notFoundHandler,
} = require("./middlewares/error.middleware");
const { sendSuccess } = require("./utils/response");
const { buildCorsOriginChecker } = require("./config/security");

const app = express();
const corsOriginChecker = buildCorsOriginChecker();

app.use(
  cors({
    origin: (origin, callback) => {
      if (corsOriginChecker.isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(requestActivityMiddleware);

app.get("/", (req, res) => {
  return sendSuccess(res, 200, "API is running", null);
});

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/guest", guestRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api", orderRoutes);
app.use("/api/products", productRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/shifts", shiftRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/supplier-orders", supplierOrderRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/tables", tableRoutes);

app.get("/api/test", authMiddleware, (req, res) => {
  return sendSuccess(res, 200, "Protected route works", {
    user: req.user,
  });
});

app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
