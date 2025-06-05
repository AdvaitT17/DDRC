const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { authenticateToken } = require("../middleware/authMiddleware");

// Get the current user's profile
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [users] = await pool.query(
      "SELECT id, username, full_name, email, role, last_login FROM users WHERE id = ?",
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = users[0];
    res.json(user);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res
      .status(500)
      .json({ message: "Error fetching user profile", error: error.message });
  }
});

module.exports = router;
