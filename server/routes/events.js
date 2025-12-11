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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "../uploads/events");
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Clean the original filename to remove special characters
    const cleanFileName = file.originalname.replace(/[^a-zA-Z0-9.]/g, "_");
    cb(null, Date.now() + "-" + cleanFileName);
  },
});

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

      // Prepare image paths
      const imagePaths = {
        image_path: `/uploads/events/${req.files.image[0].filename}`,
        additional_image1: req.files.additional_image1
          ? `/uploads/events/${req.files.additional_image1[0].filename}`
          : null,
        additional_image2: req.files.additional_image2
          ? `/uploads/events/${req.files.additional_image2[0].filename}`
          : null,
        additional_image3: req.files.additional_image3
          ? `/uploads/events/${req.files.additional_image3[0].filename}`
          : null,
        additional_image4: req.files.additional_image4
          ? `/uploads/events/${req.files.additional_image4[0].filename}`
          : null,
        additional_image5: req.files.additional_image5
          ? `/uploads/events/${req.files.additional_image5[0].filename}`
          : null,
      };

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

    // Delete all associated images
    const imagePaths = [
      event[0].image_path,
      event[0].additional_image1,
      event[0].additional_image2,
      event[0].additional_image3,
      event[0].additional_image4,
      event[0].additional_image5,
    ];

    // Delete each image if it exists
    imagePaths.forEach((imagePath) => {
      if (imagePath) {
        const fullPath = path.join(__dirname, "..", imagePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }
    });

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

      // Handle image removal flags
      if (removeMainImage === "true" && imagePaths.image_path) {
        const fullPath = path.join(__dirname, "..", imagePaths.image_path);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
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

      Object.keys(additionalImageFlags).forEach((field) => {
        if (additionalImageFlags[field] === "true" && imagePaths[field]) {
          const fullPath = path.join(__dirname, "..", imagePaths[field]);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
          imagePaths[field] = null;
        }
      });

      // Update image paths if new files are uploaded
      if (req.files) {
        Object.keys(req.files).forEach((fieldName) => {
          const file = req.files[fieldName][0];
          const dbField = fieldName === "image" ? "image_path" : fieldName;

          // Delete old image if it exists
          const oldImagePath = imagePaths[dbField];
          if (oldImagePath) {
            const fullPath = path.join(__dirname, "..", oldImagePath);
            if (fs.existsSync(fullPath)) {
              fs.unlinkSync(fullPath);
            }
          }

          // Set new image path
          imagePaths[dbField] = `/uploads/events/${file.filename}`;
        });
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
