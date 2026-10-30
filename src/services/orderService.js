
import fs from "fs/promises";
import path from "path";

import prisma from "../config/database.js";
import { generateOrderNumber } from "../utils/orderNumber.js";

// ============================================================
// HELPERS
// ============================================================

const normalizeLengthUnit = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const unit = String(value).trim().toUpperCase();

  if (unit === "INCH" || unit === "CM") {
    return unit;
  }

  throw new Error("Length unit must be INCH or CM");
};

const normalizePurity = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const purity = String(value).trim().toUpperCase();

  const purityMap = {
    "18K": "K18",
    K18: "K18",
    "22K": "K22",
    K22: "K22",
    "24K": "K24",
    K24: "K24",
  };

  if (!purityMap[purity]) {
    throw new Error("Purity must be 18K, 22K or 24K");
  }

  return purityMap[purity];
};

const getMediaType = (mimeType) => {
  const mime = mimeType?.toLowerCase() || "";

  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime.startsWith("audio/")) return "AUDIO";

  throw new Error(`Unsupported media type: ${mimeType}`);
};

const getMediaContext = (orderType, mediaType) => {
  if (orderType === "REPAIR") {
    if (mediaType === "IMAGE" || mediaType === "VIDEO") {
      return "BEFORE_REPAIR";
    }

    if (mediaType === "AUDIO") {
      return "CUSTOMER_WHATSAPP";
    }
  }

  return "ORDER";
};

const getFileUrl = (file) => {
  const relativePath = path
    .relative(process.cwd(), file.path)
    .replaceAll("\\", "/");

  return `/${relativePath}`;
};

const toNumberOrNull = (value) =>
  value !== undefined && value !== null && value !== ""
    ? Number(value)
    : null;

const ORDER_INCLUDE = {
  branch: true,
  metal: true,
  category: true,
  maker: true,
  repairTypes: {
    include: {
      repairType: true,
    },
  },
  media: true,
};

// Used by the controller to remove uploaded files when a request fails
export const cleanupUploadedFiles = async (files = []) => {
  for (const file of files) {
    try {
      await fs.unlink(file.path);
    } catch (error) {
      console.error("FILE CLEANUP ERROR:", file.path, error.message);
    }
  }
};

// ============================================================
// CREATE ORDER
// Media is optional.
// ============================================================

