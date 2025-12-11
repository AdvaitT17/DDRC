const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const userAuthService = require("../services/userAuthService");
const { sendPasswordResetEmail, sendPasswordChangeConfirmation } = require("../services/emailService");

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

// Rate limiter for password reset - prevent abuse
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password reset requests per hour per IP
  message: {
    message: "Too many password reset requests. Please try again after an hour.",
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

// Request password reset
router.post("/forgot-password", passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    // Basic validation
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Email format validation
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Generate reset token (returns null if user not found, but we don't reveal that)
    const result = await userAuthService.generateResetToken(email.toLowerCase().trim());

    // If user exists, send the email
    if (result) {
      await sendPasswordResetEmail(result.email, result.token);
      console.log(`Password reset email sent to ${result.email}`);
    } else {
      // Log for debugging but don't reveal to user
      console.log(`Password reset requested for non-existent email: ${email}`);
    }

    // Always return success to prevent email enumeration
    res.json({
      message: "If an account with that email exists, we have sent a password reset link.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Error processing request. Please try again." });
  }
});

// Verify reset token (for page load check)
router.get("/verify-reset-token", async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ valid: false, message: "Token is required" });
    }

    const user = await userAuthService.verifyResetToken(token);

    if (!user) {
      return res.json({ valid: false, message: "Invalid or expired reset token" });
    }

    res.json({ valid: true });
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(500).json({ valid: false, message: "Error verifying token" });
  }
});

// Reset password with token
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    // Basic validation
    if (!token || !password) {
      return res.status(400).json({ message: "Token and password are required" });
    }

    // Validate password policy
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({
        message: passwordErrors.join(". "),
        errors: passwordErrors,
      });
    }

    // Reset password
    const result = await userAuthService.resetPassword(token, password);

    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    // Send confirmation email (non-blocking)
    if (result.email) {
      sendPasswordChangeConfirmation(result.email).catch(err => {
        console.error("Failed to send password change confirmation:", err);
      });
    }

    res.json({ message: result.message });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Error resetting password. Please try again." });
  }
});

module.exports = router;
