async function checkAuth() {
  const isAuth = await AuthManager.verifyAuth();
  if (!isAuth) {
    window.location.href = "/department-login";
    return false;
  }
  const userInfo = AuthManager.getUserInfo();
  if (userInfo.type !== "department") {
    AuthManager.logout();
    return false;
  }
  return true;
}

async function loadContent(path) {
  if (!(await checkAuth())) return;

  const contentDiv = document.getElementById("content");

  try {
    let template;
    switch (path) {
      case "/admin/dashboard":
        template = await fetch("/admin/templates/dashboard.html");
        break;
      case "/admin/forms":
        template = await fetch("/admin/templates/forms.html");
        break;
      default:
        template = await fetch("/admin/templates/404.html");
    }

    if (template.ok) {
      contentDiv.innerHTML = await template.text();
      initializeContent(path);
    } else {
      throw new Error("Failed to load content");
    }
  } catch (error) {
    console.error("Error loading content:", error);
    contentDiv.innerHTML =
      "<div class='alert alert-danger'>Error loading content</div>";
  }
}

function initializeContent(path) {
  // Initialize specific functionality based on the loaded content
  switch (path) {
    case "/admin/dashboard":
      initializeDashboard();
      break;
    case "/admin/forms":
      initializeForms();
      break;
  }
}

// Add specific initialization functions for each page
function initializeDashboard() {
  // Initialize dashboard-specific functionality
}

function initializeForms() {
  // Initialize forms-specific functionality
}

// Handle browser back/forward buttons
window.addEventListener("popstate", () => {
  loadContent(window.location.pathname);
});

// Handle internal navigation
document.addEventListener("click", (e) => {
  if (
    e.target.matches("a") &&
    e.target.href.startsWith(window.location.origin + "/admin")
  ) {
    e.preventDefault();
    const path = new URL(e.target.href).pathname;
    history.pushState(null, "", path);
    loadContent(path);
  }
});