export const createOrder = async (data, files = []) => {
  const t0 = Date.now();

  const {
    branchId,
    customerName,
    customerPhone,
    customerArea,

    orderType,

    expectedDeliveryDate,
    priority,

    advance,
    estimate,

    makerId,

    metalId,
    categoryId,

    length,
    lengthUnit,
    size,
    weight,
    purity,
    description,

    existingJewelleryDescription,
    problemDescription,
    receivedItemDescription,

    repairTypeIds,
  } = data;

  // ----------------------------------------------------------
  // BASIC VALIDATION (no DB)
  // ----------------------------------------------------------

  if (!branchId) throw new Error("Branch is required");
  if (!customerName?.trim()) throw new Error("Customer name is required");
  if (!customerPhone?.trim()) throw new Error("Customer phone is required");
  if (!customerArea?.trim()) throw new Error("Customer area is required");
  if (!orderType) throw new Error("Order type is required");

  if (!["NEW", "REPAIR"].includes(orderType)) {
    throw new Error("Invalid order type");
  }

  if (!expectedDeliveryDate) {
    throw new Error("Expected delivery date is required");
  }

  // Image / Video / Audio are optional.
  // Order can be created without any media.

  if (orderType === "NEW") {
    if (!metalId) throw new Error("Metal is required for new order");
    if (!categoryId) throw new Error("Category is required for new order");
  }

  let uniqueRepairTypeIds = [];

  if (orderType === "REPAIR") {
    if (!Array.isArray(repairTypeIds) || repairTypeIds.length === 0) {
      throw new Error("At least one repair type is required");
    }

    if (!existingJewelleryDescription?.trim()) {
      throw new Error("Existing jewellery description is required");
    }

    if (!problemDescription?.trim()) {
      throw new Error("Problem / repair description is required");
    }

    uniqueRepairTypeIds = [
      ...new Set(repairTypeIds.map((id) => Number(id))),
    ];
  }

  const finalLengthUnit = normalizeLengthUnit(lengthUnit);
  const finalPurity = normalizePurity(purity);

  // ----------------------------------------------------------
  // PARALLEL DB VERIFICATION
  // ----------------------------------------------------------

  const [branch, metal, category, maker, repairTypes] =
    await Promise.all([
      prisma.branch.findFirst({
        where: { id: Number(branchId), status: true },
      }),

      metalId
        ? prisma.metal.findFirst({
            where: { id: Number(metalId), status: true },
          })
        : null,

      categoryId
        ? prisma.category.findFirst({
            where: { id: Number(categoryId), status: true },
          })
        : null,

      makerId
        ? prisma.maker.findFirst({
            where: { id: Number(makerId), status: true },
          })
        : null,

      orderType === "REPAIR"
        ? prisma.repairType.findMany({
            where: { id: { in: uniqueRepairTypeIds }, status: true },
          })
        : [],
    ]);

  if (!branch) throw new Error("Active branch not found");
  if (metalId && !metal) throw new Error("Active metal not found");
  if (categoryId && !category) throw new Error("Active category not found");
  if (makerId && !maker) throw new Error("Active maker not found");

  if (
    orderType === "REPAIR" &&
    repairTypes.length !== uniqueRepairTypeIds.length
  ) {
    throw new Error("One or more repair types are invalid");
  }

  console.log("CREATE ORDER VALIDATION ms =>", Date.now() - t0);

  // Generated after validation so failed requests never use a number
  const orderNumber = await generateOrderNumber();

  // ----------------------------------------------------------
  // MEDIA (OPTIONAL)
  // ----------------------------------------------------------

  const mediaData = files.map((file) => {
    const mediaType = getMediaType(file.mimetype);

    return {
      mediaType,
      mediaContext: getMediaContext(orderType, mediaType),
      fileName: file.originalname,
      fileUrl: getFileUrl(file),
      storageKey: file.filename,
      mimeType: file.mimetype,
      fileSize: file.size,
    };
  });

  // ----------------------------------------------------------
  // CREATE
  // ----------------------------------------------------------

  const order = await prisma.order.create({
    data: {
      orderNumber,

      branchId: Number(branchId),

      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerArea: customerArea.trim(),

      orderType,

      expectedDeliveryDate: new Date(expectedDeliveryDate),
      priority: priority === "URGENT" ? "URGENT" : "NORMAL",

      advance: toNumberOrNull(advance),
      estimate: toNumberOrNull(estimate),

      makerId: makerId ? Number(makerId) : null,

      status: "NEW",

      metalId: metalId ? Number(metalId) : null,
      categoryId: categoryId ? Number(categoryId) : null,

      length: toNumberOrNull(length),
      lengthUnit: finalLengthUnit,

      size:
        size !== undefined && size !== null && size !== ""
          ? String(size)
          : null,

      weight: toNumberOrNull(weight),
      purity: finalPurity,

      description: description?.trim() || null,

      existingJewelleryDescription:
        existingJewelleryDescription?.trim() || null,

      problemDescription: problemDescription?.trim() || null,

      receivedItemDescription: receivedItemDescription?.trim() || null,

      // No media = skip nested media creation
      media:
        mediaData.length > 0
          ? {
              create: mediaData,
            }
          : undefined,

      repairTypes:
        orderType === "REPAIR"
          ? {
              create: repairTypes.map((repairType) => ({
                repairTypeId: repairType.id,
              })),
            }
          : undefined,
    },

    include: ORDER_INCLUDE,
  });

  console.log("CREATE ORDER TOTAL ms =>", Date.now() - t0);

  return order;
};

// ============================================================
// GET ORDER LIST
// ============================================================

