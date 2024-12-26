const express = require("express");
const router = express.Router();
const authService = require("../services/authService");
const { authenticateToken } = require("../middleware/authMiddleware");

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await authService.validateUser(username, password);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = authService.generateToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/verify", authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
