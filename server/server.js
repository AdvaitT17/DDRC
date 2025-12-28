const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
require("dotenv").config();
const formRoutes = require("./routes/formRoutes");
const authRoutes = require("./routes/authRoutes");
const userAuthRoutes = require("./routes/userAuthRoutes");
const newsRoutes = require("./routes/news");
const {
  authenticateToken,
  requireRole,
} = require("./middleware/authMiddleware");
const adminRoutes = require("./routes/adminRoutes");
const registrationRoutes = require("./routes/registrationRoutes");
const jwt = require("jsonwebtoken");
const dashboardRoutes = require("./routes/dashboardRoutes");
const {
  requireCompletedRegistration,
} = require("./middleware/registrationMiddleware");
const userManagementRoutes = require("./routes/userManagementRoutes");
const reportRoutes = require("./routes/reportRoutes");
const { uploadsDir } = require("./config/upload");
const pool = require("./config/database");
const tokenManager = require("./utils/temporaryAccess");
const fs = require("fs");
const reportNotificationRoutes = require("./routes/reportNotificationRoutes");
const eventRoutes = require("./routes/events");
const {
  initReportEmailScheduler,
} = require("./schedulers/reportEmailScheduler");
const userRoutes = require("./routes/userRoutes");
const contactRoutes = require("./routes/contactRoutes");
const translationRoutes = require("./routes/translationRoutes");
const schemeRoutes = require("./routes/schemeRoutes");

const app = express();

// Trust proxy for Azure/load balancer (required for rate limiting to work correctly)
// Azure App Service uses a load balancer that sets X-Forwarded-For
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1); // Trust first proxy
  console.log('✅ Trust proxy enabled for load balancer/Azure');
}

// Create uploads directories if they don't exist
const uploadDirs = [
  path.join(__dirname, "uploads"),
  path.join(__dirname, "uploads/news"),
  path.join(__dirname, "uploads/forms"),
  path.join(__dirname, "uploads/documents"),];

uploadDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Helper function for consistent API error responses
const apiErrorResponse = (res, status, message) => {
  return res.status(status).json({
    success: false,
    error: {
      code: status,
      message: message || getDefaultErrorMessage(status),
    },
  });
};

// Get default error message based on status code
const getDefaultErrorMessage = (status) => {
  switch (status) {
    case 400:
      return "Bad Request";
    case 401:
      return "Unauthorized";
    case 403:
      return "Forbidden";
    case 404:
      return "Not Found";
    case 500:
      return "Internal Server Error";
    default:
      return "An error occurred";
  }
};

// =============================================================================
// SECURITY MIDDLEWARE
// =============================================================================

// Helmet - Security headers (XSS, clickjacking, MIME sniffing protection)
// CSP sources can be extended via environment variables for future additions
const defaultScriptSources = [
  "'self'",
  "'unsafe-inline'",
  "'unsafe-eval'",
  "cdn.jsdelivr.net",
  "cdnjs.cloudflare.com",
  "code.jquery.com",
];
const defaultStyleSources = [
  "'self'",
  "'unsafe-inline'",
  "fonts.googleapis.com",
  "cdn.jsdelivr.net",
  "cdnjs.cloudflare.com",
];
const defaultFrameSources = [
  "'self'",
  "www.google.com",
  "maps.google.com",
];

// Allow extending CSP via environment variables (comma-separated)
const extraScriptSources = process.env.CSP_SCRIPT_SOURCES?.split(",").map(s => s.trim()) || [];
const extraStyleSources = process.env.CSP_STYLE_SOURCES?.split(",").map(s => s.trim()) || [];
const extraFrameSources = process.env.CSP_FRAME_SOURCES?.split(",").map(s => s.trim()) || [];

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [...defaultScriptSources, ...extraScriptSources],
        scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers like onclick
        styleSrc: [...defaultStyleSources, ...extraStyleSources],
        fontSrc: ["'self'", "fonts.gstatic.com", "cdn.jsdelivr.net", "data:"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
        frameSrc: [...defaultFrameSources, ...extraFrameSources],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false, // Allow embedding resources
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  })
);

// CORS - Restrict to allowed origins only
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
  : [];

// In production, always allow the main domain
if (process.env.NODE_ENV === "production") {
  const productionDomains = [
    "https://ddrc.org.in",
    "https://www.ddrc.org.in",
  ];
  productionDomains.forEach((domain) => {
    if (!allowedOrigins.includes(domain)) {
      allowedOrigins.push(domain);
    }
  });
}

// In development, allow localhost
if (process.env.NODE_ENV !== "production") {
  allowedOrigins.push("http://localhost:3000", "http://127.0.0.1:3000");
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, same-origin)
      if (!origin) return callback(null, true);

      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️ CORS blocked request from origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve sitemap.xml
app.get("/sitemap.xml", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/sitemap.xml"));
});

