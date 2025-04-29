const jwt = require("jsonwebtoken");

// Mock JWT functions
jest.mock("jsonwebtoken");

// Mock middleware functions to test
const authMiddleware = {
  authenticateToken: (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({
        success: false,
        error: { code: 401, message: "No token provided" },
      });
    }

    const token = req.headers.authorization.split(" ")[1];

    try {
      const decoded = jwt.verify(token, "test-secret");
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(403).json({
        success: false,
        error: { code: 403, message: "Invalid token" },
      });
    }
  },

  requireRole: (role) => {
    return (req, res, next) => {
      if (req.user && req.user.role === role) {
        next();
      } else {
        res.status(403).json({
          success: false,
          error: { code: 403, message: "Insufficient permissions" },
        });
      }
    };
  },
};

describe("Authentication Middleware", () => {
  let req, res, next;

  beforeEach(() => {
    jwt.verify.mockReset();

    req = {
      headers: {},
      user: null,
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe("authenticateToken", () => {
    test("should return 401 if no token provided", () => {
      authMiddleware.authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 401,
            message: expect.any(String),
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test("should return 403 if token is invalid", () => {
      req.headers.authorization = "Bearer invalid-token";
      jwt.verify.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      authMiddleware.authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 403,
            message: expect.any(String),
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test("should set req.user and call next with valid token", () => {
      const user = { id: 1, username: "testuser", role: "admin" };
      req.headers.authorization = "Bearer valid-token";

      jwt.verify.mockReturnValue(user);

      authMiddleware.authenticateToken(req, res, next);

      expect(req.user).toEqual(user);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("requireRole", () => {
    test("should return 403 if user role does not match required role", () => {
      req.user = { role: "user" };

      const middleware = authMiddleware.requireRole("admin");
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 403,
            message: expect.any(String),
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test("should call next if user role matches required role", () => {
      req.user = { role: "admin" };

      const middleware = authMiddleware.requireRole("admin");
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
