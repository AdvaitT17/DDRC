class ApplicationTracker {
  constructor() {
    this.form = document.getElementById("trackForm");
    this.errorAlert = document.getElementById("trackError");
    this.resultDiv = document.getElementById("trackingResult");
    this.setupEventListeners();
    this.checkUrlParams();
  }

  setupEventListeners() {
    this.form.addEventListener("submit", (e) => this.handleSubmit(e));
  }

  checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const applicationId = params.get("id");
    if (applicationId) {
      this.form.applicationId.value = applicationId;
      this.handleSubmit(new Event("submit"));
    }
  }

  showError(message) {
    this.errorAlert.textContent = message;
    this.errorAlert.style.display = "block";
    this.resultDiv.style.display = "none";
    setTimeout(() => {
      this.errorAlert.style.display = "none";
    }, 5000);
  }

  async handleSubmit(e) {
    e.preventDefault();

    if (!this.form.checkValidity()) {
      this.form.classList.add("was-validated");
      return;
    }

    const applicationId = this.form.applicationId.value.trim();

    try {
      const response = await fetch(`/api/track/${applicationId}`);
      const data = await response.json();

      if (response.ok) {
        this.displayResult(data);
      } else {
        this.showError(data.message || "Application not found");
      }
    } catch (error) {
      console.error("Error tracking application:", error);
      this.showError("Failed to track application. Please try again.");
    }
  }

  displayResult(data) {
    const timeline = this.createTimeline(data.status);
    const details = this.createDetails(data);

    this.resultDiv.querySelector(".status-timeline").innerHTML = timeline;
    this.resultDiv.querySelector(".application-details").innerHTML = details;
    this.resultDiv.style.display = "block";
    this.errorAlert.style.display = "none";
  }

  createTimeline(status) {
    const stages = ["submitted", "under_review", "approved", "rejected"];
    const currentIndex = stages.indexOf(status);

    return stages
      .map(
        (stage, index) => `
        <div class="timeline-item ${index <= currentIndex ? "completed" : ""} ${
          status === stage ? "current" : ""
        }">
          <div class="timeline-point"></div>
          <div class="timeline-content">
            <h4>${this.formatStatus(stage)}</h4>
            ${
              status === stage
                ? '<span class="current-status">Current Status</span>'
                : ""
            }
          </div>
        </div>
      `
      )
      .join("");
  }

  createDetails(data) {
    const { basicDetails } = data;
    return `
      <div class="details-grid">
        <div class="detail-item">
          <label>Application ID</label>
          <span>${data.applicationId}</span>
        </div>
        <div class="detail-item">
          <label>Applicant Name</label>
          <span>${basicDetails.name}</span>
        </div>
        <div class="detail-item">
          <label>Email</label>
          <span>${basicDetails.email}</span>
        </div>
        <div class="detail-item">
          <label>Phone</label>
          <span>${basicDetails.phone}</span>
        </div>
        <div class="detail-item">
          <label>Disability Type</label>
          <span>${basicDetails.disability_type}</span>
        </div>
        <div class="detail-item">
          <label>Submitted On</label>
          <span>${new Date(data.submittedAt).toLocaleDateString()}</span>
        </div>
        <div class="detail-item">
          <label>Last Updated</label>
          <span>${new Date(data.lastUpdated).toLocaleDateString()}</span>
        </div>
        <div class="detail-item">
          <label>Status</label>
          <span class="status-badge ${data.status}">${this.formatStatus(
      data.status
    )}</span>
        </div>
      </div>
    `;
  }

  formatStatus(status) {
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
}

// Initialize tracker
document.addEventListener("DOMContentLoaded", () => {
  new ApplicationTracker();
});
