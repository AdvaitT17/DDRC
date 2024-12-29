const express = require("express");
const router = express.Router();
const authService = require("../services/authService");
const { authenticateToken } = require("../middleware/authMiddleware");
const pool = require("../config/database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

router.post("/login", async (req, res) => {
  try {
    const { email, password, username } = req.body;

    // Try department user login first if username is provided
    if (username) {
      const [deptUsers] = await pool.query(
        "SELECT * FROM users WHERE username = ?",
        [username]
      );

      if (deptUsers.length > 0) {
        const user = deptUsers[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
          return res.status(401).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign(
          {
            id: user.id,
            username: user.username,
            role: user.role,
            type: "department",
          },
          process.env.JWT_SECRET,
          { expiresIn: "24h" }
        );

        return res.json({
          token,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            type: "department",
          },
        });
      }
    }

    // Try regular user login if email is provided
    if (email) {
      const [regUsers] = await pool.query(
        "SELECT * FROM registered_users WHERE email = ?",
        [email]
      );

      if (regUsers.length > 0) {
        const user = regUsers[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
          return res.status(401).json({ message: "Invalid credentials" });
        }

        // Update last login
        await pool.query(
          "UPDATE registered_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
          [user.id]
        );

        const token = jwt.sign(
          {
            id: user.id,
            email: user.email,
            type: "applicant",
          },
          process.env.JWT_SECRET,
          { expiresIn: "24h" }
        );

        return res.json({
          token,
          user: {
            id: user.id,
            email: user.email,
            phone: user.phone,
            type: "applicant",
          },
        });
      }
    }

    // If no user found
    res.status(401).json({ message: "Invalid credentials" });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Error during login" });
  }
});

router.get("/verify", authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

module.exports = router;
