async function initializeFormManagement() {
  try {
    // Fetch form sections
    const response = await fetchWithAuth("/api/form/sections");
    if (response.ok) {
      const sections = await response.json();
      renderFormSections(sections);
    }

    // Initialize event listeners
    initializeFormEventListeners();
  } catch (error) {
    console.error("Error initializing form management:", error);
    // Show error message to user
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
    optionsContainer.style.display = ["select", "radio", "checkbox"].includes(
      e.target.value
    )
      ? "block"
      : "none";
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
    console.error("Error saving section:", error);
    alert("Failed to save section. Please try again.");
  }
}

async function saveField() {
  const modal = document.getElementById("fieldModal");
  const sectionId = modal.dataset.sectionId;
  const fieldId = modal.dataset.fieldId;

  const fieldData = {
    section_id: parseInt(sectionId),
    name: document
      .getElementById("fieldName")
      .value.trim()
      .toLowerCase()
      .replace(/\s+/g, "_"),
    display_name: document.getElementById("displayName").value.trim(),
    field_type: document.getElementById("fieldType").value,
    is_required: document.getElementById("required").checked,
  };

  // Validate required fields
  if (!fieldData.name || !fieldData.display_name) {
    alert("Please fill in all required fields");
    return;
  }

  // Handle options for select, radio, and checkbox fields
  if (["select", "radio", "checkbox"].includes(fieldData.field_type)) {
    const optionsText = document.getElementById("options").value.trim();
    if (!optionsText) {
      alert("Please enter options for this field type");
      return;
    }
    fieldData.options = optionsText
      .split("\n")
      .map((opt) => opt.trim())
      .filter(Boolean);
  }

  try {
    const url = fieldId ? `/api/form/fields/${fieldId}` : "/api/form/fields";

    const method = fieldId ? "PUT" : "POST";

    const response = await fetchWithAuth(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fieldData),
    });

    if (!response.ok) {
      throw new Error(`Failed to ${fieldId ? "update" : "create"} field`);
    }

    // Refresh sections
    await initializeFormManagement();

    // Reset modal title
    modal.querySelector(".modal-title").textContent = "Add Field";

    // Close modal and reset form
    const modalInstance = bootstrap.Modal.getInstance(modal);
    modalInstance.hide();
    resetFieldForm();
  } catch (error) {
    console.error("Error saving field:", error);
    alert(`Failed to ${fieldId ? "update" : "save"} field. Please try again.`);
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
        console.error("Error deleting section:", error);
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
        console.error("Error deleting field:", error);
        alert("Failed to delete field. Please try again.");
      }
    });
  });

  // Edit Field buttons
  document.querySelectorAll(".edit-field-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const fieldId = e.target.closest(".field-item").dataset.fieldId;
      const sectionId = e.target.closest(".section-item").dataset.sectionId;

      try {
        const response = await fetchWithAuth(`/api/form/fields/${fieldId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch field data");
        }

        const field = await response.json();

        // Set the section ID and field ID on the modal
        const modal = document.getElementById("fieldModal");
        modal.dataset.sectionId = sectionId;
        modal.dataset.fieldId = fieldId;

        // Update modal title
        modal.querySelector(".modal-title").textContent = "Edit Field";

        // Populate form fields
        populateFieldForm(field);

        // Show modal
        new bootstrap.Modal(modal).show();
      } catch (error) {
        console.error("Error fetching field:", error);
        alert("Failed to load field data");
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
  if (["select", "radio", "checkbox"].includes(field.field_type)) {
    optionsContainer.style.display = "block";
    form.querySelector("#options").value = field.options.join("\n");
  } else {
    optionsContainer.style.display = "none";
  }
}

// Initialize form management when the page loads
document.addEventListener("DOMContentLoaded", async () => {
  if (await initializeAdminPage()) {
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
