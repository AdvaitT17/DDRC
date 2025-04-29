// Global test setup file
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// Ensure test timeouts are reasonable
jest.setTimeout(10000);

// Mock environment variables for testing if needed
process.env.NODE_ENV = "test";

// Setup complete
console.log("Test setup complete");
