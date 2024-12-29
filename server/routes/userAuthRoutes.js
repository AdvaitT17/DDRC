const express = require("express");
const router = express.Router();
const userAuthService = require("../services/userAuthService");

// User signup
router.post("/signup", async (req, res) => {
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

    // Register user
    const user = await userAuthService.registerUser(email, phone, password);

    // Generate token
    const token = userAuthService.generateToken(user);

    res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
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
