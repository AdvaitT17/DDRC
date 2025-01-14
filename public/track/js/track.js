class ApplicationTracker {
  constructor() {
    this.form = document.getElementById("trackForm");
    this.formContainer = document.querySelector(".track-form-container");
    this.resultDiv = document.getElementById("trackingResult");
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.form.addEventListener("submit", (e) => this.handleSubmit(e));
    document.addEventListener("click", (e) => {
      if (e.target.closest(".back-button")) {
        this.showForm();
      }
    });
  }

  async handleSubmit(e) {
    e.preventDefault();
    const applicationId = this.form.applicationId.value.trim();
    const email = this.form.email.value.trim();

    if (!applicationId || !email) {
      this.showError("Please enter both Application ID and Email address");
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
        let errorMessage;
        if (response.status === 404) {
          errorMessage =
            "No application found with this ID and email combination. Please check and try again.";
        } else {
          errorMessage =
            "Failed to fetch application status. Please try again later.";
        }
        throw new Error(errorMessage);
      }

      // Prepare the result HTML
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
    const statusConfig = {
      pending: {
        class: "status-pending",
        title: "Application Pending",
        description:
          "Your application has been submitted and is pending review.",
      },
      under_review: {
        class: "status-review",
        title: "Under Review",
        description:
          "Your application is currently being reviewed by our team.",
      },
      approved: {
        class: "status-approved",
        title: "Approved",
        description: "Congratulations! Your application has been approved.",
      },
      rejected: {
        class: "status-rejected",
        title: "Rejected",
        description:
          "Your application has been rejected. Please contact support for more information.",
      },
    };

    const status = statusConfig[data.status] || statusConfig.pending;

    return `
      <div class="track-result">
        <div class="track-header">
          <h2>Application Status</h2>
        </div>
        <div class="track-content">
          <div class="status-box ${status.class}">
            <div class="status-icon">
              ${data.statusIcon}
            </div>
            <div class="status-details">
              <h3>${status.title}</h3>
              <p>${status.description}</p>
            </div>
          </div>
          <div class="application-info">
            <p><strong>Application ID:</strong> ${data.applicationId}</p>
            <p><strong>Applicant Name:</strong> ${data.applicantName}</p>
            <p><strong>Submitted On:</strong> ${data.submittedDate}</p>
          </div>
          <button class="back-button btn">
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
    const errorDiv = document.getElementById("trackError");
    if (!errorDiv) return;

    errorDiv.textContent = message;
    errorDiv.style.display = "block";

    setTimeout(() => {
      errorDiv.style.display = "none";
    }, 5000);
  }

  showForm() {
    // Show form container first
    this.formContainer.classList.remove("hidden");

    // Reset submit button state
    const submitButton = this.form.querySelector('button[type="submit"]');
    submitButton.disabled = false;
    submitButton.innerHTML = "Track Status";

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
