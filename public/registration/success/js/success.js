document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Check authentication first
    const isAuthenticated = await AuthManager.verifyAuth();
    if (!isAuthenticated) {
      window.location.href = "/registration";
      return;
    }

    // Get application ID from URL
    const pathParts = window.location.pathname.split("/");
    const urlApplicationId = pathParts[pathParts.length - 1];

    // Check if coming from a fresh submission
    const wasSubmitted = sessionStorage.getItem("registrationSubmitted");
    const storedAppId = sessionStorage.getItem("applicationId");

    if (wasSubmitted && storedAppId) {
      // Fresh submission - display the success message
      document.getElementById("applicationId").textContent = storedAppId;
      // Clear session storage after displaying
      sessionStorage.removeItem("registrationSubmitted");
      sessionStorage.removeItem("applicationId");
    } else {
      // Not a fresh submission, verify if this application belongs to user
      const response = await fetch("/api/registration/check-status", {
        headers: {
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
      });

      const data = await response.json();
      if (data.hasRegistration && data.applicationId === urlApplicationId) {
        // Valid application ID - show the success message
        document.getElementById("applicationId").textContent =
          data.applicationId;
      } else {
        // Invalid or no registration - redirect to tracking page or form
        if (data.hasRegistration) {
          window.location.href = `/track?id=${data.applicationId}`;
        } else {
          window.location.href = "/registration/form";
        }
        return;
      }
    }

    // Show main content and hide loader
    document.getElementById("authLoader").style.display = "none";
    document.getElementById("mainContent").style.display = "block";
  } catch (error) {
    console.error("Error:", error);
    window.location.href = "/registration/form";
  }
});
