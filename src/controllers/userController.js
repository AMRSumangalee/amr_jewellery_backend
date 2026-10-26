import prisma from "../config/database.js";
import {
  hashPassword,
  comparePassword,
} from "../utils/password.js";

// =====================================================
// CREATE USER
// =====================================================

export const createUser = async (req, res) => {
  try {
    const {
      name,
      username,
      phone,
      password,
      role,
    } = req.body;

    if (!name || !username || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Name, username, password and role are required",
      });
    }

    const allowedRoles = [
      "ADMIN",
      "MANAGER",
    ];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    const existingUsername = await prisma.user.findUnique({
      where: {
        username,
      },
    });

    if (existingUsername) {
      return res.status(409).json({
        success: false,
        message: "Username already exists",
      });
    }

    if (phone) {
      const existingPhone = await prisma.user.findUnique({
        where: {
          phone,
        },
      });

      if (existingPhone) {
        return res.status(409).json({
          success: false,
          message: "Phone number already exists",
        });
      }
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        username: username.trim(),
        phone: phone?.trim() || null,
        passwordHash,
        role,
        status: "ACTIVE",
      },

      select: {
        id: true,
        name: true,
        username: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user,
    });
  } catch (error) {
    console.error("CREATE USER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create user",
    });
  }
};

// =====================================================
// GET ALL USERS
// =====================================================

export const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: {
          in: ["ADMIN", "MANAGER"],
        },
      },

      select: {
        id: true,
        name: true,
        username: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: users,
    });
  } catch (error) {
    console.error("GET USERS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

// =====================================================
// GET USER BY ID
// =====================================================

export const getUserById = async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (Number.isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        role: {
          in: ["ADMIN", "MANAGER"],
        },
      },

      select: {
        id: true,
        name: true,
        username: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User fetched successfully",
      data: user,
    });
  } catch (error) {
    console.error("GET USER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch user",
    });
  }
};

// =====================================================
// UPDATE USER
// =====================================================

export const updateUser = async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (Number.isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const {
      name,
      username,
      phone,
      role,
    } = req.body;

    const existingUser = await prisma.user.findFirst({
      where: {
        id: userId,
        role: {
          in: ["ADMIN", "MANAGER"],
        },
      },
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (role && !["ADMIN", "MANAGER"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    if (username) {
      const duplicateUsername = await prisma.user.findFirst({
        where: {
          username: username.trim(),
          NOT: {
            id: userId,
          },
        },
      });

      if (duplicateUsername) {
        return res.status(409).json({
          success: false,
          message: "Username already exists",
        });
      }
    }

    if (phone) {
      const duplicatePhone = await prisma.user.findFirst({
        where: {
          phone: phone.trim(),
          NOT: {
            id: userId,
          },
        },
      });

      if (duplicatePhone) {
        return res.status(409).json({
          success: false,
          message: "Phone number already exists",
        });
      }
    }

    const user = await prisma.user.update({
      where: {
        id: userId,
      },

      data: {
        ...(name !== undefined && {
          name: name.trim(),
        }),

        ...(username !== undefined && {
          username: username.trim(),
        }),

        ...(phone !== undefined && {
          phone: phone?.trim() || null,
        }),

        ...(role !== undefined && {
          role,
        }),
      },

      select: {
        id: true,
        name: true,
        username: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    console.error("UPDATE USER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update user",
    });
  }
};

// =====================================================
// CHANGE USER STATUS
// =====================================================

export const updateUserStatus = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { status } = req.body;

    if (Number.isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    if (!["ACTIVE", "INACTIVE"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be ACTIVE or INACTIVE",
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        id: userId,
        role: {
          in: ["ADMIN", "MANAGER"],
        },
      },
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = await prisma.user.update({
      where: {
        id: userId,
      },

      data: {
        status,
      },

      select: {
        id: true,
        name: true,
        username: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      message:
        status === "ACTIVE"
          ? "User activated successfully"
          : "User deactivated successfully",
      data: user,
    });
  } catch (error) {
    console.error("UPDATE USER STATUS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update user status",
    });
  }
};



export const updateUserPassword = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { newPassword } = req.body;

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    if (
      typeof newPassword !== "string" ||
      newPassword.length < 8
    ) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        role: {
          in: ["ADMIN", "MANAGER"],
        },
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("UPDATE USER PASSWORD ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update password",
    });
  }
};
