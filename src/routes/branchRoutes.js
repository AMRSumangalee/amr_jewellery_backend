import express from "express";

import {
  createBranch,
  getBranches,
  getBranchById,
  updateBranch,
  updateBranchStatus,
} from "../controllers/branchController.js";

import { authenticate } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// =====================================================
// ALL BRANCH APIs REQUIRE LOGIN
// =====================================================

router.use(authenticate);

// =====================================================
// SUPER ADMIN + ADMIN
// =====================================================

router.post(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  createBranch
);

router.put(
  "/:id",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  updateBranch
);

router.patch(
  "/:id/status",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  updateBranchStatus
);

// =====================================================
// SUPER ADMIN + ADMIN + MANAGER
// =====================================================

router.get(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  getBranches
);

router.get(
  "/:id",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  getBranchById
);

export default router;