const jwt = require("jsonwebtoken");
const pool = require("../config/database");
const { validateFingerprint } = require("../utils/tokenFingerprint");
const tokenBlacklist = require("../services/tokenBlacklistService");

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

    // Check if token is blacklisted (logged out)
    if (tokenBlacklist.isBlacklisted(token)) {
      return res.status(401).json({
        message: "Session has been logged out. Please login again.",
        code: "TOKEN_REVOKED",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Validate token fingerprint (if present)
    if (!validateFingerprint(decoded.fp, req)) {
      console.warn(`🚨 Token fingerprint mismatch for user ${decoded.id} (${decoded.type})`);
      return res.status(401).json({
        message: "Session invalid. Please login again.",
        code: "FINGERPRINT_MISMATCH",
      });
    }

    // OPTIMIZATION: Use pool.query() directly instead of getConnection()
    // This handles connection pooling more efficiently and auto-releases connections
    try {
      // Helper for retry logic to handle transient connection issues
      const executeQueryWithRetry = async (sql, params, retries = 1) => {
        for (let i = 0; i <= retries; i++) {
          try {
            return await pool.query(sql, params);
          } catch (error) {
            // Only retry on connection-related errors
            if (
              i < retries &&
              (error.code === 'ETIMEDOUT' ||
                error.code === 'ECONNRESET' ||
                error.code === 'PROTOCOL_CONNECTION_LOST' ||
                error.code === 'ECONNREFUSED')
            ) {
              // Log as info/debug instead of warning since this is a handled recovery
              const retryDelay = 50 * (i + 1); // Progressive delay
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              console.log(`ℹ️  Recovering from DB connection issue (${error.code}). Retrying attempt ${i + 1}/${retries}...`);
              continue;
            }
            throw error;
          }
        }
      };

      // Check user type and fetch appropriate data
      let user = null;
      if (decoded.type === "department") {
        const [users] = await executeQueryWithRetry(
          `SELECT id, username, role, full_name, email FROM users WHERE id = ?`,
          [decoded.id]
        );
        if (users.length > 0) {
          user = { ...users[0], type: "department" };
        }
      } else if (decoded.type === "applicant") {
        const [users] = await executeQueryWithRetry(
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
      if (error.code === "ETIMEDOUT" || error.code === "ECONNREFUSED") {
        // Get pool stats for debugging
        const { getPoolStats } = require("../config/database");
        const poolStats = getPoolStats();

        console.error("❌ Database connection timeout in authMiddleware:", {
          code: error.code,
          message: error.message,
          path: req.path,
          poolStats: poolStats
        });

        // If pool is exhausted, suggest retry
        if (poolStats.activeConnections >= (poolStats.connectionLimit * 0.9)) {
          return res.status(503).json({
            message: "Server is handling high traffic. Please try again in a moment.",
            code: "DB_TIMEOUT",
            retryAfter: 2
          });
        }

        return res.status(503).json({
          message: "Database connection timeout. Please try again in a moment.",
          code: "DB_TIMEOUT"
        });
      } else if (error.code === "ER_ACCESS_DENIED_ERROR") {
        console.error("❌ Database access denied in authMiddleware");
        return res.status(500).json({
          message: "Database configuration error. Please contact support.",
          code: "DB_CONFIG_ERROR"
        });
      } else if (error.code === "PROTOCOL_CONNECTION_LOST") {
        console.error("❌ Database connection lost in authMiddleware");
        return res.status(503).json({
          message: "Database connection lost. Please try again.",
          code: "DB_CONNECTION_LOST"
        });
      }

      console.error("JWT verification error:", error);
      res.status(403).json({ message: "Token verification failed" });
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

/**
 * Middleware to check if the user is a department user (staff or admin)
 */
const checkDepartmentUser = (req, res, next) => {
  if (!req.user || req.user.type !== "department") {
    return res.status(403).json({
      message: "Access denied. Department staff or admin required.",
      code: "ACCESS_DENIED",
    });
  }
  next();
};

const verifyToken = (req, res, next) => {
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
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Session expired. Please login again.",
        code: "TOKEN_EXPIRED",
      });
    }
    res.status(403).json({
      message: "Token verification failed",
      code: "TOKEN_INVALID",
    });
  }
};

/**
 * Middleware to check if the user is an admin
 */
const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      message: "Access denied. Admin privileges required.",
      code: "ADMIN_REQUIRED",
    });
  }
  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  checkDepartmentUser,
  verifyToken,
  isAdmin,
};
