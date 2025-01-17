class FormManager {
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
              <a href="/admin/forms" class="active">Form Management</a>
              <a href="/admin/logbook">Logs</a>
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
              <h1>Form Management</h1>
              <p class="text-muted">Manage form sections and fields</p>
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
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error checking admin access:", error);
      return false;
    }
  }
}

async function initializeFormManagement() {
  try {
    // Fetch form sections
    const response = await fetchWithAuth("/api/form/sections");
    const sections = await response.json();
    renderFormSections(sections);

    // Initialize event listeners
    initializeFormEventListeners();
  } catch (error) {
    console.error("Error initializing form management:", error);
  }
}

function initializeFormEventListeners() {
  // Add Section button
  document.getElementById("addSectionBtn").addEventListener("click", () => {
    const modal = new bootstrap.Modal(document.getElementById("sectionModal"));
    modal.show();
  });

  // Save Section button
  document
    .getElementById("saveSectionBtn")
    .addEventListener("click", saveSection);

  // Field type change
  document.getElementById("fieldType").addEventListener("change", (e) => {
    const optionsContainer = document.querySelector(".field-options-container");
    const fileSizeContainer = document.querySelector(".file-size-container");

    optionsContainer.style.display = ["select", "radio", "checkbox"].includes(
      e.target.value
    )
      ? "block"
      : "none";

    fileSizeContainer.style.display =
      e.target.value === "file" ? "block" : "none";
  });

  // Save Field button
  document.getElementById("saveFieldBtn").addEventListener("click", saveField);
}

function renderFormSections(sections) {
  const container = document.querySelector(".sections-container");
  container.innerHTML = sections
    .map(
      (section) => `
    <div class="section-item" data-section-id="${section.id}">
      <div class="section-header">
        <h3>${section.name}</h3>
        <div class="section-actions">
          <button class="btn btn-primary btn-sm add-field-btn">Add Field</button>
          <button class="btn btn-danger btn-sm delete-section-btn">Delete</button>
        </div>
      </div>
      <div class="fields-container">
        ${renderFields(section.fields)}
      </div>
    </div>
  `
    )
    .join("");

  // Add event listeners for the new buttons
  addSectionEventListeners();
}

function renderFields(fields) {
  return fields
    .map(
      (field) => `
    <div class="field-item" data-field-id="${field.id}">
      <div class="field-info">
        <span class="field-name">${field.display_name}</span>
        <span class="field-type">${field.field_type}</span>
        ${
          field.is_required
            ? '<span class="required-badge">Required</span>'
            : ""
        }
        ${
          field.field_type === "file"
            ? `<span class="file-info">
                 (Max: ${field.max_file_size}MB, Types: ${field.allowed_types})
               </span>`
            : ""
        }
      </div>
      <div class="field-actions">
        <button class="btn btn-sm btn-outline-primary edit-field-btn">Edit</button>
        <button class="btn btn-sm btn-outline-danger delete-field-btn">Delete</button>
      </div>
    </div>
  `
    )
    .join("");
}

async function saveSection() {
  const sectionName = document.getElementById("sectionName").value.trim();
  if (!sectionName) {
    alert("Please enter a section name");
    return;
  }

  try {
    const response = await fetchWithAuth("/api/form/sections", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: sectionName }),
    });

    if (!response.ok) {
      throw new Error("Failed to create section");
    }

    // Refresh sections
    await initializeFormManagement();

    // Close modal and reset form
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("sectionModal")
    );
    modal.hide();
    document.getElementById("sectionName").value = "";
  } catch (error) {
    alert("Failed to save section. Please try again.");
  }
}

async function saveField() {
  const form = document.getElementById("fieldModal");
  const fieldName = form.querySelector("#fieldName").value.trim();
  const displayName = form.querySelector("#displayName").value.trim();
  const fieldType = form.querySelector("#fieldType").value;
  const isRequired = form.querySelector("#required").checked;
  const sectionId = form.dataset.sectionId;
  const fieldId = form.dataset.fieldId;

  let fieldData = {
    name: fieldName,
    display_name: displayName,
    field_type: fieldType,
    is_required: isRequired,
  };

  // Add options for select/radio/checkbox fields
  if (["select", "radio", "checkbox"].includes(fieldType)) {
    const options = form
      .querySelector("#options")
      .value.split("\n")
      .map((opt) => opt.trim())
      .filter((opt) => opt);
    fieldData.options = options;
  }

  // Add file configuration for file type fields
  if (fieldType === "file") {
    fieldData.max_file_size =
      parseInt(form.querySelector("#maxFileSize").value) || 5;
    fieldData.allowed_types =
      form.querySelector("#allowedTypes").value.trim() ||
      ".pdf,.jpg,.jpeg,.png";
  }

  try {
    const url = fieldId
      ? `/api/form/fields/${fieldId}`
      : `/api/form/sections/${sectionId}/fields`;

    const response = await fetchWithAuth(url, {
      method: fieldId ? "PUT" : "POST",
      body: JSON.stringify(fieldData),
    });

    if (!response.ok) throw new Error("Failed to save field");

    // Refresh form sections
    const sectionsResponse = await fetchWithAuth("/api/form/sections");
    if (sectionsResponse.ok) {
      const sections = await sectionsResponse.json();
      renderFormSections(sections);
    }

    // Close modal
    bootstrap.Modal.getInstance(form).hide();
  } catch (error) {
    console.error("Error saving field:", error);
    alert("Failed to save field");
  }
}

