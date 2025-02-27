class UserManager {
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
              <a href="/admin/logbook">Logs</a>
              <a href="/admin/users" class="active">Users</a>
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
              <h1>User Management</h1>
              <p class="text-muted">Manage department staff accounts</p>
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

      // If admin access verified, initialize the user management
      document.getElementById("mainContent").style.display = "block";
      document.getElementById("authLoader").style.display = "none";
      this.initializeEventListeners();
      this.loadUsers();
    } catch (error) {
      console.error("Access check error:", error);
      // Show error message
    }
  }

  initializeEventListeners() {
    document
      .getElementById("saveUserBtn")
      .addEventListener("click", () => this.addUser());
  }

  async loadUsers() {
    try {
      const response = await fetchWithAuth("/api/admin/users");
      const users = await response.json();
      this.renderUsers(users);
    } catch (error) {
      console.error("Error loading users:", error);
    }
  }

  renderUsers(users) {
    const tbody = document.getElementById("usersTableBody");
    tbody.innerHTML = users
      .map(
        (user) => `
        <tr>
          <td>${user.full_name}</td>
          <td>${user.username}</td>
          <td>${user.email}</td>
          <td class="text-center">
            <span class="action-badge ${user.role}">
              ${user.role === "admin" ? "Admin" : "Staff"}
            </span>
          </td>
          <td class="text-center">
            <span class="action-badge ${user.is_active ? "approve" : "reject"}">
              ${user.is_active ? "Active" : "Inactive"}
            </span>
          </td>
          <td>${
            user.last_login
              ? new Date(user.last_login).toLocaleString()
              : "Never"
          }</td>
          <td>
            <button class="btn btn-sm btn-${
              user.is_active ? "danger" : "success"
            }" onclick="userManager.toggleUserStatus(${
          user.id
        }, ${!user.is_active})">
              ${user.is_active ? "Deactivate" : "Activate"}
            </button>
          </td>
        </tr>
      `
      )
      .join("");
  }

  async addUser() {
    try {
      const form = document.getElementById("addUserForm");
      const formData = new FormData(form);

      const response = await fetchWithAuth("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(Object.fromEntries(formData)),
      });

      if (response.ok) {
        bootstrap.Modal.getInstance(
          document.getElementById("addUserModal")
        ).hide();
        form.reset();
        this.loadUsers();
      } else {
        const data = await response.json();
        alert(data.message || "Failed to add user");
      }
    } catch (error) {
      console.error("Error adding user:", error);
      alert("Failed to add user");
    }
  }

  async toggleUserStatus(userId, newStatus) {
    try {
      const response = await fetchWithAuth(
        `/api/admin/users/${userId}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ isActive: newStatus }),
        }
      );

      if (response.ok) {
        this.loadUsers();
      } else {
        const data = await response.json();
        alert(data.message || "Failed to update user status");
      }
    } catch (error) {
      console.error("Error updating user status:", error);
      alert("Failed to update user status");
    }
  }
}

// Initialize user manager
let userManager;
document.addEventListener("DOMContentLoaded", () => {
  userManager = new UserManager();
});
