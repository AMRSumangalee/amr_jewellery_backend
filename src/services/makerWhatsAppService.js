
import {
  sendWhatsAppMessage,
  sendWhatsAppImageTemplate,
  sendWhatsAppVideoTemplate,
} from "./smsmojoService.js";

// ======================================================
// FORMAT DATE
// ======================================================
const formatDate = (value) => {
  if (!value) return "N/A";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

// ======================================================
// GET MAKER WHATSAPP NUMBER
// ======================================================
const getPhoneNumber = (maker) => {
  const phone = maker?.whatsappNumber || maker?.phone;

  if (!phone) {
    throw new Error("Maker WhatsApp number is missing");
  }

  let number = String(phone).replace(/\D/g, "");

  if (number.length === 10) {
    number = `91${number}`;
  }

  if (!/^91\d{10}$/.test(number)) {
    throw new Error(
      "Invalid Indian WhatsApp number. Check maker phone and country code."
    );
  }

  return number;
};

// ======================================================
// GET REPAIR TYPE NAMES
// ======================================================
const getRepairTypes = (order) => {
  if (!Array.isArray(order.repairTypes) || !order.repairTypes.length) {
    return "N/A";
  }

  const names = order.repairTypes
    .map((item) => item.repairType?.name || item.name)
    .filter(Boolean);

  return names.length ? names.join(", ") : "N/A";
};

// ======================================================
// SEND NEW ORDER TEMPLATE
// ======================================================
export const sendNewOrderToMaker = async (order) => {
  if (order.orderType !== "NEW") {
    return {
      skipped: true,
      reason: "This notification is only for NEW orders",
    };
  }

  if (!order.maker) {
    throw new Error("No maker is assigned to this order");
  }

  const templateId = process.env.SMSMOJO_MAKER_NEW_TEMPLATE_ID;

  if (!templateId) {
    throw new Error("SMSMOJO Maker NEW template ID is missing");
  }

  const to = getPhoneNumber(order.maker);

  const variables = {
    "1": order.maker.name || "Maker",
    "2": order.orderNumber || "N/A",
    "3": order.branch?.name || "N/A",
    "4": order.metal?.name || "N/A",
    "5": order.category?.name || "N/A",
    "6": order.purity
      ? `${String(order.purity).replace(/K/gi, "")}K`
      : "N/A",
    "7": order.weight != null ? String(order.weight) : "N/A",
    "8": order.length != null ? String(order.length) : "N/A",
    "9": order.lengthUnit || "N/A",
    "10": order.size != null ? String(order.size) : "N/A",
    "11": formatDate(order.expectedDeliveryDate),
    "12": order.priority || "NORMAL",
    "13": order.description || "No additional description",
  };

  const payload = {
    to,
    type: "template",
    template_id: templateId,
    language: process.env.SMSMOJO_MAKER_NEW_TEMPLATE_LANGUAGE || "en_US",
    campaign_name: "Jewellery New Orders",
    variables,
  };

  console.log("MAKER NEW TEMPLATE:", {
    to,
    templateId,
    language: payload.language,
    orderNumber: order.orderNumber,
    variableCount: Object.keys(variables).length,
  });

  return sendWhatsAppMessage(payload);
};

// ======================================================
// SEND REPAIR ORDER TEMPLATE
// ======================================================
export const sendRepairOrderToMaker = async (order) => {
  if (order.orderType !== "REPAIR") {
    return {
      skipped: true,
      reason: "This notification is only for REPAIR orders",
    };
  }

  if (!order.maker) {
    throw new Error("No maker is assigned to this repair order");
  }

  const templateId = process.env.SMSMOJO_MAKER_REPAIR_TEMPLATE_ID;

  if (!templateId) {
    throw new Error("SMSMOJO Maker REPAIR template ID is missing");
  }

  const to = getPhoneNumber(order.maker);

  const variables = {
    "1": order.maker.name || "Maker",
    "2": order.orderNumber || "N/A",
    "3": order.branch?.name || "N/A",
    "4": order.customer?.name || order.customerName || "N/A",
    "5": order.metal?.name || "N/A",
    "6": order.category?.name || "N/A",
    "7": getRepairTypes(order),
    "8": order.existingJewelleryDescription || "N/A",
    "9": order.problemDescription || "N/A",
    "10": order.receivedItemDescription || "N/A",
    "11": formatDate(order.expectedDeliveryDate),
    "12": order.priority || "NORMAL",
  };

  const payload = {
    to,
    type: "template",
    template_id: templateId,
    language:
      process.env.SMSMOJO_MAKER_REPAIR_TEMPLATE_LANGUAGE || "en_US",
    campaign_name: "Jewellery Repair Orders",
    variables,
  };

  console.log("MAKER REPAIR TEMPLATE:", {
    to,
    templateId,
    language: payload.language,
    orderNumber: order.orderNumber,
    variableCount: Object.keys(variables).length,
  });

  return sendWhatsAppMessage(payload);
};

// ======================================================
// GET PUBLIC IMAGE URL
// ======================================================

const getPublicImageUrl = (media) => {
  const baseUrl = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");

  if (!baseUrl || !/^https:\/\//i.test(baseUrl)) {
    throw new Error(
      "PUBLIC_BASE_URL must be configured with a public HTTPS URL"
    );
  }

  if (!Array.isArray(media) || media.length === 0) {
    throw new Error("This order has no uploaded media");
  }

  // Find an image using MIME type, media type, or file extension.
  const image = media.find((item) => {
    const mimeType = String(
      item.mimeType || item.mimetype || item.mime_type || ""
    ).toLowerCase();

    const mediaType = String(
      item.mediaType || item.fileType || item.type || ""
    ).toLowerCase();

    const filePath = String(
      item.fileUrl || item.filePath || item.url || item.path || ""
    );

    return (
      mimeType.startsWith("image/") ||
      mediaType === "image" ||
      /\.(jpe?g|png|webp|gif)(?:\?.*)?$/i.test(filePath)
    );
  });

  if (!image) {
    throw new Error("No image found in this order's media");
  }

  const filePath =
    image.fileUrl ||
    image.filePath ||
    image.url ||
    image.path;

  if (!filePath) {
    throw new Error("Order image file path is missing");
  }

  // If the stored URL is already absolute, preserve it.
  if (/^https:\/\//i.test(filePath)) {
    return filePath;
  }

  // Convert a relative upload path into a public HTTPS URL.
  const relativePath = String(filePath)
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  const imageUrl = `${baseUrl}/${relativePath}`;

  console.log("ORDER IMAGE URL GENERATED:", {
    imageId: image.id || null,
    orderImagePath: relativePath,
    imageUrl,
  });

  return imageUrl;
};


// ======================================================
// GET PUBLIC VIDEO URL
// ======================================================

const getPublicVideoUrl = (media) => {
  const baseUrl = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");

  if (!baseUrl || !/^https:\/\//i.test(baseUrl)) {
    throw new Error(
      "PUBLIC_BASE_URL must be configured with a public HTTPS URL"
    );
  }

  if (!Array.isArray(media) || media.length === 0) {
    throw new Error("This order has no uploaded media");
  }

  const video = media.find((item) => {
    const mimeType = String(
      item.mimeType || item.mimetype || item.mime_type || ""
    ).toLowerCase();

    const mediaType = String(
      item.mediaType || item.fileType || item.type || ""
    ).toUpperCase();

    const filePath = String(
      item.fileUrl || item.filePath || item.url || item.path || ""
    );

    return (
      mimeType.startsWith("video/") ||
      mediaType === "VIDEO" ||
      /\.(mp4|3gp|mov|m4v|webm)(?:\?.*)?$/i.test(filePath)
    );
  });

  if (!video) {
    throw new Error("No video found in this order's media");
  }

  const filePath =
    video.fileUrl ||
    video.filePath ||
    video.url ||
    video.path;

  if (!filePath) {
    throw new Error("Order video file path is missing");
  }

  let videoUrl;

  if (/^https:\/\//i.test(filePath)) {
    videoUrl = filePath;
  } else {
    const relativePath = String(filePath)
      .replace(/\\/g, "/")
      .replace(/^\/+/, "");

    videoUrl = `${baseUrl}/${relativePath}`;
  }

  console.log("ORDER VIDEO URL GENERATED:", {
    mediaId: video.id || null,
    videoPath: filePath,
    videoUrl,
  });

  return videoUrl;
};

// ======================================================
// SEND ORDER IMAGE TEMPLATE TO MAKER
// ======================================================
export const sendOrderImageToMaker = async (order) => {
  if (!order) {
    throw new Error("Order not found");
  }

  if (!order.maker) {
    throw new Error("No maker is assigned to this order");
  }

  if (!order.orderNumber) {
    throw new Error("Order number is missing");
  }

  const templateId = process.env.SMSMOJO_MAKER_IMAGE_TEMPLATE_ID;

  if (!templateId) {
    throw new Error("SMSMOJO Maker IMAGE template ID is missing");
  }

  const to = getPhoneNumber(order.maker);

  const imageUrl = getPublicImageUrl(order.media);

  const language =
    process.env.SMSMOJO_MAKER_IMAGE_TEMPLATE_LANGUAGE || "en_US";

  console.log("MAKER IMAGE TEMPLATE REQUEST:", {
    to,
    templateId,
    language,
    orderNumber: order.orderNumber,
    imageUrl,
    bodyParameterCount: 1,
  });

  // This function must use the exact image-header field expected by
  // the SMS-MOJO API. Confirm its request schema before production use.
  return sendWhatsAppImageTemplate({
    to,
    templateId,
    language,
    orderNumber: order.orderNumber,
    imageUrl,
  });
};


// ======================================================
// SEND ORDER VIDEO TEMPLATE TO MAKER
// ======================================================

export const sendOrderVideoToMaker = async (order) => {
  if (!order) {
    throw new Error("Order not found");
  }

  if (!order.maker) {
    throw new Error("No maker is assigned to this order");
  }

  if (!order.orderNumber) {
    throw new Error("Order number is missing");
  }

  const templateId = process.env.SMSMOJO_MAKER_VIDEO_TEMPLATE_ID;

  if (!templateId) {
    throw new Error("SMSMOJO Maker VIDEO template ID is missing");
  }

  const to = getPhoneNumber(order.maker);
  const videoUrl = getPublicVideoUrl(order.media);

  const language =
    process.env.SMSMOJO_MAKER_VIDEO_TEMPLATE_LANGUAGE || "en_US";

  console.log("MAKER VIDEO TEMPLATE REQUEST:", {
    to,
    templateId,
    language,
    orderNumber: order.orderNumber,
    videoUrl,
  });

  return sendWhatsAppVideoTemplate({
    to,
    templateId,
    language,
    orderNumber: order.orderNumber,
    videoUrl,
  });
};
