class FormWizard {
  constructor() {
    this.currentStep = 1;
    this.form = document.getElementById("registrationForm");
    this.steps = document.querySelectorAll(".wizard-step");
    this.progressSteps = document.querySelectorAll(".progress-steps .step");

    this.initializeWizard();
    this.loadFormStructure();
  }

  async loadFormStructure() {
    try {
      const response = await fetch("/api/form-structure");
      const formStructure = await response.json();
      this.renderFormSteps(formStructure);
    } catch (error) {
      console.error("Error loading form structure:", error);
    }
  }

  renderFormSteps(formStructure) {
    // Will implement dynamic form rendering based on admin configuration
  }

  initializeWizard() {
    document.querySelectorAll(".next-step").forEach((button) => {
      button.addEventListener("click", () => this.nextStep());
    });

    document.querySelectorAll(".prev-step").forEach((button) => {
      button.addEventListener("click", () => this.prevStep());
    });

    this.form.addEventListener("submit", (e) => this.handleSubmit(e));
  }

  nextStep() {
    if (this.validateStep(this.currentStep)) {
      this.showStep(this.currentStep + 1);
    }
  }

  prevStep() {
    this.showStep(this.currentStep - 1);
  }

  showStep(step) {
    // Update active step
    document
      .querySelector(`.wizard-step[data-step="${this.currentStep}"]`)
      .classList.remove("active");
    document
      .querySelector(`.wizard-step[data-step="${step}"]`)
      .classList.add("active");

    // Update progress indicator
    document
      .querySelector(`.step[data-step="${this.currentStep}"]`)
      .classList.remove("active");
    document
      .querySelector(`.step[data-step="${step}"]`)
      .classList.add("active");

    this.currentStep = step;
  }

  validateStep(step) {
    // Implement step validation
    return true;
  }

  async handleSubmit(e) {
    e.preventDefault();
    if (this.validateStep(this.currentStep)) {
      try {
        const formData = new FormData(this.form);
        const response = await fetch("/api/submit-registration", {
          method: "POST",
          body: formData,
        });
        // Handle response
      } catch (error) {
        console.error("Error submitting form:", error);
      }
    }
  }
}

// Initialize form wizard when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new FormWizard();
});
