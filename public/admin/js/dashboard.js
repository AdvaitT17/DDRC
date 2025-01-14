class DashboardManager {
  constructor() {
    this.loadStats();
    this.loadRecentApplications();
    this.applicationModal = new bootstrap.Modal(
      document.getElementById("applicationModal")
    );
  }

  async loadStats() {
    try {
      const response = await fetch("/api/admin/stats", {
        headers: {
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch stats");

      const stats = await response.json();

      document.getElementById("totalRegistrations").textContent =
        stats.totalRegistrations;
      document.getElementById("pendingApplications").textContent =
        stats.pendingApplications;
      document.getElementById("approvedToday").textContent =
        stats.approvedToday;
      document.getElementById("activeUsers").textContent = stats.activeUsers;
    } catch (error) {}
  }

  async loadRecentApplications() {
    try {
      const response = await fetch("/api/admin/recent-applications", {
        headers: {
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch applications");

      const applications = await response.json();
      const tbody = document.getElementById("recentApplications");
      tbody.innerHTML = applications
        .map(
          (app) => `
          <tr class="clickable-row" onclick="dashboardManager.viewApplication('${
            app.applicationId
          }')">
            <td data-label="Application ID">${app.applicationId}</td>
            <td data-label="Applicant Name">${app.applicantName}</td>
            <td data-label="Submission Date">${new Date(
              app.submittedAt
            ).toLocaleDateString()}</td>
            <td data-label="Type of Disability">${
              app.disabilityType || "Not specified"
            }</td>
          </tr>
        `
        )
        .join("");
    } catch (error) {
      console.error("Error:", error);
    }
  }

  async viewApplication(applicationId) {
    try {
      const response = await fetch(`/api/admin/applications/${applicationId}`, {
        headers: {
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch application details");

      const data = await response.json();

      // Update modal header
      document.getElementById("modalApplicationId").textContent =
        data.applicationId;
      document.getElementById("modalSubmissionDate").textContent = new Date(
        data.submittedAt
      ).toLocaleDateString();

      // Update status badge
      const statusBadge = document.getElementById("modalStatus");
      statusBadge.className = `status-badge ${
        data.service_status || "pending"
      }`;
      statusBadge.textContent = this.formatStatus(
        data.service_status || "pending"
      );

      // Update status info
      const statusInfo = document.getElementById("statusInfo");
      if (!data.last_updated_by || !data.last_action_at) {
        statusInfo.innerHTML = `
          <small class="text-muted">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="me-1">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            Awaiting initial review
          </small>`;
      } else {
        statusInfo.innerHTML = `
          <small class="text-muted">
            Last updated by <span id="lastUpdatedBy">${data.last_updated_by}</span> on
            <span id="lastUpdatedAt">${data.last_action_at}</span>
          </small>`;
      }

      // Populate form sections
      const formDataContainer = document.getElementById("modalFormData");
      formDataContainer.innerHTML = this.renderFormSections(data.sections);

      // Update button visibility based on status
      const approveBtn = document.getElementById("approveBtn");
      const rejectBtn = document.getElementById("rejectBtn");
      const undoBtn = document.getElementById("undoBtn");

      const currentStatus = data.service_status || "pending";

      if (
        ["pending", "under_review"].includes(currentStatus) ||
        !currentStatus
      ) {
        // Initial state or after undo - show approve/reject
        approveBtn.style.display = "inline-flex";
        rejectBtn.style.display = "inline-flex";
        undoBtn.style.display = "none";
      } else {
        // After a decision is made - show only undo
        approveBtn.style.display = "none";
        rejectBtn.style.display = "none";
        undoBtn.style.display = "inline-flex";
      }

      // Show the modal
      const modal = new bootstrap.Modal(
        document.getElementById("applicationModal")
      );
      modal.show();
    } catch (error) {
      console.error("Error viewing application:", error);
    }
  }

  renderFormSections(sections) {
    // Split sections into two columns
    const midPoint = Math.ceil(sections.length / 2);
    const leftSections = sections.slice(0, midPoint);
    const rightSections = sections.slice(midPoint);

    return `
      <div class="form-section-column">
        ${leftSections
          .map(
            (section) => `
            <div class="form-section">
              <h5>${section.name}</h5>
              ${section.fields
                .map(
                  (field) => `
                  <div class="form-field">
                    <div class="field-label">${field.display_name}</div>
                    ${this.renderFieldValue(field)}
                  </div>
                `
                )
                .join("")}
            </div>
          `
          )
          .join("")}
      </div>
      <div class="form-section-column">
        ${rightSections
          .map(
            (section) => `
            <div class="form-section">
              <h5>${section.name}</h5>
              ${section.fields
                .map(
                  (field) => `
                  <div class="form-field">
                    <div class="field-label">${field.display_name}</div>
                    ${this.renderFieldValue(field)}
                  </div>
                `
                )
                .join("")}
            </div>
          `
          )
          .join("")}
      </div>
    `;
  }

  renderFieldValue(field) {
    if (field.field_type === "file" && field.value) {
      return `
        <div class="field-value file">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
            <polyline points="13 2 13 9 20 9"></polyline>
          </svg>
          <a href="/uploads/${field.value}" target="_blank">View Document</a>
        </div>
      `;
    }

    return `<div class="field-value">${field.value || "-"}</div>`;
  }

  formatStatus(status) {
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  async handleStatusUpdate(e) {
    const button = e.target;
    const { id, status } = button.dataset;

    try {
      const response = await fetch(`/api/admin/application/${id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) throw new Error("Failed to update status");

      // Reload applications to show updated status
      this.loadRecentApplications();
      // Reload stats as they might have changed
      this.loadStats();
    } catch (error) {
      alert("Failed to update application status");
    }
  }

  async updateStatus(newStatus) {
    try {
      const applicationId =
        document.getElementById("modalApplicationId").textContent;

      const response = await fetch(
        `/api/admin/application/${applicationId}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${AuthManager.getAuthToken()}`,
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) throw new Error("Failed to update status");

      const data = await response.json();

      // Update UI elements
      const statusBadge = document.getElementById("modalStatus");
      statusBadge.className = `status-badge ${newStatus}`;
      statusBadge.textContent = this.formatStatus(newStatus);

      // Update last updated info
      const statusInfo = document.getElementById("statusInfo");
      statusInfo.innerHTML = `
        <small class="text-muted">
          Last updated by <span id="lastUpdatedBy">${data.updatedBy}</span> on
          <span id="lastUpdatedAt">${new Date(
            data.updatedAt
          ).toLocaleString()}</span>
        </small>`;

      // Update button visibility
      const approveBtn = document.getElementById("approveBtn");
      const rejectBtn = document.getElementById("rejectBtn");
      const undoBtn = document.getElementById("undoBtn");

      if (["pending", "under_review"].includes(newStatus)) {
        approveBtn.style.display = "inline-flex";
        rejectBtn.style.display = "inline-flex";
        undoBtn.style.display = "none";
      } else {
        approveBtn.style.display = "none";
        rejectBtn.style.display = "none";
        undoBtn.style.display = "inline-flex";
      }

      // Refresh the applications list
      this.loadRecentApplications();
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update application status");
    }
  }

  async undoStatus() {
    try {
      const applicationId =
        document.getElementById("modalApplicationId").textContent;
      const response = await fetch(
        `/api/admin/application/${applicationId}/undo`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${AuthManager.getAuthToken()}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to undo status");

      const result = await response.json();

      // Update status badge
      const statusBadge = document.getElementById("modalStatus");
      statusBadge.className = `status-badge ${result.status}`;
      statusBadge.textContent = this.formatStatus(result.status);

      // Update last updated info
      const statusInfo = document.getElementById("statusInfo");
      statusInfo.innerHTML = `
        <small class="text-muted">
          Last updated by <span id="lastUpdatedBy">${result.updatedBy}</span> on
          <span id="lastUpdatedAt">${new Date(
            result.updatedAt
          ).toLocaleString()}</span>
        </small>`;

      // Update button states
      const approveBtn = document.getElementById("approveBtn");
      const rejectBtn = document.getElementById("rejectBtn");
      const undoBtn = document.getElementById("undoBtn");

      // Show approve/reject buttons, hide undo
      approveBtn.style.display = "inline-flex";
      rejectBtn.style.display = "inline-flex";
      undoBtn.style.display = "none";

      // Reload the applications list
      await this.loadRecentApplications();
    } catch (error) {
      console.error("Error undoing status:", error);
      alert("Failed to undo decision");
    }
  }
}

// Initialize dashboard
let dashboardManager;
document.addEventListener("DOMContentLoaded", () => {
  dashboardManager = new DashboardManager();
});
