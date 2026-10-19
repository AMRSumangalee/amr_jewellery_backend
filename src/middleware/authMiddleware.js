import prisma from "../config/database.js";
import { verifyToken } from "../utils/jwt.js";

const authenticateMiddleware = async (req, res, next) => {
  try {
    // ============================================================
    // AUTHORIZATION HEADER
    // ============================================================

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization header is required",
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization format",
      });
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token is required",
      });
    }

    // ============================================================
    // VERIFY TOKEN
    // ============================================================

    const decoded = verifyToken(token);

    console.log("JWT DECODED =>", decoded);

    // ============================================================
    // SUPPORT EXISTING TOKEN PAYLOAD
    // ============================================================

    const userId =
      decoded.id ??
      decoded.userId ??
      decoded.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    // ============================================================
    // FIND USER
    // ============================================================

    const user = await prisma.user.findUnique({
      where: {
        id: Number(userId),
      },
      select: {
        id: true,
        name: true,
        username: true,
        phone: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // ============================================================
    // USER STATUS
    // ============================================================

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "User account is inactive",
      });
    }

    // ============================================================
    // ATTACH USER
    // ============================================================

    req.user = user;

    next();
  } catch (error) {
    console.error("AUTH MIDDLEWARE ERROR:", error);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};


// ============================================================
// BOTH EXPORTS
// ============================================================

export const authenticate = authenticateMiddleware;

export const authMiddleware = authenticateMiddleware;