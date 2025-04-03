class DashboardManager {
  constructor() {
    this.loadStats();
    this.loadRecentApplications();
    this.applicationModal = new bootstrap.Modal(
      document.getElementById("applicationModal")
    );
    this.editHistoryModal = new bootstrap.Modal(
      document.getElementById("editHistoryModal")
    );
    this.isEditMode = false;
    this.currentApplicationId = null;
    this.editedFields = {};
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
      document.getElementById("pendingApplications").textContent =
        stats.pendingApplications;
      document.getElementById("approvedToday").textContent =
        stats.approvedToday;
      document.getElementById("activeUsers").textContent = stats.activeUsers;
    } catch (error) {}
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
          </tr>
        `
        )
        .join("");
    } catch (error) {
      console.error("Error:", error);
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

      // Update status badge
      const statusBadge = document.getElementById("modalStatus");
      statusBadge.className = `status-badge ${
        data.service_status || "pending"
      }`;
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
            <div class="current-file">
              ${
                fieldValue
                  ? `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                  <polyline points="13 2 13 9 20 9"></polyline>
                </svg>
                <span>${fieldValue.split("/").pop()}</span>
                <button onclick="previewDocument('${fieldValue}')" class="btn btn-link p-0 ms-2">View</button>
                `
                  : "No file uploaded"
              }
            </div>
            <div class="mt-2">
              <span class="text-muted">File editing not supported in this version</span>
            </div>
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

  toggleEditMode() {
    const editBtnText = document.getElementById("editBtnText");
    const editBtn = document.getElementById("editBtn");

    if (this.isEditMode) {
      // If we have changes and we're in edit mode, save the changes
      if (Object.keys(this.editedFields).length > 0) {
        this.saveChanges();
        return;
      }

      // Otherwise, just exit edit mode
      this.isEditMode = false;
      editBtnText.textContent = "Edit Responses";

      // Remove the has-changes class when exiting edit mode
      editBtn.classList.remove("has-changes");

      // Refresh the application view to reset the form
      this.viewApplication(this.currentApplicationId);
    } else {
      // Enter edit mode
      this.isEditMode = true;
      editBtnText.textContent = "Cancel Edit";
      this.editedFields = {};

      // Ensure the button always keeps the btn-primary class
      editBtn.classList.remove("btn-outline-primary");
      editBtn.classList.add("btn-primary");

      // Refresh the form to show editable fields
      const formDataContainer = document.getElementById("modalFormData");
      const sections = Array.from(
        document.querySelectorAll(".form-section")
      ).map((section) => {
        return {
          name: section.querySelector("h5").textContent,
          fields: Array.from(section.querySelectorAll(".form-field"))
            .map((field) => {
              const labelEl = field.querySelector(".field-label");
              const valueEl = field.querySelector(".field-value");

              if (!labelEl || !valueEl) return null;

              return {
                display_name: labelEl.textContent,
                value: valueEl.textContent !== "-" ? valueEl.textContent : "",
                field_type: "text", // Default to text, will be overridden by actual data
              };
            })
            .filter((f) => f !== null),
        };
      });

      // Re-fetch the application data to get proper field types
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
      payload.responses.push({
        field_id: fieldId,
        value: this.editedFields[fieldId].value,
        reason: reason,
      });
    });

    // Show loading state
    const saveBtn = document.getElementById("confirmEditBtn");
    const originalBtnText = saveBtn.innerHTML;
    saveBtn.innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
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

    // Check if it's a file path
    if (typeof value === "string" && value.includes("/")) {
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
      statusBadge.className = `status-badge ${newStatus}`;
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

      // Refresh the applications list
      this.loadRecentApplications();
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
      statusBadge.className = `status-badge ${result.status}`;
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

      // Reload the applications list
      await this.loadRecentApplications();
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
}

// Initialize dashboard
let dashboardManager;
document.addEventListener("DOMContentLoaded", () => {
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
