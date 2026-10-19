import express from "express";

import {
  createMaker,
  getMakers,
  getMakerById,
  updateMaker,
  updateMakerStatus,
} from "../controllers/makerController.js";

import { authenticate } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(authenticate);

// =====================================================
// VIEW
// =====================================================

router.get(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  getMakers
);

router.get(
  "/:id",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  getMakerById
);

// =====================================================
// CREATE / UPDATE / STATUS
// =====================================================

router.post(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  createMaker
);

router.put(
  "/:id",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  updateMaker
);

router.patch(
  "/:id/status",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  updateMakerStatus
);

export default router;