const crypto = require("crypto");

/**
 * Server-Side CAPTCHA Service
 * Generates and validates CAPTCHAs with server-side storage
 */

class CaptchaService {
    constructor() {
        // In-memory store for CAPTCHA tokens (use Redis in production for multi-instance)
        this.captchas = new Map();
        this.CAPTCHA_LENGTH = 6;
        this.CAPTCHA_EXPIRY = 5 * 60 * 1000; // 5 minutes
        this.CLEANUP_INTERVAL = 60 * 1000; // 1 minute

        // Start cleanup task
        this.startCleanupTask();
    }

    /**
     * Generate a new CAPTCHA
     * @returns {Object} - { captchaId, captchaText }
     */
    generate() {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing chars (0,O,1,I,l)
        let captchaText = "";
        for (let i = 0; i < this.CAPTCHA_LENGTH; i++) {
            captchaText += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // Generate unique ID for this CAPTCHA
        const captchaId = crypto.randomBytes(16).toString("hex");

        // Store with expiry
        this.captchas.set(captchaId, {
            text: captchaText.toUpperCase(),
            createdAt: Date.now(),
            expiresAt: Date.now() + this.CAPTCHA_EXPIRY,
            attempts: 0,
        });

        return {
            captchaId,
            captchaText, // This is sent to client for display
        };
    }

    /**
     * Validate a CAPTCHA response
     * @param {string} captchaId - The CAPTCHA ID
     * @param {string} userInput - User's answer
     * @returns {Object} - { valid: boolean, error?: string }
     */
    validate(captchaId, userInput) {
        if (!captchaId || !userInput) {
            return { valid: false, error: "CAPTCHA verification required" };
        }

        const captcha = this.captchas.get(captchaId);

        if (!captcha) {
            return { valid: false, error: "CAPTCHA expired or invalid. Please refresh." };
        }

        // Check expiry
        if (Date.now() > captcha.expiresAt) {
            this.captchas.delete(captchaId);
            return { valid: false, error: "CAPTCHA expired. Please refresh." };
        }

        // Increment attempts (max 3 attempts per CAPTCHA)
        captcha.attempts++;
        if (captcha.attempts > 3) {
            this.captchas.delete(captchaId);
            return { valid: false, error: "Too many attempts. Please get a new CAPTCHA." };
        }

        // Case-insensitive comparison
        const isValid = captcha.text.toUpperCase() === userInput.trim().toUpperCase();

        if (isValid) {
            // Delete after successful validation (one-time use)
            this.captchas.delete(captchaId);
            return { valid: true };
        }

        return { valid: false, error: "Incorrect CAPTCHA. Please try again." };
    }

    /**
     * Invalidate a CAPTCHA (e.g., after use or refresh)
     */
    invalidate(captchaId) {
        this.captchas.delete(captchaId);
    }

    /**
     * Start cleanup task to remove expired CAPTCHAs
     */
    startCleanupTask() {
        setInterval(() => {
            const now = Date.now();
            for (const [id, captcha] of this.captchas.entries()) {
                if (now > captcha.expiresAt) {
                    this.captchas.delete(id);
                }
            }
        }, this.CLEANUP_INTERVAL);
    }

    /**
     * Get stats for monitoring
     */
    getStats() {
        return {
            activeCaptchas: this.captchas.size,
        };
    }
}

// Export singleton instance
module.exports = new CaptchaService();
