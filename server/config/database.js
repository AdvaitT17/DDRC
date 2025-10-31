const mysql = require("mysql2/promise");
require("dotenv").config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
  
  // Connection pooling - optimized for high-traffic app
  waitForConnections: true,
  connectionLimit: process.env.DB_CONNECTION_LIMIT 
    ? parseInt(process.env.DB_CONNECTION_LIMIT) 
    : (process.env.NODE_ENV === 'production' ? 50 : 10), // Increased default for production
  queueLimit: 25, // Allow queuing for burst traffic (was 10)
  maxIdle: process.env.DB_CONNECTION_LIMIT 
    ? parseInt(process.env.DB_CONNECTION_LIMIT) 
    : (process.env.NODE_ENV === 'production' ? 50 : 10),
  
  // Connection lifecycle
  connectTimeout: 10000, // 10 seconds to establish connection
  acquireTimeout: 15000, // 15 seconds to acquire connection from pool (increased for high traffic)
  idleTimeout: 60000, // 1 minute before idle connections are closed
  
  // Connection health
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  
  // Security (for government compliance)
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
  } : false,
  
  // Query timeouts (critical for preventing hanging queries)
  timeout: 30000, // 30 seconds query timeout
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

// Track connection state and metrics for monitoring
let lastHealthCheckSuccess = null;
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 5;

// Track pool metrics for government app monitoring
let poolMetrics = {
  totalQueries: 0,
  failedQueries: 0,
  timeoutErrors: 0,
  poolExhaustionEvents: 0,
  lastExhaustionTime: null,
  peakActiveConnections: 0,
  peakQueueLength: 0
};

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
    const stats = {
      totalConnections: pool.pool._allConnections.length,
      freeConnections: pool.pool._freeConnections.length,
      activeConnections: pool.pool._allConnections.length - pool.pool._freeConnections.length,
      queueLength: pool.pool._connectionQueue.length,
      connectionLimit: dbConfig.connectionLimit,
      lastHealthCheck: lastHealthCheckSuccess,
      consecutiveFailures: consecutiveFailures,
      poolUtilization: ((pool.pool._allConnections.length - pool.pool._freeConnections.length) / dbConfig.connectionLimit * 100).toFixed(1) + '%'
    };

    // Log warning if pool is nearly exhausted
    if (stats.activeConnections >= dbConfig.connectionLimit * 0.8 && stats.queueLength > 0) {
      console.warn(`⚠️  Connection pool nearly exhausted: ${stats.activeConnections}/${stats.connectionLimit} active, ${stats.queueLength} queued`);
    }

    return stats;
  } catch (error) {
    return {
      error: 'Unable to get pool stats',
      consecutiveFailures: consecutiveFailures
    };
  }
}

/**
 * Wrapper function to track query metrics and handle errors
 * Use this for critical queries that need monitoring in government app
 */
async function executeQuery(sql, params = [], options = {}) {
  poolMetrics.totalQueries++;
  const startTime = Date.now();
  
  try {
    const result = await pool.query(sql, params);
    const duration = Date.now() - startTime;
    
    // Log slow queries (for government compliance monitoring)
    if (duration > 5000 && process.env.NODE_ENV === 'production') {
      console.warn(`⚠️  Slow query detected (${duration}ms): ${sql.substring(0, 100)}...`);
    }
    
    return result;
  } catch (error) {
    poolMetrics.failedQueries++;
    
    if (error.code === 'ETIMEDOUT') {
      poolMetrics.timeoutErrors++;
    }
    
    const duration = Date.now() - startTime;
    console.error(`❌ Query failed after ${duration}ms:`, {
      code: error.code,
      message: error.message,
      sql: sql.substring(0, 100)
    });
    
    throw error;
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
module.exports.executeQuery = executeQuery;
module.exports.getMetrics = () => poolMetrics;
