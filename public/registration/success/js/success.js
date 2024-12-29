document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Check authentication first
    const isAuthenticated = await AuthManager.verifyAuth();
    if (!isAuthenticated) {
      window.location.href = "/registration";
      return;
    }

    // Check if coming from a valid submission
    const wasSubmitted = sessionStorage.getItem("registrationSubmitted");
    const storedAppId = sessionStorage.getItem("applicationId");

    // Get application ID from URL parameters
    const params = new URLSearchParams(window.location.search);
    const applicationId = params.get("id");

    // Redirect if:
    // 1. No submission was made, or
    // 2. No application ID in URL, or
    // 3. URL application ID doesn't match stored one
    if (!wasSubmitted || !applicationId || applicationId !== storedAppId) {
      window.location.href = "/registration/form";
      return;
    }

    // Verify with server
    try {
      const response = await fetch(
        `/api/registration/verify/${applicationId}`,
        {
          headers: {
            Authorization: `Bearer ${AuthManager.getAuthToken()}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Verification failed");
      }

      const data = await response.json();
      if (!data.valid) {
        window.location.href = "/registration/form";
        return;
      }

      // Show main content after auth check
      document.getElementById("authLoader").style.display = "none";
      document.getElementById("mainContent").style.display = "block";

      // Display the application ID
      document.getElementById("applicationId").textContent = applicationId;

      // Clear the session storage to prevent future direct access
      sessionStorage.removeItem("registrationSubmitted");
      sessionStorage.removeItem("applicationId");
    } catch (error) {
      console.error("Verification error:", error);
      window.location.href = "/registration/form";
    }
  } catch (error) {
    console.error("Auth error:", error);
    window.location.href = "/registration";
  }
});
