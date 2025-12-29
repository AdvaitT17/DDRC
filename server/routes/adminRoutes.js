const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const {
  authenticateToken,
  requireRole,
} = require("../middleware/authMiddleware");
const tokenManager = require("../utils/temporaryAccess");
const { upload, handleMulterError } = require("../middleware/uploadMiddleware");
const path = require("path");
const fs = require("fs");
const { uploadsDir, generateUniqueFilename } = require("../config/upload");
const storageService = require("../services/storageService");

// Generate temporary file access URL
router.get(
  "/files/access-url/*",
  authenticateToken,
  requireRole(["admin", "staff"]),
  async (req, res) => {
    try {
      const filePath = req.params[0];
      // Remove any leading slashes and 'uploads/' from the path
      const cleanPath = filePath.replace(/^\/?(uploads\/)?/, "");

      const accessToken = tokenManager.generateToken(cleanPath, req.user.id);

      res.json({
        accessUrl: `/uploads/${cleanPath}?access_token=${accessToken}`,
      });
    } catch (error) {
      console.error("Error generating file access URL:", error);
      res.status(500).json({ message: "Error generating file access URL" });
    }
  }
);

// Get dashboard stats - OPTIMIZED to use single query
router.get("/stats", async (req, res) => {
  try {
    // OPTIMIZATION: Get all stats in a single query using subqueries
    const [stats] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM registration_progress) as totalRegistrations,
        (SELECT COUNT(*) FROM registration_progress 
         WHERE status = 'completed' 
         AND (service_status = 'pending' OR service_status = 'under_review')) as applicationsToReview,
        (SELECT COUNT(*) FROM registration_progress 
         WHERE status = 'in_progress') as incompleteRegistrations,
        (SELECT COUNT(*) FROM registration_progress 
         WHERE service_status = 'approved' 
         AND DATE(updated_at) = CURDATE()) as approvedToday,
        (SELECT COUNT(*) FROM registered_users 
         WHERE last_login >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as activeUsers
    `);

    res.json({
      totalRegistrations: stats[0].totalRegistrations,
      applicationsToReview: stats[0].applicationsToReview,
      incompleteRegistrations: stats[0].incompleteRegistrations,
      approvedToday: stats[0].approvedToday,
      activeUsers: stats[0].activeUsers,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ message: "Error fetching stats" });
  }
});

// Get recent applications (only showing those awaiting review) - OPTIMIZED
router.get("/recent-applications", async (req, res) => {
  try {
    const [applications] = await pool.query(
      `SELECT DISTINCT
        rp.application_id,
        rp.completed_at,
        rp.service_status,
        rp.id,
        ru.email,
        (
          SELECT rr.value 
          FROM registration_responses rr
          JOIN form_fields ff ON rr.field_id = ff.id
          WHERE rr.registration_id = rp.id 
          AND ff.name = 'disabilitytype'
        ) as disability_type,
        (
          SELECT rr.value 
          FROM registration_responses rr
          WHERE rr.registration_id = rp.id 
          AND rr.field_id = 13
        ) as location_data
      FROM registration_progress rp
      JOIN registered_users ru ON rp.user_id = ru.id
      WHERE rp.status = 'completed'
      AND (rp.service_status = 'pending' OR rp.service_status = 'under_review')
      ORDER BY rp.completed_at DESC
      LIMIT 10`
    );

    // OPTIMIZATION: Get ALL responses for these applications in ONE query
    const applicationIds = applications.map(app => app.id);
    let allResponses = [];
    if (applicationIds.length > 0) {
      const [responses] = await pool.query(
        `SELECT 
          rr.registration_id,
          ff.name,
          rr.value
         FROM registration_responses rr
         JOIN form_fields ff ON rr.field_id = ff.id
         WHERE rr.registration_id IN (?)`,
        [applicationIds]
      );
      allResponses = responses;
    }

    // Group responses by registration_id
    const responsesByApplication = allResponses.reduce((acc, resp) => {
      if (!acc[resp.registration_id]) {
        acc[resp.registration_id] = [];
      }
      acc[resp.registration_id].push(resp);
      return acc;
    }, {});

    // Format applications using the batched data
    const formattedApplications = applications.map((app) => {
      const responses = responsesByApplication[app.id] || [];
      const formData = responses.reduce((acc, curr) => {
        acc[curr.name] = curr.value;
        return acc;
      }, {});

      return {
        applicationId: app.application_id,
        applicantName: `${formData.firstname || ""} ${formData.lastname || ""
          }`.trim(),
        email: app.email,
        submittedAt: app.completed_at,
        disabilityType: app.disability_type,
        status: app.service_status || "pending",
        location: app.location_data || "",
      };
    });

    res.json(formattedApplications);
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({ message: "Error fetching applications" });
  }
});

// Get all applications
router.get("/all-applications", async (req, res) => {
  try {
    const [applications] = await pool.query(
      `SELECT DISTINCT
        rp.application_id,
        rp.completed_at,
        rp.service_status,
        rp.id,
        ru.email,
        (
          SELECT rr.value 
          FROM registration_responses rr
          JOIN form_fields ff ON rr.field_id = ff.id
          WHERE rr.registration_id = rp.id 
          AND ff.name = 'disabilitytype'
        ) as disability_type,
        (
          SELECT rr.value 
          FROM registration_responses rr
          WHERE rr.registration_id = rp.id 
          AND rr.field_id = 13
        ) as location_data
      FROM registration_progress rp
      JOIN registered_users ru ON rp.user_id = ru.id
      WHERE rp.status = 'completed'
      ORDER BY rp.completed_at DESC`
    );

    // OPTIMIZATION: Get ALL responses for these applications in ONE query
    const applicationIds = applications.map(app => app.id);
    let allResponses = [];

    if (applicationIds.length > 0) {
      const [responses] = await pool.query(
        `SELECT 
          rr.registration_id,
          ff.name,
          rr.value
         FROM registration_responses rr
         JOIN form_fields ff ON rr.field_id = ff.id
         WHERE rr.registration_id IN (?)`,
        [applicationIds]
      );
      allResponses = responses;
    }

    // Group responses by registration_id
    const responsesByApplication = allResponses.reduce((acc, resp) => {
      if (!acc[resp.registration_id]) {
        acc[resp.registration_id] = [];
      }
      acc[resp.registration_id].push(resp);
      return acc;
    }, {});

    // Format applications using the batched data
    const formattedApplications = applications.map((app) => {
      const responses = responsesByApplication[app.id] || [];
      const formData = responses.reduce((acc, curr) => {
        acc[curr.name] = curr.value;
        return acc;
      }, {});

      return {
        applicationId: app.application_id,
        applicantName: `${formData.firstname || ""} ${formData.lastname || ""
          }`.trim(),
        email: app.email,
        submittedAt: app.completed_at,
        disabilityType: app.disability_type,
        status: app.service_status || "pending",
        location: app.location_data || "", // Include location data
      };
    });

    res.json(formattedApplications);
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({ message: "Error fetching applications" });
  }
});

// Get incomplete registrations - OPTIMIZED to avoid N+1 queries
router.get("/incomplete-registrations", async (req, res) => {
  try {
    // Get inactivity threshold from query params (in hours)
    const inactivityThreshold = parseInt(req.query.inactivityThreshold || 0);

    // Helper function to calculate inactive time in hours
    function getInactiveTime(timestamp) {
      const lastUpdated = new Date(timestamp);
      const now = new Date();
      const diffMs = now - lastUpdated;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      return diffHours;
    }

    // First get all registration records with in_progress status
    const [registrations] = await pool.query(
      `SELECT 
        rp.id,
        rp.user_id,
        rp.application_id,
        rp.created_at,
        rp.updated_at,
        ru.email,
        ru.phone,
        ru.username,
        rp.current_section_id,
        rp.status
      FROM registration_progress rp
      JOIN registered_users ru ON rp.user_id = ru.id
      WHERE rp.status = 'in_progress'
      ORDER BY rp.updated_at DESC`
    );

    // OPTIMIZATION: Get ALL responses for ALL registrations in ONE query
    const registrationIds = registrations.map(r => r.id);
    let allResponses = [];
    if (registrationIds.length > 0) {
      const [responses] = await pool.query(
        `SELECT 
          rr.registration_id,
          ff.name,
          rr.value,
          ff.display_name
         FROM registration_responses rr
         JOIN form_fields ff ON rr.field_id = ff.id
         WHERE rr.registration_id IN (?)`,
        [registrationIds]
      );
      allResponses = responses;
    }

    // OPTIMIZATION: Get ALL section names in ONE query
    const sectionIds = registrations
      .filter(r => r.current_section_id)
      .map(r => r.current_section_id);
    let sectionMap = {};
    if (sectionIds.length > 0) {
      const [sections] = await pool.query(
        `SELECT id, name FROM form_sections WHERE id IN (?)`,
        [sectionIds]
      );
      sectionMap = sections.reduce((acc, s) => {
        acc[s.id] = s.name;
        return acc;
      }, {});
    }

    // Group responses by registration_id in memory
    const responsesByRegistration = allResponses.reduce((acc, resp) => {
      if (!acc[resp.registration_id]) {
        acc[resp.registration_id] = [];
      }
      acc[resp.registration_id].push(resp);
      return acc;
    }, {});

    // Format registrations using the batched data
    const formattedRegistrations = registrations.map((reg) => {
      const responses = responsesByRegistration[reg.id] || [];

      const formData = responses.reduce((acc, curr) => {
        acc[curr.name] = curr.value;
        acc.displayNames = acc.displayNames || {};
        acc.displayNames[curr.name] = curr.display_name;
        return acc;
      }, {});

      const firstName = formData.firstname || "";
      const lastName = formData.lastname || "";
      const fullName = `${firstName} ${lastName}`.trim() || reg.username;

      return {
        id: reg.id,
        userId: reg.user_id,
        applicationId: reg.application_id || `TEMP-${reg.id}`,
        createdAt: reg.created_at,
        lastUpdated: reg.updated_at,
        email: reg.email,
        phone: reg.phone,
        applicantName: fullName,
        currentSection: reg.current_section_id ? (sectionMap[reg.current_section_id] || "Not started") : "Not started",
        responses: responses.map((r) => ({
          fieldName: r.name,
          displayName: r.display_name,
          value: r.value,
        })),
        disabilityType: formData.disabilitytype || "Not specified",
        inactive: getInactiveTime(reg.updated_at),
      };
    });

    // Now get registered users who don't have any registration_progress record
    const [usersWithoutProgress] = await pool.query(
      `SELECT 
        ru.id as user_id,
        ru.email,
        ru.phone,
        ru.username,
        ru.created_at
      FROM registered_users ru
      LEFT JOIN registration_progress rp ON ru.id = rp.user_id
      WHERE (rp.id IS NULL OR (rp.status != 'completed' AND rp.status != 'in_progress'))
      ORDER BY ru.created_at DESC`
    );

    // Create placeholder registration objects for users without progress
    const newUserPlaceholders = usersWithoutProgress.map((user) => ({
      id: null,
      userId: user.user_id,
      applicationId: `TEMP-${user.user_id}`,
      createdAt: user.created_at,
      lastUpdated: user.created_at,
      email: user.email,
      phone: user.phone,
      applicantName: user.username,
      currentSection: "Not started",
      responses: [],
      disabilityType: "Not specified",
      inactive: getInactiveTime(user.created_at),
    }));

    // Combine the existing registrations with the placeholder ones
    let allIncompleteRegistrations = [
      ...formattedRegistrations,
      ...newUserPlaceholders,
    ];

    // Apply inactivity threshold filter
    if (inactivityThreshold > 0) {
      allIncompleteRegistrations = allIncompleteRegistrations.filter(
        (reg) => reg.inactive >= inactivityThreshold
      );
    }

    // Sort by last updated/created date
    allIncompleteRegistrations.sort(
      (a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated)
    );

    res.json(allIncompleteRegistrations);
  } catch (error) {
    console.error("Error fetching incomplete registrations:", error);
    res
      .status(500)
      .json({ message: "Error fetching incomplete registrations" });
  }
});

// Add file upload endpoint for incomplete registrations
router.post(
  "/incomplete-registrations/upload-file",
  upload.single("file"),
  handleMulterError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fieldId = req.body.fieldId;
      if (!fieldId) {
        return res.status(400).json({ message: "Field ID is required" });
      }

      // Generate a unique filename and save using storage service
      const filename = storageService.generateFilename(req.file.originalname);
      await storageService.saveFile(req.file.buffer, 'forms', filename);

      // Return the relative path that will be stored in the database
      const filePath = `forms/${filename}`;

      res.json({
        message: "File uploaded successfully",
        filePath: filePath,
        fieldId: fieldId,
      });
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ message: "Error uploading file" });
    }
  }
);

// Add file upload endpoint for regular applications
router.post(
  "/applications/upload-file",
  upload.single("file"),
  handleMulterError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fieldId = req.body.fieldId;
      if (!fieldId) {
        return res.status(400).json({ message: "Field ID is required" });
      }

      // Generate a unique filename and save using storage service
      const filename = storageService.generateFilename(req.file.originalname);
      await storageService.saveFile(req.file.buffer, 'forms', filename);

      // Return the relative path that will be stored in the database
      const filePath = `forms/${filename}`;

      res.json({
        message: "File uploaded successfully",
        filePath: filePath,
        fieldId: fieldId,
      });
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ message: "Error uploading file" });
    }
  }
);

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
       WHERE application_id = ? `,
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
       WHERE rp.application_id = ? `,
      [req.params.id]
    );

    if (applicationInfo.length === 0) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Log the status change if it was updated
    if (applicationInfo[0].service_status === "under_review") {
      await pool.query(
        `INSERT INTO action_logs(user_id, action_type, application_id, previous_status, new_status)
VALUES(?, 'review', ?, 'pending', 'under_review')`,
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
  ff.options,
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
        options: row.options,
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
      WHERE 1 = 1
  `;
      const params = [];

      if (actionType) {
        query += ` AND al.action_type = ? `;
        params.push(actionType);
      }

      if (date) {
        query += ` AND DATE(al.performed_at) = ? `;
        params.push(date);
      }

      if (userQuery) {
        query += ` AND(u.full_name LIKE ? OR u.email LIKE ?)`;
        params.push(`% ${userQuery}% `, ` % ${userQuery}% `);
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
       WHERE application_id = ? `,
      [status, userId, applicationId]
    );

    // Get the previous status for logging
    const [prevStatus] = await pool.query(
      "SELECT service_status FROM registration_progress WHERE application_id = ?",
      [applicationId]
    );

    // Log the action
    await pool.query(
      `INSERT INTO action_logs(user_id, action_type, application_id, previous_status, new_status)
VALUES(?, ?, ?, ?, ?)`,
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
      `SELECT full_name FROM users WHERE id = ? `,
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

// Edit a single response
router.put(
  "/applications/:id/responses/:field_id",
  authenticateToken,
  requireRole(["admin", "staff"]),
  async (req, res) => {
    try {
      const { id, field_id } = req.params;
      const { value, reason, user_consent, original_file_name } = req.body;
      const userId = req.user.id;

      // Validate admin input (warning only, doesn't block)
      let validationWarnings = null;
      if (value && value !== "__FILE_REMOVED__") {
        const validationService = require('../services/validationService');
        const validation = await validationService.validateFormData({
          [field_id]: value
        });

        // Log validation warnings but don't block admin
        if (!validation.isValid) {
          console.warn(`Admin edit validation warning for field ${field_id}: `, validation.errors);
          validationWarnings = validation.errors;
        }
      }

      // Get the registration ID from the application ID
      const [registration] = await pool.query(
        "SELECT id FROM registration_progress WHERE application_id = ?",
        [id]
      );

      if (registration.length === 0) {
        return res.status(404).json({ message: "Application not found" });
      }

      const registrationId = registration[0].id;

      // Get the current value of the field
      const [currentResponse] = await pool.query(
        "SELECT value FROM registration_responses WHERE registration_id = ? AND field_id = ?",
        [registrationId, field_id]
      );

      const previousValue =
        currentResponse.length > 0 ? currentResponse[0].value : null;

      // Get field information
      const [fieldInfo] = await pool.query(
        "SELECT name, display_name, field_type FROM form_fields WHERE id = ?",
        [field_id]
      );

      if (fieldInfo.length === 0) {
        return res.status(404).json({ message: "Field not found" });
      }

      // Check if this is a file field that was deleted (indicated by __FILE_REMOVED__ value)
      const isFileRemoval =
        value === "__FILE_REMOVED__" &&
        (fieldInfo[0].field_type === "file" || previousValue?.includes("/"));

      // If this is a file removal, store empty string in database but preserve special value for logs
      const valueToSave = isFileRemoval ? "" : value;

      // Update the response in the database
      if (currentResponse.length > 0) {
        await pool.query(
          "UPDATE registration_responses SET value = ? WHERE registration_id = ? AND field_id = ?",
          [valueToSave, registrationId, field_id]
        );
      } else {
        await pool.query(
          "INSERT INTO registration_responses (registration_id, field_id, value) VALUES (?, ?, ?)",
          [registrationId, field_id, valueToSave]
        );
      }

      // For file removals, use the provided original file name if available
      let logPreviousValue = previousValue;
      if (
        isFileRemoval &&
        original_file_name &&
        (previousValue === null || previousValue === "")
      ) {
        // If we're removing a file but the database already has an empty value
        // (because file was deleted from server first), use the original_file_name
        logPreviousValue = `uploads / forms / ${original_file_name} `;
      }

      // Create edit details JSON
      const editDetails = {
        field_id: parseInt(field_id),
        field_name: fieldInfo[0].name,
        display_name: fieldInfo[0].display_name,
        field_type: fieldInfo[0].field_type,
        previous_value: logPreviousValue,
        new_value: isFileRemoval ? "__FILE_REMOVED__" : value, // Keep special value for logs
        reason: reason || "No reason provided",
        user_consent: user_consent || false,
      };

      // Log the action
      await pool.query(
        `INSERT INTO action_logs
  (user_id, action_type, application_id, edit_details)
VALUES(?, 'edit_response', ?, ?)`,
        [userId, id, JSON.stringify(editDetails)]
      );

      // Get user info for response
      const [userInfo] = await pool.query(
        `SELECT full_name FROM users WHERE id = ? `,
        [userId]
      );

      res.json({
        message: "Response updated successfully",
        validationWarnings: validationWarnings, // Include warnings if any
        updatedBy: userInfo[0].full_name,
        updatedAt: new Date().toISOString(),
        field: fieldInfo[0].name,
        previousValue,
        newValue: value,
      });
    } catch (error) {
      console.error("Error updating response:", error);
      res.status(500).json({ message: "Error updating response" });
    }
  }
);

// Batch edit multiple responses
router.put(
  "/applications/:id/responses",
  authenticateToken,
  requireRole(["admin", "staff"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { responses, user_consent } = req.body;
      const userId = req.user.id;

      if (!Array.isArray(responses) || responses.length === 0) {
        return res
          .status(400)
          .json({ message: "No responses provided for update" });
      }

      // Get the registration ID from the application ID
      const [registration] = await pool.query(
        "SELECT id FROM registration_progress WHERE application_id = ?",
        [id]
      );

      if (registration.length === 0) {
        return res.status(404).json({ message: "Application not found" });
      }

      const registrationId = registration[0].id;

      // Validate all changes (warning only, doesn't block)
      const validationService = require('../services/validationService');
      const allValidationWarnings = [];

      for (const response of responses) {
        if (response.value && response.value !== "__FILE_REMOVED__") {
          const validation = await validationService.validateFormData({
            [response.field_id]: response.value
          });

          if (!validation.isValid) {
            allValidationWarnings.push(...validation.errors);
            console.warn(`Admin batch edit validation warning for field ${response.field_id}: `, validation.errors);
          }
        }
      }

      const conn = await pool.getConnection();

      try {
        await conn.beginTransaction();

        const editResults = [];

        // Process each response
        for (const response of responses) {
          const { field_id, value, reason, original_file_name } = response;

          // Get the current value of the field
          const [currentResponse] = await conn.query(
            "SELECT value FROM registration_responses WHERE registration_id = ? AND field_id = ?",
            [registrationId, field_id]
          );

          const previousValue =
            currentResponse.length > 0 ? currentResponse[0].value : null;

          // Get field information
          const [fieldInfo] = await conn.query(
            "SELECT name, display_name, field_type FROM form_fields WHERE id = ?",
            [field_id]
          );

          if (fieldInfo.length === 0) {
            continue; // Skip this field if not found
          }

          // Check if this is a file field that was deleted (indicated by __FILE_REMOVED__ value)
          const isFileRemoval =
            value === "__FILE_REMOVED__" &&
            (fieldInfo[0].field_type === "file" ||
              previousValue?.includes("/"));

          // If this is a file removal, store empty string in database but preserve special value for logs
          const valueToSave = isFileRemoval ? "" : value;

          // Update the response in the database
          if (currentResponse.length > 0) {
            await conn.query(
              "UPDATE registration_responses SET value = ? WHERE registration_id = ? AND field_id = ?",
              [valueToSave, registrationId, field_id]
            );
          } else {
            await conn.query(
              "INSERT INTO registration_responses (registration_id, field_id, value) VALUES (?, ?, ?)",
              [registrationId, field_id, valueToSave]
            );
          }

          // For file removals, use the provided original file name if available
          let logPreviousValue = previousValue;
          if (
            isFileRemoval &&
            original_file_name &&
            (previousValue === null || previousValue === "")
          ) {
            // If we're removing a file but the database already has an empty value
            // (because file was deleted from server first), use the original_file_name
            logPreviousValue = `uploads / forms / ${original_file_name} `;
          }

          // Create edit details JSON
          const editDetails = {
            field_id: parseInt(field_id),
            field_name: fieldInfo[0].name,
            display_name: fieldInfo[0].display_name,
            field_type: fieldInfo[0].field_type,
            previous_value: logPreviousValue,
            new_value: isFileRemoval ? "__FILE_REMOVED__" : value, // Keep special value for logs
            reason: reason || "No reason provided",
            user_consent: user_consent || false,
          };

          // Log the action
          await conn.query(
            `INSERT INTO action_logs
  (user_id, action_type, application_id, edit_details)
VALUES(?, 'edit_response', ?, ?)`,
            [userId, id, JSON.stringify(editDetails)]
          );

          editResults.push({
            field_id,
            field_name: fieldInfo[0].name,
            display_name: fieldInfo[0].display_name,
            previousValue,
            newValue: value,
          });
        }

        await conn.commit();

        // Get user info for response
        const [userInfo] = await pool.query(
          `SELECT full_name FROM users WHERE id = ? `,
          [userId]
        );

        res.json({
          message: "Responses updated successfully",
          updatedBy: userInfo[0].full_name,
          updatedAt: new Date().toISOString(),
          editResults,
          validationWarnings: allValidationWarnings.length > 0 ? allValidationWarnings : null
        });
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }
    } catch (error) {
      console.error("Error updating responses:", error);
      res.status(500).json({ message: "Error updating responses" });
    }
  }
);

// Get edit history for an application
router.get(
  "/applications/:id/edit-history",
  authenticateToken,
  requireRole(["admin", "staff"]),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Get all edit actions for this application
      const [editLogs] = await pool.query(
        `SELECT
al.*,
  u.full_name as user_name,
  u.role as user_role
      FROM action_logs al
      JOIN users u ON al.user_id = u.id
      WHERE al.application_id = ? AND al.action_type = 'edit_response'
      ORDER BY al.performed_at DESC`,
        [id]
      );

      // Format the logs
      const formattedLogs = editLogs.map((log) => {
        try {
          const editDetails = log.edit_details
            ? JSON.parse(log.edit_details)
            : {};
          return {
            id: log.id,
            timestamp: log.performed_at,
            user: log.user_name,
            userRole: log.user_role,
            field: {
              id: editDetails.field_id || 0,
              name: editDetails.field_name || "Unknown",
              display_name: editDetails.display_name || "Unknown Field",
              type: editDetails.field_type || "text",
            },
            previousValue: editDetails.previous_value,
            newValue: editDetails.new_value,
            reason: editDetails.reason || "No reason provided",
            userConsent: editDetails.user_consent || false,
          };
        } catch (error) {
          console.error(
            `Error parsing edit_details for log ID ${log.id}: `,
            error
          );
          // Return a fallback object for logs with invalid JSON
          return {
            id: log.id,
            timestamp: log.performed_at,
            user: log.user_name,
            userRole: log.user_role,
            field: {
              id: 0,
              name: "error",
              display_name: "Error: Could not parse edit details",
              type: "text",
            },
            previousValue: null,
            newValue: null,
            reason: "Error: Could not parse edit details",
            userConsent: false,
          };
        }
      });

      res.json(formattedLogs);
    } catch (error) {
      console.error("Error fetching edit history:", error);
      res.status(500).json({ message: "Error fetching edit history" });
    }
  }
);

// Update incomplete registration responses
router.put(
  "/incomplete-registrations/:id/responses",
  authenticateToken,
  requireRole(["admin", "staff"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { responses, user_consent } = req.body;
      const userId = req.user.id;

      // Verify the registration exists and is incomplete
      const [registration] = await pool.query(
        "SELECT * FROM registration_progress WHERE id = ? AND status = 'in_progress'",
        [id]
      );

      if (registration.length === 0) {
        return res
          .status(404)
          .json({ message: "Incomplete registration not found" });
      }

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        // Process all responses
        for (const response of responses) {
          const fieldId = response.field_id; // May be string or number
          const { value, reason, original_file_name } = response;

          // Get field information
          const [fieldInfo] = await conn.query(
            "SELECT name, display_name, field_type FROM form_fields WHERE id = ?",
            [fieldId]
          );

          if (fieldInfo.length === 0) {
            continue; // Skip if field not found
          }

          // Get current value for tracking changes
          const [currentResponse] = await conn.query(
            "SELECT value FROM registration_responses WHERE registration_id = ? AND field_id = ?",
            [id, fieldId]
          );

          const previousValue =
            currentResponse.length > 0 ? currentResponse[0].value : null;

          // Check if this is a file field that was deleted (indicated by __FILE_REMOVED__ value)
          const isFileRemoval =
            value === "__FILE_REMOVED__" &&
            (fieldInfo[0].field_type === "file" ||
              previousValue?.includes("/"));

          // If this is a file removal, store empty string in database but preserve special value for logs
          const valueToSave = isFileRemoval ? "" : value;

          // Insert or update the response
          if (currentResponse.length > 0) {
            await conn.query(
              "UPDATE registration_responses SET value = ? WHERE registration_id = ? AND field_id = ?",
              [valueToSave, id, fieldId]
            );
          } else {
            await conn.query(
              "INSERT INTO registration_responses (registration_id, field_id, value) VALUES (?, ?, ?)",
              [id, fieldId, valueToSave]
            );
          }

          // For file removals, use the provided original file name if available
          let logPreviousValue = previousValue;
          if (
            isFileRemoval &&
            original_file_name &&
            (previousValue === null || previousValue === "")
          ) {
            // If we're removing a file but the database already has an empty value
            // (because file was deleted from server first), use the original_file_name
            logPreviousValue = `uploads / forms / ${original_file_name} `;
          }

          // Log the edit
          await conn.query(
            `INSERT INTO action_logs
  (user_id, action_type, application_id, edit_details)
VALUES(?, 'edit_incomplete', ?, ?)`,
            [
              userId,
              registration[0].application_id || `TEMP - ${id} `,
              JSON.stringify({
                field_id: parseInt(fieldId) || fieldId,
                field_name: fieldInfo[0].name,
                display_name: fieldInfo[0].display_name,
                field_type: fieldInfo[0].field_type,
                previous_value: logPreviousValue,
                new_value: isFileRemoval ? "__FILE_REMOVED__" : value,
                reason: reason || "No reason provided",
                user_consent: user_consent || false,
                registration_id: parseInt(id),
                registration_status: "in_progress",
                user_email: registration[0].email,
                timestamp: new Date().toISOString(),
                modification_type: "incomplete_registration_field_edit",
                summary: `Staff member edited field "${fieldInfo[0].display_name}" in an incomplete registration.`,
              }),
            ]
          );
        }

        // Update the last modified time
        await conn.query(
          "UPDATE registration_progress SET updated_at = CURRENT_TIMESTAMP, last_updated_by = ? WHERE id = ?",
          [userId, id]
        );

        await conn.commit();

        // Get user info for response
        const [userInfo] = await pool.query(
          `SELECT full_name FROM users WHERE id = ? `,
          [userId]
        );

        res.json({
          message: "Registration responses updated successfully",
          updatedBy: userInfo[0].full_name,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        await conn.rollback();
        console.error("Database error updating registration:", error);
        throw error;
      } finally {
        conn.release();
      }
    } catch (error) {
      console.error("Error updating incomplete registration:", error);
      res.status(500).json({
        message: "Error updating responses",
        details: error.message,
      });
    }
  }
);

// Mark incomplete registration as complete
router.post(
  "/incomplete-registrations/:id/complete",
  authenticateToken,
  requireRole(["admin", "staff"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Verify the registration exists and is incomplete
      const [registration] = await pool.query(
        "SELECT * FROM registration_progress WHERE id = ? AND status = 'in_progress'",
        [id]
      );

      if (registration.length === 0) {
        return res
          .status(404)
          .json({ message: "Incomplete registration not found" });
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

        // Update the registration status to completed
        await conn.query(
          `UPDATE registration_progress SET
status = 'completed',
  service_status = 'pending',
  completed_at = CURRENT_TIMESTAMP,
  last_updated_by = ?,
  last_action_at = CURRENT_TIMESTAMP,
  application_id = ?
    WHERE id = ? `,
          [userId, applicationId, id]
        );

        // Log the action
        await conn.query(
          `INSERT INTO action_logs
  (user_id, action_type, application_id, previous_status, new_status, edit_details)
VALUES(?, 'complete_registration', ?, 'in_progress', 'completed', ?)`,
          [
            userId,
            applicationId,
            JSON.stringify({
              registration_id: parseInt(id),
              action: "Mark incomplete registration as complete",
              note: "Registration completed by department staff",
              timestamp: new Date().toISOString(),
              user_email: registration[0].email,
              current_section: registration[0].current_section_id,
              created_at: registration[0].created_at,
              updated_at: registration[0].updated_at,
              completion_details:
                "Moved from incomplete status to awaiting review queue",
              summary:
                "Department staff marked an incomplete registration as complete, moving it to the applications queue for review.",
            }),
          ]
        );

        await conn.commit();

        // Get user info for response
        const [userInfo] = await pool.query(
          `SELECT full_name FROM users WHERE id = ? `,
          [userId]
        );

        res.json({
          message: "Registration marked as complete",
          updatedBy: userInfo[0].full_name,
          updatedAt: new Date().toISOString(),
          applicationId: applicationId, // Send back the generated application ID
        });
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }
    } catch (error) {
      console.error("Error completing registration:", error);
      res
        .status(500)
        .json({ message: "Error marking registration as complete" });
    }
  }
);

// Create a registration record for a user who hasn't started any form
router.post(
  "/incomplete-registrations/create",
  authenticateToken,
  requireRole(["admin", "staff"]),
  async (req, res) => {
    try {
      const { userId } = req.body;
      const staffUserId = req.user.id;

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      // Verify the user exists
      const [userExists] = await pool.query(
        "SELECT id, email FROM registered_users WHERE id = ?",
        [userId]
      );

      if (userExists.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user already has an in_progress registration
      const [existingReg] = await pool.query(
        "SELECT id FROM registration_progress WHERE user_id = ? AND status = 'in_progress'",
        [userId]
      );

      let registrationId;

      if (existingReg.length > 0) {
        // Use existing registration
        registrationId = existingReg[0].id;
      } else {
        // Create a new registration record
        const [result] = await pool.query(
          `INSERT INTO registration_progress
  (user_id, status, current_section_id, created_at, updated_at, last_updated_by)
VALUES(?, 'in_progress', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)`,
          [userId, staffUserId]
        );

        registrationId = result.insertId;

        // Log the action
        await pool.query(
          `INSERT INTO action_logs
  (user_id, action_type, edit_details)
VALUES(?, 'create_registration', ?)`,
          [
            staffUserId,
            JSON.stringify({
              action: "Create registration record",
              user_id: parseInt(userId),
              registration_id: registrationId,
              created_by: staffUserId,
              timestamp: new Date().toISOString(),
              note: "Registration record created by department staff for user who hasn't started filling the form",
              summary:
                "Created new registration record for user who hasn't started the form",
              // Get the user's email to display in logs
              user_email: userExists[0].email || "Unknown",
              modification_type: "create_registration",
              registration_status: "in_progress",
            }),
          ]
        );
      }

      res.status(201).json({
        message: "Registration record created successfully",
        registrationId: registrationId,
      });
    } catch (error) {
      console.error("Error creating registration record:", error);
      res.status(500).json({ message: "Error creating registration record" });
    }
  }
);

// Delete file for incomplete registrations
router.delete(
  "/incomplete-registrations/delete-file/:fieldId",
  async (req, res) => {
    try {
      const { fieldId } = req.params;
      const { filePath, registrationId } = req.body;

      if (!fieldId) {
        return res.status(400).json({ message: "Field ID is required" });
      }

      if (!filePath) {
        return res.status(400).json({ message: "File path is required" });
      }

      // Physically delete the file from the server
      const fullPath = path.join(uploadsDir, filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      } else {
      }

      // If registration ID is provided, also update the database record
      if (registrationId) {
        await pool.query(
          `UPDATE registration_responses SET value = '' 
           WHERE registration_id = ? AND field_id = ? `,
          [registrationId, fieldId]
        );
      }

      res.json({
        message: "File deleted successfully",
        fieldId: fieldId,
      });
    } catch (error) {
      console.error("File deletion error:", error);
      res.status(500).json({ message: "Error deleting file" });
    }
  }
);

// Delete file for regular applications
router.delete("/applications/delete-file/:fieldId", async (req, res) => {
  try {
    const { fieldId } = req.params;
    const { filePath, applicationId } = req.body;

    if (!fieldId) {
      return res.status(400).json({ message: "Field ID is required" });
    }

    if (!filePath) {
      return res.status(400).json({ message: "File path is required" });
    }

    // Physically delete the file from the server
    const fullPath = path.join(uploadsDir, filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    } else {
    }

    // If application ID is provided, also update the database record
    if (applicationId) {
      await pool.query(
        `UPDATE registration_responses SET value = '' 
           WHERE registration_id = (SELECT id FROM registration_progress WHERE application_id = ?) 
           AND field_id = ? `,
        [applicationId, fieldId]
      );
    }

    res.json({
      message: "File deleted successfully",
      fieldId: fieldId,
    });
  } catch (error) {
    console.error("File deletion error:", error);
    res.status(500).json({ message: "Error deleting file" });
  }
});

// ==========================================
// EQUIPMENT MANAGEMENT ROUTES
// ==========================================

// Get all equipment requests (combining table records and virtual registration requests)
router.get("/equipment-requests", authenticateToken, requireRole(["admin", "staff"]), async (req, res) => {
  try {
    // 1. Get all formal requests from equipment_requests table
    const [dbRequests] = await pool.query(`
      SELECT
        er.id,
        er.user_id,
        er.registration_id,
        er.equipment_type,
        er.equipment_details,
        er.status,
        er.requested_at,
        er.fulfilled_at,
        er.admin_notes,
        er.source,
        ru.username as applicant_username,
        ru.email as applicant_email,
        ru.phone as applicant_phone,
        (SELECT value FROM registration_responses 
         WHERE registration_id = er.registration_id AND field_id = 1 LIMIT 1) as first_name,
        (SELECT value FROM registration_responses 
         WHERE registration_id = er.registration_id AND field_id = 2 LIMIT 1) as last_name
      FROM equipment_requests er
      JOIN registered_users ru ON er.user_id = ru.id
      ORDER BY er.requested_at DESC
  `);

    // 2. Get potential requests from completed registrations
    // Logic: Look for completed registrations where require_equipment is YES/True
    // AND we haven't already created an equipment_request record for them

    // Fetch registration equipment data
    const [regEquipment] = await pool.query(`
SELECT
rp.id as registration_id,
  rp.user_id,
  rp.completed_at as requested_at,
  rr.value as equipment_type,
  ru.username as applicant_username,
  ru.email as applicant_email,
  ru.phone as applicant_phone,
  (SELECT value FROM registration_responses 
   WHERE registration_id = rp.id AND field_id = 1 LIMIT 1) as first_name,
  (SELECT value FROM registration_responses 
   WHERE registration_id = rp.id AND field_id = 2 LIMIT 1) as last_name,
  (
    SELECT value FROM registration_responses 
          WHERE registration_id = rp.id AND field_id = (SELECT id FROM form_fields WHERE name = 'require_equipment')
        ) as require_equipment_val
      FROM registration_progress rp
      JOIN registration_responses rr ON rp.id = rr.registration_id
      JOIN form_fields ff ON rr.field_id = ff.id
      JOIN registered_users ru ON rp.user_id = ru.id
      WHERE rp.status = 'completed'
      AND ff.name = 'disability_eqreq'
  `);



    // Filter and format registration requests
    const virtualRequests = regEquipment.filter(req => {
      const val = String(req.require_equipment_val || "").toLowerCase();
      return val.includes("yes") || val.includes("true") || val === "1" || val.includes("होय");
    }).map(req => {
      // Check if this specific registration/equipment combo already exists in dbRequests
      // We need to match BOTH registration_id AND equipment_type to avoid hiding different equipment requests
      const exists = dbRequests.some(dbReq => {
        const matchesRegistration = dbReq.registration_id && String(dbReq.registration_id) === String(req.registration_id);
        const matchesEquipmentType = dbReq.equipment_type && String(dbReq.equipment_type).toLowerCase() === String(req.equipment_type).toLowerCase();

        // Only consider it a duplicate if BOTH registration AND equipment type match
        return matchesRegistration && matchesEquipmentType;
      });

      if (exists) return null;

      return {
        id: `reg-${req.registration_id}`, // Virtual ID
        user_id: req.user_id,
        registration_id: req.registration_id,
        equipment_type: req.equipment_type,
        equipment_details: "Requested in Application",
        status: "pending",
        requested_at: req.requested_at,
        fulfilled_at: null,
        admin_notes: null,
        source: "registration",
        applicant_username: req.applicant_username,
        applicant_email: req.applicant_email,
        applicant_phone: req.applicant_phone,
        first_name: req.first_name,
        last_name: req.last_name
      };
    }).filter(req => req !== null);

    // Combine and sort
    const allRequests = [...dbRequests, ...virtualRequests].sort((a, b) =>
      new Date(b.requested_at) - new Date(a.requested_at)
    );

    res.json(allRequests);

  } catch (error) {
    console.error("Error fetching equipment requests:", error);
    res.status(500).json({ message: "Error fetching equipment requests" });
  }
});

// Update equipment request status
router.put("/equipment/:id/status", authenticateToken, requireRole(["admin", "staff"]), async (req, res) => {
  try {
    const { status, admin_notes } = req.body;
    const requestId = req.params.id;

    // Check if it's a virtual request (starting with 'reg-')
    if (String(requestId).startsWith("reg-")) {

      // It's a first-time update for a registration request. We need to CREATE a record.
      const registrationId = requestId.replace("reg-", "");

      // 1. Fetch details from registration to verify and get data
      const [sourceData] = await pool.query(`
SELECT
rp.user_id,
  rr.value as equipment_type
            FROM registration_progress rp
            JOIN registration_responses rr ON rp.id = rr.registration_id
            JOIN form_fields ff ON rr.field_id = ff.id
            WHERE rp.id = ? AND ff.name = 'disability_eqreq'
  `, [registrationId]);

      if (sourceData.length === 0) {
        console.error(`Original registration request not found for ID: ${registrationId}`);
        return res.status(404).json({ message: "Original registration request not found" });
      }

      const { user_id, equipment_type } = sourceData[0];

      // 2. Insert into equipment_requests
      const [insertResult] = await pool.query(`
            INSERT INTO equipment_requests 
  (user_id, registration_id, equipment_type, equipment_details, status, admin_notes, fulfilled_at, source)
VALUES(?, ?, ?, ?, ?, ?, ?, 'registration')
        `, [
        user_id,
        registrationId,
        equipment_type,
        "Requested in Application (Imported)",
        status,
        admin_notes || null,
        status === 'provided' ? new Date() : null
      ]);


      if (insertResult.affectedRows === 0) {
        throw new Error("Insert operation failed (0 rows affected)");
      }

      // 3. Log action
      await pool.query(
        `INSERT INTO action_logs(user_id, action_type, application_id, previous_status, new_status)
VALUES(?, 'equipment_update', ?, 'virtual_pending', ?)`,
        [req.user.id, `EQ-NEW-${insertResult.insertId}`, status]
      );

      return res.json({ message: "Request imported and updated successfully", newId: insertResult.insertId, type: 'new' });

    } else {

      // It's a standard update for an existing record
      const [updateResult] = await pool.query(`
            UPDATE equipment_requests 
            SET status = ?,
  admin_notes = ?,
  fulfilled_at = ?
    WHERE id = ?
      `, [
        status,
        admin_notes || null,
        status === 'provided' ? new Date() : null,
        requestId
      ]);

      if (updateResult.affectedRows === 0) {
        console.warn(`Update failed: Request ID ${requestId} not found in database.`);
        return res.status(404).json({ message: "Request not found or no changes made", detail: "ID not found" });
      }

      // Log action
      await pool.query(
        `INSERT INTO action_logs(user_id, action_type, application_id, previous_status, new_status)
VALUES(?, 'equipment_update', ?, 'unknown', ?)`,
        [req.user.id, `EQ-${requestId}`, status]
      );

      return res.json({ message: "Status updated successfully", type: 'existing' });
    }

  } catch (error) {
    console.error("Error updating equipment status:", error);
    res.status(500).json({
      message: "Error updating equipment status",
      detail: error.message,
      sqlMessage: error.sqlMessage
    });
  }
});

module.exports = router;
