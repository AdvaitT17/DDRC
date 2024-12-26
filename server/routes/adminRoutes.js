const express = require("express");
const router = express.Router();

// Dashboard stats
router.get("/dashboard/stats", (req, res) => {
  res.json({
    totalRegistrations: 2345,
    pendingApplications: 148,
    approvedToday: 24,
    activeUsers: 1892,
  });
});

// Recent applications
router.get("/applications/recent", (req, res) => {
  res.json([
    {
      id: "APP001",
      applicantName: "John Doe",
      submissionDate: "2024-01-15",
      status: "Pending",
    },
    {
      id: "APP002",
      applicantName: "Jane Smith",
      submissionDate: "2024-01-14",
      status: "Approved",
    },
  ]);
});

module.exports = router;
