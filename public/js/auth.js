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
    const userType = this.getUserType();
    localStorage.removeItem("authToken");
    localStorage.removeItem("userInfo");

    // Redirect based on user type
    if (userType === "department") {
      window.location.href = "/department-login";
    } else {
      window.location.href = "/login";
    }
  }

  static initLogoutHandler() {
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.logout();
      });
    }
  }

  static async checkAuthAndRedirect() {
    const currentPath = window.location.pathname;

    try {
      const isAuth = await this.verifyAuth();

      if (isAuth) {
        // User is authenticated
        const userType = this.getUserType();

        if (userType === "applicant") {
          // Check registration status
          const response = await fetch("/api/registration/check-status", {
            headers: {
              Authorization: `Bearer ${this.getAuthToken()}`,
            },
          });
          const data = await response.json();

          // Handle public routes for authenticated users
          if (["/login", "/registration"].includes(currentPath)) {
            if (data.hasRegistration) {
              window.location.href = "/dashboard";
            } else {
              window.location.href = "/registration/form";
            }
            return false;
          }

          // Handle protected routes based on registration status
          if (data.hasRegistration) {
            if (currentPath === "/registration/form") {
              window.location.href = "/dashboard";
              return false;
            }
          } else {
            if (currentPath === "/dashboard") {
              window.location.href = "/registration/form";
              return false;
            }
          }
        }
      } else {
        // User is not authenticated - redirect to login for protected routes
        if (
          currentPath.startsWith("/dashboard") ||
          currentPath === "/registration/form"
        ) {
          window.location.href = "/login";
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error("Auth check error:", error);
      // For any errors, redirect to login
      if (currentPath !== "/login") {
        window.location.href = "/login";
      }
      return false;
    }
  }
}
