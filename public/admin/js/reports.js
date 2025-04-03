// Reports.js - Handles report generation and cross-tabulation analysis

class ReportsManager {
  constructor() {
    this.allFields = [];
    this.categoricalFields = [];
    this.activeFilters = [];
    this.savedFilters = [];
    this.savedReports = []; // Track saved reports
    this.reportData = null;
    this.chart = null;
    this.enhancedFilterSystem = null;
    this.currentReportConfig = null; // Store current report configuration

    // DOM Elements
    this.rowVariableSelect = document.getElementById("rowVariable");
    this.columnVariableSelect = document.getElementById("columnVariable");
    this.filterFieldSelect = document.getElementById("filterField");
    this.filterOperatorSelect = document.getElementById("filterOperator");
    this.filterValueInput = document.getElementById("filterValue");
    this.filterValueContainer = document.getElementById("filterValueContainer");
    this.activeFiltersContainer = document.getElementById("activeFilters");
    this.savedFiltersContainer = document.getElementById(
      "savedFiltersContainer"
    );
    this.reportResults = document.getElementById("reportResults");
    this.crossTabTable = document.getElementById("crossTabTable");
    this.reportLoading = document.getElementById("reportLoading");
    this.chartView = document.getElementById("chartView");
    this.reportChart = document.getElementById("reportChart");

    // Initialize state
    this.isApplyingFilter = false; // Add flag to prevent filter application loops
    this.isRestoringSelections = false; // Add flag to prevent selection restoration loops

    // Initialize
    this.init();
  }

  async init() {
    try {
      // Check authentication
      const isAuthenticated = await AuthManager.verifyAuth();
      if (!isAuthenticated) {
        const userType = AuthManager.getCurrentUserType();
        window.location.href =
          userType === "department" ? "/department-login" : "/login.html";
        return;
      }

      // Get user info and display in the header
      const userInfo = AuthManager.getUserInfo();
      if (userInfo && document.getElementById("userInfo")) {
        document.getElementById(
          "userInfo"
        ).textContent = `Welcome, ${userInfo.full_name}`;
      }

      // Show main content and hide auth loader
      if (document.getElementById("authLoader")) {
        document.getElementById("authLoader").style.display = "none";
      }
      if (document.getElementById("mainContent")) {
        document.getElementById("mainContent").style.display = "block";
      }

      // Load form fields
      await this.loadFormFields();

      // Populate dropdowns
      this.populateFieldDropdowns();

      // Initialize enhanced filter system AFTER form fields are loaded
      this.initEnhancedFilterSystem();

      // Set up event listeners
      this.initEventListeners();

      // Load saved filters
      this.loadSavedFilters();

      // Create saved reports section
      this.createSavedReportsSection();

      // Load saved reports
      this.loadSavedReports();

      // Add the Save Report button to the report actions
      this.addSaveReportButton();
    } catch (error) {
      alert("An error occurred during initialization. Please try again.");
    }
  }

  // Add function to create Save Report button
  addSaveReportButton() {
    // Check if save button already exists
    if (document.getElementById("saveReportBtn")) {
      return;
    }

    // Look for the button group that contains the Print and Export CSV buttons
    const reportActionsGroup = document.querySelector(
      "#reportResults .btn-group"
    );

    if (reportActionsGroup) {
      // Create the button
      const saveBtn = document.createElement("button");
      saveBtn.id = "saveReportBtn";
      saveBtn.className = "btn btn-success";
      saveBtn.innerHTML = '<i class="bi bi-save me-1"></i> Save Report';

      // Insert it after the Print button in the button group
      reportActionsGroup.appendChild(saveBtn);

      // Add click event listener
      saveBtn.addEventListener("click", () => {
        this.showSaveReportModal();
      });

      // Add custom styles for the button
      const style = document.createElement("style");
      style.textContent = `
        #saveReportBtn {
          background-color: #198754;
          border-color: #198754;
          color: white;
          font-weight: 500;
          transition: all 0.2s ease;
        }
        #saveReportBtn:hover {
          background-color: #157347;
          border-color: #146c43;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }
        #saveReportBtn:active {
          transform: translateY(1px);
          box-shadow: none;
        }
      `;
      document.head.appendChild(style);
    } else {
      console.warn("Button group not found for Save Report button");

      // Fallback: Find any container in the report actions area
      const reportActionsContainer = document.querySelector(
        "#reportResults .mb-3"
      );
      if (reportActionsContainer) {
        // Create a button group if it doesn't exist
        let btnGroup = reportActionsContainer.querySelector(".btn-group");
        if (!btnGroup) {
          btnGroup = document.createElement("div");
          btnGroup.className = "btn-group me-2";
          btnGroup.setAttribute("role", "group");
          reportActionsContainer.insertBefore(
            btnGroup,
            reportActionsContainer.firstChild
          );
        }

        // Create button
        const saveBtn = document.createElement("button");
        saveBtn.id = "saveReportBtn";
        saveBtn.className = "btn btn-success";
        saveBtn.innerHTML = '<i class="bi bi-save me-1"></i> Save Report';

        // Append to button group
        btnGroup.appendChild(saveBtn);

        // Add event listener
        saveBtn.addEventListener("click", () => {
          this.showSaveReportModal();
        });
      }
    }
  }

  // Function to show the save report modal
  showSaveReportModal() {
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

    // Check if we have a current report
    if (!this.currentReportConfig) {
      // Get current configuration
      const rowVariableId = this.rowVariableSelect.value;
      const columnVariableId = this.columnVariableSelect.value;

      if (!rowVariableId || !columnVariableId) {
        alert("Please select both row and column variables.");
        return;
      }

      // Get the display names of the selected variables
      const rowVariableName =
        this.rowVariableSelect.options[this.rowVariableSelect.selectedIndex]
          .text;
      const columnVariableName =
        this.columnVariableSelect.options[
          this.columnVariableSelect.selectedIndex
        ].text;

      // Get the selected aggregation type
      const aggregationType = document.querySelector(
        'input[name="aggregationType"]:checked'
      ).value;

      // Create report configuration object
      this.currentReportConfig = {
        rowVariableId,
        columnVariableId,
        rowVariableName,
        columnVariableName,
        aggregationType,
        filters: [...this.activeFilters], // Make a copy of the filters array
      };
    }

    // Create the modal if it doesn't exist
    let modalElement = document.getElementById("saveReportModal");
    if (!modalElement) {
      modalElement = document.createElement("div");
      modalElement.id = "saveReportModal";
      modalElement.className = "modal fade";
      modalElement.setAttribute("tabindex", "-1");
      modalElement.setAttribute("aria-hidden", "true");

      modalElement.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Save Report</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label for="reportName" class="form-label">Report Name</label>
                <input type="text" class="form-control" id="reportName" placeholder="Enter a name for this report">
              </div>
              <div class="mb-3">
                <label for="reportCategory" class="form-label">Category</label>
                <div class="input-group">
                  <select class="form-select" id="reportCategory">
                    <option value="General" selected>General</option>
                    <!-- Other categories will be added dynamically -->
                  </select>
                  <button class="btn btn-outline-secondary" type="button" id="newCategoryBtn">New</button>
                </div>
              </div>
              <div class="mb-3" id="newCategoryInput" style="display: none;">
                <label for="newCategory" class="form-label">New Category Name</label>
                <div class="input-group">
                  <input type="text" class="form-control" id="newCategory" placeholder="Enter new category name">
                  <button class="btn btn-outline-primary" type="button" id="addCategoryBtn">Add</button>
                  <button class="btn btn-outline-secondary" type="button" id="cancelCategoryBtn">Cancel</button>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Report Configuration</label>
                <div id="reportConfigDetails" class="p-3 bg-light rounded">
                  <!-- Will be populated by JavaScript -->
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" id="confirmSaveReportBtn">Save</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modalElement);

      // Add event listener for the save button
      document
        .getElementById("confirmSaveReportBtn")
        .addEventListener("click", () => {
          this.saveReport();
        });

      // Add event listener for the new category button
      document
        .getElementById("newCategoryBtn")
        .addEventListener("click", () => {
          document.getElementById("newCategoryInput").style.display = "block";
        });

      // Add event listener for the add category button
      document
        .getElementById("addCategoryBtn")
        .addEventListener("click", () => {
          const newCategory = document
            .getElementById("newCategory")
            .value.trim();
          if (newCategory) {
            const selectElement = document.getElementById("reportCategory");
            const option = document.createElement("option");
            option.value = newCategory;
            option.text = newCategory;
            selectElement.appendChild(option);
            selectElement.value = newCategory;
            document.getElementById("newCategoryInput").style.display = "none";
            document.getElementById("newCategory").value = "";
          }
        });

      // Add event listener for the cancel category button
      document
        .getElementById("cancelCategoryBtn")
        .addEventListener("click", () => {
          document.getElementById("newCategoryInput").style.display = "none";
          document.getElementById("newCategory").value = "";
        });
    }

    // Load categories for the dropdown
    this.loadCategories();

    // Update the report configuration details
    const configDetails = document.getElementById("reportConfigDetails");
    if (configDetails) {
      configDetails.innerHTML = `
        <div class="mb-2">
          <strong>Row Variable:</strong> ${
            this.currentReportConfig.rowVariableName
          }
        </div>
        <div class="mb-2">
          <strong>Column Variable:</strong> ${
            this.currentReportConfig.columnVariableName
          }
        </div>
        <div class="mb-2">
          <strong>Aggregation Type:</strong> ${
            this.currentReportConfig.aggregationType
          }
        </div>
        <div>
          <strong>Filters:</strong> ${
            this.currentReportConfig.filters.length || 0
          } applied
        </div>
      `;
    }

    // Show the modal
    const modalInstance = new bootstrap.Modal(modalElement);
    modalInstance.show();
  }

