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
    "K18": "K18",
    "22K": "K22",
    "K22": "K22",
    "24K": "K24",
    "K24": "K24",
  };

  if (!purityMap[purity]) {
    throw new Error("Purity must be 18K, 22K or 24K");
  }

  return purityMap[purity];
};

const getMediaType = (mimeType) => {
  const mime = mimeType?.toLowerCase() || "";

  if (mime.startsWith("image/")) {
    return "IMAGE";
  }

  if (mime.startsWith("video/")) {
    return "VIDEO";
  }

  if (mime.startsWith("audio/")) {
    return "AUDIO";
  }

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

// Used by the controller to remove uploaded files when a request fails
export const cleanupUploadedFiles = async (files = []) => {
  for (const file of files) {
    try {
      await fs.unlink(file.path);
    } catch (error) {
      console.error(
        "FILE CLEANUP ERROR:",
        file.path,
        error.message
      );
    }
  }
};

// ============================================================
// CREATE ORDER
// ============================================================

export const createOrder = async (data, files = []) => {
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

  // ==========================================================
  // BASIC VALIDATION
  // ==========================================================

  if (!branchId) {
    throw new Error("Branch is required");
  }

  if (!customerName?.trim()) {
    throw new Error("Customer name is required");
  }

  if (!customerPhone?.trim()) {
    throw new Error("Customer phone is required");
  }

  if (!customerArea?.trim()) {
    throw new Error("Customer area is required");
  }

  if (!orderType) {
    throw new Error("Order type is required");
  }

  if (!["NEW", "REPAIR"].includes(orderType)) {
    throw new Error("Invalid order type");
  }

  if (!expectedDeliveryDate) {
    throw new Error("Expected delivery date is required");
  }

  // ==========================================================
  // MEDIA VALIDATION
  // ==========================================================

  if (!files || files.length === 0) {
    throw new Error(
      orderType === "NEW"
        ? "At least one image is required for new order"
        : "At least one before-repair image is required for repair order"
    );
  }

  const imageFiles = files.filter((file) =>
    file.mimetype?.toLowerCase().startsWith("image/")
  );

  if (imageFiles.length === 0) {
    throw new Error(
      orderType === "NEW"
        ? "At least one image is required for new order"
        : "At least one before-repair image is required for repair order"
    );
  }

  // ==========================================================
  // NEW ORDER VALIDATION
  // ==========================================================

  if (orderType === "NEW") {
    if (!metalId) {
      throw new Error("Metal is required for new order");
    }

    if (!categoryId) {
      throw new Error("Category is required for new order");
    }
  }

  // ==========================================================
  // REPAIR ORDER VALIDATION
  // ==========================================================

  if (orderType === "REPAIR") {
    if (
      !Array.isArray(repairTypeIds) ||
      repairTypeIds.length === 0
    ) {
      throw new Error(
        "At least one repair type is required"
      );
    }

    if (!existingJewelleryDescription?.trim()) {
      throw new Error(
        "Existing jewellery description is required"
      );
    }

    if (!problemDescription?.trim()) {
      throw new Error(
        "Problem / repair description is required"
      );
    }
  }

  // ==========================================================
  // NORMALIZE ENUM VALUES (validates before DB work)
  // ==========================================================

  const finalLengthUnit = normalizeLengthUnit(lengthUnit);
  const finalPurity = normalizePurity(purity);

  // ==========================================================
  // VERIFY BRANCH
  // ==========================================================

  const branch = await prisma.branch.findFirst({
    where: {
      id: Number(branchId),
      status: true,
    },
  });

  if (!branch) {
    throw new Error("Active branch not found");
  }

  // ==========================================================
  // VERIFY METAL
  // ==========================================================

  let metal = null;

  if (metalId) {
    metal = await prisma.metal.findFirst({
      where: {
        id: Number(metalId),
        status: true,
      },
    });

    if (!metal) {
      throw new Error("Active metal not found");
    }
  }

  // ==========================================================
  // VERIFY CATEGORY
  // ==========================================================

  let category = null;

  if (categoryId) {
    category = await prisma.category.findFirst({
      where: {
        id: Number(categoryId),
        status: true,
      },
    });

    if (!category) {
      throw new Error("Active category not found");
    }
  }

  // ==========================================================
  // VERIFY MAKER
  // ==========================================================

  let maker = null;

  if (makerId) {
    maker = await prisma.maker.findFirst({
      where: {
        id: Number(makerId),
        status: true,
      },
    });

    if (!maker) {
      throw new Error("Active maker not found");
    }
  }

  // ==========================================================
  // VERIFY REPAIR TYPES
  // ==========================================================

  let repairTypes = [];

  if (orderType === "REPAIR") {
    const uniqueRepairTypeIds = [
      ...new Set(
        repairTypeIds.map((id) => Number(id))
      ),
    ];

    repairTypes = await prisma.repairType.findMany({
      where: {
        id: {
          in: uniqueRepairTypeIds,
        },
        status: true,
      },
    });

    if (
      repairTypes.length !==
      uniqueRepairTypeIds.length
    ) {
      throw new Error(
        "One or more repair types are invalid"
      );
    }
  }

  // ==========================================================
  // ORDER NUMBER
  // ==========================================================

  const orderNumber = await generateOrderNumber();

  // ==========================================================
  // PREPARE MEDIA
  // ==========================================================

  const mediaData = files.map((file) => {
    const mediaType = getMediaType(file.mimetype);

    const mediaContext = getMediaContext(
      orderType,
      mediaType
    );

    return {
      mediaType,
      mediaContext,

      fileName: file.originalname,

      fileUrl: getFileUrl(file),

      storageKey: file.filename,

      mimeType: file.mimetype,

      fileSize: file.size,
    };
  });

  // ==========================================================
  // DATABASE TRANSACTION
  // (file cleanup on failure is handled by the controller)
  // ==========================================================

  const order = await prisma.$transaction(async (tx) => {
    return await tx.order.create({
      data: {
        orderNumber,

        branchId: Number(branchId),

        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerArea: customerArea.trim(),

        orderType,

        expectedDeliveryDate: new Date(expectedDeliveryDate),

        priority: priority === "URGENT" ? "URGENT" : "NORMAL",

        advance:
          advance !== undefined &&
            advance !== null &&
            advance !== ""
            ? Number(advance)
            : null,

        estimate:
          estimate !== undefined &&
            estimate !== null &&
            estimate !== ""
            ? Number(estimate)
            : null,

        makerId: makerId ? Number(makerId) : null,

        status: "NEW",

        metalId: metalId ? Number(metalId) : null,

        categoryId: categoryId ? Number(categoryId) : null,

        length:
          length !== undefined &&
            length !== null &&
            length !== ""
            ? Number(length)
            : null,

        lengthUnit: finalLengthUnit,

        size:
          size !== undefined &&
            size !== null &&
            size !== ""
            ? String(size)
            : null,

        weight:
          weight !== undefined &&
            weight !== null &&
            weight !== ""
            ? Number(weight)
            : null,

        purity: finalPurity,

        description: description?.trim() || null,

        existingJewelleryDescription:
          existingJewelleryDescription?.trim() || null,

        problemDescription:
          problemDescription?.trim() || null,

        receivedItemDescription:
          receivedItemDescription?.trim() || null,

        // ------------------------------------------------------
        // MEDIA
        // ------------------------------------------------------

        media: {
          create: mediaData,
        },

        // ------------------------------------------------------
        // REPAIR TYPES
        // ------------------------------------------------------

        repairTypes:
          orderType === "REPAIR"
            ? {
              create: repairTypes.map((repairType) => ({
                repairTypeId: repairType.id,
              })),
            }
            : undefined,
      },

      include: {
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
      },
    });
  });

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
}) => {
  const currentPage = Math.max(Number(page) || 1, 1);
  const currentLimit = Math.min(
    Math.max(Number(limit) || 10, 1),
    100
  );

  const skip = (currentPage - 1) * currentLimit;

  // ==========================================================
  // WHERE CONDITION
  // ==========================================================

  const where = {};

  // Order Type
  if (orderType) {
    if (!["NEW", "REPAIR"].includes(orderType)) {
      throw new Error("Invalid order type");
    }

    where.orderType = orderType;
  }

  // Status
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

  // Branch
  if (branchId) {
    where.branchId = Number(branchId);
  }

  // Priority
  if (priority) {
    if (!["NORMAL", "URGENT"].includes(priority)) {
      throw new Error("Invalid priority");
    }

    where.priority = priority;
  }

  // Search
  if (search?.trim()) {
    const searchText = search.trim();

    where.OR = [
      {
        orderNumber: {
          contains: searchText,
        },
      },
      {
        customerName: {
          contains: searchText,
        },
      },
      {
        customerPhone: {
          contains: searchText,
        },
      },
      {
        customerArea: {
          contains: searchText,
        },
      },
    ];
  }

  // ==========================================================
  // FETCH DATA + TOTAL
  // ==========================================================

  const [orders, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,

      skip,
      take: currentLimit,

      orderBy: {
        id: "desc",
      },

      include: {
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
      },
    }),

    prisma.order.count({
      where,
    }),
  ]);

  // ==========================================================
  // PAGINATION
  // ==========================================================

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
    where: {
      id,
    },

    include: {
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
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  return order;
};

