
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

  // Customer name and personal details are not shared with the maker.
  // Keep variable positions unchanged for the already-approved template.
  const variables = {
    "1": order.maker.name || "Maker",
    "2": order.orderNumber || "N/A",
    "3": order.branch?.name || "N/A",
    "4": "N/A",
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
// PUBLIC MEDIA URL HELPERS
// ======================================================

const getPublicBaseUrl = () => {
  const baseUrl = process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");

  if (!baseUrl || !/^https:\/\//i.test(baseUrl)) {
    throw new Error(
      "PUBLIC_BASE_URL must be configured with a public HTTPS URL"
    );
  }

  return baseUrl;
};

// Build public URL using storageKey or the stored legacy path.
// Physical permanent-uploads paths are never sent to SMSMOJO.
const buildPublicMediaUrl = (media, expectedType) => {
  if (!media) {
    throw new Error(`${expectedType} media is missing`);
  }

  const baseUrl = getPublicBaseUrl();

  const folderMap = {
    IMAGE: "images",
    VIDEO: "videos",
  };

  const folder = folderMap[expectedType];

  if (!folder) {
    throw new Error("Unsupported media type");
  }

  const mimeType = String(
    media.mimeType || media.mimetype || media.mime_type || ""
  ).toLowerCase();

  const mediaType = String(
    media.mediaType || media.fileType || media.type || ""
  ).toUpperCase();

  const storedPath = String(
    media.fileUrl || media.filePath || media.url || media.path || ""
  ).trim();

  const storageKey = String(media.storageKey || "").trim();

  // Validate that the selected media really belongs to this type.
  if (mediaType && mediaType !== expectedType) {
    throw new Error(
      `Expected ${expectedType} media but received ${mediaType}`
    );
  }

  if (mimeType && !mimeType.startsWith(
    expectedType === "IMAGE" ? "image/" : "video/"
  )) {
    throw new Error(`Invalid ${expectedType} MIME type: ${mimeType}`);
  }

  // Preserve an already-public HTTPS URL.
  if (/^https:\/\//i.test(storedPath)) {
    const parsedUrl = new URL(storedPath);

    if (parsedUrl.protocol !== "https:") {
      throw new Error("Media URL must use HTTPS");
    }

    console.log(`${expectedType} EXISTING PUBLIC URL:`, parsedUrl.href);

    return parsedUrl.href;
  }

  let fileName = "";

  // storageKey is preferred because it is the uploaded filename.
  if (storageKey) {
    fileName = storageKey;
  } else if (storedPath) {
    const normalizedPath = storedPath
      .replace(/\\/g, "/")
      .split("?")[0]
      .split("#")[0];

    // Supports:
    // /uploads/images/file.jpg
    // ../../permanent-uploads/images/file.jpg
    // permanent-uploads/images/file.jpg
    const match = normalizedPath.match(
      /(?:^|\/)(images|videos)\/([^/]+)$/i
    );

    if (match) {
      const storedFolder = match[1].toLowerCase();

      if (storedFolder !== folder) {
        throw new Error(
          `Media folder mismatch. Expected ${folder}, found ${storedFolder}`
        );
      }

      fileName = match[2];
    } else {
      // Legacy path may contain only the filename.
      fileName = normalizedPath.split("/").pop() || "";
    }
  }

  if (!fileName) {
    throw new Error(`${expectedType} filename is missing`);
  }

  // Prevent directory traversal and path injection.
  fileName = pathSafeFileName(fileName);

  const publicUrl =
    `${baseUrl}/uploads/${folder}/${encodeURIComponent(fileName)}`;

  console.log(`${expectedType} PUBLIC URL GENERATED:`, {
    mediaId: media.id || null,
    mediaType: expectedType,
    storageKey: media.storageKey || null,
    storedPath,
    publicUrl,
  });

  return publicUrl;
};

// Only allow a filename, not a directory path.
const pathSafeFileName = (value) => {
  const normalized = String(value).replace(/\\/g, "/");
  const fileName = normalized.split("/").pop();

  if (
    !fileName ||
    fileName === "." ||
    fileName === ".." ||
    fileName.includes("\0")
  ) {
    throw new Error("Invalid media filename");
  }

  return fileName;
};

// ======================================================
// GET PUBLIC IMAGE URL
// ======================================================

const getPublicImageUrl = (media) => {
  if (!Array.isArray(media) || media.length === 0) {
    throw new Error("This order has no uploaded media");
  }

  const image = media.find((item) => {
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
      mediaType === "IMAGE" ||
      mimeType.startsWith("image/") ||
      /\.(jpe?g|png|webp|gif)(?:\?.*)?$/i.test(filePath)
    );
  });

  if (!image) {
    throw new Error("No image found in this order's media");
  }

  return buildPublicMediaUrl(image, "IMAGE");
};

// ======================================================
// GET PUBLIC VIDEO URL
// ======================================================

const getPublicVideoUrl = (media) => {
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
      mediaType === "VIDEO" ||
      mimeType.startsWith("video/") ||
      /\.(mp4|3gp|mov|m4v|webm)(?:\?.*)?$/i.test(filePath)
    );
  });

  if (!video) {
    throw new Error("No video found in this order's media");
  }

  return buildPublicMediaUrl(video, "VIDEO");
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
  });

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
