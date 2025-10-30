const mysql = require("mysql2/promise");
require("dotenv").config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 10000, // Reduced from 30s to 10s for faster failure detection
  maxIdle: 10,
  idleTimeout: 60000, // Reduced from 5 minutes to 1 minute
};

// Validate required environment variables
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required database environment variables:', missingEnvVars.join(', '));
  console.error('Please ensure your .env file contains: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
}

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Track connection state
let lastHealthCheckSuccess = null;
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 5;

/**
 * Test database connection
 * @returns {Promise<boolean>} - Returns true if connection is successful
 */
async function testConnection() {
  const startTime = Date.now();
  try {
    await pool.query("SELECT 1 AS health_check");
    const duration = Date.now() - startTime;
    consecutiveFailures = 0;
    lastHealthCheckSuccess = new Date();
    console.log(`✅ Database connection successful (${duration}ms)`);
    return true;
  } catch (error) {
    consecutiveFailures++;
    const duration = Date.now() - startTime;
    
    console.error(`❌ Database connection failed (${duration}ms):`, {
      code: error.code,
      errno: error.errno,
      message: error.message,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      consecutiveFailures: consecutiveFailures
    });

    // Provide helpful error messages based on error type
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error('💡 Troubleshooting tips:');
      console.error('   - Check if the database server is running');
      console.error('   - Verify DB_HOST and DB_PORT are correct');
      console.error('   - Check firewall/network connectivity');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('💡 Access denied. Check:');
      console.error('   - DB_USER and DB_PASSWORD are correct');
      console.error('   - Database user has proper permissions');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('💡 Database not found. Check:');
      console.error('   - DB_NAME is correct');
      console.error('   - Database exists on the server');
    }

    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.error(`⚠️  Database has failed ${MAX_CONSECUTIVE_FAILURES} consecutive health checks`);
      console.error('   Consider restarting the application after fixing database connection');
    }

    return false;
  }
}

/**
 * Get connection pool stats
 * @returns {Object} - Pool statistics
 */
function getPoolStats() {
  try {
    return {
      totalConnections: pool.pool._allConnections.length,
      freeConnections: pool.pool._freeConnections.length,
      queueLength: pool.pool._connectionQueue.length,
      lastHealthCheck: lastHealthCheckSuccess,
      consecutiveFailures: consecutiveFailures
    };
  } catch (error) {
    return {
      error: 'Unable to get pool stats',
      consecutiveFailures: consecutiveFailures
    };
  }
}

// Periodic health check (every 60 seconds instead of 5 minutes)
const healthCheckInterval = setInterval(async () => {
  try {
    await testConnection();
  } catch (error) {
    // Error already logged in testConnection
  }
}, 60000); // Run every minute

// Cleanup on process termination
process.on('SIGTERM', async () => {
  console.log('📊 SIGTERM signal received: closing database connections');
  clearInterval(healthCheckInterval);
  try {
    await pool.end();
    console.log('✅ Database pool closed successfully');
  } catch (error) {
    console.error('❌ Error closing database pool:', error);
  }
});

process.on('SIGINT', async () => {
  console.log('📊 SIGINT signal received: closing database connections');
  clearInterval(healthCheckInterval);
  try {
    await pool.end();
    console.log('✅ Database pool closed successfully');
  } catch (error) {
    console.error('❌ Error closing database pool:', error);
  }
  process.exit(0);
});

module.exports = pool;
module.exports.testConnection = testConnection;
module.exports.getPoolStats = getPoolStats;
