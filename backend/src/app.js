const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./modules/auth/auth.routes");
const authMiddleware = require("./middlewares/auth.middleware");

const app = express();

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "API is running" });
});

app.use("/api/auth", authRoutes);

app.get("/api/test", authMiddleware, (req, res) => {
  res.json({
    message: "Protected route works",
    user: req.user,
  });
});

module.exports = app;