/**
 * Government Schemes - Public Page
 * Fetches schemes from API and renders with filtering and accordion
 */

let schemes = [];

// Fetch schemes from API
async function loadSchemes() {
    const container = document.getElementById('schemesList');

    try {
        // Show loading
        container.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2 text-muted">Loading schemes...</p>
            </div>
        `;

        const response = await fetch('/api/schemes');
        const data = await response.json();

        if (data.success && data.schemes) {
            // Map API response to match existing template format
            schemes = data.schemes.map(s => ({
                id: s.id,
                title: s.title,
                type: s.type,
                category: s.category,
                objective: s.objective,
                eligibleFor: s.eligible_for || [],
                conditions: s.conditions || [],
                benefits: s.benefits,
                applicationProcess: s.application_process,
                schemeCategory: s.scheme_category,
                contactOffice: s.contact_office,
                website: s.website
            }));
            renderSchemes('all');
        } else {
            throw new Error('Failed to load schemes');
        }
    } catch (error) {
        console.error('Error loading schemes:', error);
        container.innerHTML = `
            <div class="text-center py-5">
                <p class="text-danger">Failed to load schemes. Please try again later.</p>
                <button class="btn btn-outline-primary mt-2" onclick="loadSchemes()">Retry</button>
            </div>
        `;
    }
}

// Render schemes
function renderSchemes(filter = 'all') {
    const container = document.getElementById('schemesList');
    const filtered = filter === 'all' ? schemes : schemes.filter(s => s.category === filter);

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <p class="text-muted">No schemes found in this category.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(scheme => `
        <div class="scheme-card-full" data-category="${scheme.category}">
            <div class="scheme-header" onclick="toggleScheme(this)">
                <div>
                    <h3>${escapeHtml(scheme.title)}</h3>
                    <span class="scheme-type">${escapeHtml(scheme.type)}</span>
                </div>
                <button class="scheme-toggle" aria-label="Toggle details">▼</button>
            </div>
            <div class="scheme-body">
                <div class="scheme-content">
                    <div class="scheme-section">
                        <h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg> Objective</h4>
                        <p>${escapeHtml(scheme.objective)}</p>
                    </div>
                    <div class="scheme-section">
                        <h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg> Eligible Categories</h4>
                        <div class="scheme-tags">
                            ${(scheme.eligibleFor || []).map(e => `<span class="scheme-tag">${escapeHtml(e)}</span>`).join('')}
                        </div>
                    </div>
                    <div class="scheme-section">
                        <h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> Eligibility Conditions</h4>
                        <ul>${(scheme.conditions || []).map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>
                    </div>
                    <div class="scheme-section">
                        <h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> Benefits</h4>
                        <p>${escapeHtml(scheme.benefits)}</p>
                    </div>
                    <div class="scheme-section">
                        <h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> Application Process</h4>
                        <p>${escapeHtml(scheme.applicationProcess)}</p>
                    </div>
                    <div class="scheme-section">
                        <h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> Contact Office</h4>
                        <p>${escapeHtml(scheme.contactOffice)}</p>
                    </div>
                    ${scheme.website ? `
                    <div class="scheme-links">
                        <a href="${escapeHtml(scheme.website)}" target="_blank" rel="noopener" class="scheme-link">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
                            Official Website
                        </a>
                    </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

// Toggle scheme accordion
function toggleScheme(header) {
    const card = header.closest('.scheme-card-full');
    card.classList.toggle('active');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Category filter
document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderSchemes(btn.dataset.category);
    });
});

// Initial load
document.addEventListener('DOMContentLoaded', () => loadSchemes());
