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

// Function to load the sidebar
function loadSidebar() {
  const sidebarElem = document.getElementById("sidebar");
  if (sidebarElem) {
    fetch("/admin/js/sidebar.html")
      .then((response) => response.text())
      .then((html) => {
        sidebarElem.innerHTML = html;

        // Highlight the current page in the sidebar
        const currentPath = window.location.pathname;
        const currentLink = document.querySelector(`a[href="${currentPath}"]`);
        if (currentLink) {
          currentLink.classList.add("active");
        } else if (currentPath.includes("/admin/dashboard")) {
          document
            .querySelector('a[href="/admin/dashboard"]')
            .classList.add("active");
        }
      })
      .catch((error) => {
        console.error("Error loading sidebar:", error);
      });
  }
}

// Load content dynamically based on the path
function loadContent(path) {
  const contentDiv = document.getElementById("content");
  if (!contentDiv) return;

  // Map paths to content files
  const contentMap = {
    "/admin/dashboard": "/admin/dashboard/index.html",
    "/admin/forms": "/admin/forms/index.html",
    "/admin/applications": "/admin/applications/index.html",
    "/admin/reports": "/admin/reports/index.html",
    "/admin/news": "/admin/news/index.html",
    "/admin/events": "/admin/events/index.html",
    "/admin/users": "/admin/users/index.html",
    "/admin/logbook": "/admin/logbook/index.html",
  };

  const contentFile = contentMap[path];
  if (contentFile) {
    fetch(contentFile)
      .then((response) => response.text())
      .then((html) => {
        contentDiv.innerHTML = html;
      })
      .catch((error) => {
        console.error("Error loading content:", error);
        contentDiv.innerHTML = `<div class="alert alert-danger">Failed to load content. Please try again later.</div>`;
      });
  } else {
    contentDiv.innerHTML = `<div class="alert alert-warning">Page not found</div>`;
  }
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", async () => {
  if (!(await checkAuth())) return;
  setupLogout();
  loadSidebar();
});
