class ForgotPasswordHandler {
    constructor() {
        this.form = document.getElementById("forgotPasswordForm");
        this.errorAlert = document.getElementById("forgotError");
        this.successAlert = document.getElementById("forgotSuccess");
        this.submitBtn = document.getElementById("submitBtn");
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.form.addEventListener("submit", (e) => this.handleSubmit(e));
    }

    showError(message) {
        this.successAlert.style.display = "none";
        this.errorAlert.textContent = message;
        this.errorAlert.style.display = "block";

        // Announce to screen readers
        if (typeof window.announceScreenReaderMessage === "function") {
            window.announceScreenReaderMessage(message);
        }
    }

    showSuccess(message) {
        this.errorAlert.style.display = "none";
        this.successAlert.textContent = message;
        this.successAlert.style.display = "block";

        // Announce to screen readers
        if (typeof window.announceScreenReaderMessage === "function") {
            window.announceScreenReaderMessage(message);
        }
    }

    setLoading(loading) {
        this.submitBtn.disabled = loading;
        this.submitBtn.textContent = loading ? "Sending..." : "Send Reset Link";
    }

    async handleSubmit(e) {
        e.preventDefault();

        // Clear previous messages
        this.errorAlert.style.display = "none";
        this.successAlert.style.display = "none";

        if (!this.form.checkValidity()) {
            this.form.classList.add("was-validated");
            return;
        }

        const email = this.form.email.value.trim();

        this.setLoading(true);

        try {
            const response = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok) {
                this.showSuccess(data.message);
                this.form.reset();
                this.form.classList.remove("was-validated");
            } else {
                this.showError(data.message || "Failed to process request");
            }
        } catch (error) {
            console.error("Forgot password error:", error);
            this.showError("An error occurred. Please try again later.");
        } finally {
            this.setLoading(false);
        }
    }
}

// Initialize handler
document.addEventListener("DOMContentLoaded", () => {
    new ForgotPasswordHandler();

    // Announce page load to screen readers
    if (typeof window.announceScreenReaderMessage === "function") {
        window.announceScreenReaderMessage("Forgot password page loaded");
    }
});
