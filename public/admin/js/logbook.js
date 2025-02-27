class LogbookManager {
  constructor() {
    this.checkAdminAccess();
  }

  async checkAdminAccess() {
    try {
      const userInfo = AuthManager.getUserInfo();
      if (!userInfo || userInfo.role !== "admin") {
        document.getElementById("authLoader").style.display = "none";
        document.getElementById("mainContent").innerHTML = `
          <div class="admin-top-bar">
            <div class="left-links">
              <a href="/admin/dashboard">Dashboard</a>
              <a href="/admin/forms">Form Management</a>
              <a href="/admin/news/index.html">News</a>
              <a href="/admin/logbook" class="active">Logs</a>
              <a href="/admin/users">Users</a>

            </div>
            <div class="right-links">
              <span id="userInfo">${
                userInfo?.full_name || userInfo?.email || ""
              }</span>
              <button id="logoutBtn" class="btn btn-link" onclick="AuthManager.logout()">Logout</button>
            </div>
          </div>
          <header class="main-header">
            <div class="logo-section">
              <img
                src="/images/emblem.png"
                alt="Government of India Emblem"
                class="emblem-logo"
              />
              <div class="header-text">
                <h1>District Disability Rehabilitation Centre, Mumbai</h1>
                <p>Department of Empowerment of Persons with Disabilities,</p>
                <p>Ministry of Social Justice and Empowerment, Govt. of India</p>
              </div>
              <img src="/images/ddrc-logo.png" alt="DDRC Logo" class="ddrc-logo" />
            </div>
          </header>
          <div class="admin-content">
            <div class="dashboard-header">
              <h1>Logbook</h1>
              <p class="text-muted">Track all system changes and user actions</p>
            </div>
            <div class="content-card p-0">
              <div class="unauthorized-container">
                <div class="icon-container mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="M8 11h8"/>
                  </svg>
                </div>
                <h2 class="mb-3">Access Restricted</h2>
                <p class="text-muted mb-4">This section is only accessible to administrators.</p>
                <div class="action-buttons">
                  <a href="/admin/dashboard" class="btn btn-primary">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="me-2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                      <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    Back to Dashboard
                  </a>
                </div>
              </div>
            </div>
          </div>`;

        // Add custom styles for unauthorized page
        const style = document.createElement("style");
        style.textContent = `
          .unauthorized-container {
            padding: 4rem 2rem;
            text-align: center;
            background: #fff;
            border-radius: 8px;
          }
          .icon-container {
            width: 80px;
            height: 80px;
            margin: 0 auto;
            background: #fee2e2;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .icon-container svg {
            color: #dc2626;
          }
          .action-buttons {
            display: flex;
            justify-content: center;
            gap: 1rem;
          }
          .action-buttons .btn {
            display: inline-flex;
            align-items: center;
            padding: 0.75rem 1.5rem;
            font-weight: 500;
          }
          .action-buttons svg {
            margin-right: 0.5rem;
          }
        `;
        document.head.appendChild(style);
        return;
      }

      // If admin access verified, initialize the logbook
      document.getElementById("mainContent").style.display = "block";
      document.getElementById("authLoader").style.display = "none";
      this.initializeFilters();
      this.loadLogs();
    } catch (error) {
      document.getElementById("authLoader").style.display = "none";
      document.getElementById("mainContent").innerHTML = `
        <div class="admin-top-bar">
          <div class="left-links">
            <a href="/admin/dashboard">Dashboard</a>
            <a href="/admin/forms">Form Management</a>
            <a href="/admin/logbook" class="active">Logs</a>
          </div>
          <div class="right-links">
            <button id="logoutBtn" class="btn btn-link" onclick="AuthManager.logout()">Logout</button>
          </div>
        </div>
        <div class="admin-content">
          <div class="dashboard-header">
            <h1>Action Logs</h1>
            <p class="text-muted">Track all system changes and user actions</p>
          </div>
          <div class="content-card">
            <div class="text-center py-5">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#dc3545" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <h3 class="mt-4 mb-2">Error</h3>
              <p class="text-muted mb-4">An error occurred while checking access permissions.</p>
              <a href="/admin/dashboard" class="btn btn-primary">
                Return to Dashboard
              </a>
            </div>
          </div>
        </div>`;
    }
  }

  initializeFilters() {
    document
      .getElementById("actionTypeFilter")
      .addEventListener("change", () => this.loadLogs());
    document
      .getElementById("dateFilter")
      .addEventListener("change", () => this.loadLogs());
    document
      .getElementById("userFilter")
      .addEventListener("input", () => this.loadLogs());
  }

  async loadLogs() {
    try {
      const actionType = document.getElementById("actionTypeFilter").value;
      const date = document.getElementById("dateFilter").value;
      const userQuery = document.getElementById("userFilter").value;

      const response = await fetch(
        "/api/admin/logs?" +
          new URLSearchParams({
            actionType,
            date,
            userQuery,
          }),
        {
          headers: {
            Authorization: `Bearer ${AuthManager.getAuthToken()}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch logs");

      const logs = await response.json();
      this.renderLogs(logs);
    } catch (error) {
      // console.error("Error loading logs:", error);
    }
  }

  renderLogs(logs) {
    const tbody = document.getElementById("logsTableBody");
    tbody.innerHTML = logs
      .map(
        (log) => `
      <tr>
        <td>${new Date(log.performed_at).toLocaleString()}</td>
        <td>${log.user_name}</td>
        <td>
          <span class="action-badge ${log.action_type}">
            ${this.formatActionType(log.action_type)}
          </span>
        </td>
        <td>${log.application_id || "-"}</td>
        <td>${this.formatDetails(log)}</td>
      </tr>
    `
      )
      .join("");
  }

  formatActionType(type) {
    const formats = {
      approve: "Approved",
      rejected: "Rejected",
      undo: "Undone",
      review: "Under Review",
      add_user: "User Added",
      toggle_user: "Status Changed",
    };
    return formats[type] || type;
  }

  formatDetails(log) {
    if (log.action_type === "approved") {
      return "Application was approved";
    }
    if (log.action_type === "rejected") {
      return "Application was rejected";
    }
    if (log.action_type === "undo") {
      return `Changed status from ${log.previous_status} to ${log.new_status}`;
    }
    if (log.action_type === "add_user") {
      return "Created new department user";
    }
    if (log.action_type === "toggle_user") {
      return `Changed user status from ${log.previous_status} to ${log.new_status}`;
    }
    if (log.action_type === "review") {
      return "Started reviewing application";
    }
    return "-";
  }
}

// Initialize logbook
let logbookManager;
document.addEventListener("DOMContentLoaded", () => {
  logbookManager = new LogbookManager();
});
