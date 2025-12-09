const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { sendContactEmail, sendContactAcknowledgement } = require("../services/emailService");

// Rate limiter: max 5 contact form submissions per IP per hour
const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 requests per hour
    message: {
        success: false,
        message: "Too many contact form submissions. Please try again later.",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * POST /api/contact
 * Handle contact form submissions
 */
router.post("/", contactLimiter, async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body;

        // Validate required fields
        if (!name || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: "Please fill in all required fields (name, email, subject, message).",
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address.",
            });
        }

        // Subject mapping for display
        const subjectMap = {
            general: "General Inquiry",
            udid: "UDID Related",
            services: "Services",
            schemes: "Schemes",
            feedback: "Feedback",
            complaint: "Complaint",
        };

        const subjectDisplay = subjectMap[subject] || subject;

        const contactData = {
            name,
            email,
            phone: phone || "Not provided",
            subject: subjectDisplay,
            message,
        };

        // Send the contact email to admin
        const emailSent = await sendContactEmail(contactData);

        if (emailSent) {
            // Send acknowledgement email to the form filler (don't block on this)
            sendContactAcknowledgement(contactData).catch(err => {
                console.error("Failed to send acknowledgement email:", err);
            });

            return res.status(200).json({
                success: true,
                message: "Your message has been sent successfully. We will get back to you within 2-3 business days.",
            });
        } else {
            return res.status(500).json({
                success: false,
                message: "Failed to send your message. Please try again later or contact us directly by phone.",
            });
        }
    } catch (error) {
        console.error("Contact form error:", error);
        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
});

module.exports = router;
