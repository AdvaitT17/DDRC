class AuthManager {
  static getAuthToken() {
    return localStorage.getItem("authToken");
  }

  static getUserInfo() {
    const userInfo = localStorage.getItem("userInfo");
    return userInfo ? JSON.parse(userInfo) : null;
  }

  static getUserType() {
    const userInfo = this.getUserInfo();
    return userInfo?.type || null;
  }

  static isAuthenticated() {
    return !!this.getAuthToken();
  }

  static async verifyAuth() {
    const token = this.getAuthToken();
    if (!token) return false;

    try {
      const response = await fetch("/api/auth/verify", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        this.logout();
        return false;
      }

      const data = await response.json();
      localStorage.setItem("userInfo", JSON.stringify(data.user));
      return true;
    } catch (error) {
      console.error("Auth verification error:", error);
      this.logout();
      return false;
    }
  }

  static logout() {
    localStorage.removeItem("authToken");
    localStorage.removeItem("userInfo");
    // Check if we're in admin section
    if (window.location.pathname.startsWith("/admin")) {
      window.location.href = "/department-login";
    } else {
      window.location.href = "/login";
    }
  }

  static async checkAuthAndRedirect() {
    const isAuth = await this.verifyAuth();
    const currentPath = window.location.pathname;
    const userType = this.getUserType();

    if (isAuth) {
      // Redirect authenticated users based on their type
      if (userType === "applicant") {
        if (
          ["/login", "/registration", "/department-login"].includes(currentPath)
        ) {
          window.location.href = "/registration/form";
          return false;
        }
      } else if (userType === "department") {
        if (
          ["/login", "/registration", "/department-login"].includes(currentPath)
        ) {
          window.location.href = "/admin/dashboard";
          return false;
        }
      }
    } else {
      // Redirect unauthenticated users trying to access protected pages
      if (
        currentPath.startsWith("/admin") ||
        ["/registration/form"].includes(currentPath)
      ) {
        window.location.href = currentPath.startsWith("/admin")
          ? "/department-login"
          : "/login";
        return false;
      }
    }

    return true;
  }
}
