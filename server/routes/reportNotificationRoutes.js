const express = require("express");
const router = express.Router();
const { authenticateToken, isAdmin } = require("../middleware/authMiddleware");
const notificationService = require("../services/reportNotificationService");
const { validateEmail } = require("../utils/validators");
const pool = require("../config/database");
const {
  processScheduledNotifications,
  sendReportEmail,
} = require("../services/emailService");

// Get all notifications for a user
router.get("/notifications", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = await notificationService.getNotificationsForUser(
      userId
    );
    res.json(notifications);
  } catch (error) {
    console.error("Error fetching report notifications:", error);
    res
      .status(500)
      .json({ message: "Error fetching notifications", error: error.message });
  }
});

// Toggle notification for a report
router.post("/notifications/toggle", authenticateToken, async (req, res) => {
  try {
    const { report_id, enabled } = req.body;
    const userId = req.user.id;

    if (!report_id) {
      return res.status(400).json({ message: "Report ID is required" });
    }

    const result = await notificationService.toggleNotification(
      report_id,
      userId,
      enabled
    );

    if (result.needsEmail) {
      return res.status(400).json({
        message: "Email is required to enable notifications",
        needsEmail: true,
      });
    }

    return res.json(result);
  } catch (error) {
    console.error("Error toggling notification:", error);
    res
      .status(500)
      .json({ message: "Error toggling notification", error: error.message });
  }
});

// Create or update notification with recipients
router.post("/notifications", authenticateToken, async (req, res) => {
  try {
    const { report_id, recipients, email, enabled = true } = req.body;
    const userId = req.user.id;

    if (!report_id) {
      return res.status(400).json({ message: "Report ID is required" });
    }

    // Handle both new and legacy formats
    let emailRecipients = recipients;

    // Legacy format support (single email)
    if (!emailRecipients && email) {
      if (!validateEmail(email)) {
        return res.status(400).json({ message: "Invalid email address" });
      }

      emailRecipients = [{ email, is_primary: true }];
    }

    if (!emailRecipients || emailRecipients.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one recipient is required" });
    }

    const result = await notificationService.createOrUpdateNotification(
      report_id,
      userId,
      emailRecipients,
      enabled
    );

    if (result.isNew) {
      return res.status(201).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error("Error creating/updating notification:", error);
    res.status(500).json({
      message: "Error saving notification preferences",
      error: error.message,
    });
  }
});

// Delete a notification
router.delete("/notifications/:id", authenticateToken, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user.id;
    const isAdminUser = req.user.is_admin || req.user.role === "admin";

    const result = await notificationService.deleteNotification(
      notificationId,
      userId,
      isAdminUser
    );

    res.json(result);
  } catch (error) {
    console.error("Error deleting notification:", error);
    res
      .status(500)
      .json({ message: "Error deleting notification", error: error.message });
  }
});

// Admin endpoint to get all notifications
router.get(
  "/notifications/all",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const notifications = await notificationService.getAllNotifications();
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching all notifications:", error);
      res.status(500).json({
        message: "Error fetching notifications",
        error: error.message,
      });
    }
  }
);

// Get user email for auto-filling notification form
router.get("/user-email", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's email from the users table
    const [users] = await pool.query("SELECT email FROM users WHERE id = ?", [
      userId,
    ]);

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ email: users[0].email });
  } catch (error) {
    console.error("Error fetching user email:", error);
    res
      .status(500)
      .json({ message: "Error fetching user email", error: error.message });
  }
});

/**
 * Development endpoint to manually trigger report notifications
 * Only available in development environment and requires admin access
 */
router.post(
  "/trigger-notifications",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      // Only allow in development environment
      if (
        process.env.NODE_ENV !== "development" &&
        process.env.NODE_ENV !== "test"
      ) {
        return res.status(403).json({
          success: false,
          message: "This endpoint is only available in development environment",
        });
      }

      // Process notifications
      const result = await processScheduledNotifications();

      return res.json({
        success: true,
        message: "Notifications processed successfully",
        result,
      });
    } catch (error) {
      console.error("Error triggering notifications:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to process notifications",
        error: error.message,
      });
    }
  }
);

/**
 * Send a report immediately via email
 * POST /api/report-notifications/:reportId/send-now
 */
