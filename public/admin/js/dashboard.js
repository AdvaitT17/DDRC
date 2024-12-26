document.addEventListener("DOMContentLoaded", async () => {
  if (await initializeAdminPage()) {
    await initializeDashboard();
  }
});

async function initializeDashboard() {
  try {
    // Fetch dashboard stats
    const statsResponse = await fetchWithAuth("/api/admin/dashboard/stats");
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      updateDashboardStats(stats);
    }

    // Fetch recent applications
    const applicationsResponse = await fetchWithAuth(
      "/api/admin/applications/recent"
    );
    if (applicationsResponse.ok) {
      const applications = await applicationsResponse.json();
      updateRecentApplications(applications);
    }
  } catch (error) {
    console.error("Error initializing dashboard:", error);
    // Show error message to user
  }
}

function updateDashboardStats(stats) {
  document.getElementById("totalRegistrations").textContent =
    stats.totalRegistrations.toLocaleString();
  document.getElementById("pendingApplications").textContent =
    stats.pendingApplications.toLocaleString();
  document.getElementById("approvedToday").textContent =
    stats.approvedToday.toLocaleString();
  document.getElementById("activeUsers").textContent =
    stats.activeUsers.toLocaleString();
}

function updateRecentApplications(applications) {
  const tbody = document.getElementById("recentApplications");
  tbody.innerHTML = applications
    .map(
      (app) => `
    <tr>
      <td>${app.id}</td>
      <td>${app.applicantName}</td>
      <td>${new Date(app.submissionDate).toLocaleDateString()}</td>
      <td><span class="badge bg-${
        app.status === "Pending" ? "warning" : "success"
      }">${app.status}</span></td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="viewApplication('${
          app.id
        }')">View</button>
      </td>
    </tr>
  `
    )
    .join("");
}

function viewApplication(id) {
  window.location.href = `/admin/applications/${id}`;
}
