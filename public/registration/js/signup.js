class SignupHandler {
  constructor() {
    this.form = document.getElementById("signupForm");
    this.errorAlert = document.getElementById("signupError");
    this.passwordInput = document.getElementById("password");
    this.confirmPasswordInput = document.getElementById("confirmPassword");
    this.requirementsPopup = document.getElementById("passwordRequirements");
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.form.addEventListener("submit", (e) => this.handleSubmit(e));
    document
      .querySelector(".toggle-password")
      .addEventListener("click", () => this.togglePassword());

    // Password requirements popup handlers
    this.passwordInput.addEventListener("focus", () => this.showRequirements());
    this.passwordInput.addEventListener("blur", () => this.hideRequirements());
    this.passwordInput.addEventListener("input", () => this.validatePasswordRequirements());
  }

  showRequirements() {
    if (this.requirementsPopup) {
      this.requirementsPopup.style.display = "block";
      this.validatePasswordRequirements();
    }
  }

  hideRequirements() {
    // Small delay to allow clicking on popup if needed
    setTimeout(() => {
      if (this.requirementsPopup) {
        this.requirementsPopup.style.display = "none";
      }
    }, 200);
  }

  validatePasswordRequirements() {
    const password = this.passwordInput.value;

    const requirements = {
      "req-length": password.length >= 8,
      "req-uppercase": /[A-Z]/.test(password),
      "req-lowercase": /[a-z]/.test(password),
      "req-number": /[0-9]/.test(password),
      "req-special": /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };

    Object.entries(requirements).forEach(([id, valid]) => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.toggle("valid", valid);
        const icon = el.querySelector(".req-icon");
        if (icon) {
          icon.textContent = valid ? "✓" : "○";
        }
      }
    });

    const allMet = Object.values(requirements).every(Boolean);

    // Auto-hide popup when all requirements are met
    if (allMet && this.requirementsPopup) {
      this.requirementsPopup.style.display = "none";
    }

    return allMet;
  }

  togglePassword() {
    const input = document.getElementById("password");
    const type = input.type === "password" ? "text" : "password";
    input.type = type;
    const icon = document.querySelector(".eye-icon");
    icon.src = `/images/${type === "password" ? "eye" : "eye-slash"}.svg`;
  }

  showError(message) {
    this.errorAlert.textContent = message;
    this.errorAlert.style.display = "block";
    setTimeout(() => {
      this.errorAlert.style.display = "none";
    }, 5000);
  }

  async handleSubmit(e) {
    e.preventDefault();

    const email = this.form.email.value.trim();
    const phone = this.form.phone.value.trim();
    const password = this.form.password.value;
    const confirmPassword = this.form.confirmPassword.value;

    if (!this.validateForm(email, phone, password, confirmPassword)) {
      return;
    }

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, phone, password }),
      });

      const data = await response.json();

      if (response.ok) {
        AuthManager.setAuth(data.token, { ...data.user, type: "applicant" });
        window.location.href = "/registration/form";
      } else {
        // Show specific password errors if available
        if (data.errors && data.errors.length > 0) {
          this.showError(data.errors.join(". "));
        } else {
          this.showError(data.message || "Registration failed");
        }
      }
    } catch (error) {
      console.error("Signup error:", error);
      this.showError("An error occurred. Please try again later.");
    }
  }

  validateForm(email, phone, password, confirmPassword) {
    if (!email || !phone || !password || !confirmPassword) {
      this.showError("All fields are required");
      return false;
    }

    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      this.showError("Please enter a valid email address");
      return false;
    }

    if (!phone.match(/^\d{10}$/)) {
      this.showError("Please enter a valid 10-digit phone number");
      return false;
    }

    // Check all password requirements
    if (!this.validatePasswordRequirements()) {
      this.showError("Password does not meet all requirements");
      return false;
    }

    if (password !== confirmPassword) {
      this.showError("Passwords do not match");
      return false;
    }

    return true;
  }
}

// Initialize signup handler
document.addEventListener("DOMContentLoaded", () => {
  new SignupHandler();
});
