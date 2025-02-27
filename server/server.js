const express = require("express");
const cors = require("cors");
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
const { uploadsDir } = require("./config/upload");
const pool = require("./config/database");
const tokenManager = require("./utils/temporaryAccess");
const fs = require("fs");

const app = express();

// Create uploads directories if they don't exist
const uploadDirs = [
  path.join(__dirname, "uploads"),
  path.join(__dirname, "uploads/news"),
  path.join(__dirname, "uploads/forms"),
  path.join(__dirname, "uploads/documents"),
];

uploadDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve news files publicly without authentication
app.use("/uploads/news", express.static(path.join(__dirname, "uploads/news")));

// Serve user-submitted files with authentication
app.use("/uploads/forms", async (req, res, next) => {
  try {
    const accessToken = req.query.access_token;
    if (!accessToken) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Get the file path from the URL and clean it
    const filePath = req.url.split("?")[0];
    const cleanPath = filePath.replace(/^\//, "");
    const fullCleanPath = `forms/${cleanPath}`;

    // Validate the token and check if it matches the requested file
    const tokenData = tokenManager.validateToken(accessToken);

    if (!tokenData || tokenData.filename !== fullCleanPath) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    // If token is valid and matches the file, serve the file directly
    const fullPath = path.join(__dirname, "uploads", fullCleanPath);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: "File not found" });
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
    res.status(401).json({ message: "Error accessing file" });
  }
});

// Serve department files with authentication
app.use("/uploads/documents", async (req, res, next) => {
  try {
    const authToken = req.query.access_token;
    if (!authToken) {
      return res.status(401).json({ message: "No token provided" });
    }

    try {
      const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
      if (!decoded || decoded.type !== "department") {
        return res.status(403).json({ message: "Access denied" });
      }
      express.static(path.join(__dirname, "uploads/documents"))(req, res, next);
    } catch (err) {
      return res.status(401).json({ message: "Invalid token" });
    }
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
      res.status(404).send("Page not found");
    }
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
  res.status(404).send("Page not found");
});

// Error handling middleware
app.use((err, req, res, next) => {
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
