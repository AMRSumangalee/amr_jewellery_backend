
import multer from "multer";
import path from "path";
import fs from "fs";

// ============================================================
// PERMANENT UPLOAD DIRECTORIES
// ============================================================

// Production: UPLOAD_DIR from Hostinger environment variable.
// Local: backend/uploads

const uploadRoot = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve("uploads");

const imageDir = path.join(uploadRoot, "images");
const videoDir = path.join(uploadRoot, "videos");
const audioDir = path.join(uploadRoot, "audio");

// Create folders if they don't exist.
[uploadRoot, imageDir, videoDir, audioDir].forEach((dir) => {
  fs.mkdirSync(dir, {
    recursive: true,
  });
});

console.log("=================================");
console.log("MULTER PROCESS CWD:", process.cwd());
console.log("MULTER UPLOAD ROOT:", uploadRoot);
console.log("MULTER IMAGE PATH:", imageDir);
console.log("MULTER VIDEO PATH:", videoDir);
console.log("MULTER AUDIO PATH:", audioDir);
console.log("=================================");

// ============================================================
// STORAGE
// ============================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const mimeType = file.mimetype.toLowerCase();

    if (mimeType.startsWith("image/")) {
      cb(null, imageDir);
      return;
    }

    if (mimeType.startsWith("video/")) {
      cb(null, videoDir);
      return;
    }

    if (mimeType.startsWith("audio/")) {
      cb(null, audioDir);
      return;
    }

    cb(new Error("Unsupported media type"));
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname);

    const uniqueName =
      `${Date.now()}-${Math.round(Math.random() * 1e9)}` +
      extension;

    cb(null, uniqueName);
  },
});

// ============================================================
// FILE FILTER
// ============================================================

const fileFilter = (req, file, cb) => {
  const mimeType = file.mimetype.toLowerCase();

  const allowedImageTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];

  const allowedVideoTypes = [
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/webm",
  ];

  const allowedAudioTypes = [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/ogg",
    "audio/mp4",
    "audio/aac",
    "audio/x-m4a",
  ];

  const isAllowed =
    allowedImageTypes.includes(mimeType) ||
    allowedVideoTypes.includes(mimeType) ||
    allowedAudioTypes.includes(mimeType);

  if (!isAllowed) {
    return cb(
      new Error(`Unsupported file type: ${file.mimetype}`)
    );
  }

  cb(null, true);
};

// ============================================================
// MULTER CONFIGURATION
// ============================================================

const upload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 20,
  },
});

// ============================================================
// ORDER MEDIA UPLOAD
// ============================================================

export const uploadOrderMedia = upload.array("media", 20);
