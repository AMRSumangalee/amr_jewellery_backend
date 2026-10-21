import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  cleanupUploadedFiles,
} from "../services/orderService.js";

import {
  sendNewOrderToMaker,
  sendRepairOrderToMaker,
  sendOrderImageToMaker,
  sendOrderVideoToMaker,
} from "../services/makerWhatsAppService.js";

import {
  sendCustomerOrderConfirmationTemplate,
} from "../services/smsmojoService.js";

// ============================================================
// HELPERS
// ============================================================

const normalizeBody = (body = {}) => {
  const data = {};

  for (const [key, value] of Object.entries(body)) {
    data[key] =
      typeof value === "string" ? value.trim() : value;
  }

  const raw = data.repairTypeIds ?? data["repairTypeIds[]"];

  delete data["repairTypeIds[]"];

  if (raw === undefined) {
    return data;
  }

  let ids = raw;

  if (typeof ids === "string") {
    const text = ids.trim();

    if (text.startsWith("[")) {
      try {
        ids = JSON.parse(text);
      } catch {
        throw new Error("Invalid repair type IDs");
      }
    } else {
      ids = text ? text.split(",") : [];
    }
  }

  if (!Array.isArray(ids)) {
    ids = [ids];
  }

  data.repairTypeIds = ids
    .map((item) => String(item).trim())
    .filter((item) => item !== "")
    .map((item) => {
      const num = Number(item);

      if (!Number.isInteger(num) || num <= 0) {
        throw new Error("Invalid repair type IDs");
      }

      return num;
    });

  return data;
};

const parseOrderId = (value) => {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
};

// ============================================================
// CREATE ORDER
// WhatsApp is NOT sent automatically.
// ============================================================

export const createOrderController = async (req, res, next) => {
  try {
    console.log("CREATE ORDER BODY =>", req.body);
    console.log(
      "CREATE ORDER FILE COUNT =>",
      (req.files || []).length
    );

    const order = await createOrder(
      normalizeBody(req.body),
      req.files || []
    );

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: order,
    });
  } catch (error) {
    await cleanupUploadedFiles(req.files || []);
    return next(error);
  }
};

// ============================================================
// SHARE ORDER DETAILS VIA WHATSAPP
// POST /api/orders/:id/share-whatsapp
//
// 1. Send order to maker.
// 2. Send confirmation to customer.
// ============================================================

export const shareOrderWhatsAppController = async (
  req,
  res,
  next
) => {
  try {
    const orderId = parseOrderId(req.params.id);

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await getOrderById(orderId);

    if (!["NEW", "REPAIR"].includes(order.orderType)) {
      return res.status(400).json({
        success: false,
        message: "Unsupported order type for WhatsApp sharing",
      });
    }

    if (!order.makerId || !order.maker) {
      return res.status(400).json({
        success: false,
        message: "Please assign a maker before sharing this order",
      });
    }

    console.log("MANUAL WHATSAPP SHARE REQUEST =>", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      makerId: order.makerId,
    });

    // STEP 1: Send order details to maker
    const result =
      order.orderType === "NEW"
        ? await sendNewOrderToMaker(order)
        : await sendRepairOrderToMaker(order);

    if (result?.skipped) {
      return res.status(400).json({
        success: false,
        message:
          result.reason || "WhatsApp sharing was skipped",
      });
    }

    console.log("MAKER WHATSAPP SHARE ACCEPTED =>", {
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      metaMessageId: result?.meta_message_id || null,
    });

    // STEP 2: Send order confirmation to customer
    let customerNotification = {
      sent: false,
      message: "Customer notification was not sent",
      metaMessageId: null,
    };

    try {
      const customerResult =
        await sendCustomerOrderConfirmationTemplate({
          to: order.customerPhone,
          customerName: order.customerName,
          orderNumber: order.orderNumber,
          category: order.category?.name,
          metal: order.metal?.name,
          purity: order.purity,
          weight: order.weight,
          length: order.length,
          lengthUnit: order.lengthUnit,
          size: order.size,
          description:
            order.orderType === "REPAIR"
              ? order.problemDescription ||
                order.existingJewelleryDescription ||
                order.receivedItemDescription ||
                "Repair order received"
              : order.description ||
                "Thank you for choosing us!",
        });

      customerNotification = {
        sent: true,
        message:
          customerResult?.message ||
          "Customer confirmation accepted by SMSMOJO",
        metaMessageId:
          customerResult?.meta_message_id || null,
      };

      console.log("CUSTOMER WHATSAPP ACCEPTED =>", {
        orderNumber: order.orderNumber,
        metaMessageId:
          customerResult?.meta_message_id || null,
      });
    } catch (customerError) {
      // Customer notification failure should not undo
      // the successful maker message.
      console.error(
        "CUSTOMER WHATSAPP NOTIFICATION FAILED:",
        customerError.message
      );

      if (customerError.providerResponse) {
        console.error(
          "CUSTOMER SMSMOJO PROVIDER RESPONSE =>",
          customerError.providerResponse
        );
      }

      customerNotification = {
        sent: false,
        message: customerError.message,
        metaMessageId: null,
      };
    }

    // STEP 3: Return API response
    return res.status(200).json({
      success: true,
      message:
        order.orderType === "REPAIR"
          ? "Repair order shared with maker"
          : "New order shared with maker",
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderType: order.orderType,

        makerNotification: {
          sent: true,
          message:
            result?.message ||
            "Maker message accepted by SMSMOJO",
          metaMessageId:
            result?.meta_message_id || null,
        },

        customerNotification,
      },
    });
  } catch (error) {
    console.error(
      "MANUAL WHATSAPP SHARE FAILED:",
      error.message
    );

    if (error.providerResponse) {
      console.error(
        "SMSMOJO PROVIDER RESPONSE =>",
        error.providerResponse
      );
    }

    if (error.status || error.providerResponse) {
      return res.status(502).json({
        success: false,
        message: "WhatsApp provider request failed",
        error: error.message,
        providerResponse:
          error.providerResponse || null,
      });
    }

    return next(error);
  }
};

