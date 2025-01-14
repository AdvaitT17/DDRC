const jwt = require("jsonwebtoken");
const pool = require("../config/database");

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Invalid authorization header" });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check user type and fetch appropriate data
      if (decoded.type === "department") {
        const [users] = await pool.query(
          "SELECT id, username, role, full_name, email FROM users WHERE id = ?",
          [decoded.id]
        );

        if (users.length === 0) {
          throw new Error("Department user not found");
        }

        req.user = { ...users[0], type: "department" };
      } else if (decoded.type === "applicant") {
        const [users] = await pool.query(
          "SELECT id, email, phone FROM registered_users WHERE id = ?",
          [decoded.id]
        );

        if (users.length === 0) {
          throw new Error("User not found");
        }

        req.user = { ...users[0], type: "applicant" };
      } else {
        throw new Error("Invalid user type");
      }

      next();
    } catch (jwtError) {
      console.error("JWT verification error:", jwtError);
      return res.status(401).json({ message: "Invalid token" });
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ message: "Server error during authentication" });
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
