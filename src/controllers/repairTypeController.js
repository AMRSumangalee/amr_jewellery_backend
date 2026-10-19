import prisma from "../config/database.js";

// =====================================================
// CREATE REPAIR TYPE
// =====================================================

export const createRepairType = async (req, res) => {
  try {
    const { name, code } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: "Repair type name and code are required",
      });
    }

    const normalizedName = name.trim();
    const normalizedCode = code.trim().toUpperCase();

    const existingRepairType = await prisma.repairType.findUnique({
      where: {
        code: normalizedCode,
      },
    });

    if (existingRepairType) {
      return res.status(409).json({
        success: false,
        message: "Repair type code already exists",
      });
    }

    const repairType = await prisma.repairType.create({
      data: {
        name: normalizedName,
        code: normalizedCode,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Repair type created successfully",
      data: repairType,
    });
  } catch (error) {
    console.error("CREATE REPAIR TYPE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create repair type",
    });
  }
};

// =====================================================
// GET ALL REPAIR TYPES
// =====================================================

export const getRepairTypes = async (req, res) => {
  try {
    const repairTypes = await prisma.repairType.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Repair types fetched successfully",
      data: repairTypes,
    });
  } catch (error) {
    console.error("GET REPAIR TYPES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch repair types",
    });
  }
};

// =====================================================
// GET REPAIR TYPE BY ID
// =====================================================

export const getRepairTypeById = async (req, res) => {
  try {
    const repairTypeId = Number(req.params.id);

    if (Number.isNaN(repairTypeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid repair type ID",
      });
    }

    const repairType = await prisma.repairType.findUnique({
      where: {
        id: repairTypeId,
      },
    });

    if (!repairType) {
      return res.status(404).json({
        success: false,
        message: "Repair type not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Repair type fetched successfully",
      data: repairType,
    });
  } catch (error) {
    console.error("GET REPAIR TYPE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch repair type",
    });
  }
};

// =====================================================
// UPDATE REPAIR TYPE
// =====================================================

export const updateRepairType = async (req, res) => {
  try {
    const repairTypeId = Number(req.params.id);

    if (Number.isNaN(repairTypeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid repair type ID",
      });
    }

    const { name, code } = req.body;

    const existingRepairType = await prisma.repairType.findUnique({
      where: {
        id: repairTypeId,
      },
    });

    if (!existingRepairType) {
      return res.status(404).json({
        success: false,
        message: "Repair type not found",
      });
    }

    if (code !== undefined) {
      const normalizedCode = code.trim().toUpperCase();

      const duplicateRepairType = await prisma.repairType.findFirst({
        where: {
          code: normalizedCode,
          NOT: {
            id: repairTypeId,
          },
        },
      });

      if (duplicateRepairType) {
        return res.status(409).json({
          success: false,
          message: "Repair type code already exists",
        });
      }
    }

    const repairType = await prisma.repairType.update({
      where: {
        id: repairTypeId,
      },

      data: {
        ...(name !== undefined && {
          name: name.trim(),
        }),

        ...(code !== undefined && {
          code: code.trim().toUpperCase(),
        }),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Repair type updated successfully",
      data: repairType,
    });
  } catch (error) {
    console.error("UPDATE REPAIR TYPE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update repair type",
    });
  }
};

// =====================================================
// CHANGE REPAIR TYPE STATUS
// =====================================================

export const updateRepairTypeStatus = async (req, res) => {
  try {
    const repairTypeId = Number(req.params.id);
    const { status } = req.body;

    if (Number.isNaN(repairTypeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid repair type ID",
      });
    }

    if (typeof status !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Status must be true or false",
      });
    }

    const existingRepairType = await prisma.repairType.findUnique({
      where: {
        id: repairTypeId,
      },
    });

    if (!existingRepairType) {
      return res.status(404).json({
        success: false,
        message: "Repair type not found",
      });
    }

    const repairType = await prisma.repairType.update({
      where: {
        id: repairTypeId,
      },

      data: {
        status,
      },
    });

    return res.status(200).json({
      success: true,
      message: status
        ? "Repair type activated successfully"
        : "Repair type deactivated successfully",
      data: repairType,
    });
  } catch (error) {
    console.error("UPDATE REPAIR TYPE STATUS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update repair type status",
    });
  }
};