  // Load available categories
  async loadCategories() {
    try {
      const response = await fetch("/api/reports/categories", {
        headers: {
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load categories");
      }

      const categories = await response.json();
      const selectElement = document.getElementById("reportCategory");

      // Clear existing options except the first one (General)
      while (selectElement.options.length > 1) {
        selectElement.remove(1);
      }

      // Add categories to the dropdown
      categories.forEach((category) => {
        // Skip General as it's already the default
        if (category !== "General") {
          const option = document.createElement("option");
          option.value = category;
          option.text = category;
          selectElement.appendChild(option);
        }
      });
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  }

  // Function to save report to the database
  async saveReport() {
    try {
      const reportName = document.getElementById("reportName").value.trim();
      if (!reportName) {
        alert("Please enter a name for this report");
        return;
      }

      // Get selected category
      const categorySelect = document.getElementById("reportCategory");
      const category = categorySelect ? categorySelect.value : "General";

      // Get current user info
      const userInfo = AuthManager.getUserInfo();
      if (!userInfo || !userInfo.id) {
        alert("User information not available. Please log in again.");
        return;
      }

      // Build report configuration object
      const config = {
        rowVariableId: this.rowVariableSelect.value,
        rowVariableName:
          this.rowVariableSelect.options[this.rowVariableSelect.selectedIndex]
            .text,
        columnVariableId: this.columnVariableSelect.value,
        columnVariableName:
          this.columnVariableSelect.options[
            this.columnVariableSelect.selectedIndex
          ].text,
        aggregationType: document.querySelector(
          'input[name="aggregationType"]:checked'
        ).value,
        filters: this.activeFilters,
        timestamp: new Date().toISOString(),
      };

      // Save to server
      const response = await fetch("/api/reports/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
        body: JSON.stringify({
          name: reportName,
          config: config,
          category: category,
          userId: userInfo.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save report");
      }

      const result = await response.json();

      // Close the modal
      const bsModalInstance = bootstrap.Modal.getInstance(
        document.getElementById("saveReportModal")
      );
      bsModalInstance.hide();

      // Reset the report name input
      document.getElementById("reportName").value = "";

      // Show success message
      this.showToast("Success", "Report saved successfully!", "success");

      // Refresh saved reports list
      this.loadSavedReports();
    } catch (error) {
      alert(`Failed to save report: ${error.message}`);
    }
  }

  // Function to load saved reports from the database
  async loadSavedReports() {
    try {
      const response = await fetch("/api/reports/saved", {
        headers: {
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load saved reports");
      }

      const reports = await response.json();
      this.savedReports = reports;
      this.renderSavedReports();
    } catch (error) {
      console.error("Error loading saved reports:", error);

      // Check if the container exists
      const container = document.getElementById("savedReportsContainer");
      if (container) {
        container.innerHTML =
          '<p class="text-danger">Failed to load saved reports</p>';
      }
    }
  }

  // Function to render saved reports
  renderSavedReports() {
    const container = document.getElementById("savedReportsContainer");
    if (!container) return;

    if (this.savedReports.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon mb-3">
          <i class="bi bi-file-earmark-bar-graph"></i>
          </div>
          <h5 class="mb-3">No saved reports yet</h5>
          <p class="text-muted small mb-4">Generate a report and click "Save Report" to create your first saved report</p>
        </div>
      `;
      return;
    }

    // Clear container
    container.innerHTML = "";

    // Group reports by category
    const reportsByCategory = this.savedReports.reduce((acc, report) => {
      const category = report.category || "General";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(report);
      return acc;
    }, {});

    // Sort categories alphabetically with 'General' always first
    const sortedCategories = Object.keys(reportsByCategory).sort((a, b) => {
      if (a === "General") return -1;
      if (b === "General") return 1;
      return a.localeCompare(b);
    });

    // For each category, create a section
    sortedCategories.forEach((category) => {
      const categoryReports = reportsByCategory[category];

      // Create category section
      const categorySection = document.createElement("div");
      categorySection.className = "report-category-section mb-4";
      container.appendChild(categorySection);

      // Create category header
      const categoryHeader = document.createElement("div");
      categoryHeader.className = "category-header";
      categoryHeader.innerHTML = `
        <div class="d-flex align-items-center justify-content-between">
          <h4 class="category-title mb-0">
            ${
              category === "General"
                ? `<i class="bi bi-grid me-2"></i>`
                : `<i class="bi bi-folder2-open me-2"></i>`
            }
            ${category}
            <span class="badge rounded-pill ms-2">${
              categoryReports.length
            } report${categoryReports.length !== 1 ? "s" : ""}</span>
          </h4>
          <button class="btn btn-sm btn-outline-secondary category-collapse-btn" type="button" data-category="${category}">
            <i class="bi bi-chevron-down"></i>
          </button>
        </div>
        <div class="category-divider" style="display: none;">
          <hr class="mt-3 mb-2">
        </div>
      `;
      categorySection.appendChild(categoryHeader);

      // Create a row for the grid layout for this category
      const row = document.createElement("div");
      row.className = "row g-4 category-items mt-2"; // Add margin-top for better spacing
      row.setAttribute("data-category", category);
      row.style.display = "none"; // Hide by default
      categorySection.appendChild(row);

      // Add saved report cards for this category
      categoryReports.forEach((report) => {
        // Create column for grid layout - use col-12 for full width single column
        const col = document.createElement("div");
        col.className = "col-12"; // Changed from col-12 col-md-6 col-lg-4 to display in a single column
        row.appendChild(col);

        const reportCard = document.createElement("div");
        reportCard.className = "card h-100 saved-report-card";

        // Format date
        const date = new Date(report.updated_at);
        const formattedDate = date.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });

        const filterCount = report.config.filters?.length || 0;

        // Get row and column variable names with truncation for display
        const rowVarName = report.config.rowVariableName || "None";
        const colVarName = report.config.columnVariableName || "None";

        // Get creator name
        const creatorName = report.creator_name || "Unknown";

        reportCard.innerHTML = `
          <div class="card-body d-flex flex-column">
            <div class="d-flex justify-content-between align-items-start mb-3 flex-wrap">
              <h5 class="card-title mb-2 me-2" title="${report.name}">${
          report.name
        }</h5>
              <span class="badge bg-light text-dark border">${formattedDate}</span>
            </div>
            
            <div class="mb-3">
              <div class="d-flex align-items-center flex-wrap mb-3">
                <span class="variable-label me-2">Row:</span>
                <span class="badge bg-primary text-white" title="${rowVarName}">${rowVarName}</span>
              </div>
              <div class="d-flex align-items-center flex-wrap mb-3">
                <span class="variable-label me-2">Column:</span>
                <span class="badge bg-primary text-white" title="${colVarName}">${colVarName}</span>
              </div>
              <div class="d-flex align-items-center flex-wrap">
                <span class="variable-label me-2">Filters:</span>
                <span class="filter-text">
                <i class="bi bi-funnel me-2 text-secondary"></i>
                  ${filterCount} filter${filterCount !== 1 ? "s" : ""} applied
                </span>
              </div>
            </div>
            
            <div class="d-flex align-items-center mb-3">
              <span class="variable-label me-2">Created by:</span>
              <span class="creator-text">
                ${creatorName}
              </span>
            </div>
            
            <div class="mt-auto">
              <div class="d-flex flex-wrap">
                <div class="btn-group mb-2 me-2">
                  <button class="btn btn-primary load-report-btn" data-report-id="${
                    report.id
                  }">
                    <i class="bi bi-cloud-download me-1"></i> Load
                  </button>
                  <button class="btn btn-info view-report-btn" data-report-id="${
                    report.id
                  }">
                    <i class="bi bi-fullscreen me-1"></i> View
                  </button>
                </div>
                ${
                  report.user_id === AuthManager.getUserInfo().id
                    ? `
                <button class="btn btn-outline-danger delete-report-btn mb-2" data-report-id="${report.id}">
                  <i class="bi bi-trash"></i>
                </button>
                `
                    : ""
                }
              </div>
            </div>
          </div>
        `;

        col.appendChild(reportCard);

        // Add event listeners
        reportCard
          .querySelector(".load-report-btn")
          .addEventListener("click", () => {
            this.loadSavedReport(report.id);
          });

        // Add event listener for View button
        reportCard
          .querySelector(".view-report-btn")
          .addEventListener("click", () => {
            window.location.href = `/admin/reports/view/index.html?id=${report.id}`;
          });

        // Only add delete button event listener if the button exists
        const deleteButton = reportCard.querySelector(".delete-report-btn");
        if (deleteButton) {
          deleteButton.addEventListener("click", () => {
            this.confirmDeleteReport(report.id, report.name);
          });
        }
      });

      // Add event listener for category collapse button
      categoryHeader
        .querySelector(".category-collapse-btn")
        .addEventListener("click", (e) => {
          const btn = e.currentTarget;
          const categoryName = btn.getAttribute("data-category");
          const categoryItems = document.querySelector(
            `.category-items[data-category="${categoryName}"]`
          );
          const divider = btn
            .closest(".category-header")
            .querySelector(".category-divider");

          if (categoryItems.style.display === "none") {
            categoryItems.style.display = "flex";
            btn.querySelector("i").className = "bi bi-chevron-up";
            divider.style.display = "block"; // Show divider when expanded
          } else {
            categoryItems.style.display = "none";
            btn.querySelector("i").className = "bi bi-chevron-down";
            divider.style.display = "none"; // Hide divider when collapsed
          }
        });

      // Make the entire category header clickable
      categoryHeader.addEventListener("click", (e) => {
        // Don't trigger if clicked on the button (to avoid double-trigger)
        if (!e.target.closest(".category-collapse-btn")) {
          // Simulate click on the button
          categoryHeader.querySelector(".category-collapse-btn").click();
        }
      });

      // Add pointer cursor to show it's clickable
      categoryHeader.style.cursor = "pointer";
    });

    // Add improved custom style for saved reports
    if (!document.getElementById("saved-reports-custom-style")) {
      const style = document.createElement("style");
      style.id = "saved-reports-custom-style";
      style.textContent = `
        #savedReportsContainer {
          width: 100%;
        }
        
        .row.g-4 {
          --bs-gutter-x: 1.5rem;
          --bs-gutter-y: 1.5rem;
        }
        
        /* Report Category Section */
        .report-category-section {
          background-color: #f8fafc;
          border-radius: 12px;
          padding: 1.25rem 1.5rem;
          margin-bottom: 2rem;
          border: 1px solid #e9ecef;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
          transition: all 0.3s ease;
        }
        
        .report-category-section:hover {
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.06);
        }
        
        /* Category Header */
        .category-header {
          position: relative;
          margin-bottom: 0 !important;
        }
        
        .category-header .d-flex {
          padding: 0.25rem 0;
        }
        
        .category-title {
          font-size: 1.2rem;
          font-weight: 600;
          color: var(--primary-color);
          display: flex;
          align-items: center;
        }
        
        .category-title i {
          color: var(--primary-color);
          margin-right: 0.5rem;
          opacity: 0.8;
        }
        
        .category-title .badge {
          font-size: 0.8rem;
          font-weight: 500;
          background-color: rgba(26, 35, 126, 0.08);
          color: var(--primary-color);
          border: 1px solid rgba(26, 35, 126, 0.15);
          margin-left: 0.75rem;
          border-radius: 20px;
          padding: 0.25rem 0.75rem;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
        
        hr {
          opacity: 0.1;
          border-color: var(--primary-color);
          margin: 0.75rem 0 1rem 0;
        }
        
        .category-collapse-btn {
          padding: 0.4rem 0.6rem;
          font-size: 0.875rem;
          border-radius: 6px;
          background-color: #fff;
          color: #6b7280;
          border-color: #e5e7eb;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          margin-left: 10px;
        }
        
        .category-collapse-btn:hover {
          background-color: #f9fafb;
          color: var(--primary-color);
          border-color: #d1d5db;
        }
        
        /* Report Cards */
        .saved-report-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
          transition: all 0.3s ease;
          border: 1px solid #e6edf5;
          height: 100%;
          overflow: hidden;
        }
        
        .saved-report-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
          border-color: #d1dce8;
        }
        
        .saved-report-card .card-body {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
        }
        
        .saved-report-card .card-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: #344767;
          margin-bottom: 0.75rem;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        
        /* Variable Labels and Badges */
        .variable-label {
          font-size: 0.85rem;
          color: #64748b;
          font-weight: 500;
          min-width: 60px;
        }
        
        .saved-report-card .badge.bg-primary {
          background: linear-gradient(45deg, var(--primary-color), #2c3e80);
          color: white;
          overflow: hidden;
          text-overflow: ellipsis;
          display: inline-block;
          text-align: center;
          padding: 0.45rem 0.85rem;
          font-weight: 500;
          box-shadow: 0 2px 5px rgba(26, 35, 126, 0.2);
          border-radius: 6px;
          font-size: 0.85rem;
          word-break: break-word;
          line-height: 1.4;
          border: none;
        }
        
        /* Date Badge */
        .saved-report-card .badge.bg-light {
          background: linear-gradient(to right, #f8f9fa, #f1f5f9) !important;
          border: 1px solid #e9ecef !important;
          color: #64748b !important;
          font-weight: 500;
          padding: 0.35rem 0.65rem;
          border-radius: 6px;
          font-size: 0.75rem;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
          line-height: 1.4;
        }
        
        /* Filter Count */
        .filter-count {
          color: #64748b;
          font-size: 0.85rem;
        }
        
        .filter-count i {
          color: #94a3b8;
          margin-right: 0.5rem;
        }
        
        .filter-count .d-flex.align-items-center {
          padding-top: 1px; /* Subtle adjustment to align with the variable label */
        }
        
        /* Variable Labels - ensure consistent styling */
        .variable-label {
          font-size: 0.85rem;
          color: #64748b;
          font-weight: 500;
          min-width: 60px;
        }
        
        /* Action Buttons */
        .saved-report-card .btn-group {
          gap: 0;
          flex-wrap: nowrap;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
          border-radius: 8px;
          overflow: hidden;
        }
        
        .saved-report-card .btn {
          font-weight: 500;
          font-size: 0.85rem;
          padding: 0.5rem 0.75rem;
          border: none;
          position: relative;
          overflow: hidden;
        }
        
        /* Load button with subtle effects */
        .saved-report-card .btn-primary {
          background: linear-gradient(45deg, var(--primary-color), #303f9f);
          box-shadow: 0 2px 4px rgba(26, 35, 126, 0.2);
          transition: none;
          position: relative;
          overflow: hidden;
        }
        
        .saved-report-card .btn-primary:hover {
          opacity: 0.95;
        }
        
        .saved-report-card .btn-primary:active {
          background: linear-gradient(45deg, #0d1757, #283593);
          opacity: 1;
        }
        
        
        /* View button with subtle effects */
        .saved-report-card .view-report-btn {
          background: #0891b2;
          color: white;
          border: none;
          box-shadow: 0 2px 4px rgba(8, 145, 178, 0.2);
          transition: none;
          position: relative;
          overflow: hidden;
        }
        
        .saved-report-card .view-report-btn:hover {
          opacity: 0.95;
        }
        
        .saved-report-card .view-report-btn:active {
          background: linear-gradient(45deg, #0c637a, #077d9b);
          opacity: 1;
        }
        
        /* Add sliding gradient effect to view button */
        .saved-report-card .view-report-btn::before {
          content: "";
          position: absolute;
          top: 0;
          left: -100%;
          width: 200%;
          height: 100%;
          background: linear-gradient(
            120deg,
            transparent 0%,
            rgba(255, 255, 255, 0.2) 50%,
            transparent 100%
          );
          transform: translateX(-100%);
          transition: transform 0.5s ease;
          z-index: 1;
        }
        
        .saved-report-card .view-report-btn:hover::before {
          transform: translateX(100%);
        }
        
        /* Keep text and icon white on click */
        .saved-report-card .view-report-btn:active,
        .saved-report-card .view-report-btn:focus {
          color: white !important;
        }
        
        .saved-report-card .view-report-btn:active i,
        .saved-report-card .view-report-btn:focus i {
          color: white !important;
        }
        
        /* Make button content position relative to appear above the sliding gradient */
        .saved-report-card .btn-primary span,
        .saved-report-card .btn-primary i,
        .saved-report-card .view-report-btn span,
        .saved-report-card .view-report-btn i {
          position: relative;
          z-index: 2;
        }
        
        /* Ripple effect for buttons */
        .saved-report-card .btn-primary::after,
        .saved-report-card .view-report-btn::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 5px;
          height: 5px;
          background: rgba(255, 255, 255, 0.4);
          opacity: 0;
          border-radius: 100%;
          transform: scale(1, 1) translate(-50%, -50%);
          transform-origin: 50% 50%;
          z-index: 2;
        }
        
        .saved-report-card .btn-primary:active::after,
        .saved-report-card .view-report-btn:active::after {
          opacity: 0.3;
          animation: ripple 0.5s ease-out;
        }
        
        @keyframes ripple {
          0% {
            transform: scale(0, 0) translate(-50%, -50%);
            opacity: 0.5;
          }
          100% {
            transform: scale(20, 20) translate(-50%, -50%);
            opacity: 0;
          }
        }
        
        /* Fix Delete button */
        .saved-report-card .delete-report-btn {
          width: 38px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #fff;
          color: #ef4444;
          border: 1px solid #fca5a5;
        }
        
        .saved-report-card .delete-report-btn:hover {
          background-color: #fee2e2;
        }
        
        /* Keep icon red on click */
        .saved-report-card .delete-report-btn:active,
        .saved-report-card .delete-report-btn:focus {
          color: #ef4444 !important;
          background-color: #fecaca;
        }
        
        .saved-report-card .delete-report-btn:active i,
        .saved-report-card .delete-report-btn:focus i {
          color: #ef4444 !important;
        }
        
        /* Empty State */
        .empty-state {
          text-align: center;
          padding: 3rem 2rem;
          color: #6b7280;
          background-color: #f8fafc;
          border-radius: 12px;
          border: 1px dashed #cbd5e1;
        }
        
        .empty-state i {
          font-size: 3rem;
          margin-bottom: 1.5rem;
          opacity: 0.5;
          color: var(--primary-color);
        }
        
        .empty-state p {
          margin-bottom: 0.75rem;
          font-size: 1.1rem;
          font-weight: 500;
          color: #475569;
        }
        
        .empty-state p.small, .empty-state p.text-muted {
          font-size: 0.9rem;
          color: #94a3b8 !important;
        }
        
        /* Add more space above the buttons */
        .saved-report-card .mt-auto {
          margin-top: 1rem !important;
        }
        
        /* Animation for loaded report highlight */
        @keyframes reportHighlight {
          0% {
            box-shadow: 0 0 0 0 rgba(var(--primary-color), 0.7);
            border-color: var(--primary-color);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(var(--primary-color), 0);
            border-color: var(--primary-color);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(var(--primary-color), 0);
            border-color: #e6edf5;
          }
        }
        
        .report-highlight {
          animation: reportHighlight 2s ease;
        }
        
        /* Refresh Button */
        #refreshSavedReportsBtn {
          padding: 0.5rem 1rem;
          font-weight: 500;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 6px;
          background-color: #fff;
          color: var(--primary-color);
          border: 1px solid rgba(26, 35, 126, 0.3);
          border-radius: 6px;
          transition: all 0.2s ease;
        }
        
        #refreshSavedReportsBtn:hover {
          background-color: #eef2ff;
          border-color: var(--primary-color);
          transform: translateY(-1px);
        }
        
        #refreshSavedReportsBtn i {
          font-size: 1rem;
        }
        
        /* Responsive Styles */
        @media (max-width: 767px) {
        .report-category-section {
            padding: 1rem;
          }
          
          .saved-report-card .card-title {
            font-size: 1rem;
            -webkit-line-clamp: 1;
          }
          
          .saved-report-card .badge {
            font-size: 0.75rem;
            padding: 4px 8px;
          }
          
          .saved-report-card .badge.bg-primary {
            font-size: 0.75rem;
            padding: 0.35rem 0.6rem;
            margin-bottom: 0.3rem;
          }
          
          .variable-label {
            font-size: 0.8rem;
            min-width: 50px;
          }
          
          .saved-report-card .btn {
            font-size: 0.8rem;
            padding: 0.375rem 0.5rem;
          }
          
          .saved-report-card .card-body {
            padding: 1rem;
          }
          
          .empty-state {
            padding: 2rem 1rem;
          }
          
          .empty-state i {
            font-size: 2.5rem;
          }
          
          .empty-state p {
            font-size: 1rem;
          }
        }

        /* Creator Text */
        .creator-text {
          color: #64748b;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
        }

        .creator-text i {
          color: #94a3b8;
          font-size: 0.9rem;
        }
        
        /* Filter Text */
        .filter-text {
          color: #64748b;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
        }

        .filter-text i {
          color: #94a3b8;
          font-size: 0.9rem;
        }

        /* Remove redundant Filter Count styles that are no longer needed */
        .filter-count, .filter-count i, .filter-count .d-flex.align-items-center {
          display: none;
        }
      `;
      document.head.appendChild(style);
    }
  }

  // Function to load a saved report
  async loadSavedReport(reportId) {
    try {
      const response = await fetch(`/api/reports/saved/${reportId}`, {
        headers: {
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load report");
      }

      const report = await response.json();

      // Store current report config
      this.currentReportConfig = report.config;

      // Set row variable
      if (report.config.rowVariableId) {
        this.rowVariableSelect.value = report.config.rowVariableId;
      }

      // Set column variable
      if (report.config.columnVariableId) {
        this.columnVariableSelect.value = report.config.columnVariableId;
      }

      // Set aggregation type
      if (report.config.aggregationType) {
        const aggregationRadio = document.querySelector(
          `input[name="aggregationType"][value="${report.config.aggregationType}"]`
        );
        if (aggregationRadio) {
          aggregationRadio.checked = true;
        }
      }

      // Set filters
      if (report.config.filters && Array.isArray(report.config.filters)) {
        this.activeFilters = [...report.config.filters];
        this.renderActiveFilters();

        // Sync with enhanced filter system if available
        if (this.enhancedFilterSystem) {
          this.enhancedFilterSystem.syncFilters(this.activeFilters);
        }
      }

      // Show success message
      this.showToast(
        "Report Loaded",
        `"${report.name}" has been loaded successfully`,
        "info"
      );

      // Generate report
      this.generateReport();

      // Add a highlight effect to the loaded report card
      const reportCards = document.querySelectorAll(".saved-report-card");
      reportCards.forEach((card) => {
        const loadBtn = card.querySelector(
          `.load-report-btn[data-report-id="${reportId}"]`
        );
        if (loadBtn) {
          // Make sure the category containing this report is expanded
          const categorySection = card.closest(".report-category-section");
          if (categorySection) {
            const categoryBtn = categorySection.querySelector(
              ".category-collapse-btn"
            );
            const categoryName = categoryBtn.getAttribute("data-category");
            const categoryItems = categorySection.querySelector(
              `.category-items[data-category="${categoryName}"]`
            );
            const divider = categorySection.querySelector(".category-divider");

            // Expand the category
            categoryItems.style.display = "flex";
            categoryBtn.querySelector("i").className = "bi bi-chevron-up";
            if (divider) divider.style.display = "block";
          }

          // Remove existing animation classes from all cards
          reportCards.forEach((c) =>
            c.classList.remove("report-highlight", "highlight-pulse")
          );

          // Add the new animation class
          card.classList.add("report-highlight");

          // Scroll the card into view with a smooth animation
          card.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    } catch (error) {
      console.error("Error loading saved report:", error);
      this.showToast(
        "Error",
        "Failed to load the report. Please try again.",
        "danger"
      );
    }
  }

  // Function to confirm and delete a saved report
  confirmDeleteReport(reportId, reportName) {
    if (
      confirm(`Are you sure you want to delete the report "${reportName}"?`)
    ) {
      this.deleteSavedReport(reportId);
    }
  }

  // Function to delete a saved report
  async deleteSavedReport(reportId) {
    try {
      const response = await fetch(`/api/reports/saved/${reportId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete report");
      }

      // Remove from the list
      this.savedReports = this.savedReports.filter(
        (report) => report.id !== reportId
      );

      // Update UI
      this.renderSavedReports();

      // Show success message
      this.showToast("Success", "Report deleted successfully", "success");
    } catch (error) {
      alert(`Failed to delete report: ${error.message}`);
    }
  }

  // Function to display toast notification
  showToast(title, message, type = "info") {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById("toast-container");
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.id = "toast-container";
      toastContainer.className = "position-fixed bottom-0 end-0 p-3";
      toastContainer.style.zIndex = "11000"; // Increased z-index to match other toasts
      document.body.appendChild(toastContainer);
    }

    // Create toast element
    const toastId = "toast-" + Date.now();
    const toastElement = document.createElement("div");
    toastElement.id = toastId;
    toastElement.className = `toast`; // Removed align-items-center and border-0
    toastElement.setAttribute("role", "alert");
    toastElement.setAttribute("aria-live", "assertive");
    toastElement.setAttribute("aria-atomic", "true");

    // Set toast background color based on type
    let iconClass = "";

    switch (type) {
      case "success":
        iconClass = "bi-check-circle-fill text-success";
        break;
      case "error":
      case "danger":
        type = "danger"; // Normalize type name
        iconClass = "bi-exclamation-circle-fill text-danger";
        break;
      case "warning":
        iconClass = "bi-exclamation-triangle-fill text-warning";
        break;
      case "info":
      default:
        type = "info"; // Ensure default type is set
        iconClass = "bi-info-circle-fill text-info";
        break;
    }

    // Set toast content with new structure to match other toasts
    toastElement.innerHTML = `
      <div class="toast-header">
        <i class="${iconClass} me-2"></i>
        <strong class="me-auto">${title}</strong>
        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body">
        ${message}
      </div>
    `;

    // Add border-left style to match other toasts
    switch (type) {
      case "success":
        toastElement.style.borderLeftColor = "#198754";
        break;
      case "danger":
        toastElement.style.borderLeftColor = "#dc3545";
        break;
      case "warning":
        toastElement.style.borderLeftColor = "#ffc107";
        break;
      case "info":
        toastElement.style.borderLeftColor = "#0dcaf0";
        break;
    }

    toastContainer.appendChild(toastElement);

    // Initialize and show the toast
    const toastInstance = new bootstrap.Toast(toastElement, {
      autohide: true,
      delay: 5000,
    });

    toastInstance.show();

    // Remove toast from DOM after it's hidden
    toastElement.addEventListener("hidden.bs.toast", () => {
      toastElement.remove();
    });
  }

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

      // Filter categorical fields (select, radio, checkbox, nested-select)
      this.categoricalFields = data.filter((field) =>
        ["select", "radio", "checkbox", "nested-select"].includes(
          field.field_type
        )
      );

      // Populate select dropdowns
      this.populateFieldDropdowns();
    } catch (error) {
      console.error("Error loading form fields:", error);
    }
  }

