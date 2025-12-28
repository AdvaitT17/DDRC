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
    const allowedTypes = [".jpg", ".jpeg", ".png"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Allowed types: JPG, PNG"));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File is too large. Maximum size is 5MB",
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
// Get all events
router.get("/", async (req, res) => {
  try {
    const [events] = await db.query(
      "SELECT * FROM events ORDER BY event_date DESC"
    );
    res.json({ success: true, events });
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ success: false, message: "Error fetching events" });
  }
});

// Get latest events (for homepage)
router.get("/latest", async (req, res) => {
  try {
    const [events] = await db.query(
      "SELECT id, title, description, event_date, image_path FROM events ORDER BY event_date DESC LIMIT 3"
    );
    res.json({ success: true, events });
  } catch (error) {
    console.error("Error fetching latest events:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching latest events" });
  }
});

// Get single event by ID
router.get("/:id", async (req, res) => {
  try {
    const [event] = await db.query("SELECT * FROM events WHERE id = ?", [
      req.params.id,
    ]);

    if (event.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    res.json({ success: true, event: event[0] });
  } catch (error) {
    console.error("Error fetching event:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching event details",
    });
  }
});

// Protected routes
router.use(checkAuth);
router.use(isAdmin);

// Add new event
router.post(
  "/",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "additional_image1", maxCount: 1 },
    { name: "additional_image2", maxCount: 1 },
    { name: "additional_image3", maxCount: 1 },
    { name: "additional_image4", maxCount: 1 },
    { name: "additional_image5", maxCount: 1 },
  ]),
  handleMulterError,
  async (req, res) => {
    try {
      const title = sanitize(req.body.title);
      const description = sanitize(req.body.description);
      const body = sanitize(req.body.body);
      const event_date = req.body.event_date;
      if (!title || !description || !event_date) {
        return res.status(400).json({
          success: false,
          message: "Title, description and event date are required",
        });
      }

      if (!req.files || !req.files.image) {
        return res.status(400).json({
          success: false,
          message: "Main event image is required",
        });
      }

      // Save images using storage service (works for both local and Azure)
      const imagePaths = {
        image_path: null,
        additional_image1: null,
        additional_image2: null,
        additional_image3: null,
        additional_image4: null,
        additional_image5: null,
      };

      // Helper function to save an image
      const saveImage = async (file) => {
        const filename = storageService.generateFilename(file.originalname);
        await storageService.saveFile(file.buffer, 'events', filename);
        return `/uploads/events/${filename}`;
      };

      // Save main image
      imagePaths.image_path = await saveImage(req.files.image[0]);

      // Save additional images if provided
      if (req.files.additional_image1) {
        imagePaths.additional_image1 = await saveImage(req.files.additional_image1[0]);
      }
      if (req.files.additional_image2) {
        imagePaths.additional_image2 = await saveImage(req.files.additional_image2[0]);
      }
      if (req.files.additional_image3) {
        imagePaths.additional_image3 = await saveImage(req.files.additional_image3[0]);
      }
      if (req.files.additional_image4) {
        imagePaths.additional_image4 = await saveImage(req.files.additional_image4[0]);
      }
      if (req.files.additional_image5) {
        imagePaths.additional_image5 = await saveImage(req.files.additional_image5[0]);
      }

      const [result] = await db.query(
        `INSERT INTO events (
        title, description, body, event_date, image_path,
        additional_image1, additional_image2, additional_image3,
        additional_image4, additional_image5, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title,
          description,
          body || null,
          event_date,
          imagePaths.image_path,
          imagePaths.additional_image1,
          imagePaths.additional_image2,
          imagePaths.additional_image3,
          imagePaths.additional_image4,
          imagePaths.additional_image5,
          req.user.id,
        ]
      );

      res.json({
        success: true,
        message: "Event added successfully",
        eventId: result.insertId,
      });
    } catch (error) {
      console.error("Error adding event:", error);
      res.status(500).json({
        success: false,
        message: "Error adding event",
      });
    }
  }
);

// Delete event
router.delete("/:id", async (req, res) => {
  try {
    // First get the event to get all image paths
    const [event] = await db.query(
      "SELECT image_path, additional_image1, additional_image2, additional_image3, additional_image4, additional_image5 FROM events WHERE id = ?",
      [req.params.id]
    );

    if (event.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Delete all associated images using storage service
    const imagePaths = [
      event[0].image_path,
      event[0].additional_image1,
      event[0].additional_image2,
      event[0].additional_image3,
      event[0].additional_image4,
      event[0].additional_image5,
    ];

    // Delete each image using storage service
    for (const imagePath of imagePaths) {
      if (imagePath) {
        await storageService.deleteFile(imagePath);
      }
    }

    // Now delete from the database
    await db.query("DELETE FROM events WHERE id = ?", [req.params.id]);

    res.json({ success: true, message: "Event deleted successfully" });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({ success: false, message: "Error deleting event" });
  }
});

// Update event
router.put(
  "/:id",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "additional_image1", maxCount: 1 },
    { name: "additional_image2", maxCount: 1 },
    { name: "additional_image3", maxCount: 1 },
    { name: "additional_image4", maxCount: 1 },
    { name: "additional_image5", maxCount: 1 },
  ]),
  handleMulterError,
  async (req, res) => {
    try {
      const title = sanitize(req.body.title);
      const description = sanitize(req.body.description);
      const body = sanitize(req.body.body);
      const event_date = req.body.event_date;
      const removeMainImage = req.body.removeMainImage;
      const remove_additional_image1 = req.body.remove_additional_image1;
      const remove_additional_image2 = req.body.remove_additional_image2;
      const remove_additional_image3 = req.body.remove_additional_image3;
      const remove_additional_image4 = req.body.remove_additional_image4;
      const remove_additional_image5 = req.body.remove_additional_image5;
      const eventId = req.params.id;

      // Get current event data
      const [currentEvent] = await db.query(
        "SELECT * FROM events WHERE id = ?",
        [eventId]
      );

      if (currentEvent.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Event not found",
        });
      }

      // Prepare image paths
      let imagePaths = {
        image_path: currentEvent[0].image_path,
        additional_image1: currentEvent[0].additional_image1,
        additional_image2: currentEvent[0].additional_image2,
        additional_image3: currentEvent[0].additional_image3,
        additional_image4: currentEvent[0].additional_image4,
        additional_image5: currentEvent[0].additional_image5,
      };

      // Handle image removal flags using storage service
      if (removeMainImage === "true" && imagePaths.image_path) {
        await storageService.deleteFile(imagePaths.image_path);
        imagePaths.image_path = null;
      }

      // Handle additional image removal flags
      const additionalImageFlags = {
        additional_image1: remove_additional_image1,
        additional_image2: remove_additional_image2,
        additional_image3: remove_additional_image3,
        additional_image4: remove_additional_image4,
        additional_image5: remove_additional_image5,
      };

      for (const [field, shouldRemove] of Object.entries(additionalImageFlags)) {
        if (shouldRemove === "true" && imagePaths[field]) {
          await storageService.deleteFile(imagePaths[field]);
          imagePaths[field] = null;
        }
      }

      // Update image paths if new files are uploaded
      if (req.files) {
        for (const [fieldName, files] of Object.entries(req.files)) {
          const file = files[0];
          const dbField = fieldName === "image" ? "image_path" : fieldName;

          // Delete old image using storage service
          if (imagePaths[dbField]) {
            await storageService.deleteFile(imagePaths[dbField]);
          }

          // Save new file using storage service
          const filename = storageService.generateFilename(file.originalname);
          await storageService.saveFile(file.buffer, 'events', filename);
          imagePaths[dbField] = `/uploads/events/${filename}`;
        }
      }

      // Update event in database
      await db.query(
        `UPDATE events 
       SET title = ?, description = ?, body = ?, event_date = ?,
           image_path = ?, additional_image1 = ?, additional_image2 = ?,
           additional_image3 = ?, additional_image4 = ?, additional_image5 = ?
       WHERE id = ?`,
        [
          title,
          description,
          body,
          event_date,
          imagePaths.image_path,
          imagePaths.additional_image1,
          imagePaths.additional_image2,
          imagePaths.additional_image3,
          imagePaths.additional_image4,
          imagePaths.additional_image5,
          eventId,
        ]
      );

      res.json({
        success: true,
        message: "Event updated successfully",
      });
    } catch (error) {
      console.error("Error updating event:", error);
      res.status(500).json({
        success: false,
        message: "Error updating event",
      });
    }
  }
);

module.exports = router;
