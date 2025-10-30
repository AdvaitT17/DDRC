class DashboardManager {
  constructor() {
    this.loadStats();
    this.loadRecentApplications();
    this.setupIncompleteRegistrationsSection();
    this.loadIncompleteRegistrations(); // Now this will use the filter set up above
    this.applicationModal = new bootstrap.Modal(
      document.getElementById("applicationModal")
    );
    this.editHistoryModal = new bootstrap.Modal(
      document.getElementById("editHistoryModal")
    );
    this.isEditMode = false;
    this.currentApplicationId = null;
    this.editedFields = {};

    // All applications view state
    this.isAllApplicationsView = false;
    this.currentPage = 1;
    this.itemsPerPage = 20;
    this.allApplications = [];
    this.filteredApplications = [];
    this.locationFilterActive = false;
    this.activeLocationFilter = null;
    this.allFields = [];
    this.nestedSelectField = null;
    this.isRestoringSelections = false;

    // Check if we're on the all applications view (from View All button)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("view") === "all") {
      this.showAllApplicationsView();
    }

    // Set up event listeners for all applications view
    this.setupAllApplicationsEventListeners();
  }

  async loadStats() {
    try {
      const response = await fetch("/api/admin/stats", {
        headers: {
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch stats");

      const stats = await response.json();

      document.getElementById("totalRegistrations").textContent =
        stats.totalRegistrations;
      document.getElementById("applicationsToReview").textContent =
        stats.applicationsToReview;
      document.getElementById("approvedToday").textContent =
        stats.approvedToday;

      // Check if element exists before updating it
      const activeUsersElement = document.getElementById("activeUsers");
      if (activeUsersElement) {
        activeUsersElement.textContent = stats.activeUsers;
      }

      // We don't update the incompleteRegistrations count here anymore
      // as it will be set by loadIncompleteRegistrations() with proper filtering
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  }

  async loadIncompleteRegistrations() {
    try {
      // Get the value of the inactivity filter
      const inactivitySelect = document.getElementById(
        "incompleteInactivityFilter"
      );
      const inactivityThreshold = inactivitySelect
        ? parseInt(inactivitySelect.value)
        : 6; // Default to 6 hours

      // Get a reference to the loading indicator
      const tableBody = document.getElementById("incompleteRegistrationsList");
      if (tableBody) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center py-4">
              <div class="spinner-border spinner-border-sm me-2" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              Loading registrations...
            </td>
          </tr>
        `;
      }

      const response = await fetch(
        `/api/admin/incomplete-registrations?inactivityThreshold=${inactivityThreshold}`,
        {
          headers: {
            Authorization: `Bearer ${AuthManager.getAuthToken()}`,
          },
        }
      );

      if (!response.ok)
        throw new Error("Failed to fetch incomplete registrations");

      const registrations = await response.json();

      // Update count in the dashboard stat
      const countElement = document.getElementById("incompleteRegistrations");
      if (countElement) {
        countElement.textContent = registrations.length;
      }

      // Update the selector display text to show the current filter
      if (inactivitySelect) {
        // Make sure the correct option is visibly selected
        for (let i = 0; i < inactivitySelect.options.length; i++) {
          if (inactivitySelect.options[i].value === inactivityThreshold) {
            inactivitySelect.selectedIndex = i;
            break;
          }
        }
      }

      if (!tableBody) return;

      if (registrations.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center">
              <div class="p-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-3 text-muted">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p class="text-muted">No partial registrations found.</p>
              </div>
            </td>
          </tr>
        `;
        return;
      }

      tableBody.innerHTML = registrations
        .map(
          (reg) => `
          <tr class="clickable-row" onclick="dashboardManager.viewIncompleteRegistration('${
            reg.id !== null ? reg.id : reg.userId
          }')">
            <td data-label="ID">${reg.applicationId}</td>
            <td data-label="Name">${reg.applicantName || "Not specified"}</td>
            <td data-label="Email">${reg.email}</td>
            <td data-label="Phone">${reg.phone || "Not provided"}</td>
            <td data-label="Last Updated">${new Date(
              reg.lastUpdated
            ).toLocaleDateString()}</td>
            <td data-label="Inactive">${this.formatInactiveTime(
              reg.inactive
            )}</td>
            <td data-label="Current Section">${reg.currentSection}</td>
          </tr>
        `
        )
        .join("");
    } catch (error) {
      console.error("Error loading incomplete registrations:", error);
      const tableBody = document.getElementById("incompleteRegistrationsList");
      if (tableBody) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center py-4 text-danger">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-3">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12" y2="16"/>
              </svg>
              <p>Failed to load registrations. Please try again.</p>
              <button class="btn btn-outline-primary btn-sm mt-2" onclick="dashboardManager.loadIncompleteRegistrations()">Retry</button>
            </td>
          </tr>
        `;
      }
    }
  }

  // Helper method to format inactive time
  formatInactiveTime(hours) {
    if (hours < 1) {
      return "Less than 1 hour";
    } else if (hours < 24) {
      return `${hours} hour${hours === 1 ? "" : "s"}`;
    } else {
      const days = Math.floor(hours / 24);
      return `${days} day${days === 1 ? "" : "s"}`;
    }
  }

  // Add this method to initialize the incomplete registrations section with filter
  setupIncompleteRegistrationsSection() {
    const container = document
      .querySelector(
        '.content-card.mt-4 h2[data-label="Partial Registrations"]'
      )
      ?.closest(".content-card");

    if (!container) return;

    // Get the card header
    const cardHeader = container.querySelector(".card-header");
    if (!cardHeader) return;

    // Replace the card header content with new layout including the filter
    cardHeader.innerHTML = `
      <div class="d-flex w-100 justify-content-between align-items-center">
        <h2 data-label="Partial Registrations">Partial Registrations</h2>
        <div class="admin-controls" style="min-width: 180px; width: auto;">
          <select id="incompleteInactivityFilter" class="form-select">
            <option value="0">Any duration</option>
            <option value="6" selected>Inactive ≥ 6 hours</option>
            <option value="12">Inactive ≥ 12 hours</option>
            <option value="24">Inactive ≥ 1 day</option>
            <option value="168">Inactive ≥ 1 week</option>
          </select>
        </div>
      </div>
    `;

    // Add event listener to reload data when filter changes
    document
      .getElementById("incompleteInactivityFilter")
      .addEventListener("change", () => {
        this.loadIncompleteRegistrations();
      });
  }

  async viewIncompleteRegistration(regId) {
    try {
      // Reset edit mode and edited fields
      this.isEditMode = false;
      this.editedFields = {};
      this.currentIncompleteRegId = regId;

      // First fetch the incomplete registration details
      // Important: Use inactivityThreshold=0 to get ALL registrations regardless of inactivity time
      const response = await fetch(
        `/api/admin/incomplete-registrations?inactivityThreshold=0`,
        {
          headers: {
            Authorization: `Bearer ${AuthManager.getAuthToken()}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch incomplete registrations");
      }

      const registrations = await response.json();

      // Handle the case where we might be looking for a userId instead of a registrationId
      // This happens for users who haven't started filling out the form yet
      const registration = registrations.find(
        (r) =>
          (r.id !== null && r.id.toString() === regId.toString()) ||
          (r.id === null &&
            r.userId &&
            r.userId.toString() === regId.toString())
      );

      if (!registration) {
        console.error(`Registration not found with ID: ${regId}`);
        alert("Registration not found!");
        return;
      }

      // Store the current registration for reference in other methods
      this.currentRegistration = registration;

      // Next, fetch all form sections and fields to get the complete form structure
      // This will show all fields, even those that haven't been filled out yet
      const formStructureResponse = await fetch(`/api/form/sections`, {
        headers: {
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
      });

      if (!formStructureResponse.ok) {
        throw new Error("Failed to fetch form structure");
      }

      const formSections = await formStructureResponse.json();

      // Create a map of user responses for easy lookup
      const userResponses = {};

      // Check if responses array exists before iterating
      if (registration.responses && Array.isArray(registration.responses)) {
        registration.responses.forEach((response) => {
          userResponses[response.fieldName] = response.value;
        });
      }

      // Map existing responses to the full form structure
      const populatedSections = formSections.map((section) => {
        const fields = section.fields.map((field) => {
          return {
            id: field.id,
            name: field.name,
            display_name: field.display_name,
            field_type:
              field.field_type ||
              this.guessFieldType(userResponses[field.name] || "", field.name),
            options: field.options,
            value: userResponses[field.name] || "",
          };
        });

        return {
          id: section.id,
          name: section.name,
          order_index: section.order_index,
          fields: fields,
        };
      });

      // Create modal if it doesn't exist
      let incompleteModal = document.getElementById(
        "incompleteRegistrationModal"
      );
      if (!incompleteModal) {
        incompleteModal = document.createElement("div");
        incompleteModal.id = "incompleteRegistrationModal";
        incompleteModal.className = "modal fade";
        incompleteModal.setAttribute("tabindex", "-1");
        incompleteModal.innerHTML = `
          <div class="modal-dialog modal-dialog-centered modal-xl">
            <div class="modal-content">
              <div class="modal-header d-flex justify-content-between align-items-center" style="background-color: var(--primary-color); color: white;">
                <h5 class="modal-title">Incomplete Registration</h5>
                <div class="header-actions">
                  <button type="button" id="incompleteHistoryBtn" style="display: none;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="me-1">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    History
                  </button>
                  <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" style="filter: brightness(0) invert(1);"></button>
                </div>
              </div>
              <div class="modal-body">
                <div class="application-header mb-4">
                  <div class="d-flex justify-content-between align-items-center">
                    <div>
                      <h6 class="text-muted mb-1">Application ID</h6>
                      <h4 id="incompleteModalApplicationId"></h4>
                    </div>
                    <div class="text-end">
                      <h6 class="text-muted mb-1">Started On</h6>
                      <h5 id="incompleteModalStartDate"></h5>
                    </div>
                  </div>
                  <div class="d-flex justify-content-between align-items-center mt-3">
                    <div>
                      <h6 class="text-muted mb-1">Applicant</h6>
                      <h5 id="incompleteModalApplicantName"></h5>
                      <div class="d-flex align-items-center mt-1">
                        <small class="text-muted me-3">
                          <span class="me-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M22 17.5V20a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2.5"></path>
                              <path d="M16 8.5l-4.5 4.5-2-2"></path>
                            </svg>
                          </span>
                          <span id="incompleteModalEmail"></span>
                        </small>
                        <small class="text-muted" id="incompleteModalPhoneContainer" style="display: none;">
                          <span class="me-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                            </svg>
                          </span>
                          <span id="incompleteModalPhone"></span>
                        </small>
                      </div>
                    </div>
                    <div class="text-end">
                      <h6 class="text-muted mb-1">Last Updated</h6>
                      <h5 id="incompleteModalLastUpdated"></h5>
                      <div class="mt-1">
                          <span class="me-1">Current Section:</span>
                          <span id="incompleteModalCurrentSection"></span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div class="application-sections row" id="incompleteModalFormData">
                  <!-- Will be populated with all form sections -->
                </div>
              </div>
              <div class="modal-footer">
                <div class="action-buttons">
                  <button type="button" class="btn btn-primary me-2" id="incompleteEditBtn" onclick="dashboardManager.toggleIncompleteEditMode()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    <span id="incompleteEditBtnText">Complete Form</span>
                  </button>
                  <button type="button" class="btn btn-success" id="incompleteCompleteBtn" onclick="dashboardManager.completeRegistration()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Mark as Complete
                  </button>
                </div>
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(incompleteModal);
      } else {
        // Update the existing modal's footer to remove any Contact User button
        const actionButtons = incompleteModal.querySelector(".action-buttons");
        if (actionButtons) {
          // Keep only the Complete Form and Mark as Complete buttons
          const editBtn = actionButtons.querySelector("#incompleteEditBtn");
          const completeBtn = actionButtons.querySelector(
            "#incompleteCompleteBtn"
          );
          actionButtons.innerHTML = "";
          if (editBtn) {
            // Make sure we preserve the margin class
            editBtn.classList.add("me-2");
            actionButtons.appendChild(editBtn);
          }
          if (completeBtn) actionButtons.appendChild(completeBtn);
        }
      }

      // Fill in the fields in the modal
      document.getElementById("incompleteModalApplicationId").textContent =
        registration.applicationId;
      document.getElementById("incompleteModalStartDate").textContent =
        new Date(registration.createdAt).toLocaleDateString();
      document.getElementById("incompleteModalApplicantName").textContent =
        registration.applicantName;
      document.getElementById("incompleteModalEmail").textContent =
        registration.email;

      if (registration.phone) {
        document.getElementById("incompleteModalPhoneContainer").style.display =
          "inline";
        document.getElementById("incompleteModalPhone").textContent =
          registration.phone;
      } else {
        document.getElementById("incompleteModalPhoneContainer").style.display =
          "none";
      }

      document.getElementById("incompleteModalLastUpdated").textContent =
        new Date(registration.lastUpdated).toLocaleDateString();
      document.getElementById("incompleteModalCurrentSection").textContent =
        registration.currentSection;

      // Populate the form with all sections and fields, not just those with responses
      const formDataContainer = document.getElementById(
        "incompleteModalFormData"
      );
      formDataContainer.innerHTML = this.renderFormSections(populatedSections);

      // Update the edit button text
      const editBtnText = document.getElementById("incompleteEditBtnText");
      editBtnText.textContent = "Complete Form";

      // Always show the "Mark as Complete" button in incomplete registrations
      // It's up to department staff to decide if enough fields are filled
      const completeBtn = document.getElementById("incompleteCompleteBtn");
      completeBtn.style.display = "inline-flex";

      // Show the modal
      const modal = new bootstrap.Modal(incompleteModal);
      modal.show();
    } catch (error) {
      console.error("Error viewing incomplete registration:", error);
      alert("Failed to load registration details. Please try again.");
    }
  }

  async refreshIncompleteRegistrationForEdit() {
    try {
      // Get the current registration ID
      const regId = this.currentIncompleteRegId;
      if (!regId) {
        console.error("No incomplete registration ID to refresh");
        return;
      }

      // Fetch the incomplete registration details with inactivityThreshold=0 to get ALL registrations
      const response = await fetch(
        `/api/admin/incomplete-registrations?inactivityThreshold=0`,
        {
          headers: {
            Authorization: `Bearer ${AuthManager.getAuthToken()}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch incomplete registration");
      }

      const registrations = await response.json();

      // Find the specific registration
      const registration = registrations.find(
        (r) =>
          (r.id !== null && r.id.toString() === regId.toString()) ||
          (r.id === null &&
            r.userId &&
            r.userId.toString() === regId.toString())
      );

      if (!registration) {
        console.error("Registration not found during refresh");
        return;
      }

      this.currentRegistration = registration;

      // Fetch all form sections and fields to get the complete form structure
      const formStructureResponse = await fetch(`/api/form/sections`, {
        headers: {
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
      });

      if (!formStructureResponse.ok) {
        throw new Error("Failed to fetch form structure");
      }

      const formSections = await formStructureResponse.json();

      // Create a map of user responses for easy lookup
      const userResponses = {};

      // Check if responses array exists before iterating
      if (registration.responses && Array.isArray(registration.responses)) {
        registration.responses.forEach((response) => {
          userResponses[response.fieldName] = response.value;
        });
      }

      // Map existing responses to the full form structure
      const populatedSections = formSections.map((section) => {
        const fields = section.fields.map((field) => {
          return {
            id: field.id,
            name: field.name,
            display_name: field.display_name,
            field_type:
              field.field_type ||
              this.guessFieldType(userResponses[field.name] || "", field.name),
            options: field.options,
            value: userResponses[field.name] || "",
          };
        });

        return {
          id: section.id,
          name: section.name,
          order_index: section.order_index,
          fields: fields,
        };
      });

      // Populate form sections with editable fields
      const formDataContainer = document.getElementById(
        "incompleteModalFormData"
      );
      formDataContainer.innerHTML = this.renderFormSections(populatedSections);

      // Now convert all fields to editable
      const formFields = formDataContainer.querySelectorAll(".form-field");
      formFields.forEach((field) => {
        // Mark as edit-mode field
        field.classList.add("edit-mode");

        // Get field data
        const fieldId = field.getAttribute("data-field-id");
        const valueContainer = field.querySelector(".field-value");

        // Find the field data from populated sections
        const fieldData = populatedSections
          .flatMap((s) => s.fields)
          .find((f) => f.id == fieldId);

        if (fieldData) {
          // Use the same renderEditableField method that's used for regular applications
          valueContainer.innerHTML = this.renderEditableField(fieldData);
        }
      });
    } catch (error) {
      console.error(
        "Error refreshing incomplete registration for edit:",
        error
      );
      alert("Failed to prepare form for editing. Please try again.");
      this.isEditMode = false;
    }
  }

  async saveIncompleteChanges() {
    try {
      const editedFieldIds = Object.keys(this.editedFields);
      if (editedFieldIds.length === 0) {
        alert("No changes to save.");
        return;
      }

      // Ensure the reason modal will appear on top by setting a higher z-index
      const reasonModalElement = document.getElementById("editReasonModal");
      if (reasonModalElement) {
        reasonModalElement.style.zIndex = "1060"; // Higher than default Bootstrap modal z-index
      }

      // Populate the edit summary list
      const editSummaryList = document.getElementById("editSummaryList");
      editSummaryList.innerHTML = "";

      // Set explicit styles on the container
      editSummaryList.style.width = "100%";
      editSummaryList.style.display = "block";
      editSummaryList.style.boxSizing = "border-box";

      // Update the count badge
      document.getElementById("editedFieldsCount").textContent = `${
        editedFieldIds.length
      } field${editedFieldIds.length > 1 ? "s" : ""}`;

      // Add each edited field to the summary
      editedFieldIds.forEach((fieldId) => {
        const field = this.editedFields[fieldId];
        // Use the label property which contains the display_name for all field types including nested dropdowns
        const fieldName =
          field.label || field.name || field.fieldName || fieldId;
        const oldValue =
          field.originalValue !== null && field.originalValue !== undefined
            ? field.originalValue
            : "(empty)";
        const newValue =
          field.value !== null && field.value !== undefined
            ? field.value
            : "(empty)";

        // Create directly with minimal nesting
        const summaryItem = document.createElement("div");
        summaryItem.className = "edit-summary-item";
        summaryItem.style.width = "100%";
        summaryItem.style.display = "block";
        summaryItem.style.boxSizing = "border-box";
        summaryItem.style.marginBottom = "1rem";
        summaryItem.style.padding = "1.25rem";
        summaryItem.style.borderRadius = "10px";
        summaryItem.style.borderLeft = "4px solid #6366f1";
        summaryItem.style.backgroundColor = "white";
        summaryItem.style.boxShadow = "0 3px 10px rgba(0, 0, 0, 0.04)";

        // Field name
        const nameElement = document.createElement("div");
        nameElement.className = "edit-field-name";
        nameElement.style.width = "100%";
        nameElement.style.display = "block";
        nameElement.style.marginBottom = "0.5rem";
        nameElement.style.fontWeight = "600";
        nameElement.style.fontSize = "1.1rem";
        nameElement.style.color = "#374151";
        nameElement.textContent = fieldName;
        summaryItem.appendChild(nameElement);

        // Change container
        const changeContainer = document.createElement("div");
        changeContainer.className = "edit-field-change";
        changeContainer.style.display = "grid";
        changeContainer.style.gridTemplateColumns = "1fr 40px 1fr";
        changeContainer.style.width = "100%";
        changeContainer.style.boxSizing = "border-box";
        changeContainer.style.alignItems = "center";
        changeContainer.style.marginTop = "0.5rem";

        // Old value container
        const oldValueContainer = document.createElement("div");
        oldValueContainer.className = "edit-field-old";
        oldValueContainer.style.width = "100%";

        const oldValueLabel = document.createElement("div");
        oldValueLabel.className = "value-label";
        oldValueLabel.style.fontSize = "0.8rem";
        oldValueLabel.style.fontWeight = "500";
        oldValueLabel.style.color = "#6b7280";
        oldValueLabel.style.marginBottom = "0.25rem";
        oldValueLabel.style.textTransform = "uppercase";
        oldValueLabel.textContent = "Previous Value";
        oldValueContainer.appendChild(oldValueLabel);

        const oldValueContent = document.createElement("div");
        oldValueContent.className = "value-container";
        oldValueContent.style.backgroundColor = "#f9fafb";
        oldValueContent.style.border = "1px solid #e5e7eb";
        oldValueContent.style.borderRadius = "8px";
        oldValueContent.style.padding = "0.75rem";
        oldValueContent.style.minHeight = "2.5rem";
        oldValueContent.style.wordBreak = "break-word";
        oldValueContent.style.lineHeight = "1.5";
        oldValueContent.style.width = "100%";
        oldValueContent.style.color = "#6b7280";
        oldValueContent.style.boxSizing = "border-box";
        oldValueContent.textContent = oldValue;
        oldValueContainer.appendChild(oldValueContent);

        // Arrow
        const arrowContainer = document.createElement("div");
        arrowContainer.className = "edit-arrow";
        arrowContainer.style.display = "flex";
        arrowContainer.style.justifyContent = "center";
        arrowContainer.style.color = "#9ca3af";
        arrowContainer.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-arrow-right" viewBox="0 0 16 16">
            <path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
          </svg>
        `;

        // New value container
        const newValueContainer = document.createElement("div");
        newValueContainer.className = "edit-field-new";
        newValueContainer.style.width = "100%";

        const newValueLabel = document.createElement("div");
        newValueLabel.className = "value-label";
        newValueLabel.style.fontSize = "0.8rem";
        newValueLabel.style.fontWeight = "500";
        newValueLabel.style.color = "#6b7280";
        newValueLabel.style.marginBottom = "0.25rem";
        newValueLabel.style.textTransform = "uppercase";
        newValueLabel.textContent = "New Value";
        newValueContainer.appendChild(newValueLabel);

        const newValueContent = document.createElement("div");
        newValueContent.className = "value-container";
        newValueContent.style.backgroundColor = "#f0f9ff";
        newValueContent.style.border = "1px solid #bae6fd";
        newValueContent.style.borderRadius = "8px";
        newValueContent.style.padding = "0.75rem";
        newValueContent.style.minHeight = "2.5rem";
        newValueContent.style.wordBreak = "break-word";
        newValueContent.style.lineHeight = "1.5";
        newValueContent.style.width = "100%";
        newValueContent.style.color = "#0369a1";
        newValueContent.style.fontWeight = "500";
        newValueContent.style.boxSizing = "border-box";
        newValueContent.textContent = newValue;
        newValueContainer.appendChild(newValueContent);

        // Append all elements
        changeContainer.appendChild(oldValueContainer);
        changeContainer.appendChild(arrowContainer);
        changeContainer.appendChild(newValueContainer);
        summaryItem.appendChild(changeContainer);
        editSummaryList.appendChild(summaryItem);
      });

      // Get the modal element
      const editReasonModalEl = document.getElementById("editReasonModal");
      const editReasonInput = document.getElementById("editReasonInput");
      const userConsentCheck = document.getElementById("userConsentCheck");
      const cancelEditBtn = document.getElementById("cancelEditBtn");
      const confirmEditBtn = document.getElementById("confirmEditBtn");

      // Clear previous input
      editReasonInput.value = "";
      editReasonInput.classList.remove("is-invalid");
      userConsentCheck.checked = true;

      // Remove any existing event listeners
      const newCancelBtn = cancelEditBtn.cloneNode(true);
      cancelEditBtn.parentNode.replaceChild(newCancelBtn, cancelEditBtn);

      const newConfirmBtn = confirmEditBtn.cloneNode(true);
      confirmEditBtn.parentNode.replaceChild(newConfirmBtn, confirmEditBtn);

      // Get the new button references
      const newCancelBtnRef = document.getElementById("cancelEditBtn");
      const newConfirmBtnRef = document.getElementById("confirmEditBtn");

      // Add event listener to reset modal when hidden
      editReasonModalEl.addEventListener(
        "hidden.bs.modal",
        function () {
          editReasonInput.value = "";
          editReasonInput.classList.remove("is-invalid");
          userConsentCheck.checked = true;
        },
        { once: true }
      );

      // Show the modal
      const editReasonModal = new bootstrap.Modal(editReasonModalEl);
      editReasonModal.show();

      // Focus on the reason input
      editReasonInput.focus();

      // Handle cancel button
      newCancelBtnRef.onclick = () => {
        editReasonModal.hide();
      };

      // Handle confirm button
      newConfirmBtnRef.onclick = () => {
        const reason = editReasonInput.value.trim();
        if (!reason) {
          editReasonInput.classList.add("is-invalid");
          return;
        }

        // Check if consent checkbox is checked
        if (!userConsentCheck.checked) {
          alert("Please confirm that the changes are accurate and verified.");
          return;
        }

        // Hide the modal
        editReasonModal.hide();

        // Proceed with saving
        this.processIncompleteEditSave(reason);
      };

      // Create a function for the keydown handler
      const handleKeydown = (e) => {
        if (e.key === "Enter" && e.ctrlKey) {
          newConfirmBtnRef.click();
        }
      };

      // Create a function for the input handler
      const handleInput = () => {
        editReasonInput.classList.remove("is-invalid");
      };

      // Add enter key handler for the textarea
      editReasonInput.addEventListener("keydown", handleKeydown);

      // Remove invalid class when typing
      editReasonInput.addEventListener("input", handleInput);

      // Clean up event listeners when modal is hidden
      editReasonModalEl.addEventListener(
        "hidden.bs.modal",
        function () {
          editReasonInput.removeEventListener("keydown", handleKeydown);
          editReasonInput.removeEventListener("input", handleInput);
        },
        { once: true }
      );
    } catch (error) {
      console.error("Error saving incomplete registration changes:", error);
      alert("Failed to save changes. Please try again.");
    }
  }

  // Add this new method for incomplete edit save processing
  processIncompleteEditSave(reason) {
    const editedFieldIds = Object.keys(this.editedFields);
    const payload = {
      responses: [],
      user_consent: true,
    };

    editedFieldIds.forEach((fieldId) => {
      const field = this.editedFields[fieldId];
      const response = {
        field_id: fieldId,
        value: field.value,
        reason: reason,
      };

      // If this is a file removal, include the original file name for logging
      if (field.isRemoved && field.originalFileName) {
        response.original_file_name = field.originalFileName;
      }

      payload.responses.push(response);
    });

    // Show loading state
    const saveBtn = document.getElementById("confirmEditBtn");
    const originalBtnText = saveBtn.innerHTML;
    saveBtn.innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status"></span> Saving...';
    saveBtn.disabled = true;

    // Determine the correct ID to use
    let registrationId = this.currentIncompleteRegId;

    // If the ID is a placeholder or the registration has a null ID,
    // and we have a user ID, we need to create a registration first
    const isPlaceholderId =
      this.currentIncompleteRegId.toString().startsWith("TEMP-") ||
      (this.currentRegistration && this.currentRegistration.id === null);

    if (isPlaceholderId) {
      // Extract the user ID to create a registration first
      const userId = this.currentRegistration
        ? this.currentRegistration.userId
        : this.currentIncompleteRegId.toString().replace("TEMP-", "");

      // First create a registration record
      fetch("/api/admin/incomplete-registrations/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
        body: JSON.stringify({ userId: userId }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(
              `Failed to create registration: ${response.status}`
            );
          }
          return response.json();
        })
        .then((data) => {
          registrationId = data.registrationId;
          return this.saveIncompleteChangesWithId(
            registrationId,
            payload,
            saveBtn,
            originalBtnText
          );
        })
        .catch((error) => {
          console.error("Error creating registration:", error);
          alert(`Failed to save changes: ${error.message}`);
          saveBtn.innerHTML = originalBtnText;
          saveBtn.disabled = false;
        });
    } else {
      // Use the existing registration ID
      this.saveIncompleteChangesWithId(
        registrationId,
        payload,
        saveBtn,
        originalBtnText
      );
    }
  }

  // Helper method to save changes with the correct ID
  saveIncompleteChangesWithId(
    registrationId,
    payload,
    saveBtn,
    originalBtnText
  ) {
    // Make the actual API call
    return fetch(
      `/api/admin/incomplete-registrations/${registrationId}/responses`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
        body: JSON.stringify(payload),
      }
    )
      .then((response) => {
        if (!response.ok) {
          console.error("Response not OK:", response.status);
          return response.text().then((text) => {
            console.error("Response body:", text);
            throw new Error(`HTTP error! Status: ${response.status}`);
          });
        }
        return response.json();
      })
      .then((data) => {
        // Reset edited fields
        this.editedFields = {};
        this.updateSaveButtonState();

        // Remove the has-changes class after saving
        const editBtn = document.getElementById("incompleteEditBtn");
        if (editBtn) {
          editBtn.classList.remove("has-changes");
          editBtn.classList.remove("pulse-animation");
        }

        // Exit edit mode
        this.isEditMode = false;
        const editBtnText = document.getElementById("incompleteEditBtnText");
        if (editBtnText) {
          editBtnText.textContent = "Complete Form";
        }

        // Show success message
        this.showToast(
          "Changes Saved",
          "The registration information has been updated successfully."
        );

        // Add a short delay before refreshing the view
        setTimeout(() => {
          // Refresh the view
          this.viewIncompleteRegistration(registrationId);
        }, 1000);
      })
      .catch((error) => {
        console.error("Error saving changes:", error);
        alert(`Error saving changes: ${error.message}`);
      })
      .finally(() => {
        // Reset button state
        saveBtn.innerHTML = originalBtnText;
        saveBtn.disabled = false;
      });
  }

  async completeRegistration() {
    try {
      if (this.isEditMode && Object.keys(this.editedFields).length > 0) {
        // If we're in edit mode with changes, save first
        await this.saveIncompleteChanges();
      }

      // Confirm with the user
      if (
        !confirm(
          "Are you sure you want to mark this registration as complete? It will be moved to the applications queue for review."
        )
      ) {
        return;
      }

      // Show loading state
      const completeBtn = document.getElementById("incompleteCompleteBtn");
      const originalBtnText = completeBtn.innerHTML;
      completeBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm" role="status"></span> Processing...';
      completeBtn.disabled = true;

      // For placeholder registrations (new users who haven't started),
      // we need to first create a registration record in the database
      let registrationId = this.currentIncompleteRegId;

      // Convert to string to safely use string methods
      const registrationIdStr = registrationId.toString();

      const isUserIdOnly =
        registrationIdStr.startsWith("TEMP-") ||
        (this.currentRegistration && this.currentRegistration.id === null);

      try {
        // If this is just a userId without a registration record
        if (isUserIdOnly) {
          // Extract userId from TEMP-ID or use the currentRegistration.userId
          const userId = registrationIdStr.startsWith("TEMP-")
            ? registrationIdStr.replace("TEMP-", "")
            : this.currentRegistration
            ? this.currentRegistration.userId
            : registrationId;

          // First create a registration record
          const createResponse = await fetch(
            "/api/admin/incomplete-registrations/create",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${AuthManager.getAuthToken()}`,
              },
              body: JSON.stringify({ userId: userId }),
            }
          );

          if (!createResponse.ok) {
            throw new Error(
              `Failed to create registration record: ${createResponse.status}`
            );
          }

          const createData = await createResponse.json();
          registrationId = createData.registrationId;
        }

        // Now call the API to mark the registration as complete
        const response = await fetch(
          `/api/admin/incomplete-registrations/${registrationId}/complete`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${AuthManager.getAuthToken()}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        this.showToast(
          "Registration Completed",
          `The registration has been marked as complete and moved to the applications queue with ID: ${data.applicationId}`
        );

        // Close the modal
        const modal = bootstrap.Modal.getInstance(
          document.getElementById("incompleteRegistrationModal")
        );
        if (modal) {
          modal.hide();
        }

        // Refresh the incomplete registrations list with the same filter that was active
        const inactivitySelect = document.getElementById(
          "incompleteInactivityFilter"
        );
        if (inactivitySelect) {
          // Keep the same filter value
          this.loadIncompleteRegistrations();
        } else {
          // Default
          this.loadIncompleteRegistrations();
        }
      } catch (apiError) {
        console.error("API Error:", apiError);
        alert(`Failed to mark registration as complete: ${apiError.message}`);
      } finally {
        // Reset button state regardless of success or failure
        completeBtn.innerHTML = originalBtnText;
        completeBtn.disabled = false;
      }
    } catch (error) {
      console.error("Error completing registration:", error);
      alert("Failed to complete registration. Please try again.");
    }
  }

  showToast(title, message, type = "success") {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById("toastContainer");
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.id = "toastContainer";
      toastContainer.className =
        "toast-container position-fixed bottom-0 end-0 p-3";
      toastContainer.style.zIndex = "1080";
      document.body.appendChild(toastContainer);
    }

    // Create toast element
    const toastId = `toast_${Date.now()}`;
    const toast = document.createElement("div");
    toast.id = toastId;
    toast.className = `toast ${
      type === "success" ? "bg-success" : "bg-danger"
    } text-white`;
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "assertive");
    toast.setAttribute("aria-atomic", "true");
    toast.innerHTML = `
      <div class="toast-header ${
        type === "success" ? "bg-success" : "bg-danger"
      } text-white">
        <strong class="me-auto">${title}</strong>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body">
        ${message}
      </div>
    `;

    // Add to container
    toastContainer.appendChild(toast);

    // Show toast
    const toastInstance = new bootstrap.Toast(toast, {
      autohide: true,
      delay: 5000,
    });
    toastInstance.show();

    // Remove after hiding
    toast.addEventListener("hidden.bs.toast", () => {
      toast.remove();
    });
  }

  async loadRecentApplications() {
    try {
      const response = await fetch("/api/admin/recent-applications", {
        headers: {
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch applications");

      const applications = await response.json();
      const tbody = document.getElementById("recentApplications");

      if (applications.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="text-center">
              <div class="p-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-3 text-muted">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p class="text-muted">No applications waiting for review.</p>
              </div>
            </td>
          </tr>
        `;
        return;
      }

      // Always show only level 1 for the recent applications view
      const displayLevel = 1;

      tbody.innerHTML = applications
        .map(
          (app) => `
          <tr class="clickable-row" onclick="dashboardManager.viewApplication('${
            app.applicationId
          }')">
            <td data-label="Application ID">${app.applicationId}</td>
            <td data-label="Applicant Name">${app.applicantName}</td>
            <td data-label="Submission Date">${new Date(
              app.submittedAt
            ).toLocaleDateString()}</td>
            <td data-label="Type of Disability">${
              app.disabilityType || "Not specified"
            }</td>
            <td data-label="Location">${this.parseLocationDisplay(
              app.location,
              displayLevel
            )}</td>
          </tr>
        `
        )
        .join("");
    } catch (error) {
      console.error("Error:", error);
      const tbody = document.getElementById("recentApplications");
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-4 text-danger">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-3">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12" y2="16"/>
            </svg>
            <p>Failed to load applications. Please try again.</p>
            <button class="btn btn-outline-primary btn-sm mt-2" onclick="dashboardManager.loadRecentApplications()">Retry</button>
          </td>
        </tr>
      `;
    }
  }

  async viewApplication(applicationId) {
    try {
      // Reset edit mode and edited fields
      this.isEditMode = false;
      this.editedFields = {};
      this.currentApplicationId = applicationId;

      const response = await fetch(`/api/admin/applications/${applicationId}`, {
        headers: {
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
      });

      if (response.status === 401) {
        // Session expired
        alert("Your session has expired. Please login again.");
        window.location.href = "/department-login";
        return;
      }

      if (!response.ok) throw new Error("Failed to fetch application");

      const data = await response.json();

      // Update modal content
      document.getElementById("modalApplicationId").textContent =
        data.applicationId;

      // Update modal header
      document.getElementById("modalSubmissionDate").textContent = new Date(
        data.submittedAt
      ).toLocaleDateString();

      // Update status badge - rely on CSS for styling
      const statusBadge = document.getElementById("modalStatus");
      // Reset any inline styles that might have been applied
      statusBadge.removeAttribute("style");
      // Set class only
      statusBadge.className = `status-badge ${
        data.service_status || "pending"
      }`;
      // Set text content only
      statusBadge.textContent = this.formatStatus(
        data.service_status || "pending"
      );

      // Update status info
      const statusInfo = document.getElementById("statusInfo");
      if (!data.last_updated_by || !data.last_action_at) {
        statusInfo.innerHTML = `
          <small class="text-muted">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="me-1">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            Awaiting initial review
          </small>`;
      } else {
        statusInfo.innerHTML = `
          <small class="text-muted">
            Last updated by <span id="lastUpdatedBy">${data.last_updated_by}</span> on
            <span id="lastUpdatedAt">${data.last_action_at}</span>
          </small>`;
      }

      // Populate form sections
      const formDataContainer = document.getElementById("modalFormData");
      formDataContainer.innerHTML = this.renderFormSections(data.sections);

      // Update button visibility based on status
      const approveBtn = document.getElementById("approveBtn");
      const rejectBtn = document.getElementById("rejectBtn");
      const undoBtn = document.getElementById("undoBtn");
      const editBtn = document.getElementById("editBtn");
      const historyBtn = document.getElementById("historyBtn");
      const editBtnText = document.getElementById("editBtnText");

      editBtnText.textContent = "Edit Responses";

      // Ensure the button always has the btn-primary class
      editBtn.classList.remove("btn-outline-primary");
      editBtn.classList.add("btn-primary");
      editBtn.classList.remove("pulse-animation");
      editBtn.classList.remove("has-changes");

      const currentStatus = data.service_status || "pending";

      if (
        ["pending", "under_review"].includes(currentStatus) ||
        !currentStatus
      ) {
        // Initial state or after undo - show approve/reject
        approveBtn.style.display = "inline-flex";
        rejectBtn.style.display = "inline-flex";
        undoBtn.style.display = "none";
      } else {
        // After a decision is made - show only undo
        approveBtn.style.display = "none";
        rejectBtn.style.display = "none";
        undoBtn.style.display = "inline-flex";
      }

      // Show the modal
      const modal = new bootstrap.Modal(
        document.getElementById("applicationModal")
      );
      modal.show();
    } catch (error) {
      if (error.message.includes("Failed to fetch")) {
        alert(
          "Connection error. Please check your internet connection and try again."
        );
      } else {
        alert("Failed to load application details. Please refresh the page.");
      }
    }
  }

  renderFormSections(sections) {
    // Split sections into two columns
    const midPoint = Math.ceil(sections.length / 2);
    const leftSections = sections.slice(0, midPoint);
    const rightSections = sections.slice(midPoint);

    return `
      <div class="form-section-column">
        ${leftSections
          .map(
            (section) => `
            <div class="form-section">
              <h5>${section.name}</h5>
              ${section.fields
                .map((field) => {
                  if (
                    field.field_type === "nested-select" &&
                    !this.isEditMode
                  ) {
                    return this.renderNestedSelectFields(field);
                  }
                  return `
                    <div class="form-field ${
                      this.isEditMode ? "edit-mode" : ""
                    }">
                      <div class="field-label">${field.display_name}</div>
                      <div class="field-value">${this.renderFieldValue(
                        field
                      )}</div>
                    </div>
                  `;
                })
                .join("")}
            </div>
          `
          )
          .join("")}
      </div>
      <div class="form-section-column">
        ${rightSections
          .map(
            (section) => `
            <div class="form-section">
              <h5>${section.name}</h5>
              ${section.fields
                .map((field) => {
                  if (
                    field.field_type === "nested-select" &&
                    !this.isEditMode
                  ) {
                    return this.renderNestedSelectFields(field);
                  }
                  return `
                    <div class="form-field ${
                      this.isEditMode ? "edit-mode" : ""
                    }">
                      <div class="field-label">${field.display_name}</div>
                      <div class="field-value">${this.renderFieldValue(
                        field
                      )}</div>
                    </div>
                  `;
                })
                .join("")}
            </div>
          `
          )
          .join("")}
      </div>
    `;
  }

  renderNestedSelectFields(field) {
    try {
      // If we're in edit mode, we should return a single field container
      // instead of multiple separate fields for each level
      if (this.isEditMode) {
        return `
          <div class="form-field">
            <div class="field-label">${field.display_name}</div>
            <div class="field-value">${this.renderEditableField(field)}</div>
          </div>
        `;
      }

      // Split the comma-separated values
      const values = field.value
        ? field.value.split(",").map((v) => v.trim())
        : [];

      // Try to parse the nested configuration
      let nestedConfig = null;
      if (field.options) {
        try {
          nestedConfig = JSON.parse(field.options);

          // Handle double-encoded JSON
          if (typeof nestedConfig === "string") {
            nestedConfig = JSON.parse(nestedConfig);
          }
        } catch (e) {
          // console.error("Failed to parse field.options:", e);
        }
      }

      // Generate fields for each level using the configuration
      return values
        .map((value, index) => {
          const levelName =
            nestedConfig && nestedConfig[index]
              ? nestedConfig[index].name
              : "Missing level name";
          return `
            <div class="form-field">
              <div class="field-label">${levelName}</div>
              <div class="nested-values">
                <div class="form-field">
                  <div class="field-value">${value || "-"}</div>
                </div>
              </div>
            </div>
          `;
        })
        .join("");
    } catch (error) {
      return `
        <div class="form-field">
          <div class="field-label">${field.display_name}</div>
          <div class="nested-values">
            <div class="form-field">
              <div class="field-value">Error: ${error.message}</div>
            </div>
          </div>
        </div>
      `;
    }
  }

  renderFieldValue(field) {
    if (!field.value && !this.isEditMode) return "-";

    if (this.isEditMode) {
      return this.renderEditableField(field);
    }

    switch (field.field_type) {
      case "file":
        return field.value
          ? `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
              <polyline points="13 2 13 9 20 9"></polyline>
            </svg>
            <button onclick="previewDocument('${field.value}')" class="btn btn-link p-0">View Document</button>
          `
          : "-";

      case "checkbox":
        try {
          const values = field.value.split(",");
          return values.join(", ");
        } catch (e) {
          return field.value;
        }

      case "nested-select":
        // In view mode, we display the comma-separated values directly
        // The detailed view is handled by renderNestedSelectFields
        return field.value ? field.value.split(",").join(", ") : "-";

      default:
        return field.value;
    }
  }

  renderEditableField(field) {
    const fieldId = field.id;
    const fieldValue = field.value || "";
    const fieldName = `field_${fieldId}`;

    switch (field.field_type) {
      case "text":
      case "alphanumeric":
      case "email":
      case "phone":
        return `
          <div class="edit-field-container">
            <input type="text" class="form-control edit-field" id="${fieldName}" value="${fieldValue}" 
              data-field-id="${fieldId}" data-original-value="${fieldValue}" 
              onchange="dashboardManager.handleFieldEdit(this)">
          </div>
        `;

      case "date":
        return `
          <div class="edit-field-container">
            <input type="date" class="form-control edit-field" id="${fieldName}" value="${fieldValue}" 
              data-field-id="${fieldId}" data-original-value="${fieldValue}" 
              onchange="dashboardManager.handleFieldEdit(this)">
          </div>
        `;

      case "nested-select":
        try {
          // Parse the nested configuration
          let nestedConfig;
          try {
            nestedConfig = JSON.parse(field.options || "[]");

            // Handle double-encoded JSON
            if (typeof nestedConfig === "string") {
              nestedConfig = JSON.parse(nestedConfig);
            }
          } catch (e) {
            console.error("Failed to parse nested config:", e);
            throw new Error("Invalid nested dropdown configuration");
          }

          if (!Array.isArray(nestedConfig)) {
            console.error("nestedConfig is not an array:", nestedConfig);
            throw new Error("Invalid nested dropdown configuration");
          }

          if (!nestedConfig.length) return "";

          // Get saved values if any
          const savedValues = fieldValue
            ? fieldValue.split(",").map((v) => v.trim())
            : [];

          let html = `<div class="edit-field-container nested-select-container" id="${fieldName}_container">`;

          // Create each level's dropdown
          nestedConfig.forEach((level, index) => {
            html += `
              <div class="form-group mb-3">
                <label class="form-label">${level.name}</label>
                <select
                  class="form-select edit-field nested-select-level"
                  name="${fieldName}_level_${index + 1}"
                  data-level="${index + 1}"
                  data-field-id="${fieldId}"
                  ${index > 0 && !savedValues[index - 1] ? "disabled" : ""}
                >
                  <option value="">Select ${level.name}</option>
                  ${
                    index === 0 && level.options
                      ? typeof level.options === "string"
                        ? level.options
                            .split("\n")
                            .map((opt) => opt.trim())
                            .filter((opt) => opt)
                            .map(
                              (opt) =>
                                `<option value="${opt}" ${
                                  savedValues[0] === opt ? "selected" : ""
                                }>${opt}</option>`
                            )
                            .join("")
                        : Array.isArray(level.options)
                        ? level.options
                            .map(
                              (opt) =>
                                `<option value="${opt}" ${
                                  savedValues[0] === opt ? "selected" : ""
                                }>${opt}</option>`
                            )
                            .join("")
                        : ""
                      : ""
                  }
                </select>
              </div>
            `;
          });

          // Add hidden input to store the complete value
          html += `
            <input type="hidden" id="${fieldName}" 
              data-field-id="${fieldId}" 
              data-original-value="${fieldValue}" 
              value="${fieldValue}">
          </div>`;

          // Add the change event listeners and populate saved values after the HTML is added to the DOM
          setTimeout(() => {
            const container = document.getElementById(`${fieldName}_container`);
            if (!container) return;

            // Set up event listeners
            container.querySelectorAll("select").forEach((select) => {
              select.addEventListener("change", async function () {
                const selectedValue = this.value;
                const currentLevel = parseInt(this.dataset.level);
                const fieldId = this.dataset.fieldId;

                // Find all subsequent selects
                const subsequentSelects = Array.from(
                  container.querySelectorAll("select")
                ).filter((s) => parseInt(s.dataset.level) > currentLevel);

                // Clear and disable all subsequent dropdowns
                subsequentSelects.forEach((select) => {
                  const selectLevel = parseInt(select.dataset.level);
                  select.innerHTML = `<option value="">Select ${
                    nestedConfig[selectLevel - 1].name
                  }</option>`;
                  select.disabled = true;
                });

                if (subsequentSelects.length && selectedValue) {
                  const nextLevel = nestedConfig[currentLevel];

                  const nextSelect = subsequentSelects[0];

                  // Enable the immediate next dropdown
                  nextSelect.disabled = false;

                  if (
                    typeof nextLevel.options === "string" &&
                    nextLevel.options.includes("/api/")
                  ) {
                    try {
                      const endpoint = nextLevel.options.replace(
                        "{parent}",
                        selectedValue
                      );
                      const response = await fetch(endpoint);
                      const data = await response.json();

                      data.forEach((item) => {
                        const option = document.createElement("option");
                        option.value = item.id || item.value || item;
                        option.textContent = item.name || item.label || item;
                        nextSelect.appendChild(option);
                      });

                      // Select saved value if exists
                      const hiddenInput = document.getElementById(fieldName);
                      const savedValues = hiddenInput.value
                        ? hiddenInput.value.split(",").map((v) => v.trim())
                        : [];

                      if (savedValues[currentLevel]) {
                        nextSelect.value = savedValues[currentLevel];
                        nextSelect.dispatchEvent(new Event("change"));
                      }
                    } catch (error) {
                      console.error("Error fetching nested options:", error);
                    }
                  } else {
                    // Handle static options
                    let parentOptions;
                    if (typeof nextLevel.options === "string") {
                      parentOptions = nextLevel.options
                        .split("\n")
                        .map((opt) => opt.trim())
                        .filter((opt) => opt);
                    } else if (Array.isArray(nextLevel.options)) {
                      parentOptions = nextLevel.options;
                    } else {
                      parentOptions = [];
                    }

                    const selectedParentOptions =
                      typeof nextLevel.options === "string"
                        ? parentOptions
                            .find((opt) => opt.startsWith(`${selectedValue}:`))
                            ?.split(":")?.[1]
                        : null;

                    if (selectedParentOptions) {
                      const options = selectedParentOptions
                        .split(",")
                        .map((opt) => opt.trim())
                        .filter((opt) => opt);

                      options.forEach((opt) => {
                        const option = document.createElement("option");
                        option.value = opt;
                        option.textContent = opt;
                        nextSelect.appendChild(option);
                      });

                      // Select saved value if exists
                      const hiddenInput = document.getElementById(fieldName);
                      const savedValues = hiddenInput.value
                        ? hiddenInput.value.split(",").map((v) => v.trim())
                        : [];

                      if (savedValues[currentLevel]) {
                        nextSelect.value = savedValues[currentLevel];
                        nextSelect.dispatchEvent(new Event("change"));
                      }
                    }
                  }
                }

                // Update the hidden input with all selected values
                const selects = Array.from(
                  container.querySelectorAll("select")
                );
                const values = selects
                  .map((select) => select.value)
                  .filter((v) => v);
                const hiddenInput = document.getElementById(fieldName);
                const originalValue = hiddenInput.dataset.originalValue;
                const newValue = values.join(",");

                // Update the hidden input
                hiddenInput.value = newValue;

                // Add to edited fields if changed
                if (originalValue !== newValue) {
                  // Get the display name from the form field container
                  const formField = container.closest(".form-field");
                  let displayName = fieldName;

                  if (formField && formField.querySelector(".field-label")) {
                    displayName =
                      formField.querySelector(".field-label").textContent;
                  } else {
                    // Try to find the label from the first select's label
                    const firstSelect = container.querySelector("select");
                    if (firstSelect) {
                      const label = firstSelect.previousElementSibling;
                      if (label && label.classList.contains("form-label")) {
                        displayName = label.textContent;
                      }
                    }
                  }

                  dashboardManager.editedFields[fieldId] = {
                    value: newValue,
                    originalValue: originalValue,
                    label: displayName,
                  };
                } else {
                  delete dashboardManager.editedFields[fieldId];
                }

                // Update save button state
                dashboardManager.updateSaveButtonState();
              });
            });

            // Trigger change events for saved values
            if (savedValues.length > 0) {
              const firstSelect = container.querySelector("select");
              if (firstSelect && savedValues[0]) {
                firstSelect.value = savedValues[0];
                firstSelect.dispatchEvent(new Event("change"));
              }
            }
          }, 0);

          return html;
        } catch (error) {
          console.error("Error rendering nested select:", error);
          return `
            <div class="edit-field-container">
              <input type="text" class="form-control edit-field" id="${fieldName}" value="${fieldValue}" 
                data-field-id="${fieldId}" data-original-value="${fieldValue}" 
                onchange="dashboardManager.handleFieldEdit(this)">
              <small class="text-danger">Error rendering nested dropdown: ${error.message}</small>
            </div>
          `;
        }

      case "select":
      case "radio":
        try {
          const options = JSON.parse(field.options);
          const optionsList = Array.isArray(options)
            ? options
            : options.options || [];

          return `
            <div class="edit-field-container">
              <select class="form-select edit-field" id="${fieldName}" 
                data-field-id="${fieldId}" data-original-value="${fieldValue}" 
                onchange="dashboardManager.handleFieldEdit(this)">
                <option value="">Select an option</option>
                ${optionsList
                  .map(
                    (opt) => `
                  <option value="${opt}" ${
                      opt === fieldValue ? "selected" : ""
                    }>${opt}</option>
                `
                  )
                  .join("")}
              </select>
            </div>
          `;
        } catch (e) {
          return `
            <div class="edit-field-container">
              <input type="text" class="form-control edit-field" id="${fieldName}" value="${fieldValue}" 
                data-field-id="${fieldId}" data-original-value="${fieldValue}" 
                onchange="dashboardManager.handleFieldEdit(this)">
            </div>
          `;
        }

      case "checkbox":
        try {
          const values = fieldValue ? fieldValue.split(",") : [];
          const options = JSON.parse(field.options);
          const optionsList = Array.isArray(options)
            ? options
            : options.options || [];

          return `
            <div class="edit-field-container">
              ${optionsList
                .map(
                  (opt, idx) => `
                <div class="form-check">
                  <input class="form-check-input edit-field-checkbox" type="checkbox" 
                    id="${fieldName}_${idx}" value="${opt}" ${
                    values.includes(opt) ? "checked" : ""
                  } 
                    data-field-id="${fieldId}" data-field-name="${fieldName}" 
                    onchange="dashboardManager.handleCheckboxEdit('${fieldName}')">
                  <label class="form-check-label" for="${fieldName}_${idx}">${opt}</label>
                </div>
              `
                )
                .join("")}
            </div>
          `;
        } catch (e) {
          return `
            <div class="edit-field-container">
              <input type="text" class="form-control edit-field" id="${fieldName}" value="${fieldValue}" 
                data-field-id="${fieldId}" data-original-value="${fieldValue}" 
                onchange="dashboardManager.handleFieldEdit(this)">
            </div>
          `;
        }

      case "file":
        return `
          <div class="edit-field-container">
            <div class="current-file mb-2">
              ${
                fieldValue
                  ? `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                  <polyline points="13 2 13 9 20 9"></polyline>
                </svg>
                <span>${fieldValue.split("/").pop()}</span>
                <button type="button" onclick="previewDocument('${fieldValue}')" class="btn btn-link p-0 ms-2">View</button>
                <button type="button" onclick="dashboardManager.removeFile(${fieldId}, '${fieldName}')" class="btn btn-link text-danger p-0 ms-2">Remove</button>
                `
                  : "<span class='text-muted'>No file currently uploaded</span>"
              }
            </div>
            <div class="file-upload-container" data-field-id="${fieldId}" data-field-name="${fieldName}">
              <input type="file" class="form-control edit-field-file" id="${fieldName}_file" 
                data-field-id="${fieldId}" data-original-value="${
          fieldValue || ""
        }" 
                onchange="dashboardManager.handleFileUpload(this)">
              <div class="upload-progress" style="display: none;">
                <div class="progress mt-2">
                  <div class="progress-bar" role="progressbar" style="width: 0%"></div>
            </div>
              </div>
            </div>
            <input type="hidden" id="${fieldName}" value="${fieldValue || ""}" 
              data-field-id="${fieldId}" data-original-value="${
          fieldValue || ""
        }">
          </div>
        `;

      default:
        return `
          <div class="edit-field-container">
            <input type="text" class="form-control edit-field" id="${fieldName}" value="${fieldValue}" 
              data-field-id="${fieldId}" data-original-value="${fieldValue}" 
              onchange="dashboardManager.handleFieldEdit(this)">
          </div>
        `;
    }
  }

  handleFieldEdit(element) {
    const fieldId = element.dataset.fieldId;
    const originalValue = element.dataset.originalValue;
    const newValue = element.value;

    // Get the display name from the closest form-field's field-label
    const formField = element.closest(".form-field");
    let displayName = fieldId;

    if (formField && formField.querySelector(".field-label")) {
      displayName = formField.querySelector(".field-label").textContent;
    } else {
      // Try to find the label from the first select's label
      const firstSelect = element
        .closest(".edit-field-container")
        .querySelector("select");
      if (firstSelect) {
        const label = firstSelect.previousElementSibling;
        if (label && label.classList.contains("form-label")) {
          displayName = label.textContent;
        }
      }
    }

    if (originalValue !== newValue) {
      // Store field information with proper structure
      this.editedFields[fieldId] = {
        value: newValue,
        originalValue: originalValue,
        label: displayName,
      };

      // Add visual feedback for edited fields
      element.setAttribute("data-edited", "true");

      // Add animation class to parent container
      const container = element.closest(".edit-field-container");
      if (container) {
        container.classList.add("field-edited");

        // Remove the animation class after it completes to allow it to be triggered again
        setTimeout(() => {
          container.classList.remove("field-edited");
        }, 2000);
      }

      // Add the has-changes class to the Edit button to trigger animation
      document.getElementById("editBtn").classList.add("has-changes");
    } else {
      delete this.editedFields[fieldId];

      // Remove visual feedback
      element.removeAttribute("data-edited");

      // If no fields are edited, remove the has-changes class
      if (Object.keys(this.editedFields).length === 0) {
        document.getElementById("editBtn").classList.remove("has-changes");
      }
    }

    // Update save button state
    this.updateSaveButtonState();
  }

  handleCheckboxEdit(fieldName) {
    const checkboxes = document.querySelectorAll(
      `input[data-field-name="${fieldName}"]:checked`
    );
    const values = Array.from(checkboxes).map((cb) => cb.value);
    const fieldId =
      checkboxes.length > 0 ? checkboxes[0].dataset.fieldId : null;

    if (!fieldId) return;

    // Get the hidden input field
    const hiddenInput = document.getElementById(fieldName);
    const originalValue = hiddenInput.dataset.originalValue;
    const newValue = values.join(",");

    // Get the display name from the closest form-field's field-label
    const formField = checkboxes[0].closest(".form-field");
    let displayName = fieldName;

    if (formField && formField.querySelector(".field-label")) {
      displayName = formField.querySelector(".field-label").textContent;
    } else {
      // Try to find the label from the first select's label
      const firstSelect = checkboxes[0]
        .closest(".edit-field-container")
        .querySelector("select");
      if (firstSelect) {
        const label = firstSelect.previousElementSibling;
        if (label && label.classList.contains("form-label")) {
          displayName = label.textContent;
        }
      }
    }

    // Update the hidden input
    hiddenInput.value = newValue;

    // Add to edited fields if changed
    if (originalValue !== newValue) {
      this.editedFields[fieldId] = {
        value: newValue,
        originalValue: originalValue,
        label: displayName,
      };

      // Add visual feedback for edited checkbox group
      const container = checkboxes[0].closest(".edit-field-container");
      if (container) {
        container.classList.add("field-edited");

        // Add a subtle highlight to all checkboxes in the group
        const allCheckboxes = document.querySelectorAll(
          `input[data-field-name="${fieldName}"]`
        );
        allCheckboxes.forEach((cb) => {
          cb.parentElement.style.transition = "background-color 0.3s ease";
          cb.parentElement.style.backgroundColor =
            "rgba(var(--primary-color-rgb), 0.05)";

          // Reset after animation completes
          setTimeout(() => {
            cb.parentElement.style.backgroundColor = "";
          }, 2000);
        });

        // Remove the animation class after it completes
        setTimeout(() => {
          container.classList.remove("field-edited");
        }, 2000);
      }

      // Add the has-changes class to the Edit button to trigger animation
      document.getElementById("editBtn").classList.add("has-changes");
    } else {
      delete this.editedFields[fieldId];

      // Remove visual feedback
      const allCheckboxes = document.querySelectorAll(
        `input[data-field-name="${fieldName}"]`
      );
      allCheckboxes.forEach((cb) => {
        cb.parentElement.style.backgroundColor = "";
      });

      // If no fields are edited, remove the has-changes class
      if (Object.keys(this.editedFields).length === 0) {
        document.getElementById("editBtn").classList.remove("has-changes");
      }
    }

    // Update save button state
    this.updateSaveButtonState();
  }

  updateSaveButtonState() {
    const editBtnText = document.getElementById("editBtnText");
    const editBtn = document.getElementById("editBtn");
    const hasChanges = Object.keys(this.editedFields).length > 0;

    if (this.isEditMode) {
      // Update button text
      editBtnText.textContent = hasChanges ? "Save Changes" : "Cancel Edit";

      // Update button styling based on state
      if (hasChanges) {
        // Make the save button more prominent when there are changes
        editBtn.classList.remove("btn-outline-primary");
        editBtn.classList.add("btn-primary");

        // Add a pulsing effect to draw attention
        editBtn.classList.add("pulse-animation");

        // Add an icon to indicate saving action
        editBtnText.innerHTML = `
          Save Changes
        `;

        // Show the number of fields edited
        const fieldCount = Object.keys(this.editedFields).length;
        const badge = document.createElement("span");
        badge.className = "badge bg-white text-primary ms-2";
        badge.textContent = fieldCount > 1 ? `${fieldCount} fields` : "1 field";
        badge.style.fontSize = "0.75rem";

        // Remove any existing badge before adding a new one
        const existingBadge = editBtn.querySelector(".badge");
        if (existingBadge) {
          existingBadge.remove();
        }

        editBtn.appendChild(badge);
      } else {
        // Reset to default styling when no changes but keep btn-primary
        editBtn.classList.remove("pulse-animation");
        // Ensure the button always keeps the btn-primary class
        editBtn.classList.remove("btn-outline-primary");
        editBtn.classList.add("btn-primary");
        editBtnText.textContent = "Cancel Edit";

        // Remove any badge
        const existingBadge = editBtn.querySelector(".badge");
        if (existingBadge) {
          existingBadge.remove();
        }
      }
    }
  }

  toggleIncompleteEditMode() {
    const editBtnText = document.getElementById("incompleteEditBtnText");
    const editBtn = document.getElementById("incompleteEditBtn");

    // Set the flag to indicate we're working with an incomplete registration
    this.isIncompleteRegistration = true;

    if (this.isEditMode) {
      // If we have changes and we're in edit mode, save the changes
      if (Object.keys(this.editedFields).length > 0) {
        this.saveIncompleteChanges();
        return;
      }

      // Otherwise, just exit edit mode
      this.isEditMode = false;
      editBtnText.textContent = "Complete Form";

      // Remove the has-changes class when exiting edit mode
      editBtn.classList.remove("has-changes");
      editBtn.classList.remove("pulse-animation");

      // Refresh the registration view to reset the form
      this.viewIncompleteRegistration(this.currentIncompleteRegId);
    } else {
      // Enter edit mode
      this.isEditMode = true;
      editBtnText.textContent = "Save Changes";
      this.editedFields = {};

      // Add pulse animation to indicate edit mode
      editBtn.classList.add("btn-primary");

      // Refresh the form to show editable fields
      this.refreshIncompleteRegistrationForEdit();
    }
  }

  toggleEditMode() {
    const editBtnText = document.getElementById("editBtnText");
    const editBtn = document.getElementById("editBtn");

    // Set the flag to indicate we're working with a regular application, not an incomplete registration
    this.isIncompleteRegistration = false;

    if (this.isEditMode) {
      // If we have changes and we're in edit mode, save the changes
      if (Object.keys(this.editedFields).length > 0) {
        this.saveChanges();
        return;
      }

      // Otherwise, just exit edit mode
      this.isEditMode = false;
      editBtn.classList.remove("btn-primary");
      editBtnText.textContent = "Edit Responses";

      // Remove the has-changes class
      editBtn.classList.remove("has-changes");

      // Refresh the application view to reset the form
      this.refreshApplicationForEdit();
    } else {
      // Enter edit mode
      this.isEditMode = true;
      editBtn.classList.add("btn-primary");
      editBtnText.textContent = "Save Changes";
      this.editedFields = {};

      // Refresh the form to show editable fields
      this.refreshApplicationForEdit();
    }
  }

  async refreshApplicationForEdit() {
    try {
      const response = await fetch(
        `/api/admin/applications/${this.currentApplicationId}`,
        {
          headers: {
            Authorization: `Bearer ${AuthManager.getAuthToken()}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch application");

      const data = await response.json();

      // Populate form sections with editable fields
      const formDataContainer = document.getElementById("modalFormData");
      formDataContainer.innerHTML = this.renderFormSections(data.sections);
    } catch (error) {
      console.error("Error refreshing application for edit:", error);
      alert("Failed to prepare form for editing. Please try again.");
      this.isEditMode = false;
    }
  }

  async saveChanges() {
    const editedFieldIds = Object.keys(this.editedFields);
    if (editedFieldIds.length === 0) {
      alert("No changes to save.");
      return;
    }

    // Populate the edit summary list
    const editSummaryList = document.getElementById("editSummaryList");
    editSummaryList.innerHTML = "";

    // Set explicit styles on the container
    editSummaryList.style.width = "100%";
    editSummaryList.style.display = "block";
    editSummaryList.style.boxSizing = "border-box";

    // Update the count badge
    document.getElementById("editedFieldsCount").textContent = `${
      editedFieldIds.length
    } field${editedFieldIds.length > 1 ? "s" : ""}`;

    // Add each edited field to the summary
    editedFieldIds.forEach((fieldId) => {
      const field = this.editedFields[fieldId];
      // Use the label property which contains the display_name for all field types including nested dropdowns
      const fieldName = field.label || fieldId;
      const oldValue =
        field.originalValue !== null && field.originalValue !== undefined
          ? field.originalValue
          : "(empty)";
      const newValue =
        field.value !== null && field.value !== undefined
          ? field.value
          : "(empty)";

      // Create directly with minimal nesting
      const summaryItem = document.createElement("div");
      summaryItem.className = "edit-summary-item";
      summaryItem.style.width = "100%";
      summaryItem.style.display = "block";
      summaryItem.style.boxSizing = "border-box";
      summaryItem.style.marginBottom = "1rem";
      summaryItem.style.padding = "1.25rem";
      summaryItem.style.borderRadius = "10px";
      summaryItem.style.borderLeft = "4px solid #6366f1";
      summaryItem.style.backgroundColor = "white";
      summaryItem.style.boxShadow = "0 3px 10px rgba(0, 0, 0, 0.04)";

      // Field name
      const nameElement = document.createElement("div");
      nameElement.className = "edit-field-name";
      nameElement.style.width = "100%";
      nameElement.style.display = "block";
      nameElement.style.marginBottom = "0.5rem";
      nameElement.style.fontWeight = "600";
      nameElement.style.fontSize = "1.1rem";
      nameElement.style.color = "#374151";
      nameElement.textContent = fieldName;
      summaryItem.appendChild(nameElement);

      // Change container
      const changeContainer = document.createElement("div");
      changeContainer.className = "edit-field-change";
      changeContainer.style.display = "grid";
      changeContainer.style.gridTemplateColumns = "1fr 40px 1fr";
      changeContainer.style.width = "100%";
      changeContainer.style.boxSizing = "border-box";
      changeContainer.style.alignItems = "center";
      changeContainer.style.marginTop = "0.5rem";

      // Old value container
      const oldValueContainer = document.createElement("div");
      oldValueContainer.className = "edit-field-old";
      oldValueContainer.style.width = "100%";

      const oldValueLabel = document.createElement("div");
      oldValueLabel.className = "value-label";
      oldValueLabel.style.fontSize = "0.8rem";
      oldValueLabel.style.fontWeight = "500";
      oldValueLabel.style.color = "#6b7280";
      oldValueLabel.style.marginBottom = "0.25rem";
      oldValueLabel.style.textTransform = "uppercase";
      oldValueLabel.textContent = "Previous Value";
      oldValueContainer.appendChild(oldValueLabel);

      const oldValueContent = document.createElement("div");
      oldValueContent.className = "value-container";
      oldValueContent.style.backgroundColor = "#f9fafb";
      oldValueContent.style.border = "1px solid #e5e7eb";
      oldValueContent.style.borderRadius = "8px";
      oldValueContent.style.padding = "0.75rem";
      oldValueContent.style.minHeight = "2.5rem";
      oldValueContent.style.wordBreak = "break-word";
      oldValueContent.style.lineHeight = "1.5";
      oldValueContent.style.width = "100%";
      oldValueContent.style.color = "#6b7280";
      oldValueContent.style.boxSizing = "border-box";
      oldValueContent.textContent = oldValue;
      oldValueContainer.appendChild(oldValueContent);

      // Arrow
      const arrowContainer = document.createElement("div");
      arrowContainer.className = "edit-arrow";
      arrowContainer.style.display = "flex";
      arrowContainer.style.justifyContent = "center";
      arrowContainer.style.color = "#9ca3af";
      arrowContainer.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-arrow-right" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
        </svg>
      `;

      // New value container
      const newValueContainer = document.createElement("div");
      newValueContainer.className = "edit-field-new";
      newValueContainer.style.width = "100%";

      const newValueLabel = document.createElement("div");
      newValueLabel.className = "value-label";
      newValueLabel.style.fontSize = "0.8rem";
      newValueLabel.style.fontWeight = "500";
      newValueLabel.style.color = "#6b7280";
      newValueLabel.style.marginBottom = "0.25rem";
      newValueLabel.style.textTransform = "uppercase";
      newValueLabel.textContent = "New Value";
      newValueContainer.appendChild(newValueLabel);

      const newValueContent = document.createElement("div");
      newValueContent.className = "value-container";
      newValueContent.style.backgroundColor = "#f0f9ff";
      newValueContent.style.border = "1px solid #bae6fd";
      newValueContent.style.borderRadius = "8px";
      newValueContent.style.padding = "0.75rem";
      newValueContent.style.minHeight = "2.5rem";
      newValueContent.style.wordBreak = "break-word";
      newValueContent.style.lineHeight = "1.5";
      newValueContent.style.width = "100%";
      newValueContent.style.color = "#0369a1";
      newValueContent.style.fontWeight = "500";
      newValueContent.style.boxSizing = "border-box";
      newValueContent.textContent = newValue;
      newValueContainer.appendChild(newValueContent);

      // Append all elements
      changeContainer.appendChild(oldValueContainer);
      changeContainer.appendChild(arrowContainer);
      changeContainer.appendChild(newValueContainer);
      summaryItem.appendChild(changeContainer);
      editSummaryList.appendChild(summaryItem);
    });

    // Get the modal element
    const editReasonModalEl = document.getElementById("editReasonModal");
    const editReasonInput = document.getElementById("editReasonInput");
    const userConsentCheck = document.getElementById("userConsentCheck");
    const cancelEditBtn = document.getElementById("cancelEditBtn");
    const confirmEditBtn = document.getElementById("confirmEditBtn");

    // Clear previous input
    editReasonInput.value = "";
    editReasonInput.classList.remove("is-invalid");
    userConsentCheck.checked = true;

    // Remove any existing event listeners
    const newCancelBtn = cancelEditBtn.cloneNode(true);
    cancelEditBtn.parentNode.replaceChild(newCancelBtn, cancelEditBtn);

    const newConfirmBtn = confirmEditBtn.cloneNode(true);
    confirmEditBtn.parentNode.replaceChild(newConfirmBtn, confirmEditBtn);

    // Get the new button references
    const newCancelBtnRef = document.getElementById("cancelEditBtn");
    const newConfirmBtnRef = document.getElementById("confirmEditBtn");

    // Add event listener to reset modal when hidden
    editReasonModalEl.addEventListener(
      "hidden.bs.modal",
      function () {
        editReasonInput.value = "";
        editReasonInput.classList.remove("is-invalid");
        userConsentCheck.checked = true;
      },
      { once: true }
    );

    // Show the modal
    const editReasonModal = new bootstrap.Modal(editReasonModalEl);
    editReasonModal.show();

    // Focus on the reason input
    editReasonInput.focus();

    // Handle cancel button
    newCancelBtnRef.onclick = () => {
      editReasonModal.hide();
    };

    // Handle confirm button
    newConfirmBtnRef.onclick = () => {
      const reason = editReasonInput.value.trim();
      if (!reason) {
        editReasonInput.classList.add("is-invalid");
        return;
      }

      // Check if consent checkbox is checked
      if (!userConsentCheck.checked) {
        alert("Please confirm that the changes are accurate and verified.");
        return;
      }

      // Hide the modal
      editReasonModal.hide();

      // Proceed with saving
      this.processEditSave(reason);
    };

    // Create a function for the keydown handler
    const handleKeydown = (e) => {
      if (e.key === "Enter" && e.ctrlKey) {
        newConfirmBtnRef.click();
      }
    };

    // Create a function for the input handler
    const handleInput = () => {
      editReasonInput.classList.remove("is-invalid");
    };

    // Add enter key handler for the textarea
    editReasonInput.addEventListener("keydown", handleKeydown);

    // Remove invalid class when typing
    editReasonInput.addEventListener("input", handleInput);

    // Clean up event listeners when modal is hidden
    editReasonModalEl.addEventListener(
      "hidden.bs.modal",
      function () {
        editReasonInput.removeEventListener("keydown", handleKeydown);
        editReasonInput.removeEventListener("input", handleInput);
      },
      { once: true }
    );
  }

  processEditSave(reason) {
    const editedFieldIds = Object.keys(this.editedFields);
    const payload = {
      responses: [],
      user_consent: true,
    };

    editedFieldIds.forEach((fieldId) => {
      const field = this.editedFields[fieldId];
      const response = {
        field_id: fieldId,
        value: field.value,
        reason: reason,
      };

      // If this is a file removal, include the original file name for logging
      if (field.isRemoved && field.originalFileName) {
        response.original_file_name = field.originalFileName;
      }

      payload.responses.push(response);
    });

    // Show loading state
    const saveBtn = document.getElementById("confirmEditBtn");
    const originalBtnText = saveBtn.innerHTML;
    saveBtn.innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status"></span> Saving...';
    saveBtn.disabled = true;

    fetch(`/api/admin/applications/${this.currentApplicationId}/responses`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AuthManager.getAuthToken()}`,
      },
      body: JSON.stringify(payload),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        // Reset edited fields
        this.editedFields = {};
        this.updateSaveButtonState();

        // Remove the has-changes class after saving
        document.getElementById("editBtn").classList.remove("has-changes");

        // Exit edit mode
        this.isEditMode = false;
        document.getElementById("editBtnText").textContent = "Edit Responses";

        // Show success message with configuration
        const successToast = document.getElementById("successToast");
        const toastOptions = {
          animation: true,
          autohide: true,
          delay: 5000, // 5 seconds display time
        };
        const toast = new bootstrap.Toast(successToast, toastOptions);
        document.getElementById("successToastMessage").textContent =
          "Changes saved successfully!";
        toast.show();

        // Add a longer delay before refreshing the application to ensure toast is visible
        setTimeout(() => {
          // Refresh the application data
          this.viewApplication(this.currentApplicationId);
        }, 2000); // 2 seconds delay before refresh
      })
      .catch((error) => {
        console.error("Error saving changes:", error);
        alert(`Error saving changes: ${error.message}`);
      })
      .finally(() => {
        // Reset button state
        saveBtn.innerHTML = originalBtnText;
        saveBtn.disabled = false;
      });
  }

  async viewEditHistory() {
    try {
      const response = await fetch(
        `/api/admin/applications/${this.currentApplicationId}/edit-history`,
        {
          headers: {
            Authorization: `Bearer ${AuthManager.getAuthToken()}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch edit history");

      const history = await response.json();

      // Render the edit history
      const historyContent = document.getElementById("editHistoryContent");

      // Set the application ID in the modal header
      document.getElementById("historyApplicationId").textContent =
        this.currentApplicationId;

      if (history.length === 0) {
        historyContent.innerHTML = `
          <div class="alert alert-info">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-info-circle me-2" viewBox="0 0 16 16">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
            </svg>
            No edit history found for this application.
          </div>
        `;
      } else {
        // Sort history by timestamp (newest first)
        history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        historyContent.innerHTML = `
          <div class="edit-history-timeline">
            ${history
              .map(
                (edit, index) => `
              <div class="history-card">
                <div class="history-card-header">
                  <div class="history-meta">
                    <div class="history-timestamp">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-clock me-1" viewBox="0 0 16 16">
                        <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
                        <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
                      </svg>
                      ${new Date(edit.timestamp).toLocaleString()}
                    </div>
                    <div class="history-user">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-person me-1" viewBox="0 0 16 16">
                        <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4Zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10Z"/>
                      </svg>
                      <span class="user-name">${edit.user}</span>
                      <span class="user-role badge ${
                        edit.userRole === "admin"
                          ? "bg-primary"
                          : "bg-secondary"
                      }">${edit.userRole}</span>
                    </div>
                  </div>
                  <div class="field-name">
                    <strong>${edit.field.display_name}</strong>
                  </div>
                </div>
                <div class="history-card-body">
                  <div class="value-comparison">
                    <div class="previous-value">
                      <div class="value-label">Previous Value</div>
                      <div class="value-content">${this.formatHistoryValue(
                        edit.previousValue
                      )}</div>
                    </div>
                    <div class="change-arrow">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-arrow-right" viewBox="0 0 16 16">
                        <path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
                      </svg>
                    </div>
                    <div class="new-value">
                      <div class="value-label">New Value</div>
                      <div class="value-content">${this.formatHistoryValue(
                        edit.newValue
                      )}</div>
                    </div>
                  </div>
                  ${
                    edit.reason
                      ? `
                  <div class="edit-reason">
                    <div class="reason-label">Reason for Change:</div>
                    <div class="reason-content">${edit.reason}</div>
                  </div>
                  `
                      : ""
                  }
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        `;
      }

      // Show the modal
      this.editHistoryModal.show();
    } catch (error) {
      console.error("Error fetching edit history:", error);
      alert("Failed to load edit history. Please try again.");
    }
  }

  formatHistoryValue(value) {
    if (value === null || value === undefined) return "<em>empty</em>";
    if (value === "") return "<em>empty</em>";

    // Special case for file removal flag
    if (value === "__FILE_REMOVED__") {
      return '<em class="text-danger">File Deleted</em>';
    }

    // Check if it's a file path
    if (
      typeof value === "string" &&
      (value.includes("/uploads/") || value.includes("/forms/"))
    ) {
      const fileName = value.split("/").pop();
      return `<span class="file-name">${fileName}</span>`;
    }

    return value;
  }

  formatStatus(status) {
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  async handleStatusUpdate(e) {
    const button = e.target;
    const { id, status } = button.dataset;

    try {
      const response = await fetch(`/api/admin/application/${id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) throw new Error("Failed to update status");

      // Reload applications to show updated status
      this.loadRecentApplications();
      // Reload stats as they might have changed
      this.loadStats();
    } catch (error) {
      alert("Failed to update application status");
    }
  }

  async updateStatus(newStatus) {
    try {
      const applicationId =
        document.getElementById("modalApplicationId").textContent;

      const response = await fetch(
        `/api/admin/application/${applicationId}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${AuthManager.getAuthToken()}`,
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) throw new Error("Failed to update status");

      const data = await response.json();

      // Update UI elements
      const statusBadge = document.getElementById("modalStatus");
      // Reset any inline styles that might have been applied
      statusBadge.removeAttribute("style");
      // Set class only
      statusBadge.className = `status-badge ${newStatus}`;
      // Set text content only
      statusBadge.textContent = this.formatStatus(newStatus);

      // Update last updated info
      const statusInfo = document.getElementById("statusInfo");
      statusInfo.innerHTML = `
        <small class="text-muted">
          Last updated by <span id="lastUpdatedBy">${data.updatedBy}</span> on
          <span id="lastUpdatedAt">${new Date(
            data.updatedAt
          ).toLocaleString()}</span>
        </small>`;

      // Update button visibility
      const approveBtn = document.getElementById("approveBtn");
      const rejectBtn = document.getElementById("rejectBtn");
      const undoBtn = document.getElementById("undoBtn");

      if (["pending", "under_review"].includes(newStatus)) {
        approveBtn.style.display = "inline-flex";
        rejectBtn.style.display = "inline-flex";
        undoBtn.style.display = "none";
      } else {
        approveBtn.style.display = "none";
        rejectBtn.style.display = "none";
        undoBtn.style.display = "inline-flex";
      }

      // Update the application in our local data to ensure badges render correctly
      if (this.isAllApplicationsView) {
        // Update status in our local applications data
        const appIndex = this.allApplications.findIndex(
          (app) => app.applicationId === applicationId
        );

        if (appIndex !== -1) {
          this.allApplications[appIndex].status = newStatus;

          // Also update in filtered applications if present
          const filteredIndex = this.filteredApplications.findIndex(
            (app) => app.applicationId === applicationId
          );

          if (filteredIndex !== -1) {
            this.filteredApplications[filteredIndex].status = newStatus;
          }

          // Re-render the applications list with updated status
          this.renderAllApplications();
        }
      } else {
        // If not in all applications view, refresh the list
        this.loadRecentApplications();
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update application status");
    }
  }

  async undoStatus() {
    try {
      const applicationId =
        document.getElementById("modalApplicationId").textContent;
      const response = await fetch(
        `/api/admin/application/${applicationId}/undo`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${AuthManager.getAuthToken()}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to undo status");

      const result = await response.json();

      // Update status badge
      const statusBadge = document.getElementById("modalStatus");
      // Reset any inline styles that might have been applied
      statusBadge.removeAttribute("style");
      // Set class only
      statusBadge.className = `status-badge ${result.status}`;
      // Set text content only
      statusBadge.textContent = this.formatStatus(result.status);

      // Update last updated info
      const statusInfo = document.getElementById("statusInfo");
      statusInfo.innerHTML = `
        <small class="text-muted">
          Last updated by <span id="lastUpdatedBy">${result.updatedBy}</span> on
          <span id="lastUpdatedAt">${new Date(
            result.updatedAt
          ).toLocaleString()}</span>
        </small>`;

      // Update button states
      const approveBtn = document.getElementById("approveBtn");
      const rejectBtn = document.getElementById("rejectBtn");
      const undoBtn = document.getElementById("undoBtn");

      // Show approve/reject buttons, hide undo
      approveBtn.style.display = "inline-flex";
      rejectBtn.style.display = "inline-flex";
      undoBtn.style.display = "none";

      // Update the application in our local data to ensure badges render correctly
      if (this.isAllApplicationsView) {
        // Update status in our local applications data
        const appIndex = this.allApplications.findIndex(
          (app) => app.applicationId === applicationId
        );

        if (appIndex !== -1) {
          this.allApplications[appIndex].status = result.status;

          // Also update in filtered applications if present
          const filteredIndex = this.filteredApplications.findIndex(
            (app) => app.applicationId === applicationId
          );

          if (filteredIndex !== -1) {
            this.filteredApplications[filteredIndex].status = result.status;
          }

          // Re-render the applications list with updated status
          this.renderAllApplications();
        }
      } else {
        // If not in all applications view, refresh the list
        await this.loadRecentApplications();
      }
    } catch (error) {
      console.error("Error undoing status:", error);
      alert("Failed to undo decision");
    }
  }

  renderDocumentField(field, value) {
    return `
      <div class="mb-2">
        <label class="form-label">${field.display_name}</label>
        <div>
          <button onclick="previewDocument('${value}')" class="btn btn-sm btn-outline-primary">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="me-1">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11-8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            View Document
          </button>
        </div>
      </div>
    `;
  }

  setupAllApplicationsEventListeners() {
    // Get the View All button
    const viewAllBtn = document.querySelector(".card-header a.btn");
    if (viewAllBtn) {
      viewAllBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.showAllApplicationsView();

        // Update URL without reloading the page
        history.pushState(null, "", "/admin/applications");
      });
    }
  }

  // Update event listeners when showing All Applications View
  setupFilterAndPaginationListeners() {
    // Set up status filter
    const statusFilter = document.getElementById("statusFilter");
    if (statusFilter) {
      statusFilter.addEventListener("change", () => this.applyFilters());
    }

    // Set up search input with debounce
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      let debounceTimeout;
      searchInput.addEventListener("input", () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => this.applyFilters(), 300);
      });
    }

    // Set up location filter button
    const locationFilterBtn = document.getElementById("locationFilterBtn");
    if (locationFilterBtn) {
      locationFilterBtn.addEventListener("click", () =>
        this.toggleLocationFilter()
      );
    }

    // Set up pagination buttons
    const prevPageBtn = document.getElementById("prevPage");
    const nextPageBtn = document.getElementById("nextPage");
    if (prevPageBtn) {
      prevPageBtn.addEventListener("click", () => this.goToPreviousPage());
    }
    if (nextPageBtn) {
      nextPageBtn.addEventListener("click", () => this.goToNextPage());
    }

    // Set up back to recent button
    const backToRecentBtn = document.getElementById("backToRecent");
    if (backToRecentBtn) {
      backToRecentBtn.addEventListener("click", () =>
        this.showRecentApplicationsView()
      );
    }
  }

  async showAllApplicationsView() {
    this.isAllApplicationsView = true;

    // Get the recent applications container
    const recentAppsContainer = document.querySelector(".content-card");
    if (!recentAppsContainer) return;

    // Change the header and add filters with enhanced styling
    recentAppsContainer.querySelector(".card-header").innerHTML = `
      <div class="d-flex w-100 justify-content-between align-items-center">
        <h2>All Applications</h2>
        <div class="admin-controls">
          <button type="button" id="locationFilterBtn" class="btn">Filter by Location</button>
          <select id="statusFilter" class="form-select">
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <input type="text" id="searchInput" class="form-control" placeholder="Search applications...">
        </div>
      </div>
    `;

    // Add hierarchical location filter
    await this.setupHierarchicalLocationFilter(recentAppsContainer);

    // Add pagination to the container with enhanced styling
    const paginationHtml = `
      <div class="pagination-container">
        <div class="d-flex align-items-center">
          <button id="backToRecent" class="back-button">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Back to Recent
          </button>
          <div id="paginationInfo" class="pagination-info ms-3">Showing 0 of 0 applications</div>
        </div>
        <div class="pagination-controls">
          <button id="prevPage" class="btn btn-outline-primary" disabled>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Previous
          </button>
          <button id="nextPage" class="btn btn-outline-primary" disabled>
            Next
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      </div>
    `;
    recentAppsContainer.insertAdjacentHTML("beforeend", paginationHtml);

    // Setup the table header with all columns including Location and Status
    // IMPORTANT: Always keep this column order - ApplicationID, Name, Date, Disability, Location, Status
    const tableHeader = recentAppsContainer.querySelector("thead tr");
    if (tableHeader) {
      tableHeader.innerHTML = `
        <th>Application ID</th>
        <th>Applicant Name</th>
        <th>Submission Date</th>
        <th>Type of Disability</th>
        <th>Location</th>
        <th>Status</th>
      `;
    }

    // Ensure the CSS for pulse animation is in the page
    if (!document.getElementById("status-badge-animation")) {
      const styleTag = document.createElement("style");
      styleTag.id = "status-badge-animation";
      styleTag.textContent = `
        @keyframes pulse {
          0% {
            opacity: 0.6;
            transform: scale(0.95);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
          100% {
            opacity: 0.6;
            transform: scale(0.95);
          }
        }
      `;
      document.head.appendChild(styleTag);
    }

    // Set up event listeners for filters and pagination
    this.setupFilterAndPaginationListeners();

    // Load all applications
    await this.loadAllApplications();
  }

  // Toggle location filter visibility
  toggleLocationFilter() {
    const btn = document.getElementById("locationFilterBtn");
    const container = document.getElementById("locationFilterContainer");

    if (!btn || !container) return;

    if (container.style.display === "block") {
      container.style.display = "none";
      btn.classList.remove("active");
    } else {
      container.style.display = "block";
      btn.classList.add("active");
    }
  }

  // Setup hierarchical location filter with nested-select field id 13
  async setupHierarchicalLocationFilter(container) {
    try {
      // Load form fields if not already loaded
      if (!this.allFields || this.allFields.length === 0) {
        await this.loadFormFields();
      }

      // Create container for location filter or find existing one
      let locationFilterContainer = document.getElementById(
        "locationFilterContainer"
      );

      if (!locationFilterContainer) {
        // Create new container if it doesn't exist
        locationFilterContainer = document.createElement("div");
        locationFilterContainer.id = "locationFilterContainer";
        locationFilterContainer.className =
          "location-filter-container p-3 mb-3 bg-light";

        // Add container heading
        const heading = document.createElement("h5");
        heading.className = "mb-3";
        heading.textContent = "Location Filter";
        locationFilterContainer.appendChild(heading);

        // Create the nested select filter
        const locationField = this.allFields.find((field) => field.id === 13);
        if (locationField) {
          this.createNestedSelectFilter(
            locationFilterContainer,
            locationField.id,
            "filter"
          );

          // Insert the container into the DOM after the card-header
          const cardHeader = container.querySelector(".card-header");
          if (cardHeader) {
            container.insertBefore(
              locationFilterContainer,
              cardHeader.nextSibling
            );
          } else {
            // Fallback - insert before the table
            const tableContainer = container.querySelector(".table-responsive");
            if (tableContainer) {
              container.insertBefore(locationFilterContainer, tableContainer);
            }
          }
        }
      }

      // Ensure it's hidden by default
      locationFilterContainer.style.display = "none";
    } catch (error) {
      console.error("Error setting up hierarchical location filter:", error);
    }
  }

  // Load form fields
  async loadFormFields() {
    try {
      // Fetch all form fields from API
      const response = await fetch("/api/reports/form/fields", {
        headers: {
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load form fields");
      }

      const data = await response.json();
      this.allFields = data;
      return data;
    } catch (error) {
      console.error("Error loading form fields:", error);
      return [];
    }
  }

  // Create a nested select filter
  createNestedSelectFilter(container, fieldId, variableType) {
    const field = this.allFields.find((f) => String(f.id) === String(fieldId));

    if (!field || field.field_type !== "nested-select") {
      console.error(
        `Field with ID ${fieldId} is not a nested-select field or was not found`
      );
      return;
    }

    const filterContainer = document.createElement("div");
    filterContainer.className = "nested-select-filter";
    filterContainer.id = `nestedSelectFilter_${fieldId}`;

    // Title for the filter
    const title = document.createElement("h6");
    title.className = "mb-2";
    title.textContent = field.display_name || "Location";
    filterContainer.appendChild(title);

    // Add description explaining auto-filtering
    const description = document.createElement("p");
    description.className = "text-muted small mb-2";
    description.textContent =
      "Select any level to filter applications by location.";
    filterContainer.appendChild(description);

    // Parse the nested structure to determine levels
    let levelsStructure = [];
    try {
      const options =
        typeof field.options === "string"
          ? JSON.parse(field.options)
          : field.options;

      // Store options reference for later use
      this.nestedSelectField = {
        id: fieldId,
        variableType: variableType,
        options: options,
        field: field,
      };

      // Extract level information
      if (Array.isArray(options)) {
        levelsStructure = options.map((level, index) => ({
          level: level.level || `Level ${index + 1}`,
          name: level.name || `Level ${index + 1}`,
          options: level.options || [],
        }));
      }
    } catch (error) {
      console.error("Error parsing nested select options:", error);
      levelsStructure = [{ name: "Level 1", level: 1 }]; // Fallback to one level
    }

    // Create select container
    const selectContainer = document.createElement("div");
    selectContainer.className = "row align-items-end";
    filterContainer.appendChild(selectContainer);

    // Create dropdowns for each level
    levelsStructure.forEach((levelInfo, index) => {
      const col = document.createElement("div");
      col.className = "col-md-4 mb-3";

      const label = document.createElement("label");
      label.className = "form-label";
      label.textContent = levelInfo.name;

      const select = document.createElement("select");
      select.className = "form-select nested-level-select";
      select.id = `level${index + 1}Select_${fieldId}`;
      select.dataset.level = index + 1;

      // Add default option
      const defaultOption = document.createElement("option");
      defaultOption.value = "default";
      defaultOption.textContent = `Select ${levelInfo.name}`;
      select.appendChild(defaultOption);

      // Disable all selects after the first one initially
      if (index > 0) {
        select.disabled = true;
      }

      // Add event listener for change
      select.addEventListener("change", (e) => {
        if (this.isRestoringSelections) return; // Skip if we're just restoring selections
        this.handleNestedLevelChange(e.target, index);
      });

      col.appendChild(label);
      col.appendChild(select);
      selectContainer.appendChild(col);
    });

    container.appendChild(filterContainer);

    // Populate options for first level
    this.populateNestedLevelOptions(fieldId, filterContainer);
  }

  // Populate options for the first level of a nested select
  populateNestedLevelOptions(fieldId, filterContainerElem) {
    const options = this.nestedSelectField?.options;
    if (!options || !Array.isArray(options) || options.length === 0) {
      console.error("No valid options data for field:", fieldId);
      return;
    }

    // Get the first level options
    const level1Options = options[0]?.options;
    if (!level1Options) {
      console.error("No level 1 options found");
      return;
    }

    // Find the level 1 select element
    const level1Select = filterContainerElem.querySelector('[data-level="1"]');
    if (!level1Select) {
      console.error("Level 1 select element not found");
      return;
    }

    // Reset select to just the default option
    level1Select.innerHTML = `<option value="default">Select ${level1Select.previousElementSibling.textContent}</option>`;

    // Parse and add level 1 options
    try {
      if (typeof level1Options === "string") {
        // Format: "Parent1: Child1, Child2\nParent2: Child3, Child4"
        const lines = level1Options.split("\n");

        lines.forEach((line) => {
          const parent = line.split(":")[0].trim();
          if (parent) {
            const option = document.createElement("option");
            option.value = parent;
            option.textContent = parent;
            level1Select.appendChild(option);
          }
        });
      } else if (Array.isArray(level1Options)) {
        level1Options.forEach((opt) => {
          let value, label;
          if (typeof opt === "object") {
            value = opt.value || opt.label || "";
            label = opt.label || opt.value || "";
          } else {
            value = opt;
            label = opt;
          }

          if (value) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            level1Select.appendChild(option);
          }
        });
      }
    } catch (error) {
      console.error("Error populating level 1 options:", error);
    }
  }

  // Handle changes to a level in the nested select
  handleNestedLevelChange(selectElement, levelIndex) {
    const fieldId = selectElement.id.split("_")[1];
    const selectedValue = selectElement.value;
    const currentLevel = parseInt(selectElement.dataset.level);

    // Get the filter container
    const filterContainer = document.getElementById(
      `nestedSelectFilter_${fieldId}`
    );
    if (!filterContainer) {
      console.debug("Nested-select filter container not found yet");
      return;
    }

    // Find all level selects within this specific filter container
    const levelSelects = Array.from(
      filterContainer.querySelectorAll(".nested-level-select")
    );

    // Handle default selection (user clearing a level)
    if (selectedValue === "default") {
      // Reset and disable all levels after the current one
      for (let i = currentLevel; i < levelSelects.length; i++) {
        const nextSelect = levelSelects[i];
        if (nextSelect) {
          nextSelect.innerHTML = `<option value="default">Select ${nextSelect.previousElementSibling.textContent}</option>`;
          nextSelect.disabled = true;
        }
      }

      // If it's the first level being reset, remove any filter
      if (currentLevel === 1) {
        this.locationFilterActive = false;
        this.activeLocationFilter = null;
        this.applyFilters();
      } else {
        // For other levels, update the filter to match the highest selected level
        this.applyHierarchicalFilter(fieldId);
      }
      return;
    }

    // Get the options structure from the field
    const options = this.nestedSelectField?.options;
    if (!options || !Array.isArray(options)) {
      console.error("Invalid options structure for field", fieldId);
      return;
    }

    // If there's a next level select, populate it with child options
    if (currentLevel < levelSelects.length) {
      const nextLevelSelect = levelSelects[currentLevel];
      if (!nextLevelSelect) {
        console.warn(`Next level select not found after level ${currentLevel}`);
        this.applyHierarchicalFilter(fieldId);
        return;
      }

      // Enable the next level select and clear existing options
      nextLevelSelect.disabled = false;
      nextLevelSelect.innerHTML = `<option value="default">Select ${nextLevelSelect.previousElementSibling.textContent}</option>`;

      // Find child options for the selected value
      const childOptions = this.getChildOptions(
        options,
        selectedValue,
        currentLevel - 1
      );

      // Add child options to the next level select
      if (childOptions.length > 0) {
        childOptions.forEach((option) => {
          const optElement = document.createElement("option");
          optElement.value = option;
          optElement.textContent = option;
          nextLevelSelect.appendChild(optElement);
        });
      } else {
        // If no child options were found, keep next level disabled
        nextLevelSelect.disabled = true;
      }
    }

    // Apply the hierarchical filter based on current selections
    this.applyHierarchicalFilter(fieldId);
  }

  // Apply hierarchical filter
  applyHierarchicalFilter(fieldId) {
    // Get the filter container
    const filterContainer = document.getElementById(
      `nestedSelectFilter_${fieldId}`
    );
    if (!filterContainer) {
      console.debug("Nested-select filter container not found yet");
      return;
    }

    // Query for all level selects directly within this filter container
    const levelSelects = Array.from(
      filterContainer.querySelectorAll(".nested-level-select")
    );

    // Track selections at each level and find the deepest selected level
    let deepestSelectedLevel = -1;
    const selectedValues = [];
    const selectedPath = [];

    // Get the selected values at each level
    levelSelects.forEach((select, index) => {
      const value = select.value;
      if (value !== "default") {
        selectedValues[index] = value;
        selectedPath.push(value);
        deepestSelectedLevel = index;
      }
    });

    // If no selection, remove any location filter
    if (deepestSelectedLevel < 0 || !selectedValues[0]) {
      this.locationFilterActive = false;
      this.activeLocationFilter = null;
      this.applyFilters();
      return;
    }

    // Create the display value (showing the hierarchical path)
    const displayValue = selectedPath.join(" > ");

    // Get the field display name
    const fieldDisplayName =
      this.allFields.find((f) => String(f.id) === String(fieldId))
        ?.display_name || "Location";

    // Create a location filter object
    this.activeLocationFilter = {
      fieldId: fieldId,
      level: deepestSelectedLevel + 1,
      value: selectedValues[deepestSelectedLevel],
      path: selectedValues.filter((v) => v),
      displayValue: displayValue,
      fieldName: fieldDisplayName,
    };

    this.locationFilterActive = true;

    // Apply the filters to update the table
    this.applyFilters();
  }

  // Get child options for nested select
  getChildOptions(options, parentValue, parentLevel) {
    const childOptions = new Set();

    // If we don't have options data for the next level, return empty array
    if (!options[parentLevel + 1] || !options[parentLevel + 1].options) {
      return [];
    }

    const levelOptions = options[parentLevel + 1].options;

    // Parse options depending on format
    if (typeof levelOptions === "string") {
      // Handle string format (parent:child1,child2)
      levelOptions.split("\n").forEach((line) => {
        const parts = line.split(":");
        if (parts.length < 2) {
          return;
        }

        const parent = parts[0].trim();
        const childrenStr = parts[1].trim();

        // Exact match with the parent value
        if (parent === parentValue && childrenStr) {
          childrenStr.split(",").forEach((child) => {
            const trimmedChild = child.trim();
            if (trimmedChild) {
              childOptions.add(trimmedChild);
            }
          });
        }
      });
    } else if (Array.isArray(levelOptions)) {
      // Handle array format
      levelOptions.forEach((opt) => {
        // Check different structures for parent-child relationships
        let parent, children;

        if (typeof opt === "object" && opt !== null) {
          if (opt.parent !== undefined && opt.children !== undefined) {
            // Explicit parent-children structure
            parent = opt.parent;
            children = opt.children;
          } else if (
            opt.value !== undefined &&
            opt.childOptions !== undefined
          ) {
            // Alternative structure with value and childOptions
            parent = opt.value;
            children = opt.childOptions;
          } else if (Array.isArray(opt.options)) {
            // Nested options structure
            parent = opt.label || opt.name || opt.value;
            children = opt.options.map((child) =>
              typeof child === "object" ? child.value || child.label : child
            );
          }
        } else {
          parent = opt;
          children = [];
        }

        // Check if this option matches the parent value
        if (parent === parentValue) {
          // Add all child options
          if (Array.isArray(children)) {
            children.forEach((child) => {
              const childValue =
                typeof child === "object"
                  ? child.value || child.label || JSON.stringify(child)
                  : child;

              if (childValue) {
                childOptions.add(childValue);
              }
            });
          } else if (typeof children === "string") {
            // Handle case where children might be a comma-separated string
            children.split(",").forEach((child) => {
              const trimmedChild = child.trim();
              if (trimmedChild) {
                childOptions.add(trimmedChild);
              }
            });
          }
        }
      });
    }

    return Array.from(childOptions);
  }

  async loadAllApplications() {
    try {
      // Get the table body for applications
      const tbody = document.getElementById("recentApplications");
      if (!tbody) return;

      // Show loading indicator
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          </td>
        </tr>
      `;

      const response = await fetch("/api/admin/all-applications", {
        headers: {
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch applications");

      this.allApplications = await response.json();
      this.filteredApplications = [...this.allApplications];

      // Render the applications
      this.renderAllApplications();
    } catch (error) {
      console.error("Error loading all applications:", error);
      const tbody = document.getElementById("recentApplications");
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="text-center text-danger">
              Failed to load applications. Please refresh the page and try again.
            </td>
          </tr>
        `;
      }
    }
  }

  renderAllApplications() {
    // Get the table body for applications
    const tbody = document.getElementById("recentApplications");
    if (!tbody) return;

    // Calculate pagination
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = Math.min(
      startIndex + this.itemsPerPage,
      this.filteredApplications.length
    );
    const currentPageApplications = this.filteredApplications.slice(
      startIndex,
      endIndex
    );

    // Update pagination info with proper styling
    const paginationInfo = document.getElementById("paginationInfo");
    if (paginationInfo) {
      paginationInfo.textContent = `Showing ${startIndex + 1}-${endIndex} of ${
        this.filteredApplications.length
      } applications`;
    }

    // Update pagination buttons
    const prevPageBtn = document.getElementById("prevPage");
    const nextPageBtn = document.getElementById("nextPage");
    if (prevPageBtn) prevPageBtn.disabled = this.currentPage === 1;
    if (nextPageBtn)
      nextPageBtn.disabled = endIndex >= this.filteredApplications.length;

    // Ensure status badge styles are in the document
    this.ensureStatusBadgeStyles();

    // Clear the table
    tbody.innerHTML = "";

    // Check if we have applications to display
    if (currentPageApplications.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center">
            <div class="p-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-3 text-muted">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <p class="text-muted">No applications found matching your criteria.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    // Determine the location display level based on active filters
    const displayLevel = this.getLocationDisplayLevel();

    // Build the complete HTML string for all rows at once
    const rowsHtml = currentPageApplications
      .map((app) => {
        const statusHtml = `<td data-label="Status"><span class="status-badge ${
          app.status || "pending"
        }">${this.formatStatus(app.status || "pending")}</span></td>`;

        return `
        <tr class="clickable-row" onclick="dashboardManager.viewApplication('${
          app.applicationId
        }')">
          <td data-label="Application ID">${app.applicationId}</td>
          <td data-label="Applicant Name">${app.applicantName}</td>
          <td data-label="Submission Date">${new Date(
            app.submittedAt
          ).toLocaleDateString()}</td>
          <td data-label="Type of Disability">${
            app.disabilityType || "Not specified"
          }</td>
          <td data-label="Location">${this.parseLocationDisplay(
            app.location,
            displayLevel
          )}</td>
          ${statusHtml}
        </tr>
      `;
      })
      .join("");

    // Set the HTML content
    tbody.innerHTML = rowsHtml;

    // Verify status badges rendered correctly
    this.verifyStatusBadges();
  }

  ensureStatusBadgeStyles() {
    // Check if status badge styles exist
    if (!document.getElementById("status-badge-styles")) {
      const styleTag = document.createElement("style");
      styleTag.id = "status-badge-styles";
      styleTag.textContent = `
        .status-badge {
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
          border: 1px solid transparent;
          letter-spacing: 0.01em;
          text-transform: uppercase;
          font-size: 0.75rem;
          position: relative;
        }

        .status-badge::before {
          content: "";
          display: block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 0.5rem;
        }

        .status-badge.pending {
          background: linear-gradient(45deg, #fffbeb, #fff7ed);
          color: #9a3412;
          border-color: #fdba74;
        }

        .status-badge.pending::before {
          background: #ea580c;
          box-shadow: 0 0 0 2px #fed7aa80;
        }

        .status-badge.approved {
          background: linear-gradient(45deg, #059669, #10b981);
          color: white;
          border: none;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
        }

        .status-badge.approved::before {
          background: white;
          box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
        }

        .status-badge.rejected {
          background: linear-gradient(45deg, #dc2626, #ef4444);
          color: white;
          border: none;
          box-shadow: 0 4px 12px rgba(220, 38, 38, 0.2);
        }

        .status-badge.rejected::before {
          background: white;
          box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
        }

        .status-badge.under_review {
          background: linear-gradient(45deg, #eef2ff, #e0e7ff);
          color: #3730a3;
          border-color: #818cf880;
        }

        .status-badge.under_review::before {
          background: #4f46e5;
          box-shadow: 0 0 0 2px #c7d2fe80;
        }
      `;
      document.head.appendChild(styleTag);
    }
  }

  verifyStatusBadges() {
    // Check if status badges rendered correctly
    const badges = document.querySelectorAll(".status-badge");
    let retryCount = 0;
    const maxRetries = 3;

    const verifyAndRetry = () => {
      let allBadgesValid = true;
      badges.forEach((badge) => {
        // Check if badge has proper dimensions and is visible
        const styles = window.getComputedStyle(badge);
        const isValidBadge =
          parseFloat(styles.height) > 0 &&
          parseFloat(styles.width) > 0 &&
          styles.display !== "none" &&
          styles.visibility !== "hidden";

        if (!isValidBadge) {
          allBadgesValid = false;
        }
      });

      if (!allBadgesValid && retryCount < maxRetries) {
        retryCount++;
        // Force a reflow and try again
        badges.forEach((badge) => {
          badge.style.display = "none";
          badge.offsetHeight; // Force reflow
          badge.style.display = "inline-flex";
        });
        setTimeout(verifyAndRetry, 100 * retryCount);
      }
    };

    // Start verification process
    verifyAndRetry();
  }

  applyFilters() {
    // Get selected status filter
    const statusFilter = document.getElementById("statusFilter");
    const selectedStatus = statusFilter ? statusFilter.value : "all";

    // Get search query
    const searchInput = document.getElementById("searchInput");
    const searchQuery = searchInput ? searchInput.value.toLowerCase() : "";

    // Filter the applications
    this.filteredApplications = this.allApplications.filter((app) => {
      // Status filter
      if (
        selectedStatus !== "all" &&
        app.status !== selectedStatus &&
        // Special case for pending (which can be null or "pending")
        !(selectedStatus === "pending" && !app.status)
      ) {
        return false;
      }

      // Location filter if active
      if (this.locationFilterActive && this.activeLocationFilter) {
        // Skip applications that don't match the location filter
        if (!app.location) {
          return false;
        }

        try {
          // Parse the location data
          let locationData = app.location;
          let locationLevels = [];

          // Try to parse JSON if needed
          if (typeof locationData === "string") {
            if (
              locationData.trim().startsWith("{") ||
              locationData.trim().startsWith("[")
            ) {
              try {
                locationData = JSON.parse(locationData);
              } catch (e) {
                // Not valid JSON, treat as a delimited string
                locationLevels = locationData
                  .split(/[,>]/)
                  .map((l) => l.trim());
              }
            } else {
              // Simple delimited string
              locationLevels = locationData.split(/[,>]/).map((l) => l.trim());
            }
          }

          // Handle different data structures
          if (locationLevels.length === 0) {
            if (Array.isArray(locationData)) {
              // Array format: Either [{level: 1, value: "foo"}, ...] or ["Level1", "Level2", ...]
              if (
                locationData.length > 0 &&
                locationData[0].level !== undefined &&
                locationData[0].value !== undefined
              ) {
                locationLevels = locationData.map((item) => item.value);
              } else {
                locationLevels = locationData;
              }
            } else if (
              typeof locationData === "object" &&
              locationData !== null
            ) {
              // Object format: {level1: "foo", level2: "bar"}
              locationLevels = [];
              for (let i = 1; i <= 10; i++) {
                // Assuming max 10 levels
                const levelKey = `level${i}`;
                if (locationData[levelKey]) {
                  locationLevels.push(locationData[levelKey]);
                }
              }
            }
          }

          // Filter level that we're checking
          const filterLevel = this.activeLocationFilter.level - 1; // 0-based index

          // Value at the filter level must match the filter value
          if (
            filterLevel >= locationLevels.length ||
            locationLevels[filterLevel] !== this.activeLocationFilter.value
          ) {
            return false;
          }
        } catch (e) {
          console.error("Error parsing location data for filtering:", e);
          return false;
        }
      }

      // Search query
      if (searchQuery) {
        // Search in application ID, applicant name, and other fields
        return (
          (app.applicationId &&
            app.applicationId.toLowerCase().includes(searchQuery)) ||
          (app.applicantName &&
            app.applicantName.toLowerCase().includes(searchQuery)) ||
          (app.disabilityType &&
            app.disabilityType.toLowerCase().includes(searchQuery))
        );
      }

      return true;
    });

    // Reset to first page
    this.currentPage = 1;

    // Render the filtered applications
    this.renderAllApplications();
  }

  goToPreviousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.renderAllApplications();
    }
  }

  goToNextPage() {
    const maxPage = Math.ceil(
      this.filteredApplications.length / this.itemsPerPage
    );
    if (this.currentPage < maxPage) {
      this.currentPage++;
      this.renderAllApplications();
    }
  }

  // Add guessFieldType function if it was deleted
  guessFieldType(value, fieldName) {
    if (!value) return "text";

    // Check if the value is a date
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return "date";
    }

    // Check if the field is likely a select/dropdown based on the name
    const selectFieldNames = [
      "type",
      "category",
      "status",
      "gender",
      "disabilitytype",
    ];
    if (
      selectFieldNames.some((name) => fieldName.toLowerCase().includes(name))
    ) {
      return "select";
    }

    // Check if it's likely a checkbox
    if (
      value === "true" ||
      value === "false" ||
      value === "yes" ||
      value === "no"
    ) {
      return "checkbox";
    }

    // Check if it's a file
    if (
      fieldName.toLowerCase().includes("file") ||
      fieldName.toLowerCase().includes("document") ||
      fieldName.toLowerCase().includes("upload")
    ) {
      return "file";
    }

    // Default to text
    return "text";
  }

  // Handle file upload for edit forms
  async handleFileUpload(fileInput) {
    try {
      const fieldId = fileInput.dataset.fieldId;
      const fieldName = fileInput.id.replace("_file", "");
      const files = fileInput.files;

      if (!files || !files.length) return;

      const file = files[0];
      const container = fileInput.closest(".file-upload-container");
      const progressContainer = container.querySelector(".upload-progress");
      const progressBar = progressContainer.querySelector(".progress-bar");
      const hiddenInput = document.getElementById(fieldName);
      const currentFileDisplay = container.previousElementSibling;

      // Get the display name from the closest form-field's field-label
      const formField = fileInput.closest(".form-field");
      let displayName = fieldId;

      if (formField && formField.querySelector(".field-label")) {
        displayName = formField.querySelector(".field-label").textContent;
      }

      // Check file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        alert(`File too large. Maximum file size is 10MB.`);
        fileInput.value = "";
        return;
      }

      // Show progress
      progressContainer.style.display = "block";

      // Create FormData
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fieldId", fieldId);

      // Make API request with progress tracking
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          progressBar.style.width = percentComplete + "%";
          progressBar.textContent = Math.round(percentComplete) + "%";
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);

            // Update hidden input with file path
            hiddenInput.value = response.filePath;

            // Update edited fields
            this.editedFields[fieldId] = {
              value: response.filePath,
              originalValue: hiddenInput.dataset.originalValue,
              label: displayName,
              isFile: true,
            };

            // Update current file display
            currentFileDisplay.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                <polyline points="13 2 13 9 20 9"></polyline>
              </svg>
              <span>${response.filePath.split("/").pop()}</span>
              <button type="button" onclick="previewDocument('${
                response.filePath
              }')" class="btn btn-link p-0 ms-2">View</button>
              <button type="button" onclick="dashboardManager.removeFile(${fieldId}, '${fieldName}')" class="btn btn-link text-danger p-0 ms-2">Remove</button>
            `;

            // Add the has-changes class to the Edit button to trigger animation
            const editBtn = document.getElementById(
              this.isIncompleteRegistration ? "incompleteEditBtn" : "editBtn"
            );
            if (editBtn) {
              editBtn.classList.add("has-changes");
            }

            // Update save button state
            this.updateSaveButtonState();

            this.showToast(
              "File Uploaded",
              `File "${file.name}" has been uploaded successfully.`
            );
          } catch (error) {
            console.error("Error parsing response:", error);
            alert("Error uploading file: Invalid server response");
          }
        } else {
          let errorMessage = `Error uploading file: ${xhr.status} ${xhr.statusText}`;

          // Try to parse error message from response
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            if (errorResponse.message) {
              errorMessage = errorResponse.message;
            }
          } catch (e) {
            // If can't parse JSON, use default error message
          }

          console.error(
            "Server error:",
            xhr.status,
            xhr.statusText,
            errorMessage
          );
          alert(errorMessage);
        }

        // Reset the file input and hide progress
        fileInput.value = "";
        progressContainer.style.display = "none";
        progressBar.style.width = "0%";
        progressBar.textContent = "";
      });

      xhr.addEventListener("error", () => {
        console.error("Network error during file upload");
        alert("Network error during file upload. Please try again.");
        progressContainer.style.display = "none";
        fileInput.value = "";
      });

      xhr.addEventListener("abort", () => {
        progressContainer.style.display = "none";
        fileInput.value = "";
      });

      // Determine the endpoint based on whether we're editing an incomplete registration or a regular application
      const endpoint = this.isIncompleteRegistration
        ? "/api/admin/incomplete-registrations/upload-file"
        : "/api/admin/applications/upload-file";

      xhr.open("POST", endpoint, true);
      xhr.setRequestHeader(
        "Authorization",
        `Bearer ${AuthManager.getAuthToken()}`
      );
      xhr.send(formData);
    } catch (error) {
      console.error("File upload error:", error);
      alert("Error uploading file: " + error.message);
      fileInput.value = "";
    }
  }

  // Remove a file from a field
  async removeFile(fieldId, fieldName) {
    try {
      const hiddenInput = document.getElementById(fieldName);
      if (!hiddenInput) return;

      const originalValue = hiddenInput.dataset.originalValue;
      const currentValue = hiddenInput.value;

      // If the value is empty, there's nothing to delete
      if (!currentValue) {
        return;
      }

      // Get the display name from the closest form-field's field-label
      const formField = hiddenInput.closest(".form-field");
      let displayName = fieldName;

      if (formField && formField.querySelector(".field-label")) {
        displayName = formField.querySelector(".field-label").textContent;
      }

      // Confirm removal
      if (
        !confirm(
          `Are you sure you want to remove the current file?\nThis cannot be undone.`
        )
      ) {
        return;
      }

      // Show loading state
      const container = hiddenInput.closest(".edit-field-container");
      const currentFileDisplay = container.querySelector(".current-file");
      if (currentFileDisplay) {
        currentFileDisplay.innerHTML = `
          <div class="d-flex align-items-center">
            <span class="spinner-border spinner-border-sm me-2" role="status"></span>
            <span>Deleting file...</span>
          </div>
        `;
      }

      // Get the appropriate endpoint based on whether we're editing an incomplete registration or a regular application
      const endpoint = this.isIncompleteRegistration
        ? `/api/admin/incomplete-registrations/delete-file/${fieldId}`
        : `/api/admin/applications/delete-file/${fieldId}`;

      // Prepare the request body with file path and ID information
      const requestBody = {
        filePath: currentValue,
      };

      // Add the appropriate ID based on the context
      if (this.isIncompleteRegistration && this.currentRegistration?.id) {
        requestBody.registrationId = this.currentRegistration.id;
      } else if (!this.isIncompleteRegistration && this.currentApplicationId) {
        requestBody.applicationId = this.currentApplicationId;
      }

      // Call the server to delete the file
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `Server returned ${response.status}`
        );
      }

      // Update hidden input to empty value
      hiddenInput.value = "";

      // Update edited fields if value changed from original
      if (originalValue) {
        // Store filename for history display
        const fileName = originalValue.split("/").pop();

        this.editedFields[fieldId] = {
          value: "__FILE_REMOVED__",
          originalValue: originalValue,
          originalFileName: fileName, // Store filename explicitly to display in history
          label: displayName,
          isFile: true,
          isRemoved: true,
        };

        // Add the has-changes class to the Edit button to trigger animation
        const editBtn = document.getElementById(
          this.isIncompleteRegistration ? "incompleteEditBtn" : "editBtn"
        );
        if (editBtn) {
          editBtn.classList.add("has-changes");
        }
      } else {
        // If original was also empty, no change to track
        delete this.editedFields[fieldId];
      }

      // Update file display to show "No file"
      if (currentFileDisplay) {
        currentFileDisplay.innerHTML = `<span class='text-muted'>No file currently uploaded</span>`;
      }

      // Update save button state
      this.updateSaveButtonState();

      // Show toast
      this.showToast(
        "File Removed",
        "The file has been permanently deleted from the server."
      );
    } catch (error) {
      console.error("Error removing file:", error);
      alert("Error removing file: " + error.message);

      // Reset the display if there was an error
      const hiddenInput = document.getElementById(fieldName);
      if (hiddenInput) {
        const container = hiddenInput.closest(".edit-field-container");
        const currentFileDisplay = container.querySelector(".current-file");
        const currentValue = hiddenInput.value;

        if (currentFileDisplay && currentValue) {
          currentFileDisplay.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
              <polyline points="13 2 13 9 20 9"></polyline>
            </svg>
            <span>${currentValue.split("/").pop()}</span>
            <button type="button" onclick="previewDocument('${currentValue}')" class="btn btn-link p-0 ms-2">View</button>
            <button type="button" onclick="dashboardManager.removeFile(${fieldId}, '${fieldName}')" class="btn btn-link text-danger p-0 ms-2">Remove</button>
          `;
        }
      }
    }
  }

  showRecentApplicationsView() {
    this.isAllApplicationsView = false;
    this.locationFilterActive = false;
    this.activeLocationFilter = null;

    // Get the recent applications container
    const recentAppsContainer = document.querySelector(".content-card");
    if (!recentAppsContainer) return;

    // Restore the original header
    recentAppsContainer.querySelector(".card-header").innerHTML = `
      <h2>Recent Applications</h2>
      <a href="#" class="btn btn-primary btn-sm">View All</a>
    `;

    // Remove the hierarchical filter container if it exists
    const locationFilterContainer = document.getElementById(
      "locationFilterContainer"
    );
    if (locationFilterContainer) {
      locationFilterContainer.remove();
    }

    // Remove pagination container - update selector to match new class
    const paginationContainer = recentAppsContainer.querySelector(
      ".pagination-container"
    );
    if (paginationContainer) {
      paginationContainer.remove();
    }

    // Make sure the header contains all the correct columns for recent applications view
    const tableHeader = recentAppsContainer.querySelector("thead tr");
    if (tableHeader) {
      tableHeader.innerHTML = `
        <th>Application ID</th>
        <th>Applicant Name</th>
        <th>Submission Date</th>
        <th>Type of Disability</th>
        <th>Location</th>
      `;
    }

    // Reload recent applications
    this.loadRecentApplications();

    // Update URL without reloading the page
    history.pushState(null, "", "/admin/dashboard");

    // Reattach event listener to View All button
    this.setupAllApplicationsEventListeners();
  }

  // Parse location data to show appropriate level based on filtering
  parseLocationDisplay(locationData, showLevel = 1) {
    if (!locationData) return "Not specified";

    try {
      // Check if it's already a hierarchical structure in JSON format
      let parsedLocation = locationData;

      if (typeof locationData === "string") {
        // Check if it's a JSON string
        if (
          locationData.trim().startsWith("{") ||
          locationData.trim().startsWith("[")
        ) {
          try {
            parsedLocation = JSON.parse(locationData);
          } catch (e) {
            // Not valid JSON, treat as a delimited string
            const levels = locationData.split(/[,>]/);
            if (levels.length >= showLevel) {
              return levels[showLevel - 1].trim();
            } else {
              return locationData; // Return the whole string if levels are fewer than requested
            }
          }
        } else {
          // Simple delimited string like "Level1, Level2, Level3" or "Level1 > Level2 > Level3"
          const levels = locationData.split(/[,>]/);
          if (levels.length >= showLevel) {
            return levels[showLevel - 1].trim();
          } else {
            return locationData; // Return the whole string if levels are fewer than requested
          }
        }
      }

      // If we have a parsed object, handle various formats
      if (Array.isArray(parsedLocation)) {
        // Array format: [{level: 1, value: "foo"}, {level: 2, value: "bar"}]
        if (
          parsedLocation.length > 0 &&
          parsedLocation[0].level !== undefined &&
          parsedLocation[0].value !== undefined
        ) {
          const match = parsedLocation.find((item) => item.level === showLevel);
          return match
            ? match.value
            : parsedLocation[0].value || "Not specified";
        } else {
          // Simple array format: ["Level1", "Level2", "Level3"]
          return parsedLocation.length >= showLevel
            ? parsedLocation[showLevel - 1]
            : parsedLocation[0] || "Not specified";
        }
      } else if (
        typeof parsedLocation === "object" &&
        parsedLocation !== null
      ) {
        // Object format with levels as keys: {level1: "foo", level2: "bar"}
        const levelKey = `level${showLevel}`;
        return (
          parsedLocation[levelKey] || parsedLocation.level1 || "Not specified"
        );
      }

      // Fallback to original data if we couldn't parse it
      return locationData;
    } catch (e) {
      console.error("Error parsing location data:", e);
      return locationData || "Not specified";
    }
  }

  // Get the display level for location based on active filters
  getLocationDisplayLevel() {
    // If a location filter is active, show the level after the filtered level
    if (this.locationFilterActive && this.activeLocationFilter) {
      // If we've filtered to level 1, show level 2, etc.
      return this.activeLocationFilter.level + 1;
    }
    // By default, show level 1 only
    return 1;
  }
}

