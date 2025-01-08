class DashboardManager {
  constructor() {
    this.initializeAuth();
    this.setupEventListeners();
  }

  async initializeAuth() {
    try {
      const isAuth = await AuthManager.verifyAuth();
      if (!isAuth) {
        window.location.href = "/login";
        return;
      }

      // Verify user type is applicant
      const userInfo = AuthManager.getUserInfo();
      if (userInfo?.type !== "applicant") {
        AuthManager.clearAuth();
        window.location.href = "/login";
        return;
      }

      // Check registration status
      const response = await fetch("/api/registration/check-status", {
        headers: {
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
      });
      const data = await response.json();

      if (!data.hasRegistration) {
        window.location.href = "/registration/form";
        return;
      }

      // Show main content only if registration is complete
      document.getElementById("authLoader").style.display = "none";
      document.getElementById("mainContent").style.display = "block";

      // Set user info
      const user = AuthManager.getUserInfo();
      if (user) {
        document.getElementById("userInfo").textContent = user.email;
      }

      // Load dashboard data
      await this.loadDashboardData();
    } catch (error) {
      window.location.href = "/login";
    }
  }

  setupEventListeners() {
    // Setup logout handler
    document.getElementById("logoutBtn").addEventListener("click", (e) => {
      e.preventDefault();
      AuthManager.logout();
    });

    // Setup download button
    document.getElementById("downloadBtn").addEventListener("click", () => {
      this.handleDownload();
    });
  }

  async loadDashboardData() {
    try {
      const response = await fetch("/api/dashboard/data", {
        headers: {
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch dashboard data");

      const data = await response.json();
      this.updateDashboard(data);
    } catch (error) {}
  }

  updateDashboard(data) {
    // Update application ID
    document.getElementById("applicationId").textContent =
      data.applicationId || "N/A";

    // Update submission date
    const submittedDate = data.submittedDate
      ? new Date(data.submittedDate).toLocaleDateString()
      : "Pending";
    document.getElementById("submittedDate").textContent = submittedDate;

    // Get all timeline items including the first "Submitted" step
    const submittedStep = document.querySelector(
      ".timeline-item.active.completed"
    );
    const reviewStep = document.getElementById("reviewStep");
    const completedStep = document.getElementById("completedStep");

    // Reset all steps first
    reviewStep.classList.remove("active", "completed", "rejected");
    completedStep.classList.remove("active", "completed", "rejected");

    // Default icons (empty circle SVG)
    const emptyCircleSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`;

    // Processing/Review SVG
    const processingSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12a9 9 0 11-3-6.74" stroke-linecap="round"/>
    </svg>`;

    // Check mark SVG
    const checkSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

    // Cross SVG
    const crossSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

    // Set default icons
    reviewStep.querySelector(".timeline-icon").innerHTML = emptyCircleSvg;
    completedStep.querySelector(".timeline-icon").innerHTML = emptyCircleSvg;

    // Update the submitted step to use SVG checkmark
    if (submittedStep) {
      submittedStep.querySelector(".timeline-icon").innerHTML = checkSvg;
    }

    // Update timeline based on status
    switch (data.status?.toLowerCase()) {
      case "under_review":
      case "under review":
      case "processing":
        reviewStep.classList.add("active", "processing");
        reviewStep.querySelector(".timeline-icon").innerHTML = processingSvg;
        reviewStep.querySelector(".timeline-content p").textContent =
          "Application is being processed";
        break;

      case "approved":
        // Show review step as completed with tick
        reviewStep.classList.add("completed");
        reviewStep.querySelector(".timeline-icon").innerHTML = checkSvg;
        reviewStep.querySelector(".timeline-content p").textContent =
          "Review completed";
        // Show final step as completed with tick
        completedStep.classList.add("active", "completed");
        completedStep.querySelector(".timeline-icon").innerHTML = checkSvg;
        completedStep.querySelector(".timeline-content p").textContent =
          "Application approved";
        break;

      case "rejected":
        // Show review step as completed with tick
        reviewStep.classList.add("completed");
        reviewStep.querySelector(".timeline-icon").innerHTML = checkSvg;
        reviewStep.querySelector(".timeline-content p").textContent =
          "Review completed";
        // Show final step as rejected with cross
        completedStep.classList.add("active", "rejected");
        completedStep.querySelector(".timeline-icon").innerHTML = crossSvg;
        completedStep.querySelector(".timeline-content p").textContent =
          "Application rejected";
        break;

      case "submitted":
      default:
        // Only first step is completed
        reviewStep.querySelector(".timeline-content p").textContent =
          "Pending review";
        completedStep.querySelector(".timeline-content p").textContent =
          "Awaiting decision";
        break;
    }

    // Update user info if available
    if (data.formData) {
      const userInfo = document.getElementById("userInfo");
      userInfo.textContent =
        data.applicantName || data.formData.email || "User";
    }

    // Remove any existing status text
    const existingStatus = document.querySelector(".status-text");
    if (existingStatus) {
      existingStatus.remove();
    }
  }

  async handleDownload() {
    // Implement PDF download functionality
    alert("Download functionality will be implemented soon");
  }
}

// Initialize dashboard when page loads
document.addEventListener("DOMContentLoaded", () => {
  new DashboardManager();
});
