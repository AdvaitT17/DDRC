const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { uploadsDir, generateUniqueFilename } = require("../config/upload");
const storageService = require("../services/storageService");

// Use memory storage - files are saved by storageService after processing
// This allows us to switch between local and Azure Blob storage seamlessly
const storage = multer.memoryStorage();

// Filter function to validate file types if needed
const fileFilter = (req, file, cb) => {
  // Accept all file types by default
  // Add validation logic if needed for specific types
  const allowedMimes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
};

// Create the multer instance with configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB file size limit
  },
});

// Create error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred when uploading
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "File is too large. Maximum size is 10MB.",
      });
    }
    return res.status(400).json({
      message: `File upload error: ${err.message}`,
    });
  } else if (err) {
    // An unknown error occurred
    return res.status(400).json({
      message: err.message || "Unknown error occurred during file upload",
    });
  }

  // If no error, continue
  next();
};

module.exports = {
  upload,
  handleMulterError,
};
