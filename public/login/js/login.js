class LoginHandler {
  constructor() {
    this.form = document.getElementById("loginForm");
    this.errorAlert = document.getElementById("loginError");
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

    if (!this.form.checkValidity()) {
      this.form.classList.add("was-validated");
      return;
    }

    const email = this.form.email.value.trim();
    const password = this.form.password.value;

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("authToken", data.token);
        localStorage.setItem("userInfo", JSON.stringify(data.user));

        // Check registration status
        const progressResponse = await fetch("/api/registration/progress", {
          headers: {
            Authorization: `Bearer ${data.token}`,
          },
        });

        if (progressResponse.ok) {
          const progressData = await progressResponse.json();
          if (progressData.status === "completed") {
            window.location.href = `/track?id=${progressData.applicationId}`;
          } else {
            window.location.href = "/registration/form";
          }
        } else {
          window.location.href = "/registration/form";
        }
      } else {
        this.showError(data.message || "Login failed");
      }
    } catch (error) {
      console.error("Login error:", error);
      this.showError("An error occurred. Please try again later.");
    }
  }
}

// Initialize login handler
document.addEventListener("DOMContentLoaded", () => {
  new LoginHandler();
});
