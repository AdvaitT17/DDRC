const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const {
  authenticateToken,
  requireRole,
} = require("../middleware/authMiddleware");
const tokenManager = require("../utils/temporaryAccess");

// Generate temporary file access URL
router.get(
  "/files/access-url/:filename",
  authenticateToken,
  requireRole(["admin", "staff"]),
  async (req, res) => {
    try {
      const { filename } = req.params;

      const accessToken = tokenManager.generateToken(filename, req.user.id);

      res.json({
        accessUrl: `/uploads/${filename}?access_token=${accessToken}`,
      });
    } catch (error) {
      console.error("Error generating file access URL:", error);
      res.status(500).json({ message: "Error generating file access URL" });
    }
  }
);

// Get dashboard stats
router.get("/stats", async (req, res) => {
  try {
    const conn = await pool.getConnection();

    try {
      // Get total registrations
      const [totalReg] = await conn.query(
        "SELECT COUNT(*) as count FROM registration_progress"
      );

      // Get pending applications (where service_status is null or pending)
      const [pendingApps] = await conn.query(
        `SELECT COUNT(*) as count FROM registration_progress 
         WHERE service_status IS NULL OR service_status = 'pending'`
      );

      // Get approved today
      const [approvedToday] = await conn.query(
        `SELECT COUNT(*) as count FROM registration_progress 
         WHERE service_status = 'approved' 
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
        rp.completed_at,
        rp.service_status,
        rp.id,
        ru.email,
        rr_disability.value as disability_type
      FROM registration_progress rp
      JOIN registered_users ru ON rp.user_id = ru.id
      LEFT JOIN registration_responses rr_disability ON rp.id = rr_disability.registration_id 
        AND rr_disability.field_id = 26
      WHERE rp.status = 'completed'
      ORDER BY rp.completed_at DESC
      LIMIT 10`
    );

    // Get form data for each application
    const formattedApplications = await Promise.all(
      applications.map(async (app) => {
        // Get basic form data
        const [responses] = await pool.query(
          `SELECT ff.name, rr.value
           FROM registration_responses rr
           JOIN form_fields ff ON rr.field_id = ff.id
           WHERE rr.registration_id = ?`,
          [app.id]
        );

        const formData = responses.reduce((acc, curr) => {
          acc[curr.name] = curr.value;
          return acc;
        }, {});

        return {
          applicationId: app.application_id,
          applicantName: `${formData.firstname || ""} ${
            formData.lastname || ""
          }`.trim(),
          email: app.email,
          submittedAt: app.completed_at,
          disabilityType: app.disability_type,
        };
      })
    );

    res.json(formattedApplications);
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({ message: "Error fetching applications" });
  }
});

// Add undo status endpoint
router.post("/application/:id/undo", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get current status
    const [currentStatus] = await pool.query(
      "SELECT service_status FROM registration_progress WHERE application_id = ?",
      [id]
    );

    if (!currentStatus[0]) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Store the previous status for logging
    const previousStatus = currentStatus[0].service_status;

    // Update to under_review status instead of pending
    await pool.query(
      `UPDATE registration_progress 
       SET service_status = ?, 
           last_updated_by = ?, 
           last_action_at = CURRENT_TIMESTAMP 
       WHERE application_id = ?`,
      ["under_review", userId, id]
    );

    // Log the undo action
    await pool.query(
      `INSERT INTO action_logs 
       (user_id, action_type, application_id, previous_status, new_status) 
       VALUES (?, 'undo', ?, ?, ?)`,
      [userId, id, previousStatus, "under_review"]
    );

    // Get admin user info first
    const [userInfo] = await pool.query(
      `SELECT full_name, email, role FROM users WHERE id = ?`,
      [userId]
    );

    // Verify this is an admin/staff user
    if (!userInfo[0] || !["admin", "staff"].includes(userInfo[0].role)) {
      throw new Error("Unauthorized: Only admin/staff can perform this action");
    }

    res.json({
      status: "under_review",
      updatedBy: userInfo[0].full_name,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error undoing status:", error);
    res.status(500).json({ message: "Error undoing status" });
  }
});

// Update the status update endpoint to include user info
router.put("/application/:id/status", authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const applicationId = req.params.id;
    const userId = req.user.id;

    // Update application status
    await pool.query(
      `UPDATE registration_progress 
       SET service_status = ?, 
           last_updated_by = ?, 
           last_action_at = CURRENT_TIMESTAMP 
       WHERE application_id = ?`,
      [status, userId, applicationId]
    );

    // Get the previous status for logging
    const [prevStatus] = await pool.query(
      "SELECT service_status FROM registration_progress WHERE application_id = ?",
      [applicationId]
    );

    // Log the action
    await pool.query(
      `INSERT INTO action_logs (user_id, action_type, application_id, previous_status, new_status) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        userId,
        status === "pending" ? "undo" : status,
        applicationId,
        prevStatus[0].service_status,
        status,
      ]
    );

    // Get user info for response
    const [userInfo] = await pool.query(
      `SELECT full_name FROM users WHERE id = ?`,
      [userId]
    );

    res.json({
      status,
      updatedBy: userInfo[0].full_name,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating application:", error);
    res.status(500).json({ message: "Error updating application status" });
  }
});

// Get application details
router.get("/applications/:id", authenticateToken, async (req, res) => {
  try {
    // Update status to under_review if it's pending
    await pool.query(
      `UPDATE registration_progress 
       SET service_status = CASE 
         WHEN service_status IS NULL OR service_status = 'pending' 
         THEN 'under_review' 
         ELSE service_status 
       END,
       last_updated_by = CASE 
         WHEN service_status IS NULL OR service_status = 'pending' 
         THEN ? 
         ELSE last_updated_by 
       END,
       last_action_at = CASE 
         WHEN service_status IS NULL OR service_status = 'pending' 
         THEN CURRENT_TIMESTAMP 
         ELSE last_action_at 
       END
       WHERE application_id = ?`,
      [req.user.id, req.params.id]
    );

    // Get basic application info
    const [applicationInfo] = await pool.query(
      `SELECT 
         rp.*,
         COALESCE(staff.full_name, ru.username) as last_updated_by,
         CASE 
           WHEN rp.last_action_at IS NULL OR rp.last_action_at = '0000-00-00 00:00:00' THEN NULL
           ELSE DATE_FORMAT(rp.last_action_at, '%Y-%m-%d %H:%i:%s')
         END as formatted_update_time,
         ru.email,
         ru.username
       FROM registration_progress rp
       LEFT JOIN registered_users ru ON rp.user_id = ru.id
       LEFT JOIN users staff ON rp.last_updated_by = staff.id AND rp.last_updated_by IS NOT NULL
       WHERE rp.application_id = ?`,
      [req.params.id]
    );

    if (applicationInfo.length === 0) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Log the status change if it was updated
    if (applicationInfo[0].service_status === "under_review") {
      await pool.query(
        `INSERT INTO action_logs (user_id, action_type, application_id, previous_status, new_status) 
         VALUES (?, 'review', ?, 'pending', 'under_review')`,
        [req.user.id, req.params.id]
      );
    }

    // Format the basic info to match expected structure
    const formattedInfo = {
      applicationId: applicationInfo[0].application_id,
      submittedAt: applicationInfo[0].completed_at,
      service_status: applicationInfo[0].service_status,
      email: applicationInfo[0].email,
      username: applicationInfo[0].username,
      last_updated_by: applicationInfo[0].last_updated_by || null,
      last_action_at: applicationInfo[0].formatted_update_time || null,
    };

    // Get form sections with responses
    const [sections] = await pool.query(
      `SELECT 
        fs.id,
        fs.name,
        fs.order_index,
        ff.id as field_id,
        ff.name as field_name,
        ff.display_name,
        ff.field_type,
        rr.value
      FROM form_sections fs
      JOIN form_fields ff ON fs.id = ff.section_id
      LEFT JOIN registration_responses rr 
        ON ff.id = rr.field_id 
        AND rr.registration_id = ?
      ORDER BY fs.order_index, ff.order_index`,
      [applicationInfo[0].id]
    );

    // Organize sections and fields
    const organizedSections = sections.reduce((acc, row) => {
      let section = acc.find((s) => s.id === row.id);
      if (!section) {
        section = {
          id: row.id,
          name: row.name,
          order_index: row.order_index,
          fields: [],
        };
        acc.push(section);
      }

      section.fields.push({
        id: row.field_id,
        name: row.field_name,
        display_name: row.display_name,
        field_type: row.field_type,
        value: row.value,
      });

      return acc;
    }, []);

    // Return combined data
    res.json({
      ...formattedInfo,
      sections: organizedSections,
    });
  } catch (error) {
    console.error("Error fetching application:", error);
    res.status(500).json({ message: "Error fetching application" });
  }
});

// Get action logs
router.get(
  "/logs",
  authenticateToken,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const { actionType, date, userQuery } = req.query;

      let query = `
      SELECT 
        al.*,
        u.full_name as user_name,
        u.email as user_email,
        u.role as user_role
      FROM action_logs al
      JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
      const params = [];

      if (actionType) {
        query += ` AND al.action_type = ?`;
        params.push(actionType);
      }

      if (date) {
        query += ` AND DATE(al.performed_at) = ?`;
        params.push(date);
      }

      if (userQuery) {
        query += ` AND (u.full_name LIKE ? OR u.email LIKE ?)`;
        params.push(`%${userQuery}%`, `%${userQuery}%`);
      }

      query += ` ORDER BY al.performed_at DESC`;

      const [logs] = await pool.query(query, params);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching logs:", error);
      res.status(500).json({ message: "Error fetching logs" });
    }
  }
);

// Update application status
router.put("/applications/:id/status", authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const applicationId = req.params.id;
    const userId = req.user.id;

    // Update application status
    await pool.query(
      `UPDATE registration_progress 
       SET service_status = ?, 
           last_updated_by = ?, 
           last_action_at = CURRENT_TIMESTAMP 
       WHERE application_id = ?`,
      [status, userId, applicationId]
    );

    // Get the previous status for logging
    const [prevStatus] = await pool.query(
      "SELECT service_status FROM registration_progress WHERE application_id = ?",
      [applicationId]
    );

    // Log the action
    await pool.query(
      `INSERT INTO action_logs (user_id, action_type, application_id, previous_status, new_status) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        userId,
        status === "pending" ? "undo" : status,
        applicationId,
        prevStatus[0].service_status,
        status,
      ]
    );

    // Get user info for response
    const [userInfo] = await pool.query(
      `SELECT full_name FROM users WHERE id = ?`,
      [userId]
    );

    res.json({
      status,
      updatedBy: userInfo[0].full_name,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating application:", error);
    res.status(500).json({ message: "Error updating application status" });
  }
});

module.exports = router;
