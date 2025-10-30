const pool = require("../config/database");
const { validateEmail } = require("../utils/validators");

class ReportNotificationService {
  /**
   * Get all notifications for a user
   * @param {number} userId - The user ID
   * @returns {Promise<Array>} - List of notifications with recipients
   */
  async getNotificationsForUser(userId) {
    try {
      // Get all notifications for the user
      const [notifications] = await pool.query(
        `SELECT rn.*, sr.name as report_name, sr.category, u.full_name as creator_name
         FROM report_notifications rn
         JOIN saved_reports sr ON rn.report_id = sr.id
         JOIN users u ON sr.user_id = u.id
         WHERE rn.user_id = ?
         ORDER BY rn.updated_at DESC`,
        [userId]
      );

      // For each notification, get its recipients
      for (const notification of notifications) {
        const [recipients] = await pool.query(
          `SELECT id, email, is_primary, is_external
           FROM report_notification_recipients
           WHERE notification_id = ?
           ORDER BY is_primary DESC, created_at ASC`,
          [notification.id]
        );

        notification.recipients = recipients;
      }

      return notifications;
    } catch (error) {
      console.error("Error fetching notifications:", error);
      throw error;
    }
  }

  /**
   * Get all notifications (admin only)
   * @returns {Promise<Array>} - List of all notifications with recipients
   */
  async getAllNotifications() {
    try {
      // Get all notifications
      const [notifications] = await pool.query(
        `SELECT rn.*, sr.name as report_name, u.full_name as user_name, sr.category
         FROM report_notifications rn
         JOIN saved_reports sr ON rn.report_id = sr.id
         JOIN users u ON rn.user_id = u.id
         ORDER BY rn.next_scheduled_at ASC`
      );

      // For each notification, get its recipients
      for (const notification of notifications) {
        const [recipients] = await pool.query(
          `SELECT id, email, is_primary, is_external
           FROM report_notification_recipients
           WHERE notification_id = ?
           ORDER BY is_primary DESC, created_at ASC`,
          [notification.id]
        );

        notification.recipients = recipients;
      }

      return notifications;
    } catch (error) {
      console.error("Error fetching all notifications:", error);
      throw error;
    }
  }

  /**
   * Get a specific notification by report ID and user ID
   * @param {number} reportId - The report ID
   * @param {number} userId - The user ID
   * @returns {Promise<Object>} - The notification with recipients
   */
  async getNotificationByReportAndUser(reportId, userId) {
    try {
      // Get the notification
      const [notifications] = await pool.query(
        `SELECT * FROM report_notifications
         WHERE report_id = ? AND user_id = ?`,
        [reportId, userId]
      );

      if (notifications.length === 0) {
        return null;
      }

      const notification = notifications[0];

      // Get recipients
      const [recipients] = await pool.query(
        `SELECT id, email, is_primary, is_external
         FROM report_notification_recipients
         WHERE notification_id = ?
         ORDER BY is_primary DESC, created_at ASC`,
        [notification.id]
      );

      notification.recipients = recipients;
      return notification;
    } catch (error) {
      console.error("Error fetching notification:", error);
      throw error;
    }
  }

  /**
   * Toggle notification enabled status
   * @param {number} reportId - The report ID
   * @param {number} userId - The user ID
   * @param {boolean} enabled - Whether to enable or disable
   * @returns {Promise<Object>} - Result of the operation
   */
  async toggleNotification(reportId, userId, enabled) {
    try {
      // Check if notification exists
      const notification = await this.getNotificationByReportAndUser(
        reportId,
        userId
      );

      if (!notification) {
        return { needsEmail: true };
      }

      // Update enabled status
      await pool.query(
        "UPDATE report_notifications SET enabled = ? WHERE id = ?",
        [enabled, notification.id]
      );

      return {
        message: enabled ? "Notifications enabled" : "Notifications disabled",
        enabled,
      };
    } catch (error) {
      console.error("Error toggling notification:", error);
      throw error;
    }
  }

