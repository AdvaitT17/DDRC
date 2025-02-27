// Common utility functions

// Show alert/notification
function showAlert(message, type = "info") {
  const alertDiv = document.createElement("div");
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

  // Find or create alerts container
  let alertsContainer = document.querySelector(".alerts-container");
  if (!alertsContainer) {
    alertsContainer = document.createElement("div");
    alertsContainer.className =
      "alerts-container position-fixed top-0 end-0 p-3";
    document.body.appendChild(alertsContainer);
  }

  alertsContainer.appendChild(alertDiv);

  // Auto dismiss after 5 seconds
  setTimeout(() => {
    alertDiv.remove();
  }, 5000);
}

// Format date to local string
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString();
}

// Handle API errors
function handleApiError(error) {
  console.error("API Error:", error);
  showAlert(error.message || "An error occurred", "danger");
}

// Export functions if using modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    showAlert,
    formatDate,
    handleApiError,
  };
}
