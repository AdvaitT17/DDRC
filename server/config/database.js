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
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 10000,
  maxIdle: 10,
  idleTimeout: 300000,
});

setInterval(async () => {
  try {
    await pool.query("SELECT 1");
  } catch (error) {
    console.error("Error pinging database:", error);
  }
}, 300000);

module.exports = pool;
