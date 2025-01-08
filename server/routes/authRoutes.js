const express = require("express");
const router = express.Router();
const authService = require("../services/authService");
const { authenticateToken } = require("../middleware/authMiddleware");
const pool = require("../config/database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Only handle applicant login here
    const [regUsers] = await pool.query(
      "SELECT * FROM registered_users WHERE email = ?",
      [email]
    );

    if (regUsers.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

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

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        type: "applicant",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Error during login" });
  }
});

router.get("/verify", authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// Add department login endpoint
router.post("/department/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate department user
    const [users] = await pool.query(
      "SELECT id, username, password, role, full_name, email, is_active FROM users WHERE username = ?",
      [username]
    );

    if (users.length === 0 || !users[0].is_active) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Remove password from user object
    const { password: _, ...userWithoutPassword } = user;

    // Generate token
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        type: "department",
        iat: Math.floor(Date.now() / 1000),
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Verify token immediately to ensure it's valid
    try {
      jwt.verify(token, process.env.JWT_SECRET);
    } catch (tokenError) {
      console.error("Token verification failed:", tokenError);
      return res.status(500).json({ message: "Error generating auth token" });
    }

    // Update last login
    await pool.query(
      "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
      [user.id]
    );

    res.json({
      token,
      user: {
        ...userWithoutPassword,
        type: "department",
      },
    });
  } catch (error) {
    console.error("Department login error:", error);
    res.status(500).json({ message: "Error during login" });
  }
});

module.exports = router;
