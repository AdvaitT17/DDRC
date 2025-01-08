class DashboardManager {
  constructor() {
    this.loadStats();
    this.loadRecentApplications();
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
        .map((app) => this.createApplicationRow(app))
        .join("");

      // Add event listeners to status update buttons
      tbody.querySelectorAll(".status-update").forEach((btn) => {
        btn.addEventListener("click", (e) => this.handleStatusUpdate(e));
      });
    } catch (error) {}
  }

  createApplicationRow(app) {
    return `
      <tr>
        <td>${app.applicationId}</td>
        <td>${app.applicantName}</td>
        <td>${new Date(app.submittedAt).toLocaleDateString()}</td>
        <td>
          <span class="status-badge ${app.status}">${this.formatStatus(
      app.status
    )}</span>
        </td>
        <td>
          <div class="dropdown">
            <button class="btn btn-sm btn-outline-primary dropdown-toggle" type="button" data-bs-toggle="dropdown">
              Update Status
            </button>
            <ul class="dropdown-menu">
              <li><button class="dropdown-item status-update" data-id="${
                app.applicationId
              }" data-status="under_review">Mark Under Review</button></li>
              <li><button class="dropdown-item status-update" data-id="${
                app.applicationId
              }" data-status="approved">Approve</button></li>
              <li><button class="dropdown-item status-update" data-id="${
                app.applicationId
              }" data-status="rejected">Reject</button></li>
            </ul>
          </div>
        </td>
      </tr>
    `;
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
}

// Initialize dashboard
document.addEventListener("DOMContentLoaded", () => {
  new DashboardManager();
});
