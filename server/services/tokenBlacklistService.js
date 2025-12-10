/**
 * Token Blacklist Service
 * Stores revoked/logged-out tokens until they expire
 * Uses in-memory storage (use Redis in production for multi-instance)
 */

class TokenBlacklistService {
    constructor() {
        // Map of token hash -> expiry timestamp
        this.blacklist = new Map();
        this.CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

        // Start cleanup task
        this.startCleanupTask();
    }

    /**
     * Add a token to the blacklist
     * @param {string} token - JWT token to blacklist
     * @param {number} expiresAt - Token expiry timestamp (from JWT exp claim)
     */
    add(token, expiresAt) {
        if (!token) return;

        // Use hash of token to save memory (we don't need the full token)
        const tokenHash = this.hashToken(token);

        // Store until token would naturally expire
        this.blacklist.set(tokenHash, expiresAt);

        console.log(`🚫 Token blacklisted (hash: ${tokenHash.substring(0, 8)}...). Active blacklist size: ${this.blacklist.size}`);
    }

    /**
     * Check if a token is blacklisted
     * @param {string} token - JWT token to check
     * @returns {boolean} - true if blacklisted
     */
    isBlacklisted(token) {
        if (!token) return false;

        const tokenHash = this.hashToken(token);
        return this.blacklist.has(tokenHash);
    }

    /**
     * Hash token for storage (saves memory, adds security)
     */
    hashToken(token) {
        const crypto = require("crypto");
        return crypto.createHash("sha256").update(token).digest("hex");
    }

    /**
     * Start cleanup task to remove expired tokens from blacklist
     */
    startCleanupTask() {
        setInterval(() => {
            const now = Date.now();
            let cleaned = 0;

            for (const [hash, expiresAt] of this.blacklist.entries()) {
                // Token has naturally expired, no need to keep in blacklist
                if (now > expiresAt * 1000) { // JWT exp is in seconds
                    this.blacklist.delete(hash);
                    cleaned++;
                }
            }

            if (cleaned > 0) {
                console.log(`🧹 Cleaned ${cleaned} expired tokens from blacklist. Remaining: ${this.blacklist.size}`);
            }
        }, this.CLEANUP_INTERVAL);
    }

    /**
     * Get blacklist stats for monitoring
     */
    getStats() {
        return {
            blacklistedTokens: this.blacklist.size,
        };
    }

    /**
     * Clear all blacklisted tokens (admin function)
     */
    clear() {
        const size = this.blacklist.size;
        this.blacklist.clear();
        console.log(`🗑️ Cleared ${size} tokens from blacklist`);
        return size;
    }
}

// Export singleton instance
module.exports = new TokenBlacklistService();
