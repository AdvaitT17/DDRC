const bcrypt = require("bcryptjs");
const pool = require("../config/database");

async function createAdminUser() {
  try {
    // Default admin credentials
    const adminUser = {
      username: "admin",
      password: "admin@ddrc", // This will be hashed
      role: "admin",
      full_name: "System Administrator",
      email: "admin@ddrc.gov.in",
    };

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminUser.password, salt);

    // Check if admin already exists
    const [existingUsers] = await pool.query(
      "SELECT id FROM users WHERE username = ?",
      [adminUser.username]
    );

    if (existingUsers.length > 0) {
      console.log("Admin user already exists");
      process.exit(0);
    }

    // Insert admin user
    await pool.query(
      `INSERT INTO users (username, password, role, full_name, email) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        adminUser.username,
        hashedPassword,
        adminUser.role,
        adminUser.full_name,
        adminUser.email,
      ]
    );

    console.log("Admin user created successfully");
    console.log("Username:", adminUser.username);
    console.log("Password:", adminUser.password);
  } catch (error) {
    console.error("Error creating admin user:", error);
  } finally {
    await pool.end();
  }
}

createAdminUser();
