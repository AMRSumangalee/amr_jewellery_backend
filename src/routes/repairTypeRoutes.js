import express from "express";

import {
  createRepairType,
  getRepairTypes,
  getRepairTypeById,
  updateRepairType,
  updateRepairTypeStatus,
} from "../controllers/repairTypeController.js";

import { authenticate } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(authenticate);

// View
router.get(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  getRepairTypes
);

router.get(
  "/:id",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  getRepairTypeById
);

// Create / Update / Status
router.post(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  createRepairType
);

router.put(
  "/:id",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  updateRepairType
);

router.patch(
  "/:id/status",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  updateRepairTypeStatus
);

export default router;