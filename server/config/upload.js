const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Use environment variable for uploads directory or default to local path
const uploadsDir =
  process.env.UPLOADS_DIR || path.join(__dirname, "../uploads");

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Generate unique filename
const generateUniqueFilename = (originalname) => {
  const timestamp = Date.now();
  const hash = crypto.randomBytes(8).toString("hex");
  const ext = path.extname(originalname);
  return `${timestamp}-${hash}${ext}`;
};

module.exports = {
  uploadsDir,
  generateUniqueFilename,
};