// Serve news files publicly without authentication
app.use("/uploads/news", express.static(path.join(__dirname, "uploads/news")));

// Serve event images publicly without authentication
app.use(
  "/uploads/events",
  express.static(path.join(__dirname, "uploads/events"))
);

// Serve user-submitted files with authentication
app.use("/uploads/forms", async (req, res, next) => {
  try {
    const accessToken = req.query.access_token;
    if (!accessToken) {
      return res
        .status(401)
        .sendFile(path.join(__dirname, "../public/error.html"), {
          query: { code: 401, message: "Authentication Required" },
        });
    }

    // Get the file path from the URL and clean it
    const filePath = req.url.split("?")[0];
    const cleanPath = filePath.replace(/^\//, "");
    const fullCleanPath = `forms/${cleanPath}`;

    // Validate the token and check if it matches the requested file
    const tokenData = tokenManager.validateToken(accessToken);

    if (!tokenData || tokenData.filename !== fullCleanPath) {
      return res
        .status(401)
        .sendFile(path.join(__dirname, "../public/error.html"), {
          query: { code: 401, message: "Invalid or expired token" },
        });
    }

    // If token is valid and matches the file, serve the file directly
    const fullPath = path.join(__dirname, "uploads", fullCleanPath);

    if (!fs.existsSync(fullPath)) {
      return res
        .status(404)
        .sendFile(path.join(__dirname, "../public/error.html"), {
          query: { code: 404, message: "File not found" },
        });
    }

    // Set appropriate content type based on file extension
    const ext = path.extname(fullPath).toLowerCase();
    const contentType =
      {
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
      }[ext] || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    fs.createReadStream(fullPath).pipe(res);
  } catch (error) {
    res.status(401).sendFile(path.join(__dirname, "../public/error.html"), {
      query: { code: 401, message: "Error accessing file" },
    });
  }
});

// Serve department files with authentication
app.use("/uploads/documents", async (req, res, next) => {
  try {
    const authToken = req.query.access_token;
    if (!authToken) {
      return res
        .status(401)
        .sendFile(path.join(__dirname, "../public/error.html"), {
          query: { code: 401, message: "Authentication Required" },
        });
    }

    try {
      const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
      if (!decoded || decoded.type !== "department") {
        return res
          .status(403)
          .sendFile(path.join(__dirname, "../public/error.html"), {
            query: { code: 403, message: "Access denied" },
          });
      }
      express.static(path.join(__dirname, "uploads/documents"))(req, res, next);
    } catch (err) {
      return res
        .status(401)
        .sendFile(path.join(__dirname, "../public/error.html"), {
          query: { code: 401, message: "Invalid token" },
        });
    }
  } catch (error) {
    console.error("Upload access error:", error);
    res.status(401).sendFile(path.join(__dirname, "../public/error.html"), {
      query: { code: 401, message: "Invalid token" },
    });
  }
});

// Serve static files with proper MIME types
app.use(
  express.static(path.join(__dirname, "../public"), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".css")) {
        res.setHeader("Content-Type", "text/css");
      } else if (filePath.endsWith(".js")) {
        res.setHeader("Content-Type", "application/javascript");
      } else if (filePath.endsWith(".svg")) {
        res.setHeader("Content-Type", "image/svg+xml");
      } else if (filePath.endsWith(".png")) {
        res.setHeader("Content-Type", "image/png");
      } else if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) {
        res.setHeader("Content-Type", "image/jpeg");
      }
    },
  })
);

