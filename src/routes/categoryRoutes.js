import express from "express";

import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  updateCategoryStatus,
} from "../controllers/categoryController.js";

import { authenticate } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(authenticate);

// =====================================================
// VIEW
// SUPER_ADMIN + ADMIN + MANAGER
// =====================================================

router.get(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  getCategories
);

router.get(
  "/:id",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  getCategoryById
);

// =====================================================
// CREATE / UPDATE / STATUS
// SUPER_ADMIN + ADMIN
// =====================================================

router.post(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  createCategory
);

router.put(
  "/:id",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  updateCategory
);

router.patch(
  "/:id/status",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  updateCategoryStatus
);

export default router;