class SignupHandler {
  constructor() {
    this.form = document.getElementById("signupForm");
    this.errorAlert = document.getElementById("signupError");
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.form.addEventListener("submit", (e) => this.handleSubmit(e));
    document
      .querySelector(".toggle-password")
      .addEventListener("click", () => this.togglePassword());
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
        localStorage.setItem("authToken", data.token);
        window.location.href = "/registration/form";
      } else {
        this.showError(data.message || "Registration failed");
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

    if (password.length < 8) {
      this.showError("Password must be at least 8 characters long");
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
