class RegistrationFormRenderer {
  constructor() {
    this.sections = [];
    this.currentSectionIndex = 0;
    this.savedResponses = {};
  }

  async initialize() {
    try {
      // Show auth loader immediately
      document.body.style.overflow = "hidden";
      document.getElementById("authLoader").style.display = "flex";
      document.getElementById("mainContent").style.opacity = "0";
      document.getElementById("mainContent").style.display = "block";

      // Check authentication first
      const isAuthenticated = await AuthManager.verifyAuth();
      if (!isAuthenticated) {
        window.location.href = "/registration";
        return;
      }

      // Check if user has already submitted a registration
      const response = await fetch("/api/registration/check-status", {
        headers: {
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
      });

      const data = await response.json();
      if (data.hasRegistration) {
        // Redirect to dashboard instead of track
        window.location.href = "/dashboard";
        return;
      }

      // Continue with form initialization if no existing registration
      await this.fetchAndInitialize();

      // Smooth transition
      setTimeout(() => {
        document.getElementById("mainContent").style.opacity = "1";
        document.getElementById("authLoader").style.opacity = "0";
        document.body.style.overflow = "";

        setTimeout(() => {
          document.getElementById("authLoader").style.display = "none";
        }, 300);
      }, 300);
    } catch (error) {
      console.error("Error initializing form:", error);
      alert("Error loading form. Please try again later.");
    }
  }

  async fetchAndInitialize() {
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
    AuthManager.initLogoutHandler();
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
        // Map responses by field ID instead of field name
        const responses = progress.responses || {};
        this.savedResponses = {};

        // Convert field names to field IDs in saved responses
        this.sections.forEach((section) => {
          section.fields.forEach((field) => {
            if (responses[field.name] !== undefined) {
              this.savedResponses[field.id] = responses[field.name];
            }
          });
        });

        this.currentSectionIndex = progress.currentSectionIndex || 0;
      }
    } catch (error) {
      console.error("Error loading saved progress:", error);
    }
  }

  renderCurrentSection() {
    const section = this.sections[this.currentSectionIndex];
    const container = document.querySelector(".form-section");

    // Clear previous content
    container.innerHTML = `
      <h2>${section.name}</h2>
      <form id="sectionForm">
        <div class="form-grid">
          ${section.fields.map((field) => this.renderField(field)).join("")}
        </div>
      </form>
    `;

    // Populate saved values after rendering the form
    this.populateSavedValues();
  }

  async populateSavedValues() {
    try {
      // Get current section's fields
      const currentSection = this.sections[this.currentSectionIndex];
      const form = document.getElementById("sectionForm");

      currentSection.fields.forEach((field) => {
        const savedValue = this.savedResponses[field.id];
        if (!savedValue) return;

        const input = form.querySelector(`[data-field-id="${field.id}"]`);
        if (!input) return;

        switch (field.field_type) {
          case "checkbox":
            // Handle multiple checkboxes
            const values = savedValue.split(",");
            const checkboxes = form.querySelectorAll(
              `[data-field-id="${field.id}"]`
            );
            checkboxes.forEach((checkbox) => {
              checkbox.checked = values.includes(checkbox.value);
            });
            break;

          case "radio":
            const radio = form.querySelector(
              `[data-field-id="${field.id}"][value="${savedValue}"]`
            );
            if (radio) radio.checked = true;
            break;

          case "file":
            // For file inputs, we might want to show the filename
            if (savedValue) {
              const fileInfo = document.createElement("div");
              fileInfo.className = "file-info";
              fileInfo.textContent = `Current file: ${savedValue}`;
              input.parentNode.appendChild(fileInfo);
            }
            break;

          default:
            input.value = savedValue;
        }
      });
    } catch (error) {
      console.error("Error populating saved values:", error);
    }
  }

  renderFields(fields) {
    return fields
      .map((field) => {
        // Determine if field should be full width
        const isFullWidth =
          field.field_type === "textarea" ||
          field.field_type === "radio" ||
          field.field_type === "checkbox" ||
          field.name.includes("address");

        return `
        <div class="form-group ${isFullWidth ? "full-width" : ""}">
          ${this.renderField(field)}
        </div>
      `;
      })
      .join("");
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
      case "file":
        return this.renderFileField(field);
      default:
        return "";
    }
  }

  renderInputField(field) {
    let validationAttrs = "";

    if (field.field_type === "tel") {
      validationAttrs = `
        pattern="[0-9]{10}"
        minlength="10"
        maxlength="10"
        title="Please enter a valid 10-digit phone number"
      `;
    }

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
          ${validationAttrs}
          value="${this.savedResponses[field.id] || ""}"
        />
        <div class="invalid-feedback">
          ${
            field.field_type === "tel"
              ? "Please enter a valid 10-digit phone number"
              : "This field is required"
          }
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
                this.savedResponses[field.id] === option ? "selected" : ""
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
                ${this.savedResponses[field.id] === option ? "checked" : ""}
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
                  this.savedResponses[field.id]?.includes(option)
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

  renderFileField(field) {
    const allowedTypes = field.allowed_types || ".pdf,.jpg,.jpeg,.png";
    const maxSize = (field.max_file_size || 5) * 1024 * 1024; // Convert MB to bytes

    return `
      <div class="mb-3">
        <label class="form-label">
          ${field.display_name}
          ${field.is_required ? '<span class="text-danger">*</span>' : ""}
        </label>
        <input
          type="file"
          class="form-control"
          id="${field.name}"
          name="${field.name}"
          data-field-id="${field.id}"
          accept="${allowedTypes}"
          data-max-size="${maxSize}"
          ${field.is_required ? "required" : ""}
        >
        <div class="form-text">
          Maximum file size: ${field.max_file_size || 5}MB
          <br>
          Allowed types: ${allowedTypes}
        </div>
        <div class="invalid-feedback">Please select a valid file</div>
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
