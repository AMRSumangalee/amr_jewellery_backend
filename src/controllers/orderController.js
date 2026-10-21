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
  let order;

  // Step 1: Save the order and newly uploaded media first.
  try {
    const uploadedFiles = req.files || [];

    console.log("UPDATE ORDER REQUEST =>", {
      orderId: req.params.id,
      uploadedFileCount: uploadedFiles.length,
      uploadedFiles: uploadedFiles.map((file) => ({
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
      })),
    });

    order = await updateOrder(
      req.params.id,
      normalizeBody(req.body),
      uploadedFiles
    );
  } catch (error) {
    await cleanupUploadedFiles(req.files || []);
    return next(error);
  }

  const uploadedFiles = req.files || [];

  // No new media means there is nothing to send.
  if (uploadedFiles.length === 0) {
    return res.status(200).json({
      success: true,
      message: "Order updated successfully. No new media uploaded.",
      data: order,
      whatsapp: {
        attempted: false,
        results: [],
      },
    });
  }

  // Step 2: Load the saved order with its maker and media.
  let savedOrder;

  try {
    savedOrder = await getOrderById(order.id);
  } catch (error) {
    console.error(
      "UPDATED ORDER FETCH FAILED:",
      error.message
    );

    return res.status(200).json({
      success: true,
      message: "Order updated successfully, but media sharing could not start.",
      data: order,
      whatsapp: {
        attempted: false,
        results: [],
        error: error.message,
      },
    });
  }

  const results = [];

  // Step 3: Match ONLY the files uploaded in this update request.
  const uploadedKeys = new Set(
    uploadedFiles.map((file) => file.filename)
  );

  const newMedia = (savedOrder.media || []).filter((media) =>
    uploadedKeys.has(media.storageKey)
  );

  if (!savedOrder.makerId || !savedOrder.maker) {
    console.warn(
      "UPDATED MEDIA NOT SENT: No maker assigned",
      savedOrder.orderNumber
    );

    return res.status(200).json({
      success: true,
      message: "Order updated successfully, but no maker is assigned.",
      data: savedOrder,
      whatsapp: {
        attempted: false,
        results: [],
        reason: "NO_MAKER_ASSIGNED",
      },
    });
  }

  // Step 4: Send each newly uploaded image/video separately.
  for (const media of newMedia) {
    const mediaType = String(
      media.mediaType || ""
    ).toUpperCase();

    try {
      let result;

      if (mediaType === "IMAGE") {
        result = await sendOrderImageToMaker({
          ...savedOrder,
          media: [media],
        });
      } else if (mediaType === "VIDEO") {
        result = await sendOrderVideoToMaker({
          ...savedOrder,
          media: [media],
        });
      } else {
        console.log(
          "UPDATED MEDIA TYPE NOT SENT:",
          mediaType,
          media.fileName
        );

        results.push({
          mediaId: media.id,
          fileName: media.fileName,
          mediaType,
          sent: false,
          reason: "UNSUPPORTED_MEDIA_TYPE",
        });

        continue;
      }

      if (result?.skipped) {
        results.push({
          mediaId: media.id,
          fileName: media.fileName,
          mediaType,
          sent: false,
          reason: result.reason || "Provider skipped the message",
        });

        continue;
      }

      results.push({
        mediaId: media.id,
        fileName: media.fileName,
        mediaType,
        sent: true,
        metaMessageId: result?.meta_message_id || null,
      });

      console.log("UPDATED MEDIA WHATSAPP ACCEPTED:", {
        orderNumber: savedOrder.orderNumber,
        fileName: media.fileName,
        mediaType,
        metaMessageId: result?.meta_message_id || null,
      });
    } catch (error) {
      // WhatsApp failure must not undo the successfully saved order.
      console.error("UPDATED MEDIA WHATSAPP FAILED:", {
        orderNumber: savedOrder.orderNumber,
        fileName: media.fileName,
        mediaType,
        error: error.message,
        providerResponse: error.providerResponse || null,
      });

      results.push({
        mediaId: media.id,
        fileName: media.fileName,
        mediaType,
        sent: false,
        error: error.message,
      });
    }
  }

  const sentCount = results.filter((item) => item.sent).length;
  const failedCount = results.length - sentCount;

  return res.status(200).json({
    success: true,
    message:
      failedCount === 0
        ? "Order updated successfully. New media sharing completed."
        : "Order updated successfully, but some media could not be shared.",
    data: savedOrder,
    whatsapp: {
      attempted: true,
      total: results.length,
      sent: sentCount,
      failed: failedCount,
      results,
    },
  });
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