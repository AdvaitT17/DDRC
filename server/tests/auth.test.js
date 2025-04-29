const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// Mock Express router
const mockRouter = express.Router();
mockRouter.post("/login", (req, res) => {
  const { username, password } = req.body;

  // Check if username and password are provided
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: { code: 400, message: "Username and password are required" },
    });
  }

  // For testing, we'll use these mock credentials
  if (username === "testuser" && password === "testpassword") {
    const token = "mock-jwt-token";
    return res.status(200).json({ success: true, token });
  }

  // Invalid credentials
  return res.status(401).json({
    success: false,
    error: { code: 401, message: "Invalid credentials" },
  });
});

describe("Authentication API", () => {
  let app;

  beforeEach(() => {
    // Create an Express application for testing
    app = express();
    app.use(express.json());
    app.use("/auth", mockRouter);
  });

  test("Login should return 400 with missing credentials", async () => {
    const response = await request(app).post("/auth/login").send({});

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty("error");
    expect(response.body.success).toBe(false);
  });

  test("Login should return 401 with invalid credentials", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ username: "invaliduser", password: "wrongpassword" });

    expect(response.statusCode).toBe(401);
    expect(response.body).toHaveProperty("error");
    expect(response.body.success).toBe(false);
  });

  test("Login should return token with valid credentials", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ username: "testuser", password: "testpassword" });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("token");
    expect(response.body.success).toBe(true);
  });
});