  populateFieldDropdowns() {
    // Clear existing options
    this.rowVariableSelect.innerHTML =
      '<option value="">Select row variable</option>';
    this.columnVariableSelect.innerHTML =
      '<option value="">Select column variable</option>';
    this.filterFieldSelect.innerHTML =
      '<option value="">Select a field</option>';

    // Add categorical fields to row and column variable selects
    this.categoricalFields.forEach((field) => {
      const rowOption = document.createElement("option");
      rowOption.value = field.id;
      rowOption.textContent = field.display_name;
      this.rowVariableSelect.appendChild(rowOption);

      const colOption = document.createElement("option");
      colOption.value = field.id;
      colOption.textContent = field.display_name;
      this.columnVariableSelect.appendChild(colOption);
    });

    // Add all fields to filter field select
    this.allFields.forEach((field) => {
      const option = document.createElement("option");
      option.value = field.id;
      option.textContent = field.display_name;
      option.dataset.fieldType = field.field_type;
      this.filterFieldSelect.appendChild(option);
    });
  }

  initEventListeners() {
    // Add filter button
    document.getElementById("addFilterBtn").addEventListener("click", () => {
      document.getElementById("filterRow").style.display = "flex";
    });

    // Apply filter button
    document.getElementById("applyFilterBtn").addEventListener("click", () => {
      this.addFilter();
    });

    // Filter field change
    this.filterFieldSelect.addEventListener("change", () => {
      this.updateFilterOperators();
    });

    // Filter operator change
    this.filterOperatorSelect.addEventListener("change", () => {
      this.updateFilterValueInput();
    });

    // Generate report button
    document
      .getElementById("generateReportBtn")
      .addEventListener("click", () => {
        this.generateReport();
      });

    // Save current filters button
    document
      .getElementById("saveCurrentFiltersBtn")
      .addEventListener("click", () => {
        this.showSaveFilterModal();
      });

    // Clear all filters button (if it exists)
    const clearFiltersBtn = document.getElementById("clearAllFiltersBtn");
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener("click", () => {
        this.resetAllFilters();
      });
    } else {
      // Create a clear filters button if it doesn't exist
      const reportActionsContainer = document.querySelector(".report-actions");
      if (reportActionsContainer) {
        const clearBtn = document.createElement("button");
        clearBtn.id = "clearAllFiltersBtn";
        clearBtn.className = "btn btn-outline-secondary me-2";
        clearBtn.innerHTML = '<i class="bi bi-x-circle"></i> Clear All Filters';
        clearBtn.addEventListener("click", () => {
          this.resetAllFilters();
        });

        // Insert before the "Save Filters" button if it exists
        const saveFiltersBtn = document.getElementById("saveCurrentFiltersBtn");
        if (saveFiltersBtn) {
          reportActionsContainer.insertBefore(clearBtn, saveFiltersBtn);
        } else {
          reportActionsContainer.appendChild(clearBtn);
        }
      }
    }

    // Confirm save filter button
    document
      .getElementById("confirmSaveFilterBtn")
      .addEventListener("click", () => {
        this.saveFilter();
      });

    // Export Excel button
    document.getElementById("exportCsvBtn").addEventListener("click", () => {
      this.exportToExcel();
    });

    // Print report button
    document.getElementById("printReportBtn").addEventListener("click", () => {
      this.printReport();
    });

    // Show chart button
    document.getElementById("showChartBtn").addEventListener("click", () => {
      this.toggleChartView();
    });

