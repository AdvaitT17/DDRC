/**
 * Admin Schemes Management JavaScript
 * Handles CRUD operations and AI suggestions for schemes
 */

// Global variables
let schemeModal;
let aiSuggestionsModal;
let deleteConfirmModal;
let currentSchemeId = null;
let allSchemes = [];
let currentFilter = 'all';

// Tag arrays for the form
let eligibleForTags = [];
let conditionsTags = [];

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    if (!(await AuthManager.verifyAuth())) {
        window.location.href = '/department-login';
        return;
    }

    // Show main content
    document.getElementById('authLoader').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';

    // Set user info
    const userInfo = AuthManager.getUserInfo();
    if (userInfo) {
        document.getElementById('userInfo').textContent = `Welcome, ${userInfo.username}`;
    }

    // Initialize Bootstrap modals
    schemeModal = new bootstrap.Modal(document.getElementById('schemeModal'));
    aiSuggestionsModal = new bootstrap.Modal(document.getElementById('aiSuggestionsModal'));
    deleteConfirmModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));

    // Set up event listeners
    setupEventListeners();

    // Load schemes
    await loadSchemes();
});

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
    // Add scheme button
    document.getElementById('addSchemeBtn').addEventListener('click', () => {
        resetSchemeForm();
        document.getElementById('schemeModalLabel').textContent = 'Add Scheme';
        schemeModal.show();
    });

    // Save scheme button
    document.getElementById('saveSchemeBtn').addEventListener('click', handleSaveScheme);

    // AI suggestions button
    document.getElementById('aiSuggestionsBtn').addEventListener('click', loadAiSuggestions);

    // Confirm delete button
    document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
        if (currentSchemeId) {
            await deleteScheme(currentSchemeId);
            deleteConfirmModal.hide();
        }
    });

    // Category filter buttons
    document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderSchemes();
        });
    });

    // Tag input handlers
    setupTagInput('eligibleForInput', 'eligibleForContainer', eligibleForTags, 'eligibleFor');
    setupTagInput('conditionsInput', 'conditionsContainer', conditionsTags, 'conditions');

    // Reset form when modal is closed
    document.getElementById('schemeModal').addEventListener('hidden.bs.modal', resetSchemeForm);
}

// ============================================================================
// TAG INPUT HANDLING
// ============================================================================

function setupTagInput(inputId, containerId, tagsArray, hiddenInputId) {
    const input = document.getElementById(inputId);
    const container = document.getElementById(containerId);

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const value = input.value.trim();
            if (value && !tagsArray.includes(value)) {
                tagsArray.push(value);
                renderTags(containerId, tagsArray, hiddenInputId);
            }
            input.value = '';
        }
    });

    container.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove')) {
            const index = parseInt(e.target.dataset.index);
            tagsArray.splice(index, 1);
            renderTags(containerId, tagsArray, hiddenInputId);
        }
    });
}

function renderTags(containerId, tagsArray, hiddenInputId) {
    const container = document.getElementById(containerId);
    const input = container.querySelector('.tags-input');

    // Remove existing tags
    container.querySelectorAll('.tag').forEach(t => t.remove());

    // Add new tags
    tagsArray.forEach((tag, index) => {
        const tagEl = document.createElement('span');
        tagEl.className = 'tag';
        tagEl.innerHTML = `${escapeHtml(tag)} <span class="remove" data-index="${index}">×</span>`;
        container.insertBefore(tagEl, input);
    });

    // Update hidden input
    document.getElementById(hiddenInputId).value = JSON.stringify(tagsArray);
}

// ============================================================================
// LOAD SCHEMES
// ============================================================================

