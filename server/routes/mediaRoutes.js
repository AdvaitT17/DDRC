/**
 * Media Gallery Routes
 * Handles CRUD operations for media gallery items
 */

const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const {
    authenticateToken: checkAuth,
} = require("../middleware/authMiddleware");
const db = require("../config/database");
const { sanitize } = require("../utils/sanitize");
const storageService = require("../services/storageService");

// Admin check middleware
const isAdmin = (req, res, next) => {
    if (req.user.type !== "department") {
        return res.status(403).json({ message: "Access denied" });
    }
    next();
};

// Use memory storage - files are saved via storageService
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedImageTypes = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
        const allowedVideoTypes = [".mp4", ".webm", ".mov"];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedImageTypes.includes(ext) || allowedVideoTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type. Allowed: JPG, PNG, GIF, WEBP, MP4, WEBM, MOV"));
        }
    },
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit for videos
    },
});

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                success: false,
                message: "File is too large. Maximum size is 50MB",
            });
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
            return res.status(400).json({
                success: false,
                message: `Unexpected field name: ${err.field}. Expected 'file'.`,
            });
        }
        return res.status(400).json({
            success: false,
            message: `Upload error: ${err.message} (code: ${err.code})`,
        });
    } else if (err) {
        return res.status(400).json({
            success: false,
            message: err.message || "Unknown upload error",
        });
    }
    next();
};

// ==========================================
// PUBLIC ROUTES
// ==========================================

// Get all media items (with optional category filter)
router.get("/", async (req, res) => {
    try {
        const { category } = req.query;

        let query = "SELECT * FROM media_gallery";
        let params = [];

        if (category && category !== "all") {
            query += " WHERE category = ?";
            params.push(category);
        }

        query += " ORDER BY is_featured DESC, display_order ASC, created_at DESC";

        const [media] = await db.query(query, params);
        res.json({ success: true, media });
    } catch (error) {
        console.error("Error fetching media:", error);
        res.status(500).json({ success: false, message: "Error fetching media" });
    }
});

// Get featured media items (for homepage or gallery highlights)
router.get("/featured", async (req, res) => {
    try {
        const [media] = await db.query(
            "SELECT id, title, file_path, category FROM media_gallery WHERE is_featured = TRUE ORDER BY display_order ASC LIMIT 6"
        );
        res.json({ success: true, media });
    } catch (error) {
        console.error("Error fetching featured media:", error);
        res.status(500).json({ success: false, message: "Error fetching featured media" });
    }
});

// Get single media item by ID
router.get("/:id", async (req, res) => {
    try {
        const [media] = await db.query("SELECT * FROM media_gallery WHERE id = ?", [
            req.params.id,
        ]);

        if (media.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Media item not found",
            });
        }

        res.json({ success: true, media: media[0] });
    } catch (error) {
        console.error("Error fetching media item:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching media item",
        });
    }
});

// ==========================================
// PROTECTED ROUTES (Admin only)
// ==========================================
router.use(checkAuth);
router.use(isAdmin);

