const API_BASE = "/api/form";

// Initialize form management
document.addEventListener("DOMContentLoaded", function () {
  loadFormSections();
  initializeEventListeners();
});

function initializeEventListeners() {
  // Add Section Button
  document.getElementById("addSection").addEventListener("click", () => {
    const modal = new bootstrap.Modal(document.getElementById("sectionModal"));
    modal.show();
  });

  // Save Section Button
  document
    .getElementById("saveSectionBtn")
    .addEventListener("click", saveSection);

  // Add Field Button (delegated)
  document
    .querySelector(".sections-container")
    .addEventListener("click", (e) => {
      if (e.target.classList.contains("add-field-btn")) {
        const sectionId = e.target.closest(".section-item").dataset.sectionId;
        showFieldModal(sectionId);
      }
    });

  // Edit Field Button (delegated)
  document
    .querySelector(".sections-container")
    .addEventListener("click", (e) => {
      if (e.target.classList.contains("edit-field-btn")) {
        const fieldItem = e.target.closest(".field-item");
        showEditFieldModal(fieldItem);
      }
    });

  // Delete Buttons (delegated)
  document
    .querySelector(".sections-container")
    .addEventListener("click", async (e) => {
      if (e.target.classList.contains("delete-section-btn")) {
        const sectionId = e.target.closest(".section-item").dataset.sectionId;
        if (confirm("Are you sure you want to delete this section?")) {
          await deleteSection(sectionId);
        }
      }
      if (e.target.classList.contains("delete-field-btn")) {
        const fieldId = e.target.closest(".field-item").dataset.fieldId;
        if (confirm("Are you sure you want to delete this field?")) {
          await deleteField(fieldId);
        }
      }
    });

  // Save Field Button
  document.getElementById("saveFieldBtn").addEventListener("click", saveField);

  // Field Type Change
  document
    .querySelector('select[name="fieldType"]')
    .addEventListener("change", handleFieldTypeChange);
}

async function loadFormSections() {
  try {
    const response = await fetch(`${API_BASE}/sections`);
    if (!response.ok) throw new Error("Failed to load sections");
    const sections = await response.json();
    renderFormSections(sections);
  } catch (error) {
    console.error("Error loading sections:", error);
    showAlert("Error loading form sections", "error");
  }
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
              <button class="btn btn-sm btn-primary add-field-btn">Add Field</button>
              <button class="btn btn-sm btn-danger delete-section-btn">Delete</button>
            </div>
          </div>
          <div class="fields-container">
            ${renderFields(section.fields)}
          </div>
        </div>
      `
    )
    .join("");
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

async function saveSection(e) {
  e.preventDefault();
  try {
    const nameInput = document.querySelector(
      "#sectionModal input[name='sectionName']"
    );
    const name = nameInput.value.trim();

    if (!name) {
      showAlert("Section name is required", "error");
      return;
    }

    const response = await fetch(`${API_BASE}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) throw new Error("Failed to add section");

    const modal = bootstrap.Modal.getInstance(
      document.getElementById("sectionModal")
    );
    modal.hide();
    nameInput.value = "";
    await loadFormSections();
    showAlert("Section added successfully", "success");
  } catch (error) {
    console.error("Error saving section:", error);
    showAlert("Error saving section", "error");
  }
}

function showFieldModal(sectionId, fieldData = null) {
  console.log("Opening field modal for section:", sectionId);
  const modal = document.getElementById("fieldModal");
  modal.dataset.sectionId = sectionId;
  modal.dataset.fieldId = fieldData?.id || "";
  modal.dataset.mode = fieldData ? "edit" : "add";

  // Log the modal state
  console.log("Modal state:", {
    sectionId: modal.dataset.sectionId,
    fieldId: modal.dataset.fieldId,
    mode: modal.dataset.mode,
  });

  if (fieldData) {
    modal.querySelector("input[name='fieldName']").value = fieldData.name;
    modal.querySelector("input[name='displayName']").value =
      fieldData.display_name;
    modal.querySelector("select[name='fieldType']").value =
      fieldData.field_type;
    modal.querySelector("input[name='required']").checked =
      fieldData.is_required;

    if (fieldData.options) {
      const optionsContainer = modal.querySelector(".field-options-container");
      optionsContainer.style.display = "block";
      optionsContainer.querySelector("textarea").value = JSON.parse(
        fieldData.options
      ).join("\n");
    }
  } else {
    resetFieldModal();
  }

  const modalInstance = new bootstrap.Modal(modal);
  modalInstance.show();
}

