
import express from "express";

import {
  getDashboardSummary,
} from "../controllers/dashboard.controller.js";

import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

// Authentication required
router.use(authenticate);

// Dashboard summary
router.get("/summary", getDashboardSummary);

export default router;
