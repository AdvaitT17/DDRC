const crypto = require("crypto");

/**
 * Token Fingerprint Utility
 * Creates a fingerprint based on request characteristics to bind tokens to specific clients
 */

/**
 * Generate a fingerprint hash from request data
 * @param {Object} req - Express request object
 * @returns {string} - SHA256 hash of fingerprint data
 */
function generateFingerprint(req) {
    const components = [
        req.headers["user-agent"] || "unknown",
        req.headers["accept-language"] || "unknown",
        // Don't include full IP (can change with mobile networks), use first 2 octets for subnet
        getSubnet(req.ip || req.connection?.remoteAddress || "0.0.0.0"),
    ];

    const fingerprintString = components.join("|");
    return crypto.createHash("sha256").update(fingerprintString).digest("hex").substring(0, 16);
}

/**
 * Get subnet from IP (first 2 octets for IPv4, first 4 groups for IPv6)
 * This allows the same user on slightly different IPs (e.g., mobile network changes)
 */
function getSubnet(ip) {
    if (!ip) return "unknown";

    // Handle IPv4-mapped IPv6 addresses
    if (ip.includes("::ffff:")) {
        ip = ip.replace("::ffff:", "");
    }

    // IPv4
    if (ip.includes(".")) {
        const parts = ip.split(".");
        return `${parts[0]}.${parts[1]}`;
    }

    // IPv6
    if (ip.includes(":")) {
        const parts = ip.split(":");
        return parts.slice(0, 4).join(":");
    }

    return ip;
}

/**
 * Validate fingerprint from token against current request
 * @param {string} tokenFingerprint - Fingerprint stored in JWT
 * @param {Object} req - Current Express request object
 * @returns {boolean} - Whether fingerprint matches
 */
function validateFingerprint(tokenFingerprint, req) {
    if (!tokenFingerprint) {
        // Legacy tokens without fingerprint - allow but log
        console.warn("⚠️ Token without fingerprint detected - allowing for backward compatibility");
        return true;
    }

    const currentFingerprint = generateFingerprint(req);
    const isValid = tokenFingerprint === currentFingerprint;

    if (!isValid) {
        console.warn(`🚨 Token fingerprint mismatch! Token: ${tokenFingerprint}, Current: ${currentFingerprint}`);
    }

    return isValid;
}

module.exports = {
    generateFingerprint,
    validateFingerprint,
};
