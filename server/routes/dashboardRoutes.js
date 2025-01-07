const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/authMiddleware");
const pool = require("../config/database");
const {
  requireCompletedRegistration,
} = require("../middleware/registrationMiddleware");

// Apply middleware to all dashboard routes
router.use(requireCompletedRegistration);

// Get dashboard data
router.get("/data", authenticateToken, async (req, res) => {
  try {
    // Get user's application details without filtering for completed status
    const [applications] = await pool.query(
      `SELECT 
        rp.id,
        rp.application_id,
        rp.status,
        rp.completed_at,
        rp.updated_at,
        rp.service_status
       FROM registration_progress rp
       WHERE rp.user_id = ?
       ORDER BY rp.completed_at DESC
       LIMIT 1`,
      [req.user.id]
    );

    if (applications.length === 0) {
      return res.status(404).json({ message: "No application found" });
    }

    const application = applications[0];

    // Get form responses for this application
    const [responses] = await pool.query(
      `SELECT 
        ff.name,
        rr.value
       FROM registration_responses rr
       JOIN form_fields ff ON rr.field_id = ff.id
       WHERE rr.registration_id = ?`,
      [application.id]
    );

    // Convert responses to an object
    const formData = responses.reduce((acc, curr) => {
      acc[curr.name] = curr.value;
      return acc;
    }, {});

    res.json({
      applicationId: application.application_id,
      status: application.service_status || application.status || "submitted",
      submittedDate: application.completed_at,
      lastUpdated: application.updated_at,
      applicantName: `${formData.firstname || ""} ${
        formData.lastname || ""
      }`.trim(),
      formData: formData,
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({ message: "Error fetching dashboard data" });
  }
});

module.exports = router;
