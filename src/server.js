
import "dotenv/config";

import app from "./app.js";
import prisma from "./config/database.js";
import { startMonthlyOrderCleanupJob } from "./jobs/monthlyOrderCleanupJob.js";

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // 1. Connect to MySQL database
    await prisma.$connect();

    console.log("=================================");
    console.log("✅ MySQL Database Connected");
    console.log("=================================");

    // 2. Start monthly delivered-order cleanup job
    startMonthlyOrderCleanupJob();

    // 3. Start Express server
    const server = app.listen(PORT, () => {
      console.log("=================================");
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(
        `❤️ Health Check: http://localhost:${PORT}/api/health`
      );
      console.log("🧹 Monthly order cleanup job initialized");
      console.log("=================================");
    });

    // 4. Handle server errors
    server.on("error", (error) => {
      console.error("❌ Server Error:", error.message);
    });

    // 5. Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\n⚠️ ${signal} received. Shutting down...`);

      server.close(async () => {
        try {
          await prisma.$disconnect();
          console.log("✅ MySQL disconnected successfully");
          process.exit(0);
        } catch (error) {
          console.error("❌ Database disconnect failed:", error);
          process.exit(1);
        }
      });
    };

    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error("=================================");
    console.error("❌ Server Startup Failed");
    console.error("=================================");
    console.error(error);

    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("❌ Database disconnect failed:", disconnectError);
    }

    process.exit(1);
  }
}

startServer();
