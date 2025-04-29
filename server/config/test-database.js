// Database configuration for testing
const mysql = require("mysql2/promise");

// Create a test database pool
const pool = mysql.createPool({
  host: process.env.TEST_DB_HOST || process.env.DB_HOST || "localhost",
  user: process.env.TEST_DB_USER || process.env.DB_USER || "test",
  password: process.env.TEST_DB_PASSWORD || process.env.DB_PASSWORD || "test",
  database: process.env.TEST_DB_NAME || "ddrc_test",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Export the pool for use in tests
module.exports = pool;
