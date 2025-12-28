/**
 * Scheme AI Suggestion Service - Enhanced Version
 * Uses Google Gemini API with Search Grounding for verified disability welfare schemes
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Cache for suggestions to avoid excessive API calls
let suggestionsCache = {
    data: null,
    timestamp: null,
    ttl: 24 * 60 * 60 * 1000 // 24 hours
};

// ============================================================================
// CURATED FALLBACK SCHEMES - Verified Maharashtra & Central Government schemes
// ============================================================================
const CURATED_SCHEMES = [
    {
        title: "ADIP Scheme (Assistance to Disabled Persons)",
        type: "Central Government",
        category: "financial",
        scheme_category: "Assistive Devices",
        objective: "Provide assistive devices to persons with disabilities to promote physical, social, and psychological rehabilitation.",
        eligible_for: ["All categories of disabled persons"],
        conditions: ["Indian citizen", "40% or more disability", "Monthly income up to Rs. 20,000"],
        benefits: "Free assistive devices like wheelchairs, hearing aids, crutches, artificial limbs, etc.",
        application_process: "Apply through ALIMCO authorized camps or district hospitals",
        contact_office: "ALIMCO (Artificial Limbs Manufacturing Corporation of India)",
        website: "https://www.alimco.in/ADIP.aspx",
        confidence: "HIGH"
    },
    {
        title: "Deendayal Disabled Rehabilitation Scheme (DDRS)",
        type: "Central Government",
        category: "welfare",
        scheme_category: "Rehabilitation",
        objective: "Provide financial assistance to NGOs for running rehabilitation programs for persons with disabilities.",
        eligible_for: ["All categories of disabled persons"],
        conditions: ["Services provided through registered NGOs", "Minimum 40% disability"],
        benefits: "Vocational training, special education, community-based rehabilitation services",
        application_process: "Apply through registered NGOs to the Department of Empowerment of PwD",
        contact_office: "Department of Empowerment of Persons with Disabilities, Ministry of Social Justice",
        website: "https://disabilityaffairs.gov.in/content/page/ddrs.php",
        confidence: "HIGH"
    },
    {
        title: "National Fellowship for Students with Disabilities",
        type: "Central Government",
        category: "education",
        scheme_category: "Scholarship",
        objective: "Support students with disabilities pursuing M.Phil and Ph.D. degrees.",
        eligible_for: ["All categories of disabled persons with 40%+ disability"],
        conditions: ["Must be registered for M.Phil/Ph.D.", "Family income below Rs. 6 lakh per annum"],
        benefits: "Fellowship of Rs. 25,000/month for JRF and Rs. 28,000/month for SRF plus contingency and other allowances",
        application_process: "Apply online through UGC portal",
        contact_office: "University Grants Commission (UGC)",
        website: "https://ugc.gov.in/",
        confidence: "HIGH"
    },
    {
        title: "Scholarships for Students with Disabilities (Pre-Matric & Post-Matric)",
        type: "Central Government",
        category: "education",
        scheme_category: "Scholarship",
        objective: "Encourage students with disabilities to complete their education from Class 9 to post-graduation.",
        eligible_for: ["All categories of disabled persons with 40%+ disability"],
        conditions: ["Studying in recognized institutions", "Family income below Rs. 2.5 lakh per annum"],
        benefits: "Scholarship covering tuition fees, books, and maintenance allowance",
        application_process: "Apply online through National Scholarship Portal",
        contact_office: "Department of Empowerment of Persons with Disabilities",
        website: "https://scholarships.gov.in/",
        confidence: "HIGH"
    },
    {
        title: "Unique Disability ID (UDID) Card",
        type: "Central Government",
        category: "welfare",
        scheme_category: "Identity & Services",
        objective: "Create a national database of persons with disabilities and issue unique ID cards for easy access to government benefits.",
        eligible_for: ["All categories of disabled persons"],
        conditions: ["Must have disability certificate from competent medical authority"],
        benefits: "Single document for identification and availing benefits, portability across states",
        application_process: "Apply online through UDID portal or at District Disability Rehabilitation Centres",
        contact_office: "District Disability Rehabilitation Centre (DDRC)",
        website: "https://www.swavlambancard.gov.in/",
        confidence: "HIGH"
    },
    {
        title: "Sugamya Bharat Abhiyan (Accessible India Campaign)",
        type: "Central Government",
        category: "welfare",
        scheme_category: "Accessibility",
        objective: "Make public buildings, transport, and ICT accessible to persons with disabilities.",
        eligible_for: ["All categories of disabled persons"],
        conditions: ["Government buildings and services covered under the campaign"],
        benefits: "Barrier-free access to government buildings, transport, and websites",
        application_process: "Report accessibility issues through the portal",
        contact_office: "Department of Empowerment of Persons with Disabilities",
        website: "https://disabilityaffairs.gov.in/content/page/accessible-india-campaign.php",
        confidence: "HIGH"
    },
    {
        title: "Maharashtra Divyang Swarojgar Yojana",
        type: "State Government",
        category: "employment",
        scheme_category: "Self Employment",
        objective: "Provide financial assistance to disabled persons for starting their own business or self-employment ventures.",
        eligible_for: ["All categories of disabled persons"],
        conditions: ["Resident of Maharashtra", "Minimum 40% disability", "Age 18-55 years"],
        benefits: "Loan subsidy and seed capital for self-employment",
        application_process: "Apply through District Social Welfare Office",
        contact_office: "Social Justice and Special Assistance Department, Maharashtra",
        website: "https://sjsa.maharashtra.gov.in/",
        confidence: "HIGH"
    },
    {
        title: "Sanjay Gandhi Niradhar Anudan Yojana",
        type: "State Government",
        category: "financial",
        scheme_category: "Pension",
        objective: "Provide monthly financial assistance to destitute persons including those with disabilities.",
        eligible_for: ["Persons with 40%+ disability who are destitute"],
        conditions: ["Resident of Maharashtra", "Age 18-65 years", "No regular source of income"],
        benefits: "Monthly pension of Rs. 1,000-1,500",
        application_process: "Apply at Talathi/Tahsildar office",
        contact_office: "District Collector Office / Tahsildar Office",
        website: "https://sjsa.maharashtra.gov.in/",
        confidence: "HIGH"
    },
    {
        title: "Free Travel Concession for Disabled Persons (Maharashtra ST)",
        type: "State Government",
        category: "welfare",
        scheme_category: "Transport",
        objective: "Provide free or concessional travel in state transport buses for persons with disabilities.",
        eligible_for: ["Persons with 40%+ disability and one attendant"],
        conditions: ["Valid UDID card or disability certificate", "Resident of Maharashtra"],
        benefits: "Free travel in Maharashtra State Road Transport Corporation (MSRTC) buses",
        application_process: "Show UDID card while boarding",
        contact_office: "MSRTC / District Social Welfare Office",
        website: "https://msrtc.maharashtra.gov.in/",
        confidence: "HIGH"
    },
    {
        title: "Reservation in Government Jobs for PwD",
        type: "Central Government",
        category: "employment",
        scheme_category: "Employment",
        objective: "Provide reservation in government jobs for persons with benchmark disabilities as per RPwD Act 2016.",
        eligible_for: ["Persons with 40%+ benchmark disability"],
        conditions: ["Valid disability certificate", "Meet educational and other qualifications for the post"],
        benefits: "4% reservation in government jobs (1% each for blindness, deaf, locomotor, and others)",
        application_process: "Apply through respective government job portals",
        contact_office: "Respective government department / UPSC / State PSC",
        website: "https://disabilityaffairs.gov.in/",
        confidence: "HIGH"
    }
];

/**
 * Initialize the Gemini AI client
 */
function getGeminiClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured in environment variables');
    }
    return new GoogleGenerativeAI(apiKey);
}

/**
 * Validate if a URL is a valid government website
 */
function isValidGovUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    // Accept gov.in, nic.in, and other legitimate government domains
    const govPattern = /^https?:\/\/([\w.-]+\.)?(gov\.in|nic\.in|india\.gov\.in|maharashtra\.gov\.in|alimco\.in|ugc\.gov\.in|scholarships\.gov\.in)/i;
    return govPattern.test(trimmed);
}

/**
 * Get scheme suggestions - combines AI suggestions with curated fallback
 * @param {Array} existingSchemes - Currently existing schemes in the database
 * @returns {Promise<Array>} - Array of suggested schemes
 */
async function getSchemeSuggestions(existingSchemes) {
    // Check cache first
    if (suggestionsCache.data &&
        suggestionsCache.timestamp &&
        (Date.now() - suggestionsCache.timestamp) < suggestionsCache.ttl) {
        console.log('📦 Returning cached scheme suggestions');
        return suggestionsCache.data;
    }

    const existingTitles = existingSchemes.map(s => s.title.toLowerCase());
    let allSuggestions = [];

    // Step 1: Add curated schemes that aren't already in the database
    const curatedSuggestions = CURATED_SCHEMES
        .filter(s => !existingTitles.includes(s.title.toLowerCase()))
        .map(s => ({
            ...s,
            is_ai_suggested: true,
            source: 'curated'
        }));

    allSuggestions.push(...curatedSuggestions);
    console.log(`📋 Found ${curatedSuggestions.length} curated schemes not in database`);

    // Step 2: Try to get AI suggestions with grounding
    try {
        const genAI = getGeminiClient();
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash-exp',
            // Enable grounding with Google Search for more accurate results
            tools: [{ google_search: {} }]
        });

        const prompt = `You are an expert researcher on Indian government welfare schemes for persons with disabilities.

TASK: Find 3-5 REAL, VERIFIED, and CURRENTLY ACTIVE disability welfare schemes from:
1. Central Government of India
2. Maharashtra State Government

CRITICAL REQUIREMENTS:
- ONLY suggest schemes you can VERIFY exist through official government sources
- Each scheme MUST have a working official government website URL (gov.in or nic.in domain)
- DO NOT suggest schemes already in this list: ${existingTitles.slice(0, 20).join(', ')}
- DO NOT make up or hallucinate any information
- If you cannot verify a scheme, DO NOT include it

FOCUS AREAS: Schemes for visual impairment, hearing impairment, locomotor disability, intellectual disability, cerebral palsy, autism, multiple disabilities.

For each VERIFIED scheme, provide EXACT JSON format:
{
    "title": "Official scheme name as it appears on government website",
    "type": "Central Government" OR "State Government",
    "category": "education" OR "financial" OR "employment" OR "welfare",
    "scheme_category": "Specific type like Scholarship, Pension, etc.",
    "objective": "Official objective from government website",
    "eligible_for": ["List of eligible disability types"],
    "conditions": ["Eligibility conditions from official source"],
    "benefits": "Benefits as stated officially",
    "application_process": "How to apply",
    "contact_office": "Official contact",
    "website": "MUST be a real gov.in or nic.in URL that you verified exists"
}

Return ONLY a valid JSON array. If you cannot find any verified schemes, return an empty array [].`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Parse AI response
        let aiSuggestions = [];
        try {
            let cleanText = text.trim();
            if (cleanText.startsWith('```json')) {
                cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanText.startsWith('```')) {
                cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }

            const parsed = JSON.parse(cleanText);
            if (Array.isArray(parsed)) {
                aiSuggestions = parsed;
            }
        } catch (parseError) {
            console.warn('AI response parsing failed, using curated list only');
        }

        // Filter and validate AI suggestions strictly
        const validAiSuggestions = aiSuggestions
            .filter(s => {
                // Must have required fields
                if (!s.title || !s.objective || !s.category) return false;

                // Must not be a duplicate of existing or curated
                const allExisting = [...existingTitles, ...curatedSuggestions.map(c => c.title.toLowerCase())];
                if (allExisting.includes(s.title.toLowerCase())) return false;

                // MUST have a valid government URL - this is strict now
                if (!isValidGovUrl(s.website)) return false;

                return true;
            })
            .map(s => ({
                title: s.title,
                type: s.type || 'Central Government',
                category: ['education', 'financial', 'employment', 'welfare'].includes(s.category)
                    ? s.category
                    : 'welfare',
                scheme_category: s.scheme_category || 'General Welfare',
                objective: s.objective,
                eligible_for: Array.isArray(s.eligible_for) ? s.eligible_for : ['All categories of disabled persons'],
                conditions: Array.isArray(s.conditions) ? s.conditions : [],
                benefits: s.benefits || 'Contact the concerned office for details.',
                application_process: s.application_process || 'Contact the concerned office.',
                contact_office: s.contact_office || 'Social Welfare Department',
                website: s.website.trim(),
                confidence: 'MEDIUM',
                is_ai_suggested: true,
                source: 'ai_verified'
            }));

        allSuggestions.push(...validAiSuggestions);
        console.log(`🤖 AI provided ${validAiSuggestions.length} verified suggestions`);

    } catch (aiError) {
        console.warn('AI suggestions failed, using curated list:', aiError.message);
    }

    // Update cache
    suggestionsCache.data = allSuggestions;
    suggestionsCache.timestamp = Date.now();

    console.log(`✅ Total suggestions: ${allSuggestions.length}`);
    return allSuggestions;
}

/**
 * Clear the suggestions cache (call when new schemes are added)
 */
function clearCache() {
    suggestionsCache.data = null;
    suggestionsCache.timestamp = null;
}

/**
 * Check if Gemini API is configured
 */
function isConfigured() {
    return !!process.env.GEMINI_API_KEY;
}

module.exports = {
    getSchemeSuggestions,
    clearCache,
    isConfigured
};
