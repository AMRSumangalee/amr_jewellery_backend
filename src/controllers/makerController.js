import prisma from "../config/database.js";

// =====================================================
// CREATE MAKER
// =====================================================

export const createMaker = async (req, res) => {
  try {
    const {
      name,
      phone,
      whatsappNumber,
      specialization,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Maker name is required",
      });
    }

    if (whatsappNumber) {
      const existingMaker = await prisma.maker.findFirst({
        where: {
          whatsappNumber: whatsappNumber.trim(),
        },
      });

      if (existingMaker) {
        return res.status(409).json({
          success: false,
          message: "WhatsApp number already exists",
        });
      }
    }

    const maker = await prisma.maker.create({
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        whatsappNumber: whatsappNumber?.trim() || null,
        specialization: specialization?.trim() || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Maker created successfully",
      data: maker,
    });
  } catch (error) {
    console.error("CREATE MAKER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create maker",
    });
  }
};

// =====================================================
// GET ALL MAKERS
// =====================================================

export const getMakers = async (req, res) => {
  try {
    const makers = await prisma.maker.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Makers fetched successfully",
      data: makers,
    });
  } catch (error) {
    console.error("GET MAKERS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch makers",
    });
  }
};

// =====================================================
// GET MAKER BY ID
// =====================================================

export const getMakerById = async (req, res) => {
  try {
    const makerId = Number(req.params.id);

    if (Number.isNaN(makerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid maker ID",
      });
    }

    const maker = await prisma.maker.findUnique({
      where: {
        id: makerId,
      },
    });

    if (!maker) {
      return res.status(404).json({
        success: false,
        message: "Maker not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Maker fetched successfully",
      data: maker,
    });
  } catch (error) {
    console.error("GET MAKER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch maker",
    });
  }
};

// =====================================================
// UPDATE MAKER
// =====================================================

export const updateMaker = async (req, res) => {
  try {
    const makerId = Number(req.params.id);

    if (Number.isNaN(makerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid maker ID",
      });
    }

    const {
      name,
      phone,
      whatsappNumber,
      specialization,
    } = req.body;

    const existingMaker = await prisma.maker.findUnique({
      where: {
        id: makerId,
      },
    });

    if (!existingMaker) {
      return res.status(404).json({
        success: false,
        message: "Maker not found",
      });
    }

    if (whatsappNumber !== undefined && whatsappNumber) {
      const duplicateMaker = await prisma.maker.findFirst({
        where: {
          whatsappNumber: whatsappNumber.trim(),
          NOT: {
            id: makerId,
          },
        },
      });

      if (duplicateMaker) {
        return res.status(409).json({
          success: false,
          message: "WhatsApp number already exists",
        });
      }
    }

    const maker = await prisma.maker.update({
      where: {
        id: makerId,
      },

      data: {
        ...(name !== undefined && {
          name: name.trim(),
        }),

        ...(phone !== undefined && {
          phone: phone?.trim() || null,
        }),

        ...(whatsappNumber !== undefined && {
          whatsappNumber: whatsappNumber?.trim() || null,
        }),

        ...(specialization !== undefined && {
          specialization: specialization?.trim() || null,
        }),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Maker updated successfully",
      data: maker,
    });
  } catch (error) {
    console.error("UPDATE MAKER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update maker",
    });
  }
};

// =====================================================
// CHANGE MAKER STATUS
// =====================================================

export const updateMakerStatus = async (req, res) => {
  try {
    const makerId = Number(req.params.id);
    const { status } = req.body;

    if (Number.isNaN(makerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid maker ID",
      });
    }

    if (typeof status !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Status must be true or false",
      });
    }

    const existingMaker = await prisma.maker.findUnique({
      where: {
        id: makerId,
      },
    });

    if (!existingMaker) {
      return res.status(404).json({
        success: false,
        message: "Maker not found",
      });
    }

    const maker = await prisma.maker.update({
      where: {
        id: makerId,
      },

      data: {
        status,
      },
    });

    return res.status(200).json({
      success: true,
      message: status
        ? "Maker activated successfully"
        : "Maker deactivated successfully",
      data: maker,
    });
  } catch (error) {
    console.error("UPDATE MAKER STATUS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update maker status",
    });
  }
};