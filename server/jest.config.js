module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.js", "**/?(*.)+(spec|test).js"],
  collectCoverageFrom: [
    "routes/**/*.js",
    "middleware/**/*.js",
    "services/**/*.js",
    "utils/**/*.js",
    "!**/*.test.js",
    "!**/node_modules/**",
  ],
  coverageReporters: ["text", "lcov", "clover", "html"],
  testTimeout: 10000, // 10 seconds
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
};
