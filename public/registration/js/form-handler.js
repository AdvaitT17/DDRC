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
    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      return false;
    }

    const formData = this.collectFormData();
    try {
      const response = await fetch("/api/registration/progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
        body: JSON.stringify({
          sectionId: this.renderer.getCurrentSectionId(),
          formData,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save progress");
      }

      return true;
    } catch (error) {
      console.error("Error saving progress:", error);
      alert("Failed to save progress. Please try again.");
      return false;
    }
  }

  collectFormData() {
    const form = document.getElementById("sectionForm");
    const fieldData = {};
    const fields = form.elements;

    for (let field of fields) {
      if (!field.name) continue;

      const fieldId = field.dataset.fieldId;
      if (!fieldId) {
        console.warn(`No field ID found for field: ${field.name}`);
        continue;
      }

      if (field.type === "radio") {
        if (field.checked) {
          fieldData[fieldId] = field.value;
        }
      } else if (field.type === "checkbox") {
        if (!fieldData[fieldId]) {
          fieldData[fieldId] = [];
        }
        if (field.checked) {
          fieldData[fieldId].push(field.value);
        }
      } else {
        fieldData[fieldId] = field.value;
      }
    }

    return fieldData;
  }
}
