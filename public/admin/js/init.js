// Shared initialization for all admin pages
async function initializeAdminPage() {
  try {
    // Check authentication
    const isAuthenticated = await AuthManager.verifyAuth();
    if (!isAuthenticated) {
      AuthManager.redirectToLogin();
      return false;
    }

    // Show main content
    document.getElementById("authLoader").style.display = "none";
    document.getElementById("mainContent").style.display = "block";

    // Setup user info and logout
    const user = AuthManager.getUserInfo();
    if (user) {
      document.getElementById(
        "userInfo"
      ).textContent = `${user.full_name} (${user.role})`;
    }

    document.getElementById("logoutBtn").addEventListener("click", () => {
      AuthManager.clearAuth();
      AuthManager.redirectToLogin();
    });

    return true;
  } catch (error) {
    console.error("Admin initialization error:", error);
    AuthManager.redirectToLogin();
    return false;
  }
}
