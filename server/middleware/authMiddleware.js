const jwt = require("jsonwebtoken");
const pool = require("../config/database");

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get a connection from the pool
    const conn = await pool.getConnection();
    try {
      const [users] = await conn.query(
        `SELECT id, username, role, full_name, email FROM users WHERE id = ?`,
        [decoded.id]
      );

      if (users.length === 0) {
        return res.status(403).json({ message: "User not found" });
      }

      req.user = { ...users[0], type: decoded.type };
      next();
    } catch (error) {
      // Database error handling
      if (error.code === "ETIMEDOUT") {
        console.error("Database timeout, attempting reconnection...");
        return res.status(500).json({
          message: "Database connection error. Please refresh the page.",
        });
      }
      console.error("JWT verification error:", error);
      res.status(403).json({ message: "Token verification failed" });
    } finally {
      conn.release();
    }
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Session expired. Please login again.",
      });
    }
    console.error("JWT verification error:", error);
    res.status(403).json({ message: "Token verification failed" });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || (roles.includes("admin") && req.user.role !== "admin")) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
};

module.exports = { authenticateToken, requireRole };
