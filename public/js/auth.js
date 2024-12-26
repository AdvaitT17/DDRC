class AuthManager {
  static isAuthenticated() {
    return !!localStorage.getItem("authToken");
  }

  static async verifyAuth() {
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        return false;
      }

      const response = await fetch("/api/auth/verify", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        this.clearAuth();
        return false;
      }

      const data = await response.json();
      // Store user info
      localStorage.setItem("userInfo", JSON.stringify(data.user));
      return true;
    } catch (error) {
      console.error("Auth verification error:", error);
      this.clearAuth();
      return false;
    }
  }

  static clearAuth() {
    localStorage.removeItem("authToken");
    localStorage.removeItem("userInfo");
  }

  static getAuthToken() {
    return localStorage.getItem("authToken");
  }

  static getUserInfo() {
    const userInfo = localStorage.getItem("userInfo");
    return userInfo ? JSON.parse(userInfo) : null;
  }

  static redirectToLogin() {
    window.location.href = "/department-login";
  }
}
