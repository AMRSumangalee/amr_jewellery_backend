
import prisma from "../config/database.js";

import {
  sendFinalConfirmedToCustomer,
} from "../services/customerWhatsAppService.js";

// ============================================================
// ALLOWED STATUS TRANSITIONS
// ============================================================

const ALLOWED_TRANSITIONS = {
  DRAFT: ["NEW", "CANCELLED"],
  NEW: ["ASSIGNED", "ON_HOLD", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "ON_HOLD", "CANCELLED"],
  COMPLETED: ["FINAL_CONFIRMED", "IN_PROGRESS", "ON_HOLD"],
  FINAL_CONFIRMED: ["DELIVERED"],
  ON_HOLD: ["NEW", "ASSIGNED", "IN_PROGRESS", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

const VALID_STATUSES = Object.keys(ALLOWED_TRANSITIONS);

// ============================================================
// HELPER: GET LOGGED-IN USER ID
// ============================================================

const getLoggedInUserId = (req) => {
  const id = Number(req.user?.id);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

// ============================================================
// UPDATE ORDER STATUS + HISTORY + CUSTOMER WHATSAPP
// ============================================================

export const updateOrderStatusController = async (
  req,
  res,
  next,
) => {
  try {
    const orderId = Number(req.params.id);

    const status =
      typeof req.body?.status === "string"
        ? req.body.status.trim().toUpperCase()
        : "";

    const remarks =
      typeof req.body?.remarks === "string"
        ? req.body.remarks.trim() || null
        : null;

    // --------------------------------------------------------
    // VALIDATE ORDER ID
    // --------------------------------------------------------

    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    // --------------------------------------------------------
    // VALIDATE STATUS
    // --------------------------------------------------------

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
        validStatuses: VALID_STATUSES,
      });
    }

    // --------------------------------------------------------
    // FETCH EXISTING ORDER
    // --------------------------------------------------------

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        orderType: true,
        status: true,
      },
    });

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const currentStatus = existingOrder.status;

    // --------------------------------------------------------
    // NO CHANGE REQUIRED
    // Do not send duplicate notification for the same status.
    // --------------------------------------------------------

    if (currentStatus === status) {
      return res.status(200).json({
        success: true,
        message: "Order already has this status",
        data: existingOrder,
        notification: {
          sent: false,
          skipped: true,
          reason: "Status has not changed",
        },
      });
    }

    // --------------------------------------------------------
    // VALIDATE STATUS TRANSITION
    // --------------------------------------------------------

    const allowedNextStatuses =
      ALLOWED_TRANSITIONS[currentStatus] ?? [];

    if (!allowedNextStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          `Cannot change status from ${currentStatus} to ${status}`,
        currentStatus,
        allowedNextStatuses,
      });
    }

    const changedById = getLoggedInUserId(req);

    // --------------------------------------------------------
    // UPDATE STATUS + HISTORY ATOMICALLY
    // --------------------------------------------------------

    const updatedOrder = await prisma.$transaction(
      async (tx) => {
        const updated = await tx.order.update({
          where: { id: orderId },
          data: { status },
          select: {
            id: true,
            orderNumber: true,
            orderType: true,
            status: true,
            updatedAt: true,
          },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId,
            fromStatus: currentStatus,
            toStatus: status,
            changedById,
            remarks,
          },
        });

        return updated;
      },
    );

    // --------------------------------------------------------
    // CUSTOMER WHATSAPP NOTIFICATION
    // Trigger only when status changes TO FINAL_CONFIRMED.
    // Send only after the database transaction succeeds.
    // --------------------------------------------------------

    let notification = {
      sent: false,
      skipped: true,
      reason: "Status is not FINAL_CONFIRMED",
    };

    if (
      status === "FINAL_CONFIRMED" &&
      currentStatus !== "FINAL_CONFIRMED"
    ) {
      try {
        // Fetch complete customer notification details.
        const orderForNotification =
          await prisma.order.findUnique({
            where: { id: orderId },
            include: {
              branch: true,
            },
          });

        if (!orderForNotification) {
          throw new Error(
            "Updated order could not be found for notification",
          );
        }

        const result =
          await sendFinalConfirmedToCustomer(
            orderForNotification,
          );

        if (result?.skipped) {
          notification = {
            sent: false,
            skipped: true,
            reason:
              result.reason ||
              "Customer notification was skipped",
          };
        } else {
          notification = {
            sent: true,
            skipped: false,
            providerMessage:
              result?.message || null,
            metaMessageId:
              result?.meta_message_id || null,
          };
        }

        console.log(
          "CUSTOMER FINAL_CONFIRMED NOTIFICATION RESULT:",
          {
            orderId,
            orderNumber: updatedOrder.orderNumber,
            sent: notification.sent,
          },
        );
      } catch (notificationError) {
        // The order update has already succeeded.
        // Do not rollback the status if WhatsApp fails.
        console.error(
          "CUSTOMER FINAL_CONFIRMED WHATSAPP FAILED:",
          {
            orderId,
            orderNumber: updatedOrder.orderNumber,
            error: notificationError.message,
          },
        );

        notification = {
          sent: false,
          skipped: false,
          error: notificationError.message,
        };
      }
    }

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: updatedOrder,
      notification,
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return next(error);
  }
};

// ============================================================
// GET ORDER STATUS HISTORY
// ============================================================

export const getOrderStatusHistoryController = async (
  req,
  res,
  next,
) => {
  try {
    const orderId = Number(req.params.id);

    // --------------------------------------------------------
    // VALIDATE ORDER ID
    // --------------------------------------------------------

    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    // --------------------------------------------------------
    // CHECK ORDER EXISTS
    // --------------------------------------------------------

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        orderType: true,
        status: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // --------------------------------------------------------
    // FETCH STATUS HISTORY
    // --------------------------------------------------------

    const history =
      await prisma.orderStatusHistory.findMany({
        where: { orderId },
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" },
        ],
        include: {
          changedBy: {
            select: {
              id: true,
              name: true,
              username: true,
              role: true,
            },
          },
        },
      });

    return res.status(200).json({
      success: true,
      message: "Order status history fetched successfully",
      data: {
        order,
        total: history.length,
        history,
      },
    });
  } catch (error) {
    return next(error);
  }
};
