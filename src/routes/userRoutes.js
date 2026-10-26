import express from "express";

import {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  updateUserStatus,
  updateUserPassword,
} from "../controllers/userController.js";

import { authenticate } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// All user APIs require authentication
router.use(authenticate);

// Only SUPER_ADMIN can manage users
router.use(authorizeRoles("SUPER_ADMIN"));

router.post("/", createUser);
router.get("/", getUsers);
router.get("/:id", getUserById);
router.put("/:id", updateUser);
router.patch("/:id/status", updateUserStatus);
router.patch("/:id/password", updateUserPassword);

export default router;