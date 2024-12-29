const express = require("express");
const router = express.Router();
const pool = require("../config/database");

// Get dashboard stats
router.get("/stats", async (req, res) => {
  try {
    const conn = await pool.getConnection();

    try {
      // Get total registrations
      const [totalReg] = await conn.query(
        "SELECT COUNT(*) as count FROM registration_progress"
      );

      // Get pending applications
      const [pendingApps] = await conn.query(
        "SELECT COUNT(*) as count FROM registration_progress WHERE status = 'submitted'"
      );

      // Get approved today
      const [approvedToday] = await conn.query(
        `SELECT COUNT(*) as count FROM registration_progress 
         WHERE status = 'approved' 
         AND DATE(updated_at) = CURDATE()`
      );

      // Get active users (logged in within last 24 hours)
      const [activeUsers] = await conn.query(
        `SELECT COUNT(*) as count FROM registered_users 
         WHERE last_login >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
      );

      res.json({
        totalRegistrations: totalReg[0].count,
        pendingApplications: pendingApps[0].count,
        approvedToday: approvedToday[0].count,
        activeUsers: activeUsers[0].count,
      });
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ message: "Error fetching stats" });
  }
});

// Get recent applications
router.get("/recent-applications", async (req, res) => {
  try {
    const [applications] = await pool.query(
      `SELECT 
        rp.application_id,
        rp.status,
        rp.completed_at as submitted_at,
        rp.updated_at,
        ru.email,
        JSON_OBJECTAGG(ff.name, rr.value) as form_data
       FROM registration_progress rp
       JOIN registered_users ru ON rp.user_id = ru.id
       LEFT JOIN registration_responses rr ON rp.id = rr.registration_id
       LEFT JOIN form_fields ff ON rr.field_id = ff.id
       WHERE rp.status != 'in_progress'
       GROUP BY rp.id
       ORDER BY rp.completed_at DESC
       LIMIT 10`
    );

    const formattedApplications = applications.map((app) => {
      const formData = JSON.parse(app.form_data || "{}");
      return {
        applicationId: app.application_id,
        applicantName: `${formData.firstname || ""} ${
          formData.lastname || ""
        }`.trim(),
        email: app.email,
        submittedAt: app.submitted_at,
        status: app.status,
        updatedAt: app.updated_at,
      };
    });

    res.json(formattedApplications);
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({ message: "Error fetching applications" });
  }
});

// Update application status
router.put("/application/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    await pool.query(
      `UPDATE registration_progress 
       SET status = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE application_id = ?`,
      [status, id]
    );

    res.json({ message: "Status updated successfully" });
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({ message: "Error updating status" });
  }
});

module.exports = router;
