// Toast notification system
function showToast(message, type = "info") {
  // Create toast container if it doesn't exist
  let toastContainer = document.querySelector(".toast-container");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.className = "toast-container";
    document.body.appendChild(toastContainer);
  }

  // Create toast element
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
        <div class="toast-body">
            ${message}
        </div>
    `;

  // Add to container
  toastContainer.appendChild(toast);

  // Initialize Bootstrap toast
  const bsToast = new bootstrap.Toast(toast, {
    autohide: true,
    delay: 3000,
  });
  bsToast.show();

  // Remove toast after it's hidden
  toast.addEventListener("hidden.bs.toast", () => {
    toast.remove();
  });
}

// Check authentication on page load
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/department-login";
      return;
    }

    // Verify token is valid
    const response = await fetch("/api/auth/verify", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Invalid token");
    }

    // Add token to all future fetch requests
    const originalFetch = window.fetch;
    window.fetch = function () {
      let [resource, config] = arguments;
      if (config === undefined) {
        config = {};
      }
      if (config.headers === undefined) {
        config.headers = {};
      }
      config.headers["Authorization"] = `Bearer ${token}`;
      return originalFetch(resource, config);
    };
  } catch (error) {
    console.error("Auth error:", error);
    localStorage.removeItem("token");
    window.location.href = "/department-login";
  }
});
