const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
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

  /**
   * Generate a password reset token for a user
   * @param {string} email - User's email address
   * @returns {Object|null} - Token and user info if found, null if user not found
   */
  async generateResetToken(email) {
    try {
      // Find user by email
      const [users] = await pool.query(
        "SELECT id, email FROM registered_users WHERE email = ?",
        [email]
      );

      if (users.length === 0) {
        return null; // User not found - don't reveal this to caller for security
      }

      const user = users[0];

      // Generate secure random token
      const resetToken = crypto.randomBytes(32).toString("hex");

      // Set expiry to 1 hour from now
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      // Store token in database
      await pool.query(
        `UPDATE registered_users 
         SET reset_token = ?, reset_token_expires = ? 
         WHERE id = ?`,
        [resetToken, expiresAt, user.id]
      );

      return {
        token: resetToken,
        email: user.email,
        userId: user.id,
      };
    } catch (error) {
      console.error("Error generating reset token:", error);
      throw error;
    }
  }

  /**
   * Verify a password reset token is valid and not expired
   * @param {string} token - The reset token to verify
   * @returns {Object|null} - User info if valid, null otherwise
   */
  async verifyResetToken(token) {
    try {
      const [users] = await pool.query(
        `SELECT id, email FROM registered_users 
         WHERE reset_token = ? AND reset_token_expires > NOW()`,
        [token]
      );

      if (users.length === 0) {
        return null; // Token invalid or expired
      }

      return users[0];
    } catch (error) {
      console.error("Error verifying reset token:", error);
      throw error;
    }
  }

  /**
   * Reset user's password using a valid reset token
   * @param {string} token - The reset token
   * @param {string} newPassword - The new password (must be pre-validated)
   * @returns {boolean} - True if password was reset successfully
   */
  async resetPassword(token, newPassword) {
    try {
      // Verify token first
      const user = await this.verifyResetToken(token);
      if (!user) {
        return { success: false, message: "Invalid or expired reset token" };
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Update password and clear reset token
      await pool.query(
        `UPDATE registered_users 
         SET password = ?, reset_token = NULL, reset_token_expires = NULL 
         WHERE id = ?`,
        [hashedPassword, user.id]
      );

      console.log(`Password reset successful for user ${user.email}`);
      return { success: true, message: "Password reset successfully", email: user.email };
    } catch (error) {
      console.error("Error resetting password:", error);
      throw error;
    }
  }
}

module.exports = new UserAuthService();
