/**
 * Azure Translator Service
 * Handles translation using Microsoft Azure Translator API (Free Tier - 2M chars/month)
 */

const axios = require('axios');

// Azure Translator configuration
const TRANSLATOR_KEY = process.env.AZURE_TRANSLATOR_KEY;
const TRANSLATOR_REGION = process.env.AZURE_TRANSLATOR_REGION || 'centralindia';
const TRANSLATOR_ENDPOINT = 'https://api.cognitive.microsofttranslator.com';

// Supported languages for Maharashtra
const SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
    { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
    { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
    { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' }
];

// In-memory cache for translations (reduces API calls)
const translationCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get cache key for translation
 */
function getCacheKey(text, targetLang) {
    return `${targetLang}:${text}`;
}

/**
 * Get cached translation if available and not expired
 */
function getCachedTranslation(text, targetLang) {
    const key = getCacheKey(text, targetLang);
    const cached = translationCache.get(key);

    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return cached.translation;
    }

    return null;
}

/**
 * Store translation in cache
 */
function cacheTranslation(text, targetLang, translation) {
    const key = getCacheKey(text, targetLang);
    translationCache.set(key, {
        translation,
        timestamp: Date.now()
    });
}

/**
 * Translate an array of texts to target language
 * @param {string[]} texts - Array of texts to translate
 * @param {string} targetLang - Target language code (e.g., 'mr', 'hi')
 * @returns {Promise<{translations: string[], success: boolean, error?: string}>}
 */
async function translateBatch(texts, targetLang) {
    // Validate inputs
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
        return { translations: [], success: false, error: 'No texts provided' };
    }

    if (!targetLang || targetLang === 'en') {
        // Return original texts for English
        return { translations: texts, success: true };
    }

    // Check if target language is supported
    const isSupported = SUPPORTED_LANGUAGES.some(lang => lang.code === targetLang);
    if (!isSupported) {
        return { translations: texts, success: false, error: 'Unsupported language' };
    }

    // Check API key
    if (!TRANSLATOR_KEY) {
        console.error('Azure Translator API key not configured');
        return { translations: texts, success: false, error: 'Translation service not configured' };
    }

    try {
        // Check cache first
        const translations = [];
        const uncachedTexts = [];
        const uncachedIndices = [];

        for (let i = 0; i < texts.length; i++) {
            const cached = getCachedTranslation(texts[i], targetLang);
            if (cached) {
                translations[i] = cached;
            } else {
                uncachedTexts.push(texts[i]);
                uncachedIndices.push(i);
            }
        }

        // If all translations are cached, return immediately
        if (uncachedTexts.length === 0) {
            return { translations, success: true, fromCache: true };
        }

        // Prepare request body
        const body = uncachedTexts.map(text => ({ text }));

        // Make API request
        const response = await axios({
            method: 'POST',
            url: `${TRANSLATOR_ENDPOINT}/translate`,
            params: {
                'api-version': '3.0',
                'from': 'en',
                'to': targetLang
            },
            headers: {
                'Ocp-Apim-Subscription-Key': TRANSLATOR_KEY,
                'Ocp-Apim-Subscription-Region': TRANSLATOR_REGION,
                'Content-Type': 'application/json'
            },
            data: body
        });

        // Extract translations and cache them
        for (let i = 0; i < response.data.length; i++) {
            const translatedText = response.data[i].translations[0].text;
            const originalIndex = uncachedIndices[i];
            translations[originalIndex] = translatedText;

            // Cache the translation
            cacheTranslation(uncachedTexts[i], targetLang, translatedText);
        }

        return { translations, success: true };

    } catch (error) {
        console.error('Translation API error:', error.response?.data || error.message);

        // Return original texts on error
        return {
            translations: texts,
            success: false,
            error: error.response?.data?.error?.message || 'Translation failed'
        };
    }
}

/**
 * Translate a single text to target language
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code
 * @returns {Promise<{translation: string, success: boolean, error?: string}>}
 */
async function translateText(text, targetLang) {
    const result = await translateBatch([text], targetLang);
    return {
        translation: result.translations[0] || text,
        success: result.success,
        error: result.error
    };
}

/**
 * Get list of supported languages
 * @returns {Array} List of supported languages
 */
function getSupportedLanguages() {
    return SUPPORTED_LANGUAGES;
}

/**
 * Clear the translation cache
 */
function clearCache() {
    translationCache.clear();
}

/**
 * Get cache statistics
 */
function getCacheStats() {
    return {
        size: translationCache.size,
        maxTTL: CACHE_TTL
    };
}

module.exports = {
    translateText,
    translateBatch,
    getSupportedLanguages,
    clearCache,
    getCacheStats
};
