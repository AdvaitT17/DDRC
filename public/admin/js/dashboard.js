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

      if (response.status === 401) {
        // Session expired
        alert("Your session has expired. Please login again.");
        window.location.href = "/department-login";
        return;
      }

      if (!response.ok) throw new Error("Failed to fetch application");

      const data = await response.json();

      // Update modal content
      document.getElementById("modalApplicationId").textContent =
        data.applicationId;

      // Update modal header
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
      console.error("Error:", error);
      if (error.message.includes("Failed to fetch")) {
        alert(
          "Connection error. Please check your internet connection and try again."
        );
      } else {
        alert("Failed to load application details. Please refresh the page.");
      }
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
                .map((field) => {
                  if (field.field_type === "nested-select") {
                    return this.renderNestedSelectFields(field);
                  }
                  return `
                    <div class="form-field">
                      <div class="field-label">${field.display_name}</div>
                      <div class="nested-values">
                        <div class="form-field">
                          <div class="field-value">${this.renderFieldValue(
                            field
                          )}</div>
                        </div>
                      </div>
                    </div>
                  `;
                })
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
                .map((field) => {
                  if (field.field_type === "nested-select") {
                    return this.renderNestedSelectFields(field);
                  }
                  return `
                    <div class="form-field">
                      <div class="field-label">${field.display_name}</div>
                      <div class="nested-values">
                        <div class="form-field">
                          <div class="field-value">${this.renderFieldValue(
                            field
                          )}</div>
                        </div>
                      </div>
                    </div>
                  `;
                })
                .join("")}
            </div>
          `
          )
          .join("")}
      </div>
    `;
  }

  renderNestedSelectFields(field) {
    try {
      console.log("=== Nested Select Debug ===");
      console.log("Field:", field);
      console.log("Field value:", field.value);
      console.log("Field options:", field.options);
      console.log("Field options type:", typeof field.options);

      // Split the comma-separated values
      const values = field.value
        ? field.value.split(",").map((v) => v.trim())
        : [];
      console.log("Values after split:", values);

      // Try to parse the nested configuration
      let nestedConfig = null;
      if (field.options) {
        try {
          nestedConfig = JSON.parse(field.options);
          console.log("First parse result:", nestedConfig);

          // Handle double-encoded JSON
          if (typeof nestedConfig === "string") {
            nestedConfig = JSON.parse(nestedConfig);
            console.log("Second parse result:", nestedConfig);
          }
        } catch (e) {
          console.error("Failed to parse field.options:", e);
        }
      }
      console.log("Final nested config:", nestedConfig);

      // Generate fields for each level using the configuration
      return values
        .map((value, index) => {
          const levelName =
            nestedConfig && nestedConfig[index]
              ? nestedConfig[index].name
              : "Missing level name";
          return `
            <div class="form-field">
              <div class="field-label">${levelName}</div>
              <div class="nested-values">
                <div class="form-field">
                  <div class="field-value">${value || "-"}</div>
                </div>
              </div>
            </div>
          `;
        })
        .join("");
    } catch (error) {
      console.error("Error rendering nested select fields:", error);
      return `
        <div class="form-field">
          <div class="field-label">${field.display_name}</div>
          <div class="nested-values">
            <div class="form-field">
              <div class="field-value">Error: ${error.message}</div>
            </div>
          </div>
        </div>
      `;
    }
  }

  renderFieldValue(field) {
    if (!field.value) return "-";

    switch (field.field_type) {
      case "file":
        return field.value
          ? `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
              <polyline points="13 2 13 9 20 9"></polyline>
            </svg>
            <button onclick="previewDocument('${field.value}')" class="btn btn-link p-0">View Document</button>
          `
          : "-";

      case "checkbox":
        try {
          const values = JSON.parse(field.value);
          return Array.isArray(values) ? values.join(", ") : field.value;
        } catch (e) {
          return field.value;
        }

      case "nested-select":
        return this.renderNestedSelectFields(field);

      default:
        return field.value;
    }
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

  renderDocumentField(field, value) {
    return `
      <div class="mb-2">
        <label class="form-label">${field.display_name}</label>
        <div>
          <button onclick="previewDocument('${value}')" class="btn btn-sm btn-outline-primary">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="me-1">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            View Document
          </button>
        </div>
      </div>
    `;
  }
}

