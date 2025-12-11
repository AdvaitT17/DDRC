/**
 * Input Sanitization Utility
 * Prevents Stored XSS attacks by sanitizing user input
 */

const xss = require("xss");

// Custom XSS options - strict by default
const strictOptions = {
    whiteList: {}, // No HTML tags allowed
    stripIgnoreTag: true, // Strip all HTML
    stripIgnoreTagBody: ["script", "style"], // Remove script/style completely
};

// Less strict options for rich text (if needed in future)
const richTextOptions = {
    whiteList: {
        p: [],
        br: [],
        strong: [],
        em: [],
        ul: [],
        ol: [],
        li: [],
        a: ["href", "title", "target"],
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ["script", "style", "iframe", "object", "embed"],
};

/**
 * Sanitize a string to prevent XSS
 * @param {string} input - The input string to sanitize
 * @param {boolean} allowBasicHtml - Whether to allow basic HTML formatting
 * @returns {string} - Sanitized string
 */
function sanitize(input, allowBasicHtml = false) {
    if (input === null || input === undefined) {
        return input;
    }

    if (typeof input !== "string") {
        return input;
    }

    const options = allowBasicHtml ? richTextOptions : strictOptions;
    return xss(input, options);
}

/**
 * Sanitize all string properties in an object
 * @param {Object} obj - Object with properties to sanitize
 * @param {Array} fieldsToSanitize - Specific fields to sanitize (if empty, sanitizes all strings)
 * @returns {Object} - Object with sanitized properties
 */
function sanitizeObject(obj, fieldsToSanitize = []) {
    if (!obj || typeof obj !== "object") {
        return obj;
    }

    const sanitized = { ...obj };

    for (const key of Object.keys(sanitized)) {
        if (typeof sanitized[key] === "string") {
            // If specific fields are listed, only sanitize those
            if (fieldsToSanitize.length === 0 || fieldsToSanitize.includes(key)) {
                sanitized[key] = sanitize(sanitized[key]);
            }
        }
    }

    return sanitized;
}

/**
 * Express middleware to sanitize request body
 * @param {Array} fieldsToSanitize - Specific fields to sanitize (if empty, sanitizes all)
 */
function sanitizeMiddleware(fieldsToSanitize = []) {
    return (req, res, next) => {
        if (req.body && typeof req.body === "object") {
            req.body = sanitizeObject(req.body, fieldsToSanitize);
        }
        next();
    };
}

module.exports = {
    sanitize,
    sanitizeObject,
    sanitizeMiddleware,
};
