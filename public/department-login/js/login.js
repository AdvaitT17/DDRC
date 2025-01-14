class LoginManager {
  constructor() {
    this.form = document.getElementById("loginForm");
    this.errorAlert = document.getElementById("loginError");
    this.captchaText = document.getElementById("captcha");
    this.captchaInput = document.getElementById("captchaInput");
    this.refreshBtn = document.getElementById("refreshCaptcha");
    this.togglePasswordBtn = document.querySelector(".toggle-password");
    this.passwordInput = document.getElementById("password");

    this.initializeEventListeners();
    this.generateCaptcha();
  }

  initializeEventListeners() {
    this.form.addEventListener("submit", (e) => this.handleSubmit(e));
    this.refreshBtn.addEventListener("click", () => this.generateCaptcha());
    this.togglePasswordBtn.addEventListener("click", () =>
      this.togglePassword()
    );
  }

  generateCaptcha() {
    const chars =
      "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    let captcha = "";
    for (let i = 0; i < 6; i++) {
      captcha += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.captchaText.textContent = captcha;
  }

  togglePassword() {
    const type = this.passwordInput.type === "password" ? "text" : "password";
    this.passwordInput.type = type;
    this.togglePasswordBtn.querySelector("img").src = `/images/${
      type === "password" ? "eye" : "eye-slash"
    }.svg`;
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

    if (!this.form.checkValidity()) {
      this.form.classList.add("was-validated");
      return;
    }

    const username = this.form.username.value.trim();
    const password = this.form.password.value;
    const captchaInput = this.form.captchaInput.value.trim();
    const captchaText = document.getElementById("captcha").textContent;

    // Validate captcha first
    if (captchaInput !== captchaText) {
      this.showError("Invalid captcha code");
      this.generateCaptcha();
      this.captchaInput.value = "";
      return;
    }

    const submitButton = this.form.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = "Processing...";

    try {
      const response = await fetch("/api/auth/department/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Verify data structure
        if (!data.token || !data.user || !data.user.type) {
          this.showError("Invalid server response");
          submitButton.disabled = false;
          submitButton.innerHTML = originalText;
          return;
        }

        // Set auth with verification
        AuthManager.setAuth(data.token, data.user);

        // Verify storage before redirect
        const storedToken = localStorage.getItem("departmentAuthToken");
        const storedUser = localStorage.getItem("departmentUserInfo");

        if (!storedToken || !storedUser) {
          this.showError("Failed to store authentication data");
          submitButton.disabled = false;
          submitButton.innerHTML = originalText;
          return;
        }

        setTimeout(() => {
          window.location.href = "/admin/dashboard";
        }, 100);
      } else {
        this.showError(data.message || "Login failed");
        this.generateCaptcha();
        this.captchaInput.value = "";
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
      }
    } catch (error) {
      this.showError("An error occurred. Please try again later.");
      this.generateCaptcha();
      this.captchaInput.value = "";
      submitButton.disabled = false;
      submitButton.innerHTML = originalText;
    }
  }
}

// Initialize login manager
document.addEventListener("DOMContentLoaded", () => {
  new LoginManager();
});
