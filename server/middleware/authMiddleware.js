const authService = require("../services/authService");

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const user = authService.verifyToken(token);
  if (!user) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }

  req.user = user;
  next();
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole,
};
