document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Check authentication first
    const isAuthenticated = await AuthManager.verifyAuth();
    if (!isAuthenticated) {
      window.location.href = "/registration";
      return;
    }

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
      // Not a fresh submission - redirect to dashboard
      window.location.href = "/dashboard";
      return;
    }

    // Show main content and hide loader
    document.getElementById("authLoader").style.display = "none";
    document.getElementById("mainContent").style.display = "block";
  } catch (error) {
    console.error("Error:", error);
    window.location.href = "/registration/form";
  }
});
