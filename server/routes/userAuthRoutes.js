const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const userAuthService = require("../services/userAuthService");

// Helper to extract clean IP from potentially port-suffixed IP addresses (Azure load balancer)
const getCleanIP = (req) => {
  let ip = req.ip || req.connection?.remoteAddress || 'unknown';
  if (ip.includes(':') && !ip.includes('::')) {
    ip = ip.split(':')[0];
  } else if (ip.includes('::ffff:')) {
    ip = ip.replace('::ffff:', '');
    if (ip.includes(':')) {
      ip = ip.split(':')[0];
    }
  }
  return ip;
};

// Rate limiter for signup - prevent mass account creation
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 signups per hour per IP
  message: {
    message: "Too many accounts created. Please try again after an hour.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getCleanIP,
  validate: { ip: false, xForwardedForHeader: false, keyGeneratorIpFallback: false },
});

// Password policy validation
const validatePassword = (password) => {
  const errors = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Password must contain at least one special character (!@#$%^&*(),.?\":{}|<>)");
  }

  return errors;
};

// User signup
router.post("/signup", signupLimiter, async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    // Basic validation
    if (!email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Email format validation
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Phone validation (Indian phone number - 10 digits)
    const cleanPhone = phone.replace(/[\s-]/g, "");
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({
        message: "Invalid phone number. Please enter a valid 10-digit Indian mobile number."
      });
    }

    // Password policy validation
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({
        message: passwordErrors.join(". "),
        errors: passwordErrors
      });
    }

    // Register user
    const user = await userAuthService.registerUser(email, phone, password);

    // Generate token
    const token = userAuthService.generateToken(user);

    res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        type: "applicant",
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    if (error.message.includes("already exists")) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Registration failed" });
  }
});

module.exports = router;
