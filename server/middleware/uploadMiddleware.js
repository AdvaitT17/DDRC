const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { uploadsDir, generateUniqueFilename } = require("../config/upload");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Determine destination based on file type or route
    let uploadPath = path.join(uploadsDir);

    // Default to forms directory if no specific directory is determined
    if (req.originalUrl.includes("/news")) {
      uploadPath = path.join(uploadsDir, "news");
    } else if (req.originalUrl.includes("/events")) {
      uploadPath = path.join(uploadsDir, "events");
    } else {
      uploadPath = path.join(uploadsDir, "forms");
    }

    // Ensure the directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename to prevent overwriting
    const uniqueFilename = generateUniqueFilename(file.originalname);
    cb(null, uniqueFilename);
  },
});

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
