class ApplicationTracker {
  constructor() {
    this.form = document.getElementById("trackForm");
    this.formContainer = document.querySelector(".track-form-container");
    this.resultDiv = document.getElementById("trackingResult");
    this.setupEventListeners();
    this.checkUrlParams();
  }

  setupEventListeners() {
    this.form.addEventListener("submit", (e) => this.handleSubmit(e));
    // Listen for back button clicks
    document.addEventListener("click", (e) => {
      if (e.target.closest(".back-button")) {
        this.showForm();
      }
    });
  }

  checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const applicationId = params.get("id");
    if (applicationId) {
      this.form.applicationId.value = applicationId;
      this.handleSubmit(new Event("submit"));
    }
  }

  async handleSubmit(e) {
    e.preventDefault();
    const applicationId = this.form.applicationId.value.trim();
    const email = this.form.email.value.trim();

    if (!applicationId || !email) {
      this.showError("Please enter both Application ID and Email");
      return;
    }

    // Add loading state to button
    const submitButton = this.form.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = `
      <svg class="spinner" viewBox="0 0 50 50">
        <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
      </svg>
      Loading...
    `;

    try {
      const response = await fetch(
        `/api/track/${applicationId}?email=${encodeURIComponent(email)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Application not found");
      }

      // Prepare the result HTML but don't show it yet
      this.resultDiv.innerHTML = this.getResultHTML(data);

      // Show result div first with opacity 0
      this.resultDiv.classList.add("visible");

      // Small delay to ensure display:block is applied
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Fade out form and fade in result simultaneously
      this.formContainer.style.opacity = "0";
      this.resultDiv.style.opacity = "1";

      // After fade out, hide form
      await new Promise((resolve) => setTimeout(resolve, 300));
      this.formContainer.classList.add("hidden");
    } catch (error) {
      this.showError(error.message || "Failed to fetch application status");
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = originalText;
    }
  }

  getResultHTML(data) {
    const statusClasses = {
      under_review: "status-under_review",
      approved: "status-approved",
      rejected: "status-rejected",
    };

    const statusText = {
      under_review: "Under Review",
      approved: "Approved",
      rejected: "Rejected",
    };

    return `
      <div class="track-box ${statusClasses[data.status]}">
        <div class="track-header">
          <h2>Application Details</h2>
          <p>Your application has been successfully submitted</p>
        </div>

        <div class="track-content">
          <div class="info-box">
            <div class="info-item">
              <label>Application ID</label>
              <span>${data.applicationId}</span>
            </div>
            <div class="info-item">
              <label>Applicant Name</label>
              <span>${data.applicantName}</span>
            </div>
            <div class="info-item">
              <label>Submitted On</label>
              <span>${data.submittedDate}</span>
            </div>
            <div class="info-item">
              <label>Status</label>
              <span class="status-badge">
                ${data.statusIcon}
                ${statusText[data.status] || "Under Review"}
              </span>
            </div>
          </div>
          
          <button class="back-button btn" onclick="this.closest('.track-box').querySelector('.back-button').click()">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Search
          </button>
        </div>
      </div>
    `;
  }

  showError(message) {
    // Prepare error HTML
    this.resultDiv.innerHTML = `
      <div class="error-box">
        <div class="track-header">
          <h2>Unable to Find Application</h2>
        </div>
        <div class="track-content">
          <div class="alert alert-danger">
            ${message}
          </div>
          <button class="back-button btn" onclick="this.closest('.error-box').querySelector('.back-button').click()">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Search
          </button>
        </div>
      </div>
    `;

    // Show result div first with opacity 0
    this.resultDiv.classList.add("visible");

    // Small delay to ensure display:block is applied
    setTimeout(() => {
      // Fade out form and fade in result simultaneously
      this.formContainer.style.opacity = "0";
      this.resultDiv.style.opacity = "1";

      // After fade out, hide form
      setTimeout(() => {
        this.formContainer.classList.add("hidden");
      }, 300);
    }, 50);
  }

  showForm() {
    // Show form container first
    this.formContainer.classList.remove("hidden");

    // Small delay to ensure display:block is applied
    setTimeout(() => {
      // Fade in form
      this.formContainer.style.opacity = "1";
      // Fade out result
      this.resultDiv.style.opacity = "0";

      // After fade out, hide and reset
      setTimeout(() => {
        this.resultDiv.classList.remove("visible");
        this.form.reset();
        window.history.pushState({}, "", window.location.pathname);
      }, 300);
    }, 50);
  }
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  new ApplicationTracker();
});
