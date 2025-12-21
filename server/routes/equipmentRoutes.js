const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { authenticateToken } = require("../middleware/authMiddleware");
const {
    requireCompletedRegistration,
} = require("../middleware/registrationMiddleware");

// Equipment types matching form_fields #35
const EQUIPMENT_TYPES = [
    "सायकल / Cycle",
    "कुबडया / Health Crutches",
    "जयपूर फूट / Jaipur Foot",
    "श्रवणयंत्र / Hearing aid",
    "अंधकाठी / Blind Stick",
    "शस्त्रक्रिया / Operation",
    "उत्पादक वस्तू / Production Equipment",
];

// Apply authentication and registration check middleware to all equipment routes
router.use(authenticateToken);
router.use(requireCompletedRegistration);

// Get available equipment types
router.get("/types", (req, res) => {
    res.json({ types: EQUIPMENT_TYPES });
});

// Get user's equipment requests (including from registration + follow-ups)
router.get("/my-requests", async (req, res) => {
    try {
        // First, get equipment from the original registration (form field disability_eqreq)
        const [registrationEquipment] = await pool.query(
            `SELECT 
        rr.value as equipment_type,
        rp.completed_at as requested_at,
        'registration' as source,
        rp.id as registration_id
       FROM registration_responses rr
       JOIN form_fields ff ON rr.field_id = ff.id
       JOIN registration_progress rp ON rr.registration_id = rp.id
       WHERE rp.user_id = ? 
         AND ff.name = 'disability_eqreq'
         AND rp.status = 'completed'`,
            [req.user.id]
        );

        // Check if user requested equipment in registration (require_equipment = yes)
        const [requireEquipment] = await pool.query(
            `SELECT rr.value
       FROM registration_responses rr
       JOIN form_fields ff ON rr.field_id = ff.id
       JOIN registration_progress rp ON rr.registration_id = rp.id
       WHERE rp.user_id = ? 
         AND ff.name = 'require_equipment'
         AND rp.status = 'completed'`,
            [req.user.id]
        );



        // Get follow-up equipment requests from equipment_requests table
        const [followUpRequests] = await pool.query(
            `SELECT 
        id,
        equipment_type,
        equipment_details,
        status,
        requested_at,
        fulfilled_at,
        admin_notes,
        registration_id,
        source
       FROM equipment_requests
       WHERE user_id = ?
       ORDER BY requested_at DESC`,
            [req.user.id]
        );



        // Format registration equipment (if user said yes to require_equipment)
        let registrationRequests = [];
        // Check if value exists and indicates yes (handling "होय/Yes", "Yes", "yes", "true", "1")
        const reqValue = requireEquipment.length > 0 ? String(requireEquipment[0].value).toLowerCase() : "";
        const isRequired = reqValue.includes("yes") || reqValue.includes("check") || reqValue === "true" || reqValue === "1" || reqValue.includes("होय");

        if (isRequired) {
            registrationRequests = registrationEquipment.filter(eq => {
                // Deduplicate: Check if this registration ID AND equipment type is already in followUpRequests
                // Only hide if BOTH registration_id and equipment_type match
                const isDuplicate = followUpRequests.some(fr =>
                    fr.registration_id &&
                    fr.registration_id == eq.registration_id &&
                    fr.equipment_type &&
                    String(fr.equipment_type).toLowerCase() === String(eq.equipment_type).toLowerCase()
                );
                return !isDuplicate;
            }).map((eq) => ({
                id: `reg-${eq.registration_id}`,
                equipment_type: eq.equipment_type,
                status: "pending", // Default status for registration requests
                requested_at: eq.requested_at,
                source: "registration",
            }));
        } else {

        }

        res.json({
            registrationRequests,
            followUpRequests,
            allRequests: [...registrationRequests, ...followUpRequests],
        });
    } catch (error) {
        console.error("Error fetching equipment requests:", error);
        res.status(500).json({ message: "Error fetching equipment requests" });
    }
});

// Submit new equipment request (follow-up)
router.post("/request", async (req, res) => {
    try {
        const { equipment_type, equipment_details } = req.body;

        // Validate equipment type
        if (!equipment_type || !EQUIPMENT_TYPES.includes(equipment_type)) {
            return res.status(400).json({
                message: "Invalid equipment type",
                validTypes: EQUIPMENT_TYPES,
            });
        }

        // Get user's registration ID
        const [registration] = await pool.query(
            `SELECT id FROM registration_progress 
       WHERE user_id = ? AND status = 'completed' 
       ORDER BY completed_at DESC LIMIT 1`,
            [req.user.id]
        );

        const registrationId = registration.length > 0 ? registration[0].id : null;

        // Insert new equipment request
        const [result] = await pool.query(
            `INSERT INTO equipment_requests 
       (user_id, registration_id, equipment_type, equipment_details, status)
       VALUES (?, ?, ?, ?, 'pending')`,
            [req.user.id, registrationId, equipment_type, equipment_details || null]
        );

        res.status(201).json({
            message: "Equipment request submitted successfully",
            requestId: result.insertId,
            equipment_type,
            status: "pending",
        });
    } catch (error) {
        console.error("Error submitting equipment request:", error);
        res.status(500).json({ message: "Error submitting equipment request" });
    }
});

module.exports = router;