// Initialize dashboard
let dashboardManager;
document.addEventListener("DOMContentLoaded", async () => {
  // Define checkAuth function locally
  async function checkAuth() {
    try {
      const response = await fetch("/api/auth/verify", {
        headers: {
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === "TOKEN_EXPIRED" || data.code === "TOKEN_MISSING") {
          AuthManager.clearAuth();
          window.location.href = "/department-login";
          return false;
        }
        throw new Error(data.message);
      }

      return true;
    } catch (error) {
      console.error("Auth check failed:", error);
      // Only show alert for non-redirect errors
      if (window.location.pathname !== "/department-login") {
        alert("Authentication failed. Please login again.");
        window.location.href = "/department-login";
      }
      return false;
    }
  }

  if (!(await checkAuth())) return;

  // Configure default toast options
  const toastElList = document.querySelectorAll(".toast");
  toastElList.forEach((toastEl) => {
    const options = {
      animation: true,
      autohide: true,
      delay: 5000,
    };
    new bootstrap.Toast(toastEl, options);
  });

  // Ensure toast container has the right positioning classes
  const toastContainer = document.querySelector(".toast-container");
  if (toastContainer) {
    // Make sure the toast container is positioned at the bottom-right
    if (
      !toastContainer.classList.contains("bottom-0") &&
      !toastContainer.classList.contains("end-0")
    ) {
      toastContainer.classList.add("bottom-0", "end-0", "p-3");
    }
  }

  dashboardManager = new DashboardManager();
});

// Add this function to handle document preview
async function previewDocument(fileName) {
  try {
    // Get temporary URL for the file
    const response = await fetch(`/api/admin/files/access-url/${fileName}`, {
      headers: {
        Authorization: `Bearer ${AuthManager.getAuthToken()}`,
      },
    });

    if (response.status === 403) {
      alert("You don't have permission to view this document.");
      return;
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to get file access URL");
    }

    const { accessUrl } = await response.json();

    const modalHtml = `
      <div class="modal fade" id="documentPreviewModal" tabindex="-1">
        <div class="modal-dialog modal-xl modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Document Preview</h5>
              <div class="ms-auto">
                <button onclick="downloadDocument('${fileName}', '${accessUrl}')" class="btn btn-sm download-btn">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="me-1">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download
                </button>
                <button type="button" class="btn-close d-flex align-items-center" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
            </div>
            <div class="modal-body p-0">
              <div class="document-preview-container">
                ${
                  fileName.match(/\.(jpg|jpeg|png|gif)$/i)
                    ? `<img src="${accessUrl}" class="img-preview" alt="Document preview">`
                    : `<iframe src="${accessUrl}#toolbar=0" class="pdf-preview"></iframe>`
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById("documentPreviewModal");
    if (existingModal) {
      existingModal.remove();
    }

    // Add modal to body
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // Show modal
    const modal = new bootstrap.Modal(
      document.getElementById("documentPreviewModal")
    );
    modal.show();

    // Clean up on modal hide
    document
      .getElementById("documentPreviewModal")
      .addEventListener("hidden.bs.modal", function () {
        this.remove();
      });
  } catch (error) {
    alert(
      error.message || "Failed to load document preview. Please try again."
    );
  }
}

// Add download function
async function downloadDocument(fileName, accessUrl) {
  try {
    // Fetch the file with authentication
    const response = await fetch(accessUrl);

    if (!response.ok) throw new Error("Failed to download file");

    // Get the blob
    const blob = await response.blob();

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName; // Set the download filename
    document.body.appendChild(a);
    a.click();

    // Cleanup
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error("Download error:", error);
    alert("Failed to download file");
  }
}

async function checkAuthAndLoadData() {
  try {
    const response = await fetch("/api/auth/verify", {
      headers: {
        Authorization: `Bearer ${AuthManager.getAuthToken()}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.code === "TOKEN_EXPIRED" || data.code === "TOKEN_MISSING") {
        AuthManager.clearAuthToken();
        window.location.href = "/department-login";
        return;
      }
      throw new Error(data.message);
    }

    // Load dashboard data...
  } catch (error) {
    console.error("Auth check failed:", error);
    // Only show alert for non-redirect errors
    if (window.location.pathname !== "/department-login") {
      alert("Authentication failed. Please login again.");
      window.location.href = "/department-login";
    }
  }
}

// Check auth on page load
document.addEventListener("DOMContentLoaded", checkAuthAndLoadData);

// Add styles for nested values
const style = document.createElement("style");
style.textContent = `
  .nested-values {
    display: flex;
    flex-direction: column;
  }
  
  .nested-values .form-field:not(:last-child) {
    margin-bottom: 0.75rem;
  }
`;
document.head.appendChild(style);
