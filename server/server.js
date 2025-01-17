const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const formRoutes = require("./routes/formRoutes");
const authRoutes = require("./routes/authRoutes");
const userAuthRoutes = require("./routes/userAuthRoutes");
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
const { uploadsDir } = require("./config/upload");
const pool = require("./config/database");
const tokenManager = require("./utils/temporaryAccess");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files with authentication
app.use("/uploads", async (req, res, next) => {
  try {
    const accessToken = req.query.access_token;
    if (!accessToken) {
      return res.status(401).json({ message: "No token provided" });
    }

    const accessData = tokenManager.validateToken(accessToken);
    if (!accessData) {
      return res
        .status(401)
        .json({ message: "Invalid or expired access token" });
    }

    // Verify the requested file matches the token
    if (accessData.filename !== req.path.slice(1)) {
      return res.status(403).json({ message: "Access denied" });
    }

    express.static(uploadsDir)(req, res, next);
  } catch (error) {
    console.error("Upload access error:", error);
    res.status(401).json({ message: "Invalid token" });
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
app.use("/api/track", require("./routes/trackingRoutes"));
app.use(
  "/api/dashboard",
  authenticateToken,
  requireCompletedRegistration,
  dashboardRoutes
);
app.use("/api/admin", userManagementRoutes);

// HTML Routes - make sure these come after API routes
app.get(
  [
    "/",
    "/registration",
    "/department-login",
    "/registration/form",
    "/registration/success",
    "/login",
    "/track",
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

      // Serve appropriate HTML file based on path
      if (req.path === "/") {
        res.sendFile(path.join(__dirname, "../public/index.html"));
      } else if (req.path === "/registration") {
        res.sendFile(path.join(__dirname, "../public/registration/index.html"));
      } else if (req.path === "/registration/form") {
        res.sendFile(
          path.join(__dirname, "../public/registration/form/index.html")
        );
      } else if (req.path === "/registration/success") {
        res.sendFile(
          path.join(__dirname, "../public/registration/success/index.html")
        );
      } else if (req.path === "/department-login") {
        res.sendFile(
          path.join(__dirname, "../public/department-login/index.html")
        );
      } else if (req.path === "/login") {
        res.sendFile(path.join(__dirname, "../public/login/index.html"));
      } else if (req.path === "/track") {
        res.sendFile(path.join(__dirname, "../public/track/index.html"));
      }
    } catch (error) {
      console.error("Error serving HTML:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

// Admin routes - serve admin HTML for all admin paths with auth check
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

    res.sendFile(path.join(__dirname, "../public/admin/index.html"));
  } catch (error) {
    console.error("Error serving admin HTML:", error);
    res.redirect("/department-login");
  }
});

// Health check route
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

// Error handling for 404
app.use((req, res) => {
  console.log("404 Not Found:", req.path);
  res.status(404).send("Page not found");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server Error:", err.stack);
  res.status(500).json({ error: "Something went wrong!" });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
