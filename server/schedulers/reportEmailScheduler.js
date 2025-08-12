const cron = require("node-cron");
const { processScheduledNotifications } = require("../services/emailService");

/**
 * Initialize the report email scheduler
 */
function initReportEmailScheduler() {
  // Schedule to run on the 1st of every month at 7:30 AM UTC (1:00 AM IST)
  // This will send monthly reports for the previous month
  cron.schedule("30 7 1 * *", async () => {
    const startTime = new Date();
    console.log(
      "🕐 Starting scheduled monthly report email job:",
      startTime.toISOString()
    );

    try {
      const results = await processScheduledNotifications();

      const endTime = new Date();
      const duration = endTime - startTime;

      console.log("✅ Monthly report email job completed successfully:", {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: `${duration}ms`,
        results: {
          success: results.success,
          failed: results.failure,
          skipped: results.skipped,
          total: results.success + results.failure + results.skipped
        }
      });

      // Log individual notification results
      if (results.processedNotifications && results.processedNotifications.length > 0) {
        console.log("📧 Processed notifications:", results.processedNotifications.map(n => ({
          id: n.id,
          report_id: n.report_id,
          recipients: n.recipients.length,
          success: n.success
        })));
      }

    } catch (error) {
      console.error("❌ Critical error in monthly report email scheduler:", {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    }
  }, {
    timezone: "UTC" // Use UTC for Azure App Service compatibility
  });

  console.log("📅 Monthly report email scheduler initialized - will run on 1st of every month at 7:30 AM UTC (1:00 AM IST)");
}

module.exports = {
  initReportEmailScheduler,
};
