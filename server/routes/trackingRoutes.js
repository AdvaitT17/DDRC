const express = require("express");
const router = express.Router();
const pool = require("../config/database");

router.get("/:applicationId", async (req, res) => {
  try {
    const [registration] = await pool.query(
      `SELECT 
        rp.application_id,
        rp.status,
        rp.completed_at as submitted_at,
        rp.updated_at as last_updated,
        ru.email,
        ru.phone,
        JSON_OBJECTAGG(ff.name, rr.value) as form_data
       FROM registration_progress rp
       JOIN registered_users ru ON rp.user_id = ru.id
       LEFT JOIN registration_responses rr ON rp.id = rr.registration_id
       LEFT JOIN form_fields ff ON rr.field_id = ff.id
       WHERE rp.application_id = ?
       GROUP BY rp.id`,
      [req.params.applicationId]
    );

    if (!registration) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Parse form data
    const formData = JSON.parse(registration.form_data || "{}");

    // Get basic details
    const basicDetails = {
      name: `${formData.firstname || ""} ${formData.middlename || ""} ${
        formData.lastname || ""
      }`.trim(),
      email: registration.email,
      phone: registration.phone,
      disability_type: formData.disability_type || "Not specified",
    };

    res.json({
      applicationId: registration.application_id,
      status: registration.status || "submitted",
      submittedAt: registration.submitted_at,
      lastUpdated: registration.last_updated,
      basicDetails,
      formData,
    });
  } catch (error) {
    console.error("Error tracking application:", error);
    res.status(500).json({ message: "Error tracking application" });
  }
});

module.exports = router;
