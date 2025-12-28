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
    const filteredSchemes = currentFilter === 'all'
        ? allSchemes
        : allSchemes.filter(s => s.category === currentFilter);

    if (filteredSchemes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4">
                    <p class="mb-0 text-muted">No schemes found</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filteredSchemes.map(scheme => `
        <tr class="${scheme.is_active ? '' : 'inactive-row'}">
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
        </tr>
    `).join('');
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
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <h6>${escapeHtml(suggestion.title)}</h6>
                    <span class="badge badge-${suggestion.category} me-2">${capitalize(suggestion.category)}</span>
                    <span class="badge ${suggestion.type?.includes('Central') ? 'badge-central' : 'badge-state'}">
                        ${suggestion.type?.includes('Central') ? 'Central' : 'State'}
                    </span>
                    <span class="ms-2 ${confidenceClass}">
                        <small>Confidence: ${suggestion.confidence || 'MEDIUM'}</small>
                    </span>
                </div>
                <button class="btn btn-sm btn-success" onclick="addSuggestion(${index})">
                    Add
                </button>
            </div>
            <p class="mt-2 mb-1 small">${escapeHtml(suggestion.objective || '')}</p>
            ${suggestion.website ? `<a href="${escapeHtml(suggestion.website)}" target="_blank" class="small">View Website</a>` : ''}
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
