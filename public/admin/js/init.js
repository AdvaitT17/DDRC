// Shared initialization for all admin pages
async function initializeAdminPage() {
  try {
    // Check admin session
    if (!(await AuthManager.handleAdminAuth())) {
      return;
    }

    // Show main content
    document.getElementById("authLoader").style.display = "none";
    document.getElementById("mainContent").style.display = "block";

    // Set user info in header
    const userInfo = AuthManager.getUserInfo();
    if (userInfo?.username) {
      document.getElementById(
        "userInfo"
      ).textContent = `Welcome, ${userInfo.full_name}`;
    }

    // Initialize page-specific content if needed
    const path = window.location.pathname;
    switch (path) {
      case "/admin/dashboard":
        initializeDashboard();
        break;
      case "/admin/forms":
        initializeFormManagement();
        break;
    }
  } catch (error) {
    window.location.replace("/department-login");
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", initializeAdminPage);
