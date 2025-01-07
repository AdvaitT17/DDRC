const pool = require("../config/database");

const requireCompletedRegistration = async (req, res, next) => {
  try {
    const [registration] = await pool.query(
      `SELECT id FROM registration_progress 
       WHERE user_id = ? AND status = 'completed'
       LIMIT 1`,
      [req.user.id]
    );

    if (registration.length === 0) {
      return res.status(403).json({
        message: "Please complete registration first",
        redirect: "/registration/form",
      });
    }

    next();
  } catch (error) {
    console.error("Registration check error:", error);
    res.status(500).json({ message: "Error checking registration status" });
  }
};

module.exports = { requireCompletedRegistration };
