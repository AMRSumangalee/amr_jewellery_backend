
import express from "express";

import {
  createOrderController,
  getOrdersController,
  getOrderByIdController,
  updateOrderController,
  deleteOrderController,
  shareOrderWhatsAppController,
  shareOrderImageWhatsAppController,
  shareOrderVideoWhatsAppController,
} from "../controllers/orderController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { uploadOrderMedia } from "../middleware/uploadMiddleware.js";

import {
  updateOrderStatusController,
  getOrderStatusHistoryController,
} from "../controllers/orderStatus.controller.js";

const router = express.Router();

// ============================================================
// GET ORDER LIST
// GET /api/orders
// ============================================================

router.get(
  "/",
  authMiddleware,
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  getOrdersController
);

// ============================================================
// GET ORDER DETAILS
// GET /api/orders/:id
// ============================================================

router.get(
  "/:id",
  authMiddleware,
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  getOrderByIdController
);

// ============================================================
// CREATE ORDER
// POST /api/orders
// ============================================================

router.post(
  "/",
  authMiddleware,
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  uploadOrderMedia,
  createOrderController
);

// ============================================================
// UPDATE ORDER
// PUT /api/orders/:id
// ============================================================

router.put(
  "/:id",
  authMiddleware,
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  uploadOrderMedia,
  updateOrderController
);

// ============================================================
// SHARE ORDER DETAILS VIA WHATSAPP
// POST /api/orders/:id/share-whatsapp
// ============================================================

router.post(
  "/:id/share-whatsapp",
  authMiddleware,
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  shareOrderWhatsAppController
);

// ============================================================
// SHARE ORDER IMAGE VIA WHATSAPP
// POST /api/orders/:id/share-whatsapp-image
// ============================================================

router.post(
  "/:id/share-whatsapp-image",
  (req, res, next) => {
    console.log("IMAGE WHATSAPP ROUTE HIT:", req.params.id);
    next();
  },
  authMiddleware,
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  shareOrderImageWhatsAppController
);

// ============================================================
// SHARE ORDER VIDEO VIA WHATSAPP
// POST /api/orders/:id/share-whatsapp-video
// ============================================================

router.post(
  "/:id/share-whatsapp-video",
  (req, res, next) => {
    console.log("VIDEO WHATSAPP ROUTE HIT:", req.params.id);
    next();
  },
  authMiddleware,
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  shareOrderVideoWhatsAppController
);

// ============================================================
// UPDATE ORDER STATUS
// PATCH /api/orders/:id/status
// ============================================================

router.patch(
  "/:id/status",
  authMiddleware,
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  updateOrderStatusController
);

// ============================================================
// GET ORDER STATUS HISTORY
// GET /api/orders/:id/status-history
// ============================================================

router.get(
  "/:id/status-history",
  authMiddleware,
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  getOrderStatusHistoryController
);

// ============================================================
// DELETE ORDER
// DELETE /api/orders/:id
// ============================================================

router.delete(
  "/:id",
  authMiddleware,
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  deleteOrderController
);

export default router;
