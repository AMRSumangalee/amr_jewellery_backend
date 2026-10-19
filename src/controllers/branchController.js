import prisma from "../config/database.js";

// =====================================================
// CREATE BRANCH
// =====================================================

export const createBranch = async (req, res) => {
  try {
    const { name, code, address, phone, status } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: "Branch name and code are required",
      });
    }

    const normalizedCode = code.trim().toUpperCase();

    const existingBranch = await prisma.branch.findUnique({
      where: {
        code: normalizedCode,
      },
    });

    if (existingBranch) {
      return res.status(409).json({
        success: false,
        message: "Branch code already exists",
      });
    }

    const branch = await prisma.branch.create({
      data: {
        name: name.trim(),
        code: normalizedCode,
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        status: typeof status === "boolean" ? status : true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Branch created successfully",
      data: branch,
    });
  } catch (error) {
    console.error("CREATE BRANCH ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create branch",
    });
  }
};

// =====================================================
// GET ALL BRANCHES
// =====================================================

export const getBranches = async (req, res) => {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Branches fetched successfully",
      data: branches,
    });
  } catch (error) {
    console.error("GET BRANCHES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch branches",
    });
  }
};

// =====================================================
// GET SINGLE BRANCH
// =====================================================

export const getBranchById = async (req, res) => {
  try {
    const branchId = Number(req.params.id);

    if (Number.isNaN(branchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID",
      });
    }

    const branch = await prisma.branch.findUnique({
      where: {
        id: branchId,
      },
    });

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Branch fetched successfully",
      data: branch,
    });
  } catch (error) {
    console.error("GET BRANCH ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch branch",
    });
  }
};

// =====================================================
// UPDATE BRANCH
// =====================================================

export const updateBranch = async (req, res) => {
  try {
    const branchId = Number(req.params.id);

    if (Number.isNaN(branchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID",
      });
    }

    const { name, code, address, phone, status } = req.body;

    const existingBranch = await prisma.branch.findUnique({
      where: {
        id: branchId,
      },
    });

    if (!existingBranch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    if (code) {
      const duplicateCode = await prisma.branch.findFirst({
        where: {
          code: code.trim().toUpperCase(),
          NOT: {
            id: branchId,
          },
        },
      });

      if (duplicateCode) {
        return res.status(409).json({
          success: false,
          message: "Branch code already exists",
        });
      }
    }

    const branch = await prisma.branch.update({
      where: {
        id: branchId,
      },
      data: {
        ...(name !== undefined && {
          name: name.trim(),
        }),

        ...(code !== undefined && {
          code: code.trim().toUpperCase(),
        }),

        ...(address !== undefined && {
          address: address?.trim() || null,
        }),

        ...(phone !== undefined && {
          phone: phone?.trim() || null,
        }),

        ...(typeof status === "boolean" && {
          status,
        }),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Branch updated successfully",
      data: branch,
    });
  } catch (error) {
    console.error("UPDATE BRANCH ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update branch",
    });
  }
};

// =====================================================
// CHANGE BRANCH STATUS
// =====================================================

export const updateBranchStatus = async (req, res) => {
  try {
    const branchId = Number(req.params.id);
    const { status } = req.body;

    if (Number.isNaN(branchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID",
      });
    }

    if (typeof status !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Status must be true or false",
      });
    }

    const existingBranch = await prisma.branch.findUnique({
      where: {
        id: branchId,
      },
    });

    if (!existingBranch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    const branch = await prisma.branch.update({
      where: {
        id: branchId,
      },
      data: {
        status,
      },
    });

    return res.status(200).json({
      success: true,
      message: status
        ? "Branch activated successfully"
        : "Branch deactivated successfully",
      data: branch,
    });
  } catch (error) {
    console.error("UPDATE BRANCH STATUS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update branch status",
    });
  }
};