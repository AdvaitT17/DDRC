/**
 * Scheme Routes - CRUD operations for disability welfare schemes
 * Following same patterns as news.js for consistency
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const { sanitize } = require('../utils/sanitize');
const schemeAiService = require('../services/schemeAiService');

// Admin check middleware (same pattern as news.js)
const isAdmin = (req, res, next) => {
    if (req.user.type !== 'department') {
        return res.status(403).json({ success: false, message: 'Access denied' });
    }
    next();
};

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

/**
 * GET /api/schemes - Get all active schemes (public)
 */
router.get('/', async (req, res) => {
    try {
        const [schemes] = await pool.query(
            `SELECT id, title, type, category, scheme_category, objective, 
                    eligible_for, conditions, benefits, application_process, 
                    contact_office, website 
             FROM schemes 
             WHERE is_active = TRUE 
             ORDER BY category, title`
        );

        // Parse JSON fields
        const parsedSchemes = schemes.map(scheme => ({
            ...scheme,
            eligible_for: typeof scheme.eligible_for === 'string'
                ? JSON.parse(scheme.eligible_for)
                : scheme.eligible_for,
            conditions: typeof scheme.conditions === 'string'
                ? JSON.parse(scheme.conditions)
                : scheme.conditions
        }));

        res.json({ success: true, schemes: parsedSchemes });
    } catch (error) {
        console.error('Error fetching schemes:', error);
        res.status(500).json({ success: false, message: 'Error fetching schemes' });
    }
});

// ============================================================================
// PROTECTED ROUTES (Admin only)
// ============================================================================

// Apply authentication middleware to all routes below
router.use(authenticateToken);
router.use(isAdmin);

/**
 * GET /api/schemes/all - Get all schemes including inactive (admin only)
 */
router.get('/all', async (req, res) => {
    try {
        const [schemes] = await pool.query(
            `SELECT id, title, type, category, scheme_category, objective, 
                    eligible_for, conditions, benefits, application_process, 
                    contact_office, website, is_active, is_ai_suggested, 
                    created_at, updated_at 
             FROM schemes 
             ORDER BY created_at DESC`
        );

        const parsedSchemes = schemes.map(scheme => ({
            ...scheme,
            eligible_for: typeof scheme.eligible_for === 'string'
                ? JSON.parse(scheme.eligible_for)
                : scheme.eligible_for,
            conditions: typeof scheme.conditions === 'string'
                ? JSON.parse(scheme.conditions)
                : scheme.conditions
        }));

        res.json({ success: true, schemes: parsedSchemes });
    } catch (error) {
        console.error('Error fetching all schemes:', error);
        res.status(500).json({ success: false, message: 'Error fetching schemes' });
    }
});

/**
 * GET /api/schemes/suggestions - Get AI-suggested schemes (admin only)
 */
router.get('/suggestions', async (req, res) => {
    try {
        // Check if AI service is configured
        if (!schemeAiService.isConfigured()) {
            return res.status(503).json({
                success: false,
                message: 'AI suggestions are not available. GEMINI_API_KEY is not configured.'
            });
        }

        // Get existing schemes for deduplication
        const [existingSchemes] = await pool.query('SELECT title FROM schemes');

        // Get suggestions
        const suggestions = await schemeAiService.getSchemeSuggestions(existingSchemes);

        res.json({ success: true, suggestions });
    } catch (error) {
        console.error('Error getting AI suggestions:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching AI suggestions'
        });
    }
});

/**
 * GET /api/schemes/:id - Get single scheme (admin only)
 */
