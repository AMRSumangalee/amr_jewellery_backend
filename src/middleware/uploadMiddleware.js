import multer from "multer";
import path from "path";
import fs from "fs";

// ============================================================
// UPLOAD DIRECTORIES
// ============================================================

const uploadRoot = path.resolve("uploads");

const imageDir = path.join(uploadRoot, "images");
const videoDir = path.join(uploadRoot, "videos");
const audioDir = path.join(uploadRoot, "audio");

// Create folders if they don't exist
[uploadRoot, imageDir, videoDir, audioDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {
      recursive: true,
    });
  }
});

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
      new Error(
        `Unsupported file type: ${file.mimetype}`
      )
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
    // Maximum size for each file = 50 MB
    fileSize: 50 * 1024 * 1024,

    // Maximum total files in one order request
    files: 20,
  },
});

// ============================================================
// ORDER MEDIA UPLOAD
// ============================================================

export const uploadOrderMedia = upload.array("media", 20);