const express = require("express");
const router = express.Router();
const pool = require("../config/database");

router.get("/:applicationId", async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const [result] = await pool.query(
      `SELECT 
        rp.application_id,
        rp.service_status,
        rp.completed_at,
        ru.username as applicant_name
       FROM registration_progress rp
       JOIN registered_users ru ON rp.user_id = ru.id
       WHERE rp.application_id = ? 
       AND ru.email = ?
       AND ru.id = rp.user_id`,
      [req.params.applicationId, email]
    );

    if (result.length === 0) {
      return res.status(404).json({
        message:
          "No application found with the provided ID and email combination",
      });
    }

    const application = result[0];
    res.json({
      applicationId: application.application_id,
      applicantName: application.applicant_name,
      status: application.service_status || "under_review",
      submittedDate: new Date(application.completed_at).toLocaleDateString(),
      statusIcon: getStatusIcon(application.service_status || "under_review"),
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Error fetching application status" });
  }
});

function getStatusIcon(status) {
  switch (status) {
    case "under_review":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    case "approved":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    case "rejected":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    default:
      return "";
  }
}

module.exports = router;