export const getOrders = async ({
  page = 1,
  limit = 10,
  search,
  orderType,
  status,
  branchId,
  priority,
  fromDate,
  toDate,
  makerId,
}) => {
  const currentPage = Math.max(Number(page) || 1, 1);
  const currentLimit = Math.min(
    Math.max(Number(limit) || 10, 1),
    100
  );

  const skip = (currentPage - 1) * currentLimit;
  const where = {};

  // Order type filter
  if (orderType) {
    if (!["NEW", "REPAIR"].includes(orderType)) {
      throw new Error("Invalid order type");
    }

    where.orderType = orderType;
  }

  // Status filter
  if (status) {
    const allowedStatuses = [
      "DRAFT",
      "NEW",
      "ASSIGNED",
      "IN_PROGRESS",
      "COMPLETED",
      "FINAL_CONFIRMED",
      "DELIVERED",
      "CLEANUP",
      "ON_HOLD",
      "CANCELLED",
    ];

    if (!allowedStatuses.includes(status)) {
      throw new Error("Invalid order status");
    }

    where.status = status;
  }

  // Branch filter
  if (branchId !== undefined && branchId !== null && branchId !== "") {
    const parsedBranchId = Number(branchId);

    if (!Number.isInteger(parsedBranchId) || parsedBranchId <= 0) {
      throw new Error("Invalid branch ID");
    }

    where.branchId = parsedBranchId;
  }

  // Maker filter
  if (makerId !== undefined && makerId !== null && makerId !== "") {
    const parsedMakerId = Number(makerId);

    if (!Number.isInteger(parsedMakerId) || parsedMakerId <= 0) {
      throw new Error("Invalid maker ID");
    }

    where.makerId = parsedMakerId;
  }

  // Priority filter
  if (priority) {
    if (!["NORMAL", "URGENT"].includes(priority)) {
      throw new Error("Invalid priority");
    }

    where.priority = priority;
  }

  // Order Created Date filter.
  // Date inputs are interpreted using India Standard Time (UTC+05:30).
  // Both boundary dates are inclusive.
  if (fromDate || toDate) {
    const createdAt = {};

    const parseDate = (value, label, isEndOfDay = false) => {
      if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
      ) {
        throw new Error(`Invalid ${label}. Expected YYYY-MM-DD`);
      }

      const date = new Date(
        `${value}T${isEndOfDay ? "23:59:59.999" : "00:00:00.000"}+05:30`
      );

      if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid ${label}`);
      }

      // Reject impossible dates such as 2026-02-31.
      const [year, month, day] = value.split("-").map(Number);
      const check = new Date(Date.UTC(year, month - 1, day));

      if (
        check.getUTCFullYear() !== year ||
        check.getUTCMonth() !== month - 1 ||
        check.getUTCDate() !== day
      ) {
        throw new Error(`Invalid ${label}`);
      }

      return date;
    };

    if (fromDate) {
      createdAt.gte = parseDate(fromDate, "fromDate");
    }

    if (toDate) {
      createdAt.lte = parseDate(toDate, "toDate", true);
    }

    if (
      createdAt.gte &&
      createdAt.lte &&
      createdAt.gte.getTime() > createdAt.lte.getTime()
    ) {
      throw new Error("fromDate must be before or equal to toDate");
    }

    where.createdAt = createdAt;
  }

  // Search by order number, customer name, phone, or area.
  if (search?.trim()) {
    const searchText = search.trim();

    where.OR = [
      { orderNumber: { contains: searchText } },
      { customerName: { contains: searchText } },
      { customerPhone: { contains: searchText } },
      { customerArea: { contains: searchText } },
    ];
  }

  const [orders, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      skip,
      take: currentLimit,
      orderBy: { id: "desc" },
      include: ORDER_INCLUDE,
    }),

    prisma.order.count({ where }),
  ]);

  const totalPages = Math.ceil(total / currentLimit);

  return {
    orders,
    pagination: {
      page: currentPage,
      limit: currentLimit,
      total,
      totalPages,
    },
  };
};

// ============================================================
// GET ORDER DETAILS
// ============================================================

export const getOrderById = async (orderId) => {
  const id = Number(orderId);

  if (!id || Number.isNaN(id)) {
    throw new Error("Invalid order ID");
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: ORDER_INCLUDE,
  });

  if (!order) {
    throw new Error("Order not found");
  }

  return order;
};

// ============================================================
// UPDATE ORDER
// Media is optional. Existing media is preserved.
// ============================================================

export const updateOrder = async (orderId, data, files = []) => {
  const t0 = Date.now();

  const id = Number(orderId);

  if (!id || Number.isNaN(id)) {
    throw new Error("Invalid order ID");
  }

  const existingOrder = await prisma.order.findUnique({
    where: { id },
    include: {
      media: true,
      repairTypes: true,
    },
  });

  if (!existingOrder) {
    throw new Error("Order not found");
  }

  const {
    branchId,
    customerName,
    customerPhone,
    customerArea,

    orderType,

    expectedDeliveryDate,
    priority,

    advance,
    estimate,

    makerId,

    metalId,
    categoryId,

    length,
    lengthUnit,
    size,
    weight,
    purity,
    description,

    existingJewelleryDescription,
    problemDescription,
    receivedItemDescription,

    repairTypeIds,
  } = data;

  // ----------------------------------------------------------
  // FINAL VALUES + VALIDATION (no DB)
  // ----------------------------------------------------------

  const finalOrderType = orderType || existingOrder.orderType;

  if (!["NEW", "REPAIR"].includes(finalOrderType)) {
    throw new Error("Invalid order type");
  }

  const finalBranchId =
    branchId !== undefined ? Number(branchId) : existingOrder.branchId;

  const finalCustomerName =
    customerName !== undefined
      ? customerName.trim()
      : existingOrder.customerName;

  const finalCustomerPhone =
    customerPhone !== undefined
      ? customerPhone.trim()
      : existingOrder.customerPhone;

  const finalCustomerArea =
    customerArea !== undefined
      ? customerArea.trim()
      : existingOrder.customerArea;

  const finalDeliveryDate =
    expectedDeliveryDate !== undefined
      ? expectedDeliveryDate
      : existingOrder.expectedDeliveryDate;

  if (!finalBranchId) throw new Error("Branch is required");
  if (!finalCustomerName) throw new Error("Customer name is required");
  if (!finalCustomerPhone) throw new Error("Customer phone is required");
  if (!finalCustomerArea) throw new Error("Customer area is required");

  if (!finalDeliveryDate) {
    throw new Error("Expected delivery date is required");
  }

  const finalLengthUnit =
    lengthUnit !== undefined
      ? normalizeLengthUnit(lengthUnit)
      : existingOrder.lengthUnit;

  const finalPurity =
    purity !== undefined ? normalizePurity(purity) : existingOrder.purity;

  const finalMetalId =
    metalId !== undefined
      ? metalId
        ? Number(metalId)
        : null
      : existingOrder.metalId;

  const finalCategoryId =
    categoryId !== undefined
      ? categoryId
        ? Number(categoryId)
        : null
      : existingOrder.categoryId;

  const finalMakerId =
    makerId !== undefined
      ? makerId
        ? Number(makerId)
        : null
      : existingOrder.makerId;

  if (finalOrderType === "NEW") {
    if (!finalMetalId) {
      throw new Error("Metal is required for new order");
    }

    if (!finalCategoryId) {
      throw new Error("Category is required for new order");
    }
  }

  let finalRepairTypeIds = [];

  if (finalOrderType === "REPAIR") {
    if (repairTypeIds !== undefined) {
      if (!Array.isArray(repairTypeIds) || repairTypeIds.length === 0) {
        throw new Error("At least one repair type is required");
      }

      finalRepairTypeIds = [
        ...new Set(repairTypeIds.map((item) => Number(item))),
      ];
    } else {
      finalRepairTypeIds = existingOrder.repairTypes.map(
        (item) => item.repairTypeId
      );
    }

    if (finalRepairTypeIds.length === 0) {
      throw new Error("At least one repair type is required");
    }

    const finalExistingJewelleryDescription =
      existingJewelleryDescription !== undefined
        ? existingJewelleryDescription.trim()
        : existingOrder.existingJewelleryDescription;

    const finalProblemDescription =
      problemDescription !== undefined
        ? problemDescription.trim()
        : existingOrder.problemDescription;

    if (!finalExistingJewelleryDescription) {
      throw new Error("Existing jewellery description is required");
    }

    if (!finalProblemDescription) {
      throw new Error("Problem / repair description is required");
    }
  }

  // ----------------------------------------------------------
  // NEW MEDIA (OPTIONAL)
  // ----------------------------------------------------------

  const mediaData = files.map((file) => {
    const mediaType = getMediaType(file.mimetype);

    return {
      mediaType,
      mediaContext: getMediaContext(finalOrderType, mediaType),
      fileName: file.originalname,
      fileUrl: getFileUrl(file),
      storageKey: file.filename,
      mimeType: file.mimetype,
      fileSize: file.size,
    };
  });

  // No image validation here.
  // Existing media is preserved when no new media is uploaded.

  // ----------------------------------------------------------
  // PARALLEL DB VERIFICATION
  // ----------------------------------------------------------

  const [branch, metal, category, maker, repairTypes] =
    await Promise.all([
      prisma.branch.findFirst({
        where: { id: finalBranchId, status: true },
      }),

      finalMetalId
        ? prisma.metal.findFirst({
            where: { id: finalMetalId, status: true },
          })
        : null,

      finalCategoryId
        ? prisma.category.findFirst({
            where: { id: finalCategoryId, status: true },
          })
        : null,

      finalMakerId
        ? prisma.maker.findFirst({
            where: { id: finalMakerId, status: true },
          })
        : null,

      finalOrderType === "REPAIR"
        ? prisma.repairType.findMany({
            where: { id: { in: finalRepairTypeIds }, status: true },
          })
        : [],
    ]);

  if (!branch) throw new Error("Active branch not found");
  if (finalMetalId && !metal) throw new Error("Active metal not found");

  if (finalCategoryId && !category) {
    throw new Error("Active category not found");
  }

  if (finalMakerId && !maker) {
    throw new Error("Active maker not found");
  }

  if (
    finalOrderType === "REPAIR" &&
    repairTypes.length !== finalRepairTypeIds.length
  ) {
    throw new Error("One or more repair types are invalid");
  }

  console.log("UPDATE ORDER VALIDATION ms =>", Date.now() - t0);

  // ----------------------------------------------------------
  // TRANSACTION
  // ----------------------------------------------------------

  const updatedOrder = await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id },

      data: {
        branchId: finalBranchId,

        customerName: finalCustomerName,
        customerPhone: finalCustomerPhone,
        customerArea: finalCustomerArea,

        orderType: finalOrderType,

        expectedDeliveryDate: new Date(finalDeliveryDate),

        priority:
          priority === "URGENT"
            ? "URGENT"
            : priority === "NORMAL"
              ? "NORMAL"
              : existingOrder.priority,

        advance:
          advance !== undefined
            ? advance === ""
              ? null
              : Number(advance)
            : existingOrder.advance,

        estimate:
          estimate !== undefined
            ? estimate === ""
              ? null
              : Number(estimate)
            : existingOrder.estimate,

        makerId: finalMakerId,

        metalId: finalMetalId,
        categoryId: finalCategoryId,

        length:
          length !== undefined
            ? length === ""
              ? null
              : Number(length)
            : existingOrder.length,

        lengthUnit: finalLengthUnit,

        size:
          size !== undefined
            ? size === ""
              ? null
              : String(size)
            : existingOrder.size,

        weight:
          weight !== undefined
            ? weight === ""
              ? null
              : Number(weight)
            : existingOrder.weight,

        purity: finalPurity,

        description:
          description !== undefined
            ? description.trim() || null
            : existingOrder.description,

        existingJewelleryDescription:
          existingJewelleryDescription !== undefined
            ? existingJewelleryDescription.trim() || null
            : existingOrder.existingJewelleryDescription,

        problemDescription:
          problemDescription !== undefined
            ? problemDescription.trim() || null
            : existingOrder.problemDescription,

        receivedItemDescription:
          receivedItemDescription !== undefined
            ? receivedItemDescription.trim() || null
            : existingOrder.receivedItemDescription,
      },
    });

    // Repair types
    await tx.orderRepairType.deleteMany({
      where: { orderId: id },
    });

    if (finalOrderType === "REPAIR") {
      await tx.orderRepairType.createMany({
        data: finalRepairTypeIds.map((repairTypeId) => ({
          orderId: id,
          repairTypeId,
        })),
      });
    }

    // New media
    // If no new media is uploaded, existing media remains unchanged.
    if (mediaData.length > 0) {
      await tx.orderMedia.createMany({
        data: mediaData.map((media) => ({
          orderId: id,
          ...media,
        })),
      });
    }

    return await tx.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
  });

  console.log("UPDATE ORDER TOTAL ms =>", Date.now() - t0);

  return updatedOrder;
};

// ============================================================
// DELETE ORDER
// ============================================================

export const deleteOrder = async (orderId) => {
  const id = Number(orderId);

  if (!id || Number.isNaN(id)) {
    throw new Error("Invalid order ID");
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { media: true },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderRepairType.deleteMany({
      where: { orderId: id },
    });

    await tx.orderMedia.deleteMany({
      where: { orderId: id },
    });

    await tx.order.delete({
      where: { id },
    });
  });

  // Delete physical files
  for (const media of order.media) {
    if (!media.storageKey) {
      continue;
    }

    let folder = "";

    if (media.mediaType === "IMAGE") {
      folder = "images";
    } else if (media.mediaType === "VIDEO") {
      folder = "videos";
    } else if (media.mediaType === "AUDIO") {
      folder = "audio";
    }

    if (!folder) {
      continue;
    }

    const filePath = path.resolve("uploads", folder, media.storageKey);

    try {
      await fs.unlink(filePath);
      console.log(`MEDIA DELETED => ${filePath}`);
    } catch (error) {
      console.error(`MEDIA DELETE ERROR => ${filePath}`, error.message);
    }
  }

  return {
    id: order.id,
    orderNumber: order.orderNumber,
  };
};
