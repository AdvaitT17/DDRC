document.addEventListener("DOMContentLoaded", async () => {
  const authLoader = document.getElementById("authLoader");
  const mainContent = document.getElementById("mainContent");
  const logoutBtn = document.getElementById("logoutBtn");
  const userInfo = document.getElementById("userInfo");

  try {
    // Check authentication
    const isAuthenticated = await AuthManager.verifyAuth();
    if (!isAuthenticated) {
      AuthManager.redirectToLogin();
      return;
    }

    // Display user info
    const user = AuthManager.getUserInfo();
    if (user) {
      userInfo.textContent = `${user.full_name} (${user.role})`;
    }

    // Setup logout handler
    logoutBtn.addEventListener("click", () => {
      AuthManager.clearAuth();
      AuthManager.redirectToLogin();
    });

    // Show main content
    authLoader.style.display = "none";
    mainContent.style.display = "block";

    // Initialize page based on current path
    const currentPath = window.location.pathname;
    if (currentPath === "/admin/forms") {
      await initializeFormManagement();
    } else if (currentPath === "/admin/dashboard") {
      await initializeDashboard();
    } else {
      // Redirect to dashboard if on root admin path
      if (currentPath === "/admin") {
        window.location.href = "/admin/dashboard";
      }
    }
  } catch (error) {
    console.error("Admin initialization error:", error);
    AuthManager.redirectToLogin();
  }
});

async function initializeDashboard() {
  // Dashboard initialization code
  console.log("Initializing dashboard...");
}

async function initializeFormManagement() {
  // Form management initialization code
  console.log("Initializing form management...");
}

// Add some CSS for the auth loader
const style = document.createElement("style");
style.textContent = `
  .auth-loader {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }
`;
document.head.appendChild(style);
