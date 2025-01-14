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
    if (await this.validateAndSaveCurrentSection()) {
      this.renderer.moveToNextSection();
    }
  }

  async handlePrev() {
    this.renderer.moveToPreviousSection();
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
      console.error("Error submitting form:", error);
      alert("Failed to submit form. Please try again.");
    }
  }

  async validateAndSaveCurrentSection() {
    const form = document.getElementById("sectionForm");

    // Custom validation for phone fields
    const phoneInputs = form.querySelectorAll('input[type="tel"]');
    let isValid = true;

    phoneInputs.forEach((input) => {
      if (input.value && !input.value.match(/^\d{10}$/)) {
        input.setCustomValidity("Please enter a valid 10-digit phone number");
        isValid = false;
      } else {
        input.setCustomValidity("");
      }
    });

    if (!form.checkValidity() || !isValid) {
      form.classList.add("was-validated");
      return false;
    }

    try {
      const formData = this.collectFormData();

      const response = await fetch("/api/registration/progress", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to save progress");
      }

      return true;
    } catch (error) {
      console.error("Error saving progress:", error);
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

      if (field.type === "file") {
        if (field.files && field.files[0]) {
          const file = field.files[0];
          const maxSize = parseInt(field.dataset.maxSize);

          if (file.size > maxSize) {
            throw new Error(
              `File size exceeds maximum allowed size of ${
                maxSize / 1024 / 1024
              }MB`
            );
          }

          formData.append(`file_${fieldId}`, file);
        }
      } else if (field.type === "checkbox") {
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
