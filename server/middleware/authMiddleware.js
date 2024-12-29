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

    // Check if it's a department user or regular user based on type
    if (decoded.type === "applicant") {
      const [users] = await pool.query(
        "SELECT id, email, phone FROM registered_users WHERE id = ?",
        [decoded.id]
      );
      if (users.length === 0) {
        throw new Error("User not found");
      }
      req.user = { ...users[0], type: "applicant" };
    } else {
      const [users] = await pool.query(
        "SELECT id, username, role FROM users WHERE id = ?",
        [decoded.id]
      );
      if (users.length === 0) {
        throw new Error("User not found");
      }
      req.user = { ...users[0], type: "department" };
    }

    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({ message: "Invalid token" });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
};

module.exports = { authenticateToken, requireRole };