async function loadSchemes() {
    try {
        const token = AuthManager.getAuthToken();
        const response = await fetch('/api/schemes/all', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                window.location.href = '/department-login';
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.success) {
            allSchemes = data.schemes || [];
            renderSchemes();
        } else {
            throw new Error(data.message || 'Failed to load schemes');
        }
    } catch (error) {
        console.error('Error loading schemes:', error);
        showAlert('Error loading schemes', 'danger');
        document.getElementById('schemesTableBody').innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4">
                    <p class="mb-0 text-danger">Failed to load schemes</p>
                    <button class="btn btn-sm btn-outline-primary mt-2" onclick="loadSchemes()">Try Again</button>
                </td>
            </tr>
        `;
    }
}

function renderSchemes() {
    const tbody = document.getElementById('schemesTableBody');
    // Clear both desktop and mobile containers
    tbody.innerHTML = '';
    const mobileContainer = document.getElementById('mobileSchemesContainer');
    if (mobileContainer) mobileContainer.innerHTML = '';

    const filteredSchemes = currentFilter === 'all'
        ? allSchemes
        : allSchemes.filter(s => s.category === currentFilter);

    if (filteredSchemes.length === 0) {
        const emptyState = `
            <tr>
                <td colspan="5" class="text-center py-4">
                    <p class="mb-0 text-muted">No schemes found</p>
                </td>
            </tr>
        `;
        tbody.innerHTML = emptyState;
        if (mobileContainer) {
            mobileContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="#cbd5e1" class="bi bi-inbox" viewBox="0 0 16 16">
                            <path d="M4.98 4a.5.5 0 0 0-.39.188L1.54 8H6a.5.5 0 0 1 .5.5 2.5 2.5 0 1 0 5 0 .5.5 0 0 1 .5-.5h4.46l-3.05-3.812A.5.5 0 0 0 11.02 4H4.98zm-1.17-.437 2.4-3A.5.5 0 0 1 6.82 0h2.36a.5.5 0 0 1 .39.188l2.4 3H5.98l-2.17-.437z"/>
                            <path d="M9.98 11.23a.5.5 0 0 0-.96 0A1.5 1.5 0 0 1 8 12.5a1.5 1.5 0 0 1-1.02-1.27.5.5 0 0 0-.96 0A2.5 2.5 0 0 0 6.5 14h3a2.5 2.5 0 0 0 1.48-2.77z"/>
                            <path d="M11.5 5H6a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 6 14h5a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 11.5 5z"/>
                        </svg>
                    </div>
                    <p>No schemes found</p>
                </div>
            `;
        }
        return;
    }

    filteredSchemes.forEach((scheme, index) => {
        // Render desktop row
        const row = document.createElement('tr');
        if (!scheme.is_active) row.classList.add('inactive-row');
        row.innerHTML = `
            <td class="scheme-title" data-label="Title">
                ${escapeHtml(scheme.title)}
                ${scheme.is_ai_suggested ? '<span class="ai-badge ms-2">AI</span>' : ''}
            </td>
            <td data-label="Category">
                <span class="badge badge-${scheme.category}">${capitalize(scheme.category)}</span>
            </td>
            <td data-label="Type">
                <span class="badge ${scheme.type.includes('Central') ? 'badge-central' : 'badge-state'}">
                    ${scheme.type.includes('Central') ? 'Central' : 'State'}
                </span>
            </td>
            <td data-label="Status">
                <span class="status-toggle badge ${scheme.is_active ? 'bg-success' : 'bg-secondary'}" 
                      data-id="${scheme.id}" onclick="toggleSchemeStatus(${scheme.id})">
                    ${scheme.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td data-label="Actions">
                <div class="action-buttons">
                    <button class="btn btn-sm btn-outline-primary" onclick="editScheme(${scheme.id})">Edit</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="confirmDeleteScheme(${scheme.id})">Delete</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);

        // Render mobile card
        if (mobileContainer) {
            mobileContainer.innerHTML += renderMobileSchemeCard(scheme, index);
        }
    });
}

function renderMobileSchemeCard(scheme, index) {
    const aiBadge = scheme.is_ai_suggested ? '<span class="ai-badge" style="font-size: 0.7rem; padding: 2px 5px; vertical-align: middle; margin-left: 5px;">AI</span>' : '';
    const statusBadge = `<span class="badge ${scheme.is_active ? 'bg-success' : 'bg-secondary'}" style="font-size: 0.7rem;">${scheme.is_active ? 'Active' : 'Inactive'}</span>`;
    const categoryBadge = `<span class="badge badge-${scheme.category}" style="font-size: 0.7rem;">${capitalize(scheme.category)}</span>`;

    return `
      <div class="mobile-app-card has-details" data-status="${scheme.is_active ? 'active' : 'inactive'}" onclick="toggleSchemeCardDetails(${index})">
        <div class="card-content">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 8px;">
            <span class="card-name" style="
              margin: 0; 
              font-weight: 700;
              font-size: 0.95rem;
              color: #1e293b;
              flex: 1;
              line-height: 1.3;
              display: -webkit-box;
              -webkit-line-clamp: 3;
              -webkit-box-orient: vertical;
              white-space: normal;
              overflow: hidden;
            ">
              ${scheme.title}${aiBadge}
            </span>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0;">
              ${statusBadge}
              ${categoryBadge}
            </div>
          </div>
          
          <div class="card-row-footer">
             <span class="card-expand-hint">Tap for details</span>
          </div>

          <div class="card-details-section" id="schemeDetails${index}">
             <div class="card-details-content">
                <div class="news-full-description" style="margin-bottom: 12px; font-weight: 500;">
                   ${escapeHtml(scheme.objective)}
                </div>
                
                <div class="event-body-text" style="background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 15px;">
                   <p><strong>Benefits:</strong><br>${escapeHtml(scheme.benefits || 'N/A')}</p>
                   <p class="mt-2"><strong>Eligibility:</strong><br>${Array.isArray(scheme.eligible_for) ? scheme.eligible_for.join(', ') : 'N/A'}</p>
                </div>

                <div class="user-action-row" style="display: flex; gap: 8px;">
                   <button class="btn btn-sm btn-outline-primary" style="flex: 1;" onclick="event.stopPropagation(); editScheme(${scheme.id})">Edit</button>
                   <button class="btn btn-sm btn-outline-danger" style="flex: 1;" onclick="event.stopPropagation(); confirmDeleteScheme(${scheme.id})">Delete</button>
                </div>
             </div>
          </div>
        </div>
      </div>
    `;
}

function toggleSchemeCardDetails(index) {
    const detailsEl = document.getElementById(`schemeDetails${index}`);
    if (!detailsEl) return;
    const card = detailsEl.closest('.mobile-app-card');
    card.classList.toggle('expanded');
}


// ============================================================================
// CRUD OPERATIONS
// ============================================================================

async function handleSaveScheme() {
    const form = document.getElementById('schemeForm');

    // Validate required fields
    const title = document.getElementById('schemeTitle').value.trim();
    const category = document.getElementById('schemeCategory').value;
    const objective = document.getElementById('schemeObjective').value.trim();

    if (!title || !category || !objective) {
        showAlert('Please fill in all required fields', 'warning');
        return;
    }

    try {
        showLoading('Saving scheme...');

        const schemeId = document.getElementById('schemeId').value;
        const isEdit = schemeId !== '';

        const schemeData = {
            title,
            type: document.getElementById('schemeType').value,
            category,
            scheme_category: document.getElementById('schemeSubCategory').value.trim(),
            objective,
            eligible_for: eligibleForTags,
            conditions: conditionsTags,
            benefits: document.getElementById('schemeBenefits').value.trim(),
            application_process: document.getElementById('schemeApplicationProcess').value.trim(),
            contact_office: document.getElementById('schemeContactOffice').value.trim(),
            website: document.getElementById('schemeWebsite').value.trim()
        };

        const token = AuthManager.getAuthToken();
        const url = isEdit ? `/api/schemes/${schemeId}` : '/api/schemes';
        const method = isEdit ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(schemeData)
        });

        const data = await response.json();
        hideLoading();

        if (response.ok && data.success) {
            showAlert(isEdit ? 'Scheme updated successfully' : 'Scheme created successfully', 'success');
            schemeModal.hide();
            await loadSchemes();
        } else {
            throw new Error(data.message || 'Failed to save scheme');
        }
    } catch (error) {
        hideLoading();
        console.error('Error saving scheme:', error);
        showAlert(error.message || 'Error saving scheme', 'danger');
    }
}

async function editScheme(id) {
    try {
        showLoading('Loading scheme...');

        const token = AuthManager.getAuthToken();
        const response = await fetch(`/api/schemes/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        hideLoading();

        if (response.ok && data.success) {
            const scheme = data.scheme;

            // Populate form
            document.getElementById('schemeId').value = scheme.id;
            document.getElementById('schemeTitle').value = scheme.title || '';
            document.getElementById('schemeType').value = scheme.type || 'State Government';
            document.getElementById('schemeCategory').value = scheme.category || '';
            document.getElementById('schemeSubCategory').value = scheme.scheme_category || '';
            document.getElementById('schemeObjective').value = scheme.objective || '';
            document.getElementById('schemeBenefits').value = scheme.benefits || '';
            document.getElementById('schemeApplicationProcess').value = scheme.application_process || '';
            document.getElementById('schemeContactOffice').value = scheme.contact_office || '';
            document.getElementById('schemeWebsite').value = scheme.website || '';

            // Set tags
            eligibleForTags = Array.isArray(scheme.eligible_for) ? [...scheme.eligible_for] : [];
            conditionsTags = Array.isArray(scheme.conditions) ? [...scheme.conditions] : [];
            renderTags('eligibleForContainer', eligibleForTags, 'eligibleFor');
            renderTags('conditionsContainer', conditionsTags, 'conditions');

            document.getElementById('schemeModalLabel').textContent = 'Edit Scheme';
            schemeModal.show();
        } else {
            throw new Error(data.message || 'Failed to load scheme');
        }
    } catch (error) {
        hideLoading();
        console.error('Error loading scheme:', error);
        showAlert('Error loading scheme details', 'danger');
    }
}

