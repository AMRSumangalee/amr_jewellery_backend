import express from "express";

import { login } from "../controllers/authController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", login);

router.get("/me", authenticate, (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Authenticated user",
    data: req.user,
  });
});

export default router;