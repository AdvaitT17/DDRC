// Enhanced Filters System for Reports
class EnhancedFilterSystem {
  constructor() {
    // DOM element references
    this.filterPanel = document.querySelector(".filter-panel");
    this.filterFieldSelect = document.getElementById("enhanced-filterField");
    this.dynamicFilterControls = document.getElementById(
      "enhanced-dynamicFilterControls"
    );
    this.filterActionButtons = document.getElementById(
      "enhanced-filterActionButtons"
    );
    this.activeFiltersContainer = document.getElementById("activeFilterTags");
    this.savedFiltersContainer = document.getElementById(
      "enhanced-savedFiltersContainer"
    );

    // Fields data
    this.allFields = [];

    // Current state
    this.currentField = null;
    this.currentOperator = null;
    this.activeFilters = [];
    this.savedFilters = [];

    // Initialize
    if (this.filterPanel) {
      this.initToggle();
    }

    this.loadFieldsData();

    // Initialize event listeners
    this.initEventListeners();

    // Ensure filter visibility
    this.ensureFilterVisibility();

    // Add a window load event to double-check visibility
    window.addEventListener("load", () => {
      setTimeout(() => {
        this.ensureFilterVisibility();
      }, 500);
    });
  }

  initEventListeners() {
    // Field selection change
    const filterFieldSelect = document.getElementById("enhanced-filterField");
    if (filterFieldSelect) {
      filterFieldSelect.addEventListener("change", (e) => {
        // Get the selected field
        const fieldId = e.target.value;

        if (!fieldId) {
          // Clear and hide dynamic controls when no field is selected
          if (this.dynamicFilterControls) {
            this.dynamicFilterControls.innerHTML = "";
            this.dynamicFilterControls.style.display = "none";
          }

          // Hide filter action buttons
          if (this.filterActionButtons) {
            this.filterActionButtons.style.display = "none";
          }
          return;
        }

        // Find the corresponding field in our allFields array
        const field = this.allFields.find(
          (f) => f.id.toString() === fieldId.toString()
        );

        if (!field) {
          console.error("Field not found:", fieldId);
          return;
        }

        // Store the current field
        this.currentField = field;

        // Render filter controls based on field type
        this.renderFilterControlsByFieldType();
      });
    } else {
      console.error("Filter field select not found");
    }

    // Add filter button
    const addFilterBtn = document.getElementById("enhanced-addFilterBtn");
    if (addFilterBtn) {
      addFilterBtn.addEventListener("click", () => {
        this.addCurrentFilterToActiveFilters();
      });
    }

    // Clear filter button
    const clearFilterBtn = document.getElementById("enhanced-cancelFilterBtn");
    if (clearFilterBtn) {
      clearFilterBtn.addEventListener("click", () => {
        this.clearCurrentFilter();
      });
    }

    // Clear all filters button
    const clearAllFiltersBtn = document.getElementById("clearAllFiltersBtn");
    if (clearAllFiltersBtn) {
      clearAllFiltersBtn.addEventListener("click", () => {
        this.clearAllFilters();
      });
    }

    // Save filters button - open modal - attach to ALL save filter buttons
    const saveFilterBtns = document.querySelectorAll("#saveCurrentFiltersBtn");
    if (saveFilterBtns.length > 0) {
      saveFilterBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          this.showSaveFilterModal();
        });
      });
    }

    // Save filters confirmation button in modal
    const confirmSaveFilterBtn = document.getElementById(
      "confirmSaveFilterBtn"
    );
    if (confirmSaveFilterBtn) {
      confirmSaveFilterBtn.addEventListener("click", () => {
        this.saveFilters();
      });
    }
  }

  // Show save filter modal
  showSaveFilterModal() {
    // First, hide any filter elements that might interfere with the modal
    const filterField = document.getElementById("enhanced-filterField");
    const filterControls = document.querySelectorAll(
      ".filter-controls, #enhanced-dynamicFilterControls"
    );

    if (filterField) {
      filterField.style.display = "none";
    }

    filterControls.forEach((control) => {
      if (control) control.style.display = "none";
    });

    // Check if we have active filters
    if (this.activeFilters.length === 0) {
      alert("No active filters to save");
      return;
    }

    // Find the modal
    const modal = document.getElementById("saveFilterModal");
    if (!modal) {
      console.error("Save filter modal not found");
      return;
    }

    // Show the filters in the modal
    const modalFilterList = document.getElementById("modalFilterList");
    if (modalFilterList) {
      modalFilterList.innerHTML = "";

      // Create a list of applied filters
      const filterList = document.createElement("ul");
      filterList.className = "list-group";

      this.activeFilters.forEach((filter, index) => {
        const listItem = document.createElement("li");
        listItem.className =
          "list-group-item d-flex justify-content-between align-items-center";

        listItem.innerHTML = `
          <div>
            <span class="badge bg-primary rounded-pill me-2">${index + 1}</span>
            ${filter.displayText}
          </div>
        `;

        filterList.appendChild(listItem);
      });

      modalFilterList.appendChild(filterList);
    }

    // Show the modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
  }

  // Load fields data to populate filter fields dropdown
  loadFieldsData() {
    // First check if we have the select element
    if (!this.filterFieldSelect) {
      console.error("Filter field select element not found");
      return;
    }

    // Try to get the fields from the form builder if available
    try {
      if (window.ReportsManager && window.ReportsManager.formFields) {
        this.allFields = window.ReportsManager.formFields;
      }

      // Populate the select dropdown
      else this.populateFieldSelect();
    } catch (error) {
      console.error("Error loading fields data:", error);
    }
  }

  // Populate the field select dropdown
  populateFieldSelect() {
    if (!this.filterFieldSelect) {
      console.error("Filter field select not found");
      return;
    }

    // Clear existing options except the first one
    while (this.filterFieldSelect.options.length > 1) {
      this.filterFieldSelect.remove(1);
    }

    // Group fields by sections
    const fieldsBySection = {};
    this.allFields.forEach((field, index) => {
      if (!field.id || (!field.label && !field.display_name && !field.name)) {
        console.warn(`Field at index ${index} is missing id or label:`, field);
        return;
      }

      const sectionName = field.section_name || "Other";
      if (!fieldsBySection[sectionName]) {
        fieldsBySection[sectionName] = [];
      }
      fieldsBySection[sectionName].push(field);
    });

    // Add fields to select, grouped by section
    Object.keys(fieldsBySection)
      .sort()
      .forEach((sectionName) => {
        // Create optgroup for this section
        const optgroup = document.createElement("optgroup");
        optgroup.label = sectionName;
        this.filterFieldSelect.appendChild(optgroup);

        // Add fields for this section
        fieldsBySection[sectionName].forEach((field) => {
          const option = document.createElement("option");
          option.value = field.id;
          option.textContent =
            field.label || field.display_name || field.name || field.id;
          optgroup.appendChild(option);
        });
      });

    // Force a refresh of the select element
    $(this.filterFieldSelect).trigger("change");

    // If Select2 is being used, refresh it
    try {
      if ($.fn.select2 && $(this.filterFieldSelect).data("select2")) {
        $(this.filterFieldSelect).select2("destroy").select2();
      }
    } catch (error) {
      console.warn("Error refreshing select2:", error);
    }
  }

  // Initialize after document ready and ensure filter dropdowns are visible
  ensureFilterVisibility() {
    // Make sure the filter field select is visible
    if (this.filterFieldSelect) {
      const computedStyle = window.getComputedStyle(this.filterFieldSelect);

      const currentDisplay = computedStyle.display;
      if (currentDisplay === "none") {
        this.filterFieldSelect.style.display = "block !important";
      }

      // Reset any CSS that might be hiding the dropdown
      this.filterFieldSelect.style.opacity = "1 !important";
      this.filterFieldSelect.style.visibility = "visible !important";
      this.filterFieldSelect.style.height = "auto !important";
      this.filterFieldSelect.style.overflow = "visible !important";
      this.filterFieldSelect.style.position = "static !important";
      this.filterFieldSelect.style.zIndex = "9999 !important";

      // Add !important to CSS rules using setAttribute
      this.filterFieldSelect.setAttribute(
        "style",
        "display: block !important; " +
          "visibility: visible !important; " +
          "opacity: 1 !important; " +
          "height: auto !important; " +
          "min-height: 38px !important; " +
          "overflow: visible !important; " +
          "position: relative !important; " +
          "z-index: 50 !important;" // Reduce z-index to prevent modal interference
      );

      // Check if the dropdown has options
      if (this.filterFieldSelect.options.length <= 1) {
        this.populateFieldSelect();
      }

      // Force browser reflow
      void this.filterFieldSelect.offsetHeight;
    }

    // Check active filters container
    if (this.activeFiltersContainer) {
      this.activeFiltersContainer.style.display = "block";
    }

    // Check dynamic filter controls
    if (this.dynamicFilterControls) {
      // Only show if there's a current field
      if (this.currentField) {
        this.dynamicFilterControls.style.display = "block";
      }
    }

    // Final check for Select2 interference
    try {
      if ($.fn.select2 && $(this.filterFieldSelect).data("select2")) {
        $(this.filterFieldSelect).select2("destroy");

        // Force standard browser dropdown appearance
        this.filterFieldSelect.setAttribute(
          "style",
          "display: block !important; " +
            "visibility: visible !important; " +
            "opacity: 1 !important; " +
            "height: auto !important; " +
            "min-height: 38px !important; " +
            "overflow: visible !important; " +
            "position: relative !important; " +
            "z-index: 50 !important; " + // Reduce z-index to prevent modal interference
            "-webkit-appearance: menulist !important; " +
            "-moz-appearance: menulist !important; " +
            "appearance: menulist !important;"
        );
      }
    } catch (error) {
      console.warn("Error handling Select2:", error);
    }

    // Add event listeners to hide filter fields when modals are shown
    this.setupModalEventListeners();
  }

  // Set up event listeners to handle modal interactions
  setupModalEventListeners() {
    // Listen for modals being shown and hide the filter select
    document.addEventListener("show.bs.modal", (event) => {
      if (this.filterFieldSelect) {
        this.filterFieldSelect.style.display = "none";
      }

      // Also hide any other filter controls that might interfere
      const filterControls = document.querySelectorAll(
        ".filter-controls, #enhanced-dynamicFilterControls"
      );
      filterControls.forEach((control) => {
        if (control) control.style.display = "none";
      });
    });

    // Listen for modals being hidden and restore filter select
    document.addEventListener("hidden.bs.modal", (event) => {
      // Only restore visibility if we're not in a filter adding state
      if (this.filterFieldSelect && !this.currentField) {
        this.filterFieldSelect.style.display = "block";
      }

      // Restore other filter controls if needed
      if (this.currentField) {
        const filterControls = document.querySelectorAll(
          ".filter-controls, #enhanced-dynamicFilterControls"
        );
        filterControls.forEach((control) => {
          if (control) control.style.display = "block";
        });
      }
    });
  }

  // Render filter controls based on the selected field type
  renderFilterControlsByFieldType() {
    if (!this.currentField) {
      console.error("No current field to render controls for");
      return;
    }

    // Get the selected field type
    const fieldType = this.currentField.field_type || "text";

    // Get the container where we'll render controls
    this.dynamicFilterControls = document.getElementById(
      "enhanced-dynamicFilterControls"
    );

    if (!this.dynamicFilterControls) {
      console.error("Dynamic filter controls container not found!");
      return;
    }

    // Clear previous controls
    this.dynamicFilterControls.innerHTML = "";

    // First render the operators
    const operatorHtml = this.renderOperators(fieldType);

    // Then render the appropriate value inputs
    let valueHtml = "";

    switch (fieldType) {
      case "select":
      case "radio":
      case "checkbox":
        valueHtml = this.createOptionBasedControls();
        break;

      case "text":
      case "alphanumeric":
      case "email":
      case "textarea":
        valueHtml = this.createTextBasedControls();
        break;

      case "number":
        valueHtml = this.createNumericControls();
        break;

      case "date":
        valueHtml = this.createDateControls();
        break;

      case "phone":
        valueHtml = this.createPhoneControls();
        break;

      case "nested-select":
        valueHtml = this.createNestedSelectControls();
        break;

      default:
        valueHtml = this.createTextBasedControls();
    }

    // Set the HTML for the controls
    const html = `
      ${operatorHtml}
      ${valueHtml}
    `;

    this.dynamicFilterControls.innerHTML = html;

    // Make the controls visible with important flag
    this.dynamicFilterControls.style.cssText =
      "display: block !important; visibility: visible !important;";

    const filterActionButtons = document.getElementById(
      "enhanced-filterActionButtons"
    );
    if (filterActionButtons) {
      filterActionButtons.style.cssText =
        "display: flex !important; visibility: visible !important;";
    } else {
      console.error("Filter action buttons not found");
    }

    // Set up button event listeners
    this.setupFilterActionButtons();

    // Double check visibility
    setTimeout(() => {
      this.ensureFilterVisibility();
    }, 100);
  }

  // Create controls for option-based fields (select, radio, checkbox)
  createOptionBasedControls() {
    const fieldOptions = this.parseFieldOptions(this.currentField.options);

    if (!fieldOptions || fieldOptions.length === 0) {
      console.warn("No options found for field:", this.currentField);
      return `<div class="alert alert-warning">No options available for this field</div>`;
    }

    // Different display based on field type
    const fieldType = this.currentField.field_type;

    // For regular select dropdown
    if (fieldType === "select") {
      return `
        <div class="filter-value-container" id="enhanced-singleSelectContainer">
          <label for="enhanced-filterValueSelect">Select Value</label>
          <select class="form-control" id="enhanced-filterValueSelect">
            <option value="">Select a value</option>
            ${fieldOptions
              .map(
                (option) =>
                  `<option value="${option.value}">${option.label}</option>`
              )
              .join("")}
          </select>
        </div>
        
        <div class="filter-value-container" id="enhanced-multiSelectContainer" style="display:none;">
          <label>Select Multiple Values</label>
          <div class="checkbox-group">
            ${fieldOptions
              .map(
                (option) => `
              <div class="form-check">
                <input class="form-check-input enhanced-filter-value-checkbox" type="checkbox" id="check-${option.value}" value="${option.value}">
                <label class="form-check-label" for="check-${option.value}">${option.label}</label>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    // For radio buttons - display as radio buttons
    if (fieldType === "radio") {
      return `
        <div class="filter-value-container" id="enhanced-singleSelectContainer">
          <label>Select Value</label>
          <div class="radio-group">
            ${fieldOptions
              .map(
                (option, index) => `
              <div class="form-check">
                <input class="form-check-input enhanced-filter-value-radio" type="radio" name="enhanced-radio-option" id="radio-${index}" value="${option.value}">
                <label class="form-check-label" for="radio-${index}">${option.label}</label>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
        
        <div class="filter-value-container" id="enhanced-multiSelectContainer" style="display:none;">
          <label>Select Multiple Values</label>
          <div class="checkbox-group">
            ${fieldOptions
              .map(
                (option, index) => `
              <div class="form-check">
                <input class="form-check-input enhanced-filter-value-checkbox" type="checkbox" id="check-${index}" value="${option.value}">
                <label class="form-check-label" for="check-${index}">${option.label}</label>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    // For checkboxes - display as checkboxes
    if (fieldType === "checkbox") {
      return `
        <div class="filter-value-container" id="enhanced-singleSelectContainer">
          <label>Select Value</label>
          <select class="form-control" id="enhanced-filterValueSelect">
            <option value="">Select a value</option>
            ${fieldOptions
              .map(
                (option) =>
                  `<option value="${option.value}">${option.label}</option>`
              )
              .join("")}
          </select>
        </div>
        
        <div class="filter-value-container" id="enhanced-multiSelectContainer" style="display:none;">
          <label>Select Multiple Values</label>
          <div class="checkbox-group">
            ${fieldOptions
              .map(
                (option, index) => `
              <div class="form-check">
                <input class="form-check-input enhanced-filter-value-checkbox" type="checkbox" id="check-${index}" value="${option.value}">
                <label class="form-check-label" for="check-${index}">${option.label}</label>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    // Default for any other option-based field type
    return `
      <div class="filter-value-container" id="enhanced-singleSelectContainer">
        <label for="enhanced-filterValueSelect">Select Value</label>
        <select class="form-control" id="enhanced-filterValueSelect">
          <option value="">Select a value</option>
          ${fieldOptions
            .map(
              (option) =>
                `<option value="${option.value}">${option.label}</option>`
            )
            .join("")}
        </select>
      </div>
      
      <div class="filter-value-container" id="enhanced-multiSelectContainer" style="display:none;">
        <label>Select Multiple Values</label>
        <div class="checkbox-group">
          ${fieldOptions
            .map(
              (option) => `
            <div class="form-check">
              <input class="form-check-input enhanced-filter-value-checkbox" type="checkbox" id="check-${option.value}" value="${option.value}">
              <label class="form-check-label" for="check-${option.value}">${option.label}</label>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  // Create controls for text-based fields
  createTextBasedControls() {
    return `
      <div class="filter-value-container" id="enhanced-textValueContainer">
        <label for="enhanced-textValue">Enter Value</label>
        <input type="text" class="form-control" id="enhanced-textValue">
      </div>
    `;
  }

  // Create controls for numeric fields
  createNumericControls() {
    return `
      <div class="filter-value-container" id="enhanced-singleNumberContainer">
        <label for="enhanced-numberValue">Enter Value</label>
        <input type="number" class="form-control" id="enhanced-numberValue">
      </div>
      
      <div class="filter-value-container" id="enhanced-numberRangeContainer" style="display:none;">
        <label>Enter Range</label>
        <div class="row">
          <div class="col-md-6">
            <input type="number" class="form-control" id="enhanced-numberMinValue" placeholder="Minimum">
          </div>
          <div class="col-md-6">
            <input type="number" class="form-control" id="enhanced-numberMaxValue" placeholder="Maximum">
          </div>
        </div>
      </div>
    `;
  }

  // Create controls for date fields
  createDateControls() {
    return `
      <div class="filter-value-container" id="enhanced-singleDateContainer">
        <label for="enhanced-dateValue">Select Date</label>
        <input type="date" class="form-control" id="enhanced-dateValue">
      </div>
      
      <div class="filter-value-container" id="enhanced-dateRangeContainer" style="display:none;">
        <label>Select Date Range</label>
        <div class="row">
          <div class="col-md-6">
            <input type="date" class="form-control" id="enhanced-dateStartValue" placeholder="Start Date">
          </div>
          <div class="col-md-6">
            <input type="date" class="form-control" id="enhanced-dateEndValue" placeholder="End Date">
          </div>
        </div>
      </div>
    `;
  }

  // Create controls for phone fields
  createPhoneControls() {
    return `
      <div class="filter-value-container" id="enhanced-phoneValueContainer">
        <label for="enhanced-phoneValue">Enter Phone Number</label>
        <input type="tel" class="form-control" id="enhanced-phoneValue" placeholder="e.g. (123) 456-7890">
      </div>
    `;
  }

  // Toggle visibility of value containers based on selected operator
  toggleValueContainersByOperator() {
    const valueContainers = this.dynamicFilterControls.querySelectorAll(
      ".filter-value-container"
    );

    const operator = this.currentOperator;

    // First hide all containers
    valueContainers.forEach((container) => {
      container.style.display = "none";
    });

    // Show appropriate containers based on operator
    if (["is_empty", "is_not_empty"].includes(operator)) {
      return;
    }

    // Get the field type
    if (!this.currentField) {
      console.error("No current field set");
      return;
    }

    const fieldType = this.currentField.field_type;

    try {
      switch (fieldType) {
        case "select":
        case "radio":
        case "checkbox":
          if (["in", "not_in"].includes(operator)) {
            const container = document.getElementById(
              "enhanced-multiSelectContainer"
            );
            if (container) {
              container.style.display = "block";
            } else {
              console.error("Multi-select container not found");
            }
          } else {
            const container = document.getElementById(
              "enhanced-singleSelectContainer"
            );
            if (container) {
              container.style.display = "block";

              // Special handling for radio buttons
              if (fieldType === "radio") {
                // Make sure radio buttons are visible and enabled
                const radioButtons = container.querySelectorAll(
                  ".enhanced-filter-value-radio"
                );
                radioButtons.forEach((radio) => {
                  radio.disabled = false;
                  const label = document.querySelector(
                    `label[for="${radio.id}"]`
                  );
                  if (label) {
                    label.style.color = "";
                  }
                });
              }
            } else {
              console.error("Single-select container not found");
            }
          }
          break;

        case "number":
          if (operator === "between") {
            const container = document.getElementById(
              "enhanced-numberRangeContainer"
            );
            if (container) {
              container.style.display = "block";
            } else {
              console.error("Number range container not found");
            }
          } else {
            const container = document.getElementById(
              "enhanced-singleNumberContainer"
            );
            if (container) {
              container.style.display = "block";
            } else {
              console.error("Single number container not found");
            }
          }
          break;

        case "date":
          if (operator === "between") {
            const container = document.getElementById(
              "enhanced-dateRangeContainer"
            );
            if (container) {
              container.style.display = "block";
            } else {
              console.error("Date range container not found");
            }
          } else {
            const container = document.getElementById(
              "enhanced-singleDateContainer"
            );
            if (container) {
              container.style.display = "block";
            } else {
              console.error("Single date container not found");
            }
          }
          break;

        case "phone":
          const phoneContainer = document.getElementById(
            "enhanced-phoneValueContainer"
          );
          if (phoneContainer) {
            phoneContainer.style.display = "block";
          } else {
            console.error("Phone container not found");
          }
          break;

        default: // text, email, textarea
          const textContainer = document.getElementById(
            "enhanced-textValueContainer"
          );
          if (textContainer) {
            textContainer.style.display = "block";
          } else {
            console.error("Text container not found");
          }
      }
    } catch (error) {
      console.error("Error toggling value containers:", error);
    }
  }

  // Add the current filter to active filters
  addCurrentFilterToActiveFilters() {
    if (!this.currentField) {
      console.error("No field selected");
      return;
    }

    // Get the operator
    const operatorSelect = document.getElementById("enhanced-filterOperator");
    if (!operatorSelect) {
      console.error("Operator select not found");
      return;
    }

    const operator = operatorSelect.value;

    // Skip value collection for empty/not empty operators
    let values = [];
    if (!["is_empty", "is_not_empty"].includes(operator)) {
      // Get values based on field type
      values = this.collectFilterValues();

      // Validate values
      if (!this.validateFilterValues(values)) {
        console.error("Filter validation failed");
        return;
      }
    }

    // Check if this filter already exists
    const isDuplicate = this.activeFilters.some((existingFilter) => {
      // Compare field, operator, and values
      const sameField =
        existingFilter.field.id.toString() === this.currentField.id.toString();
      const sameOperator = existingFilter.operator === operator;

      // Compare values - handle arrays or single values
      let sameValues = false;

      // For is_empty and is_not_empty, just check the operator and field
      if (["is_empty", "is_not_empty"].includes(operator)) {
        sameValues = true;
      } else if (
        Array.isArray(existingFilter.values) &&
        Array.isArray(values)
      ) {
        // Compare arrays - must be same length and same elements
        if (existingFilter.values.length === values.length) {
          // Convert to strings for comparison to handle different data types
          const existingValueStrings = existingFilter.values.map((v) =>
            String(v)
          );
          const newValueStrings = values.map((v) => String(v));
          sameValues = existingValueStrings.every((v) =>
            newValueStrings.includes(v)
          );
        }
      } else {
        // Handle the case where one or both might not be arrays
        sameValues = String(existingFilter.values) === String(values);
      }

      return sameField && sameOperator && sameValues;
    });

    if (isDuplicate) {
      alert("This filter is already applied");
      return;
    }

    // Create filter object
    const filter = {
      id: Date.now(), // Unique ID for the filter
      field: this.currentField,
      operator: operator,
      values: values,
      displayText: this.generateFilterDisplayText(
        this.currentField,
        operator,
        values
      ),
    };

    // Add to active filters
    this.activeFilters.push(filter);

    // Log the sequential nature of the filters
    if (this.activeFilters.length > 1) {
      // Show a brief tooltip or message to the user explaining the sequential filtering
      this.showSequentialFilteringMessage();
    }

    // Render active filter tags
    this.renderActiveFilterTags();

    // Clear current filter
    this.clearCurrentFilter();

    // Apply filters to the report
    this.applyFiltersToReport();
  }

  // Show a message to explain sequential filtering to the user
  showSequentialFilteringMessage() {
    // Check if we have a tooltip container, create one if not
    let tooltipContainer = document.getElementById("filter-sequential-tooltip");
    if (!tooltipContainer) {
      tooltipContainer = document.createElement("div");
      tooltipContainer.id = "filter-sequential-tooltip";
      tooltipContainer.className =
        "alert alert-info alert-dismissible fade show mt-2";
      tooltipContainer.setAttribute("role", "alert");
      tooltipContainer.innerHTML = `
        <strong>Sequential Filtering Applied</strong>
        <p>Each filter narrows down results from previous filters. Results now match all selected criteria.</p>
      `;

      // Find a good place to insert the tooltip
      const insertPoint = document.getElementById("activeFilterTags");
      if (insertPoint && insertPoint.parentNode) {
        insertPoint.parentNode.insertBefore(
          tooltipContainer,
          insertPoint.nextSibling
        );

        // Automatically remove after 10 seconds
        setTimeout(() => {
          tooltipContainer.classList.remove("show");
          setTimeout(() => tooltipContainer.remove(), 500);
        }, 10000);
      }
    }
  }

  // Collect filter values based on current field type and operator
  collectFilterValues() {
    const fieldType = this.currentField.field_type;
    const operator = document.getElementById("enhanced-filterOperator").value;

    let values = [];

    try {
      switch (fieldType) {
        case "select":
        case "radio":
        case "checkbox":
          if (["in", "not_in"].includes(operator)) {
            // For multi-select, get checked checkboxes
            const checkboxes = document.querySelectorAll(
              ".enhanced-filter-value-checkbox:checked"
            );
            if (checkboxes.length > 0) {
              values = Array.from(checkboxes).map((cb) => cb.value);
            }
          } else {
            // For single select
            if (fieldType === "radio") {
              // Get selected radio button
              const selectedRadio = document.querySelector(
                ".enhanced-filter-value-radio:checked"
              );
              if (selectedRadio) {
                values = [selectedRadio.value];
              } else {
                console.warn("No radio button selected");
                // Try alternative approach for radio buttons
                const radioGroup = document.querySelectorAll(
                  ".enhanced-filter-value-radio"
                );

                // Check if any is selected
                const selected = Array.from(radioGroup).find(
                  (radio) => radio.checked
                );
                if (selected) {
                  values = [selected.value];
                }
              }
            } else {
              // For regular select dropdowns
              const singleSelect = document.getElementById(
                "enhanced-filterValueSelect"
              );
              if (singleSelect) {
                values = [singleSelect.value];
              } else {
                console.error("Single select element not found");
              }
            }
          }
          break;

        case "number":
          if (operator === "between") {
            const minValue = document.getElementById("enhanced-numberMinValue");
            const maxValue = document.getElementById("enhanced-numberMaxValue");
            if (minValue && maxValue) {
              values = [minValue.value, maxValue.value];
            } else {
              console.error("Number range elements not found");
            }
          } else {
            const numberValue = document.getElementById("enhanced-numberValue");
            if (numberValue) {
              values = [numberValue.value];
            } else {
              console.error("Number element not found");
            }
          }
          break;

        case "date":
          if (operator === "between") {
            const startDate = document.getElementById(
              "enhanced-dateStartValue"
            );
            const endDate = document.getElementById("enhanced-dateEndValue");
            if (startDate && endDate) {
              values = [startDate.value, endDate.value];
            } else {
              console.error("Date range elements not found");
            }
          } else {
            const dateValue = document.getElementById("enhanced-dateValue");
            if (dateValue) {
              values = [dateValue.value];
            } else {
              console.error("Date element not found");
            }
          }
          break;

        case "phone":
          const phoneValue = document.getElementById("enhanced-phoneValue");
          if (phoneValue) {
            values = [phoneValue.value];
          } else {
            console.error("Phone element not found");
          }
          break;

        case "text":
        case "alphanumeric":
        case "email":
        case "textarea":
        default:
          const textValue = document.getElementById("enhanced-textValue");
          if (textValue) {
            values = [textValue.value];
          } else {
            console.error("Text element not found");
          }
      }
    } catch (error) {
      console.error("Error collecting filter values:", error);
    }

    return values;
  }

  // Render active filter tags
  renderActiveFilterTags() {
    // Use the class property if it exists, otherwise try to find the element directly
    const activeFiltersContainer =
      this.activeFiltersContainer ||
      document.getElementById("activeFilterTags");

    if (!activeFiltersContainer) {
      console.error("Active filters container not found");
      return;
    }

    // Find the filter count badge
    const filterCountBadge = document.querySelector(".filter-count");

    // Clear existing tags
    activeFiltersContainer.innerHTML = "";

    // If no active filters, show message
    if (this.activeFilters.length === 0) {
      activeFiltersContainer.innerHTML =
        "<div class='no-filters-message'>No filters applied</div>";

      // Update filter count badge if it exists
      if (filterCountBadge) {
        filterCountBadge.textContent = "0";
        filterCountBadge.style.display = "none";
      }

      return;
    }

    // Update filter count badge if it exists
    if (filterCountBadge) {
      filterCountBadge.textContent = this.activeFilters.length.toString();
      filterCountBadge.style.display = "inline-block";
    }

    // Add a sequence indicator container first
    const sequenceContainer = document.createElement("div");
    sequenceContainer.className = "filter-sequence";
    sequenceContainer.style.marginBottom = "12px";

    if (this.activeFilters.length > 1) {
      sequenceContainer.innerHTML = `
        <div class="filter-sequence-description">
          <small class="text-muted">
            <i class="bi bi-info-circle"></i> 
            Filters are applied sequentially. Each filter narrows down results further.
          </small>
        </div>
      `;
      activeFiltersContainer.appendChild(sequenceContainer);
    }

    // Create tags for each filter with sequential indication
    const filterTagsContainer = document.createElement("div");
    filterTagsContainer.className = "filter-tags-container";
    activeFiltersContainer.appendChild(filterTagsContainer);

    this.activeFilters.forEach((filter, index) => {
      // Create a container for each filter tag group
      const tagGroupElement = document.createElement("div");
      tagGroupElement.className =
        "filter-tag-group d-inline-flex align-items-center";

      // Create the actual tag
      const tagElement = document.createElement("div");
      tagElement.className = "filter-tag";
      tagElement.setAttribute("data-filter-id", filter.id);

      // Add a sequence number if there are multiple filters
      if (this.activeFilters.length > 1) {
        tagElement.className += " has-sequence";

        // Create sequence number element
        const seqNumElement = document.createElement("span");
        seqNumElement.className = "filter-sequence-number";
        seqNumElement.textContent = index + 1;
        tagElement.appendChild(seqNumElement);

        // Create filter text container
        const filterTextElement = document.createElement("span");
        filterTextElement.className = "filter-text";

        // Parse the display text to apply styling
        const displayTextParts = this.parseDisplayText(filter.displayText);
        filterTextElement.innerHTML = displayTextParts;
        tagElement.appendChild(filterTextElement);

        // Create remove button
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "filter-remove-btn";
        removeBtn.setAttribute("data-filter-id", filter.id);
        removeBtn.innerHTML = `<i class="bi bi-x"></i>`;
        tagElement.appendChild(removeBtn);
      } else {
        // Create filter text container
        const filterTextElement = document.createElement("span");
        filterTextElement.className = "filter-text";

        // Parse the display text to apply styling
        const displayTextParts = this.parseDisplayText(filter.displayText);
        filterTextElement.innerHTML = displayTextParts;
        tagElement.appendChild(filterTextElement);

        // Create remove button
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "filter-remove-btn";
        removeBtn.setAttribute("data-filter-id", filter.id);
        removeBtn.innerHTML = `<i class="bi bi-x"></i>`;
        tagElement.appendChild(removeBtn);
      }

      tagGroupElement.appendChild(tagElement);

      // Add an arrow if this is not the last filter
      if (index < this.activeFilters.length - 1) {
        const arrowElement = document.createElement("div");
        arrowElement.className = "filter-arrow";
        arrowElement.innerHTML = `<i class="bi bi-arrow-right"></i>`;
        tagGroupElement.appendChild(arrowElement);
      }

      filterTagsContainer.appendChild(tagGroupElement);

      // Add event listener to remove button
      const removeBtn = tagElement.querySelector(".filter-remove-btn");
      removeBtn.addEventListener("click", () => {
        this.removeFilter(filter.id);
      });
    });
  }

  // Helper method to parse display text into styled HTML
  parseDisplayText(displayText) {
    // Handle case where displayText is already in the right format
    if (displayText.includes('<span class="filter-tag-name">')) {
      return displayText;
    }

    // Extract parts of the filter display text
    const parts = displayText.split(" ");
    if (parts.length >= 3) {
      // Assume format: "Field Operator Value"
      const fieldName = parts[0];
      const operator = parts[1];
      const value = parts.slice(2).join(" ");

      return `<span class="filter-tag-name">${fieldName}</span> <span class="filter-tag-operator">${operator}</span> <span class="filter-tag-value">${value}</span>`;
    }

    // Fallback to original text
    return displayText;
  }

  // Remove a filter by ID
  removeFilter(filterId) {
    // Find the index of the filter
    const index = this.activeFilters.findIndex((f) => f.id === filterId);

    if (index !== -1) {
      // Get the filter to be removed for logging
      const removedFilter = this.activeFilters[index];

      // Remove the filter
      this.activeFilters.splice(index, 1);

      // Log the new filter sequence if any filters remain
      if (this.activeFilters.length > 0) {
        this.activeFilters.forEach((filter, idx) => {});
      } else {
      }

      // Render tags again
      this.renderActiveFilterTags();

      // Apply filters to the report
      this.applyFiltersToReport();

      // Show a message about filter removal
      this.showFilterRemovalMessage(removedFilter, index);
    } else {
      console.error("Filter not found:", filterId);
    }
  }

  // Show a message about filter removal
  showFilterRemovalMessage(removedFilter, index) {
    // Create a toast notification
    const toastContainer =
      document.getElementById("filter-toast-container") ||
      (() => {
        const container = document.createElement("div");
        container.id = "filter-toast-container";
        container.className = "position-fixed bottom-0 end-0 p-3";
        container.style.zIndex = "11000"; // Increased to match other toasts
        document.body.appendChild(container);
        return container;
      })();

    const toastId = `filter-toast-${Date.now()}`;
    const toast = document.createElement("div");
    toast.id = toastId;
    toast.className = "toast";
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "assertive");
    toast.setAttribute("aria-atomic", "true");

    // Set the border color for this type of toast (info/primary)
    toast.style.borderLeftColor = "#0d6efd";

    // Create toast content
    toast.innerHTML = `
      <div class="toast-header">
        <i class="bi bi-funnel-fill text-primary me-2"></i>
        <strong class="me-auto">Filter Removed</strong>
        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body">
        <p class="mb-1"><strong>${
          removedFilter.displayText
        }</strong> has been removed.</p>
        ${
          this.activeFilters.length > 0
            ? `<p class="mb-0 text-muted">Results are now filtered by ${
                this.activeFilters.length
              } remaining ${
                this.activeFilters.length === 1 ? "filter" : "filters"
              }.</p>`
            : `<p class="mb-0 text-muted">No filters remain. Showing all results.</p>`
        }
      </div>
    `;

    toastContainer.appendChild(toast);

    // Initialize and show the toast using Bootstrap
    try {
      const bsToast = new bootstrap.Toast(toast, {
        delay: 4000, // Show for 4 seconds
      });
      bsToast.show();

      // Remove toast after it's hidden
      toast.addEventListener("hidden.bs.toast", () => {
        toast.remove();
      });
    } catch (error) {
      console.warn("Bootstrap Toast initialization failed:", error);
      // Fallback - remove toast after 5 seconds
      setTimeout(() => toast.remove(), 4000);
    }
  }

  // Clear all active filters
  clearAllFilters() {
    // Clear the active filters array
    this.activeFilters = [];

    // Update UI
    this.renderActiveFilterTags();

    // Apply filters to the report (this will reset to no filters)
    this.applyFiltersToReport();
  }

  // Apply filters to the report
  applyFiltersToReport() {
    if (this.activeFilters.length === 0) {
      // If we have ReportsManager, clear its filters
      if (window.ReportsManager) {
        window.ReportsManager.setFilters([]);
        window.ReportsManager.generateReport();
      }
      return;
    }

    // Convert our filters to the format expected by ReportsManager
    // Ensure each filter has the correct field naming convention
    const formattedFilters = this.activeFilters.map((filter) => {
      // Create the base filter with camelCase fieldId (not field_id) to match server expectation
      const formattedFilter = {
        fieldId: filter.field.id, // Use fieldId instead of field_id to match server expectation
        operator: filter.operator,
      };

      // Add values array for all filter types
      if (filter.values && filter.values.length > 0) {
        // Always include values array for consistency
        formattedFilter.values = filter.values;

        // For between operator, join the values with comma as the server expects a comma-separated string
        if (filter.operator === "between" && filter.values.length === 2) {
          formattedFilter.value = filter.values.join(",");
        }
        // For single value operators, also add a 'value' property for backward compatibility
        else if (
          filter.values.length === 1 &&
          !["in", "not_in"].includes(filter.operator)
        ) {
          formattedFilter.value = filter.values[0];
        }
        // For in/not_in operators, join values with comma
        else if (["in", "not_in"].includes(filter.operator)) {
          formattedFilter.value = filter.values.join(",");
        }
      }

      return formattedFilter;
    });

    // Apply to ReportsManager if available
    if (window.ReportsManager) {
      // Ensure the ReportsManager uses these filters additively
      if (typeof window.ReportsManager.setFilters === "function") {
        // Use the setFilters method which should handle all filters at once
        window.ReportsManager.setFilters(formattedFilters);
      } else {
        console.error("ReportsManager.setFilters is not a function");
        // Fallback: Set the activeFilters directly
        window.ReportsManager.activeFilters = formattedFilters;

        // Try to render if the method exists
        if (typeof window.ReportsManager.renderActiveFilters === "function") {
          window.ReportsManager.renderActiveFilters();
        }
      }

      // Now generate the report with the combined filters
      if (typeof window.ReportsManager.generateReport === "function") {
        // Ensure we don't trigger infinite loops
        if (!window.ReportsManager.isApplyingFilter) {
          window.ReportsManager.isApplyingFilter = true;
          try {
            window.ReportsManager.generateReport();
          } finally {
            // Always reset the flag
            window.ReportsManager.isApplyingFilter = false;
          }
        } else {
        }
      } else {
        console.error("ReportsManager.generateReport is not a function");
      }
    } else {
      console.error("Global ReportsManager not available");
    }
  }

  // Reset filter form
  resetFilterForm() {
    this.filterFieldSelect.value = "";
    this.dynamicFilterControls.innerHTML = "";
    this.dynamicFilterControls.style.display = "none";
    this.filterActionButtons.style.display = "none";
    this.currentField = null;
    this.currentOperator = null;
    this.currentValues = null;
  }

  // Render operators select based on field type
  renderOperators(fieldType) {
    // Define operators for each field type
    let operators = [];

    switch (fieldType) {
      case "select":
      case "radio":
      case "checkbox":
        operators = [
          { value: "equals", label: "Equals" },
          { value: "not_equals", label: "Not Equals" },
          { value: "in", label: "In (Multiple)" },
          { value: "not_in", label: "Not In (Multiple)" },
          { value: "is_empty", label: "Is Empty" },
          { value: "is_not_empty", label: "Is Not Empty" },
        ];
        break;

      case "text":
      case "alphanumeric":
      case "email":
      case "textarea":
        operators = [
          { value: "equals", label: "Equals" },
          { value: "not_equals", label: "Not Equals" },
          { value: "contains", label: "Contains" },
          { value: "not_contains", label: "Does Not Contain" },
          { value: "starts_with", label: "Starts With" },
          { value: "ends_with", label: "Ends With" },
          { value: "is_empty", label: "Is Empty" },
          { value: "is_not_empty", label: "Is Not Empty" },
        ];
        break;

      case "number":
        operators = [
          { value: "equals", label: "Equals" },
          { value: "not_equals", label: "Not Equals" },
          { value: "greater_than", label: "Greater Than" },
          { value: "less_than", label: "Less Than" },
          { value: "between", label: "Between" },
          { value: "is_empty", label: "Is Empty" },
          { value: "is_not_empty", label: "Is Not Empty" },
        ];
        break;

      case "date":
        operators = [
          { value: "equals", label: "Equals" },
          { value: "not_equals", label: "Not Equals" },
          { value: "greater_than", label: "After" },
          { value: "less_than", label: "Before" },
          { value: "between", label: "Between" },
          { value: "is_empty", label: "Is Empty" },
          { value: "is_not_empty", label: "Is Not Empty" },
        ];
        break;

      case "phone":
        operators = [
          { value: "equals", label: "Equals" },
          { value: "not_equals", label: "Not Equals" },
          { value: "contains", label: "Contains" },
          { value: "starts_with", label: "Starts With" },
          { value: "is_empty", label: "Is Empty" },
          { value: "is_not_empty", label: "Is Not Empty" },
        ];
        break;

      case "nested-select":
        operators = [
          { value: "equals", label: "Equals" },
          { value: "not_equals", label: "Not Equals" },
          { value: "is_empty", label: "Is Empty" },
          { value: "is_not_empty", label: "Is Not Empty" },
        ];
        break;

      default:
        operators = [
          { value: "equals", label: "Equals" },
          { value: "not_equals", label: "Not Equals" },
          { value: "is_empty", label: "Is Empty" },
          { value: "is_not_empty", label: "Is Not Empty" },
        ];
    }

    // Generate HTML
    let html = `
      <div class="form-group">
        <label for="enhanced-filterOperator">Operator</label>
        <select id="enhanced-filterOperator" class="form-control">
    `;

    // Add options
    operators.forEach((op) => {
      html += `<option value="${op.value}">${op.label}</option>`;
    });

    html += `
        </select>
      </div>
    `;

    return html;
  }

  // Create nested select controls html
  createNestedSelectControls() {
    return `
      <div class='alert alert-info'>Nested select fields are managed through hierarchical filters above the report.</div>
      <div id="enhanced-nestedSelectContainer" class="filter-value-container"></div>
    `;
  }

  // Validate filter values
  validateFilterValues(values) {
    if (!this.currentField) {
      console.error("No current field");
      return false;
    }

    const operator = document.getElementById("enhanced-filterOperator").value;
    const fieldType = this.currentField.field_type;

    // Skip validation for empty/not empty operators
    if (["is_empty", "is_not_empty"].includes(operator)) {
      return true;
    }

    // Check if values is empty
    if (!values || values.length === 0) {
      alert("Please provide a filter value");
      return false;
    }

    // Check if any value is empty string
    if (values.some((val) => val === "")) {
      alert("Please provide a value for the filter");
      return false;
    }

    // For between operators, ensure we have two values
    if (operator === "between" && values.length !== 2) {
      alert("Please provide both values for the range");
      return false;
    }

    // For number fields, ensure values are numbers
    if (fieldType === "number") {
      if (values.some((val) => isNaN(Number(val)))) {
        alert("Please enter valid numbers");
        return false;
      }

      // For between operator, ensure min <= max
      if (operator === "between") {
        if (Number(values[0]) > Number(values[1])) {
          alert("Minimum value cannot be greater than maximum value");
          return false;
        }
      }
    }

    // For date fields, ensure values are valid dates
    if (fieldType === "date") {
      if (values.some((val) => isNaN(new Date(val).getTime()))) {
        alert("Please enter valid dates");
        return false;
      }

      // For between operator, ensure start <= end
      if (operator === "between") {
        if (new Date(values[0]) > new Date(values[1])) {
          alert("Start date cannot be after end date");
          return false;
        }
      }
    }

    return true;
  }

  // Generate display text for a filter
  generateFilterDisplayText(field, operator, values) {
    // Handle undefined field
    if (!field) {
      console.error("Field is undefined in generateFilterDisplayText");
      return "Unknown field";
    }

    // Get the field label, with fallbacks
    const fieldLabel =
      field.label ||
      field.display_name ||
      field.name ||
      field.id ||
      "Unknown field";

    let operatorText = "";

    switch (operator) {
      case "equals":
        operatorText = "=";
        break;
      case "not_equals":
        operatorText = "≠";
        break;
      case "contains":
        operatorText = "contains";
        break;
      case "not_contains":
        operatorText = "does not contain";
        break;
      case "starts_with":
        operatorText = "starts with";
        break;
      case "ends_with":
        operatorText = "ends with";
        break;
      case "greater_than":
        operatorText = ">";
        break;
      case "less_than":
        operatorText = "<";
        break;
      case "between":
        operatorText = "between";
        break;
      case "in":
        operatorText = "in";
        break;
      case "not_in":
        operatorText = "not in";
        break;
      case "is_empty":
        operatorText = "is empty";
        break;
      case "is_not_empty":
        operatorText = "is not empty";
        break;
      default:
        operatorText = operator;
    }

    let valuesText = "";

    if (!["is_empty", "is_not_empty"].includes(operator)) {
      if (operator === "between") {
        valuesText = `${values[0]} and ${values[1]}`;
      } else if (["in", "not_in"].includes(operator)) {
        valuesText = values.join(", ");
      } else {
        valuesText = values[0];
      }
    }

    // For empty operators, just return the field and operator
    if (["is_empty", "is_not_empty"].includes(operator)) {
      return `${fieldLabel} ${operatorText}`;
    }

    return `${fieldLabel} ${operatorText} ${valuesText}`;
  }

  // Set up filter action buttons
  setupFilterActionButtons() {
    // Get the filter action buttons container
    const actionButtons = document.getElementById(
      "enhanced-filterActionButtons"
    );
    if (!actionButtons) {
      console.error("Filter action buttons container not found");
      return;
    }

    // Display the action buttons
    actionButtons.style.display = "flex";
    actionButtons.style.visibility = "visible";
    actionButtons.style.opacity = "1";

    // Event listeners are already added in the initEventListeners method,
    // so we don't need to add them here again
  }

  // Initialize the toggle functionality
  initToggle() {
    if (!this.filterPanel) {
      console.error("Filter panel not found");
      return;
    }

    // Find the toggle button
    const toggleBtn = this.filterPanel.querySelector(".filter-collapse-btn");
    // Find the panel header
    const panelHeader = this.filterPanel.querySelector(".filter-panel-header");

    if (toggleBtn) {
      // Make sure the icon is set to chevron-down initially
      const toggleIcon = toggleBtn.querySelector("i");
      if (toggleIcon) {
        toggleIcon.className = "bi bi-chevron-down";
      }

      // Remove any existing event listeners first (to prevent duplicates)
      const newToggleBtn = toggleBtn.cloneNode(true);
      toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);

      // Add click event listener to the new button
      newToggleBtn.addEventListener("click", (event) => {
        event.preventDefault(); // Prevent default action
        this.toggleFilterPanel();
      });

      // Make the entire panel header clickable
      if (panelHeader) {
        // Add pointer cursor to show it's clickable
        panelHeader.style.cursor = "pointer";

        // Add click event to the entire header
        panelHeader.addEventListener("click", (event) => {
          // Don't trigger if clicked on any of the action buttons
          // (clearAllFiltersBtn, saveCurrentFiltersBtn, or the collapse button itself)
          if (!event.target.closest(".filter-action-buttons")) {
            event.preventDefault();
            this.toggleFilterPanel();
          }
        });
      }
    } else {
      console.warn("Filter panel toggle button not found");
    }
  }

  // Toggle filter panel visibility
  toggleFilterPanel() {
    // Find the content and toggle button elements directly
    const content = document.getElementById("filterPanelContent");
    const toggleIcon = this.filterPanel.querySelector(".filter-collapse-btn i");

    if (!content) {
      console.error("Filter panel content element not found");
      return;
    }

    // Check current state
    const isVisible = content.classList.contains("show");

    try {
      // Try using Bootstrap's Collapse API directly
      if (typeof bootstrap !== "undefined" && bootstrap.Collapse) {
        const bsCollapse = bootstrap.Collapse.getInstance(content);

        if (bsCollapse) {
          // Toggle existing instance
          bsCollapse.toggle();
        } else {
          // Create new instance and toggle
          const newCollapse = new bootstrap.Collapse(content, {
            toggle: true,
          });
        }

        // Update icon manually since we're managing the collapse
        if (toggleIcon) {
          // Toggle icon based on new state (opposite of current state)
          if (isVisible) {
            toggleIcon.className = "bi bi-chevron-down";
          } else {
            toggleIcon.className = "bi bi-chevron-up";
          }
        }
      } else {
        // Fallback to manual toggle
        this.manualToggleContent(content, toggleIcon);
      }
    } catch (error) {
      console.error("Error toggling filter panel:", error);
      // Fallback to manual toggle
      this.manualToggleContent(content, toggleIcon);
    }
  }

  // Manual content toggling as fallback
  manualToggleContent(content, toggleIcon) {
    // Check current state
    const isVisible = content.classList.contains("show");

    if (isVisible) {
      content.classList.remove("show");
      content.style.display = "none";

      // Also update the toggle button icon if provided
      if (toggleIcon) {
        toggleIcon.className = "bi bi-chevron-down";
      }
    } else {
      content.classList.add("show");
      content.style.display = "block";

      // Also update the toggle button icon if provided
      if (toggleIcon) {
        toggleIcon.className = "bi bi-chevron-up";
      }
    }
  }

  // Clear the current filter
  clearCurrentFilter() {
    // Reset field select if it exists
    if (this.filterFieldSelect) {
      this.filterFieldSelect.selectedIndex = 0;
    }

    // Clear dynamic controls if it exists
    if (this.dynamicFilterControls) {
      this.dynamicFilterControls.innerHTML = "";
      this.dynamicFilterControls.style.display = "none";
    }

    // Hide action buttons if they exist
    if (this.filterActionButtons) {
      this.filterActionButtons.style.display = "none";
    }

    // Reset current field
    this.currentField = null;
    this.currentOperator = null;
  }

  // Parse field options string to array of {value, label} objects
  parseFieldOptions(optionsStr) {
    if (!optionsStr) {
      console.warn("No options provided to parse");
      return [];
    }

    try {
      // Check if it's already a JSON object
      if (typeof optionsStr === "object") {
        // Handle radio buttons specific format which may include conditionalLogic
        if (optionsStr.options && Array.isArray(optionsStr.options)) {
          return optionsStr.options.map((opt) => ({ value: opt, label: opt }));
        }

        // Handle simple array
        if (Array.isArray(optionsStr)) {
          return optionsStr.map((opt) => {
            if (typeof opt === "object") {
              return {
                value: opt.value || opt.label,
                label: opt.label || opt.value,
              };
            }
            return { value: opt, label: opt };
          });
        }

        // Handle simple object with keys and values
        return Object.entries(optionsStr)
          .filter(([key]) => key !== "conditionalLogic") // Exclude conditionalLogic
          .map(([key, value]) => {
            if (key === "options" && Array.isArray(value)) {
              // Return the options array transformed to objects
              return value.map((opt) => ({ value: opt, label: opt }));
            }
            return { value: key, label: key };
          })
          .flat(); // Flatten nested arrays
      }

      // Try parsing as JSON
      try {
        const parsed = JSON.parse(optionsStr);

        // Handle radio buttons with conditionalLogic format
        if (
          typeof parsed === "object" &&
          parsed.options &&
          Array.isArray(parsed.options)
        ) {
          return parsed.options.map((opt) => ({ value: opt, label: opt }));
        }

        if (Array.isArray(parsed)) {
          return parsed.map((opt) => {
            if (typeof opt === "object") {
              return {
                value: opt.value || opt.label,
                label: opt.label || opt.value,
              };
            }
            return { value: opt, label: opt };
          });
        }
      } catch (e) {
        // Not valid JSON, continue to other formats
      }

      // Try parsing as newline-separated list
      if (optionsStr.includes("\n")) {
        return optionsStr
          .split("\n")
          .map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return null;

            // Check if it's in "value:label" format
            if (trimmed.includes(":")) {
              const [value, label] = trimmed.split(":");
              return { value: value.trim(), label: label.trim() };
            }

            return { value: trimmed, label: trimmed };
          })
          .filter(Boolean);
      }

      // Try parsing as comma-separated list
      return optionsStr
        .split(",")
        .map((item) => {
          const trimmed = item.trim();
          if (!trimmed) return null;
          return { value: trimmed, label: trimmed };
        })
        .filter(Boolean);
    } catch (error) {
      console.error("Error parsing field options:", error);
      return [];
    }
  }

  // Set fields data from external source (like ReportsManager)
  setFields(fields) {
    if (fields && Array.isArray(fields)) {
      this.allFields = fields;
      this.populateFieldSelect();
    }
  }

  // Set filters from an external source
  setFilters(filters) {
    if (filters && Array.isArray(filters)) {
      // Convert the external filters to our format
      this.activeFilters = filters
        .map((filter) => {
          // Find the field object from allFields
          const field = this.allFields.find(
            (f) => String(f.id) === String(filter.field_id)
          );
          if (!field) {
            console.error(`Field with ID ${filter.field_id} not found`);
            return null;
          }

          return {
            id: Date.now() + Math.random(), // Generate a unique ID
            field: field,
            operator: filter.operator,
            values: filter.values,
            displayText: this.generateFilterDisplayText(
              field,
              filter.operator,
              filter.values
            ),
          };
        })
        .filter(Boolean); // Remove null entries

      // Update UI
      this.renderActiveFilterTags();
    }
  }

  // Sync filters with ReportsManager
  syncFilters(filters) {
    if (!filters || !Array.isArray(filters)) {
      console.warn("No valid filters to sync");
      return;
    }

    // Convert ReportsManager filters to EnhancedFilterSystem format
    const formattedFilters = filters.map((filter) => {
      // Handle different filter formats - ReportsManager uses fieldId, we use field_id internally
      const fieldIdentifier = filter.fieldId || filter.field_id;

      // Handle the values array - could be in values or value property
      let filterValues = [];
      if (filter.values && Array.isArray(filter.values)) {
        // Use values array if available
        filterValues = filter.values;
      } else if (filter.value !== undefined) {
        // Handle single value
        if (
          typeof filter.value === "string" &&
          ["between", "in", "not_in"].includes(filter.operator)
        ) {
          // If it's a comma-separated string for between/in/not_in operators, split it
          filterValues = filter.value.split(",").map((v) => v.trim());
        } else {
          // Otherwise use as a single-item array
          filterValues = [filter.value];
        }
      }

      return {
        field_id: fieldIdentifier, // Keep as field_id for internal use
        operator: filter.operator,
        values: filterValues,
      };
    });

    // Set the formatted filters
    this.setFilters(formattedFilters);
  }

  // Save current filters to database
  async saveFilters() {
    // Check if we have active filters
    if (this.activeFilters.length === 0) {
      alert("No active filters to save");
      return;
    }

    // Prompt for filter name
    const filterNameInput = document.getElementById("filterName");
    if (!filterNameInput) {
      console.error("Filter name input not found");
      return;
    }

    const filterName = filterNameInput.value.trim();
    if (!filterName) {
      alert("Please enter a name for this filter set");
      return;
    }

    try {
      // Get user ID from AuthManager
      const userInfo = AuthManager.getUserInfo();
      if (!userInfo || !userInfo.id) {
        alert("User information not available. Please log in again.");
        return;
      }

      // Prepare the data
      const formattedFilters = this.activeFilters.map((filter) => ({
        fieldId: filter.field.id,
        fieldName: filter.field.display_name,
        operator: filter.operator,
        values: filter.values,
        displayText: filter.displayText,
      }));

      // Keep a copy of the data we're sending to the server
      const filterData = {
        name: filterName,
        filters: formattedFilters,
        userId: userInfo.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Send the data to the server
      const response = await fetch("/api/reports/filters/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AuthManager.getToken()}`,
        },
        body: JSON.stringify(filterData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save filters");
      }

      const result = await response.json();

      // Store the filter in localStorage as a backup
      try {
        // First get any existing saved filters
        let localSavedFilters = [];
        const storedFilters = localStorage.getItem("savedFilters");
        if (storedFilters) {
          localSavedFilters = JSON.parse(storedFilters);
        }

        // Update the filter data with the ID returned from the server
        filterData.id = result.id;

        // Check if this filter already exists locally
        const existingIndex = localSavedFilters.findIndex(
          (f) => f.id === result.id
        );
        if (existingIndex >= 0) {
          // Update existing filter
          localSavedFilters[existingIndex] = filterData;
        } else {
          // Add new filter
          localSavedFilters.push(filterData);
        }

        // Save back to localStorage
        localStorage.setItem("savedFilters", JSON.stringify(localSavedFilters));
      } catch (localStorageError) {
        console.warn(
          "Could not save filter backup to localStorage:",
          localStorageError
        );
      }

      // Reset filter name input
      filterNameInput.value = "";

      // Close the modal
      const saveFilterModal = bootstrap.Modal.getInstance(
        document.getElementById("saveFilterModal")
      );
      if (saveFilterModal) {
        saveFilterModal.hide();
      }

      // Show success message
      this.showSavedFilterToast("Filters saved successfully");

      // Reload saved filters
      await this.loadSavedFilters();
    } catch (error) {
      alert(`Failed to save filters: ${error.message}`);
    }
  }

  // Show toast message for saved filters with improved formatting
  showSavedFilterToast(message, type = "success") {
    // Create a toast container if it doesn't exist
    let toastContainer = document.getElementById(
      "saved-filter-toast-container"
    );
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.id = "saved-filter-toast-container";
      toastContainer.className = "position-fixed bottom-0 end-0 p-3";
      toastContainer.style.zIndex = "11000";
      document.body.appendChild(toastContainer);
    }

    // Create the toast
    const toastId = `toast-${Date.now()}`;
    const toast = document.createElement("div");
    toast.id = toastId;
    toast.className = `toast`;
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "assertive");
    toast.setAttribute("aria-atomic", "true");

    // Get the total number of active filters
    const totalFilters = this.activeFilters.length;

    // Select icon based on message type
    let iconClass = "";
    let borderColor = "";

    switch (type) {
      case "success":
        iconClass = "bi-check-circle-fill text-success";
        borderColor = "#198754"; // Green
        break;
      case "danger":
        iconClass = "bi-exclamation-circle-fill text-danger";
        borderColor = "#dc3545"; // Red
        break;
      case "warning":
        iconClass = "bi-exclamation-triangle-fill text-warning";
        borderColor = "#ffc107"; // Yellow
        break;
      case "info":
      default:
        type = "info"; // Ensure default type is set
        iconClass = "bi-info-circle-fill text-info";
        borderColor = "#0dcaf0"; // Blue
        break;
    }

    // Set border-left color
    toast.style.borderLeftColor = borderColor;

    // Show different message based on the type
    if (
      message.includes("added to existing") ||
      message.includes("loaded successfully")
    ) {
      // This is a filter load operation - make it clearer this is cumulative
      toast.innerHTML = `
        <div class="toast-header">
          <i class="${iconClass} me-2"></i>
          <strong class="me-auto">Filter Added</strong>
          <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
          ${message}
          <div class="mt-2 pt-2 border-top">
            <div class="d-flex justify-content-between align-items-center">
              <strong>Total Active Filters: ${totalFilters}</strong>
              <button type="button" class="btn btn-sm btn-outline-primary" id="${toastId}-clear">
                Clear All
              </button>
            </div>
          </div>
        </div>
      `;
    } else {
      // Regular message
      toast.innerHTML = `
        <div class="toast-header">
          <i class="${iconClass} me-2"></i>
          <strong class="me-auto">Saved Filters</strong>
          <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
          ${message}
        </div>
      `;
    }

    toastContainer.appendChild(toast);

    // Initialize and show the toast
    try {
      const bsToast = new bootstrap.Toast(toast, {
        delay: 5000, // Show for 5 seconds
      });
      bsToast.show();

      // Add event listener to the clear button if it exists
      const clearBtn = document.getElementById(`${toastId}-clear`);
      if (clearBtn) {
        clearBtn.addEventListener("click", () => {
          this.clearAllFilters();
          bsToast.hide();
        });
      }

      // Remove after hiding
      toast.addEventListener("hidden.bs.toast", () => {
        toast.remove();
      });
    } catch (error) {
      console.warn("Error showing toast:", error);
      // Fallback - remove after 5 seconds
      setTimeout(() => toast.remove(), 5000);
    }
  }

  // Load saved filters from database
  async loadSavedFilters() {
    try {
      // Verify user is authenticated before making API call
      if (!AuthManager.isAuthenticated()) {
        console.warn("User not authenticated, cannot load saved filters");
        return [];
      }

      // Get user info directly for better error reporting
      const userInfo = AuthManager.getUserInfo();
      if (!userInfo || !userInfo.id) {
        console.warn("User info missing or incomplete:", userInfo);
        return [];
      }

      // Get the token directly to check if it's valid
      const token = AuthManager.getToken();
      if (!token) {
        console.warn("Authentication token is missing");
        return [];
      }

      // Robust request function with retry logic
      const fetchWithRetry = async (url, options, retries = 2) => {
        let lastError;

        for (let i = 0; i <= retries; i++) {
          try {
            const response = await fetch(url, options);

            // Handle successful response
            if (response.ok) {
              return await response.json();
            }

            // Handle error response
            const errorText = await response.text();
            console.error(`Error response (${response.status}):`, errorText);

            // Try to parse error response
            let errorJson;
            try {
              errorJson = JSON.parse(errorText);
            } catch (e) {
              errorJson = { message: errorText };
            }

            lastError = new Error(
              `Server error: ${errorJson.message || response.statusText}`
            );

            // If it's an authentication error, don't retry
            if (response.status === 401 || response.status === 403) {
              console.warn("Authentication error, not retrying");
              break;
            }

            // Wait before retrying
            if (i < retries) {
              const delay = Math.pow(2, i) * 1000; // Exponential backoff
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          } catch (error) {
            console.error(`Network error (attempt ${i + 1}):`, error);
            lastError = error;

            // Wait before retrying
            if (i < retries) {
              const delay = Math.pow(2, i) * 1000; // Exponential backoff
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          }
        }

        throw lastError;
      };

      // Fetch saved filters with retry logic
      const savedFilters = await fetchWithRetry("/api/reports/filters", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      // Store the filters in a class property for easier access later
      this.savedFilters = savedFilters;

      // Update UI with saved filters
      this.renderSavedFilters(savedFilters);

      // Also update the UI through the ReportsManager if it's available
      if (window.ReportsManager) {
        window.ReportsManager.savedFilters = savedFilters;
      }

      // Return the data for potential use by other methods
      return savedFilters;
    } catch (error) {
      console.error("Failed to load saved filters:", error);

      // Show an error toast
      this.showSavedFilterToast(
        `Error loading saved filters: ${error.message}`,
        "danger"
      );

      // Fall back to localStorage if available
      try {
        const localSavedFilters = localStorage.getItem("savedFilters");
        if (localSavedFilters) {
          const parsedFilters = JSON.parse(localSavedFilters);
          this.renderSavedFilters(parsedFilters);
          return parsedFilters;
        }
      } catch (localStorageError) {
        console.error("Error retrieving from localStorage:", localStorageError);
      }

      // If everything fails, render an empty list with an error message
      this.renderSavedFilters([]);
      return [];
    }
  }

  // Render saved filters in the UI
  renderSavedFilters(savedFilters) {
    // Get the container
    const container = document.getElementById("enhanced-savedFiltersContainer");
    if (!container) {
      console.error("Saved filters container not found");
      return;
    }

    // Clear the container
    container.innerHTML = "";

    // If no saved filters, show empty state
    if (!savedFilters || savedFilters.length === 0) {
      container.innerHTML = `<p class="text-muted mb-0">No saved filters</p>`;
      return;
    }

    // Create and append filter items
    const filtersList = document.createElement("div");
    filtersList.className = "saved-filter-items d-flex flex-wrap";

    savedFilters.forEach((filter) => {
      try {
        // Create saved filter item
        const filterItem = document.createElement("div");
        filterItem.className = "saved-filter-item";
        filterItem.setAttribute("data-filter-id", filter.id);

        // Parse and validate the filters JSON
        let filterConfig;
        try {
          filterConfig =
            typeof filter.filters === "string"
              ? JSON.parse(filter.filters)
              : filter.filters;
        } catch (e) {
          console.error("Error parsing filter JSON:", e);
          filterConfig = { filters: [] };
        }

        // Store filter data for easier access when loading
        filterItem.dataset.filterData = JSON.stringify(filter);

        // Create filter content
        const filterContent = document.createElement("div");
        filterContent.className = "d-flex flex-column";

        // Filter name
        const filterName = document.createElement("span");
        filterName.className = "filter-name";
        filterName.textContent = filter.name;

        // Creator info
        const creatorName = filter.creator_name || "Unknown";
        const creatorInfo = document.createElement("small");
        creatorInfo.className = "text-muted mt-1";
        creatorInfo.innerHTML = `<i class="bi bi-person-circle me-1"></i>Created by: ${creatorName}`;

        // Append to content
        filterContent.appendChild(filterName);
        filterContent.appendChild(creatorInfo);

        // Create action buttons
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "saved-filter-actions ms-3";

        // Only show delete button if current user is the creator
        const currentUserId = AuthManager.getUserInfo()?.id;
        const isCreator = currentUserId && filter.user_id === currentUserId;

        if (isCreator) {
          // Delete button
          const deleteBtn = document.createElement("button");
          deleteBtn.className = "btn btn-sm btn-link text-danger p-0";
          deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
          deleteBtn.title = "Delete filter";
          deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation(); // Prevent item click

            if (
              confirm(
                `Are you sure you want to delete the filter "${filter.name}"?`
              )
            ) {
              this.deleteSavedFilter(filter.id);
            }
          });

          // Add delete button
          actionsDiv.appendChild(deleteBtn);
        }

        // Add click event to load filter
        filterItem.addEventListener("click", () => {
          this.loadSavedFilter(filter.id, savedFilters);
        });

        // Assemble saved filter item
        filterItem.appendChild(filterContent);
        filterItem.appendChild(actionsDiv);

        // Add to the list
        filtersList.appendChild(filterItem);
      } catch (error) {
        console.error("Error rendering saved filter:", error, filter);
      }
    });

    // Add the list to the container
    container.appendChild(filtersList);
  }

  // Load a specific saved filter set
  loadSavedFilter(filterId, savedFilters) {
    if (this.activeFilters.length > 0) {
    }

    // Find the filter in the savedFilters array
    const filter = savedFilters.find(
      (f) => f.id.toString() === filterId.toString()
    );

    if (!filter) {
      alert("Filter not found");
      return;
    }

    try {
      // NEVER CLEAR EXISTING FILTERS - WE WANT SEQUENTIAL APPLICATION
      // this.clearAllFilters(); - THIS LINE WAS THE PROBLEM

      // Parse the filters if they're stored as a string
      let filtersToProcess = filter.filters;
      if (typeof filtersToProcess === "string") {
        try {
          filtersToProcess = JSON.parse(filtersToProcess);
        } catch (e) {
          console.error("❌ Error parsing filter JSON:", e);
          filtersToProcess = [];
        }
      }

      if (
        !filtersToProcess ||
        !Array.isArray(filtersToProcess) ||
        filtersToProcess.length === 0
      ) {
        alert("This saved filter appears to be empty or invalid");
        return;
      }

      // Convert the saved filters to the format needed by the EnhancedFilterSystem
      let newFiltersToApply = filtersToProcess
        .map((savedFilter) => {
          // Find the field in allFields
          const field = this.allFields.find(
            (f) => f.id.toString() === savedFilter.fieldId.toString()
          );

          if (!field) {
            console.warn(
              `⚠️ Field not found for filter: ${savedFilter.fieldId}`
            );
            return null;
          }

          // Generate a truly unique ID for this filter
          const uniqueId = `filter_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;

          // Ensure we have values in the right format - handle both value and values properties
          let filterValues = [];
          if (savedFilter.values && Array.isArray(savedFilter.values)) {
            filterValues = savedFilter.values;
          } else if (savedFilter.value !== undefined) {
            // Might be a single value or comma-separated string
            if (
              typeof savedFilter.value === "string" &&
              ["between", "in", "not_in"].includes(savedFilter.operator)
            ) {
              filterValues = savedFilter.value.split(",").map((v) => v.trim());
            } else {
              filterValues = [savedFilter.value];
            }
          }

          // Create new filter object with a guaranteed unique ID
          const newFilter = {
            id: uniqueId,
            field: field,
            operator: savedFilter.operator,
            values: filterValues,
            displayText:
              savedFilter.displayText ||
              this.generateFilterDisplayText(
                field,
                savedFilter.operator,
                filterValues
              ),
            // Save original for reference
            originalFilter: savedFilter,
          };

          return newFilter;
        })
        .filter(Boolean); // Remove any nulls from fields not found

      if (newFiltersToApply.length === 0) {
        alert("No valid filters found in this saved filter");
        return;
      }

      // Check for duplicate filters - remove any that already exist in active filters
      const uniqueFilters = newFiltersToApply.filter((newFilter) => {
        // Check if this filter already exists
        const isDuplicate = this.activeFilters.some((existingFilter) => {
          // Compare field, operator, and values
          const sameField =
            existingFilter.field.id.toString() ===
            newFilter.field.id.toString();
          const sameOperator = existingFilter.operator === newFilter.operator;

          // Compare values - handle arrays or single values
          let sameValues = false;

          // For is_empty and is_not_empty, just check the operator and field
          if (["is_empty", "is_not_empty"].includes(newFilter.operator)) {
            sameValues = true;
          } else if (
            Array.isArray(existingFilter.values) &&
            Array.isArray(newFilter.values)
          ) {
            // Compare arrays - must be same length and same elements
            if (existingFilter.values.length === newFilter.values.length) {
              // Convert to strings for comparison to handle different data types
              const existingValueStrings = existingFilter.values.map((v) =>
                String(v)
              );
              const newValueStrings = newFilter.values.map((v) => String(v));
              sameValues = existingValueStrings.every((v) =>
                newValueStrings.includes(v)
              );
            }
          } else {
            // Handle the case where one or both might not be arrays
            sameValues =
              String(existingFilter.values) === String(newFilter.values);
          }

          return sameField && sameOperator && sameValues;
        });

        if (isDuplicate) {
        }

        return !isDuplicate; // Keep only unique filters
      });

      // Update the filters to apply with only the unique ones
      newFiltersToApply = uniqueFilters;

      if (newFiltersToApply.length === 0) {
        alert("All filters in this set are already applied");
        return;
      }

      // Add the new filters to our active filters array
      // Strategy 2: Add all as new filters (truly sequential)
      // Simply append the new filters to the existing ones
      this.activeFilters = [...this.activeFilters, ...newFiltersToApply];

      // After adding filters, render the updated list and apply
      // Add a visual indicator that filters are being added sequentially
      // by highlighting the new filters briefly

      // Update the UI first
      this.renderActiveFilterTags();

      // Highlight the newly added filters briefly
      const newFilterIds = newFiltersToApply.map((f) => f.id);
      newFilterIds.forEach((id) => {
        const filterTag = document.querySelector(
          `.filter-tag[data-filter-id="${id}"]`
        );
        if (filterTag) {
          filterTag.classList.add("filter-tag-highlight");
          // Remove the highlight class after a delay
          setTimeout(() => {
            filterTag.classList.remove("filter-tag-highlight");
          }, 2000);
        }
      });

      // Add a small delay before applying filters to make the sequential nature more visible
      setTimeout(() => {
        // Apply filters to the report
        this.applyFiltersToReport();

        // Show success message
        this.showSavedFilterToast(
          `Filter "${
            filter.name
          }" loaded successfully and added to existing filters (${
            newFiltersToApply.length
          } new filter${newFiltersToApply.length !== 1 ? "s" : ""})`
        );

        // If ReportsManager exists, sync our filters back to it
        if (
          window.ReportsManager &&
          window.ReportsManager.enhancedFilterSystem === this
        ) {
          window.ReportsManager.activeFilters = this.activeFilters.map((f) => ({
            fieldId: f.field.id,
            fieldName: f.field.display_name || f.field.name,
            operator: f.operator,
            values: f.values,
            displayText: f.displayText,
          }));
        }
      }, 100); // Small delay for visual effect
    } catch (error) {
      alert(`Error loading filter: ${error.message}`);
    }
  }

  // Delete a saved filter
  async deleteSavedFilter(filterId) {
    try {
      // First remove from localStorage if it exists
      try {
        const storedFilters = localStorage.getItem("savedFilters");
        if (storedFilters) {
          const localSavedFilters = JSON.parse(storedFilters);
          const updatedFilters = localSavedFilters.filter(
            (f) => f.id.toString() !== filterId.toString()
          );
          localStorage.setItem("savedFilters", JSON.stringify(updatedFilters));
        }
      } catch (localStorageError) {
        console.warn("Error updating localStorage:", localStorageError);
      }

      // Send request to server to delete the filter
      const response = await fetch(`/api/reports/filters/${filterId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${AuthManager.getToken()}`,
        },
      });

      if (!response.ok) {
        // Log error but don't throw - we've already updated localStorage
        console.error(
          `Server error deleting filter: ${response.status} ${response.statusText}`
        );

        try {
          const errorData = await response.json();
          console.error("Error details:", errorData);
        } catch (e) {
          // If we can't parse the error response, just log the status
          console.error("Could not parse error response");
        }
      } else {
      }

      // Show success message
      this.showSavedFilterToast("Filter deleted successfully");

      // Reload saved filters - but use the localStorage backup if the server request fails
      try {
        await this.loadSavedFilters();
      } catch (loadError) {
        console.error("Error reloading filters after delete:", loadError);

        // Fall back to localStorage
        const storedFilters = localStorage.getItem("savedFilters");
        if (storedFilters) {
          const localSavedFilters = JSON.parse(storedFilters);
          this.renderSavedFilters(localSavedFilters);
        } else {
          this.renderSavedFilters([]);
        }
      }
    } catch (error) {
      alert(`Failed to delete filter: ${error.message}`);

      // Still try to reload filters to ensure UI is in sync
      this.loadSavedFilters().catch((e) => {
        console.error("Failed to reload filters after delete error:", e);
      });
    }
  }
}

// Initialize when document is ready
document.addEventListener("DOMContentLoaded", function () {
  window.enhancedFilterSystem = new EnhancedFilterSystem();
});
