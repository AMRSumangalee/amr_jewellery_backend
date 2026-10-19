import prisma from "../config/database.js";

// =====================================================
// CREATE METAL
// =====================================================

export const createMetal = async (req, res) => {
  try {
    const { name, code } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: "Metal name and code are required",
      });
    }

    const normalizedName = name.trim();
    const normalizedCode = code.trim().toUpperCase();

    const existingMetal = await prisma.metal.findUnique({
      where: {
        code: normalizedCode,
      },
    });

    if (existingMetal) {
      return res.status(409).json({
        success: false,
        message: "Metal code already exists",
      });
    }

    const metal = await prisma.metal.create({
      data: {
        name: normalizedName,
        code: normalizedCode,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Metal created successfully",
      data: metal,
    });
  } catch (error) {
    console.error("CREATE METAL ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create metal",
    });
  }
};

// =====================================================
// GET ALL METALS
// =====================================================

export const getMetals = async (req, res) => {
  try {
    const metals = await prisma.metal.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Metals fetched successfully",
      data: metals,
    });
  } catch (error) {
    console.error("GET METALS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch metals",
    });
  }
};

// =====================================================
// GET METAL BY ID
// =====================================================

export const getMetalById = async (req, res) => {
  try {
    const metalId = Number(req.params.id);

    if (Number.isNaN(metalId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid metal ID",
      });
    }

    const metal = await prisma.metal.findUnique({
      where: {
        id: metalId,
      },
    });

    if (!metal) {
      return res.status(404).json({
        success: false,
        message: "Metal not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Metal fetched successfully",
      data: metal,
    });
  } catch (error) {
    console.error("GET METAL ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch metal",
    });
  }
};

// =====================================================
// UPDATE METAL
// =====================================================

export const updateMetal = async (req, res) => {
  try {
    const metalId = Number(req.params.id);

    if (Number.isNaN(metalId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid metal ID",
      });
    }

    const { name, code } = req.body;

    const existingMetal = await prisma.metal.findUnique({
      where: {
        id: metalId,
      },
    });

    if (!existingMetal) {
      return res.status(404).json({
        success: false,
        message: "Metal not found",
      });
    }

    if (code !== undefined) {
      const normalizedCode = code.trim().toUpperCase();

      const duplicateMetal = await prisma.metal.findFirst({
        where: {
          code: normalizedCode,
          NOT: {
            id: metalId,
          },
        },
      });

      if (duplicateMetal) {
        return res.status(409).json({
          success: false,
          message: "Metal code already exists",
        });
      }
    }

    const metal = await prisma.metal.update({
      where: {
        id: metalId,
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
      message: "Metal updated successfully",
      data: metal,
    });
  } catch (error) {
    console.error("UPDATE METAL ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update metal",
    });
  }
};

// =====================================================
// CHANGE METAL STATUS
// =====================================================

export const updateMetalStatus = async (req, res) => {
  try {
    const metalId = Number(req.params.id);
    const { status } = req.body;

    if (Number.isNaN(metalId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid metal ID",
      });
    }

    if (typeof status !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Status must be true or false",
      });
    }

    const existingMetal = await prisma.metal.findUnique({
      where: {
        id: metalId,
      },
    });

    if (!existingMetal) {
      return res.status(404).json({
        success: false,
        message: "Metal not found",
      });
    }

    const metal = await prisma.metal.update({
      where: {
        id: metalId,
      },

      data: {
        status,
      },
    });

    return res.status(200).json({
      success: true,
      message:
        status
          ? "Metal activated successfully"
          : "Metal deactivated successfully",
      data: metal,
    });
  } catch (error) {
    console.error("UPDATE METAL STATUS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update metal status",
    });
  }
};