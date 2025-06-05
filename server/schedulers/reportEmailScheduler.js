const cron = require("node-cron");
const { processScheduledNotifications } = require("../services/emailService");

/**
 * Initialize the report email scheduler
 */
function initReportEmailScheduler() {
  // Schedule to run every day at 1:00 AM
  // This will check for any notifications due to be sent
  cron.schedule("0 1 * * *", async () => {
    console.log(
      "Running scheduled report email job:",
      new Date().toISOString()
    );

    try {
      const results = await processScheduledNotifications();

      console.log("Report email job completed:", {
        total: results.total,
        success: results.success,
        failed: results.failed,
      });
    } catch (error) {
      console.error("Error in report email scheduler:", error);
    }
  });

  console.log("Report email scheduler initialized");
}

module.exports = {
  initReportEmailScheduler,
};
