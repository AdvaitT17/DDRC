const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const pool = require("../config/database");
const {
  authenticateToken,
  requireRole,
} = require("../middleware/authMiddleware");

// Get all users (admin only)
router.get(
  "/users",
  authenticateToken,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const [users] = await pool.query(
        `SELECT id, username, full_name, email, role, last_login, is_active, created_at 
       FROM users 
       ORDER BY created_at DESC`
      );
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Error fetching users" });
    }
  }
);

// Create new user (admin only)
router.post(
  "/users",
  authenticateToken,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const { username, fullName, email, password, role } = req.body;

      // Validate role
      if (!["admin", "staff"].includes(role)) {
        return res.status(400).json({ message: "Invalid role specified" });
      }

      // Check if username or email already exists
      const [existingUsers] = await pool.query(
        "SELECT id FROM users WHERE username = ? OR email = ?",
        [username, email]
      );

      if (existingUsers.length > 0) {
        return res.status(400).json({
          message: "Username or email already exists",
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert new user
      const [result] = await pool.query(
        `INSERT INTO users (username, password, full_name, email, role) 
       VALUES (?, ?, ?, ?, ?)`,
        [username, hashedPassword, fullName, email, role]
      );

      // Log the action
      await pool.query(
        `INSERT INTO action_logs (user_id, action_type, previous_status, new_status) 
         VALUES (?, 'add_user', NULL, 'active')`,
        [req.user.id, result.insertId]
      );

      res.status(201).json({ message: "User created successfully" });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Error creating user" });
    }
  }
);

// Toggle user status (admin only)
router.put(
  "/users/:userId/status",
  authenticateToken,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { isActive } = req.body;

      // Check if user exists and is not the current user
      const [user] = await pool.query(
        "SELECT id, username FROM users WHERE id = ?",
        [userId]
      );

      if (user.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      if (parseInt(userId) === req.user.id) {
        return res.status(400).json({
          message: "Cannot modify your own account status",
        });
      }

      // Update user status
      await pool.query("UPDATE users SET is_active = ? WHERE id = ?", [
        isActive,
        userId,
      ]);

      // Log the action
      await pool.query(
        `INSERT INTO action_logs (user_id, action_type, previous_status, new_status) 
         VALUES (?, 'toggle_user', ?, ?)`,
        [
          req.user.id,
          isActive ? "inactive" : "active",
          isActive ? "active" : "inactive",
          userId,
        ]
      );

      res.json({ message: "User status updated successfully" });
    } catch (error) {
      console.error("Error updating user status:", error);
      res.status(500).json({ message: "Error updating user status" });
    }
  }
);

module.exports = router;
