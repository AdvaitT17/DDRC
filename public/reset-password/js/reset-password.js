class ResetPasswordHandler {
    constructor() {
        this.form = document.getElementById("resetPasswordForm");
        this.errorAlert = document.getElementById("resetError");
        this.successAlert = document.getElementById("resetSuccess");
        this.invalidTokenMessage = document.getElementById("invalidTokenMessage");
        this.submitBtn = document.getElementById("submitBtn");
        this.passwordInput = document.getElementById("password");
        this.confirmPasswordInput = document.getElementById("confirmPassword");

        // Get token from URL
        this.token = new URLSearchParams(window.location.search).get("token");

        this.init();
    }

    async init() {
        // Check if token exists in URL
        if (!this.token) {
            this.showInvalidToken();
            return;
        }

        // Verify token is valid before showing the form
        await this.verifyToken();
    }

    async verifyToken() {
        try {
            const response = await fetch(`/api/auth/verify-reset-token?token=${encodeURIComponent(this.token)}`);
            const data = await response.json();

            if (!data.valid) {
                this.showInvalidToken();
                return;
            }

            // Token is valid, setup the form
            this.setupEventListeners();
        } catch (error) {
            console.error("Token verification error:", error);
            this.showInvalidToken();
        }
    }

    setupEventListeners() {
        this.form.addEventListener("submit", (e) => this.handleSubmit(e));
        this.passwordInput.addEventListener("input", () => this.validatePasswordRequirements());
        this.confirmPasswordInput.addEventListener("input", () => this.validatePasswordMatch());

        // Toggle password visibility
        const toggleBtns = document.querySelectorAll(".toggle-password");
        toggleBtns.forEach((btn) => {
            btn.addEventListener("click", () => this.togglePassword(btn));
        });
    }

    togglePassword(btn) {
        const input = btn.previousElementSibling;
        const type = input.type === "password" ? "text" : "password";
        input.type = type;
        const icon = btn.querySelector(".eye-icon");
        icon.src = `/images/${type === "password" ? "eye" : "eye-slash"}.svg`;
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
            }
        });

        return Object.values(requirements).every(Boolean);
    }

    validatePasswordMatch() {
        const match = this.passwordInput.value === this.confirmPasswordInput.value;
        if (!match && this.confirmPasswordInput.value) {
            this.confirmPasswordInput.setCustomValidity("Passwords do not match");
        } else {
            this.confirmPasswordInput.setCustomValidity("");
        }
        return match;
    }

    showInvalidToken() {
        this.form.style.display = "none";
        this.invalidTokenMessage.style.display = "block";
    }

    showError(message) {
        this.successAlert.style.display = "none";
        this.errorAlert.textContent = message;
        this.errorAlert.style.display = "block";

        if (typeof window.announceScreenReaderMessage === "function") {
            window.announceScreenReaderMessage(message);
        }
    }

    showSuccess(message) {
        this.errorAlert.style.display = "none";
        this.successAlert.innerHTML = message;
        this.successAlert.style.display = "block";

        if (typeof window.announceScreenReaderMessage === "function") {
            window.announceScreenReaderMessage(message);
        }
    }

    setLoading(loading) {
        this.submitBtn.disabled = loading;
        this.submitBtn.textContent = loading ? "Resetting..." : "Reset Password";
    }

    async handleSubmit(e) {
        e.preventDefault();

        // Clear previous messages
        this.errorAlert.style.display = "none";
        this.successAlert.style.display = "none";

        // Validate password requirements
        if (!this.validatePasswordRequirements()) {
            this.showError("Password does not meet all requirements");
            return;
        }

        // Validate password match
        if (!this.validatePasswordMatch()) {
            this.showError("Passwords do not match");
            return;
        }

        if (!this.form.checkValidity()) {
            this.form.classList.add("was-validated");
            return;
        }

        const password = this.passwordInput.value;

        this.setLoading(true);

        try {
            const response = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: this.token, password }),
            });

            const data = await response.json();

            if (response.ok) {
                this.showSuccess(
                    `${data.message}. Redirecting to login page...`
                );

                // Disable form
                this.submitBtn.disabled = true;
                this.passwordInput.disabled = true;
                this.confirmPasswordInput.disabled = true;

                // Redirect to login after 3 seconds
                setTimeout(() => {
                    window.location.href = "/login";
                }, 3000);
            } else {
                if (data.message.includes("expired") || data.message.includes("Invalid")) {
                    this.showInvalidToken();
                } else {
                    this.showError(data.message || "Failed to reset password");
                }
            }
        } catch (error) {
            console.error("Reset password error:", error);
            this.showError("An error occurred. Please try again later.");
        } finally {
            this.setLoading(false);
        }
    }
}

// Initialize handler
document.addEventListener("DOMContentLoaded", () => {
    new ResetPasswordHandler();

    if (typeof window.announceScreenReaderMessage === "function") {
        window.announceScreenReaderMessage("Reset password page loaded");
    }
});
