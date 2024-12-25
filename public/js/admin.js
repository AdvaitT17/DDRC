document.addEventListener("DOMContentLoaded", function () {
  // Initialize dashboard
  loadDashboardStats();
  loadRecentApplications();
});

async function loadDashboardStats() {
  try {
    const response = await fetch("/api/dashboard/stats");
    const stats = await response.json();

    // Update stats
    document.getElementById("totalRegistrations").textContent =
      stats.totalRegistrations;
    document.getElementById("pendingApplications").textContent =
      stats.pendingApplications;
    document.getElementById("approvedToday").textContent = stats.approvedToday;
    document.getElementById("activeUsers").textContent = stats.activeUsers;
  } catch (error) {
    console.error("Error loading dashboard stats:", error);
  }
}

async function loadRecentApplications() {
  try {
    const response = await fetch("/api/applications/recent");
    const applications = await response.json();

    const tbody = document.getElementById("recentApplications");
    tbody.innerHTML = applications
      .map(
        (app) => `
            <tr>
                <td>${app.id}</td>
                <td>${app.applicantName}</td>
                <td>${new Date(app.submissionDate).toLocaleDateString()}</td>
                <td><span class="status-badge ${app.status.toLowerCase()}">${
          app.status
        }</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary">View</button>
                </td>
            </tr>
        `
      )
      .join("");
  } catch (error) {
    console.error("Error loading recent applications:", error);
  }
}