  /**
   * Create or update a notification with recipients
   * @param {number} reportId - The report ID
   * @param {number} userId - The user ID
   * @param {Array} recipients - List of email recipients
   * @param {boolean} enabled - Whether to enable notifications
   * @returns {Promise<Object>} - The created/updated notification
   */
  async createOrUpdateNotification(
    reportId,
    userId,
    recipients,
    enabled = true
  ) {
    try {
      // Validate recipients
      if (!recipients || recipients.length === 0) {
        throw new Error("At least one recipient is required");
      }

      // Ensure there's exactly one primary recipient
      const primaryRecipients = recipients.filter((r) => r.is_primary);
      if (primaryRecipients.length === 0) {
        recipients[0].is_primary = true;
      } else if (primaryRecipients.length > 1) {
        throw new Error("Only one primary recipient is allowed");
      }

      // Validate all email addresses
      for (const recipient of recipients) {
        if (!validateEmail(recipient.email)) {
          throw new Error(`Invalid email address: ${recipient.email}`);
        }
      }

      // Calculate next scheduled date (first day of next month)
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      // Set time to 1:00 AM to match cron schedule
      nextMonth.setHours(1, 0, 0, 0);
      const nextScheduledAt = nextMonth
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

      // Check if notification already exists
      const notification = await this.getNotificationByReportAndUser(
        reportId,
        userId
      );

      let notificationId;
      let isUpdate = false;

      if (notification) {
        // Update existing notification
        await pool.query(
          `UPDATE report_notifications 
           SET enabled = ?, next_scheduled_at = ? 
           WHERE id = ?`,
          [enabled, nextScheduledAt, notification.id]
        );
        notificationId = notification.id;
        isUpdate = true;
      } else {
        // Create new notification
        const [result] = await pool.query(
          `INSERT INTO report_notifications 
           (report_id, user_id, enabled, next_scheduled_at) 
           VALUES (?, ?, ?, ?)`,
          [reportId, userId, enabled, nextScheduledAt]
        );
        notificationId = result.insertId;
      }

      // Delete existing recipients if updating
      if (isUpdate) {
        await pool.query(
          "DELETE FROM report_notification_recipients WHERE notification_id = ?",
          [notificationId]
        );
      }

      // Insert new recipients
      for (const recipient of recipients) {
        // Check if user's email or external
        let isExternal = recipient.is_external;

        if (isExternal === undefined) {
          const [userResult] = await pool.query(
            "SELECT email FROM users WHERE id = ?",
            [userId]
          );
          isExternal =
            userResult.length === 0 || userResult[0].email !== recipient.email;
        }

        await pool.query(
          `INSERT INTO report_notification_recipients
           (notification_id, email, is_primary, is_external)
           VALUES (?, ?, ?, ?)`,
          [notificationId, recipient.email, recipient.is_primary, isExternal]
        );
      }

      // Get updated notification with recipients
      const updatedNotification = await this.getNotificationByReportAndUser(
        reportId,
        userId
      );

      return {
        message: isUpdate
          ? "Notification preferences updated"
          : "Notification preferences created",
        notification: updatedNotification,
      };
    } catch (error) {
      console.error("Error creating/updating notification:", error);
      throw error;
    }
  }

  /**
   * Delete a notification
   * @param {number} notificationId - The notification ID
   * @param {number} userId - The user ID
   * @param {boolean} isAdmin - Whether the user is an admin
   * @returns {Promise<Object>} - Result of the operation
   */
  async deleteNotification(notificationId, userId, isAdmin) {
    try {
      // Verify ownership or admin status
      if (!isAdmin) {
        const [ownership] = await pool.query(
          "SELECT * FROM report_notifications WHERE id = ? AND user_id = ?",
          [notificationId, userId]
        );

        if (ownership.length === 0) {
          throw new Error(
            "You do not have permission to delete this notification"
          );
        }
      }

      // Delete the notification (recipients will be cascade deleted)
      await pool.query("DELETE FROM report_notifications WHERE id = ?", [
        notificationId,
      ]);

      return { message: "Notification deleted successfully" };
    } catch (error) {
      console.error("Error deleting notification:", error);
      throw error;
    }
  }
}

module.exports = new ReportNotificationService();
