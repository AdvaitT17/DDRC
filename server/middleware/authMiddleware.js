const jwt = require("jsonwebtoken");
const pool = require("../config/database");

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "No token provided",
        code: "TOKEN_MISSING",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get a connection from the pool
    const conn = await pool.getConnection();
    try {
      // Check user type and fetch appropriate data
      let user = null;
      if (decoded.type === "department") {
        const [users] = await conn.query(
          `SELECT id, username, role, full_name, email FROM users WHERE id = ?`,
          [decoded.id]
        );
        if (users.length > 0) {
          user = { ...users[0], type: "department" };
        }
      } else if (decoded.type === "applicant") {
        const [users] = await conn.query(
          `SELECT id, email, username AS full_name FROM registered_users WHERE id = ?`,
          [decoded.id]
        );
        if (users.length > 0) {
          user = { ...users[0], type: "applicant" };
        }
      }

      if (!user) {
        return res.status(403).json({ message: "User not found" });
      }

      req.user = user;
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
        code: "TOKEN_EXPIRED",
      });
    }
    // Only log non-standard JWT errors
    if (error.name !== "JsonWebTokenError") {
      console.error("JWT verification error:", error);
    }
    res.status(403).json({
      message: "Token verification failed",
      code: "TOKEN_INVALID",
    });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    // Allow access if user is department staff/admin
    if (
      !req.user ||
      (req.user.type === "department" && !roles.includes(req.user.role))
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
};

module.exports = { authenticateToken, requireRole };
