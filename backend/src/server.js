const { startServer } = require("./startServer");

startServer().catch((error) => {
  console.error("Failed to start backend server:", error);
  process.exit(1);
});