// API Routes
app.use("/api/form", formRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/auth", userAuthRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/registration", registrationRoutes);
app.use(
  "/api/admin",
  authenticateToken,
  (req, res, next) => {
    if (req.user.type !== "department") {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  },
  adminRoutes
);
// Comment out the document routes that don't exist
// app.use(
//   "/api/documents",
//   authenticateToken,
//   require("./routes/documentRoutes")
// );
app.use("/api/track", require("./routes/trackingRoutes"));
app.use(
  "/api/dashboard",
  authenticateToken,
  requireCompletedRegistration,
  dashboardRoutes
);
app.use("/api/admin", userManagementRoutes);
app.use("/api/events", require("./routes/events"));
app.use("/api/reports", reportRoutes);
app.use("/api/report-notifications", reportNotificationRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/users", userRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/equipment", require("./routes/equipmentRoutes"));
app.use("/api/translate", translationRoutes);
app.use("/api/schemes", schemeRoutes);

// HTML Routes - make sure these come after API routes
app.get(
  [
    "/",
    "/registration",
    "/department-login",
    "/registration/form",
    "/registration/success",
    "/login",
    "/forgot-password",
    "/reset-password",
    "/track",
    "/events",
    "/events/event",
  ],
  async (req, res) => {
    try {
      // For registration form, check auth and registration status
      if (req.path === "/registration/form") {
        const authHeader = req.headers["authorization"];
        const token = authHeader && authHeader.split(" ")[1];

        if (token) {
          try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            // Check if user has completed registration
            const [registration] = await pool.query(
              `SELECT id FROM registration_progress 
             WHERE user_id = ? AND status = 'completed'
             LIMIT 1`,
              [decoded.id]
            );

            if (registration.length > 0) {
              // If registration is complete, redirect to dashboard
              return res.redirect("/dashboard");
            }
          } catch (err) {
            console.error("Token verification error:", err);
          }
        }
      }

      // Special handling for event pages
      if (req.path === "/events/event") {
        // Ensure we serve the event.html page regardless of query parameters
        return res.sendFile(
          path.join(__dirname, "../public/events/event.html")
        );
      }

      // Map paths to their corresponding HTML files
      const pathMap = {
        "/": "../public/index.html",
        "/registration": "../public/registration/index.html",
        "/registration/form": "../public/registration/form/index.html",
        "/registration/success": "../public/registration/success/index.html",
        "/department-login": "../public/department-login/index.html",
        "/login": "../public/login/index.html",
        "/forgot-password": "../public/forgot-password/index.html",
        "/reset-password": "../public/reset-password/index.html",
        "/track": "../public/track/index.html",
        "/events": "../public/events/index.html",
      };

      const filePath = pathMap[req.path];
      if (filePath) {
        res.sendFile(path.join(__dirname, filePath));
      } else {
        // Send 404 page instead of plain text
        res.status(404).sendFile(path.join(__dirname, "../public/error.html"));
      }
    } catch (error) {
      console.error("Error serving HTML:", error);
      res.status(500).sendFile(path.join(__dirname, "../public/error.html"), {
        query: { code: 500 },
      });
    }
  }
);

// Admin routes - serve admin HTML files directly
app.get(["/admin", "/admin/*"], async (req, res) => {
  try {
    // Check for auth token
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.redirect("/department-login");
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.type !== "department") {
        return res.redirect("/department-login");
      }
    } catch (err) {
      return res.redirect("/department-login");
    }

    // If path is just /admin, redirect to dashboard
    if (req.path === "/admin") {
      return res.redirect("/admin/dashboard/index.html");
    }

    // Try to serve the requested HTML file
    const filePath = path.join(__dirname, "../public", req.path);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      // If file doesn't exist, send 404
      res.status(404).sendFile(path.join(__dirname, "../public/error.html"), {
        query: { code: 404 },
      });
    }
  } catch (error) {
    console.error("Error serving admin HTML:", error);
    res.redirect("/department-login");
  }
});

// Universal error handler for all other routes
app.use((req, res) => {
  // Check if the request is an API request
  if (req.path.startsWith("/api/")) {
    return apiErrorResponse(res, 404, "API endpoint not found");
  }

  // For non-API requests, send the error page
  res.status(404).sendFile(path.join(__dirname, "../public/error.html"), {
    query: { code: 404 },
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);

  // Check if the request is an API request
  if (req.path.startsWith("/api/")) {
    return apiErrorResponse(res, 500, err.message || "Internal Server Error");
  }

  // For non-API requests, send the error page
  res.status(500).sendFile(path.join(__dirname, "../public/error.html"), {
    query: {
      code: 500,
      message:
        process.env.NODE_ENV === "production"
          ? "Internal Server Error"
          : err.message || "Internal Server Error",
    },
  });
});

// Health check route
app.get("/api/health", async (req, res) => {
  try {
    const { testConnection, getPoolStats } = require('./config/database');

    // Test database connection
    const dbHealthy = await testConnection();
    const poolStats = getPoolStats();

    const health = {
      status: dbHealthy ? "OK" : "DEGRADED",
      timestamp: new Date().toISOString(),
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version
      },
      database: {
        connected: dbHealthy,
        pool: poolStats
      }
    };

    const statusCode = dbHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: "ERROR",
      message: "Health check failed",
      error: error.message
    });
  }
});

// Serve dashboard pages
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/dashboard/index.html"));
});

app.get("/dashboard/profile", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/dashboard/profile/index.html"));
});

app.get("/dashboard/documents", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../public/dashboard/documents/index.html")
  );
});

app.get("/dashboard/equipment", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../public/dashboard/equipment/index.html")
  );
});

// Initialize schedulers
initReportEmailScheduler();

const PORT = process.env.PORT || 3000;

// Start server with database connection check
async function startServer() {
  try {
    // Test database connection before starting server
    console.log('🔍 Testing database connection...');
    const { testConnection } = require('./config/database');
    const dbConnected = await testConnection();

    if (!dbConnected) {
      console.error('⚠️  Server starting WITHOUT database connection');
      console.error('   The application will continue but database operations will fail');
      console.error('   Please check your database configuration and restart the server');
    }

    // Start the HTTP server
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      if (dbConnected) {
        console.log('✅ All systems operational');
      } else {
        console.log('⚠️  Server running with database connection issues');
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
