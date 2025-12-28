const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const {
  authenticateToken: checkAuth,
  requireRole,
} = require("../middleware/authMiddleware");
const isAdmin = (req, res, next) => {
  if (req.user.type !== "department") {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
};
const db = require("../config/database");
const fs = require("fs");
const { sanitize } = require("../utils/sanitize");
const storageService = require("../services/storageService");

// Use memory storage - files are saved via storageService
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error("Invalid file type. Allowed types: PDF, DOC, DOCX, JPG, PNG")
      );
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File is too large. Maximum size is 10MB",
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next();
};

// Public routes
// Get all news items
router.get("/", async (req, res) => {
  try {
    const [news] = await db.query(
      "SELECT * FROM news ORDER BY published_date DESC"
    );
    res.json({ success: true, news });
  } catch (error) {
    console.error("Error fetching news:", error);
    res.status(500).json({ success: false, message: "Error fetching news" });
  }
});

// Get latest news items (for homepage)
router.get("/latest", async (req, res) => {
  try {
    const [news] = await db.query(
      "SELECT id, title, published_date FROM news ORDER BY published_date DESC LIMIT 5"
    );
    res.json({ success: true, news });
  } catch (error) {
    console.error("Error fetching latest news:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching latest news" });
  }
});

// Protected routes below this line
router.use(checkAuth);
router.use(isAdmin);

// Add new news item
router.post("/", upload.single("file"), handleMulterError, async (req, res) => {
  try {
    const title = sanitize(req.body.title);
    const description = sanitize(req.body.description);
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Title and description are required",
      });
    }

    // Save file using storage service (works for both local and Azure)
    let file_path = null;
    if (req.file) {
      const filename = storageService.generateFilename(req.file.originalname);
      await storageService.saveFile(req.file.buffer, 'news', filename);
      file_path = `/uploads/news/${filename}`;
    }

    const [result] = await db.query(
      "INSERT INTO news (title, description, file_path, created_by) VALUES (?, ?, ?, ?)",
      [title, description, file_path, req.user.id]
    );

    res.json({
      success: true,
      message: "News added successfully",
      newsId: result.insertId,
    });
  } catch (error) {
    console.error("Error adding news:", error);
    res.status(500).json({ success: false, message: "Error adding news" });
  }
});

// Delete news item
router.delete("/:id", async (req, res) => {
  try {
    // First get the news item to get the file path
    const [news] = await db.query("SELECT file_path FROM news WHERE id = ?", [
      req.params.id,
    ]);

    if (news.length === 0) {
      return res.status(404).json({
        success: false,
        message: "News item not found",
      });
    }

    // Delete file using storage service (works for both local and Azure)
    if (news[0].file_path) {
      await storageService.deleteFile(news[0].file_path);
    }

    // Now actually delete from the database
    await db.query("DELETE FROM news WHERE id = ?", [req.params.id]);

    res.json({ success: true, message: "News deleted successfully" });
  } catch (error) {
    console.error("Error deleting news:", error);
    res.status(500).json({ success: false, message: "Error deleting news" });
  }
});

// Get single news item
router.get("/:id", async (req, res) => {
  try {
    const [news] = await db.query("SELECT * FROM news WHERE id = ?", [
      req.params.id,
    ]);

    if (news.length === 0) {
      return res.status(404).json({
        success: false,
        message: "News item not found",
      });
    }

    res.json({ success: true, news: news[0] });
  } catch (error) {
    console.error("Error fetching news item:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching news item" });
  }
});

// Update news item
router.put(
  "/:id",
  upload.single("file"),
  handleMulterError,
  async (req, res) => {
    try {
      const title = sanitize(req.body.title);
      const description = sanitize(req.body.description);
      if (!title || !description) {
        return res.status(400).json({
          success: false,
          message: "Title and description are required",
        });
      }

      // First get the current news item to check if it exists and get the current file path
      const [news] = await db.query("SELECT file_path FROM news WHERE id = ?", [
        req.params.id,
      ]);

      if (news.length === 0) {
        return res.status(404).json({
          success: false,
          message: "News item not found",
        });
      }

      let file_path = news[0].file_path;

      // If a new file is uploaded, delete the old one and update the path
      if (req.file) {
        // Delete old file using storage service
        if (file_path) {
          await storageService.deleteFile(file_path);
        }

        // Save new file using storage service
        const filename = storageService.generateFilename(req.file.originalname);
        await storageService.saveFile(req.file.buffer, 'news', filename);
        file_path = `/uploads/news/${filename}`;
      }

      await db.query(
        "UPDATE news SET title = ?, description = ?, file_path = ? WHERE id = ?",
        [title, description, file_path, req.params.id]
      );

      res.json({
        success: true,
        message: "News updated successfully",
      });
    } catch (error) {
      console.error("Error updating news:", error);
      res.status(500).json({ success: false, message: "Error updating news" });
    }
  }
);

module.exports = router;
