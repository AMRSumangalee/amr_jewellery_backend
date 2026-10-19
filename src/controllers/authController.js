import prisma from "../config/database.js";
import { comparePassword } from "../utils/password.js";
import { generateToken } from "../utils/jwt.js";
import { successResponse, errorResponse } from "../utils/response.js";

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return errorResponse(
        res,
        "Username and password are required",
        400
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        username,
      },
    });

    if (!user) {
      return errorResponse(res, "Invalid username or password", 401);
    }

    if (user.status !== "ACTIVE") {
      return errorResponse(res, "User account is inactive", 403);
    }

    const isPasswordValid = await comparePassword(
      password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      return errorResponse(res, "Invalid username or password", 401);
    }

    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    return successResponse(res, "Login successful", {
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        phone: user.phone,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return errorResponse(
      res,
      "Login failed",
      500,
      error
    );
  }
};