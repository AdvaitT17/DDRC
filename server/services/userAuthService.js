const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");

class UserAuthService {
  async registerUser(email, phone, password) {
    try {
      // Check if user already exists
      const [existingUsers] = await pool.query(
        "SELECT id FROM registered_users WHERE email = ? OR username = ?",
        [email, email]
      );

      if (existingUsers.length > 0) {
        throw new Error("User with this email already exists");
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Insert new user
      const [result] = await pool.query(
        `INSERT INTO registered_users (username, email, phone, password) 
         VALUES (?, ?, ?, ?)`,
        [email, email, phone, hashedPassword]
      );

      return {
        id: result.insertId,
        username: email,
        email,
        phone,
      };
    } catch (error) {
      console.error("Error in registerUser:", error);
      throw error;
    }
  }

  generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        type: "applicant",
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return null;
    }
  }
}

module.exports = new UserAuthService();
