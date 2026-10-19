import prisma from "../config/database.js";

// =====================================================
// CREATE CATEGORY
// =====================================================

export const createCategory = async (req, res) => {
  try {
    const { name, code } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: "Category name and code are required",
      });
    }

    const normalizedName = name.trim();
    const normalizedCode = code.trim().toUpperCase();

    const existingCategory = await prisma.category.findUnique({
      where: {
        code: normalizedCode,
      },
    });

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message: "Category code already exists",
      });
    }

    const category = await prisma.category.create({
      data: {
        name: normalizedName,
        code: normalizedCode,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    console.error("CREATE CATEGORY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create category",
    });
  }
};

// =====================================================
// GET ALL CATEGORIES
// =====================================================

export const getCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Categories fetched successfully",
      data: categories,
    });
  } catch (error) {
    console.error("GET CATEGORIES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
    });
  }
};

// =====================================================
// GET CATEGORY BY ID
// =====================================================

export const getCategoryById = async (req, res) => {
  try {
    const categoryId = Number(req.params.id);

    if (Number.isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const category = await prisma.category.findUnique({
      where: {
        id: categoryId,
      },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category fetched successfully",
      data: category,
    });
  } catch (error) {
    console.error("GET CATEGORY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch category",
    });
  }
};

// =====================================================
// UPDATE CATEGORY
// =====================================================

export const updateCategory = async (req, res) => {
  try {
    const categoryId = Number(req.params.id);

    if (Number.isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const { name, code } = req.body;

    const existingCategory = await prisma.category.findUnique({
      where: {
        id: categoryId,
      },
    });

    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    if (code !== undefined) {
      const normalizedCode = code.trim().toUpperCase();

      const duplicateCategory = await prisma.category.findFirst({
        where: {
          code: normalizedCode,
          NOT: {
            id: categoryId,
          },
        },
      });

      if (duplicateCategory) {
        return res.status(409).json({
          success: false,
          message: "Category code already exists",
        });
      }
    }

    const category = await prisma.category.update({
      where: {
        id: categoryId,
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
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    console.error("UPDATE CATEGORY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update category",
    });
  }
};

// =====================================================
// CHANGE CATEGORY STATUS
// =====================================================

export const updateCategoryStatus = async (req, res) => {
  try {
    const categoryId = Number(req.params.id);
    const { status } = req.body;

    if (Number.isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    if (typeof status !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Status must be true or false",
      });
    }

    const existingCategory = await prisma.category.findUnique({
      where: {
        id: categoryId,
      },
    });

    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const category = await prisma.category.update({
      where: {
        id: categoryId,
      },

      data: {
        status,
      },
    });

    return res.status(200).json({
      success: true,
      message: status
        ? "Category activated successfully"
        : "Category deactivated successfully",
      data: category,
    });
  } catch (error) {
    console.error("UPDATE CATEGORY STATUS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update category status",
    });
  }
};