// ============================================================
// SHARE ORDER IMAGE VIA WHATSAPP
// POST /api/orders/:id/share-whatsapp-image
// ============================================================

export const shareOrderImageWhatsAppController = async (
  req,
  res,
  next
) => {
  try {
    const orderId = parseOrderId(req.params.id);

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await getOrderById(orderId);

    if (!order.makerId || !order.maker) {
      return res.status(400).json({
        success: false,
        message: "Please assign a maker before sharing",
      });
    }

    const result = await sendOrderImageToMaker(order);

    if (result?.skipped) {
      return res.status(400).json({
        success: false,
        message:
          result.reason || "Image sharing was skipped",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order image request accepted by SMSMOJO",
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        metaMessageId:
          result?.meta_message_id || null,
      },
    });
  } catch (error) {
    console.error(
      "ORDER IMAGE WHATSAPP FAILED:",
      error.message
    );

    if (error.status || error.providerResponse) {
      return res.status(502).json({
        success: false,
        message: "WhatsApp image sending failed",
        error: error.message,
        providerResponse:
          error.providerResponse || null,
      });
    }

    return next(error);
  }
};

// ============================================================
// SHARE ORDER VIDEO VIA WHATSAPP
// POST /api/orders/:id/share-whatsapp-video
// ============================================================

export const shareOrderVideoWhatsAppController = async (
  req,
  res,
  next
) => {
  try {
    const orderId = parseOrderId(req.params.id);

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await getOrderById(orderId);

    if (!order.makerId || !order.maker) {
      return res.status(400).json({
        success: false,
        message: "Please assign a maker before sharing",
      });
    }

    if (order.orderType !== "NEW") {
      return res.status(400).json({
        success: false,
        message:
          "Video sharing is only enabled for NEW orders",
      });
    }

    const result = await sendOrderVideoToMaker(order);

    if (result?.skipped) {
      return res.status(400).json({
        success: false,
        message:
          result.reason || "Video sharing was skipped",
      });
    }

    console.log("ORDER VIDEO SHARE ACCEPTED =>", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      metaMessageId:
        result?.meta_message_id || null,
    });

    return res.status(200).json({
      success: true,
      message: "Order video request accepted by SMSMOJO",
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        metaMessageId:
          result?.meta_message_id || null,
        providerMessage: result?.message || null,
      },
    });
  } catch (error) {
    console.error(
      "ORDER VIDEO WHATSAPP FAILED:",
      error.message
    );

    if (error.providerResponse) {
      console.error(
        "SMSMOJO VIDEO PROVIDER RESPONSE =>",
        error.providerResponse
      );
    }

    if (error.status || error.providerResponse) {
      return res.status(502).json({
        success: false,
        message: "WhatsApp video sending failed",
        error: error.message,
        providerResponse:
          error.providerResponse || null,
      });
    }

    return next(error);
  }
};

// ============================================================
// GET ORDER LIST
// ============================================================

export const getOrdersController = async (req, res, next) => {
  try {
    const result = await getOrders({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      orderType: req.query.orderType,
      status: req.query.status,
      branchId: req.query.branchId,
      priority: req.query.priority,
    });

    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      data: result.orders,
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
};

// ============================================================
// GET ORDER DETAILS
// ============================================================

export const getOrderByIdController = async (req, res, next) => {
  try {
    const order = await getOrderById(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Order details fetched successfully",
      data: order,
    });
  } catch (error) {
    return next(error);
  }
};

// ============================================================
// UPDATE ORDER
// ============================================================

export const updateOrderController = async (req, res, next) => {
  try {
    const order = await updateOrder(
      req.params.id,
      normalizeBody(req.body),
      req.files || []
    );

    return res.status(200).json({
      success: true,
      message: "Order updated successfully",
      data: order,
    });
  } catch (error) {
    await cleanupUploadedFiles(req.files || []);
    return next(error);
  }
};

// ============================================================
// DELETE ORDER
// ============================================================

export const deleteOrderController = async (req, res, next) => {
  try {
    const result = await deleteOrder(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Order deleted successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};