// Initialize dashboard
let dashboardManager;
document.addEventListener("DOMContentLoaded", () => {
  dashboardManager = new DashboardManager();
});

// Add this function to handle document preview
async function previewDocument(fileName) {
  try {
    // Get temporary URL for the file
    const response = await fetch(`/api/admin/files/access-url/${fileName}`, {
      headers: {
        Authorization: `Bearer ${AuthManager.getAuthToken()}`,
      },
    });

    if (response.status === 403) {
      alert("You don't have permission to view this document.");
      return;
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to get file access URL");
    }

    const { accessUrl } = await response.json();

    // Log the access URL for debugging (remove in production)
    console.log("Access URL generated:", accessUrl);

    const modalHtml = `
      <div class="modal fade" id="documentPreviewModal" tabindex="-1">
        <div class="modal-dialog modal-xl modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Document Preview</h5>
              <div class="ms-auto">
                <button onclick="downloadDocument('${fileName}', '${accessUrl}')" class="btn btn-sm download-btn">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="me-1">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download
                </button>
                <button type="button" class="btn-close d-flex align-items-center" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
            </div>
            <div class="modal-body p-0">
              <div class="document-preview-container">
                ${
                  fileName.match(/\.(jpg|jpeg|png|gif)$/i)
                    ? `<img src="${accessUrl}" class="img-preview" alt="Document preview">`
                    : `<iframe src="${accessUrl}#toolbar=0" class="pdf-preview"></iframe>`
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById("documentPreviewModal");
    if (existingModal) {
      existingModal.remove();
    }

    // Add modal to body
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // Show modal
    const modal = new bootstrap.Modal(
      document.getElementById("documentPreviewModal")
    );
    modal.show();

    // Clean up on modal hide
    document
      .getElementById("documentPreviewModal")
      .addEventListener("hidden.bs.modal", function () {
        this.remove();
      });
  } catch (error) {
    console.error("Document preview error:", error);
    alert(
      error.message || "Failed to load document preview. Please try again."
    );
  }
}

// Add download function
async function downloadDocument(fileName, accessUrl) {
  try {
    // Fetch the file with authentication
    const response = await fetch(accessUrl);

    if (!response.ok) throw new Error("Failed to download file");

    // Get the blob
    const blob = await response.blob();

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName; // Set the download filename
    document.body.appendChild(a);
    a.click();

    // Cleanup
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error("Download error:", error);
    alert("Failed to download file");
  }
}

async function checkAuthAndLoadData() {
  try {
    const response = await fetch("/api/auth/verify", {
      headers: {
        Authorization: `Bearer ${AuthManager.getAuthToken()}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.code === "TOKEN_EXPIRED" || data.code === "TOKEN_MISSING") {
        AuthManager.clearAuthToken();
        window.location.href = "/department-login";
        return;
      }
      throw new Error(data.message);
    }

    // Load dashboard data...
  } catch (error) {
    console.error("Auth check failed:", error);
    // Only show alert for non-redirect errors
    if (window.location.pathname !== "/department-login") {
      alert("Authentication failed. Please login again.");
      window.location.href = "/department-login";
    }
  }
}

// Check auth on page load
document.addEventListener("DOMContentLoaded", checkAuthAndLoadData);

// Add styles for nested values
const style = document.createElement("style");
style.textContent = `
  .nested-values {
    display: flex;
    flex-direction: column;
  }
  
  .nested-values .form-field:not(:last-child) {
    margin-bottom: 0.75rem;
  }
`;
document.head.appendChild(style);
