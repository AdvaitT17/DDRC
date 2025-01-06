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

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  (req, res) => {
    try {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