router.post("/:reportId/send-now", authenticateToken, async (req, res) => {
  try {
    const { reportId } = req.params;
    const userId = req.user.id;
    const { dateRange } = req.body;

    // Validate the report ID
    if (!reportId) {
      return res.status(400).json({ message: "Report ID is required" });
    }

    // Check if the report exists
    const [report] = await pool.query(
      "SELECT * FROM saved_reports WHERE id = ?",
      [reportId]
    );

    if (!report.length) {
      return res.status(404).json({ message: "Report not found" });
    }

    // Find active notification for this report and user
    const [notification] = await pool.query(
      "SELECT * FROM report_notifications WHERE report_id = ? AND user_id = ? AND enabled = 1",
      [reportId, userId]
    );

    if (!notification.length) {
      return res.status(404).json({
        message: "No active notification found for this report",
      });
    }

    // Get user's name
    const [userResult] = await pool.query(
      "SELECT full_name FROM users WHERE id = ?",
      [userId]
    );
    
    const userName = userResult.length > 0 ? userResult[0].full_name : null;

    // Get report config
    const [configResult] = await pool.query(
      "SELECT config FROM saved_reports WHERE id = ?",
      [reportId]
    );

    if (!configResult.length) {
      return res
        .status(404)
        .json({ message: "Report configuration not found" });
    }

    const reportConfig = JSON.parse(configResult[0].config);

    // Get notification recipients
    const [recipientsResult] = await pool.query(
      "SELECT email FROM report_notification_recipients WHERE notification_id = ?",
      [notification[0].id]
    );

    const recipients = recipientsResult.map((row) => row.email);

    // Send the report email
    const emailSent = await sendReportEmail(
      notification[0],
      recipients,
      report[0],
      reportConfig,
      true, // isManualSend
      dateRange, // Optional dateRange parameter
      userName // Pass the user's name
    );

    if (emailSent) {
      await pool.query(
        `INSERT INTO report_notification_logs 
         (notification_id, status, message) 
         VALUES (?, ?, ?)`,
        [
          notification[0].id,
          "success",
          `Report sent manually on ${new Date().toISOString()}`,
        ]
      );

      res
        .status(200)
        .json({ message: "Report sent successfully to all recipients" });
    } else {
      throw new Error("Failed to send report email");
    }
  } catch (error) {
    console.error("Error sending report now:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * Update notification settings for a report
 * POST /api/report-notifications/:reportId/update
 */
router.post("/:reportId/update", authenticateToken, async (req, res) => {
  try {
    const reportId = req.params.reportId;
    const userId = req.user.id;
    const { recipients, enabled = true } = req.body;

    // Validate reportId
    if (!reportId) {
      return res.status(400).json({
        success: false,
        message: "Report ID is required",
      });
    }

    // Validate recipients
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one recipient is required",
      });
    }

    // Validate email formats
    for (const recipient of recipients) {
      if (!validateEmail(recipient.email)) {
        return res.status(400).json({
          success: false,
          message: `Invalid email format: ${recipient.email}`,
        });
      }
    }

    // Check if the report exists and user has access
    const [report] = await pool.query(
      "SELECT * FROM saved_reports WHERE id = ?",
      [reportId]
    );

    if (report.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    // Update or create notification preferences
    const result = await notificationService.createOrUpdateNotification(
      reportId,
      userId,
      recipients,
      enabled
    );

    return res.json({
      success: true,
      notification: result,
      message: "Notification preferences updated successfully",
    });
  } catch (error) {
    console.error("Error updating notification preferences:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

/**
 * Toggle notification for a report
 * POST /api/report-notifications/:reportId/toggle
 */
router.post("/:reportId/toggle", authenticateToken, async (req, res) => {
  try {
    const reportId = req.params.reportId;
    const userId = req.user.id;
    const { enabled } = req.body;

    // Validate reportId
    if (!reportId) {
      return res.status(400).json({
        success: false,
        message: "Report ID is required",
      });
    }

    // Check if the report exists
    const [report] = await pool.query(
      "SELECT * FROM saved_reports WHERE id = ?",
      [reportId]
    );

    if (report.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    // Toggle notification
    const result = await notificationService.toggleNotification(
      reportId,
      userId,
      enabled
    );

    // If we're enabling notifications, check if we need to return recipients
    if (enabled) {
      // Get recipients for this notification
      const [recipients] = await pool.query(
        `SELECT email, is_primary, is_external 
         FROM report_notification_recipients 
         WHERE notification_id = ? 
         ORDER BY is_primary DESC`,
        [result.id]
      );

      result.recipients = recipients;
    }

    return res.json({
      success: true,
      ...result,
      message: `Notifications ${enabled ? "enabled" : "disabled"} successfully`,
    });
  } catch (error) {
    console.error("Error toggling notification:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

module.exports = router;
