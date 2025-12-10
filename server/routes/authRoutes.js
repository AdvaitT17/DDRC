const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const authService = require("../services/authService");
const { authenticateToken } = require("../middleware/authMiddleware");
const pool = require("../config/database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { generateFingerprint } = require("../utils/tokenFingerprint");
const captchaService = require("../services/captchaService");
const tokenBlacklist = require("../services/tokenBlacklistService");

// Rate limiter for applicant login - 5 attempts per 15 minutes
const applicantLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    message: "Too many login attempts. Please try again after 15 minutes.",
    code: "RATE_LIMIT_EXCEEDED",
    retryAfter: 15,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});

// Rate limiter for department login - stricter (5 attempts per 30 minutes)
const departmentLoginLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 5, // 5 attempts per window
  message: {
    message: "Too many login attempts. Please try again after 30 minutes.",
    code: "RATE_LIMIT_EXCEEDED",
    retryAfter: 30,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

router.post("/login", applicantLoginLimiter, async (req, res) => {
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

    // Generate fingerprint for token binding
    const fingerprint = generateFingerprint(req);

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        type: "applicant",
        fp: fingerprint, // Token fingerprint for validation
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" } // Reduced from 24h for better security
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

// CAPTCHA generation endpoint for department login
router.get("/captcha", (req, res) => {
  const { captchaId, captchaText } = captchaService.generate();
  res.json({ captchaId, captchaText });
});

// Add department login endpoint
router.post("/department/login", departmentLoginLimiter, async (req, res) => {
  try {
    const { username, password, captchaId, captchaInput } = req.body;

    // Validate CAPTCHA first (server-side)
    const captchaResult = captchaService.validate(captchaId, captchaInput);
    if (!captchaResult.valid) {
      return res.status(400).json({
        message: captchaResult.error,
        code: "CAPTCHA_INVALID",
        refreshCaptcha: true
      });
    }

    // Basic validation
    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Please enter both username and password" });
    }

    const [users] = await pool.query(
      "SELECT * FROM users WHERE username = ? AND is_active = TRUE",
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // Remove password from user object
    const { password: _, ...userWithoutPassword } = user;

    // Generate fingerprint for token binding
    const fingerprint = generateFingerprint(req);

    // Generate token with fingerprint
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        type: "department",
        fp: fingerprint, // Token fingerprint for validation
        iat: Math.floor(Date.now() / 1000),
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" } // Reduced from 24h for better security
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

// Logout endpoint - blacklists the current token
router.post("/logout", authenticateToken, (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (token) {
      // Decode to get expiry time
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp) {
        // Add token to blacklist until it expires
        tokenBlacklist.add(token, decoded.exp);
      }
    }

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    // Still return success - client should clear local storage anyway
    res.json({ message: "Logged out successfully" });
  }
});

module.exports = router;
