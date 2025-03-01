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

  // Load events data
  loadEvents();

  // Setup event listeners
  const saveButton = document.getElementById("saveEvent");
  if (saveButton) {
    saveButton.addEventListener("click", handleSaveEvent);
  }

  // Setup image preview
  const imageInput = document.getElementById("eventImage");
  if (imageInput) {
    imageInput.addEventListener("change", handleImagePreview);
  }
});

async function loadEvents() {
  try {
    const token = AuthManager.getAuthToken();
    const response = await fetch("/api/events", {
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
      const tbody = document.querySelector("#eventsTable tbody");
      tbody.innerHTML = "";

      data.events.forEach((event) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${new Date(event.event_date).toLocaleDateString()}</td>
          <td>${event.title}</td>
          <td class="event-description">${event.description}</td>
          <td>
            <img src="${
              event.image_path
            }" alt="Event image" class="event-image">
          </td>
          <td>
            <button class="btn btn-sm btn-danger" onclick="deleteEvent(${
              event.id
            })">Delete</button>
          </td>
        `;
        tbody.appendChild(row);
      });
    }
  } catch (error) {
    console.error("Error loading events:", error);
    showAlert("Error loading events", "danger");
  }
}

function handleImagePreview(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const preview = document.getElementById("imagePreview");
      preview.src = e.target.result;
      preview.style.display = "block";
    };
    reader.readAsDataURL(file);
  }
}

async function handleSaveEvent(event) {
  event.preventDefault();

  try {
    const title = document.getElementById("eventTitle").value;
    const description = document.getElementById("eventDescription").value;
    const eventDate = document.getElementById("eventDate").value;
    const imageInput = document.getElementById("eventImage");

    if (!title || !description || !eventDate || !imageInput.files.length) {
      showAlert("Please fill in all required fields", "danger");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("event_date", eventDate);
    formData.append("image", imageInput.files[0]);

    const token = AuthManager.getAuthToken();
    const response = await fetch("/api/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showAlert("Event added successfully", "success");
      document.getElementById("eventForm").reset();
      document.getElementById("imagePreview").style.display = "none";
      const modal = document.getElementById("addEventModal");
      const bsModal = bootstrap.Modal.getInstance(modal);
      if (bsModal) {
        bsModal.hide();
      }
      await loadEvents();
    } else {
      throw new Error(data.message || "Failed to save event");
    }
  } catch (error) {
    console.error("Error saving event:", error);
    showAlert(error.message || "Error saving event", "danger");
  }
}

async function deleteEvent(id) {
  if (!confirm("Are you sure you want to delete this event?")) {
    return;
  }

  try {
    const token = AuthManager.getAuthToken();
    const response = await fetch(`/api/events/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (data.success) {
      showAlert("Event deleted successfully", "success");
      loadEvents();
    } else {
      showAlert(data.message || "Error deleting event", "danger");
    }
  } catch (error) {
    console.error("Error deleting event:", error);
    showAlert("Error deleting event", "danger");
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