function showEditFieldModal(fieldItem) {
  const fieldId = fieldItem.dataset.fieldId;
  const fieldData = {
    id: fieldId,
    name: fieldItem.querySelector(".field-name").textContent,
    display_name: fieldItem.querySelector(".field-name").textContent,
    field_type: fieldItem.querySelector(".field-type").textContent,
    is_required: fieldItem.querySelector(".required-badge") !== null,
    options: null, // You'll need to load this from the server if needed
  };

  const sectionId = fieldItem.closest(".section-item").dataset.sectionId;
  showFieldModal(sectionId, fieldData);
}

async function saveField(e) {
  e.preventDefault();
  const modal = document.getElementById("fieldModal");
  const sectionId = modal.dataset.sectionId;
  console.log("Saving field for section:", sectionId);

  const fieldData = {
    name: modal.querySelector("input[name='fieldName']").value.trim(),
    displayName: modal.querySelector("input[name='displayName']").value.trim(),
    type: modal.querySelector("select[name='fieldType']").value,
    required: modal.querySelector("input[name='required']").checked,
  };

  console.log("Field data:", fieldData);

  const optionsTextarea = modal.querySelector("textarea[name='options']");
  if (optionsTextarea && optionsTextarea.value.trim()) {
    fieldData.options = optionsTextarea.value
      .split("\n")
      .map((opt) => opt.trim())
      .filter((opt) => opt);
  }

  if (!fieldData.name || !fieldData.displayName) {
    showAlert("All field details are required", "error");
    return;
  }

  try {
    const isEdit = modal.dataset.mode === "edit";
    const url = isEdit
      ? `${API_BASE}/fields/${modal.dataset.fieldId}`
      : `${API_BASE}/sections/${modal.dataset.sectionId}/fields`;

    const response = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fieldData),
    });

    if (!response.ok)
      throw new Error(`Failed to ${isEdit ? "update" : "add"} field`);

    const modalInstance = bootstrap.Modal.getInstance(modal);
    modalInstance.hide();
    await loadFormSections();
    showAlert(`Field ${isEdit ? "updated" : "added"} successfully`, "success");
  } catch (error) {
    console.error("Error saving field:", error);
    showAlert(
      `Error ${modal.dataset.mode === "edit" ? "updating" : "saving"} field`,
      "error"
    );
  }
}

function handleFieldTypeChange(e) {
  const type = e.target.value;
  const optionsContainer = document.querySelector(".field-options-container");
  optionsContainer.style.display = ["select", "radio", "checkbox"].includes(
    type
  )
    ? "block"
    : "none";
}

function resetFieldModal() {
  const modal = document.getElementById("fieldModal");
  modal.querySelector("input[name='fieldName']").value = "";
  modal.querySelector("input[name='displayName']").value = "";
  modal.querySelector("select[name='fieldType']").value = "text";
  modal.querySelector("input[name='required']").checked = false;
  const optionsContainer = modal.querySelector(".field-options-container");
  optionsContainer.style.display = "none";
  optionsContainer.querySelector("textarea").value = "";
  modal.dataset.fieldId = "";
  modal.dataset.mode = "add";
}

async function deleteSection(sectionId) {
  try {
    const response = await fetch(`${API_BASE}/sections/${sectionId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete section");
    await loadFormSections();
    showAlert("Section deleted successfully", "success");
  } catch (error) {
    console.error("Error deleting section:", error);
    showAlert("Error deleting section", "error");
  }
}

async function deleteField(fieldId) {
  try {
    const response = await fetch(`${API_BASE}/fields/${fieldId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete field");
    await loadFormSections();
    showAlert("Field deleted successfully", "success");
  } catch (error) {
    console.error("Error deleting field:", error);
    showAlert("Error deleting field", "error");
  }
}

function showAlert(message, type = "info") {
  const alertDiv = document.createElement("div");
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  const container = document.querySelector(".admin-content");
  container.insertBefore(alertDiv, container.firstChild);
  setTimeout(() => {
    const bsAlert = new bootstrap.Alert(alertDiv);
    bsAlert.close();
  }, 5000);
}
