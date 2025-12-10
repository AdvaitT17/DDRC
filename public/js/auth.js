class AuthManager {
  static getAuthToken() {
    try {
      const userType = this.getCurrentUserType();
      const token = localStorage.getItem(`${userType}AuthToken`);
      return token;
    } catch (error) {
      return null;
    }
  }

  // Alias for getAuthToken for better API compatibility
  static getToken() {
    return this.getAuthToken();
  }

  // Check if user is authenticated
  static isAuthenticated() {
    return !!this.getAuthToken();
  }

  static getUserId() {
    const userInfo = this.getUserInfo();
    return userInfo ? userInfo.id : null;
  }

  static getUserInfo() {
    const userType = this.getCurrentUserType();
    const userInfo = localStorage.getItem(`${userType}UserInfo`);
    return userInfo ? JSON.parse(userInfo) : null;
  }

  static getCurrentUserType() {
    try {
      const path = window.location.pathname;
      const type =
        path.includes("/department") || path.includes("/admin")
          ? "department"
          : "applicant";
      return type;
    } catch (error) {
      return "applicant"; // default fallback
    }
  }

  static setAuth(token, userInfo) {
    try {
      if (!token || !userInfo || !userInfo.type) {
        return;
      }

      const userType = userInfo.type;

      // SINGLE LOGIN: Clear the other user type's session to prevent dual login
      const otherType = userType === 'department' ? 'applicant' : 'department';
      localStorage.removeItem(`${otherType}AuthToken`);
      localStorage.removeItem(`${otherType}UserInfo`);

      // Store token
      localStorage.setItem(`${userType}AuthToken`, token);

      // Store user info
      localStorage.setItem(`${userType}UserInfo`, JSON.stringify(userInfo));

      // Verify storage
      const storedToken = localStorage.getItem(`${userType}AuthToken`);
      const storedUserInfo = localStorage.getItem(`${userType}UserInfo`);
    } catch (error) { }
  }

  static clearAuth() {
    // Clear BOTH session types to ensure complete logout
    localStorage.removeItem('departmentAuthToken');
    localStorage.removeItem('departmentUserInfo');
    localStorage.removeItem('applicantAuthToken');
    localStorage.removeItem('applicantUserInfo');
  }

  static async verifyAuth() {
    try {
      const token = this.getAuthToken();
      if (!token) return false;

      const response = await fetch("/api/auth/verify", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        this.clearAuth();
        return false;
      }

      const data = await response.json();

      // Update stored user info with latest from server
      if (data.user) {
        const userType = this.getCurrentUserType();
        localStorage.setItem(`${userType}UserInfo`, JSON.stringify(data.user));
      }

      return true;
    } catch (error) {
      this.clearAuth();
      return false;
    }
  }

  static redirectToLogin() {
    // Detect actual logged-in user type from localStorage, not URL
    const wasDepartment = localStorage.getItem('departmentAuthToken') ||
      localStorage.getItem('departmentUserInfo');
    window.location.href = wasDepartment ? "/department-login" : "/login";
  }

  static async logout() {
    // Detect actual logged-in user type BEFORE clearing
    const wasDepartment = !!localStorage.getItem('departmentAuthToken');
    const token = this.getAuthToken();

    // Call server to blacklist the token (non-blocking)
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        // Ignore errors - still proceed with local logout
        console.warn('Logout API call failed:', error);
      }
    }

    // Clear local storage
    this.clearAuth();
    // Redirect to appropriate login page
    window.location.href = wasDepartment ? "/department-login" : "/login";
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

  static async checkAdminSession() {
    try {
      const isAuth = await this.verifyAuth();
      if (!isAuth) return false;

      const userInfo = this.getUserInfo();
      return userInfo?.type === "department";
    } catch (error) {
      return false;
    }
  }

  static async handleAdminAuth() {
    const isAdminSession = await this.checkAdminSession();
    const path = window.location.pathname;

    // If on login page with valid session, redirect to dashboard
    if (path === "/department-login" && isAdminSession) {
      window.location.replace("/admin/dashboard");
      return false;
    }

    // If on admin pages without valid session, redirect to login
    if (path.startsWith("/admin") && !isAdminSession) {
      window.location.replace("/department-login");
      return false;
    }

    return true;
  }
}