function addSectionEventListeners() {
  // Add Field buttons
  document.querySelectorAll(".add-field-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const sectionId = e.target.closest(".section-item").dataset.sectionId;
      const modal = document.getElementById("fieldModal");
      modal.dataset.sectionId = sectionId;
      resetFieldForm();
      new bootstrap.Modal(modal).show();
    });
  });

  // Delete Section buttons
  document.querySelectorAll(".delete-section-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      if (
        !confirm(
          "Are you sure you want to delete this section and all its fields?"
        )
      ) {
        return;
      }

      const sectionId = e.target.closest(".section-item").dataset.sectionId;
      try {
        const response = await fetchWithAuth(
          `/api/form/sections/${sectionId}`,
          {
            method: "DELETE",
          }
        );

        if (!response.ok) {
          throw new Error("Failed to delete section");
        }

        // Refresh sections
        await initializeFormManagement();
      } catch (error) {
        alert("Failed to delete section. Please try again.");
      }
    });
  });

  // Delete Field buttons
  document.querySelectorAll(".delete-field-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      if (!confirm("Are you sure you want to delete this field?")) {
        return;
      }

      const fieldId = e.target.closest(".field-item").dataset.fieldId;
      try {
        const response = await fetchWithAuth(`/api/form/fields/${fieldId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to delete field");
        }

        // Refresh sections
        await initializeFormManagement();
      } catch (error) {
        alert("Failed to delete field. Please try again.");
      }
    });
  });

  // Edit Field buttons
  document.querySelectorAll(".edit-field-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const fieldId = e.target.closest(".field-item").dataset.fieldId;
      try {
        const response = await fetchWithAuth(`/api/form/fields/${fieldId}`);
        if (!response.ok) throw new Error("Failed to fetch field");

        const field = await response.json();
        const modal = document.getElementById("fieldModal");
        modal.dataset.fieldId = fieldId;
        modal.dataset.sectionId = field.section_id;
        populateFieldForm(field);
        new bootstrap.Modal(modal).show();
      } catch (error) {
        console.error("Error editing field:", error);
        alert("Failed to edit field");
      }
    });
  });
}

function resetFieldForm() {
  const form = document.getElementById("fieldModal");
  form.querySelector("#fieldName").value = "";
  form.querySelector("#displayName").value = "";
  form.querySelector("#fieldType").value = "text";
  form.querySelector("#required").checked = false;
  form.querySelector("#options").value = "";
  form.querySelector(".field-options-container").style.display = "none";
  delete form.dataset.fieldId;
}

function populateFieldForm(field) {
  const form = document.getElementById("fieldModal");
  form.querySelector("#fieldName").value = field.name;
  form.querySelector("#displayName").value = field.display_name;
  form.querySelector("#fieldType").value = field.field_type;
  form.querySelector("#required").checked = field.is_required;

  const optionsContainer = form.querySelector(".field-options-container");
  const fileSizeContainer = form.querySelector(".file-size-container");

  if (["select", "radio", "checkbox"].includes(field.field_type)) {
    optionsContainer.style.display = "block";
    fileSizeContainer.style.display = "none";

    // Safely parse options or use the string value
    let optionsValue = field.options;
    try {
      if (field.options && typeof field.options === "string") {
        // Try to parse as JSON first
        optionsValue = JSON.parse(field.options);
      }
    } catch (e) {
      // If parsing fails, split by comma
      optionsValue = field.options ? field.options.split(",") : [];
    }

    // Convert to newline-separated string
    form.querySelector("#options").value = Array.isArray(optionsValue)
      ? optionsValue.join("\n")
      : optionsValue;
  } else if (field.field_type === "file") {
    optionsContainer.style.display = "none";
    fileSizeContainer.style.display = "block";
    form.querySelector("#maxFileSize").value = field.max_file_size || 5;
    form.querySelector("#allowedTypes").value =
      field.allowed_types || ".pdf,.jpg,.jpeg,.png";
  } else {
    optionsContainer.style.display = "none";
    fileSizeContainer.style.display = "none";
  }
}

// Initialize form management when the page loads
document.addEventListener("DOMContentLoaded", async () => {
  window.formManager = new FormManager();
  if (await window.formManager.checkAdminAccess()) {
    await initializeFormManagement();

    // Initialize event listeners for modals
    document.getElementById("addSectionBtn").addEventListener("click", () => {
      new bootstrap.Modal(document.getElementById("sectionModal")).show();
    });

    document
      .getElementById("saveSectionBtn")
      .addEventListener("click", saveSection);
    document
      .getElementById("saveFieldBtn")
      .addEventListener("click", saveField);

    // Field type change handler
    document.getElementById("fieldType").addEventListener("change", (e) => {
      const optionsContainer = document.querySelector(
        ".field-options-container"
      );
      optionsContainer.style.display = ["select", "radio", "checkbox"].includes(
        e.target.value
      )
        ? "block"
        : "none";
    });
  }
});
