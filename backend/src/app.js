const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./modules/auth/auth.routes");
const categoryRoutes = require("./modules/categories/category.routes");
const dashboardRoutes = require("./modules/dashboard/dashboard.routes");
const employeeRoutes = require("./modules/employees/employee.routes");
const orderRoutes = require("./modules/orders/order.routes");
const productRoutes = require("./modules/products/product.routes");
const reservationRoutes = require("./modules/reservations/reservation.routes");
const tableRoutes = require("./modules/tables/table.routes");
const authMiddleware = require("./middlewares/auth.middleware");
const { sendSuccess } = require("./utils/response");

const app = express();

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

app.get("/", (req, res) => {
  return sendSuccess(res, 200, "API is running", null);
});

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api", orderRoutes);
app.use("/api/products", productRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/tables", tableRoutes);

app.get("/api/test", authMiddleware, (req, res) => {
  return sendSuccess(res, 200, "Protected route works", {
    user: req.user,
  });
});

module.exports = app;