    // Chart type radio buttons
    document.querySelectorAll('input[name="chartType"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        this.updateChart(e.target.value);
      });
    });

    // Aggregation type change
    const aggregationRadios = document.querySelectorAll(
      'input[name="aggregationType"]'
    );
    aggregationRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (this.reportData) {
          this.updateTableWithCurrentAggregation();
        }
      });
    });

    // Report type selection
    const reportTypeCards = document.querySelectorAll(".report-type-card");
    reportTypeCards.forEach((card) => {
      card.addEventListener("click", () => {
        // Remove active class from all cards
        reportTypeCards.forEach((c) => c.classList.remove("active"));
        // Add active class to clicked card
        card.classList.add("active");

        // TODO: Show/hide appropriate report sections based on selection
      });
    });
  }

  updateFilterOperators() {
    const fieldId = this.filterFieldSelect.value;
    if (!fieldId) return;

    const selectedOption =
      this.filterFieldSelect.options[this.filterFieldSelect.selectedIndex];
    const fieldType = selectedOption.dataset.fieldType;

    // Clear existing options
    this.filterOperatorSelect.innerHTML = "";

    // Add appropriate operators based on field type
    if (["text", "textarea", "email"].includes(fieldType)) {
      this.addOperatorOption("equals", "Equals");
      this.addOperatorOption("not_equals", "Not Equals");
      this.addOperatorOption("contains", "Contains");
      this.addOperatorOption("starts_with", "Starts With");
      this.addOperatorOption("ends_with", "Ends With");
      this.addOperatorOption("is_empty", "Is Empty");
      this.addOperatorOption("is_not_empty", "Is Not Empty");
    } else if (
      ["select", "radio", "checkbox", "nested-select"].includes(fieldType)
    ) {
      this.addOperatorOption("equals", "Equals");
      this.addOperatorOption("not_equals", "Not Equals");
      this.addOperatorOption("is_empty", "Is Empty");
      this.addOperatorOption("is_not_empty", "Is Not Empty");
    } else if (["number", "date"].includes(fieldType)) {
      this.addOperatorOption("equals", "Equals");
      this.addOperatorOption("not_equals", "Not Equals");
      this.addOperatorOption("greater_than", "Greater Than");
      this.addOperatorOption("less_than", "Less Than");
      this.addOperatorOption("between", "Between");
      this.addOperatorOption("is_empty", "Is Empty");
      this.addOperatorOption("is_not_empty", "Is Not Empty");
    }

    // Update filter value input based on new operator
    this.updateFilterValueInput();
  }

  addOperatorOption(value, text) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    this.filterOperatorSelect.appendChild(option);
  }

  updateFilterValueInput() {
    const operator = this.filterOperatorSelect.value;

    if (["is_empty", "is_not_empty"].includes(operator)) {
      this.filterValueContainer.style.display = "none";
    } else if (operator === "between") {
      this.filterValueContainer.style.display = "block";
      this.filterValueInput.placeholder =
        "Enter min and max values separated by comma";
    } else {
      this.filterValueContainer.style.display = "block";
      this.filterValueInput.placeholder = "Enter value";
    }
  }

  addFilter() {
    const fieldId = this.filterFieldSelect.value;
    const operator = this.filterOperatorSelect.value;

    if (!fieldId) {
      alert("Please select a field");
      return;
    }

    // Get field details
    const field = this.allFields.find((f) => f.id === fieldId);
    if (!field) return;

    let value = "";
    if (!["is_empty", "is_not_empty"].includes(operator)) {
      value = this.filterValueInput.value.trim();
      if (!value) {
        alert("Please enter a filter value");
        return;
      }
    }

    // Create filter object
    const filter = {
      id: Date.now().toString(), // Use timestamp as unique ID
      fieldId,
      fieldName: field.display_name,
      fieldType: field.field_type,
      operator,
      value,
    };

    // Add to active filters
    this.activeFilters.push(filter);

    // Update UI
    this.renderActiveFilters();

    // Sync with enhanced filter system if available
    if (this.enhancedFilterSystem) {
      this.enhancedFilterSystem.syncFilters(this.activeFilters);
    }

    // Reset filter form
    this.resetFilterForm();
  }

  renderActiveFilters() {
    const container = document.getElementById("activeFilters");
    if (!container) return;

    container.innerHTML = "";

    this.activeFilters.forEach((filter, index) => {
      const filterBadge = document.createElement("div");
      filterBadge.className = "badge bg-primary me-2 mb-2";

      let filterText = "";

      // Handle nested-select filters
      if (filter.hierarchyPath) {
        // This is a hierarchical filter with level information
        const levelName = filter.level
          ? `Level ${filter.level}`
          : `Hierarchical`;

        // Show the hierarchical path with the level indicator
        filterText = `${levelName}: ${filter.displayValue}`;
      } else if (filter.displayValue) {
        // Legacy nested-select format
        const [level1, level2] = filter.displayValue.split(",");
        filterText = level2 ? `${level1} > ${level2}` : level1;
      } else {
        // Handle other filter types
        switch (filter.operator) {
          case "equals":
            filterText = `= ${filter.value}`;
            break;
          case "not_equals":
            filterText = `≠ ${filter.value}`;
            break;
          case "contains":
            filterText = `contains "${filter.value}"`;
            break;
          case "starts_with":
            filterText = `starts with "${filter.value}"`;
            break;
          case "ends_with":
            filterText = `ends with "${filter.value}"`;
            break;
          case "greater_than":
            filterText = `> ${filter.value}`;
            break;
          case "less_than":
            filterText = `< ${filter.value}`;
            break;
          case "between":
            filterText = `between ${filter.value}`;
            break;
          case "is_empty":
            filterText = "is empty";
            break;
          case "is_not_empty":
            filterText = "is not empty";
            break;
        }
      }

      filterBadge.textContent = `${filter.fieldName} ${filterText}`;

      // Add remove button
      const removeButton = document.createElement("button");
      removeButton.className = "btn-close ms-2";
      removeButton.setAttribute("aria-label", "Remove filter");
      removeButton.onclick = () => this.removeFilter(index);
      filterBadge.appendChild(removeButton);

      container.appendChild(filterBadge);
    });
  }

  removeFilter(filterIndex) {
    // Remove the filter
    this.activeFilters.splice(filterIndex, 1);

    // Update UI
    this.renderActiveFilters();

    // Sync with enhanced filter system if available
    if (this.enhancedFilterSystem) {
      this.enhancedFilterSystem.syncFilters(this.activeFilters);
    }

    // Generate report with updated filters
    this.generateReport();
  }

  resetFilterForm() {
    // Reset filter selects
    $(this.filterFieldSelect).val("").trigger("change");
    this.filterOperatorSelect.innerHTML = "";
    this.filterValueInput.value = "";

    // Hide filter row
    document.getElementById("filterRow").style.display = "none";
  }

  loadSavedFilters() {
    // Try to load saved filters from localStorage
    const savedFilters = localStorage.getItem("savedReportFilters");
    if (savedFilters) {
      this.savedFilters = JSON.parse(savedFilters);
      this.renderSavedFilters();
    }
  }

  // Render saved filters in the UI
  renderSavedFilters() {
    const container = document.getElementById("savedFiltersContainer");
    if (!container) {
      console.error("ReportsManager: Saved filters container not found");
      return;
    }

    // Clear the container
    container.innerHTML = "";

    // If no saved filters, show empty state
    if (!this.savedFilters || this.savedFilters.length === 0) {
      container.innerHTML = '<p class="text-muted mb-0">No saved filters</p>';
      return;
    }

    // Create the saved filters list
    const filtersList = document.createElement("div");
    filtersList.className = "saved-filter-items d-flex flex-wrap";

    // Add each saved filter
    this.savedFilters.forEach((filter) => {
      try {
        // Create the filter item
        const filterItem = document.createElement("div");
        filterItem.className = "saved-filter-item";
        filterItem.setAttribute("data-filter-id", filter.id);

        // Create filter content
        const filterContent = document.createElement("div");
        filterContent.className = "d-flex align-items-center";

        // Filter name
        const filterName = document.createElement("span");
        filterName.className = "filter-name";
        filterName.textContent = filter.name;

        // Add to content
        filterContent.appendChild(filterName);

        // Actions
        const actions = document.createElement("div");
        actions.className = "saved-filter-actions ms-3";

        // Delete button
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn btn-sm btn-link text-danger p-0";
        deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
        deleteBtn.title = "Delete filter";
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();

          if (
            confirm(
              `Are you sure you want to delete the filter "${filter.name}"?`
            )
          ) {
            // Call the delete method in the EnhancedFilterSystem
            if (this.enhancedFilterSystem) {
              this.enhancedFilterSystem.deleteSavedFilter(filter.id);
            } else {
              alert("Enhanced filter system not initialized");
            }
          }
        });

        // Add buttons to actions
        actions.appendChild(deleteBtn);

        // Add click event to load filter
        filterItem.addEventListener("click", () => {
          if (this.enhancedFilterSystem) {
            this.enhancedFilterSystem.loadSavedFilter(
              filter.id,
              this.savedFilters
            );
          } else {
            alert("Enhanced filter system not initialized");
          }
        });

        // Assemble saved filter item
        filterItem.appendChild(filterContent);
        filterItem.appendChild(actions);

        // Add to list
        filtersList.appendChild(filterItem);
      } catch (error) {
        console.error(
          "ReportsManager: Error rendering saved filter:",
          error,
          filter
        );
      }
    });

    // Add list to container
    container.appendChild(filtersList);
  }

  showSaveFilterModal() {
    if (this.activeFilters.length === 0) {
      alert("No filters to save");
      return;
    }

    // Update filter list in modal
    const modalFilterList = document.getElementById("modalFilterList");
    modalFilterList.innerHTML = "";

    this.activeFilters.forEach((filter) => {
      const filterItem = document.createElement("div");
      filterItem.classList.add("mb-2");

      let operatorText = "";
      switch (filter.operator) {
        case "equals":
          operatorText = "=";
          break;
        case "not_equals":
          operatorText = "≠";
          break;
        case "contains":
          operatorText = "contains";
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
        case "is_empty":
          operatorText = "is empty";
          break;
        case "is_not_empty":
          operatorText = "is not empty";
          break;
      }

      let filterText = `${filter.fieldName} ${operatorText}`;
      if (!["is_empty", "is_not_empty"].includes(filter.operator)) {
        filterText += ` ${filter.value}`;
      }

      filterItem.textContent = filterText;
      modalFilterList.appendChild(filterItem);
    });

    // Show modal
    const modal = new bootstrap.Modal(
      document.getElementById("saveFilterModal")
    );
    modal.show();
  }

  saveFilter() {
    const filterName = document.getElementById("filterName").value.trim();
    if (!filterName) {
      alert("Please enter a name for this filter set");
      return;
    }

    // Create saved filter object
    const savedFilter = {
      id: Date.now().toString(),
      name: filterName,
      filters: [...this.activeFilters],
    };

    // Add to saved filters
    this.savedFilters.push(savedFilter);

    // Save to localStorage
    localStorage.setItem(
      "savedReportFilters",
      JSON.stringify(this.savedFilters)
    );

    // Update UI
    this.renderSavedFilters();

    // Close modal
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("saveFilterModal")
    );
    modal.hide();

    // Reset filter name input
    document.getElementById("filterName").value = "";
  }

  loadSavedFilter(filter) {
    try {
      // Parse filters if needed
      let filters = filter.filters;
      if (typeof filters === "string") {
        filters = JSON.parse(filters);
      }

      if (!Array.isArray(filters) || filters.length === 0) {
        console.warn("ReportsManager: ⚠️ No filters found in saved filter");
        return;
      }

      // SEQUENTIAL APPROACH: Add all filters to existing ones rather than replacing them
      const existingFiltersCount = this.activeFilters.length;

      // Process each filter in the saved set and add to existing ones
      filters.forEach((savedFilter) => {
        // Generate a unique ID for this filter
        const uniqueId = `rm_filter_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        // Create a proper filter object
        const newFilter = {
          id: uniqueId,
          fieldId: savedFilter.fieldId,
          fieldName: savedFilter.fieldName || savedFilter.fieldId,
          operator: savedFilter.operator,
          values: savedFilter.values || [savedFilter.value],
          displayText:
            savedFilter.displayText ||
            `${savedFilter.fieldName || savedFilter.fieldId} ${
              savedFilter.operator
            }`,
        };

        // Add to active filters (don't replace - truly sequential)
        this.activeFilters.push(newFilter);
      });

      // Update UI
      this.renderActiveFilters();

      // If EnhancedFilterSystem exists, let it know we've loaded filters,
      // but don't directly modify its filters - it will handle that itself
      if (this.enhancedFilterSystem) {
        // Let the enhanced system directly load this filter
        // This creates better synchronization since it handles the UI better

        // Find the filter in the saved filters array
        const filterId = filter.id;
        if (filterId && this.savedFilters) {
          const filterToLoad = this.savedFilters.find((f) => f.id === filterId);
          if (filterToLoad) {
            // Have the enhanced system load this filter directly
            this.enhancedFilterSystem.loadSavedFilter(
              filterId,
              this.savedFilters
            );
            return; // Let the enhanced system handle notification
          }
        }
      }

      // Show success message (only if enhancedFilterSystem didn't handle it)
      this.showToast(
        "Filter Loaded",
        `Filter "${filter.name}" added to existing filters`
      );
    } catch (error) {
      alert(`Error loading filter: ${error.message}`);
    }
  }

  generateReport() {
    try {
      const rowVariableId = this.rowVariableSelect.value;
      const columnVariableId = this.columnVariableSelect.value;

      if (!rowVariableId || !columnVariableId) {
        alert("Please select both row and column variables");
        return;
      }

      // Show loading state
      this.reportResults.style.display = "block";
      this.crossTabTable.style.display = "none";
      this.reportLoading.style.display = "flex";
      this.chartView.style.display = "none";

      // Get the selected aggregation type and validate it
      let aggregationType = document.querySelector(
        'input[name="aggregationType"]:checked'
      ).value;

      // Ensure we only use the supported aggregation types
      if (!["count", "percent_total"].includes(aggregationType)) {
        aggregationType = "count";
        document.getElementById("countAggregation").checked = true;
      }

      // Prepare request payload
      const payload = {
        rowVariableId,
        columnVariableId,
        filters: this.activeFilters,
        aggregationType: aggregationType,
      };

      // Call API to generate cross-tab report using async/await pattern
      this.executeReportQuery(payload);
    } catch (error) {
      console.error("Error initiating report generation:", error);

      // Make sure loading is hidden in case of error
      this.reportLoading.style.display = "none";

      // Only show alert if we haven't already shown a detailed error message
      if (!document.querySelector(".alert-danger")) {
        alert(
          `Failed to generate report. Please try again. (${error.message})`
        );
      }
    }
  }

  async executeReportQuery(payload) {
    try {
      // First, set the aggregation type to 'count' by default
      document.getElementById("countAggregation").checked = true;

      // Hide the aggregation type selector initially
      const aggregationTypeSelector = document.querySelector(
        ".aggregation-type-selector"
      );
      if (aggregationTypeSelector) {
        aggregationTypeSelector.style.display = "none";
      }

      // Execute the API request
      const response = await fetch("/api/reports/cross-tab", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Server error:", errorData);
        throw new Error(`Server returned ${response.status}: ${errorData}`);
      }

      const data = await response.json();

      // Save the current report configuration for save report functionality
      this.currentReportConfig = {
        rowVariableId: payload.rowVariableId,
        columnVariableId: payload.columnVariableId,
        rowVariableName:
          this.rowVariableSelect.options[this.rowVariableSelect.selectedIndex]
            .text,
        columnVariableName:
          this.columnVariableSelect.options[
            this.columnVariableSelect.selectedIndex
          ].text,
        filters: this.activeFilters,
        aggregationType: payload.aggregationType,
        metadata: data.metadata,
      };

      // Add Save Report button if it doesn't exist
      this.addSaveReportButton();

      // Check if we're dealing with nested-select fields
      const isNestedSelect =
        data.metadata?.rowField?.field_type === "nested-select";

      if (isNestedSelect) {
        // Initialize hierarchical view state (without the circular reference)
        this.hierarchicalView = {
          currentLevel: 1,
          selectedParent: null,
        };

        // Now that hierarchicalView exists, set the displayData separately
        const processedData = this.processHierarchicalData(
          data.data,
          data.rowLabels,
          data.columnLabels
        );

        this.hierarchicalView.displayData = processedData;
      }

      // Update the table with processed data
      this.updateTable(data.data, data.rowLabels, data.columnLabels);

      // Store report data
      this.reportData = data;

      // Render report table
      this.renderReportTable(data);

      // Update chart if visible
      if (this.chartView.style.display === "block") {
        this.updateChart("bar");
      }

      // Show the aggregation type selector now that the report is generated
      if (aggregationTypeSelector) {
        aggregationTypeSelector.style.display = "block";
      }

      // Make sure the "Show Chart" button is visible if it exists
      const showChartBtn = document.getElementById("showChartBtn");
      if (showChartBtn) {
        showChartBtn.style.display = "inline-block";
        // Also make sure its parent container is visible
        const parentDiv = showChartBtn.parentElement;
        if (parentDiv) {
          parentDiv.style.display = "block";
        }
      }

      // Scroll to results section with smooth animation
      setTimeout(() => {
        const resultsSection = document.getElementById("reportResults");
        if (resultsSection) {
          resultsSection.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }, 300);
    } catch (error) {
      console.error("Error generating report:", error);

      // Make sure loading is hidden in case of error
      this.reportLoading.style.display = "none";

      // Only show alert if we haven't already shown a detailed error message
      if (!document.querySelector(".alert-danger")) {
        alert(
          `Failed to generate report. Please try again. (${error.message})`
        );
      }
    }
  }

  processHierarchicalData(data, rowLabels, columnLabels) {
    // Process the data to show only the current level
    const processedData = data.map((row) => [...row]);
    const processedRowLabels = [...rowLabels];
    const processedColumnLabels = [...columnLabels];

    // Check if hierarchicalView is initialized before accessing its properties
    if (
      this.hierarchicalView &&
      this.hierarchicalView.currentLevel > 1 &&
      this.hierarchicalView.selectedParent
    ) {
      const parentIndex = rowLabels.indexOf(
        this.hierarchicalView.selectedParent
      );
      if (parentIndex !== -1) {
        // Keep only the rows and columns related to the selected parent
        const childIndices = this.getChildIndices(
          this.hierarchicalView.selectedParent
        );
        processedData.splice(0, processedData.length);
        processedRowLabels.splice(0, processedRowLabels.length);

        childIndices.forEach((index) => {
          processedData.push(data[index]);
          processedRowLabels.push(rowLabels[index]);
        });
      }
    }

    return {
      data: processedData,
      rowLabels: processedRowLabels,
      columnLabels: processedColumnLabels,
    };
  }

  getChildIndices(parentValue) {
    // Get indices of all child options for a given parent
    const indices = [];
    this.rowLabels.forEach((label, index) => {
      if (this.isChildOf(label, parentValue)) {
        indices.push(index);
      }
    });
    return indices;
  }

  isChildOf(childValue, parentValue) {
    // Check if childValue is a child of parentValue in the hierarchy
    if (!childValue || !parentValue) return false;

    const fieldOptions = this.metadata?.rowField?.options;
    if (!fieldOptions) return false;

    try {
      const parsedOptions = JSON.parse(fieldOptions);
      if (!Array.isArray(parsedOptions)) return false;

      for (const level of parsedOptions) {
        if (level.options) {
          const levelOptions =
            typeof level.options === "string"
              ? level.options.split("\n").map((line) => {
                  const [parent, children] = line
                    .split(":")
                    .map((part) => part.trim());
                  return {
                    parent,
                    children: children
                      ? children.split(",").map((child) => child.trim())
                      : [],
                  };
                })
              : level.options;

          for (const opt of levelOptions) {
            if (
              opt.parent === parentValue &&
              opt.children.includes(childValue)
            ) {
              return true;
            }
          }
        }
      }
    } catch (error) {
      console.error("Error checking hierarchy:", error);
    }
    return false;
  }

  updateTable(data, rowLabels, columnLabels) {
    const tableContainer = document.getElementById("reportTable");
    if (!tableContainer) return;

    // Clear existing table
    tableContainer.innerHTML = "";

    // Create table element
    const table = document.createElement("table");
    table.className = "table table-bordered table-striped";

    // Create header row
    const headerRow = document.createElement("tr");
    headerRow.appendChild(document.createElement("th")); // Empty cell for row labels

    // Add column headers
    columnLabels.forEach((label) => {
      const th = document.createElement("th");
      th.textContent = label;
      headerRow.appendChild(th);
    });

    // Add total column header
    const totalHeader = document.createElement("th");
    totalHeader.textContent = "Total";
    headerRow.appendChild(totalHeader);

    table.appendChild(headerRow);

    // Add data rows
    rowLabels.forEach((label, rowIndex) => {
      const tr = document.createElement("tr");

      // Add row label
      const labelCell = document.createElement("td");
      labelCell.textContent = label;
      tr.appendChild(labelCell);

      // Add data cells
      let rowTotal = 0;
      data[rowIndex].forEach((value, colIndex) => {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
        rowTotal += value;
      });

      // Add row total
      const totalCell = document.createElement("td");
      totalCell.textContent = rowTotal;
      tr.appendChild(totalCell);

      table.appendChild(tr);
    });

    // Add column totals row
    const totalsRow = document.createElement("tr");
    totalsRow.appendChild(document.createElement("td")); // Empty cell for alignment

    let grandTotal = 0;
    columnLabels.forEach((_, colIndex) => {
      const colTotal = data.reduce((sum, row) => sum + row[colIndex], 0);
      const td = document.createElement("td");
      td.textContent = colTotal;
      totalsRow.appendChild(td);
      grandTotal += colTotal;
    });

    // Add grand total
    const grandTotalCell = document.createElement("td");
    grandTotalCell.textContent = grandTotal;
    totalsRow.appendChild(grandTotalCell);

    table.appendChild(totalsRow);

    // Add the table to the container
    tableContainer.appendChild(table);
  }

  renderReportTable(data) {
    // Get the selected aggregation type
    const aggregationType = document.querySelector(
      'input[name="aggregationType"]:checked'
    ).value;

    // Add a note above the table if we're showing child values for a nested select field
    let noteHtml = "";
    if (
      this.metadata?.rowField?.field_type === "nested-select" &&
      this.activeFilters.length > 0
    ) {
      const nestedFilter = this.activeFilters.find(
        (f) => f.fieldId === this.metadata.rowField.id
      );

      if (nestedFilter) {
        const filterLevel = nestedFilter.level || 1;
        const nextLevel = filterLevel + 1;
        const fieldName = this.metadata.rowField.display_name;

        noteHtml = `
          <div class="alert alert-info mb-3">
            <i class="bi bi-info-circle"></i> 
            Showing Level ${nextLevel} values under the selected "${nestedFilter.value}" from Level ${filterLevel}.
          </div>
        `;
      }
    }

    // Clear previous table content and add the note
    this.crossTabTable.innerHTML = noteHtml;

    // Create table header
    let tableHtml = '<thead><tr><th class="row-header"></th>';

    // Add column headers
    data.columnLabels.forEach((label) => {
      tableHtml += `<th>${label}</th>`;
    });

    // Add total header
    tableHtml += '<th class="total-header">Total</th></tr></thead>';

    // Create table body
    tableHtml += "<tbody>";

    // Add data rows
    data.rowLabels.forEach((rowLabel, rowIndex) => {
      tableHtml += `<tr><td class="row-label">${rowLabel}</td>`;

      // Add data cells
      data.data[rowIndex].forEach((cellValue, colIndex) => {
        let formattedValue = cellValue;
        if (aggregationType.startsWith("percent")) {
          formattedValue = cellValue.toFixed(1) + "%";
        }
        tableHtml += `<td>${formattedValue}</td>`;
      });

      // Add row total
      let rowTotal = data.rowTotals[rowIndex];
      if (aggregationType.startsWith("percent")) {
        rowTotal = rowTotal.toFixed(1) + "%";
      }
      tableHtml += `<td class="total-cell">${rowTotal}</td></tr>`;
    });

    // Add column totals row
    tableHtml += '<tr class="total-row"><td class="total-cell">Total</td>';

    data.columnTotals.forEach((colTotal) => {
      let formattedTotal = colTotal;
      if (aggregationType.startsWith("percent")) {
        formattedTotal = colTotal.toFixed(1) + "%";
      }
      tableHtml += `<td class="total-cell">${formattedTotal}</td>`;
    });

    // Add grand total
    let grandTotal = data.grandTotal;
    if (aggregationType.startsWith("percent")) {
      // For percentage view, ensure grand total is displayed as exactly 100.0%
      // This matches the behavior in reportView.js and ensures consistency
      grandTotal = "100.0%";
    } else {
      grandTotal = data.grandTotal;
    }
    tableHtml += `<td class="total-cell">${grandTotal}</td></tr>`;

    tableHtml += "</tbody>";

    // Append table HTML to the note
    this.crossTabTable.innerHTML += tableHtml;
    this.crossTabTable.style.display = "table";
    this.reportLoading.style.display = "none";

    // Check if we need to setup nested-select filters
    this.setupNestedSelectFilters();
  }

  setupNestedSelectFilters() {
    // Check if we need to set up nested select filters
    const metadata = this.currentReportConfig?.metadata;
    if (!metadata) return;

    const { rowField, columnField } = metadata;

    // Create container for nested select filters
    let container = document.getElementById("nestedSelectFiltersContainer");

    // Store the previous selections before removing the container
    let previousSelections = {};

    if (container) {
      // If container exists, cache the current selections before rebuilding
      const filterContainers = container.querySelectorAll(
        ".nested-select-filter"
      );
      filterContainers.forEach((filterContainer) => {
        const fieldId = filterContainer.id.split("_")[1];
        const selects = filterContainer.querySelectorAll(
          ".nested-level-select"
        );

        previousSelections[fieldId] = Array.from(selects).map((select) => ({
          level: parseInt(select.dataset.level),
          value: select.value,
          disabled: select.disabled,
        }));
      });

      // Now remove the old container
      container.remove();
    }

    // Create a new container
    container = document.createElement("div");
    container.id = "nestedSelectFiltersContainer";
    container.className = "nested-select-container p-3 mb-4 bg-light rounded";

    // Add container heading
    const heading = document.createElement("h5");
    heading.className = "mb-3";
    heading.textContent = "Hierarchical Filters";
    container.appendChild(heading);

    // Keep track of whether we successfully inserted the container
    let containerInserted = false;

    // Check if row field is nested-select
    if (rowField && rowField.field_type === "nested-select") {
      this.createNestedSelectFilter(container, rowField.id, "row");
      containerInserted = true;
    }

    // Check if column field is nested-select
    if (columnField && columnField.field_type === "nested-select") {
      this.createNestedSelectFilter(container, columnField.id, "column");
      containerInserted = true;
    }

    // Always look for a location field to add as a hierarchical filter
    // regardless of whether it's in the row or column
    if (!containerInserted) {
      // Find location field in allFields
      const locationField = this.allFields.find(
        (field) =>
          field.field_type === "nested-select" &&
          (field.name.toLowerCase().includes("location") ||
            field.display_name.toLowerCase().includes("location") ||
            field.display_name.toLowerCase().includes("place") ||
            field.display_name.toLowerCase().includes("district") ||
            field.display_name.toLowerCase().includes("town") ||
            field.display_name.toLowerCase().includes("municipality") ||
            field.display_name.toLowerCase().includes("tahsil") ||
            field.display_name.toLowerCase().includes("taluka"))
      );

      if (locationField) {
        this.createNestedSelectFilter(container, locationField.id, "filter");
        containerInserted = true;
      }
    }

    // Insert container into DOM
    if (containerInserted) {
      const reportResults = document.getElementById("reportResults");
      if (reportResults && reportResults.parentElement) {
        reportResults.parentElement.insertBefore(container, reportResults);

        // Restore previous selections after a short delay to ensure DOM is ready
        setTimeout(() => {
          // Set flag to prevent infinite loops when restoring selections
          this.isRestoringSelections = true;

          try {
            Object.keys(previousSelections).forEach((fieldId) => {
              const selectionsData = previousSelections[fieldId];
              const filterContainer = document.getElementById(
                `nestedSelectFilter_${fieldId}`
              );

              if (filterContainer) {
                // Process selections in level order to ensure proper cascading
                selectionsData.sort((a, b) => a.level - b.level);

                // First pass: set all values without triggering events
                selectionsData.forEach((data) => {
                  if (data.value === "default") return;

                  const select = filterContainer.querySelector(
                    `[data-level="${data.level}"]`
                  );
                  if (select) {
                    // Check if the option exists in the select
                    let optionExists = false;
                    for (let i = 0; i < select.options.length; i++) {
                      if (select.options[i].value === data.value) {
                        optionExists = true;
                        break;
                      }
                    }

                    // If the option doesn't exist, need to add it
                    if (!optionExists && data.value !== "default") {
                      const option = document.createElement("option");
                      option.value = data.value;
                      option.textContent = data.value;
                      select.appendChild(option);
                    }

                    // Set the value without triggering change event
                    select.value = data.value;

                    // Make sure the select is enabled if it should be
                    if (!select.disabled && data.level > 1) {
                      select.disabled = false;
                    }
                  }
                });

                // Second pass: populate child options without triggering events
                selectionsData.forEach((data, index) => {
                  if (
                    data.value === "default" ||
                    index === selectionsData.length - 1
                  )
                    return;

                  const currentSelect = filterContainer.querySelector(
                    `[data-level="${data.level}"]`
                  );
                  const nextSelect = filterContainer.querySelector(
                    `[data-level="${data.level + 1}"]`
                  );

                  if (currentSelect && nextSelect && data.value !== "default") {
                    // Enable next level and populate it with child options
                    nextSelect.disabled = false;

                    const options = this.nestedSelectField?.options;
                    if (options && Array.isArray(options)) {
                      const childOptions = this.getChildOptions(
                        options,
                        data.value,
                        data.level - 1
                      );

                      if (childOptions.length > 0) {
                        // Add child options (maintaining existing ones)
                        const nextValue = selectionsData.find(
                          (d) => d.level === data.level + 1
                        )?.value;

                        // Clear existing options first
                        nextSelect.innerHTML = `<option value="default">Select ${nextSelect.previousElementSibling.textContent}</option>`;

                        // Add all child options
                        childOptions.forEach((option) => {
                          const optElement = document.createElement("option");
                          optElement.value = option;
                          optElement.textContent = option;
                          nextSelect.appendChild(optElement);
                        });

                        // If we have a next value to select, set it
                        if (nextValue && nextValue !== "default") {
                          nextSelect.value = nextValue;
                        }
                      }
                    }
                  }
                });
              }
            });

            // Apply filters without regenerating report (already happening)
            Object.keys(previousSelections).forEach((fieldId) => {
              // Only apply filter if we actually had non-default selections
              const hasSelection = previousSelections[fieldId].some(
                (data) => data.value !== "default"
              );
              if (hasSelection) {
                // Apply the filter but set a flag to prevent report regeneration
                // This is essential to avoid infinite loops of regeneration->setupFilters->regeneration
                // Use the applyHierarchicalFilter with isRestoringSelections flag set
                this.applyHierarchicalFilter(fieldId);
              }
            });
          } finally {
            // After a short delay to ensure all DOM operations complete,
            // clear the flag to allow normal filtering again
            setTimeout(() => {
              this.isRestoringSelections = false;
            }, 200);
          }
        }, 100);
      } else {
        console.error(
          "Could not find reportResults element to insert nestedSelectFiltersContainer"
        );
      }
    }
  }

  isNestedSelectField(fieldId) {
    // Convert fieldId to string for comparison if it's not already
    const fieldIdStr = String(fieldId);

    // First check in allFields
    const field = this.allFields.find((f) => String(f.id) === fieldIdStr);
    if (field && field.field_type === "nested-select") {
      return true;
    }

    // Then check in metadata
    if (this.metadata) {
      if (
        this.metadata.rowField &&
        String(this.metadata.rowField.id) === fieldIdStr &&
        this.metadata.rowField.field_type === "nested-select"
      ) {
        return true;
      }

      if (
        this.metadata.columnField &&
        String(this.metadata.columnField.id) === fieldIdStr &&
        this.metadata.columnField.field_type === "nested-select"
      ) {
        return true;
      }
    }

    return false;
  }

  createNestedSelectFilter(container, fieldId, variableType) {
    // Convert fieldId to string for comparison if it's not already
    const fieldIdStr = String(fieldId);

    // First try to find the field in this.allFields
    let field = this.allFields.find((f) => String(f.id) === fieldIdStr);

    // If not found in allFields, try to get it from metadata
    if (!field && this.metadata) {
      if (
        variableType === "row" &&
        this.metadata.rowField &&
        String(this.metadata.rowField.id) === fieldIdStr
      ) {
        field = this.metadata.rowField;
      } else if (
        variableType === "column" &&
        this.metadata.columnField &&
        String(this.metadata.columnField.id) === fieldIdStr
      ) {
        field = this.metadata.columnField;
      }
    }

    if (!field) {
      console.error(`Field not found: ${fieldId}`, {
        variableType,
        hasMetadata: !!this.metadata,
        metadataRowField: this.metadata?.rowField?.id,
        metadataColumnField: this.metadata?.columnField?.id,
        allFieldsLength: this.allFields?.length,
      });
      return;
    }

    if (field.field_type !== "nested-select") {
      console.error(
        `Field is not a nested-select field: ${fieldId} (${field.display_name}, type: ${field.field_type})`
      );
      return;
    }

    const filterContainer = document.createElement("div");
    filterContainer.className = "nested-select-filter";
    filterContainer.id = `nestedSelectFilter_${fieldId}`;

    // Title for the filter - customize based on variableType
    const title = document.createElement("h6");
    title.className = "mb-2";
    if (variableType === "row") {
      title.textContent = `${field.display_name} (Row Variable)`;
    } else if (variableType === "column") {
      title.textContent = `${field.display_name} (Column Variable)`;
    } else {
      title.textContent = `${field.display_name}`;
    }
    filterContainer.appendChild(title);

    // Add description explaining auto-filtering
    const description = document.createElement("p");
    description.className = "text-muted small mb-2";
    description.textContent =
      "Select any level to filter. Filters apply automatically as you make selections.";
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
        container: container, // Store the parent container reference
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
      col.className = "col-md-4 mb-3"; // Wider column since we're removing the apply button

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

      // Add event listener for change - use handleNestedLevelChange
      select.addEventListener("change", (e) => {
        if (this.isRestoringSelections) return; // Skip if we're just restoring selections
        this.handleNestedLevelChange(e.target, index);
      });

      col.appendChild(label);
      col.appendChild(select);
      selectContainer.appendChild(col);
    });

    // We no longer need the Apply button since filtering is automatic

    container.appendChild(filterContainer);

    // Populate options for first level with reference to the created filter container
    this.populateNestedLevelOptions(fieldId, filterContainer);
  }

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

      // Find all the level selects for this field
      const levelSelects = Array.from(
        filterContainerElem.querySelectorAll(".nested-level-select")
      );

      // Log all found level selects for debugging
      levelSelects.forEach((select, i) => {
        // Add change handler if missing
        if (!select.onchange) {
          select.addEventListener("change", (e) => {
            const level = parseInt(e.target.dataset.level, 10);
            this.handleNestedLevelChange(e.target, level);
          });
        }
      });

      // Check if we have any active filters for this field to pre-populate selections
      const activeFilter = this.activeFilters.find(
        (f) => String(f.fieldId) === String(fieldId)
      );
      if (activeFilter && activeFilter.hierarchyPath && level1Select) {
        // There's a saved filter for this field, try to restore the selections
        const hierarchyPath = activeFilter.hierarchyPath;
        if (hierarchyPath.length > 0 && hierarchyPath[0]) {
          level1Select.value = hierarchyPath[0];

          // Trigger change to cascade to child levels
          const event = new Event("change");
          level1Select.dispatchEvent(event);
        }
      }
    } catch (error) {
      console.error("Error populating level 1 options:", error);
    }
  }

  handleNestedLevelChange(selectElement, levelIndex) {
    const fieldId = selectElement.id.split("_")[1];
    const selectedValue = selectElement.value;
    const currentLevel = parseInt(selectElement.dataset.level);

    // Prevent processing during selection restoration
    if (this.isRestoringSelections) {
      return;
    }

    // Get the filter container - either from stored reference or by finding it
    const filterContainer = document.getElementById(
      `nestedSelectFilter_${fieldId}`
    );
    if (!filterContainer) {
      console.debug(
        "Nested-select filter container not found yet - this is normal during initialization"
      );
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

      // If it's the first level being reset, remove any filter for this field
      if (currentLevel === 1) {
        this.activeFilters = this.activeFilters.filter(
          (filter) => String(filter.fieldId) !== String(fieldId)
        );
        this.renderActiveFilters();
        this.generateReport();
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
        currentLevel - 1 // Adjust to 0-based index for options array
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

  // Improved hierarchical filter application to handle all levels properly
  applyHierarchicalFilter(fieldId) {
    // Prevent recursive filter application
    if (this.isApplyingFilter) {
      return;
    }

    this.isApplyingFilter = true;

    // Track if we need to regenerate the report
    let shouldRegenerateReport = true;

    try {
      const variableType = this.nestedSelectField?.variableType || "row";

      // Get the filter container
      const filterContainer = document.getElementById(
        `nestedSelectFilter_${fieldId}`
      );
      if (!filterContainer) {
        console.debug(
          "Nested-select filter container not found yet - this is normal during initialization"
        );
        this.isApplyingFilter = false;
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

      // If no selection, remove any filter for this field
      if (deepestSelectedLevel < 0 || !selectedValues[0]) {
        this.activeFilters = this.activeFilters.filter(
          (filter) => String(filter.fieldId) !== String(fieldId)
        );
        this.renderActiveFilters();

        // Only regenerate report if we're not in the middle of restoring selections
        if (!this.isRestoringSelections) {
          this.generateReport();
        }
        return;
      }

      // Create the display value (showing the hierarchical path)
      const displayValue = selectedPath.join(" > ");

      // Get the field display name from allFields or metadata
      const fieldDisplayName =
        this.allFields.find((f) => String(f.id) === String(fieldId))
          ?.display_name ||
        this.metadata?.rowField?.display_name ||
        this.metadata?.columnField?.display_name ||
        "Nested Select Field";

      // Check if we already have this exact filter applied
      const existingFilter = this.activeFilters.find(
        (f) => String(f.fieldId) === String(fieldId)
      );

      // Create a proper hierarchical filter object
      let newFilter = {
        fieldId: fieldId,
        operator: "equals",
        level: deepestSelectedLevel + 1, // Convert to 1-based level numbering for clarity
        // Include the value at the deepest selected level for filtering
        value: selectedValues[deepestSelectedLevel],
        // Include the FULL hierarchical path of all selected values
        hierarchyPath: selectedValues.filter((v) => v),
        // Add a clear display value for the UI
        displayValue: displayValue,
        fieldName: fieldDisplayName,
        // Store variable type (row or column) to handle filtering properly
        variableType: variableType,
        // Include a hash to track if we're applying the same filter multiple times
        filterHash: `${fieldId}-${
          deepestSelectedLevel + 1
        }-${selectedValues.join("-")}`,
      };

      // Only regenerate if the filter has changed
      if (
        existingFilter &&
        existingFilter.filterHash === newFilter.filterHash
      ) {
        shouldRegenerateReport = false;
      } else {
        // Remove any existing filter for this field
        this.activeFilters = this.activeFilters.filter(
          (f) => String(f.fieldId) !== String(fieldId)
        );

        // Add the new filter
        this.activeFilters.push(newFilter);
        this.renderActiveFilters();
      }

      // Generate report with updated filters only if needed
      if (shouldRegenerateReport && !this.isRestoringSelections) {
        this.generateReport();
      }
    } finally {
      this.isApplyingFilter = false;
    }
  }

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

    const result = Array.from(childOptions);
    return result;
  }

  applyNestedSelectFilter(fieldId, variableType) {
    // Get all level selects for this field using the container reference
    const options = this.nestedSelectField?.options;
    if (!options || !Array.isArray(options)) {
      console.error("Invalid options structure for field", fieldId);
      return;
    }

    // Get the filter container
    const filterContainer = document.getElementById(
      `nestedSelectFilter_${fieldId}`
    );
    if (!filterContainer) {
      console.error(
        "Could not find nested select filter container for field",
        fieldId
      );
      return;
    }

    // Query for level selects directly within this filter container
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

    // Validate that at least one level is selected
    if (deepestSelectedLevel < 0 || !selectedValues[0]) {
      alert("Please select at least one level value");
      return;
    }

    // Create the display value (showing the hierarchical path)
    const displayValue = selectedPath.join(" > ");

    // Get the field display name from allFields or metadata
    const fieldDisplayName =
      this.allFields.find((f) => String(f.id) === String(fieldId))
        ?.display_name ||
      this.metadata?.rowField?.display_name ||
      this.metadata?.columnField?.display_name ||
      "Nested Select Field";

    // Create filter object with hierarchical information
    const filter = {
      fieldId: fieldId,
      operator: "equals",
      level: deepestSelectedLevel + 1, // Convert to 1-based level numbering for clarity
      // Use the value at the deepest selected level for filtering
      value: selectedValues[deepestSelectedLevel],
      // Include all selected values and their hierarchical relationship
      hierarchyPath: selectedValues.filter((v) => v),
      displayValue: displayValue,
      fieldName: fieldDisplayName,
      variableType: variableType,
      filterHash: `${fieldId}-${deepestSelectedLevel + 1}-${selectedValues.join(
        "-"
      )}`,
    };

    // Add to active filters
    this.activeFilters.push(filter);
    this.renderActiveFilters();

    // Generate report with updated filters
    this.generateReport();
  }

  updateTableWithCurrentAggregation() {
    if (!this.reportData) return;

    // Get the selected aggregation type
    const aggregationType = document.querySelector(
      'input[name="aggregationType"]:checked'
    ).value;

    // If trying to use removed aggregation types, reset to count
    if (!["count", "percent_total"].includes(aggregationType)) {
      document.getElementById("countAggregation").checked = true;
      return this.updateTableWithCurrentAggregation();
    }

    // Re-render the report with the current aggregation type
    this.renderReportTable(this.reportData);

    // Update chart if visible
    if (this.chartView.style.display !== "none") {
      // Get the selected chart type
      const selectedChart = document.querySelector(
        'input[name="chartType"]:checked'
      );
      const chartType = selectedChart ? selectedChart.value : "bar";
      this.updateChart(chartType);
    }
  }

  toggleChartView() {
    if (this.chartView.style.display === "none") {
      // Add smooth transition to show chart view
      this.chartView.style.opacity = "0";
      this.chartView.style.display = "block";

      // Scroll to chart view with smooth animation
      setTimeout(() => {
        this.chartView.style.opacity = "1";
        this.chartView.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);

      document.getElementById("showChartBtn").innerHTML =
        '<i class="bi bi-table"></i> Show Table';

      // Initialize chart with selected type
      const selectedChart = document.querySelector(
        'input[name="chartType"]:checked'
      );
      const chartType = selectedChart ? selectedChart.value : "bar";
      this.updateChart(chartType);
    } else {
      // Add smooth transition to hide chart view
      this.chartView.style.opacity = "0";

      setTimeout(() => {
        this.chartView.style.display = "none";
      }, 300);

      document.getElementById("showChartBtn").innerHTML =
        '<i class="bi bi-bar-chart"></i> Show Chart';
    }
  }

  updateChart(chartType) {
    if (!this.reportData) return;

    // Destroy existing chart if any
    if (this.chart) {
      this.chart.destroy();
    }

    const ctx = this.reportChart.getContext("2d");

    // Update radio button selection
    const radioInput = document.getElementById(`${chartType}ChartInput`);
    if (radioInput) {
      radioInput.checked = true;
    }

    // Create chart based on type
    if (chartType === "bar") {
      this.createBarChart(ctx);
    } else if (chartType === "pie") {
      this.createPieChart(ctx);
    } else if (chartType === "heatmap") {
      this.createHeatmap(ctx);
    }
  }

  createBarChart(ctx) {
    const data = this.reportData;
    const aggregationType = document.querySelector(
      'input[name="aggregationType"]:checked'
    ).value;

    // Create datasets
    const datasets = data.columnLabels.map((label, colIndex) => {
      return {
        label: label,
        data: data.rowLabels.map(
          (_, rowIndex) => data.data[rowIndex][colIndex]
        ),
        backgroundColor: this.getChartColor(colIndex),
      };
    });

    this.chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: data.rowLabels,
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: aggregationType === "count" ? "Count" : "Percentage (%)",
            },
          },
          x: {
            title: {
              display: true,
              text: "Categories",
            },
          },
        },
      },
    });
  }

  createPieChart(ctx) {
    const data = this.reportData;

    // For pie chart, we'll use row totals
    this.chart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: data.rowLabels,
        datasets: [
          {
            data: data.rowTotals,
            backgroundColor: data.rowLabels.map((_, index) =>
              this.getChartColor(index)
            ),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
          },
        },
      },
    });
  }

  createHeatmap(ctx) {
    const data = this.reportData;

    // For a heatmap, we need to transform the data into a format the matrix chart can use
    const heatmapData = [];

    // Create the heatmap dataset
    for (let rowIndex = 0; rowIndex < data.rowLabels.length; rowIndex++) {
      for (let colIndex = 0; colIndex < data.columnLabels.length; colIndex++) {
        heatmapData.push({
          x: colIndex,
          y: rowIndex,
          v: data.data[rowIndex][colIndex], // The value will determine the color intensity
        });
      }
    }

    // Find the max value to normalize the color scale
    const maxValue = Math.max(...heatmapData.map((d) => d.v));

    // Helper function to get a color from a gradient based on value
    function getGradientColor(value) {
      // Use a value between 0-1
      const normalizedValue = value / maxValue;

      // Define gradient colors from low to high values
      const colors = [
        { point: 0, color: "rgba(240, 249, 255, 0.6)" }, // Very light blue for lowest values
        { point: 0.25, color: "rgba(188, 224, 253, 0.7)" }, // Light blue
        { point: 0.5, color: "rgba(144, 202, 249, 0.8)" }, // Medium blue
        { point: 0.75, color: "rgba(66, 165, 245, 0.9)" }, // Darker blue
        { point: 1, color: "rgba(21, 101, 192, 1)" }, // Deepest blue for highest values
      ];

      // Find the two colors to interpolate between
      let startColor, endColor, startPoint, endPoint;

      for (let i = 0; i < colors.length - 1; i++) {
        if (
          normalizedValue >= colors[i].point &&
          normalizedValue <= colors[i + 1].point
        ) {
          startColor = colors[i].color;
          endColor = colors[i + 1].color;
          startPoint = colors[i].point;
          endPoint = colors[i + 1].point;
          break;
        }
      }

      // If value is exactly 0, return the first color
      if (value === 0) return colors[0].color;

      // If we didn't find a range (shouldn't happen), use the highest color
      if (!startColor) return colors[colors.length - 1].color;

      // Calculate how far between the two points our value is (0-1)
      const rangePosition =
        (normalizedValue - startPoint) / (endPoint - startPoint);

      // Parse the rgba colors to interpolate between them
      const startRgba = startColor.match(
        /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/
      );
      const endRgba = endColor.match(
        /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/
      );

      if (!startRgba || !endRgba) return startColor;

      // Interpolate between the two colors
      const r = Math.round(
        parseInt(startRgba[1]) +
          rangePosition * (parseInt(endRgba[1]) - parseInt(startRgba[1]))
      );
      const g = Math.round(
        parseInt(startRgba[2]) +
          rangePosition * (parseInt(endRgba[2]) - parseInt(startRgba[2]))
      );
      const b = Math.round(
        parseInt(startRgba[3]) +
          rangePosition * (parseInt(endRgba[3]) - parseInt(startRgba[3]))
      );
      const a =
        parseFloat(startRgba[4]) +
        rangePosition * (parseFloat(endRgba[4]) - parseFloat(startRgba[4]));

      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    // Create the chart
    this.chart = new Chart(ctx, {
      type: "matrix",
      data: {
        datasets: [
          {
            label: "Heatmap",
            data: heatmapData,
            backgroundColor(context) {
              const value = context.dataset.data[context.dataIndex].v;
              return getGradientColor(value);
            },
            borderColor: "#ffffff",
            borderWidth: 1,
            width: ({ chart }) =>
              (chart.chartArea || {}).width / data.columnLabels.length - 2,
            height: ({ chart }) =>
              (chart.chartArea || {}).height / data.rowLabels.length - 2,
            hoverBackgroundColor: function (context) {
              const value = context.dataset.data[context.dataIndex].v;
              // For hover, use a slightly more intense color
              if (value === 0) return "rgba(240, 249, 255, 0.8)";
              return getGradientColor(value * 1.1); // Make it slightly more intense
            },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              title() {
                return "";
              },
              label(context) {
                const item = context.dataset.data[context.dataIndex];
                return [
                  `Row: ${data.rowLabels[item.y]}`,
                  `Column: ${data.columnLabels[item.x]}`,
                  `Value: ${item.v}`,
                ];
              },
            },
          },
          legend: {
            display: false,
          },
        },
        scales: {
          x: {
            type: "category",
            labels: data.columnLabels,
            offset: true,
            ticks: {
              display: true,
            },
            grid: {
              display: false,
            },
          },
          y: {
            type: "category",
            labels: data.rowLabels,
            offset: true,
            reverse: true,
            ticks: {
              display: true,
            },
            grid: {
              display: false,
            },
          },
        },
      },
    });
  }

  getChartColor(index) {
    const colors = [
      "#4e73df",
      "#1cc88a",
      "#36b9cc",
      "#f6c23e",
      "#e74a3b",
      "#6f42c1",
      "#5a5c69",
      "#2e59d9",
      "#17a673",
      "#2c9faf",
    ];
    return colors[index % colors.length];
  }

  exportToExcel() {
    if (!this.reportData) return;

    const data = this.reportData;
    const aggregationType = document.querySelector(
      'input[name="aggregationType"]:checked'
    ).value;

    // Get variable names using multiple methods
    let rowVarName = "Not selected";
    let colVarName = "Not selected";

    // Method 1: Try to find from allFields
    const rowField = this.allFields.find(
      (f) => f.id === this.rowVariableSelect.value
    );
    const colField = this.allFields.find(
      (f) => f.id === this.columnVariableSelect.value
    );

    // Method 2: Try to get from select element text
    if (!rowField) {
      const rowSelectedOption =
        this.rowVariableSelect.options[this.rowVariableSelect.selectedIndex];
      if (rowSelectedOption && rowSelectedOption.text) {
        rowVarName = rowSelectedOption.text;
      }
    } else {
      rowVarName = rowField.display_name;
    }

    if (!colField) {
      const colSelectedOption =
        this.columnVariableSelect.options[
          this.columnVariableSelect.selectedIndex
        ];
      if (colSelectedOption && colSelectedOption.text) {
        colVarName = colSelectedOption.text;
      }
    } else {
      colVarName = colField.display_name;
    }

    // Method 3: Try from currentReportConfig
    if (
      rowVarName === "Not selected" &&
      this.currentReportConfig &&
      this.currentReportConfig.rowVariableName
    ) {
      rowVarName = this.currentReportConfig.rowVariableName;
    }

    if (
      colVarName === "Not selected" &&
      this.currentReportConfig &&
      this.currentReportConfig.columnVariableName
    ) {
      colVarName = this.currentReportConfig.columnVariableName;
    }

    try {
      // Determine if table is wide and needs special handling
      const isWideTable = data.columnLabels.length > 5;
      const isVeryWideTable = data.columnLabels.length > 10;

      // Create a new workbook
      const workbook = new ExcelJS.Workbook();

      // Set workbook properties
      workbook.creator = "DDRC Management System";
      workbook.lastModifiedBy = "DDRC Management System";
      workbook.created = new Date();
      workbook.modified = new Date();
      workbook.properties.date1904 = false;

      // Add a worksheet
      const worksheet = workbook.addWorksheet("Report", {
        pageSetup: {
          paperSize: 9, // A4
          orientation: isWideTable ? "landscape" : "portrait",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          margins: {
            left: 0.7,
            right: 0.7,
            top: 0.75,
            bottom: 0.75,
            header: 0.3,
            footer: 0.3,
          },
        },
      });

      // Define styles
      // -------------

      // Header styles
      const h1Style = {
        font: {
          size: isWideTable ? 20 : 22,
          bold: true,
          color: { argb: "1A56DB" },
        },
        alignment: { horizontal: "center", vertical: "middle", wrapText: true },
      };

      const h2Style = {
        font: {
          size: isWideTable ? 12 : 14,
          bold: false,
          color: { argb: "333333" },
        },
        alignment: { horizontal: "center", vertical: "middle", wrapText: true },
      };

      const h3Style = {
        font: {
          size: isWideTable ? 18 : 20,
          bold: true,
          color: { argb: "333333" },
        },
        alignment: { horizontal: "center", vertical: "middle", wrapText: true },
        border: {
          bottom: { style: "medium", color: { argb: "CCCCCC" } },
        },
      };

      // Metadata style
      const metaLabelStyle = {
        font: {
          size: isWideTable ? 11 : 12,
          bold: true,
          color: { argb: "333333" },
        },
        alignment: { horizontal: "left", vertical: "middle" },
      };

      const metaValueStyle = {
        font: { size: isWideTable ? 11 : 12, bold: false },
        alignment: { horizontal: "left", vertical: "middle" },
      };

      // Background for metadata section
      const metaBgStyle = {
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "F8F9FA" },
        },
        border: {
          top: { style: "thin", color: { argb: "E9ECEF" } },
          bottom: { style: "thin", color: { argb: "E9ECEF" } },
          left: { style: "thin", color: { argb: "E9ECEF" } },
          right: { style: "thin", color: { argb: "E9ECEF" } },
        },
      };

      // Table header style
      const tableHeaderStyle = {
        font: {
          size: isVeryWideTable ? 10 : isWideTable ? 11 : 12,
          bold: true,
          color: { argb: "FFFFFF" },
        },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "1A56DB" },
        },
        border: {
          top: { style: "medium", color: { argb: "0A2A6B" } },
          bottom: { style: "medium", color: { argb: "0A2A6B" } },
          left: { style: "medium", color: { argb: "0A2A6B" } },
          right: { style: "medium", color: { argb: "0A2A6B" } },
        },
        alignment: { horizontal: "center", vertical: "middle", wrapText: true },
      };

      // Row header style
      const rowHeaderStyle = {
        font: { size: isVeryWideTable ? 9 : isWideTable ? 10 : 11, bold: true },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "F2F2F2" },
        },
        border: {
          top: { style: "thin", color: { argb: "DDDDDD" } },
          bottom: { style: "thin", color: { argb: "DDDDDD" } },
          left: { style: "medium", color: { argb: "0A2A6B" } },
          right: { style: "medium", color: { argb: "0A2A6B" } },
        },
        alignment: { horizontal: "left", vertical: "middle", wrapText: true },
      };

      // Data cell style
      const dataCellStyle = {
        font: { size: isVeryWideTable ? 9 : isWideTable ? 10 : 11 },
        border: {
          top: { style: "thin", color: { argb: "DDDDDD" } },
          bottom: { style: "thin", color: { argb: "DDDDDD" } },
          left: { style: "thin", color: { argb: "DDDDDD" } },
          right: { style: "thin", color: { argb: "DDDDDD" } },
        },
        alignment: { horizontal: "center", vertical: "middle", wrapText: true },
      };

      // Zebra striping style (for odd rows)
      const zebraStyle = {
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "F9FAFB" },
        },
      };

      // Zero value style (for full table view)
      const zeroValueStyle = {
        font: { italic: true, color: { argb: "AAAAAA" } },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "F9F9F9" },
        },
      };

      // Totals row style
      const totalsRowStyle = {
        font: {
          size: isVeryWideTable ? 9 : isWideTable ? 10 : 11,
          bold: true,
        },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "E2E8F0" },
        },
        border: {
          top: { style: "medium", color: { argb: "0A2A6B" } },
          bottom: { style: "medium", color: { argb: "0A2A6B" } },
          left: { style: "medium", color: { argb: "0A2A6B" } },
          right: { style: "medium", color: { argb: "0A2A6B" } },
        },
        alignment: { horizontal: "center", vertical: "middle", wrapText: true },
      };

      // Totals column style
      const totalsColStyle = {
        font: {
          size: isVeryWideTable ? 9 : isWideTable ? 10 : 11,
          bold: true,
        },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "E2E8F0" },
        },
        border: {
          top: { style: "thin", color: { argb: "DDDDDD" } },
          bottom: { style: "thin", color: { argb: "DDDDDD" } },
          left: { style: "medium", color: { argb: "0A2A6B" } },
          right: { style: "medium", color: { argb: "0A2A6B" } },
        },
        alignment: { horizontal: "center", vertical: "middle", wrapText: true },
      };

      // Grand total cell style
      const grandTotalStyle = {
        font: {
          size: isVeryWideTable ? 9 : isWideTable ? 10 : 11,
          bold: true,
          color: { argb: "1A56DB" },
        },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "D4E6FF" },
        },
        border: {
          top: { style: "medium", color: { argb: "0A2A6B" } },
          bottom: { style: "medium", color: { argb: "0A2A6B" } },
          left: { style: "medium", color: { argb: "0A2A6B" } },
          right: { style: "medium", color: { argb: "0A2A6B" } },
        },
        alignment: { horizontal: "center", vertical: "middle", wrapText: true },
      };

      // Filter styles
      const filterSectionStyle = {
        font: {
          size: isWideTable ? 11 : 12,
          bold: true,
          color: { argb: "1A56DB" },
        },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "F0F7FF" },
        },
        border: {
          left: { style: "medium", color: { argb: "1A56DB" } },
        },
        alignment: { horizontal: "left", vertical: "middle" },
      };

      const filterItemStyle = {
        font: { size: isWideTable ? 10 : 11, color: { argb: "333333" } },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "F0F7FF" },
        },
        alignment: { horizontal: "left", vertical: "middle", indent: 1 },
      };

      // Footer text style
      const footerStyle = {
        font: {
          size: isWideTable ? 10 : 11,
          italic: true,
          color: { argb: "6C757D" },
        },
        alignment: { horizontal: "center", vertical: "middle" },
      };

      // SIMPLIFIED HEADER - NO LOGOS
      // ---------------------------

      // Row 1: Main title (blue text)
      const titleRow = worksheet.addRow([
        "District Disability Rehabilitation Centre, Mumbai",
      ]);
      titleRow.height = 30;

      // Row 2: Department info
      const deptRow = worksheet.addRow([
        "Department of Empowerment of Persons with Disabilities",
      ]);
      deptRow.height = 20;

      // Row 3: Ministry info
      const ministryRow = worksheet.addRow([
        "Ministry of Social Justice and Empowerment, Govt. of India",
      ]);
      ministryRow.height = 20;

      // Row 4: Empty spacing
      worksheet.addRow([""]);

      // Row 5: Report title
      let reportTitle = "Cross-Tabulation Analysis Report";
      if (this.currentReportConfig && this.currentReportConfig.name) {
        reportTitle = this.currentReportConfig.name;
      }
      const reportTitleRow = worksheet.addRow([reportTitle]);
      reportTitleRow.height = 30;

      // Row 6: Empty spacing
      worksheet.addRow([""]);

      // Report metadata section
      // ---------------------
      const metaStartRow = worksheet.rowCount + 1;

      worksheet.addRow(["Report Name:", reportTitle]);
      worksheet.addRow(["Row Variable:", rowVarName]);
      worksheet.addRow(["Column Variable:", colVarName]);
      worksheet.addRow([
        "Aggregation Type:",
        aggregationType === "count" ? "Count" : "% of Total",
      ]);
      worksheet.addRow(["Date Generated:", new Date().toLocaleString()]);

      const metaEndRow = worksheet.rowCount;

      // Spacing
      worksheet.addRow([""]);

      // Add filters if any
      let filterStartRow = 0;
      let filterEndRow = 0;

      if (this.activeFilters.length > 0) {
        filterStartRow = worksheet.rowCount;
        worksheet.addRow(["Applied Filters"]);

        this.activeFilters.forEach((filter) => {
          const fieldInfo = this.allFields.find((f) => f.id === filter.fieldId);
          const fieldName = fieldInfo
            ? fieldInfo.display_name
            : filter.fieldName || filter.fieldId;
          let operatorText = this.getOperatorDisplayText(filter.operator);

          worksheet.addRow([`• ${fieldName} ${operatorText} ${filter.value}`]);
        });

        filterEndRow = worksheet.rowCount;

        // Spacing after filters
        worksheet.addRow([""]);
      }

      // Print instructions for wide tables (for Excel)
      if (isWideTable) {
        worksheet.addRow([
          "Print Instructions: This report contains a wide table.",
        ]);
        worksheet.addRow([
          "• The worksheet is set to landscape orientation to fit the table better.",
        ]);
        worksheet.addRow([
          '• When printing, select "Fit to page" in the Excel print settings.',
        ]);
        worksheet.addRow([""]);
      }

      // Function to calculate optimal column width based on content
      const calculateOptimalColumnWidths = (data, columnLabels, rowLabels) => {
        // Track width for each column (in characters)
        const contentLengths = new Array(columnLabels.length + 2).fill(0); // +2 for row labels column and totals column

        // Check column headers length - first cell is empty so start with column labels
        columnLabels.forEach((label, i) => {
          // Column index is +1 because first column is for row labels
          contentLengths[i + 1] = Math.max(
            contentLengths[i + 1],
            String(label).length
          );
        });

        // "Total" header for the last column
        contentLengths[contentLengths.length - 1] = Math.max(
          contentLengths[contentLengths.length - 1],
          5
        ); // "Total"

        // Check row labels length (first column)
        rowLabels.forEach((label) => {
          contentLengths[0] = Math.max(contentLengths[0], String(label).length);
        });

        // Check data cell content length
        rowLabels.forEach((_, rowIndex) => {
          data.columnLabels.forEach((_, colIndex) => {
            const cellValue = data.data[rowIndex][colIndex];
            // Convert to string and get length - column index +1 because first column is for row labels
            contentLengths[colIndex + 1] = Math.max(
              contentLengths[colIndex + 1],
              String(cellValue).length
            );
          });

          // Consider row total length
          const rowTotal = data.rowTotals[rowIndex];
          contentLengths[contentLengths.length - 1] = Math.max(
            contentLengths[contentLengths.length - 1],
            String(rowTotal).length
          );
        });

        // Consider column totals row
        data.columnTotals.forEach((total, colIndex) => {
          // Column index +1 because first column is for row labels
          contentLengths[colIndex + 1] = Math.max(
            contentLengths[colIndex + 1],
            String(total).length
          );
        });

        // Consider filters, metadata, etc. for first column width
        if (filterStartRow > 0) {
          contentLengths[0] = Math.max(contentLengths[0], 30); // Account for filter labels
        }

        // Convert character lengths to column widths
        // Apply some constraints based on column type and table size
        return contentLengths.map((length, i) => {
          // Apply adaptations based on column position
          if (i === 0) {
            // Row header column - wider with minimum width
            return Math.max(length + 3, isWideTable ? 20 : 30);
          } else if (i === contentLengths.length - 1) {
            // Totals column - medium width
            return Math.max(length + 3, isWideTable ? 12 : 15);
          } else {
            // Data columns - adaptive width with min/max constraints
            return Math.max(
              Math.min(length + 3, isVeryWideTable ? 20 : 25), // Cap max width
              isVeryWideTable ? 8 : 10 // Minimum width
            );
          }
        });
      };

      // Create table header row
      // ----------------------
      const headerCells = [""];
      data.columnLabels.forEach((label) => {
        headerCells.push(label); // Don't truncate labels, we'll handle with wrapping
      });
      headerCells.push("Total");

      const tableHeaderRow = worksheet.addRow(headerCells);
      tableHeaderRow.height = 25;

      // Add data rows
      // -----------
      const dataRows = [];
      data.rowLabels.forEach((rowLabel, rowIndex) => {
        const row = [rowLabel]; // Don't truncate row labels, we'll handle with wrapping

        data.columnLabels.forEach((_, colIndex) => {
          let value = data.data[rowIndex][colIndex];
          if (aggregationType !== "count") {
            value = parseFloat(value.toFixed(1));
          }
          row.push(value);
        });

        // Add row total
        let rowTotal = data.rowTotals[rowIndex];
        if (aggregationType !== "count") {
          rowTotal = parseFloat(rowTotal.toFixed(1));
        }
        row.push(rowTotal);

        const dataRow = worksheet.addRow(row);
        // Increase row height for better readability with wrapped text
        dataRow.height = isVeryWideTable ? 18 : 20;
        dataRows.push(dataRow);
      });

      // Add totals row
      const totalRowData = ["Total"];
      data.columnTotals.forEach((total) => {
        let formattedTotal = total;
        if (aggregationType !== "count") {
          formattedTotal = parseFloat(formattedTotal.toFixed(1));
        }
        totalRowData.push(formattedTotal);
      });

      // Add grand total
      let grandTotal = data.grandTotal;
      if (aggregationType !== "count") {
        grandTotal = 100; // Set to exactly 100 for percentage
      }
      totalRowData.push(grandTotal);

      const totalsRow = worksheet.addRow(totalRowData);
      totalsRow.height = 25;

      // Add footer information
      worksheet.addRow([""]);
      const footerRow = worksheet.addRow([
        `Report generated from DDRC Management System on ${new Date().toLocaleString()}`,
      ]);

      // Apply styles to cells
      // -------------------
      const lastColumn = data.columnLabels.length + 2; // +2 for row label column and totals column

      // Style the main title (row 1)
      worksheet.mergeCells(1, 1, 1, lastColumn);
      titleRow.eachCell((cell) => {
        cell.font = {
          size: 22,
          bold: true,
          color: { argb: "1A56DB" },
        };
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
        };
      });

      // Style the department row (row 2)
      worksheet.mergeCells(2, 1, 2, lastColumn);
      deptRow.eachCell((cell) => {
        cell.font = { size: 12, color: { argb: "333333" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      // Style the ministry row (row 3)
      worksheet.mergeCells(3, 1, 3, lastColumn);
      ministryRow.eachCell((cell) => {
        cell.font = { size: 12, color: { argb: "333333" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      // Style report title (row 5)
      worksheet.mergeCells(5, 1, 5, lastColumn);
      reportTitleRow.eachCell((cell) => {
        cell.font = { size: 18, bold: true, color: { argb: "333333" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          bottom: { style: "medium", color: { argb: "CCCCCC" } },
        };
      });

      // Style metadata section
      for (let r = metaStartRow; r <= metaEndRow; r++) {
        // Apply background to entire metadata section
        for (let c = 1; c <= lastColumn; c++) {
          const cell = worksheet.getCell(r, c);
          Object.assign(cell, metaBgStyle);
        }

        // Style labels and values
        const labelCell = worksheet.getCell(r, 1);
        const valueCell = worksheet.getCell(r, 2);

        Object.assign(labelCell, metaLabelStyle);
        Object.assign(valueCell, metaValueStyle);

        // Merge the value cells
        if (worksheet.getCell(r, 2).value) {
          worksheet.mergeCells(r, 2, r, lastColumn);
        }
      }

      // Style filters section if present
      if (filterStartRow > 0) {
        // Style filter header
        const filterHeaderCell = worksheet.getCell(filterStartRow, 1);
        Object.assign(filterHeaderCell, filterSectionStyle);
        worksheet.mergeCells(filterStartRow, 1, filterStartRow, lastColumn);

        // Style filter items
        for (let r = filterStartRow + 1; r <= filterEndRow; r++) {
          const filterItemCell = worksheet.getCell(r, 1);
          Object.assign(filterItemCell, filterItemStyle);
          worksheet.mergeCells(r, 1, r, lastColumn);
        }
      }

      // Style table header row
      tableHeaderRow.eachCell((cell, colNumber) => {
        Object.assign(cell, tableHeaderStyle);
        // Enable text wrapping for all header cells
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
      });

      // Style data rows
      dataRows.forEach((row, rowIndex) => {
        // Style row header (first cell)
        const firstCell = row.getCell(1);
        Object.assign(firstCell, rowHeaderStyle);
        // Enable text wrapping for row headers
        firstCell.alignment = {
          horizontal: "left",
          vertical: "middle",
          wrapText: true,
        };

        // Style data cells
        for (let col = 2; col <= data.columnLabels.length + 1; col++) {
          const cell = row.getCell(col);
          Object.assign(cell, dataCellStyle);
          // Enable text wrapping for all data cells
          cell.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
          };

          // Apply zebra striping
          if (rowIndex % 2 !== 0) {
            Object.assign(cell, zebraStyle);
          }

          // Format percentages
          if (aggregationType !== "count") {
            cell.numFmt = '0.0"%"';
          }
        }

        // Style totals column (last cell)
        const totalCell = row.getCell(lastColumn);
        Object.assign(totalCell, totalsColStyle);
        // Enable text wrapping for totals column
        totalCell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };

        // Format percentage for totals column
        if (aggregationType !== "count") {
          totalCell.numFmt = '0.0"%"';
        }
      });

      // Style totals row
      totalsRow.eachCell((cell, colNumber) => {
        if (colNumber === 1) {
          // "Total" text cell
          Object.assign(cell, totalsRowStyle);
        } else if (colNumber === lastColumn) {
          // Grand total cell
          Object.assign(cell, grandTotalStyle);
          if (aggregationType !== "count") {
            cell.numFmt = '0.0"%"';
          }
        } else {
          // Column totals
          Object.assign(cell, totalsRowStyle);
          if (aggregationType !== "count") {
            cell.numFmt = '0.0"%"';
          }
        }
        // Enable text wrapping for all totals row cells
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
      });

      // Style footer
      worksheet.mergeCells(
        worksheet.rowCount,
        1,
        worksheet.rowCount,
        lastColumn
      );
      footerRow.eachCell((cell) => {
        Object.assign(cell, footerStyle);
      });

      // Calculate and set optimal column widths
      const columnWidths = calculateOptimalColumnWidths(
        data,
        data.columnLabels,
        data.rowLabels
      );

      // Apply the calculated column widths
      worksheet.columns.forEach((column, index) => {
        if (index < columnWidths.length) {
          column.width = columnWidths[index];
        }
      });

      // Generate Excel file and download
      const fileName = `DDRC_Report_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;

      // Generate and save the Excel file
      workbook.xlsx
        .writeBuffer()
        .then((buffer) => {
          const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
          saveAs(blob, fileName);
          this.showToast(
            "Export successful",
            `Report exported as ${fileName}`,
            "success"
          );
        })
        .catch((error) => {
          console.error("Error generating Excel buffer:", error);
          alert(`Error generating Excel file: ${error.message}`);
        });
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      alert(`Failed to export to Excel: ${error.message}`);
    }
  }

  // For backward compatibility
  exportToCsv() {
    // Call the new Excel export function instead
    this.exportToExcel();
  }

  // Helper method to get display text for operators
  getOperatorDisplayText(operator) {
    switch (operator) {
      case "equals":
        return "=";
      case "not_equals":
        return "≠";
      case "contains":
        return "contains";
      case "starts_with":
        return "starts with";
      case "ends_with":
        return "ends with";
      case "greater_than":
        return ">";
      case "less_than":
        return "<";
      case "between":
        return "between";
      case "is_empty":
        return "is empty";
      case "is_not_empty":
        return "is not empty";
      default:
        return operator;
    }
  }

  printReport() {
    if (!this.reportData) return;

    // Create a print-friendly version of the report
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>DDRC - Cross-Tabulation Report</title>
          <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px;
              color: #333;
            }
            
            /* Header Styles */
            .report-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding-bottom: 20px;
              border-bottom: 2px solid #ddd;
              margin-bottom: 25px;
            }
            
            .header-logo-left {
              width: 80px;
              height: auto;
            }
            
            .header-logo-right {
              width: 120px;
              height: auto;
            }
            
            .header-text {
              text-align: center;
              flex-grow: 1;
              padding: 0 15px;
            }
            
            .header-text h1 {
              font-size: 22px;
              margin-bottom: 5px;
              color: #1a56db;
              font-weight: 600;
            }
            
            .header-text p {
              margin: 0;
              font-size: 14px;
              line-height: 1.3;
            }
            
            /* Report Styles */
            .report-title {
              text-align: center;
              margin: 25px 0 15px;
              color: #333;
              font-weight: 600;
              font-size: 20px;
            }
            
            .report-meta {
              background-color: #f8f9fa;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 20px;
              border: 1px solid #e9ecef;
            }
            
            .report-meta p {
              margin-bottom: 5px;
            }
            
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 20px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            
            th, td { 
              border: 1px solid #ddd; 
              padding: 8px; 
              text-align: left;
            }
            
            th { 
              background-color: #f2f2f2;
              font-weight: 600;
            }
            
            .total-row, .total-col { 
              font-weight: bold; 
              background-color: #f9f9f9;
            }
            
            .filters { 
              margin-bottom: 20px;
              background-color: #f0f7ff;
              border-radius: 6px;
              padding: 12px 15px;
              border-left: 3px solid #1a56db;
            }
            
            .filter-item { 
              margin-bottom: 5px;
              display: flex;
              align-items: center;
            }
            
            .filter-item:before {
              content: "•";
              margin-right: 8px;
              color: #1a56db;
            }
            
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
              .report-header { margin-bottom: 15px; }
              table { box-shadow: none; }
              .filters { background-color: #f9f9f9; }
            }
            
            .generation-info {
              font-size: 12px;
              color: #6c757d;
              text-align: center;
              margin-top: 30px;
              padding-top: 10px;
              border-top: 1px solid #eee;
            }
          </style>
        </head>
        <body>
          <!-- DDRC Header -->
          <div class="report-header">
            <img src="/images/emblem.png" alt="Government of India Emblem" class="header-logo-left" />
            <div class="header-text">
              <h1>District Disability Rehabilitation Centre, Mumbai</h1>
              <p>Department of Empowerment of Persons with Disabilities,</p>
              <p>Ministry of Social Justice and Empowerment, Govt. of India</p>
            </div>
            <img src="/images/ddrc-logo.png" alt="DDRC Logo" class="header-logo-right" />
          </div>
          
          <h2 class="report-title">Cross-Tabulation Analysis Report</h2>
    `);

    // Try to get field information from multiple sources
    let rowVarName = "Not selected";
    let colVarName = "Not selected";

    // Method 1: Try to find field info from allFields
    const rowField = this.allFields.find(
      (f) => f.id === this.rowVariableSelect.value
    );

    const colField = this.allFields.find(
      (f) => f.id === this.columnVariableSelect.value
    );

    // Method 2: Try to get directly from the select elements' selected options
    if (!rowField) {
      const rowSelectedOption =
        this.rowVariableSelect.options[this.rowVariableSelect.selectedIndex];
      if (rowSelectedOption && rowSelectedOption.text) {
        rowVarName = rowSelectedOption.text;
      }
    } else {
      rowVarName = rowField.display_name;
    }

    if (!colField) {
      const colSelectedOption =
        this.columnVariableSelect.options[
          this.columnVariableSelect.selectedIndex
        ];
      if (colSelectedOption && colSelectedOption.text) {
        colVarName = colSelectedOption.text;
      }
    } else {
      colVarName = colField.display_name;
    }

    // Method 3: As a last resort, check if we have metadata from the current report
    if (
      rowVarName === "Not selected" &&
      this.currentReportConfig &&
      this.currentReportConfig.rowVariableName
    ) {
      rowVarName = this.currentReportConfig.rowVariableName;
    }

    if (
      colVarName === "Not selected" &&
      this.currentReportConfig &&
      this.currentReportConfig.columnVariableName
    ) {
      colVarName = this.currentReportConfig.columnVariableName;
    }

    printWindow.document.write(`
      <div class="report-meta">
        <p><strong>Row Variable:</strong> ${rowVarName}</p>
        <p><strong>Column Variable:</strong> ${colVarName}</p>
        <p><strong>Aggregation Type:</strong> ${
          document.querySelector('input[name="aggregationType"]:checked')
            .nextElementSibling.textContent
        }</p>
        <p><strong>Date Generated:</strong> ${new Date().toLocaleString()}</p>
      </div>
    `);

    // Add filters if any
    if (this.activeFilters.length > 0) {
      printWindow.document.write(
        '<div class="filters"><h4 style="margin-top:0;">Applied Filters</h4>'
      );
      this.activeFilters.forEach((filter) => {
        const fieldInfo = this.allFields.find((f) => f.id === filter.fieldId);
        const fieldName = fieldInfo ? fieldInfo.display_name : filter.fieldId;

        let operatorText = this.getOperatorDisplayText(filter.operator);
        let filterValue = filter.value;

        // Format the filter display for better readability
        printWindow.document.write(
          `<div class="filter-item">${fieldName} <strong>${operatorText}</strong> ${filterValue}</div>`
        );
      });
      printWindow.document.write("</div>");
    }

    // Add the table
    printWindow.document.write('<table class="table table-bordered">');

    // Add table header
    printWindow.document.write("<thead><tr><th></th>");
    this.reportData.columnLabels.forEach((label) => {
      printWindow.document.write(`<th>${label}</th>`);
    });
    printWindow.document.write('<th class="total-col">Total</th></tr></thead>');

    // Add table body
    printWindow.document.write("<tbody>");

    const aggregationType = document.querySelector(
      'input[name="aggregationType"]:checked'
    ).value;
    this.reportData.rowLabels.forEach((rowLabel, rowIndex) => {
      printWindow.document.write(`<tr><td><strong>${rowLabel}</strong></td>`);

      this.reportData.columnLabels.forEach((_, colIndex) => {
        let cellValue = this.reportData.data[rowIndex][colIndex];
        if (aggregationType !== "count") {
          cellValue = `${cellValue.toFixed(1)}%`;
        }
        printWindow.document.write(`<td>${cellValue}</td>`);
      });

      let rowTotal = this.reportData.rowTotals[rowIndex];
      if (aggregationType !== "count") {
        rowTotal = `${rowTotal.toFixed(1)}%`;
      }
      printWindow.document.write(`<td class="total-col">${rowTotal}</td></tr>`);
    });

    // Add totals row
    printWindow.document.write(
      '<tr class="total-row"><td><strong>Total</strong></td>'
    );
    this.reportData.columnTotals.forEach((total) => {
      let formattedTotal = total;
      if (aggregationType !== "count") {
        formattedTotal = `${formattedTotal.toFixed(1)}%`;
      }
      printWindow.document.write(`<td>${formattedTotal}</td>`);
    });

    let grandTotal = this.reportData.grandTotal;
    if (aggregationType !== "count") {
      grandTotal = "100.0%";
    }
    printWindow.document.write(
      `<td class="total-cell">${grandTotal}</td></tr>`
    );

    printWindow.document.write("</tbody></table>");

    // Add generation info
    printWindow.document.write(`
      <div class="generation-info">
        This report was generated from the DDRC Management System on ${new Date().toLocaleString()}
      </div>
    `);

    // Add print button
    printWindow.document.write(`
      <div class="no-print" style="text-align: center; margin-top: 30px;">
        <button class="btn btn-primary" onclick="window.print()">
          <i class="bi bi-printer"></i> Print Report
        </button>
        <button class="btn btn-secondary ms-2" onclick="window.close()">
          <i class="bi bi-x"></i> Close
        </button>
      </div>
    `);

    printWindow.document.write("</body></html>");
    printWindow.document.close();
  }

  resetAllFilters() {
    // Clear all active filters
    this.activeFilters = [];
    this.renderActiveFilters();

    // Sync with enhanced filter system if available
    if (this.enhancedFilterSystem) {
      this.enhancedFilterSystem.syncFilters(this.activeFilters);
    }

    // Reset all nested select filters if they exist
    const filterContainers = document.querySelectorAll(".nested-select-filter");
    filterContainers.forEach((container) => {
      const selects = container.querySelectorAll(".nested-level-select");

      // Reset and disable all selects except the first one
      selects.forEach((select, index) => {
        // Reset to default value
        select.value = "default";

        // Keep only the default option for all but the first level
        if (index > 0) {
          select.innerHTML = `<option value="default">Select ${select.previousElementSibling.textContent}</option>`;
          select.disabled = true;
        }
      });
    });

    // Regenerate the report without filters
    this.generateReport();
  }

  // Initialize the enhanced filter system
  initEnhancedFilterSystem() {
    // Check if EnhancedFilterSystem is loaded and available
    if (typeof EnhancedFilterSystem === "function") {
      try {
        // Verify that we have form fields before initializing
        if (!this.allFields || this.allFields.length === 0) {
          console.warn(
            "Cannot initialize EnhancedFilterSystem: Form fields are not loaded yet"
          );
          return;
        }

        // Create a new instance of EnhancedFilterSystem
        this.enhancedFilterSystem =
          window.enhancedFilterSystem || new EnhancedFilterSystem();

        // Set fields in the enhanced filter system
        if (this.allFields.length > 0) {
          this.enhancedFilterSystem.setFields(this.allFields);
        }

        // Sync any existing active filters
        if (this.activeFilters.length > 0) {
          this.enhancedFilterSystem.setFilters(this.activeFilters);
        }

        // Add a helper method to the ReportsManager to set filters
        this.setFilters = (filters) => {
          this.activeFilters = filters;
          this.renderActiveFilters();
        };

        // Ensure the enhanced filter field is visible and any select2 styling is reset
        setTimeout(() => {
          const filterField = document.getElementById("enhanced-filterField");
          if (filterField) {
            // Forcibly remove any select2 that might be interfering
            try {
              if ($.fn.select2 && $(filterField).data("select2")) {
                $(filterField).select2("destroy");
              }
            } catch (error) {
              console.warn("Error removing select2:", error);
            }

            // Ensure the dropdown is visible
            filterField.style.display = "block";
            filterField.style.visibility = "visible";
            filterField.style.opacity = "1";

            // If available, call the visibility check method
            if (
              this.enhancedFilterSystem &&
              this.enhancedFilterSystem.ensureFilterVisibility
            ) {
              this.enhancedFilterSystem.ensureFilterVisibility();
            }
          }
        }, 500);
      } catch (error) {
        console.error("Error initializing Enhanced Filter System:", error);
      }
    } else {
      console.warn(
        "EnhancedFilterSystem class not found. Enhanced filtering will not be available."
      );
    }
  }

  // Load saved filters for this user
  async loadSavedFilters() {
    try {
      // Check if we have authentication
      if (!AuthManager.isAuthenticated()) {
        console.warn("ReportsManager: Not authenticated, cannot load filters");
        return;
      }

      // Get the user ID to log for debugging
      const userId = AuthManager.getUserId();
      if (!userId) {
        console.warn("ReportsManager: No user ID found");
        return;
      }

      // Make the API request to get saved filters
      const response = await fetch("/api/reports/filters", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AuthManager.getToken()}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `ReportsManager: Error loading filters (${response.status}):`,
          errorText
        );
        throw new Error(`Failed to load filters: ${response.statusText}`);
      }

      // Parse the response
      const savedFilters = await response.json();

      // Store the filters
      this.savedFilters = savedFilters;

      // Update UI
      this.renderSavedFilters();

      // If EnhancedFilterSystem exists, sync the filters there too
      if (this.enhancedFilterSystem) {
        // Let the enhanced system know we have these filters
        this.enhancedFilterSystem.savedFilters = savedFilters;
        // Ask it to render them as well
        this.enhancedFilterSystem.renderSavedFilters(savedFilters);
      } else {
      }

      // Also save to localStorage as a backup
      try {
        localStorage.setItem("savedFilters", JSON.stringify(savedFilters));
      } catch (e) {
        console.warn("ReportsManager: Could not save to localStorage:", e);
      }

      return savedFilters;
    } catch (error) {
      console.error("ReportsManager: Error loading saved filters:", error);

      // Try to load from localStorage as a fallback
      try {
        const storedFilters = localStorage.getItem("savedFilters");
        if (storedFilters) {
          const parsedFilters = JSON.parse(storedFilters);
          this.savedFilters = parsedFilters;
          this.renderSavedFilters();

          // Sync with EnhancedFilterSystem if available
          if (this.enhancedFilterSystem) {
            this.enhancedFilterSystem.savedFilters = parsedFilters;
            this.enhancedFilterSystem.renderSavedFilters(parsedFilters);
          }

          return parsedFilters;
        }
      } catch (localStorageError) {
        console.error(
          "ReportsManager: Error loading from localStorage:",
          localStorageError
        );
      }

      // If all else fails, set to empty array
      this.savedFilters = [];
      return [];
    }
  }

  // Function to create the Saved Reports section
  createSavedReportsSection() {
    // Add a Saved Reports section right after the report type container and before the cross tab report
    if (!document.getElementById("savedReportsSection")) {
      const savedReportsSection = document.createElement("div");
      savedReportsSection.id = "savedReportsSection";
      savedReportsSection.className = "report-card mb-4 w-100";
      savedReportsSection.style.maxWidth = "100%";
      savedReportsSection.innerHTML = `
        <div class="report-header d-flex justify-content-between align-items-center px-4 py-3" style="background: linear-gradient(to right, #f8f9fa, #f1f5f9);">
          <div>
            <h3 class="mb-1 d-flex align-items-center">
              Saved Reports
            </h3>
            <p class="text-muted mb-0">Your previously saved report configurations, organized by category</p>
          </div>
          <div class="d-flex align-items-center">
            <div class="input-group search-container me-2">
              <span class="input-group-text bg-white border-0">
                <i class="bi bi-search text-muted"></i>
              </span>
              <input type="text" class="form-control border-0" id="reportSearchInput" placeholder="Search reports...">
              <button class="btn btn-outline-secondary border-0" type="button" id="clearSearchBtn">
                <i class="bi bi-x"></i>
              </button>
            </div>
            <button id="refreshSavedReportsBtn" class="btn btn-outline-primary d-flex align-items-center">
              <i class="bi bi-arrow-clockwise me-1"></i> 
              <span class="d-none d-sm-inline">Refresh</span>
            </button>
          </div>
        </div>
        <div class="report-body px-4 py-3">
          <div id="savedReportsContainer" class="w-100">
            <div class="skeleton-loader">
              <div class="skeleton-header"></div>
              <div class="skeleton-row"></div>
              <div class="skeleton-row"></div>
              <div class="skeleton-row"></div>
            </div>
          </div>
        </div>
      `;

      // Insert after report type container (before cross tab report)
      const reportTypeContainer =
        document
          .querySelector(".report-card[data-report-type]")
          ?.closest(".report-card") || document.querySelector(".report-card");
      const crossTabReport = document.getElementById("crossTabReport");

      if (reportTypeContainer && crossTabReport) {
        reportTypeContainer.parentNode.insertBefore(
          savedReportsSection,
          crossTabReport
        );
      } else if (crossTabReport) {
        crossTabReport.parentNode.insertBefore(
          savedReportsSection,
          crossTabReport
        );
      } else {
        console.error(
          "Could not find proper location to insert saved reports section"
        );
        const variableSelectionRow = document.querySelector(".row.mb-3");
        if (variableSelectionRow) {
          variableSelectionRow.parentNode.insertBefore(
            savedReportsSection,
            variableSelectionRow
          );
        }
      }

      // Add event listener for the refresh button
      document
        .getElementById("refreshSavedReportsBtn")
        .addEventListener("click", () => {
          this.loadSavedReports();
        });

      // Add event listener for the search input
      document
        .getElementById("reportSearchInput")
        .addEventListener("input", (e) => {
          this.filterReportsBySearch(e.target.value);
        });

      // Add event listener for clear search button
      document
        .getElementById("clearSearchBtn")
        .addEventListener("click", () => {
          document.getElementById("reportSearchInput").value = "";
          this.filterReportsBySearch("");
        });
    }

    // Add styles for skeletons and other new UI elements
    if (!document.getElementById("saved-reports-skeleton-style")) {
      const style = document.createElement("style");
      style.id = "saved-reports-skeleton-style";
      style.textContent = `
        #savedReportsSection {
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
        }
        
        .report-icon-bg {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          background: linear-gradient(135deg, #eef2ff, #e0e7ff);
          box-shadow: 0 2px 6px rgba(26, 35, 126, 0.15);
        }
        
        .report-icon-bg i {
          font-size: 1.2rem;
        }
        
        .search-container {
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
          border: 1px solid #e2e8f0;
        }
        
        .search-container .input-group-text {
          border: none;
        }
        
        #reportSearchInput {
          border: none;
          font-size: 0.9rem;
          box-shadow: none;
        }
        
        #reportSearchInput:focus {
          box-shadow: none;
        }
        
        #clearSearchBtn {
          border: none;
          background-color: #fff;
        }
        
        #clearSearchBtn:hover {
          color: #dc3545;
        }
        
          .skeleton-loader {
            width: 100%;
            padding: 20px;
          }
        
          .skeleton-header {
            height: 40px;
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
          border-radius: 8px;
            margin-bottom: 20px;
          }
        
          .skeleton-row {
            height: 120px;
            background: linear-gradient(90deg, #f5f5f5 25%, #e8e8e8 50%, #f5f5f5 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
          border-radius: 12px;
            margin-bottom: 20px;
          }
        
          @keyframes shimmer {
            0% {
              background-position: -200% 0;
            }
            100% {
              background-position: 200% 0;
            }
          }
        
          .report-category-section.hidden {
            display: none !important;
          }
        
          .saved-report-card.filtered {
            display: none !important;
          }
        
        @media (max-width: 768px) {
          .report-header {
            flex-direction: column;
            align-items: flex-start !important;
          }
          
          .report-header > div:last-child {
            margin-top: 1rem;
            width: 100%;
          }
          
          .search-container {
            width: 100%;
          }
          
          #refreshSavedReportsBtn {
            margin-top: 0.5rem;
            width: 100%;
            justify-content: center;
          }
          
          .search-container {
            margin-right: 0 !important;
          }
          }
        `;
      document.head.appendChild(style);
    }

    // Load saved reports
    this.loadSavedReports();
  }

  // Filter reports based on search input
  filterReportsBySearch(searchText) {
    if (!searchText || searchText.trim() === "") {
      // Hide all reports when search is empty
      document
        .querySelectorAll(".report-category-section")
        .forEach((section) => {
          section.classList.remove("hidden");
        });
      document.querySelectorAll(".saved-report-card").forEach((card) => {
        card.classList.remove("filtered");
      });
      document.querySelectorAll(".category-items").forEach((items) => {
        items.style.display = "none"; // Keep all collapsed when clearing search
      });
      document.querySelectorAll(".category-collapse-btn i").forEach((icon) => {
        icon.className = "bi bi-chevron-down"; // Update all icons to down
      });
      document.querySelectorAll(".category-divider").forEach((divider) => {
        divider.style.display = "none"; // Hide all dividers when collapsing
      });
      return;
    }

    searchText = searchText.toLowerCase().trim();

    // First, hide all cards that don't match
    document.querySelectorAll(".saved-report-card").forEach((card) => {
      const reportTitle =
        card.querySelector(".card-title")?.textContent.toLowerCase() || "";
      const matchesSearch = reportTitle.includes(searchText);
      card.classList.toggle("filtered", !matchesSearch);
    });

    // Then, show categories that have visible cards and expand them
    document.querySelectorAll(".report-category-section").forEach((section) => {
      const hasVisibleCards =
        section.querySelectorAll(".saved-report-card:not(.filtered)").length >
        0;
      section.classList.toggle("hidden", !hasVisibleCards);

      if (hasVisibleCards) {
        const categoryName = section
          .querySelector(".category-collapse-btn")
          .getAttribute("data-category");
        const categoryItems = section.querySelector(
          `.category-items[data-category="${categoryName}"]`
        );
        const collapseBtn = section.querySelector(".category-collapse-btn");
        const divider = section.querySelector(".category-divider");

        // Show the category items
        categoryItems.style.display = "flex";
        collapseBtn.querySelector("i").className = "bi bi-chevron-up";
        divider.style.display = "block"; // Show divider when expanded by search
      } else {
        // Category is hidden, make sure divider is hidden too
        const divider = section.querySelector(".category-divider");
        if (divider) {
          divider.style.display = "none";
        }
      }
    });
  }

  createSavedReportCard(report) {
    const card = document.createElement("div");
    card.className = "saved-report-card";
    card.dataset.reportId = report.id;

    // Create card content
    let dateText = "";
    try {
      const date = new Date(report.updated_at || report.created_at);
      dateText = date.toLocaleString();
    } catch (error) {
      console.warn("Could not parse date:", error);
      dateText = "Date unknown";
    }

    card.innerHTML = `
        <div class="card-header">
            <h5 class="card-title">${this.escapeHtml(report.name)}</h5>
        </div>
        <div class="card-body">
            <div class="card-text">
                <p class="report-timestamp">
                    <i class="bi bi-clock"></i> ${dateText}
                </p>
            </div>
            <div class="btn-group card-actions">
                <button class="btn btn-sm btn-primary load-report-btn" data-id="${
                  report.id
                }">
                    <i class="bi bi-arrow-clockwise"></i> Load Report
                </button>
                <button class="btn btn-sm btn-info view-report-btn" data-id="${
                  report.id
                }">
                    <i class="bi bi-fullscreen"></i> View
                </button>
                <button class="btn btn-sm btn-danger delete-report-btn" data-id="${
                  report.id
                }">
                    <i class="bi bi-trash"></i> Delete
                </button>
            </div>
        </div>
    `;

    // Add event listeners
    card.querySelector(".load-report-btn").addEventListener("click", () => {
      this.handleLoadReport(report.id);
    });

    card.querySelector(".view-report-btn").addEventListener("click", () => {
      window.location.href = `/admin/reports/view/index.html?id=${report.id}`;
    });

    card.querySelector(".delete-report-btn").addEventListener("click", () => {
      this.handleDeleteReport(report.id);
    });

    return card;
  }
}

// Initialize reports manager when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Create a global instance of ReportsManager
  window.ReportsManager = new ReportsManager();

  // Add flags to prevent infinite loops
  window.ReportsManager.isApplyingFilter = false;
  window.ReportsManager.isRestoringSelections = false;
});
