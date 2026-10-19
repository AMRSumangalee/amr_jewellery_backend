import "dotenv/config";
import prisma from "./src/config/database.js";
import {
  cleanupPreviousMonthDeliveredOrders,
} from "./src/services/monthlyOrderCleanupService.js";

try {
  await prisma.$connect();

  const result = await cleanupPreviousMonthDeliveredOrders();

  console.log("TEST RESULT:", result);
} catch (error) {
  console.error("TEST FAILED:", error);
} finally {
  await prisma.$disconnect();
}