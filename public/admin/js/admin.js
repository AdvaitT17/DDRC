async function checkAuth() {
  const isAuth = await AuthManager.verifyAuth();

  if (!isAuth) {
    window.location.replace("/department-login");
    return false;
  }

  const userInfo = AuthManager.getUserInfo();

  if (userInfo?.type !== "department") {
    AuthManager.clearAuth();
    window.location.replace("/department-login");
    return false;
  }
  return true;
}

// Setup logout functionality
function setupLogout() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      AuthManager.logout();
    });
  }
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", async () => {
  if (!(await checkAuth())) return;
  setupLogout();
});
