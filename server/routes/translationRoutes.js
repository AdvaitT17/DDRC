/**
 * Translation Routes
 * API endpoints for language translation
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const translationService = require('../services/translationService');

// Rate limiter for translation API (100 requests per minute per IP)
const translationLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: {
        success: false,
        error: 'Too many translation requests. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * POST /api/translate
 * Translate texts to target language
 * 
 * Request body:
 * {
 *   texts: string[],      // Array of texts to translate
 *   targetLang: string    // Target language code (e.g., 'mr', 'hi')
 * }
 * 
 * Response:
 * {
 *   translations: string[],
 *   success: boolean,
 *   error?: string
 * }
 */
router.post('/', translationLimiter, async (req, res) => {
    try {
        const { texts, targetLang } = req.body;

        if (!texts || !Array.isArray(texts)) {
            return res.status(400).json({
                success: false,
                error: 'texts must be an array of strings'
            });
        }

        if (!targetLang) {
            return res.status(400).json({
                success: false,
                error: 'targetLang is required'
            });
        }

        const result = await translationService.translateBatch(texts, targetLang);
        res.json(result);

    } catch (error) {
        console.error('Translation route error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * GET /api/translate/languages
 * Get list of supported languages
 * 
 * Response:
 * {
 *   languages: Array<{code: string, name: string, nativeName: string}>,
 *   success: boolean
 * }
 */
router.get('/languages', (req, res) => {
    try {
        const languages = translationService.getSupportedLanguages();
        res.json({
            languages,
            success: true
        });
    } catch (error) {
        console.error('Languages route error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * GET /api/translate/status
 * Get translation service status and cache stats
 */
router.get('/status', (req, res) => {
    try {
        const cacheStats = translationService.getCacheStats();
        const isConfigured = !!process.env.AZURE_TRANSLATOR_KEY;

        res.json({
            configured: isConfigured,
            region: process.env.AZURE_TRANSLATOR_REGION || 'centralindia',
            cache: cacheStats,
            success: true
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

module.exports = router;
