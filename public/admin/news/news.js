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

  // Setup form submission handler
  const newsForm = document.getElementById("newsForm");
  if (newsForm) {
    console.log("Setting up form submission handler");

    newsForm.addEventListener("submit", function (event) {
      event.preventDefault();

      const saveButton = document.getElementById("saveNews");
      const newsId = saveButton.getAttribute("data-news-id");

      if (newsId) {
        console.log("Form submitted for updating news with ID:", newsId);
        handleUpdateNews(newsId, event);
      } else {
        console.log("Form submitted for creating new news");
        handleSaveNews(event);
      }
    });

    // Also handle the save button click
    const saveButton = document.getElementById("saveNews");
    if (saveButton) {
      console.log("Setting up save button click handler");

      saveButton.addEventListener("click", function (event) {
        // Trigger form submission to validate the form
        const form = document.getElementById("newsForm");
        if (form.checkValidity()) {
          const newsId = this.getAttribute("data-news-id");
          if (newsId) {
            console.log(
              "Save button clicked for updating news with ID:",
              newsId
            );
            handleUpdateNews(newsId, event);
          } else {
            console.log("Save button clicked for creating new news");
            handleSaveNews(event);
          }
        } else {
          // Trigger form validation
          form.reportValidity();
        }
      });
    }

    console.log("Form and button handlers set up");
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
                        ? `<a href="${news.file_path}" target="_blank" class="btn btn-sm btn-primary btn-view-file">View File</a>`
                        : "No file"
                    }</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-primary" onclick="editNews(${
                              news.id
                            })">Edit</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteNews(${
                              news.id
                            })">Delete</button>
                        </div>
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

async function editNews(id) {
  try {
    console.log("Editing news with ID:", id);
    const token = AuthManager.getAuthToken();
    const response = await fetch(`/api/news/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    console.log("Fetched news data:", data);

    if (data.success) {
      const news = data.news;

      // Set form values
      document.getElementById("newsTitle").value = news.title;
      document.getElementById("newsDescription").value = news.description;

      // Clear file input
      document.getElementById("newsFile").value = "";

      // Show existing file info if available
      const fileInfoContainer = document.getElementById("existingFileInfo");
      if (fileInfoContainer) {
        if (news.file_path) {
          const fileName = news.file_path.split("/").pop();
          fileInfoContainer.innerHTML = `
            <div class="alert alert-info">
              Current file: <a href="${news.file_path}" target="_blank">${fileName}</a>
              <small class="d-block mt-1">Upload a new file to replace the current one</small>
            </div>
          `;
          fileInfoContainer.style.display = "block";
        } else {
          fileInfoContainer.style.display = "none";
        }
      }

      // Store the news ID in a data attribute on the save button
      const saveButton = document.getElementById("saveNews");
      if (saveButton) {
        console.log("Setting up saveNews button for editing with ID:", id);

        // Store the news ID in a data attribute
        saveButton.setAttribute("data-news-id", id);
        console.log("Save button data-news-id set to:", id);
      }

      // Update modal title
      document.querySelector("#addNewsModal .modal-title").textContent =
        "Edit News";

      // Show modal
      const modal = new bootstrap.Modal(
        document.getElementById("addNewsModal")
      );
      modal.show();
    }
  } catch (error) {
    console.error("Error loading news details:", error);
    showAlert("Error loading news details", "danger");
  }
}

async function handleUpdateNews(id, event) {
  // Prevent default form submission if event is provided
  if (event && event.preventDefault) {
    event.preventDefault();
  }

  try {
    console.log("Updating news with ID:", id);
    const title = document.getElementById("newsTitle").value;
    const description = document.getElementById("newsDescription").value;
    const fileInput = document.getElementById("newsFile");

    if (!title || !description) {
      showAlert("Please fill in all required fields", "danger");
      return;
    }

    // File validation if a new file is selected
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
    console.log("Sending PUT request to:", `/api/news/${id}`);

    // Important: When using FormData, do NOT set Content-Type header
    // The browser will automatically set the correct Content-Type with boundary
    const response = await fetch(`/api/news/${id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        // Do not set Content-Type when using FormData
      },
      body: formData,
    });

    console.log("Response status:", response.status);
    const data = await response.json();
    console.log("Response data:", data);

    if (response.ok && data.success) {
      showAlert("News updated successfully", "success");
      document.getElementById("newsForm").reset();

      // Reset the existing file info
      const fileInfoContainer = document.getElementById("existingFileInfo");
      if (fileInfoContainer) {
        fileInfoContainer.style.display = "none";
      }

      const modal = document.getElementById("addNewsModal");
      const bsModal = bootstrap.Modal.getInstance(modal);
      if (bsModal) {
        bsModal.hide();
      }

      // Reset modal title and save button function
      document.querySelector("#addNewsModal .modal-title").textContent =
        "Add News";
      const saveButton = document.getElementById("saveNews");
      saveButton.onclick = handleSaveNews;

      await loadNews();
    } else {
      throw new Error(data.message || "Failed to update news");
    }
  } catch (error) {
    console.error("Error updating news:", error);
    showAlert(error.message || "Error updating news", "danger");
  }
}

async function handleSaveNews(event) {
  // Prevent default form submission if event is provided
  if (event && event.preventDefault) {
    event.preventDefault();
  }

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
    console.log("Sending POST request to create new news item");
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

// Reset form and modal when modal is closed
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("addNewsModal");
  if (modal) {
    modal.addEventListener("hidden.bs.modal", () => {
      console.log("Modal hidden event triggered");

      // Reset the form
      document.getElementById("newsForm").reset();

      // Reset the existing file info
      const fileInfoContainer = document.getElementById("existingFileInfo");
      if (fileInfoContainer) {
        fileInfoContainer.style.display = "none";
      }

      // Reset modal title
      document.querySelector("#addNewsModal .modal-title").textContent =
        "Add News";

      // Reset save button by removing the data-news-id attribute
      const saveButton = document.getElementById("saveNews");
      if (saveButton) {
        console.log("Resetting saveNews button");
        saveButton.removeAttribute("data-news-id");
        console.log("Save button data-news-id attribute removed");
      }
    });
  }
});
