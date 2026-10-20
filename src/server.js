
import "dotenv/config";

import app from "./app.js";
import prisma, { testDatabase } from "./config/database.js";
import { startMonthlyOrderCleanupJob } from "./jobs/monthlyOrderCleanupJob.js";

const PORT = Number(process.env.PORT || 5000);

// Start listening immediately for Hostinger
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server listening on port ${PORT}`);
  console.log("❤️ Health endpoint: /api/health");
});

server.on("error", (error) => {
  console.error("❌ Server Error:", error);
});

// Connect and test database
async function initializeDatabase() {
  try {
    await prisma.$connect();
    console.log("✅ MySQL Database Connected");

    // Diagnostic tests
    await testDatabase();

    // Start monthly cleanup only after DB is ready
    startMonthlyOrderCleanupJob();
    console.log("🧹 Monthly order cleanup job initialized");
  } catch (error) {
    console.error("❌ DATABASE INITIALIZATION FAILED:", error);
  }
}

initializeDatabase();

// Graceful shutdown
let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`⚠️ ${signal} received. Shutting down...`);

  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log("✅ MySQL disconnected");
      process.exit(0);
    } catch (error) {
      console.error("❌ Database disconnect failed:", error);
      process.exit(1);
    }
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