router.get('/:id', async (req, res) => {
    try {
        const [schemes] = await pool.query(
            'SELECT * FROM schemes WHERE id = ?',
            [req.params.id]
        );

        if (schemes.length === 0) {
            return res.status(404).json({ success: false, message: 'Scheme not found' });
        }

        const scheme = schemes[0];
        scheme.eligible_for = typeof scheme.eligible_for === 'string'
            ? JSON.parse(scheme.eligible_for)
            : scheme.eligible_for;
        scheme.conditions = typeof scheme.conditions === 'string'
            ? JSON.parse(scheme.conditions)
            : scheme.conditions;

        res.json({ success: true, scheme });
    } catch (error) {
        console.error('Error fetching scheme:', error);
        res.status(500).json({ success: false, message: 'Error fetching scheme' });
    }
});

/**
 * POST /api/schemes - Create new scheme (admin only)
 */
router.post('/', async (req, res) => {
    try {
        const {
            title, type, category, scheme_category, objective,
            eligible_for, conditions, benefits, application_process,
            contact_office, website, is_ai_suggested
        } = req.body;

        // Validate required fields
        if (!title || !objective || !category) {
            return res.status(400).json({
                success: false,
                message: 'Title, objective, and category are required'
            });
        }

        // Validate category
        const validCategories = ['education', 'financial', 'employment', 'welfare'];
        if (!validCategories.includes(category)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid category. Must be: education, financial, employment, or welfare'
            });
        }

        // Sanitize text inputs
        const sanitizedTitle = sanitize(title);
        const sanitizedObjective = sanitize(objective);
        const sanitizedBenefits = sanitize(benefits || '');
        const sanitizedProcess = sanitize(application_process || '');
        const sanitizedContact = sanitize(contact_office || '');

        // Insert scheme
        const [result] = await pool.query(
            `INSERT INTO schemes (
                title, type, category, scheme_category, objective,
                eligible_for, conditions, benefits, application_process,
                contact_office, website, is_active, is_ai_suggested, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?)`,
            [
                sanitizedTitle,
                type || 'State Government',
                category,
                sanitize(scheme_category || ''),
                sanitizedObjective,
                JSON.stringify(eligible_for || []),
                JSON.stringify(conditions || []),
                sanitizedBenefits,
                sanitizedProcess,
                sanitizedContact,
                website || '',
                is_ai_suggested || false,
                req.user.id
            ]
        );

        // Clear AI suggestions cache since we added a new scheme
        schemeAiService.clearCache();

        res.status(201).json({
            success: true,
            message: 'Scheme created successfully',
            schemeId: result.insertId
        });
    } catch (error) {
        console.error('Error creating scheme:', error);
        res.status(500).json({ success: false, message: 'Error creating scheme' });
    }
});

/**
 * PUT /api/schemes/:id - Update scheme (admin only)
 */
router.put('/:id', async (req, res) => {
    try {
        const schemeId = req.params.id;
        const {
            title, type, category, scheme_category, objective,
            eligible_for, conditions, benefits, application_process,
            contact_office, website, is_active
        } = req.body;

        // Check if scheme exists
        const [existing] = await pool.query('SELECT id FROM schemes WHERE id = ?', [schemeId]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Scheme not found' });
        }

        // Validate required fields
        if (!title || !objective || !category) {
            return res.status(400).json({
                success: false,
                message: 'Title, objective, and category are required'
            });
        }

        // Validate category
        const validCategories = ['education', 'financial', 'employment', 'welfare'];
        if (!validCategories.includes(category)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid category. Must be: education, financial, employment, or welfare'
            });
        }

        // Sanitize inputs
        const sanitizedTitle = sanitize(title);
        const sanitizedObjective = sanitize(objective);
        const sanitizedBenefits = sanitize(benefits || '');
        const sanitizedProcess = sanitize(application_process || '');
        const sanitizedContact = sanitize(contact_office || '');

        await pool.query(
            `UPDATE schemes SET
                title = ?, type = ?, category = ?, scheme_category = ?,
                objective = ?, eligible_for = ?, conditions = ?,
                benefits = ?, application_process = ?, contact_office = ?,
                website = ?, is_active = ?
             WHERE id = ?`,
            [
                sanitizedTitle,
                type || 'State Government',
                category,
                sanitize(scheme_category || ''),
                sanitizedObjective,
                JSON.stringify(eligible_for || []),
                JSON.stringify(conditions || []),
                sanitizedBenefits,
                sanitizedProcess,
                sanitizedContact,
                website || '',
                is_active !== false,
                schemeId
            ]
        );

        // Clear AI suggestions cache
        schemeAiService.clearCache();

        res.json({ success: true, message: 'Scheme updated successfully' });
    } catch (error) {
        console.error('Error updating scheme:', error);
        res.status(500).json({ success: false, message: 'Error updating scheme' });
    }
});

