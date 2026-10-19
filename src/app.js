import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import authRoutes from "./routes/authRoutes.js";
import branchRoutes from "./routes/branchRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import metalRoutes from "./routes/metalRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import repairTypeRoutes from "./routes/repairTypeRoutes.js";
import makerRoutes from "./routes/makerRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import whatsappRoutes from "./routes/whatsappRoutes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
const app = express();

// ========================================
// DIRECTORY CONFIGURATION
// ========================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDirectory = path.resolve(__dirname, "..", "uploads");

console.log("=================================");
console.log("APP DIRECTORY:", __dirname);
console.log("UPLOADS DIRECTORY:", uploadsDirectory);
console.log("UPLOADS DIRECTORY EXISTS:", fs.existsSync(uploadsDirectory));
console.log("=================================");

// ========================================
// SECURITY & MIDDLEWARE
// ========================================

app.use(
  helmet({
    // Allow browser and Flutter clients to display uploaded media.
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
    // Allow video/audio playback without restrictive CSP headers.
    contentSecurityPolicy: false,
  })
);

app.use(
  cors({
    origin: "*",
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(morgan("dev"));

// ========================================
// ROOT
// ========================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Jewellery Order Management API is running",
    version: "1.0.0",
  });
});

// ========================================
// UPLOADED MEDIA
// IMPORTANT: Must be before the 404 handler.
// ========================================

app.use(
  "/uploads",
  express.static(uploadsDirectory, {
    dotfiles: "deny",
    index: false,
    fallthrough: true,
    setHeaders: (res, filePath) => {
      const extension = path.extname(filePath).toLowerCase();

      const mimeTypes = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".opus": "audio/ogg",
        ".aac": "audio/aac",
      };

      if (mimeTypes[extension]) {
        res.setHeader("Content-Type", mimeTypes[extension]);
      }

      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cache-Control", "public, max-age=3600");
    },
  })
);

// Media diagnostic route
app.get("/api/media-check", (req, res) => {
  const directories = ["images", "videos", "audio"];

  const result = {};

  for (const directory of directories) {
    const folderPath = path.join(uploadsDirectory, directory);

    result[directory] = {
      path: folderPath,
      exists: fs.existsSync(folderPath),
    };
  }

  res.status(200).json({
    success: true,
    message: "Media directories checked",
    data: result,
  });
});

// ========================================
// HEALTH CHECK
// ========================================

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is running",
  });
});

// ========================================
// API ROUTES
// ========================================

app.use("/api/auth", authRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/users", userRoutes);
app.use("/api/metals", metalRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/repair-types", repairTypeRoutes);
app.use("/api/makers", makerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/dashboard", dashboardRoutes);
// ========================================
// 404
// ========================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Resource not found",
    path: req.originalUrl,
  });
});

// ========================================
// GLOBAL ERROR HANDLER
// ========================================

app.use((error, req, res, next) => {
  console.error("GLOBAL ERROR:", error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

export default app;
