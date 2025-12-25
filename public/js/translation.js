/**
 * Translation Utility
 * Client-side translation using Azure Translator API via backend
 */

(function () {
    'use strict';

    // Supported languages (Maharashtra focus)
    const SUPPORTED_LANGUAGES = [
        { code: 'en', name: 'English', nativeName: 'English' },
        { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
        { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
        { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
        { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
        { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' }
    ];

    // Cache key prefix
    const CACHE_PREFIX = 'translation_cache_';
    const CURRENT_LANG_KEY = 'selectedLanguage';
    const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

    // Translation state
    let isTranslating = false;
    let originalTexts = new Map(); // Store original English texts

    /**
     * Get current selected language
     */
    function getCurrentLanguage() {
        return localStorage.getItem(CURRENT_LANG_KEY) || 'en';
    }

    /**
     * Set current language
     */
    function setCurrentLanguage(langCode) {
        localStorage.setItem(CURRENT_LANG_KEY, langCode);
    }

    /**
     * Get cached translation
     */
    function getCachedTranslation(text, targetLang) {
        if (targetLang === 'en') return text;

        const cacheKey = CACHE_PREFIX + targetLang + '_' + hashString(text);
        const cached = localStorage.getItem(cacheKey);

        if (cached) {
            try {
                const data = JSON.parse(cached);
                if (Date.now() - data.timestamp < CACHE_TTL) {
                    return data.translation;
                }
                // Cache expired, remove it
                localStorage.removeItem(cacheKey);
            } catch (e) {
                localStorage.removeItem(cacheKey);
            }
        }
        return null;
    }

    /**
     * Cache translation
     */
    function cacheTranslation(text, targetLang, translation) {
        const cacheKey = CACHE_PREFIX + targetLang + '_' + hashString(text);
        try {
            localStorage.setItem(cacheKey, JSON.stringify({
                translation,
                timestamp: Date.now()
            }));
        } catch (e) {
            // localStorage full, clear old cache entries
            clearOldCache();
        }
    }

    /**
     * Simple hash function for cache keys
     */
    function hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Clear old cache entries
     */
    function clearOldCache() {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(CACHE_PREFIX)) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (Date.now() - data.timestamp > CACHE_TTL) {
                        localStorage.removeItem(key);
                    }
                } catch (e) {
                    localStorage.removeItem(key);
                }
            }
        });
    }

    /**
     * Check if text contains Devanagari script (Marathi)
     */
    function containsMarathiScript(text) {
        const devanagariPattern = /[\u0900-\u097F]/;
        return devanagariPattern.test(text);
    }


    /**
     * Extract English portion from bilingual text (e.g., "मराठी / English" -> "English")
     * Returns { marathiPart, englishPart, separator, isBilingual }
     */
    function parseBilingualText(text) {
        if (!containsMarathiScript(text)) {
            // Pure English text
            return { marathiPart: '', englishPart: text, separator: '', isBilingual: false };
        }

        // Common separators in bilingual labels
        const separators = [' / ', '/', ' - ', '-'];

        for (const sep of separators) {
            if (text.includes(sep)) {
                const parts = text.split(sep);
                if (parts.length >= 2) {
                    // Find which part is Marathi and which is English
                    let marathiPart = '';
                    let englishPart = '';

                    for (const part of parts) {
                        const trimmed = part.trim();
                        if (containsMarathiScript(trimmed)) {
                            marathiPart = (marathiPart ? marathiPart + sep : '') + trimmed;
                        } else if (trimmed.length > 0) {
                            englishPart = (englishPart ? englishPart + sep : '') + trimmed;
                        }
                    }

                    if (marathiPart && englishPart) {
                        return { marathiPart, englishPart, separator: sep, isBilingual: true };
                    }
                }
            }
        }

        // No separator found or no clear split - return as non-bilingual
        return { marathiPart: text, englishPart: '', separator: '', isBilingual: false };
    }

    /**
     * Get all translatable elements on the page
     */
    function getTranslatableElements() {
        // Select elements with data-translate attribute and common text elements
        const selectors = [
            '[data-translate]',
            'h1:not([data-no-translate])',
            'h2:not([data-no-translate])',
            'h3:not([data-no-translate])',
            'h4:not([data-no-translate])',
            'p:not([data-no-translate])',
            'span:not([data-no-translate]):not(.contrast-icon):not(.hamburger-menu span):not(.contrast-text):not(.contrast-text-short)',
            'a:not([data-no-translate])',
            'button:not([data-no-translate]):not(.contrast-toggle):not(.mobile-contrast-toggle):not(.mobile-contrast-btn):not(#contrastToggle):not(#mobileContrastToggle):not(#mobileTopContrastToggle)',
            'label:not([data-no-translate])',
            'li:not([data-no-translate])',
            'td:not([data-no-translate])',
            'th:not([data-no-translate])',
            'strong:not([data-no-translate])',
            '.important-note',
            '.hero-content h2',
            '.hero-content p',
            '.accordion-body',
            '.accordion-button',
            // Error messages and alerts
            '.error-message',
            '.invalid-feedback',
            'small.text-danger',
            '.field-error',
            '.alert',
            '.alert-danger',
            '.alert-success',
            '.alert-warning',
            '.alert-info',
            '.requirements-header',
            // Placeholder attributes
            'input[placeholder]:not([data-no-translate])',
            'textarea[placeholder]:not([data-no-translate])',
            // Select options (except language selector)
            'select:not(#languageSelector):not(.language-select) option:not([data-no-translate])'
        ];

        const elements = document.querySelectorAll(selectors.join(','));
        const textElements = [];
        const processedElements = new Set();

        elements.forEach(el => {
            // Skip language selector options only
            if (el.tagName === 'OPTION') {
                const parent = el.closest('select');
                if (parent && (parent.id === 'languageSelector' || parent.classList.contains('language-select'))) {
                    return; // Skip language selector options
                }
            }

            // Skip if already processed (avoid duplicates)
            if (processedElements.has(el)) return;

            // For OPTION elements, they have text directly
            if (el.tagName === 'OPTION') {
                if (el.textContent.trim().length > 0) {
                    textElements.push(el);
                    processedElements.add(el);
                }
                return;
            }

            // For INPUT/TEXTAREA elements with placeholder, include them (they don't have text content)
            if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.hasAttribute('placeholder')) {
                textElements.push(el);
                processedElements.add(el);
                return;
            }

            // Skip elements with only child elements (no direct text)
            const hasDirectText = Array.from(el.childNodes).some(
                node => node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0
            );

            if (hasDirectText || el.hasAttribute('data-translate')) {
                textElements.push(el);
                processedElements.add(el);
            }
        });

        return textElements;
    }

    /**
     * Extract text from element (always returns original English text if available)
     */
    function getElementText(el) {
        // If we have stored the original text, return that
        if (el.hasAttribute('data-original-text')) {
            return el.getAttribute('data-original-text');
        }

        if (el.hasAttribute('data-translate')) {
            return el.getAttribute('data-translate');
        }

        // Get direct text content only (not from children)
        let text = '';
        el.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                // Check if we have stored original for this node
                if (originalTexts.has(node)) {
                    text += originalTexts.get(node);
                } else {
                    text += node.textContent;
                }
            }
        });
        return text.trim();
    }

    /**
     * Set translated text on element
     */
    function setElementText(el, translatedText, originalText) {
        // Store original if not stored yet
        if (!el.hasAttribute('data-original-text')) {
            el.setAttribute('data-original-text', originalText);
        }

        // Check if element has child elements (not just text nodes)
        const hasChildElements = Array.from(el.childNodes).some(
            node => node.nodeType === Node.ELEMENT_NODE
        );

        if (hasChildElements) {
            // For elements with child elements (like links with icons), 
            // only replace text nodes, not child elements
            let firstTextNodeFound = false;
            el.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
                    if (!firstTextNodeFound) {
                        // Store original in map
                        if (!originalTexts.has(node)) {
                            originalTexts.set(node, node.textContent.trim());
                        }
                        node.textContent = translatedText;
                        firstTextNodeFound = true;
                    } else {
                        // Clear additional text nodes to avoid duplication
                        node.textContent = '';
                    }
                }
            });
        } else {
            // For simple text-only elements, replace entire content
            el.textContent = translatedText;
        }
    }

    /**
     * Restore original text
     */
    function restoreOriginalText(el) {
        if (el.hasAttribute('data-original-text')) {
            el.textContent = el.getAttribute('data-original-text');
        }
        // Also restore placeholder if it was translated
        if (el.hasAttribute('data-original-placeholder')) {
            el.setAttribute('placeholder', el.getAttribute('data-original-placeholder'));
        }
    }

    /**
     * Show/hide loading indicator
     */
    function showTranslationLoading(show) {
        let loader = document.getElementById('translationLoader');

        if (show) {
            if (!loader) {
                loader = document.createElement('div');
                loader.id = 'translationLoader';
                loader.innerHTML = `
          <div class="translation-loader-content">
            <div class="translation-spinner"></div>
            <span>Translating...</span>
          </div>
        `;
                loader.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        `;
                const style = document.createElement('style');
                style.textContent = `
          .translation-loader-content {
            background: white;
            padding: 20px 40px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 15px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
          }
          .translation-spinner {
            width: 24px;
            height: 24px;
            border: 3px solid #e0e0e0;
            border-top-color: #1a4480;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `;
                document.head.appendChild(style);
                document.body.appendChild(loader);
            }
            loader.style.display = 'flex';
        } else if (loader) {
            loader.style.display = 'none';
        }
    }

    /**
     * Translate a single element (used by MutationObserver)
     */
    async function translateElement(el, targetLang) {
        // Skip for English - no translation needed
        if (targetLang === 'en') return;

        // Translate text content
        const text = getElementText(el);
        if (text && text.length > 0 && text.length < 1000) {
            const parsed = parseBilingualText(text);

            if (parsed.isBilingual && parsed.englishPart) {
                // For Marathi, bilingual text already has Marathi - skip
                if (targetLang === 'mr') return;

                const cached = getCachedTranslation(parsed.englishPart, targetLang);
                if (cached) {
                    const reconstructed = parsed.marathiPart + parsed.separator + cached;
                    setElementText(el, reconstructed, text);
                } else {
                    // Need to translate - batch single element
                    try {
                        const response = await fetch('/api/translate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ texts: [parsed.englishPart], targetLang })
                        });
                        if (response.ok) {
                            const result = await response.json();
                            if (result.translations && result.translations[0]) {
                                cacheTranslation(parsed.englishPart, targetLang, result.translations[0]);
                                const reconstructed = parsed.marathiPart + parsed.separator + result.translations[0];
                                setElementText(el, reconstructed, text);
                            }
                        }
                    } catch (e) {
                        // Error translating element - fail silently
                    }
                }
            } else if (parsed.englishPart && !parsed.marathiPart) {
                // Pure English text
                const cached = getCachedTranslation(text, targetLang);
                if (cached) {
                    setElementText(el, cached, text);
                } else {
                    try {
                        const response = await fetch('/api/translate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ texts: [text], targetLang })
                        });
                        if (response.ok) {
                            const result = await response.json();
                            if (result.translations && result.translations[0]) {
                                cacheTranslation(text, targetLang, result.translations[0]);
                                setElementText(el, result.translations[0], text);
                            }
                        }
                    } catch (e) {
                        // Error translating element - fail silently
                    }
                }
            }
        }

        // Translate placeholder attribute
        if (el.hasAttribute('placeholder') && !el.hasAttribute('data-no-translate')) {
            const placeholder = el.getAttribute('data-original-placeholder') || el.getAttribute('placeholder');
            if (placeholder && placeholder.length > 0 && placeholder.length < 200) {
                if (!el.hasAttribute('data-original-placeholder')) {
                    el.setAttribute('data-original-placeholder', placeholder);
                }
                const cached = getCachedTranslation(placeholder, targetLang);
                if (cached) {
                    el.setAttribute('placeholder', cached);
                } else {
                    try {
                        const response = await fetch('/api/translate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ texts: [placeholder], targetLang })
                        });
                        if (response.ok) {
                            const result = await response.json();
                            if (result.translations && result.translations[0]) {
                                cacheTranslation(placeholder, targetLang, result.translations[0]);
                                el.setAttribute('placeholder', result.translations[0]);
                            }
                        }
                    } catch (e) { }
                }
            }
        }

    }

    /**
     * Translate page content
     * @param {string} targetLang - Target language code
     * @param {boolean} skipLoader - Skip showing the centered loader (used during init)
     */
    async function translatePage(targetLang, skipLoader = false) {
        if (isTranslating) return;

        // For English, restore original text (no translation needed)
        if (targetLang === 'en') {
            setCurrentLanguage('en');

            // Restore all elements to original text
            const elements = getTranslatableElements();
            elements.forEach(el => {
                restoreOriginalText(el);
            });

            return;
        }

        isTranslating = true;
        if (!skipLoader) {
            showTranslationLoading(true);
        }

        try {
            const elements = getTranslatableElements();

            const textsToTranslate = [];
            const elementsToUpdate = [];
            let bilingualCount = 0;

            // Collect texts that need translation
            elements.forEach(el => {
                const text = getElementText(el);
                if (text && text.length > 0 && text.length < 1000) {
                    // Parse bilingual text
                    const parsed = parseBilingualText(text);

                    if (parsed.isBilingual && parsed.englishPart) {
                        bilingualCount++;

                        // For Marathi target, restore original bilingual text (already has Marathi)
                        if (targetLang === 'mr') {
                            restoreOriginalText(el);
                            return;
                        }

                        // For bilingual text, only translate the English part
                        const cached = getCachedTranslation(parsed.englishPart, targetLang);
                        if (cached) {
                            // Reconstruct: Marathi + separator + translated English
                            const reconstructed = parsed.marathiPart + parsed.separator + cached;
                            setElementText(el, reconstructed, text);
                        } else {
                            textsToTranslate.push(parsed.englishPart);
                            elementsToUpdate.push({
                                el,
                                originalText: text,
                                isBilingual: true,
                                marathiPart: parsed.marathiPart,
                                separator: parsed.separator,
                                englishPart: parsed.englishPart
                            });
                        }
                    } else if (parsed.englishPart && !parsed.marathiPart) {
                        // Pure English text
                        const cached = getCachedTranslation(text, targetLang);
                        if (cached) {
                            setElementText(el, cached, text);
                        } else {
                            textsToTranslate.push(text);
                            elementsToUpdate.push({ el, originalText: text, isBilingual: false });
                        }
                    }
                    // Skip pure Marathi text (no English to translate)
                }
            });

            // Translate placeholder attributes (do this before checking cache to ensure it always runs)
            const placeholderElements = document.querySelectorAll('input[placeholder]:not([data-no-translate]), textarea[placeholder]:not([data-no-translate])');
            for (const el of placeholderElements) {
                const placeholder = el.getAttribute('data-original-placeholder') || el.getAttribute('placeholder');
                if (placeholder && placeholder.length > 0 && placeholder.length < 200) {
                    if (!el.hasAttribute('data-original-placeholder')) {
                        el.setAttribute('data-original-placeholder', placeholder);
                    }
                    const cached = getCachedTranslation(placeholder, targetLang);
                    if (cached) {
                        el.setAttribute('placeholder', cached);
                    } else {
                        try {
                            const response = await fetch('/api/translate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ texts: [placeholder], targetLang })
                            });
                            if (response.ok) {
                                const result = await response.json();
                                if (result.translations && result.translations[0]) {
                                    cacheTranslation(placeholder, targetLang, result.translations[0]);
                                    el.setAttribute('placeholder', result.translations[0]);
                                }
                            }
                        } catch (e) { }
                    }
                }
            }

            // If all translations were cached, we're done
            if (textsToTranslate.length === 0) {
                setCurrentLanguage(targetLang);
                showTranslationLoading(false);
                isTranslating = false;
                return;
            }

            // Batch translate uncached texts (max 100 at a time)
            const batchSize = 100;
            for (let i = 0; i < textsToTranslate.length; i += batchSize) {
                const batch = textsToTranslate.slice(i, i + batchSize);
                const batchElements = elementsToUpdate.slice(i, i + batchSize);

                try {
                    const response = await fetch('/api/translate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            texts: batch,
                            targetLang: targetLang
                        })
                    });

                    const result = await response.json();

                    if (result.success && result.translations) {
                        result.translations.forEach((translation, index) => {
                            const item = batchElements[index];

                            if (item.isBilingual) {
                                // Reconstruct bilingual text: Marathi + separator + translated English
                                const reconstructed = item.marathiPart + item.separator + translation;
                                setElementText(item.el, reconstructed, item.originalText);
                                cacheTranslation(item.englishPart, targetLang, translation);
                            } else {
                                setElementText(item.el, translation, item.originalText);
                                cacheTranslation(item.originalText, targetLang, translation);
                            }
                        });
                    }
                } catch (error) {
                    // Translation batch error - fail silently
                }
            }

            setCurrentLanguage(targetLang);

        } catch (error) {
            // Translation error - fail silently
        } finally {
            showTranslationLoading(false);
            isTranslating = false;
        }
    }

    /**
     * Initialize translation system
     */
    function initTranslation() {

        // Apply saved language on page load (if not English)
        const savedLang = getCurrentLanguage();

        if (savedLang && savedLang !== 'en') {

            // Add translation-blur class (CSS will handle the filter, avoiding conflicts with high-contrast)
            // First, inject the CSS if not already present
            if (!document.getElementById('translation-blur-style')) {
                const style = document.createElement('style');
                style.id = 'translation-blur-style';
                style.textContent = `
                    .translation-blur { filter: blur(3px) !important; transition: filter 0.2s ease; }
                    .high-contrast.translation-blur { filter: invert(100%) hue-rotate(180deg) blur(3px) !important; }
                `;
                document.head.appendChild(style);
            }
            document.body.classList.add('translation-blur');

            // Create toast loader (added after blur, so it stays crisp)
            const initialLoader = document.createElement('div');
            initialLoader.id = 'initialTranslationLoader';
            initialLoader.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: rgba(26, 68, 128, 0.95);
                padding: 12px 20px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                gap: 12px;
                z-index: 99999;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                filter: none !important;
            `;
            initialLoader.innerHTML = `
                <div style="
                    width: 20px;
                    height: 20px;
                    border: 3px solid rgba(255,255,255,0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: initSpin 0.8s linear infinite;
                "></div>
                <span style="color: white; font-family: sans-serif; font-size: 14px;">
                    Translating...
                </span>
                <style>
                    @keyframes initSpin { to { transform: rotate(360deg); } }
                </style>
            `;
            // Append to documentElement (html) instead of body to avoid blur
            document.documentElement.appendChild(initialLoader);

            // Helper to remove loader and blur class
            const removeLoader = () => {
                const loader = document.getElementById('initialTranslationLoader');
                if (loader) loader.remove();
                // Just remove the blur class - high contrast CSS will still work
                document.body.classList.remove('translation-blur');
            };

            // Call translatePage directly

            translatePage(savedLang, true).then(() => {

                removeLoader();
            }).catch(err => {
                // Translation error - fail silently
                removeLoader();
            });
        }
    }

    // MutationObserver to watch for dynamically added content
    let mutationObserver = null;
    let pendingElements = [];
    let translateTimeout = null;

    function setupMutationObserver() {
        // Always set up the observer - callback will check current language

        if (mutationObserver) {
            mutationObserver.disconnect();
        }

        mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                // Handle new elements added to DOM
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Get all translatable elements within the added node
                        const selectors = 'h1, h2, h3, h4, h5, h6, p, span, a, button, label, li, td, th, option, strong, .btn, .nav-link, .dropdown-item, .card-title, .card-text, .hero-content h2, .hero-content p, .important-note, .accordion-body, .accordion-button, .error-message, .invalid-feedback, small.text-danger, .field-error, .alert, .alert-danger, .alert-success, .alert-warning, .alert-info, .requirements-header, input[placeholder], textarea[placeholder]';
                        const elements = [];

                        // Check if node itself matches
                        if (node.matches && node.matches(selectors)) {
                            elements.push(node);
                        }

                        // Check children
                        if (node.querySelectorAll) {
                            elements.push(...node.querySelectorAll(selectors));
                        }

                        if (elements.length > 0) {
                            pendingElements.push(...elements);

                            // Debounce: wait 50ms for more elements before translating
                            clearTimeout(translateTimeout);
                            translateTimeout = setTimeout(() => {
                                const elementsToTranslate = [...pendingElements];
                                pendingElements = [];

                                // Get current language (not captured at setup time)
                                const currentLang = getCurrentLanguage();
                                if (currentLang && currentLang !== 'en') {
                                    elementsToTranslate.forEach(el => {
                                        translateElement(el, currentLang);
                                    });
                                }
                            }, 50);
                        }
                    }
                });

                // Handle text node changes in alerts (textContent = "..." adds new text node)
                if (mutation.type === 'childList' && mutation.target.classList) {
                    const target = mutation.target;
                    if (target.classList.contains('alert') ||
                        target.classList.contains('alert-danger') ||
                        target.classList.contains('alert-success') ||
                        target.classList.contains('alert-warning') ||
                        target.classList.contains('alert-info')) {
                        // Check if text nodes were added
                        let hasTextChange = false;
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                                hasTextChange = true;
                            }
                        });
                        if (hasTextChange) {
                            const currentLang = getCurrentLanguage();
                            if (currentLang && currentLang !== 'en') {
                                // Clear data-original-text to force re-translation with new text
                                target.removeAttribute('data-original-text');
                                // Small delay to let DOM settle
                                setTimeout(() => {
                                    translateElement(target, currentLang);
                                }, 10);
                            }
                        }
                    }
                }

                // Handle characterData mutations (direct text node modifications)
                if (mutation.type === 'characterData' && mutation.target.parentElement) {
                    const parent = mutation.target.parentElement;
                    if (parent.classList && (parent.classList.contains('alert') ||
                        parent.classList.contains('alert-danger') ||
                        parent.classList.contains('alert-success'))) {
                        const currentLang = getCurrentLanguage();
                        if (currentLang && currentLang !== 'en') {
                            parent.removeAttribute('data-original-text');
                            translateElement(parent, currentLang);
                        }
                    }
                }
            });
        });

        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });


    }

    // Expose to global scope
    window.TranslationManager = {
        translatePage,
        translateElement,
        getCurrentLanguage,
        setCurrentLanguage,
        getSupportedLanguages: () => SUPPORTED_LANGUAGES,
        init: initTranslation,
        setupMutationObserver
    };

    // Auto-initialize when page is fully loaded (including dynamic content)
    window.addEventListener('load', function () {

        const savedLang = getCurrentLanguage();

        // Always set up MutationObserver for dynamic content (it checks current language when translating)
        setupMutationObserver();

        if (savedLang && savedLang !== 'en') {
            initTranslation();
        }
    });

})();
