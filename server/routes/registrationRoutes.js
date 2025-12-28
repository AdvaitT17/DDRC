const express = require("express");
const router = express.Router();
const multer = require("multer");
const { uploadsDir, generateUniqueFilename } = require("../config/upload");
const { authenticateToken } = require("../middleware/authMiddleware");
const pool = require("../config/database");
const path = require("path");
const fs = require("fs");
const validationService = require("../services/validationService");
const storageService = require("../services/storageService");

// Use memory storage - files are saved via storageService
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
});

// Get registration progress
router.get("/progress", authenticateToken, async (req, res) => {
  try {
    const [progress] = await pool.query(
      `SELECT * FROM registration_progress 
       WHERE user_id = ? 
       ORDER BY id DESC LIMIT 1`,
      [req.user.id]
    );

    if (progress.length === 0) {
      return res.json({
        currentSectionId: null,
        responses: {},
      });
    }

    // Fetch saved responses with field names
    const [responses] = await pool.query(
      `SELECT ff.name, rr.value 
       FROM registration_responses rr
       JOIN form_fields ff ON rr.field_id = ff.id
       WHERE rr.registration_id = ?`,
      [progress[0].id]
    );

    res.json({
      currentSectionId: progress[0].current_section_id,
      status: progress[0].status,
      applicationId: progress[0].application_id,
      responses: responses.reduce((acc, curr) => {
        acc[curr.name] = curr.value;
        return acc;
      }, {}),
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching progress" });
  }
});

// Save section progress with file upload support
router.post("/progress", authenticateToken, upload.any(), async (req, res) => {
  try {
    const formData = req.body;
    const currentSectionId = formData.current_section_id;
    delete formData.current_section_id; // Remove from formData to not save as response

    // Validate form data against field validation rules
    const validation = await validationService.validateFormData(formData, currentSectionId);

    if (!validation.isValid) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validation.errors
      });
    }

    // Get or create registration progress
    const [progress] = await pool.query(
      `SELECT id FROM registration_progress 
       WHERE user_id = ? 
       ORDER BY id DESC LIMIT 1`,
      [req.user.id]
    );

    let registrationId;
    if (progress.length === 0) {
      // Create new registration progress
      const [result] = await pool.query(
        `INSERT INTO registration_progress (user_id, current_section_id) VALUES (?, ?)`,
        [req.user.id, currentSectionId]
      );
      registrationId = result.insertId;
    } else {
      registrationId = progress[0].id;
      // Update current section
      await pool.query(
        `UPDATE registration_progress 
         SET current_section_id = ?
         WHERE id = ?`,
        [currentSectionId, registrationId]
      );
    }

    // Handle file uploads using storage service
    const files = req.files || [];
    for (const file of files) {
      const fieldId = file.fieldname.replace("file_", "");
      const filename = storageService.generateFilename(file.originalname);
      await storageService.saveFile(file.buffer, 'forms', filename);
      const filePath = `forms/${filename}`;
      await pool.query(
        `INSERT INTO registration_responses (registration_id, field_id, value)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE value = ?`,
        [registrationId, fieldId, filePath, filePath]
      );
    }

    // Handle other form fields
    for (const [key, value] of Object.entries(req.body)) {
      if (!key.startsWith("file_")) {
        // Handle array values (like checkbox groups)
        const finalValue = Array.isArray(value) ? value.join(",") : value;

        await pool.query(
          `INSERT INTO registration_responses (registration_id, field_id, value)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE value = ?`,
          [registrationId, key, finalValue, finalValue]
        );
      }
    }

    res.json({ message: "Progress saved successfully" });
  } catch (error) {
    console.error("Error saving progress:", error);
    res.status(500).json({ message: "Error saving progress" });
  }
});

