const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test the connection and verify tables
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("Database connection successful");

    // Check if tables exist
    const [tables] = await connection.query(
      `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = ? 
      AND table_name IN ('form_sections', 'form_fields')
    `,
      [process.env.DB_NAME]
    );

    console.log(
      "Available tables:",
      tables.map((t) => t.table_name)
    );
    connection.release();
  } catch (err) {
    console.error("Database connection error:", err);
  }
}

testConnection();

module.exports = pool;