async function toggleSchemeStatus(id) {
    try {
        const token = AuthManager.getAuthToken();
        const response = await fetch(`/api/schemes/${id}/toggle`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (response.ok && data.success) {
            showAlert(data.message, 'success');
            await loadSchemes();
        } else {
            throw new Error(data.message || 'Failed to toggle status');
        }
    } catch (error) {
        console.error('Error toggling scheme status:', error);
        showAlert('Error updating scheme status', 'danger');
    }
}

function confirmDeleteScheme(id) {
    currentSchemeId = id;
    deleteConfirmModal.show();
}

async function deleteScheme(id) {
    try {
        showLoading('Deleting scheme...');

        const token = AuthManager.getAuthToken();
        const response = await fetch(`/api/schemes/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        hideLoading();

        if (response.ok && data.success) {
            showAlert('Scheme deleted successfully', 'success');
            await loadSchemes();
        } else {
            throw new Error(data.message || 'Failed to delete scheme');
        }
    } catch (error) {
        hideLoading();
        console.error('Error deleting scheme:', error);
        showAlert('Error deleting scheme', 'danger');
    }
}

// ============================================================================
// AI SUGGESTIONS
// ============================================================================

async function loadAiSuggestions() {
    aiSuggestionsModal.show();
    const body = document.getElementById('aiSuggestionsBody');

    body.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2 text-muted">Analyzing existing schemes and finding recommendations...</p>
            <small class="text-muted">This may take 10-15 seconds</small>
        </div>
    `;

    try {
        const token = AuthManager.getAuthToken();
        const response = await fetch('/api/schemes/suggestions', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to get suggestions');
        }

        if (data.success && data.suggestions && data.suggestions.length > 0) {
            body.innerHTML = `
                <p class="text-muted mb-3">Found ${data.suggestions.length} scheme suggestions. Review and add the ones you want:</p>
                ${data.suggestions.map((s, idx) => renderSuggestionCard(s, idx)).join('')}
            `;
        } else {
            body.innerHTML = `
                <div class="text-center py-4">
                    <p class="text-muted">No new suggestions found at this time.</p>
                    <small>All known schemes may already be in your database.</small>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading AI suggestions:', error);
        body.innerHTML = `
            <div class="alert alert-danger">
                <strong>Error:</strong> ${error.message}
            </div>
            <p class="text-muted">Make sure GEMINI_API_KEY is configured in your .env file.</p>
        `;
    }
}

function renderSuggestionCard(suggestion, index) {
    const confidenceClass = suggestion.confidence === 'HIGH' ? 'confidence-high' : 'confidence-medium';

    return `
        <div class="suggestion-card" id="suggestion-${index}">
            <div class="d-flex flex-column flex-sm-row justify-content-between align-items-start gap-3">
                <div class="flex-grow-1">
                    <h6 class="mb-2 fw-bold" style="color: #1e293b;">${escapeHtml(suggestion.title)}</h6>
                    
                    <div class="d-flex flex-wrap gap-2 mb-2 align-items-center">
                        <span class="badge badge-${suggestion.category}">${capitalize(suggestion.category)}</span>
                        <span class="badge ${suggestion.type?.includes('Central') ? 'badge-central' : 'badge-state'}">
                            ${suggestion.type?.includes('Central') ? 'Central' : 'State'}
                        </span>
                        <span class="${confidenceClass}" style="font-size: 0.8rem;">
                            <i class="bi bi-graph-up-arrow me-1"></i>${suggestion.confidence || 'MEDIUM'} Match
                        </span>
                    </div>

                    <p class="text-muted small mb-2" style="line-height: 1.5;">
                        ${escapeHtml(suggestion.objective || 'No objective description available.')}
                    </p>

                    ${suggestion.website ? `
                        <a href="${escapeHtml(suggestion.website)}" target="_blank" class="small text-decoration-none" style="color: #2563eb;">
                            <i class="bi bi-link-45deg"></i> Official Website
                        </a>
                    ` : ''}
                </div>
                
                <div class="d-grid d-sm-block mt-2 mt-sm-0 ms-sm-3 flex-shrink-0">
                    <button class="btn btn-sm btn-success" onclick="addSuggestion(${index})" style="min-width: 100px;">
                        <i class="bi bi-plus-lg me-1"></i> Add
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Store suggestions globally for adding
let currentSuggestions = [];

async function addSuggestion(index) {
    // We need to re-fetch suggestions to get the data
    // Better approach: store them when loaded
    const body = document.getElementById('aiSuggestionsBody');
    const cards = body.querySelectorAll('.suggestion-card');

    // Get suggestion data from the loadAiSuggestions call
    try {
        const token = AuthManager.getAuthToken();
        const response = await fetch('/api/schemes/suggestions', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success && data.suggestions && data.suggestions[index]) {
            const suggestion = data.suggestions[index];

            const addResponse = await fetch('/api/schemes/suggestion/add', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(suggestion)
            });

            const addData = await addResponse.json();

            if (addResponse.ok && addData.success) {
                showAlert('Scheme added successfully!', 'success');
                // Remove the card
                document.getElementById(`suggestion-${index}`).remove();
                // Reload schemes
                await loadSchemes();
            } else {
                throw new Error(addData.message || 'Failed to add scheme');
            }
        }
    } catch (error) {
        console.error('Error adding suggestion:', error);
        showAlert(error.message || 'Error adding scheme', 'danger');
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function resetSchemeForm() {
    document.getElementById('schemeForm').reset();
    document.getElementById('schemeId').value = '';

    // Clear tags
    eligibleForTags = [];
    conditionsTags = [];
    renderTags('eligibleForContainer', eligibleForTags, 'eligibleFor');
    renderTags('conditionsContainer', conditionsTags, 'conditions');
}

function showLoading(text = 'Please wait...') {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingOverlay').classList.add('show');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('show');
}

function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    const container = document.querySelector('.alerts-container');
    container.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => alertDiv.remove(), 150);
    }, 5000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}