// Submit form
router.post("/submit", authenticateToken, async (req, res) => {
  try {
    // Check for existing completed registration
    const [existingReg] = await pool.query(
      `SELECT application_id FROM registration_progress 
       WHERE user_id = ? AND status = 'completed'`,
      [req.user.id]
    );

    if (existingReg.length > 0) {
      return res.status(400).json({
        message: "You have already submitted a registration",
        applicationId: existingReg[0].application_id,
      });
    }

    // Get the user's in-progress registration to validate all responses
    const [progress] = await pool.query(
      `SELECT id FROM registration_progress 
       WHERE user_id = ? AND status = 'in_progress'`,
      [req.user.id]
    );

    if (progress.length === 0) {
      return res.status(400).json({ message: "No registration in progress" });
    }

    // Get all responses for this registration
    const [responses] = await pool.query(
      `SELECT field_id, value FROM registration_responses 
       WHERE registration_id = ?`,
      [progress[0].id]
    );

    // Convert responses to object for validation
    const formData = {};
    responses.forEach(r => {
      formData[r.field_id] = r.value;
    });

    // Validate all form data before final submission
    const validation = await validationService.validateFormData(formData);

    if (!validation.isValid) {
      return res.status(400).json({
        message: "Form validation failed. Please review all sections.",
        errors: validation.errors
      });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Generate application ID (Year-Month-Sequential Number)
      // Get the last application ID that follows the YYYY-MM-NNNN format (not MIG- format)
      const [lastApp] = await conn.query(
        `SELECT application_id FROM registration_progress 
         WHERE application_id IS NOT NULL 
         AND application_id NOT LIKE 'MIG-%'
         ORDER BY id DESC LIMIT 1`
      );

      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");

      // Parse the last sequential number from YYYY-MM-NNNN format
      let lastNum = 0;
      if (lastApp.length && lastApp[0].application_id) {
        const parts = lastApp[0].application_id.split("-");
        if (parts.length === 3) {
          const parsed = parseInt(parts[2]);
          if (!isNaN(parsed)) {
            lastNum = parsed;
          }
        }
      }

      const appNum = String(lastNum + 1).padStart(4, "0");
      const applicationId = `${year}-${month}-${appNum}`;

      // Update registration status
      await conn.query(
        `UPDATE registration_progress 
         SET status = 'completed', 
             application_id = ?,
             completed_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [applicationId, progress[0].id]
      );

      await conn.commit();
      res.json({
        message: "Form submitted successfully",
        applicationId,
      });
    } catch (error) {
      await conn.rollback();
      res.status(500).json({ message: "Error submitting form" });
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error("Error in registration submission:", error);
    res.status(500).json({ message: "Error processing registration" });
  }
});

// Check if application exists and was recently submitted
router.get("/verify/:applicationId", authenticateToken, async (req, res) => {
  try {
    const [registration] = await pool.query(
      `SELECT completed_at 
       FROM registration_progress 
       WHERE application_id = ? 
       AND user_id = ? 
       AND status = 'completed'
       AND completed_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)`,
      [req.params.applicationId, req.user.id]
    );

    res.json({
      valid: registration.length > 0,
    });
  } catch (error) {
    console.error("Error verifying submission:", error);
    res.status(500).json({ message: "Error verifying submission" });
  }
});

// Add this new route to check registration status
router.get("/check-status", authenticateToken, async (req, res) => {
  try {
    const [registration] = await pool.query(
      `SELECT application_id, status 
       FROM registration_progress 
       WHERE user_id = ? AND status = 'completed'
       ORDER BY completed_at DESC LIMIT 1`,
      [req.user.id]
    );

    res.json({
      hasRegistration: registration.length > 0,
      applicationId: registration[0]?.application_id || null,
      status: registration[0]?.status || null,
    });
  } catch (error) {
    console.error("Error checking registration status:", error);
    res.status(500).json({
      message: "Error checking registration status",
      hasRegistration: false,
    });
  }
});

// Add file upload endpoint
router.post(
  "/upload-file",
  authenticateToken,
  upload.single("file"),
  async (req, res) => {
    try {
      const { fieldId } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Get current registration progress
      const [progress] = await pool.query(
        `SELECT id FROM registration_progress 
         WHERE user_id = ? 
         ORDER BY id DESC LIMIT 1`,
        [req.user.id]
      );

      if (progress.length === 0) {
        // Create new registration progress
        const [result] = await pool.query(
          `INSERT INTO registration_progress (user_id) VALUES (?)`,
          [req.user.id]
        );
        var registrationId = result.insertId;
      } else {
        var registrationId = progress[0].id;
      }

      // Save file using storage service
      const filename = storageService.generateFilename(file.originalname);
      await storageService.saveFile(file.buffer, 'forms', filename);
      const filePath = `forms/${filename}`;

      await pool.query(
        `INSERT INTO registration_responses (registration_id, field_id, value) 
         VALUES (?, ?, ?) 
         ON DUPLICATE KEY UPDATE value = ?`,
        [registrationId, fieldId, filePath, filePath]
      );

      res.json({
        fileName: filename,
        message: "File uploaded successfully",
      });
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ message: "Error uploading file" });
    }
  }
);

// Add file delete endpoint
router.delete("/delete-file/:fieldId", authenticateToken, async (req, res) => {
  try {
    const { fieldId } = req.params;

    // Get file name from database
    const [files] = await pool.query(
      `SELECT rr.value 
       FROM registration_responses rr
       JOIN registration_progress rp ON rr.registration_id = rp.id
       WHERE rp.user_id = ? AND rr.field_id = ?`,
      [req.user.id, fieldId]
    );

    if (files.length > 0) {
      // Delete file using storage service
      await storageService.deleteFile(files[0].value);

      // Remove from database
      await pool.query(
        `DELETE rr FROM registration_responses rr
         JOIN registration_progress rp ON rr.registration_id = rp.id
         WHERE rp.user_id = ? AND rr.field_id = ?`,
        [req.user.id, fieldId]
      );
    }

    res.json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("File delete error:", error);
    res.status(500).json({ message: "Error deleting file" });
  }
});

module.exports = router;
