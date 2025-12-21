let allRequests = [];
let statusModal;

// Initialize when DOM is ready (or called by init.js)
// We check if we are already initialized to avoid double calls if possible, 
// though init.js only calls loadRequests
document.addEventListener("DOMContentLoaded", () => {
    // Setup listeners
    setupEventListeners();
    // Force load requests to ensure page content loads even if init.js doesn't trigger it
    loadRequests();
});

async function loadRequests() {
    try {
        const token = AuthManager.getAuthToken();
        const response = await fetch("/api/admin/equipment-requests", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error("Failed to fetch requests");

        allRequests = await response.json();
        renderStats(allRequests);
        renderRequests(allRequests);
    } catch (error) {
        console.error("Error loading requests:", error);
        document.getElementById("requestsTableBody").innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-danger py-4">
                    Error loading requests. Please try again.
                </td>
            </tr>
        `;
    }
}

function renderStats(requests) {
    const stats = {
        total: requests.length,
        pending: requests.filter(r => r.status === 'pending').length,
        processing: requests.filter(r => r.status === 'processing').length,
        provided: requests.filter(r => r.status === 'provided').length
    };

    const statsContainer = document.getElementById('equipmentStats');
    if (!statsContainer) return;

    statsContainer.innerHTML = `
        <div class="equipment-stat-card">
            <div class="stat-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
            </div>
            <div class="stat-info">
                <h3>Total Requests</h3>
                <div class="stat-value">${stats.total}</div>
            </div>
        </div>
        <div class="equipment-stat-card">
            <div class="stat-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
            </div>
            <div class="stat-info">
                <h3>Pending</h3>
                <div class="stat-value">${stats.pending}</div>
            </div>
        </div>
        <div class="equipment-stat-card">
            <div class="stat-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
            </div>
            <div class="stat-info">
                <h3>Processing</h3>
                <div class="stat-value">${stats.processing}</div>
            </div>
        </div>
        <div class="equipment-stat-card">
            <div class="stat-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </div>
            <div class="stat-info">
                <h3>Provided</h3>
                <div class="stat-value">${stats.provided}</div>
            </div>
        </div>
    `;
}

function renderRequests(requests) {
    const tbody = document.getElementById("requestsTableBody");
    if (!tbody) return;

    if (requests.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-4">
                    No equipment requests found.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = requests.map((req, index) => {
        let statusClass = 'bg-secondary';
        const st = (req.status || 'pending').toLowerCase();

        switch (st) {
            case 'pending': statusClass = 'bg-warning text-dark'; break;
            case 'processing': statusClass = 'bg-info text-dark'; break;
            case 'provided': statusClass = 'bg-success'; break;
            case 'rejected': statusClass = 'bg-danger'; break;
            case 'not_available': statusClass = 'bg-dark'; break;
        }

        // HTML escape utility
        function escapeHtml(unsafe) {
            if (!unsafe) return '';
            return String(unsafe)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        // Construct full name from first_name and last_name
        const firstName = escapeHtml(req.first_name || '');
        const lastName = escapeHtml(req.last_name || '');
        const fullName = `${firstName} ${lastName}`.trim() || escapeHtml(req.applicant_username || 'Unknown');

        return `
        <tr class="clickable-row" data-request-index="${index}" style="cursor: pointer;" onclick="openStatusModal(${index})">
            <td data-label="Applicant">
                <div class="fw-bold text-dark">${fullName}</div>
            </td>
            <td data-label="Equipment Type">${escapeHtml(req.equipment_type)}</td>
            <td data-label="Requested Date">${new Date(req.requested_at).toLocaleDateString()}</td>
            <td data-label="Source">
                <span class="badge rounded-pill ${req.source === 'registration' ? 'bg-indigo-subtle text-indigo' : 'bg-gray-subtle text-gray'}" 
                      style="${req.source === 'registration' ? 'background-color: #e0e7ff; color: #3730a3;' : 'background-color: #f3f4f6; color: #4b5563;'}">
                    ${req.source === 'registration' ? 'Registration' : 'Follow-up'}
                </span>
            </td>
            <td data-label="Status">
                <span class="badge rounded-pill ${statusClass} px-3 py-2 fw-normal">
                    ${st.replace('_', ' ').toUpperCase()}
                </span>
            </td>
        </tr>
    `}).join("");
}

function filterData() {
    const statusFilter = document.getElementById('equipmentStatusFilter')?.value ||
        document.getElementById('equipmentStatusFilterMobile')?.value || 'all';
    const searchTerm = (document.getElementById('equipmentSearchInput')?.value ||
        document.getElementById('equipmentSearchInputMobile')?.value || '').toLowerCase();

    const filtered = allRequests.filter(req => {
        const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
        const matchesSearch = !searchTerm ||
            (req.applicant_name || '').toLowerCase().includes(searchTerm) ||
            (req.applicant_email || '').toLowerCase().includes(searchTerm) ||
            (req.equipment_type || '').toLowerCase().includes(searchTerm);

        return matchesStatus && matchesSearch;
    });

    renderRequests(filtered);
}

function setupEventListeners() {
    // Status Filter - Desktop
    const statusFilter = document.getElementById('equipmentStatusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', filterData);
    }

    // Search Filter - Desktop
    const searchInput = document.getElementById('equipmentSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filterData);
    }

    // Status Filter - Mobile
    const statusFilterMobile = document.getElementById('equipmentStatusFilterMobile');
    if (statusFilterMobile) {
        statusFilterMobile.addEventListener('change', (e) => {
            // Sync with desktop filter
            if (statusFilter) statusFilter.value = e.target.value;
            filterData();
        });
    }

    // Search Filter - Mobile
    const searchInputMobile = document.getElementById('equipmentSearchInputMobile');
    if (searchInputMobile) {
        searchInputMobile.addEventListener('input', (e) => {
            // Sync with desktop filter
            if (searchInput) searchInput.value = e.target.value;
            filterData();
        });
    }

    // Sync desktop to mobile when changed
    if (statusFilter && statusFilterMobile) {
        statusFilter.addEventListener('change', (e) => {
            statusFilterMobile.value = e.target.value;
        });
    }

    if (searchInput && searchInputMobile) {
        searchInput.addEventListener('input', (e) => {
            searchInputMobile.value = e.target.value;
        });
    }
    // Save Status Button
    const saveBtn = document.getElementById("saveStatusBtn");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const id = document.getElementById("requestId").value;
            const status = document.getElementById("newStatus").value; // Fixed ID: newStatus
            const notes = document.getElementById("adminNotes").value;

            if (!id) return;

            // Show loading state
            const originalText = saveBtn.textContent;
            saveBtn.textContent = "Saving...";
            saveBtn.disabled = true;

            try {
                const token = AuthManager.getAuthToken();
                const response = await fetch(`/api/admin/equipment/${id}/status`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ status, admin_notes: notes })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || "Failed to update status");
                }

                alert(`Success: ${data.message} ${data.type ? '(' + data.type + ')' : ''}`);

                // Close custom modal
                closeStatusModal();

                // Reload data
                loadRequests();
            } catch (error) {
                console.error("Error updating status:", error);
                alert(`Failed: ${error.message}`);
            } finally {
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            }
        });
    }
}

// Global Modal Opener
window.openStatusModal = (index) => {
    const req = allRequests[index];
    if (!req) return;

    document.getElementById("requestId").value = req.id;
    document.getElementById("newStatus").value = req.status || 'pending';
    document.getElementById("adminNotes").value = (req.admin_notes && req.admin_notes !== 'null') ? req.admin_notes : '';

    // Display user notes if available
    const userNotesDisplay = document.getElementById("userNotesDisplay");
    if (userNotesDisplay) {
        const userNotes = req.equipment_details || '';
        if (userNotes && userNotes.trim() !== '') {
            // Escape HTML for display
            const escaped = userNotes
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;")
                .replace(/\n/g, '<br>');

            userNotesDisplay.innerHTML = `
                <div class="custom-user-notes">
                    <strong>User's Additional Details:</strong>
                    <p>${escaped}</p>
                </div>
            `;
        } else {
            userNotesDisplay.innerHTML = '';
        }
    }

    // Show custom modal
    const modalEl = document.getElementById("statusModal");
    modalEl.style.display = "flex";
    // Trigger animation
    setTimeout(() => {
        modalEl.classList.add("show");
    }, 10);
};

// Close status modal
window.closeStatusModal = () => {
    const modalEl = document.getElementById("statusModal");
    modalEl.classList.remove("show");
    setTimeout(() => {
        modalEl.style.display = "none";
    }, 300); // Match transition duration
};

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modalEl = document.getElementById("statusModal");
    if (e.target === modalEl) {
        closeStatusModal();
    }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modalEl = document.getElementById("statusModal");
        if (modalEl && modalEl.style.display === 'flex') {
            closeStatusModal();
        }
    }
});

// Show user notes in alert
window.showUserNotes = (index) => {
    const req = allRequests[index];
    if (req && req.equipment_details) {
        alert(`User's Additional Details:\n\n${req.equipment_details}`);
    }
};
