
import express from "express";
import {
  sendTestWhatsAppController,
} from "../controllers/whatsappController.js";

const router = express.Router();

router.post("/test", sendTestWhatsAppController);

export default router;
