
import prisma from "../config/database.js";

// GET /api/dashboard/summary
export const getDashboardSummary = async (req, res) => {
  try {
    const [
      total,
      draft,
      newOrders,
      assigned,
      inProgress,
      completed,
      finalConfirmed,
      delivered,
      cleanup,
      onHold,
      cancelled,
    ] = await Promise.all([
      prisma.order.count(),

      prisma.order.count({
        where: { status: "DRAFT" },
      }),

      prisma.order.count({
        where: { status: "NEW" },
      }),

      prisma.order.count({
        where: { status: "ASSIGNED" },
      }),

      prisma.order.count({
        where: { status: "IN_PROGRESS" },
      }),

      prisma.order.count({
        where: { status: "COMPLETED" },
      }),

      prisma.order.count({
        where: { status: "FINAL_CONFIRMED" },
      }),

      prisma.order.count({
        where: { status: "DELIVERED" },
      }),

      prisma.order.count({
        where: { status: "CLEANUP" },
      }),

      prisma.order.count({
        where: { status: "ON_HOLD" },
      }),

      prisma.order.count({
        where: { status: "CANCELLED" },
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Dashboard summary fetched successfully",
      data: {
        total,
        draft,
        new: newOrders,
        assigned,
        inProgress,
        completed,
        finalConfirmed,
        delivered,
        cleanup,
        onHold,
        cancelled,
      },
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard summary",
    });
  }
};
