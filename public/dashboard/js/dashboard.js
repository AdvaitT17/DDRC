class DashboardManager {
  constructor() {
    this.initializeAuth();
    // this.setupEventListeners() was merged into initializeAuth
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

      // Hide auth loader and show content
      document.getElementById("authLoader").style.display = "none";
      document.getElementById("mainContent").style.display = "block"; // Changed from main-content to mainContent to match original

      // Setup event listeners
      document.getElementById("downloadBtn")?.addEventListener("click", () => {
        this.downloadPDF();
      });

      // Logout handler (assuming there's a logoutBtn in the HTML)
      document.getElementById("logoutBtn")?.addEventListener("click", () => {
        AuthManager.logout();
      });

      // Load independent data sections in parallel/safely
      await this.loadDashboardData(); // Await this to ensure dashboard is updated before other things
      await this.loadEquipmentStatus();
    } catch (error) {
      console.error("Initialization Error:", error);
      window.location.href = "/login"; // Redirect to login on any init error
    }
  }

  // The original setupEventListeners is now integrated into init()
  // setupEventListeners() {
  //   // Setup download button
  //   const downloadBtn = document.getElementById("downloadBtn");
  //   if (downloadBtn) {
  //     downloadBtn.addEventListener("click", () => {
  //       this.handleDownload();
  //     });
  //   }
  //   // Note: Logout is now handled by the header component
  // }

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

      // Removed: this.loadEquipmentStatus(); as it's now called directly from init()
    } catch (error) {
      console.error("Dashboard Data Error:", error);
      // Optional: Show error to user via UI
      const appIdEl = document.getElementById("applicationId");
      if (appIdEl) appIdEl.textContent = "Error loading data"; // Changed text to match provided snippet
    }
  }

  updateDashboard(data) {
    try {


      // Update application ID
      const appIdEl = document.getElementById("applicationId");
      if (appIdEl) {
        appIdEl.removeAttribute('data-original-text'); // Clear stored original so it doesn't restore to '-'
        appIdEl.textContent = data.applicationId || "N/A";
      }

      // Update submission date
      const dateEl = document.getElementById("submittedDate");
      const submittedDate = data.submittedDate
        ? new Date(data.submittedDate).toLocaleDateString()
        : "Pending";
      if (dateEl) {
        dateEl.removeAttribute('data-original-text'); // Clear stored original so it doesn't restore to '-'
        dateEl.textContent = submittedDate;
      }

      // Get elements
      const reviewStep = document.getElementById("reviewStep");
      const completedStep = document.getElementById("completedStep");
      const submittedStep = document.querySelector(".timeline-item.active.completed") || document.querySelector(".timeline-item");

      if (!reviewStep || !completedStep) {
        console.error("Critical: Timeline steps not found in DOM");
        return;
      }

      // Reset all steps first
      reviewStep.classList.remove("active", "completed", "rejected", "processing");
      completedStep.classList.remove("active", "completed", "rejected", "processing");

      // Icons
      const emptyCircleSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`;
      const processingSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-3-6.74" stroke-linecap="round"/></svg>`;
      const checkSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      const crossSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

      // Set default icons
      const reviewIcon = reviewStep.querySelector(".timeline-icon");
      const completedIcon = completedStep.querySelector(".timeline-icon");

      if (reviewIcon) reviewIcon.innerHTML = emptyCircleSvg;
      if (completedIcon) completedIcon.innerHTML = emptyCircleSvg;

      // Update submitted icon
      if (submittedStep) {
        const subIcon = submittedStep.querySelector(".timeline-icon");
        if (subIcon) subIcon.innerHTML = checkSvg;
      }

      const reviewText = reviewStep.querySelector(".timeline-content p");
      const completedText = completedStep.querySelector(".timeline-content p");

      // Update timeline based on status
      const status = data.status?.toLowerCase() || 'submitted';


      switch (status) {
        case "under_review":
        case "under review":
        case "processing":
          reviewStep.classList.add("active", "processing");
          if (reviewIcon) reviewIcon.innerHTML = processingSvg;
          if (reviewText) reviewText.textContent = "Application is being processed";
          break;

        case "approved":
          reviewStep.classList.add("completed");
          if (reviewIcon) reviewIcon.innerHTML = checkSvg;
          if (reviewText) reviewText.textContent = "Review completed";

          completedStep.classList.add("active", "completed");
          if (completedIcon) completedIcon.innerHTML = checkSvg;
          if (completedText) completedText.textContent = "Application approved";
          break;

        case "rejected":
          reviewStep.classList.add("completed");
          if (reviewIcon) reviewIcon.innerHTML = checkSvg;
          if (reviewText) reviewText.textContent = "Review completed";

          completedStep.classList.add("active", "rejected");
          if (completedIcon) completedIcon.innerHTML = crossSvg;
          if (completedText) completedText.textContent = "Application rejected";
          break;

        case "submitted":
        default:
          if (reviewText) reviewText.textContent = "Pending review";
          if (completedText) completedText.textContent = "Awaiting decision";
          break;
      }

      // Trigger translation for dynamically updated content
      if (window.TranslationManager && window.TranslationManager.getCurrentLanguage() !== 'en') {
        const savedLang = window.TranslationManager.getCurrentLanguage();
        // Translate the timeline elements that were updated
        const timelineItems = document.querySelectorAll('.timeline-content p');
        timelineItems.forEach(el => {
          window.TranslationManager.translateElement(el, savedLang);
        });
      }
    } catch (err) {
      // Error updating dashboard UI - fail silently
    }
  }

  async loadEquipmentStatus() {
    try {
      const response = await fetch("/api/equipment/my-requests", {
        headers: {
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch equipment data");

      const data = await response.json();
      const equipmentList = document.getElementById("equipmentList");
      const equipmentCard = document.getElementById("equipmentCard");

      // Always show the card so users can access the "Request Equipment" button
      equipmentCard.style.display = "block";

      if (data.allRequests && data.allRequests.length > 0) {
        equipmentList.innerHTML = data.allRequests
          .map(
            (req) => `
            <div class="equipment-item">
                <div class="equipment-icon-wrapper">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M12 16v-4"></path>
                        <path d="M12 8h.01"></path>
                    </svg>
                </div>
                <div class="equipment-content">
                    <div class="equipment-header">
                        <h4 class="mb-0 text-dark fw-bold" style="font-size: 1rem;">${req.equipment_type || 'Equipment Request'}</h4>
                        <span class="status-badge ${req.status || 'pending'}">
                            ${(req.status || 'pending').replace('_', ' ')}
                        </span>
                    </div>
                            <div class="equipment-meta d-flex flex-wrap gap-2 text-muted small">
                                 <span>Requested: ${new Date(req.requested_at).toLocaleDateString()}</span>
                                 ${req.source === 'registration' ? '<span>&bull; From Registration</span>' : ''}
                            </div>
                </div>
            </div>
          `
          )
          .join("");
      } else {
        equipmentList.innerHTML = `
          <div class="text-center py-5">
            <div class="mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#e5e7eb" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
            </div>
            <h4 class="h5 text-secondary fw-normal mb-2">No Requests Yet</h4>
            <p class="text-muted small mb-4">You haven't requested any assistive devices.</p>
            <a href="/dashboard/equipment" class="btn btn-primary btn-sm px-4 rounded-pill">
                Request Equipment
            </a>
          </div>
        `;
      }
    } catch (error) {
      console.error("Error loading equipment:", error);
    }
  }

  async downloadPDF() {
    // Prevent double clicks
    if (this.isDownloading) return;
    this.isDownloading = true;

    try {
      const btn = document.getElementById("downloadBtn");
      const originalText = btn.innerHTML;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Generating PDF...';
      btn.disabled = true;
      btn.style.opacity = '0.7';

      const response = await fetch("/api/dashboard/download-pdf", {
        headers: {
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to generate PDF");
      }

      // Get the blob from response
      const blob = await response.blob();

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'DDRC_Application.pdf';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);

      btn.innerHTML = originalText;
      btn.disabled = false;
      btn.style.opacity = '1';
      this.isDownloading = false;
    } catch (error) {
      console.error("Error downloading PDF:", error);
      alert("Error downloading PDF: " + error.message);
      const btn = document.getElementById("downloadBtn");
      btn.innerHTML = '<i class="bi bi-file-earmark-pdf me-2"></i>Download PDF';
      btn.disabled = false;
      btn.style.opacity = '1';
      this.isDownloading = false;
    }
  }
}

// Initialize dashboard when page loads
document.addEventListener("DOMContentLoaded", () => {
  new DashboardManager();
});
