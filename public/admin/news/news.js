// Initialize after auth check
document.addEventListener("DOMContentLoaded", async () => {
  // Check auth using AuthManager
  if (!(await AuthManager.verifyAuth())) {
    window.location.href = "/department-login";
    return;
  }

  // Show main content
  document.getElementById("authLoader").style.display = "none";
  document.getElementById("mainContent").style.display = "block";

  // Set user info
  const userInfo = AuthManager.getUserInfo();
  if (userInfo) {
    document.getElementById(
      "userInfo"
    ).textContent = `Welcome, ${userInfo.username}`;
  }

  // Load news data
  loadNews();

  // Setup event listeners
  const saveButton = document.getElementById("saveNews");
  if (saveButton) {
    saveButton.addEventListener("click", handleSaveNews);
  }
});

async function loadNews() {
  try {
    const token = AuthManager.getAuthToken();
    const response = await fetch("/api/news", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        window.location.href = "/department-login";
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      const tbody = document.querySelector("#newsTable tbody");
      tbody.innerHTML = "";

      data.news.forEach((news) => {
        const row = document.createElement("tr");
        row.innerHTML = `
                    <td>${new Date(
                      news.published_date
                    ).toLocaleDateString()}</td>
                    <td>${news.title}</td>
                    <td class="news-description">${news.description}</td>
                    <td>${
                      news.file_path
                        ? `<a href="${news.file_path}" target="_blank" class="btn btn-sm btn-primary">View File</a>`
                        : "No file"
                    }</td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="deleteNews(${
                          news.id
                        })">Delete</button>
                    </td>
                `;
        tbody.appendChild(row);
      });
    }
  } catch (error) {
    console.error("Error loading news:", error);
    showAlert("Error loading news items", "danger");
  }
}

async function handleSaveNews(event) {
  event.preventDefault(); // Prevent any default form submission

  try {
    const title = document.getElementById("newsTitle").value;
    const description = document.getElementById("newsDescription").value;
    const fileInput = document.getElementById("newsFile");

    if (!title || !description) {
      showAlert("Please fill in all required fields", "danger");
      return;
    }

    // File validation
    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      const allowedTypes = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
      const ext = "." + file.name.split(".").pop().toLowerCase();

      if (file.size > maxSize) {
        showAlert("File is too large. Maximum size is 10MB", "danger");
        return;
      }

      if (!allowedTypes.includes(ext)) {
        showAlert(
          "Invalid file type. Allowed types: PDF, DOC, DOCX, JPG, PNG",
          "danger"
        );
        return;
      }
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);

    if (fileInput.files.length > 0) {
      formData.append("file", fileInput.files[0]);
    }

    const token = AuthManager.getAuthToken();
    const response = await fetch("/api/news", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showAlert("News added successfully", "success");
      document.getElementById("newsForm").reset();
      const modal = document.getElementById("addNewsModal");
      const bsModal = bootstrap.Modal.getInstance(modal);
      if (bsModal) {
        bsModal.hide();
      }
      await loadNews();
    } else {
      throw new Error(data.message || "Failed to save news");
    }
  } catch (error) {
    console.error("Error saving news:", error);
    showAlert(error.message || "Error saving news", "danger");
  }
}

async function deleteNews(id) {
  if (!confirm("Are you sure you want to delete this news item?")) {
    return;
  }

  try {
    const token = AuthManager.getAuthToken();
    const response = await fetch(`/api/news/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (data.success) {
      showAlert("News deleted successfully", "success");
      loadNews();
    } else {
      showAlert(data.message || "Error deleting news", "danger");
    }
  } catch (error) {
    console.error("Error deleting news:", error);
    showAlert("Error deleting news", "danger");
  }
}

// Helper function to show alerts
function showAlert(message, type) {
  const alertDiv = document.createElement("div");
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

  // Find or create alerts container
  let alertsContainer = document.querySelector(".alerts-container");
  if (!alertsContainer) {
    alertsContainer = document.createElement("div");
    alertsContainer.className =
      "alerts-container position-fixed top-0 end-0 p-3";
    document.body.appendChild(alertsContainer);
  }

  alertsContainer.appendChild(alertDiv);

  // Auto dismiss after 5 seconds
  setTimeout(() => {
    alertDiv.remove();
  }, 5000);
}
