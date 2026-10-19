import express from "express";

import {
  createMetal,
  getMetals,
  getMetalById,
  updateMetal,
  updateMetalStatus,
} from "../controllers/metalController.js";

import { authenticate } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// =====================================================
// ALL METAL APIs REQUIRE LOGIN
// =====================================================

router.use(authenticate);

// =====================================================
// VIEW
// SUPER_ADMIN + ADMIN + MANAGER
// =====================================================

router.get(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  getMetals
);

router.get(
  "/:id",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  getMetalById
);

// =====================================================
// CREATE / UPDATE / STATUS
// SUPER_ADMIN + ADMIN
// =====================================================

router.post(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  createMetal
);

router.put(
  "/:id",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  updateMetal
);

router.patch(
  "/:id/status",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  updateMetalStatus
);

export default router;