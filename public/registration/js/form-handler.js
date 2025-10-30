class RegistrationFormHandler {
  constructor(renderer) {
    this.renderer = renderer;
    this.setupEventListeners();
  }

  setupEventListeners() {
    document
      .getElementById("nextBtn")
      .addEventListener("click", () => this.handleNext());
    document
      .getElementById("prevBtn")
      .addEventListener("click", () => this.handlePrev());
    document
      .getElementById("submitBtn")
      .addEventListener("click", (e) => this.handleSubmit(e));
  }

  async handleNext() {
    // Save current values before validation
    this.saveCurrentValues();

    if (await this.validateAndSaveCurrentSection()) {
      this.renderer.moveToNextSection();
    }
  }

  async handlePrev() {
    // Save current values before moving back
    this.saveCurrentValues();
    this.renderer.moveToPreviousSection();
  }

  // Add this new method to save current values
  saveCurrentValues() {
    const form = document.getElementById("sectionForm");
    const fields = form.elements;

    for (let field of fields) {
      if (!field.name) continue;

      const fieldId = field.dataset.fieldId;
      if (!fieldId) continue;

      if (field.type === "checkbox") {
        // Handle checkbox groups
        const checkboxes = form.querySelectorAll(
          `[data-field-id="${fieldId}"]`
        );
        const values = [];
        checkboxes.forEach((checkbox) => {
          if (checkbox.checked) {
            values.push(checkbox.value);
          }
        });
        if (values.length > 0) {
          this.renderer.savedResponses[fieldId] = values.join(",");
        }
      } else if (field.type === "radio") {
        if (field.checked) {
          this.renderer.savedResponses[fieldId] = field.value;
        }
      } else if (field.type === "file") {
        // Skip file inputs as they can't maintain their state
        continue;
      } else if (field.name.includes("_level_")) {
        // Handle nested dropdowns
        const container = field.closest(".nested-select-container");
        if (container) {
          const selects = container.querySelectorAll("select");
          const values = [];
          selects.forEach((select) => {
            if (select.value) {
              values.push(select.value);
            }
          });
          if (values.length > 0) {
            this.renderer.savedResponses[fieldId] = values.join(",");
          }
        }
      } else {
        this.renderer.savedResponses[fieldId] = field.value;
      }
    }
  }

  async handleSubmit(e) {
    e.preventDefault();

    if (!(await this.validateAndSaveCurrentSection())) {
      return;
    }

    try {
      const response = await fetch("/api/registration/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to submit form");
      }

      const data = await response.json();
      sessionStorage.setItem("registrationSubmitted", "true");
      sessionStorage.setItem("applicationId", data.applicationId);
      window.location.href = `/registration/success?id=${data.applicationId}`;
    } catch (error) {
      // Check if it's a validation error
      if (error.message && error.message.includes("validation")) {
        alert("Some fields have validation errors. Please review all sections and correct the errors before submitting.");
      } else {
        alert(error.message || "Failed to submit form. Please try again.");
      }
    }
  }

  async validateAndSaveCurrentSection() {
    const form = document.getElementById("sectionForm");

    // Custom validation for all input fields with patterns
    const allInputs = form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="number"]');
    let isValid = true;

    allInputs.forEach((input) => {
      // Clear previous custom validity
      input.setCustomValidity("");
      
      // Skip if field is empty and not required
      if (!input.value && !input.required) {
        return;
      }
      
      // Only validate if field has value
      if (input.value) {
        // Check pattern validity (only if pattern attribute exists)
        if (input.hasAttribute('pattern')) {
          const regex = new RegExp(`^${input.pattern}$`);
          if (!regex.test(input.value)) {
            // Use the title attribute as the error message, or a default
            const errorMsg = input.title || "Please match the required format";
            input.setCustomValidity(errorMsg);
            isValid = false;
            return; // Stop checking this input
          }
        }
        
        // Check min/max for number fields (only if attributes exist)
        if (input.type === "number") {
          const numValue = parseFloat(input.value);
          if (input.hasAttribute('min') && numValue < parseFloat(input.min)) {
            const errorMsg = input.title || `Value must be at least ${input.min}`;
            input.setCustomValidity(errorMsg);
            isValid = false;
            return;
          }
          if (input.hasAttribute('max') && numValue > parseFloat(input.max)) {
            const errorMsg = input.title || `Value must be at most ${input.max}`;
            input.setCustomValidity(errorMsg);
            isValid = false;
            return;
          }
        }
        
        // Check minlength/maxlength (only if attributes exist)
        if (input.hasAttribute('minlength')) {
          const minLen = parseInt(input.getAttribute('minlength'));
          if (input.value.length < minLen) {
            const errorMsg = input.title || `Minimum length is ${minLen} characters`;
            input.setCustomValidity(errorMsg);
            isValid = false;
            return;
          }
        }
        if (input.hasAttribute('maxlength')) {
          const maxLen = parseInt(input.getAttribute('maxlength'));
          if (input.value.length > maxLen) {
            const errorMsg = input.title || `Maximum length is ${maxLen} characters`;
            input.setCustomValidity(errorMsg);
            isValid = false;
            return;
          }
        }
      }
    });

    if (!form.checkValidity() || !isValid) {
      form.classList.add("was-validated");
      return false;
    }

    try {
      const formData = this.collectFormData();
      formData.append(
        "current_section_id",
        this.renderer.getCurrentSectionId()
      );

      const response = await fetch("/api/registration/progress", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle validation errors from server
        if (errorData.errors && Array.isArray(errorData.errors)) {
          const errorMessages = errorData.errors.map(err => 
            `• ${err.fieldName}: ${err.message}`
          ).join('\n');
          
          alert(`Validation failed:\n\n${errorMessages}\n\nPlease correct the errors and try again.`);
        } else {
          throw new Error(errorData.message || "Failed to save progress");
        }
        return false;
      }

      return true;
    } catch (error) {
      alert(error.message || "Failed to save progress. Please try again.");
      return false;
    }
  }

  collectFormData() {
    const form = document.getElementById("sectionForm");
    const formData = new FormData();
    const fields = form.elements;

    // Track checkbox groups to handle multiple selections
    const checkboxGroups = {};

    for (let field of fields) {
      if (!field.name) continue;

      const fieldId = field.dataset.fieldId;
      if (!fieldId) continue;

      // Skip file inputs as they're handled separately by immediate upload
      if (field.type === "file") continue;

      if (field.type === "checkbox") {
        if (field.checked) {
          // Initialize array if not exists
          if (!checkboxGroups[fieldId]) {
            checkboxGroups[fieldId] = [];
          }
          checkboxGroups[fieldId].push(field.value);
        }
      } else if (field.type === "radio") {
        if (field.checked) {
          formData.append(fieldId, field.value);
        }
      } else {
        formData.append(fieldId, field.value);
      }
    }

    // Add checkbox groups to formData
    for (const [fieldId, values] of Object.entries(checkboxGroups)) {
      formData.append(fieldId, values.join(","));
    }

    return formData;
  }
}
