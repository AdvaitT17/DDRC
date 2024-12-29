class RegistrationFormRenderer {
  constructor() {
    this.sections = [];
    this.currentSectionIndex = 0;
    this.savedResponses = {};
  }

  async initialize() {
    try {
      // Check authentication first
      const isAuthenticated = await AuthManager.verifyAuth();
      if (!isAuthenticated) {
        window.location.href = "/registration";
        return;
      }

      // Fetch form sections and fields
      const response = await fetch("/api/form/sections", {
        headers: {
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch form sections");
      }

      this.sections = await response.json();
      if (!this.sections.length) {
        throw new Error("No form sections found");
      }

      // Fetch saved progress if any
      await this.loadSavedProgress();

      // Render initial section
      this.renderCurrentSection();
      this.updateProgressIndicator();
      this.setupNavigationButtons();

      // Show main content
      document.getElementById("authLoader").style.display = "none";
      document.getElementById("mainContent").style.display = "block";
    } catch (error) {
      console.error("Error initializing form:", error);
      alert("Error loading form. Please try again later.");
    }
  }

  async loadSavedProgress() {
    try {
      const response = await fetch("/api/registration/progress", {
        headers: {
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
      });
      if (response.ok) {
        const progress = await response.json();
        this.savedResponses = progress.responses || {};
        this.currentSectionIndex = progress.currentSectionIndex || 0;
      }
    } catch (error) {
      console.error("Error loading saved progress:", error);
    }
  }

  renderCurrentSection() {
    const section = this.sections[this.currentSectionIndex];
    const container = document.querySelector(".form-section");

    container.innerHTML = `
      <h2>${section.name}</h2>
      <form id="sectionForm">
        ${this.renderFields(section.fields)}
      </form>
    `;

    // Populate saved values
    this.populateSavedValues(section.fields);
  }

  populateSavedValues(fields) {
    fields.forEach((field) => {
      const input = document.getElementById(field.name);
      if (input && this.savedResponses[field.name]) {
        if (field.field_type === "checkbox") {
          input.checked = this.savedResponses[field.name] === "true";
        } else {
          input.value = this.savedResponses[field.name];
        }
      }
    });
  }

  renderFields(fields) {
    return fields.map((field) => this.renderField(field)).join("");
  }

  renderField(field) {
    // Different rendering based on field type
    switch (field.field_type) {
      case "text":
      case "email":
      case "tel":
      case "number":
      case "date":
        return this.renderInputField(field);
      case "select":
        return this.renderSelectField(field);
      case "radio":
        return this.renderRadioField(field);
      case "checkbox":
        return this.renderCheckboxField(field);
      default:
        return "";
    }
  }

  renderInputField(field) {
    console.log("Rendering input field:", JSON.stringify(field, null, 2));
    return `
      <div class="mb-3">
        <label for="${field.name}" class="form-label">
          ${field.display_name}
          ${field.is_required ? '<span class="text-danger">*</span>' : ""}
        </label>
        <input
          type="${field.field_type}"
          class="form-control"
          id="${field.name}"
          data-field-id="${field.id}"
          name="${field.name}"
          ${field.is_required ? "required" : ""}
          value="${this.savedResponses[field.name] || ""}"
        />
        <div class="invalid-feedback">
          This field is required
        </div>
      </div>
    `;
  }

  renderSelectField(field) {
    const options = JSON.parse(field.options || "[]");
    return `
      <div class="mb-3">
        <label for="${field.name}" class="form-label">
          ${field.display_name}
          ${field.is_required ? '<span class="text-danger">*</span>' : ""}
        </label>
        <select
          class="form-select"
          id="${field.name}"
          data-field-id="${field.id}"
          name="${field.name}"
          ${field.is_required ? "required" : ""}
        >
          <option value="">Select an option</option>
          ${options
            .map(
              (option) => `
            <option value="${option}" ${
                this.savedResponses[field.name] === option ? "selected" : ""
              }>${option}</option>
          `
            )
            .join("")}
        </select>
        <div class="invalid-feedback">
          Please select an option
        </div>
      </div>
    `;
  }

  renderRadioField(field) {
    const options = JSON.parse(field.options || "[]");
    return `
      <div class="mb-3">
        <label class="form-label">
          ${field.display_name}
          ${field.is_required ? '<span class="text-danger">*</span>' : ""}
        </label>
        <div>
          ${options
            .map(
              (option) => `
            <div class="form-check">
              <input
                type="radio"
                class="form-check-input"
                id="${field.name}_${option}"
                data-field-id="${field.id}"
                name="${field.name}"
                value="${option}"
                ${field.is_required ? "required" : ""}
                ${this.savedResponses[field.name] === option ? "checked" : ""}
              />
              <label class="form-check-label" for="${field.name}_${option}">
                ${option}
              </label>
            </div>
          `
            )
            .join("")}
        </div>
        <div class="invalid-feedback">Please select an option</div>
      </div>
    `;
  }

  renderCheckboxField(field) {
    const options = JSON.parse(field.options || "[]");
    return `
      <div class="mb-3">
        <label class="form-label">
          ${field.display_name}
          ${field.is_required ? '<span class="text-danger">*</span>' : ""}
        </label>
        <div>
          ${options
            .map(
              (option) => `
            <div class="form-check">
              <input
                type="checkbox"
                class="form-check-input"
                id="${field.name}_${option}"
                data-field-id="${field.id}"
                name="${field.name}[]"
                value="${option}"
                ${field.is_required ? "required" : ""}
                ${
                  this.savedResponses[field.name]?.includes(option)
                    ? "checked"
                    : ""
                }
              />
              <label class="form-check-label" for="${field.name}_${option}">
                ${option}
              </label>
            </div>
          `
            )
            .join("")}
        </div>
        <div class="invalid-feedback">Please select at least one option</div>
      </div>
    `;
  }

  getCurrentSectionId() {
    return this.sections[this.currentSectionIndex].id;
  }

  moveToNextSection() {
    if (this.currentSectionIndex < this.sections.length - 1) {
      this.currentSectionIndex++;
      this.renderCurrentSection();
      this.updateProgressIndicator();
      this.setupNavigationButtons();
    }
  }

  moveToPreviousSection() {
    if (this.currentSectionIndex > 0) {
      this.currentSectionIndex--;
      this.renderCurrentSection();
      this.updateProgressIndicator();
      this.setupNavigationButtons();
    }
  }

  updateProgressIndicator() {
    const container = document.querySelector(".progress-indicator");
    container.innerHTML = this.sections
      .map(
        (section, index) => `
        <div class="progress-step ${
          index === this.currentSectionIndex
            ? "active"
            : index < this.currentSectionIndex
            ? "completed"
            : ""
        }">
          ${index + 1}
        </div>
      `
      )
      .join("");
  }

  setupNavigationButtons() {
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const submitBtn = document.getElementById("submitBtn");

    prevBtn.style.display = this.currentSectionIndex > 0 ? "block" : "none";
    nextBtn.style.display =
      this.currentSectionIndex < this.sections.length - 1 ? "block" : "none";
    submitBtn.style.display =
      this.currentSectionIndex === this.sections.length - 1 ? "block" : "none";
  }
}

// Initialize form when page loads
document.addEventListener("DOMContentLoaded", async () => {
  const formRenderer = new RegistrationFormRenderer();
  await formRenderer.initialize();
  new RegistrationFormHandler(formRenderer);
});