// ============================================================
// UPDATE ORDER
// ============================================================

export const updateOrder = async (
  orderId,
  data,
  files = []
) => {
  const id = Number(orderId);

  if (!id || Number.isNaN(id)) {
    throw new Error("Invalid order ID");
  }

  // ==========================================================
  // FIND EXISTING ORDER
  // ==========================================================

  const existingOrder = await prisma.order.findUnique({
    where: {
      id,
    },
    include: {
      media: true,
      repairTypes: true,
    },
  });

  if (!existingOrder) {
    throw new Error("Order not found");
  }

  // ==========================================================
  // GET DATA
  // ==========================================================

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

  // ==========================================================
  // BASIC VALIDATION
  // ==========================================================

  const finalOrderType = orderType || existingOrder.orderType;

  if (!["NEW", "REPAIR"].includes(finalOrderType)) {
    throw new Error("Invalid order type");
  }

  const finalBranchId =
    branchId !== undefined
      ? Number(branchId)
      : existingOrder.branchId;

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

  if (!finalBranchId) {
    throw new Error("Branch is required");
  }

  if (!finalCustomerName) {
    throw new Error("Customer name is required");
  }

  if (!finalCustomerPhone) {
    throw new Error("Customer phone is required");
  }

  if (!finalCustomerArea) {
    throw new Error("Customer area is required");
  }

  if (!finalDeliveryDate) {
    throw new Error("Expected delivery date is required");
  }

  // ==========================================================
  // NORMALIZE ENUM VALUES
  // ==========================================================

  const finalLengthUnit =
    lengthUnit !== undefined
      ? normalizeLengthUnit(lengthUnit)
      : existingOrder.lengthUnit;

  const finalPurity =
    purity !== undefined
      ? normalizePurity(purity)
      : existingOrder.purity;

  // ==========================================================
  // VERIFY BRANCH
  // ==========================================================

  const branch = await prisma.branch.findFirst({
    where: {
      id: finalBranchId,
      status: true,
    },
  });

  if (!branch) {
    throw new Error("Active branch not found");
  }

  // ==========================================================
  // FINAL METAL / CATEGORY
  // ==========================================================

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

  // ==========================================================
  // NEW ORDER VALIDATION
  // ==========================================================

  if (finalOrderType === "NEW") {
    if (!finalMetalId) {
      throw new Error("Metal is required for new order");
    }

    if (!finalCategoryId) {
      throw new Error("Category is required for new order");
    }
  }

  // ==========================================================
  // VERIFY METAL
  // ==========================================================

  let metal = null;

  if (finalMetalId) {
    metal = await prisma.metal.findFirst({
      where: {
        id: finalMetalId,
        status: true,
      },
    });

    if (!metal) {
      throw new Error("Active metal not found");
    }
  }

  // ==========================================================
  // VERIFY CATEGORY
  // ==========================================================

  let category = null;

  if (finalCategoryId) {
    category = await prisma.category.findFirst({
      where: {
        id: finalCategoryId,
        status: true,
      },
    });

    if (!category) {
      throw new Error("Active category not found");
    }
  }

  // ==========================================================
  // MAKER
  // ==========================================================

  const finalMakerId =
    makerId !== undefined
      ? makerId
        ? Number(makerId)
        : null
      : existingOrder.makerId;

  let maker = null;

  if (finalMakerId) {
    maker = await prisma.maker.findFirst({
      where: {
        id: finalMakerId,
        status: true,
      },
    });

    if (!maker) {
      throw new Error("Active maker not found");
    }
  }

  // ==========================================================
  // REPAIR VALIDATION
  // ==========================================================

  let finalRepairTypeIds = [];

  if (finalOrderType === "REPAIR") {
    if (repairTypeIds !== undefined) {
      if (
        !Array.isArray(repairTypeIds) ||
        repairTypeIds.length === 0
      ) {
        throw new Error(
          "At least one repair type is required"
        );
      }

      finalRepairTypeIds = [
        ...new Set(
          repairTypeIds.map((item) => Number(item))
        ),
      ];
    } else {
      finalRepairTypeIds = existingOrder.repairTypes.map(
        (item) => item.repairTypeId
      );
    }

    if (finalRepairTypeIds.length === 0) {
      throw new Error(
        "At least one repair type is required"
      );
    }

    const repairTypes = await prisma.repairType.findMany({
      where: {
        id: {
          in: finalRepairTypeIds,
        },
        status: true,
      },
    });

    if (repairTypes.length !== finalRepairTypeIds.length) {
      throw new Error(
        "One or more repair types are invalid"
      );
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
      throw new Error(
        "Existing jewellery description is required"
      );
    }

    if (!finalProblemDescription) {
      throw new Error(
        "Problem / repair description is required"
      );
    }
  }

  // ==========================================================
  // NEW MEDIA
  // ==========================================================

  const mediaData = files.map((file) => {
    const mediaType = getMediaType(file.mimetype);

    const mediaContext = getMediaContext(
      finalOrderType,
      mediaType
    );

    return {
      mediaType,
      mediaContext,
      fileName: file.originalname,
      fileUrl: getFileUrl(file),
      storageKey: file.filename,
      mimeType: file.mimetype,
      fileSize: file.size,
    };
  });

  // ==========================================================
  // MEDIA VALIDATION
  // ==========================================================

  const newImageFiles = files.filter((file) =>
    file.mimetype?.toLowerCase().startsWith("image/")
  );

  const existingImageCount = existingOrder.media.filter(
    (media) => media.mediaType === "IMAGE"
  ).length;

  const finalImageCount =
    existingImageCount + newImageFiles.length;

  if (finalImageCount === 0) {
    throw new Error(
      finalOrderType === "NEW"
        ? "At least one image is required for new order"
        : "At least one before-repair image is required for repair order"
    );
  }

  // ==========================================================
  // TRANSACTION
  // (file cleanup on failure is handled by the controller)
  // ==========================================================

  const updatedOrder = await prisma.$transaction(
    async (tx) => {
      // --------------------------------------------------
      // UPDATE ORDER
      // --------------------------------------------------

      await tx.order.update({
        where: {
          id,
        },

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

      // --------------------------------------------------
      // REPAIR TYPES
      // --------------------------------------------------

      await tx.orderRepairType.deleteMany({
        where: {
          orderId: id,
        },
      });

      if (finalOrderType === "REPAIR") {
        await tx.orderRepairType.createMany({
          data: finalRepairTypeIds.map((repairTypeId) => ({
            orderId: id,
            repairTypeId,
          })),
        });
      }

      // --------------------------------------------------
      // ADD NEW MEDIA
      // --------------------------------------------------

      if (mediaData.length > 0) {
        await tx.orderMedia.createMany({
          data: mediaData.map((media) => ({
            orderId: id,
            ...media,
          })),
        });
      }

      // --------------------------------------------------
      // FETCH UPDATED ORDER
      // --------------------------------------------------

      return await tx.order.findUnique({
        where: {
          id,
        },

        include: {
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
        },
      });
    }
  );

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

  // ==========================================================
  // FIND ORDER
  // ==========================================================

  const order = await prisma.order.findUnique({
    where: {
      id,
    },

    include: {
      media: true,
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  // ==========================================================
  // DELETE DATABASE RECORDS
  // ==========================================================

  await prisma.$transaction(async (tx) => {
    // Delete repair type mappings
    await tx.orderRepairType.deleteMany({
      where: {
        orderId: id,
      },
    });

    // Delete media records
    await tx.orderMedia.deleteMany({
      where: {
        orderId: id,
      },
    });

    // Delete order
    await tx.order.delete({
      where: {
        id,
      },
    });
  });

  // ==========================================================
  // DELETE PHYSICAL MEDIA FILES
  // ==========================================================

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

    const filePath = path.resolve(
      "uploads",
      folder,
      media.storageKey
    );

    try {
      await fs.unlink(filePath);

      console.log(`MEDIA DELETED => ${filePath}`);
    } catch (error) {
      // If the file is already missing, the DB delete
      // is still considered successful.
      console.error(
        `MEDIA DELETE ERROR => ${filePath}`,
        error.message
      );
    }
  }

  return {
    id: order.id,
    orderNumber: order.orderNumber,
  };
};