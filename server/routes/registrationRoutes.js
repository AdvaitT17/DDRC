const express = require("express");
const router = express.Router();
const multer = require("multer");
const { uploadsDir, generateUniqueFilename } = require("../config/upload");
const { authenticateToken } = require("../middleware/authMiddleware");
const pool = require("../config/database");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    cb(null, generateUniqueFilename(file.originalname));
  },
});

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
      return res.json({ currentSectionIndex: 0, responses: {} });
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
      currentSectionIndex: progress[0].current_section_index,
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
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Get or create progress record
    let [progress] = await conn.query(
      `SELECT id FROM registration_progress 
       WHERE user_id = ? AND status = 'in_progress'`,
      [req.user.id]
    );

    let progressId;
    if (progress.length === 0) {
      const [result] = await conn.query(
        `INSERT INTO registration_progress (user_id) VALUES (?)`,
        [req.user.id]
      );
      progressId = result.insertId;
    } else {
      progressId = progress[0].id;
    }

    // Handle file uploads
    const files = req.files || [];
    for (const file of files) {
      const fieldId = file.fieldname.replace("file_", "");
      await conn.query(
        `INSERT INTO registration_responses (registration_id, field_id, value)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE value = ?`,
        [progressId, fieldId, file.filename, file.filename]
      );
    }

    // Handle other form fields
    for (const [key, value] of Object.entries(req.body)) {
      if (!key.startsWith("file_")) {
        // Handle array values (like checkbox groups)
        const finalValue = Array.isArray(value) ? value.join(",") : value;

        await conn.query(
          `INSERT INTO registration_responses (registration_id, field_id, value)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE value = ?`,
          [progressId, key, finalValue, finalValue]
        );
      }
    }

    await conn.commit();
    res.json({ message: "Progress saved successfully" });
  } catch (error) {
    await conn.rollback();
    console.error("Error saving progress:", error);
    res.status(500).json({ message: "Error saving progress" });
  } finally {
    conn.release();
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

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Get the user's in-progress registration
      const [progress] = await conn.query(
        `SELECT id FROM registration_progress 
         WHERE user_id = ? AND status = 'in_progress'`,
        [req.user.id]
      );

      if (progress.length === 0) {
        throw new Error("No registration in progress");
      }

      // Generate application ID (Year-Month-Sequential Number)
      const [lastApp] = await conn.query(
        `SELECT application_id FROM registration_progress 
         WHERE application_id IS NOT NULL 
         ORDER BY id DESC LIMIT 1`
      );

      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const lastNum = lastApp.length
        ? parseInt(lastApp[0].application_id.split("-")[2])
        : 0;
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

module.exports = router;
