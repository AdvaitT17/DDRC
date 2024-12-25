const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const formRoutes = require("./routes/formRoutes");

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

// Dashboard API Routes
app.get("/api/dashboard/stats", (req, res) => {
  res.json({
    totalRegistrations: 2345,
    pendingApplications: 148,
    approvedToday: 24,
    activeUsers: 1892,
  });
});

app.get("/api/applications/recent", (req, res) => {
  res.json([
    {
      id: "APP001",
      applicantName: "John Doe",
      submissionDate: "2024-01-15",
      status: "Pending",
    },
    {
      id: "APP002",
      applicantName: "Jane Smith",
      submissionDate: "2024-01-14",
      status: "Approved",
    },
  ]);
});

// HTML Routes - make sure these come after API routes
app.get(["/", "/admin", "/admin/*", "/registration"], (req, res) => {
  try {
    if (req.path === "/") {
      res.sendFile(path.join(__dirname, "../public/index.html"));
    } else if (req.path === "/registration") {
      res.sendFile(path.join(__dirname, "../public/registration/index.html"));
    } else {
      // For admin routes
      const adminPath =
        req.path === "/admin"
          ? "../public/admin/index.html"
          : `../public${req.path}.html`;
      res.sendFile(path.join(__dirname, adminPath));
    }
  } catch (error) {
    console.error("Error serving HTML:", error);
    res.status(500).send("Internal Server Error");
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
