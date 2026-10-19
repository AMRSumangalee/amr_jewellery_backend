
import cron from "node-cron";

import {
  cleanupPreviousMonthDeliveredOrders,
} from "../services/monthlyOrderCleanupService.js";

export const startMonthlyOrderCleanupJob = () => {
  cron.schedule(
    "0 2 1 * *",
    async () => {
      console.log("Starting monthly delivered order cleanup...");

      try {
        await cleanupPreviousMonthDeliveredOrders();
      } catch (error) {
        console.error(
          "MONTHLY ORDER CLEANUP FAILED:",
          error,
        );
      }
    },
    {
      timezone: "Asia/Kolkata",
    },
  );

  console.log(
    "Monthly order cleanup scheduled: 1st day of every month at 2:00 AM IST",
  );
};