// Add new media item
router.post("/", upload.single("file"), handleMulterError, async (req, res) => {
    try {
        const title = sanitize(req.body.title);
        const description = sanitize(req.body.description || "");
        const category = req.body.category || "other";
        const is_featured = req.body.is_featured === "true";
        const display_order = parseInt(req.body.display_order) || 0;
        const media_type = req.body.media_type || "image";
        const youtube_url = sanitize(req.body.youtube_url || "");

        if (!title) {
            return res.status(400).json({
                success: false,
                message: "Title is required",
            });
        }

        let file_path = null;
        let finalMediaType = media_type;

        // Handle based on media type
        if (media_type === "youtube") {
            // Validate YouTube URL
            if (!youtube_url) {
                return res.status(400).json({
                    success: false,
                    message: "YouTube URL is required for YouTube embed type",
                });
            }
        } else {
            // Image or video upload required
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "File is required for image/video type",
                });
            }

            // Determine if it's image or video based on extension
            const ext = path.extname(req.file.originalname).toLowerCase();
            const videoExts = [".mp4", ".webm", ".mov"];
            finalMediaType = videoExts.includes(ext) ? "video" : "image";

            // Save file using storage service
            const filename = storageService.generateFilename(req.file.originalname);
            await storageService.saveFile(req.file.buffer, "media", filename);
            file_path = `/uploads/media/${filename}`;
        }

        const [result] = await db.query(
            `INSERT INTO media_gallery (title, description, category, file_path, youtube_url, media_type, is_featured, display_order, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, description, category, file_path, youtube_url || null, finalMediaType, is_featured, display_order, req.user.id]
        );

        res.json({
            success: true,
            message: "Media uploaded successfully",
            mediaId: result.insertId,
        });
    } catch (error) {
        console.error("Error adding media:", error);
        res.status(500).json({
            success: false,
            message: "Error uploading media",
        });
    }
});

// Update media item
router.put("/:id", upload.single("file"), handleMulterError, async (req, res) => {
    try {
        const mediaId = req.params.id;
        const title = sanitize(req.body.title);
        const description = sanitize(req.body.description || "");
        const category = req.body.category || "other";
        const is_featured = req.body.is_featured === "true";
        const display_order = parseInt(req.body.display_order) || 0;
        const media_type = req.body.media_type || "image";
        const youtube_url = sanitize(req.body.youtube_url || "");

        if (!title) {
            return res.status(400).json({
                success: false,
                message: "Title is required",
            });
        }

        // Get current media item
        const [currentMedia] = await db.query("SELECT * FROM media_gallery WHERE id = ?", [mediaId]);

        if (currentMedia.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Media item not found",
            });
        }

        let file_path = currentMedia[0].file_path;
        let finalMediaType = media_type;

        // Handle based on media type
        if (media_type === "youtube") {
            // Delete old file if exists and switching to YouTube
            if (file_path) {
                await storageService.deleteFile(file_path);
                file_path = null;
            }
        } else if (req.file) {
            // Delete old file using storage service
            if (file_path) {
                await storageService.deleteFile(file_path);
            }

            // Determine if it's image or video based on extension
            const ext = path.extname(req.file.originalname).toLowerCase();
            const videoExts = [".mp4", ".webm", ".mov"];
            finalMediaType = videoExts.includes(ext) ? "video" : "image";

            // Save new file using storage service
            const filename = storageService.generateFilename(req.file.originalname);
            await storageService.saveFile(req.file.buffer, "media", filename);
            file_path = `/uploads/media/${filename}`;
        }

        await db.query(
            `UPDATE media_gallery 
       SET title = ?, description = ?, category = ?, file_path = ?, youtube_url = ?, media_type = ?, is_featured = ?, display_order = ?
       WHERE id = ?`,
            [title, description, category, file_path, youtube_url || null, finalMediaType, is_featured, display_order, mediaId]
        );

        res.json({
            success: true,
            message: "Media updated successfully",
        });
    } catch (error) {
        console.error("Error updating media:", error);
        res.status(500).json({
            success: false,
            message: "Error updating media",
        });
    }
});

// Delete media item
router.delete("/:id", async (req, res) => {
    try {
        // First get the media item to get the file path
        const [media] = await db.query("SELECT file_path FROM media_gallery WHERE id = ?", [
            req.params.id,
        ]);

        if (media.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Media item not found",
            });
        }

        // Delete file using storage service
        if (media[0].file_path) {
            await storageService.deleteFile(media[0].file_path);
        }

        // Delete from database
        await db.query("DELETE FROM media_gallery WHERE id = ?", [req.params.id]);

        res.json({ success: true, message: "Media deleted successfully" });
    } catch (error) {
        console.error("Error deleting media:", error);
        res.status(500).json({ success: false, message: "Error deleting media" });
    }
});

// Reorder media items
router.post("/reorder", async (req, res) => {
    try {
        const { items } = req.body;

        if (!Array.isArray(items)) {
            return res.status(400).json({
                success: false,
                message: "Items array is required",
            });
        }

        // Update display_order for each item
        for (let i = 0; i < items.length; i++) {
            await db.query("UPDATE media_gallery SET display_order = ? WHERE id = ?", [
                i,
                items[i].id,
            ]);
        }

        res.json({ success: true, message: "Media order updated successfully" });
    } catch (error) {
        console.error("Error reordering media:", error);
        res.status(500).json({ success: false, message: "Error reordering media" });
    }
});

module.exports = router;
