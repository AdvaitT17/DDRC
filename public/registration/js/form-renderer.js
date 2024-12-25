class FormRenderer {
  constructor() {
    this.sections = [];
    this.currentSection = 0;
    this.formContainer = document.querySelector(".form-sections");
  }

  async loadFormStructure() {
    try {
      const response = await fetch("/api/form/sections");
      if (!response.ok) throw new Error("Failed to load form structure");
      this.sections = await response.json();
      this.renderForm();
      this.showSection(0);
      this.updateProgress();
    } catch (error) {
      console.error("Error loading form:", error);
      this.showError(
        "Failed to load the registration form. Please try again later."
      );
    }
  }

  renderForm() {
    this.formContainer.innerHTML = this.sections
      .map((section, index) => this.renderSection(section, index))
      .join("");

    // Initialize date pickers after rendering
    this.initializeDatePickers();
  }

  renderSection(section, index) {
    return `
      <div class="form-section" data-section="${index}">
        <div class="form-section-header">
          <h3>${section.name}</h3>
        </div>
        <div class="form-section-body">
          ${section.fields.map((field) => this.renderField(field)).join("")}
        </div>
      </div>
    `;
  }

  renderField(field) {
    const isRequired = field.is_required;
    const fieldId = `field_${field.id}`;
    let inputElement = "";

    switch (field.field_type) {
      case "text":
      case "email":
      case "tel":
      case "number":
        inputElement = `
          <input type="${field.field_type}" 
                 class="form-control" 
                 id="${fieldId}" 
                 name="${field.name}"
                 ${isRequired ? "required" : ""}>
        `;
        break;

      case "date":
        inputElement = `
          <input type="text" 
                 class="form-control datepicker" 
                 id="${fieldId}" 
                 name="${field.name}"
                 placeholder="Select date..."
                 ${isRequired ? "required" : ""}>
        `;
        break;

      case "select":
        const options = JSON.parse(field.options || "[]");
        inputElement = `
          <select class="form-select" 
                  id="${fieldId}" 
                  name="${field.name}"
                  ${isRequired ? "required" : ""}>
            <option value="">Select an option</option>
            ${options
              .map((opt) => `<option value="${opt}">${opt}</option>`)
              .join("")}
          </select>
        `;
        break;

      case "radio":
        const radioOptions = JSON.parse(field.options || "[]");
        inputElement = `
          <div class="radio-group">
            ${radioOptions
              .map(
                (opt, i) => `
              <div class="form-check">
                <input class="form-check-input" 
                       type="radio" 
                       name="${field.name}" 
                       id="${fieldId}_${i}"
                       value="${opt}"
                       ${isRequired ? "required" : ""}>
                <label class="form-check-label" for="${fieldId}_${i}">
                  ${opt}
                </label>
              </div>
            `
              )
              .join("")}
          </div>
        `;
        break;

      case "checkbox":
        const checkboxOptions = JSON.parse(field.options || "[]");
        inputElement = `
          <div class="checkbox-group">
            ${checkboxOptions
              .map(
                (opt, i) => `
              <div class="form-check">
                <input class="form-check-input" 
                       type="checkbox" 
                       name="${field.name}[]" 
                       id="${fieldId}_${i}"
                       value="${opt}">
                <label class="form-check-label" for="${fieldId}_${i}">
                  ${opt}
                </label>
              </div>
            `
              )
              .join("")}
          </div>
        `;
        break;
    }

    return `
      <div class="form-field">
        <label for="${fieldId}" class="${isRequired ? "required" : ""}">
          ${field.display_name}
        </label>
        ${inputElement}
        <div class="invalid-feedback">
          This field is required
        </div>
      </div>
    `;
  }

  showSection(index) {
    const sections = document.querySelectorAll(".form-section");
    sections.forEach((section) => section.classList.remove("active"));
    sections[index]?.classList.add("active");

    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const submitBtn = document.getElementById("submitBtn");

    prevBtn.style.display = index === 0 ? "none" : "block";
    nextBtn.style.display = index === sections.length - 1 ? "none" : "block";
    submitBtn.style.display = index === sections.length - 1 ? "block" : "none";
  }

  updateProgress() {
    const progress = ((this.currentSection + 1) / this.sections.length) * 100;
    document.querySelector(".progress-bar").style.width = `${progress}%`;
  }

  showError(message) {
    const alert = document.createElement("div");
    alert.className = "alert alert-danger";
    alert.textContent = message;
    this.formContainer.prepend(alert);
  }

  initializeDatePickers() {
    const dateInputs = document.querySelectorAll(".datepicker");
    dateInputs.forEach((input) => {
      flatpickr(input, {
        dateFormat: "Y-m-d",
        allowInput: true,
        maxDate: new Date(),
        yearRange: "1900:2024",
        altInput: true,
        altFormat: "F j, Y",
        disableMobile: false,
      });
    });
  }
}

// Initialize the form
document.addEventListener("DOMContentLoaded", () => {
  const formRenderer = new FormRenderer();
  formRenderer.loadFormStructure();
  window.formRenderer = formRenderer; // Make it accessible to navigation script
});