/**
 * PATCH /api/schemes/:id/toggle - Toggle scheme active status (admin only)
 */
router.patch('/:id/toggle', async (req, res) => {
    try {
        const schemeId = req.params.id;

        // Check if scheme exists and get current status
        const [existing] = await pool.query('SELECT id, is_active FROM schemes WHERE id = ?', [schemeId]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Scheme not found' });
        }

        const newStatus = !existing[0].is_active;
        await pool.query('UPDATE schemes SET is_active = ? WHERE id = ?', [newStatus, schemeId]);

        res.json({
            success: true,
            message: `Scheme ${newStatus ? 'activated' : 'deactivated'} successfully`,
            is_active: newStatus
        });
    } catch (error) {
        console.error('Error toggling scheme status:', error);
        res.status(500).json({ success: false, message: 'Error updating scheme status' });
    }
});

/**
 * DELETE /api/schemes/:id - Delete scheme (admin only)
 */
router.delete('/:id', async (req, res) => {
    try {
        const schemeId = req.params.id;

        // Check if scheme exists
        const [existing] = await pool.query('SELECT id FROM schemes WHERE id = ?', [schemeId]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Scheme not found' });
        }

        await pool.query('DELETE FROM schemes WHERE id = ?', [schemeId]);

        // Clear AI suggestions cache
        schemeAiService.clearCache();

        res.json({ success: true, message: 'Scheme deleted successfully' });
    } catch (error) {
        console.error('Error deleting scheme:', error);
        res.status(500).json({ success: false, message: 'Error deleting scheme' });
    }
});

/**
 * POST /api/schemes/suggestion/add - Add an AI suggestion as a scheme (admin only)
 */
router.post('/suggestion/add', async (req, res) => {
    try {
        const suggestion = req.body;

        // Validate required fields
        if (!suggestion.title || !suggestion.objective || !suggestion.category) {
            return res.status(400).json({
                success: false,
                message: 'Invalid suggestion data'
            });
        }

        // Check if scheme with same title already exists
        const [existing] = await pool.query(
            'SELECT id FROM schemes WHERE LOWER(title) = LOWER(?)',
            [suggestion.title]
        );
        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'A scheme with this title already exists'
            });
        }

        // Add the suggestion as a new scheme
        const [result] = await pool.query(
            `INSERT INTO schemes (
                title, type, category, scheme_category, objective,
                eligible_for, conditions, benefits, application_process,
                contact_office, website, is_active, is_ai_suggested, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, TRUE, ?)`,
            [
                sanitize(suggestion.title),
                suggestion.type || 'Central Government',
                suggestion.category,
                sanitize(suggestion.scheme_category || ''),
                sanitize(suggestion.objective),
                JSON.stringify(suggestion.eligible_for || []),
                JSON.stringify(suggestion.conditions || []),
                sanitize(suggestion.benefits || ''),
                sanitize(suggestion.application_process || ''),
                sanitize(suggestion.contact_office || ''),
                suggestion.website || '',
                req.user.id
            ]
        );

        // Clear cache
        schemeAiService.clearCache();

        res.status(201).json({
            success: true,
            message: 'Suggestion added as scheme successfully',
            schemeId: result.insertId
        });
    } catch (error) {
        console.error('Error adding suggestion:', error);
        res.status(500).json({ success: false, message: 'Error adding suggestion as scheme' });
    }
});

module.exports = router;
