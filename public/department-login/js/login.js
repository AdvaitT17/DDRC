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

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("authToken", data.token);
        localStorage.setItem("userInfo", JSON.stringify(data.user));
        window.location.href = "/admin";
      } else {
        this.showError(data.message || "Login failed");
      }
    } catch (error) {
      console.error("Login error:", error);
      this.showError("An error occurred. Please try again later.");
    }
  }
}

// Initialize login manager
document.addEventListener("DOMContentLoaded", () => {
  new LoginManager();
});
