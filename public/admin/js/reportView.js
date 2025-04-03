// Register the matrix controller for Chart.js (needed for heatmap)
class MatrixController extends Chart.DatasetController {
  static id = "matrix";
  static defaults = {
    dataElementType: "point",
    borderWidth: 1,
    spacing: 1,
    showValue: false,
    color: Chart.defaults.color,
    valueFont: {
      family: Chart.defaults.font.family,
      size: Chart.defaults.font.size,
    },
  };

  initialize() {
    this.enableOptionSharing = true;
    super.initialize();
  }

  parseObjectData(meta, data, start, count) {
    const xScale = this.getIndexScale();
    const yScale = this.getValueScale();
    const dataset = this.getDataset();
    const parsed = [];
    let i, ilen, item, obj;
    for (i = 0, ilen = count; i < ilen; ++i) {
      const index = i + start;
      obj = data[index];
      item = {};
      item[xScale.axis] = xScale.parse(obj.x, index);
      item[yScale.axis] = yScale.parse(obj.y, index);
      item.v = obj.v;
      parsed.push(item);
    }
    return parsed;
  }

  updateElements(elements, start, count, mode) {
    const reset = mode === "reset";
    const dataset = this.getDataset();
    const xScale = this.getIndexScale();
    const yScale = this.getValueScale();
    const firstOpts = this.resolveDataElementOptions(start, mode);
    const sharedOptions = this.getSharedOptions(firstOpts);
    const includeOptions = this.includeOptions(mode, sharedOptions);
    const spacing = dataset.spacing || 0;

    const xAxis = xScale.axis;
    const yAxis = yScale.axis;

    // Parse width and height
    const getWidth = (index) => {
      const meta = this._cachedMeta;
      let size;
      if (meta.type === "matrix") {
        const w =
          typeof dataset.width === "function"
            ? dataset.width({ chart: this.chart, dataIndex: index, dataset })
            : dataset.width;
        size = w;
      }
      return size !== null && size !== undefined
        ? size
        : xScale.getPixelForTick(1) - xScale.getPixelForTick(0) - spacing * 2;
    };

    const getHeight = (index) => {
      const meta = this._cachedMeta;
      let size;
      if (meta.type === "matrix") {
        const h =
          typeof dataset.height === "function"
            ? dataset.height({ chart: this.chart, dataIndex: index, dataset })
            : dataset.height;
        size = h;
      }
      return size !== null && size !== undefined
        ? size
        : yScale.getPixelForTick(1) - yScale.getPixelForTick(0) - spacing * 2;
    };

    for (let i = 0; i < count; i++) {
      const index = start + i;
      const parsed = this.getParsed(index);
      const x = xScale.getPixelForValue(parsed[xAxis], index);
      const y = yScale.getPixelForValue(parsed[yAxis], index);
      const w = getWidth(index);
      const h = getHeight(index);

      const properties = {
        x: reset ? x : x - w / 2,
        y: reset ? y : y - h / 2,
        width: w,
        height: h,
      };

      if (includeOptions) {
        properties.options =
          sharedOptions || this.resolveDataElementOptions(index, mode);
      }

      this.updateElement(elements[i], index, properties, mode);
    }

    this.updateSharedOptions(sharedOptions, mode, firstOpts);
  }

  draw() {
    const ctx = this.chart.ctx;
    const elements = this._cachedMeta.data || [];
    const dataset = this.getDataset();

    for (let i = 0, ilen = elements.length; i < ilen; ++i) {
      const point = elements[i];
      const { x, y, width, height } = point.getProps([
        "x",
        "y",
        "width",
        "height",
      ]);
      const options = point.options || {};
      const radius = options.borderRadius || 0;

      ctx.save();

      // Set background color
      ctx.fillStyle = options.backgroundColor;

      // Draw rounded rectangle
      if (radius > 0) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(
          x + width,
          y + height,
          x + width - radius,
          y + height
        );
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(x, y, width, height);
      }

      // Draw border if needed
      if (options.borderWidth) {
        ctx.strokeStyle = options.borderColor;
        ctx.lineWidth = options.borderWidth;

        if (radius > 0) {
          ctx.beginPath();
          ctx.moveTo(x + radius, y);
          ctx.lineTo(x + width - radius, y);
          ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
          ctx.lineTo(x + width, y + height - radius);
          ctx.quadraticCurveTo(
            x + width,
            y + height,
            x + width - radius,
            y + height
          );
          ctx.lineTo(x + radius, y + height);
          ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
          ctx.lineTo(x, y + radius);
          ctx.quadraticCurveTo(x, y, x + radius, y);
          ctx.closePath();
          ctx.stroke();
        } else {
          ctx.strokeRect(x, y, width, height);
        }
      }

      // Draw text value if showValue is true
      if (dataset.showValue) {
        const parsed = this.getParsed(i);
        const value = parsed.v;

        ctx.fillStyle = dataset.color || options.borderColor;
        ctx.font = `${dataset.valueFont?.size || 12}px ${
          dataset.valueFont?.family || "Arial"
        }`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(value, x + width / 2, y + height / 2);
      }

      ctx.restore();
    }
  }
}

Chart.register(MatrixController);

class ReportView {
  constructor() {
    // Cache DOM elements
    this.reportTitle = document.getElementById("reportTitle");
    this.reportDescription = document.getElementById("reportDescription");
    this.reportMetadata = document.getElementById("reportMetadata");
    this.crossTabTable = document.getElementById("crossTabTable");
    this.reportLoading = document.getElementById("reportLoading");
    this.fullTableBadge = document.getElementById("fullTableBadge");
    this.toggleFullTableView = document.getElementById("toggleFullTableView");
    this.reportChart = document.getElementById("reportChart");
    this.appliedFiltersContainer = document.getElementById(
      "appliedFiltersContainer"
    );
    this.loadingOverlay = document.getElementById("loadingOverlay");

    // Initialize state
    this.reportId = null;
    this.reportData = null;
    this.lastReportData = null;
    this.allFields = [];
    this.allRowOptions = [];
    this.allColumnOptions = [];
    this.showFullTableView = false;
    this.hierarchicalFiltersInitialized = false;

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

      // Get report ID from URL parameters
      this.reportId = this.getReportIdFromUrl();
      if (!this.reportId) {
        this.showError(
          "No report ID specified. Please select a report from the reports page."
        );
        this.hideLoading();
        return;
      }

      // Load all form fields for hierarchical filters
      try {
        const fieldsResponse = await fetch("/api/reports/form/fields", {
          headers: {
            Authorization: `Bearer ${AuthManager.getAuthToken()}`,
          },
        });

        if (fieldsResponse.ok) {
          this.allFields = await fieldsResponse.json();
        } else {
          console.error("Failed to load form fields");
          this.allFields = [];
        }
      } catch (fieldsError) {
        console.error("Error loading form fields:", fieldsError);
        this.allFields = [];
      }

      // Load report data
      await this.loadReportData();

      // Set up event listeners
      this.setupEventListeners();
    } catch (error) {
      console.error("Initialization error:", error);
      this.showError(
        "An error occurred during initialization. Please try again."
      );
      this.hideLoading();
    }
  }

  getReportIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("id");
  }

  async loadReportData() {
    try {
      this.showLoading();

      // Fetch the report data - FIX: Use the correct API endpoint
      const response = await fetch(`/api/reports/saved/${this.reportId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AuthManager.getAuthToken()}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Server returned ${response.status}: ${errorData}`);
      }

      const report = await response.json();

      // Store report data
      this.reportData = report;

      // Update UI with report data
      this.updateReportUI(report);

      // Check if aggregation type is set in the config, default to "count"
      if (!this.reportData.config.aggregationType) {
        this.reportData.config.aggregationType = "count";
      }

      // Set the correct radio button for aggregation type
      const aggregationRadio = document.querySelector(
        `input[name="aggregationType"][value="${this.reportData.config.aggregationType}"]`
      );

      if (aggregationRadio) {
        aggregationRadio.checked = true;
      } else {
        // Default to count if no matching radio button
        document.getElementById("countAggregation").checked = true;
      }

      // Generate the report visualization
      await this.generateReportVisualization();

      this.hideLoading();
    } catch (error) {
      console.error("Error loading report data:", error);
      this.hideLoading();
      this.showError(`Failed to load report: ${error.message}`);
    }
  }

  updateReportUI(report) {
    // Update title and description
    this.reportTitle.textContent = report.name;
    this.reportDescription.textContent = `Last updated: ${new Date(
      report.updated_at
    ).toLocaleString()}`;

    // Update metadata section
    this.updateMetadata(report);

    // Update filters section
    this.updateFiltersSection(report);
  }

  updateMetadata(report) {
    const config = report.config;

    this.reportMetadata.innerHTML = "";

    // Add row variable info
    const rowVarItem = document.createElement("div");
    rowVarItem.className = "metadata-item";
    rowVarItem.innerHTML = `
      <span class="metadata-label">Row Variable</span>
      <span class="metadata-value">${
        config.rowVariableName || "Not selected"
      }</span>
    `;
    this.reportMetadata.appendChild(rowVarItem);

    // Add column variable info
    const colVarItem = document.createElement("div");
    colVarItem.className = "metadata-item";
    colVarItem.innerHTML = `
      <span class="metadata-label">Column Variable</span>
      <span class="metadata-value">${
        config.columnVariableName || "Not selected"
      }</span>
    `;
    this.reportMetadata.appendChild(colVarItem);

    // Add aggregation type info
    const aggTypeItem = document.createElement("div");
    aggTypeItem.className = "metadata-item";
    aggTypeItem.innerHTML = `
      <span class="metadata-label">Aggregation Type</span>
      <span class="metadata-value">${this.formatAggregationType(
        config.aggregationType
      )}</span>
    `;
    this.reportMetadata.appendChild(aggTypeItem);

    // Add filter count info
    const filterCountItem = document.createElement("div");
    filterCountItem.className = "metadata-item";
    filterCountItem.innerHTML = `
      <span class="metadata-label">Applied Filters</span>
      <span class="metadata-value">${config.filters?.length || 0} filters</span>
    `;
    this.reportMetadata.appendChild(filterCountItem);

    // Add created date info
    const createdItem = document.createElement("div");
    createdItem.className = "metadata-item";
    createdItem.innerHTML = `
      <span class="metadata-label">Created</span>
      <span class="metadata-value">${new Date(
        report.created_at
      ).toLocaleDateString()}</span>
    `;
    this.reportMetadata.appendChild(createdItem);
  }

  updateFiltersSection(report) {
    const filters = report.config.filters || [];

    if (filters.length === 0) {
      this.appliedFiltersContainer.innerHTML =
        '<p class="text-muted">No filters applied to this report.</p>';
      return;
    }

    this.appliedFiltersContainer.innerHTML = "";

    filters.forEach((filter, index) => {
      const filterTag = document.createElement("div");
      filterTag.className = "filter-tag";

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

      // Format the value based on operator
      let valueText = "";
      if (["is_empty", "is_not_empty"].includes(filter.operator)) {
        valueText = "";
      } else if (Array.isArray(filter.values)) {
        valueText = filter.values.join(", ");
      } else {
        valueText = filter.value || "";
      }

      filterTag.innerHTML = `
        <span class="filter-tag-name">${filter.fieldName}</span>
        <span class="filter-tag-operator">${operatorText}</span>
        <span class="filter-tag-value">${valueText}</span>
      `;

      this.appliedFiltersContainer.appendChild(filterTag);
    });
  }

  async generateReportVisualization() {
    try {
      // Set the correct aggregation type
      if (this.reportData.config.aggregationType) {
        const aggregationRadio = document.querySelector(
          `input[name="aggregationType"][value="${this.reportData.config.aggregationType}"]`
        );
        if (aggregationRadio) {
          aggregationRadio.checked = true;
        }
      }

      // Call the report generation API
      const payload = {
        rowVariableId: this.reportData.config.rowVariableId,
        columnVariableId: this.reportData.config.columnVariableId,
        filters: this.reportData.config.filters || [],
        aggregationType: this.reportData.config.aggregationType || "count",
      };

      // If full table view is enabled, request all options
      if (this.showFullTableView) {
        payload.showAllOptions = true;
      }

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

      // Store the fetched data for reference
      this.lastReportData = data;

      // Extract all potential options from the metadata if available
      if (this.showFullTableView && data.metadata) {
        try {
          // Try to extract row variable options from metadata
          if (data.metadata.rowField && data.metadata.rowField.options) {
            let rowOptions;
            try {
              // Options might be stored as a JSON string
              rowOptions = JSON.parse(data.metadata.rowField.options);
            } catch (e) {
              console.warn("Could not parse row options as JSON:", e);
            }

            if (Array.isArray(rowOptions)) {
              this.allRowOptions = rowOptions;
            }
          }

          // Try to extract column variable options from metadata
          if (data.metadata.columnField && data.metadata.columnField.options) {
            let columnOptions;
            try {
              // Options might be stored as a JSON string or as an object with an options property
              const parsedOptions = JSON.parse(
                data.metadata.columnField.options
              );
              if (
                parsedOptions.options &&
                Array.isArray(parsedOptions.options)
              ) {
                columnOptions = parsedOptions.options;
              } else if (Array.isArray(parsedOptions)) {
                columnOptions = parsedOptions;
              }
            } catch (e) {
              console.warn("Could not parse column options as JSON:", e);
            }

            if (Array.isArray(columnOptions)) {
              this.allColumnOptions = columnOptions;
            }
          }

          // If we couldn't extract from metadata, fall back to using known options
          if (!this.allRowOptions.length || !this.allColumnOptions.length) {
            await this.fetchAllVariableOptions();
          }
        } catch (error) {
          console.warn("Failed to extract options from metadata:", error);
          // Fall back to our other methods
          await this.fetchAllVariableOptions();
        }
      }

      // Render the data as is - we'll process for full view if needed
      let processedData = data;

      // If full view is enabled and we have additional options to add
      if (this.showFullTableView) {
        // Check if we have any row or column options that aren't in the data already
        let hasAdditionalOptions = false;

        if (this.allRowOptions && this.allRowOptions.length > 0) {
          const existingRowLabels = new Set(data.rowLabels);
          for (const option of this.allRowOptions) {
            if (!existingRowLabels.has(option)) {
              hasAdditionalOptions = true;
              break;
            }
          }
        }

        if (
          !hasAdditionalOptions &&
          this.allColumnOptions &&
          this.allColumnOptions.length > 0
        ) {
          const existingColumnLabels = new Set(data.columnLabels);
          for (const option of this.allColumnOptions) {
            if (!existingColumnLabels.has(option)) {
              hasAdditionalOptions = true;
              break;
            }
          }
        }

        // Only process if we actually have additional options to add
        if (hasAdditionalOptions) {
          processedData = this.processDataForFullTableView(data);
        }
      }

      // Render table with the data
      this.renderReportTable(processedData);

      // Set up nested select filters (only once after initial data load)
      if (!this.hierarchicalFiltersInitialized) {
        this.setupNestedSelectFilters();
        this.hierarchicalFiltersInitialized = true;
      }

      // Initialize chart
      this.initializeChart(processedData);
    } catch (error) {
      console.error("Error generating report visualization:", error);
      this.showError(
        `Failed to generate report visualization: ${error.message}`
      );
    }
  }

  async fetchAllVariableOptions() {
    try {
      // First try to extract options from metadata in the current report data
      if (this.lastReportData && this.lastReportData.metadata) {
        // Extract row options from metadata
        if (
          this.lastReportData.metadata.rowField &&
          this.lastReportData.metadata.rowField.options
        ) {
          try {
            let rowOptions;
            const rowOptionsStr = this.lastReportData.metadata.rowField.options;

            // Handle different formats of options data
            if (typeof rowOptionsStr === "string") {
              if (
                rowOptionsStr.startsWith("[") ||
                rowOptionsStr.startsWith("{")
              ) {
                // Try to parse JSON
                try {
                  const parsed = JSON.parse(rowOptionsStr);
                  if (Array.isArray(parsed)) {
                    rowOptions = parsed;
                  } else if (parsed.options && Array.isArray(parsed.options)) {
                    rowOptions = parsed.options;
                  }
                } catch (e) {
                  console.warn("Error parsing row options JSON:", e);
                }
              }

              // If JSON parsing failed or wasn't applicable, try other formats
              if (!rowOptions) {
                // Try line-break separated format
                rowOptions = rowOptionsStr
                  .split(/[\n,]/)
                  .map((o) => o.trim())
                  .filter((o) => o);
              }
            } else if (Array.isArray(rowOptionsStr)) {
              rowOptions = rowOptionsStr;
            }

            if (rowOptions && rowOptions.length > 0) {
              this.allRowOptions = rowOptions;
            }
          } catch (e) {
            console.warn("Error extracting row options:", e);
          }
        }

        // Extract column options from metadata
        if (
          this.lastReportData.metadata.columnField &&
          this.lastReportData.metadata.columnField.options
        ) {
          try {
            let columnOptions;
            const columnOptionsStr =
              this.lastReportData.metadata.columnField.options;

            // Handle different formats of options data
            if (typeof columnOptionsStr === "string") {
              if (
                columnOptionsStr.startsWith("[") ||
                columnOptionsStr.startsWith("{")
              ) {
                // Try to parse JSON
                try {
                  const parsed = JSON.parse(columnOptionsStr);
                  if (Array.isArray(parsed)) {
                    columnOptions = parsed;
                  } else if (parsed.options && Array.isArray(parsed.options)) {
                    columnOptions = parsed.options;
                  }
                } catch (e) {
                  console.warn("Error parsing column options JSON:", e);
                }
              }

              // If JSON parsing failed or wasn't applicable, try other formats
              if (!columnOptions) {
                // Try line-break or comma separated format
                columnOptions = columnOptionsStr
                  .split(/[\n,]/)
                  .map((o) => o.trim())
                  .filter((o) => o);
              }
            } else if (Array.isArray(columnOptionsStr)) {
              columnOptions = columnOptionsStr;
            }

            if (columnOptions && columnOptions.length > 0) {
              this.allColumnOptions = columnOptions;
            }
          } catch (e) {
            console.warn("Error extracting column options:", e);
          }
        }
      }

      // If we still don't have options, try API endpoints
      if (!this.allRowOptions.length || !this.allColumnOptions.length) {
        // Try to get row options via individual variable API
        if (this.reportData.config.rowVariableId) {
          try {
            const rowResponse = await fetch(
              `/api/variables/${this.reportData.config.rowVariableId}`,
              {
                headers: {
                  Authorization: `Bearer ${AuthManager.getAuthToken()}`,
                },
              }
            );

            if (rowResponse.ok) {
              const rowData = await rowResponse.json();
              if (rowData.options && rowData.options.length > 0) {
                this.allRowOptions = rowData.options;
              }
            }
          } catch (err) {
            console.warn("Failed to fetch row variable options:", err);
          }
        }

        // Try to get column options via individual variable API
        if (this.reportData.config.columnVariableId) {
          try {
            const colResponse = await fetch(
              `/api/variables/${this.reportData.config.columnVariableId}`,
              {
                headers: {
                  Authorization: `Bearer ${AuthManager.getAuthToken()}`,
                },
              }
            );

            if (colResponse.ok) {
              const colData = await colResponse.json();
              if (colData.options && colData.options.length > 0) {
                this.allColumnOptions = colData.options;
              }
            }
          } catch (err) {
            console.warn("Failed to fetch column variable options:", err);
          }
        }
      }
    } catch (error) {
      console.error("Error preparing variable options:", error);
      // If there's an error, we'll just use whatever data we have in the table
    }
  }

  processDataForFullTableView(data) {
    // If the data structure is unexpected, return original data
    if (!data.rowLabels || !data.columnLabels || !data.data) {
      console.warn("Unexpected data structure for processDataForFullTableView");
      return data;
    }

    // Create a deep copy of the data to avoid modifying the original
    const fullData = JSON.parse(JSON.stringify(data));

    // Create sets to track which options are already in the data
    const existingRowLabels = new Set(data.rowLabels);
    const existingColumnLabels = new Set(data.columnLabels);

    // If we have no additional options to add, return the original data
    if (
      (!this.allRowOptions || this.allRowOptions.length === 0) &&
      (!this.allColumnOptions || this.allColumnOptions.length === 0)
    ) {
      return fullData;
    }

    // Track new additions
    let newRowsAdded = 0;
    let newColumnsAdded = 0;

    // Helper function to extract appropriate options based on hierarchical filters
    const getFilteredOptions = (options, fieldId, variableType) => {
      if (!options) return [];

      // If filtering is not needed, use the extractNestedSelectOptions function
      const isNestedSelect =
        variableType === "row"
          ? data.metadata?.rowField?.field_type === "nested-select"
          : data.metadata?.columnField?.field_type === "nested-select";

      if (!isNestedSelect) {
        return options;
      }

      // Check if we have a hierarchical filter applied for this field
      const filter = this.reportData.config.filters?.find(
        (f) => f.fieldId.toString() === fieldId.toString()
      );

      // If no filter is applied, only show Level 1 options
      if (!filter) {
        // Extract just Level 1 options
        if (Array.isArray(options)) {
          // If it's already a structure with level definitions
          if (
            options.length > 0 &&
            options[0].level === 1 &&
            options[0].options
          ) {
            const level1Options = options[0].options;
            if (Array.isArray(level1Options)) {
              return level1Options.map((opt) =>
                typeof opt === "object"
                  ? opt.label || opt.name || opt.value || String(opt)
                  : opt
              );
            } else if (typeof level1Options === "string") {
              return level1Options
                .split(/[\n,]/)
                .map((o) => o.trim())
                .filter((o) => o);
            }
          }
          // For other formats, try to extract level 1
          else if (
            typeof options[0] === "object" &&
            options[0].level !== undefined
          ) {
            // Find the level 1 definition
            const level1 = options.find((o) => o.level === 1);
            if (level1 && level1.options) {
              if (Array.isArray(level1.options)) {
                return level1.options.map((opt) =>
                  typeof opt === "object"
                    ? opt.label || opt.name || opt.value || String(opt)
                    : opt
                );
              } else if (typeof level1.options === "string") {
                return level1.options
                  .split(/[\n,]/)
                  .map((o) => o.trim())
                  .filter((o) => o);
              }
            }
          }
        }

        // If we can't determine level 1, just return the original options
        return options;
      }

      // If we have a filter, show options at the next level after the selected filter level
      const filterLevel = filter.level || 1;
      const selectedValue = filter.value;
      const hierarchyPath = filter.hierarchyPath || [selectedValue];

      // Get field metadata to identify levels structure
      let levelsStructure = [];
      const field = this.getFieldMetadata(fieldId);

      // Extract levels structure from field metadata
      if (field && field.options) {
        if (typeof field.options === "string") {
          try {
            levelsStructure = JSON.parse(field.options);
          } catch (e) {}
        } else {
          levelsStructure = field.options;
        }
      }

      // If we can't get the structure, just return the original options
      if (!levelsStructure || !levelsStructure.length) {
        return options;
      }

      // Use the getChildOptions method to get children of the selected value
      const childOptions = this.getChildOptions(
        levelsStructure,
        selectedValue,
        filterLevel - 1 // Convert to 0-based index
      );

      return childOptions.length > 0 ? childOptions : [];
    };

    // Add missing row options
    if (this.allRowOptions && this.allRowOptions.length > 0) {
      // Check if we're dealing with a nested-select field (row variable)
      const isNestedSelect =
        data.metadata?.rowField?.field_type === "nested-select";
      const rowFieldId = this.reportData.config.rowVariableId;

      // Get filtered options based on hierarchical filter selection
      let rowOptionsToAdd = isNestedSelect
        ? getFilteredOptions(this.allRowOptions, rowFieldId, "row")
        : this.allRowOptions;

      rowOptionsToAdd.forEach((option) => {
        // For simple options, use as is
        const optionLabel =
          typeof option === "object"
            ? option.label ||
              option.name ||
              option.value ||
              JSON.stringify(option)
            : option;

        if (optionLabel && !existingRowLabels.has(optionLabel)) {
          fullData.rowLabels.push(optionLabel);

          // Create a new row with zeros - one for each existing column
          const newRow = Array(fullData.columnLabels.length).fill(0);
          fullData.data.push(newRow);

          // Add a zero to row totals for this row
          fullData.rowTotals.push(0);

          newRowsAdded++;
        }
      });
    }

    // Add missing column options
    if (this.allColumnOptions && this.allColumnOptions.length > 0) {
      // Check if we're dealing with a nested-select field (column variable)
      const isNestedSelect =
        data.metadata?.columnField?.field_type === "nested-select";
      const columnFieldId = this.reportData.config.columnVariableId;

      // Get filtered options based on hierarchical filter selection
      let columnOptionsToAdd = isNestedSelect
        ? getFilteredOptions(this.allColumnOptions, columnFieldId, "column")
        : this.allColumnOptions;

      columnOptionsToAdd.forEach((option) => {
        // For simple options, use as is
        const optionLabel =
          typeof option === "object"
            ? option.label ||
              option.name ||
              option.value ||
              JSON.stringify(option)
            : option;

        if (optionLabel && !existingColumnLabels.has(optionLabel)) {
          fullData.columnLabels.push(optionLabel);

          // Add a zero for this new column to each existing row
          fullData.data.forEach((row) => {
            row.push(0);
          });

          // Add a zero to column totals for this column
          fullData.columnTotals.push(0);

          newColumnsAdded++;
        }
      });
    }

    // Ensure the data is properly formatted
    if (fullData.data.length !== fullData.rowLabels.length) {
      console.warn(
        "Data rows mismatch after processing:",
        fullData.data.length,
        "rows for",
        fullData.rowLabels.length,
        "labels"
      );
    }

    fullData.data.forEach((row, index) => {
      if (row.length !== fullData.columnLabels.length) {
        console.warn(
          `Row ${index} has ${row.length} columns but should have ${fullData.columnLabels.length}`
        );
      }
    });

    return fullData;
  }

  renderReportTable(data) {
    if (!data || !data.rowLabels || !data.columnLabels) {
      console.error("Invalid report data for table rendering:", data);
      return;
    }

    this.reportLoading.style.display = "none";
    this.crossTabTable.style.display = "table";

    // Clear existing table
    this.crossTabTable.innerHTML = "";

    // Create table header
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    // Empty cell for top-left corner
    const cornerCell = document.createElement("th");
    cornerCell.className = "row-header";
    cornerCell.textContent = "";
    headerRow.appendChild(cornerCell);

    // Add column headers
    data.columnLabels.forEach((label) => {
      const th = document.createElement("th");
      th.textContent = label;
      headerRow.appendChild(th);
    });

    // Add total header
    const totalHeader = document.createElement("th");
    totalHeader.textContent = "Total";
    totalHeader.className = "total-header";
    headerRow.appendChild(totalHeader);

    thead.appendChild(headerRow);
    this.crossTabTable.appendChild(thead);

    // Create table body
    const tbody = document.createElement("tbody");

    // Add data rows
    data.rowLabels.forEach((rowLabel, rowIndex) => {
      const row = document.createElement("tr");

      // Add row label
      const labelCell = document.createElement("td");
      labelCell.textContent = rowLabel;
      labelCell.className = "row-label";
      row.appendChild(labelCell);

      // Add data cells
      let rowTotal = 0;
      data.data[rowIndex].forEach((value, colIndex) => {
        const cell = document.createElement("td");

        const aggregationType = document.querySelector(
          'input[name="aggregationType"]:checked'
        ).value;

        // Format the value based on aggregation type
        if (aggregationType === "percent_total") {
          cell.textContent = value.toFixed(1) + "%";
        } else {
          cell.textContent = value;
        }

        // Add empty-cell class if value is zero and we're in full table view
        if (value === 0 && this.showFullTableView) {
          cell.className = "empty-cell";
          cell.textContent = "—"; // Use an em dash for empty cells
        }

        row.appendChild(cell);
        rowTotal += value;
      });

      // Add row total
      const totalCell = document.createElement("td");

      const aggregationType = document.querySelector(
        'input[name="aggregationType"]:checked'
      ).value;
      if (aggregationType === "percent_total") {
        totalCell.textContent = data.rowTotals[rowIndex].toFixed(1) + "%";
      } else {
        totalCell.textContent = data.rowTotals[rowIndex];
      }

      totalCell.className = "total-cell";

      // If the row total is zero in full table view, add the empty-cell class
      if (data.rowTotals[rowIndex] === 0 && this.showFullTableView) {
        totalCell.classList.add("empty-cell");
      }

      row.appendChild(totalCell);
      tbody.appendChild(row);
    });

    // Add totals row
    const totalsRow = document.createElement("tr");

    // "Total" label for the row
    const totalLabelCell = document.createElement("td");
    totalLabelCell.textContent = "Total";
    totalLabelCell.className = "row-label total-cell";
    totalsRow.appendChild(totalLabelCell);

    // Column totals
    data.columnTotals.forEach((total, index) => {
      const cell = document.createElement("td");

      const aggregationType = document.querySelector(
        'input[name="aggregationType"]:checked'
      ).value;
      if (aggregationType === "percent_total") {
        cell.textContent = total.toFixed(1) + "%";
      } else {
        cell.textContent = total;
      }

      cell.className = "total-cell";

      // If the column total is zero in full table view, add the empty-cell class
      if (total === 0 && this.showFullTableView) {
        cell.classList.add("empty-cell");
      }

      totalsRow.appendChild(cell);
    });

    // Grand total
    const grandTotalCell = document.createElement("td");

    const aggregationType = document.querySelector(
      'input[name="aggregationType"]:checked'
    ).value;
    if (aggregationType === "percent_total") {
      grandTotalCell.textContent = "100.0%";
    } else {
      grandTotalCell.textContent = data.grandTotal;
    }

    grandTotalCell.className = "total-cell";
    totalsRow.appendChild(grandTotalCell);

    tbody.appendChild(totalsRow);
    this.crossTabTable.appendChild(tbody);

    // We don't need to call setupNestedSelectFilters here
    // It's now called only once in generateReportVisualization
  }

  initializeChart(data) {
    // Set up chart event listeners
    document.querySelectorAll('input[name="chartType"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        this.updateChart(e.target.value, data);
      });
    });

    // Initialize with bar chart
    this.updateChart("bar", data);
  }

  updateChart(chartType, data) {
    if (!data) return;

    // Destroy existing chart if any
    if (this.chart) {
      this.chart.destroy();
    }

    const ctx = this.reportChart.getContext("2d");

    // Select the appropriate chart type
    if (chartType === "bar") {
      this.createBarChart(ctx, data);
    } else if (chartType === "pie") {
      this.createPieChart(ctx, data);
    } else if (chartType === "heatmap") {
      this.createHeatmap(ctx, data);
    }
  }

  createBarChart(ctx, data) {
    const aggregationType = document.querySelector(
      'input[name="aggregationType"]:checked'
    ).value;

    // Create datasets for each column
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

  createPieChart(ctx, data) {
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

  createHeatmap(ctx, data) {
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
              const alpha = value / maxValue;
              return `rgba(54, 162, 235, ${alpha})`;
            },
            borderColor: "#ffffff",
            borderWidth: 1,
            width: ({ chart }) =>
              (chart.chartArea || {}).width / data.columnLabels.length - 2,
            height: ({ chart }) =>
              (chart.chartArea || {}).height / data.rowLabels.length - 2,
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

  setupEventListeners() {
    // Back to reports button
    document
      .getElementById("backToReportsBtn")
      .addEventListener("click", () => {
        window.location.href = "/admin/reports/";
      });

    // Refresh report button
    document
      .getElementById("refreshReportBtn")
      .addEventListener("click", () => {
        this.showLoading();
        this.loadReportData();
      });

    // Aggregation type change
    document
      .querySelectorAll('input[name="aggregationType"]')
      .forEach((radio) => {
        radio.addEventListener("change", () => {
          this.handleAggregationChange();
        });
      });

    // Export Excel button
    document.getElementById("exportCsvBtn").addEventListener("click", () => {
      this.exportToExcel();
    });

    // Print button
    document.getElementById("printReportBtn").addEventListener("click", () => {
      this.printReport();
    });

    // Toggle full table view
    document
      .getElementById("toggleFullTableView")
      .addEventListener("change", (e) => {
        this.handleFullTableViewToggle(e.target.checked);
      });

    // Initialize tooltips
    const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltips.forEach((tooltip) => {
      new bootstrap.Tooltip(tooltip);
    });
  }

  handleAggregationChange() {
    // Get the selected aggregation type
    const aggregationType = document.querySelector(
      'input[name="aggregationType"]:checked'
    ).value;

    // Ensure we only use the supported aggregation types
    if (!["count", "percent_total"].includes(aggregationType)) {
      document.getElementById("countAggregation").checked = true;
      return this.handleAggregationChange();
    }

    // Update the current report data's aggregation type
    if (this.reportData && this.reportData.config) {
      this.reportData.config.aggregationType = aggregationType;
    }

    // Re-generate the report with the new aggregation type
    this.generateReportVisualization();
  }

  handleFullTableViewToggle(showFullTable) {
    if (!this.reportData) return;

    // Store the preference
    this.showFullTableView = showFullTable;

    // Show or hide the "FULL VIEW" badge
    const fullTableBadge = document.getElementById("fullTableBadge");
    if (fullTableBadge) {
      fullTableBadge.style.display = showFullTable ? "inline-block" : "none";
    }

    // Re-generate the report visualization with the new display preference
    this.generateReportVisualization();
  }

  exportToExcel() {
    if (!this.reportData || !this.lastReportData) return;

    try {
      // Process data for full table view if needed
      let processedData = this.lastReportData;
      if (this.showFullTableView) {
        // Check if we have any row or column options that aren't in the data already
        let hasAdditionalOptions = false;

        if (this.allRowOptions && this.allRowOptions.length > 0) {
          const existingRowLabels = new Set(this.lastReportData.rowLabels);
          for (const option of this.allRowOptions) {
            if (!existingRowLabels.has(option)) {
              hasAdditionalOptions = true;
              break;
            }
          }
        }

        if (
          !hasAdditionalOptions &&
          this.allColumnOptions &&
          this.allColumnOptions.length > 0
        ) {
          const existingColumnLabels = new Set(
            this.lastReportData.columnLabels
          );
          for (const option of this.allColumnOptions) {
            if (!existingColumnLabels.has(option)) {
              hasAdditionalOptions = true;
              break;
            }
          }
        }

        // Only process if we actually have additional options to add
        if (hasAdditionalOptions) {
          processedData = this.processDataForFullTableView(this.lastReportData);
        }
      }

      // Get field information
      const rowField = this.getFieldMetadata(
        this.reportData.config.rowVariableId
      );
      const colField = this.getFieldMetadata(
        this.reportData.config.columnVariableId
      );
      const rowVarName = rowField ? rowField.display_name : "Not selected";
      const colVarName = colField ? colField.display_name : "Not selected";
      const aggregationType = this.reportData.config.aggregationType || "count";

      // Determine if table is wide and needs special handling
      const isWideTable = processedData.columnLabels.length > 5;
      const isVeryWideTable = processedData.columnLabels.length > 10;

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

      // Zebra striping for data cells
      const zebraStyle = {
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "F9F9F9" },
        },
      };

      // Zero value style
      const zeroValueStyle = {
        font: {
          italic: true,
          color: { argb: "AAAAAA" },
          size: isVeryWideTable ? 9 : isWideTable ? 10 : 11,
        },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "F9F9F9" },
        },
      };

      // Totals row style
      const totalsRowStyle = {
        font: { size: isVeryWideTable ? 9 : isWideTable ? 10 : 11, bold: true },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "E6F0FF" },
        },
        border: {
          top: { style: "medium", color: { argb: "0A2A6B" } },
          bottom: { style: "medium", color: { argb: "0A2A6B" } },
          left: { style: "medium", color: { argb: "0A2A6B" } },
          right: { style: "thin", color: { argb: "DDDDDD" } },
        },
        alignment: { horizontal: "center", vertical: "middle", wrapText: true },
      };

      // Totals column style
      const totalsColStyle = {
        font: { size: isVeryWideTable ? 9 : isWideTable ? 10 : 11, bold: true },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "E6F0FF" },
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
      const reportTitleRow = worksheet.addRow([
        this.reportData.name || "Cross-Tabulation Analysis Report",
      ]);
      reportTitleRow.height = 30;

      // Row 6: Empty spacing
      worksheet.addRow([""]);

      // Report metadata section
      // ---------------------
      const metaStartRow = worksheet.rowCount + 1;

      worksheet.addRow([
        "Report Name:",
        this.reportData.name || "Untitled Report",
      ]);
      worksheet.addRow(["Row Variable:", rowVarName]);
      worksheet.addRow(["Column Variable:", colVarName]);
      worksheet.addRow([
        "Aggregation Type:",
        this.formatAggregationType(aggregationType),
      ]);
      worksheet.addRow(["Date Generated:", new Date().toLocaleString()]);

      if (this.showFullTableView) {
        worksheet.addRow(["Display Mode:", "Show All Options (FULL VIEW)"]);
      }

      const metaEndRow = worksheet.rowCount;

      // Spacing
      worksheet.addRow([""]);

      // Add filters if any
      let filterStartRow = 0;
      let filterEndRow = 0;

      if (
        this.reportData.config.filters &&
        this.reportData.config.filters.length > 0
      ) {
        filterStartRow = worksheet.rowCount;
        worksheet.addRow(["Applied Filters"]);

        this.reportData.config.filters.forEach((filter) => {
          const fieldInfo = this.getFieldMetadata(filter.fieldId);
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
        const instructionsRow = worksheet.rowCount;
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
      processedData.columnLabels.forEach((label) => {
        headerCells.push(label); // Don't truncate labels, we'll handle with wrapping
      });
      headerCells.push("Total");

      const tableHeaderRow = worksheet.addRow(headerCells);
      tableHeaderRow.height = 25;

      // Add data rows
      // -----------
      const dataRows = [];
      processedData.rowLabels.forEach((rowLabel, rowIndex) => {
        const row = [rowLabel]; // Don't truncate row labels, we'll handle with wrapping

        processedData.columnLabels.forEach((_, colIndex) => {
          let value = processedData.data[rowIndex][colIndex];
          if (aggregationType !== "count") {
            value = parseFloat(value.toFixed(1));
          }
          row.push(value);
        });

        // Add row total
        let rowTotal = processedData.rowTotals[rowIndex];
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
      processedData.columnTotals.forEach((total) => {
        let formattedTotal = total;
        if (aggregationType !== "count") {
          formattedTotal = parseFloat(formattedTotal.toFixed(1));
        }
        totalRowData.push(formattedTotal);
      });

      // Add grand total
      let grandTotal = processedData.grandTotal;
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
      const lastColumn = processedData.columnLabels.length + 2; // +2 for row label column and totals column

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
        for (let col = 2; col <= processedData.columnLabels.length + 1; col++) {
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

          // Style zero values in full table view
          if (
            this.showFullTableView &&
            (cell.value === 0 || cell.value === "0" || cell.value === 0.0)
          ) {
            Object.assign(cell, zeroValueStyle);
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
        processedData,
        processedData.columnLabels,
        processedData.rowLabels
      );

      // Apply the calculated column widths
      worksheet.columns.forEach((column, index) => {
        if (index < columnWidths.length) {
          column.width = columnWidths[index];
        }
      });

      // Generate Excel file and download
      const fileName = `${this.reportData.name || "Report"}_${new Date()
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
          this.showToast("Export successful", `Report exported as ${fileName}`);
        })
        .catch((error) => {
          console.error("Error generating Excel buffer:", error);
          this.showError(`Error generating Excel file: ${error.message}`);
        });
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      this.showError(`Failed to export to Excel: ${error.message}`);
    }
  }

  // Helper function to show toast messages
  showToast(title, message, type = "success") {
    const toastContainer =
      document.getElementById("toastContainer") || this.createToastContainer();

    const toast = document.createElement("div");
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "assertive");
    toast.setAttribute("aria-atomic", "true");

    toast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">
          <strong>${title}</strong> ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `;

    toastContainer.appendChild(toast);

    const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
    bsToast.show();

    // Remove toast after it's hidden
    toast.addEventListener("hidden.bs.toast", () => toast.remove());
  }

  createToastContainer() {
    const container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container position-fixed bottom-0 end-0 p-3";
    container.style.zIndex = "9999";
    document.body.appendChild(container);
    return container;
  }

  printReport() {
    if (!this.reportData || !this.lastReportData) return;

    // Process data for full table view if the toggle is on
    let processedData = this.lastReportData;
    if (this.showFullTableView) {
      // Check if we have any row or column options that aren't in the data already
      let hasAdditionalOptions = false;

      if (this.allRowOptions && this.allRowOptions.length > 0) {
        const existingRowLabels = new Set(this.lastReportData.rowLabels);
        for (const option of this.allRowOptions) {
          if (!existingRowLabels.has(option)) {
            hasAdditionalOptions = true;
            break;
          }
        }
      }

      if (
        !hasAdditionalOptions &&
        this.allColumnOptions &&
        this.allColumnOptions.length > 0
      ) {
        const existingColumnLabels = new Set(this.lastReportData.columnLabels);
        for (const option of this.allColumnOptions) {
          if (!existingColumnLabels.has(option)) {
            hasAdditionalOptions = true;
            break;
          }
        }
      }

      // Only process if we actually have additional options to add
      if (hasAdditionalOptions) {
        processedData = this.processDataForFullTableView(this.lastReportData);
      }
    }

    // Determine if table is wide and needs special handling
    const isWideTable = processedData.columnLabels.length > 5;
    const isVeryWideTable = processedData.columnLabels.length > 10;

    // Create a print-friendly version of the report
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>DDRC - Cross-Tabulation Report</title>
          <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
          <style>
            @page {
              size: ${isWideTable ? "landscape" : "portrait"};
              margin: 1cm;
            }
            
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px;
              color: #333;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
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
              width: 70px;
              height: auto;
            }
            
            .header-logo-right {
              width: 100px;
              height: auto;
            }
            
            .header-text {
              text-align: center;
              flex-grow: 1;
              padding: 0 15px;
            }
            
            .header-text h1 {
              font-size: ${isWideTable ? "20px" : "22px"};
              margin-bottom: 5px;
              color: #1a56db;
              font-weight: 600;
            }
            
            .header-text p {
              margin: 0;
              font-size: ${isWideTable ? "12px" : "14px"};
              line-height: 1.3;
            }
            
            /* Report Styles */
            .report-title {
              text-align: center;
              margin: 20px 0 15px;
              color: #333;
              font-weight: 600;
              font-size: ${isWideTable ? "18px" : "20px"};
            }
            
            .report-meta {
              background-color: #f8f9fa;
              padding: 12px;
              border-radius: 8px;
              margin-bottom: 15px;
              border: 1px solid #e9ecef;
              font-size: ${isWideTable ? "11px" : "12px"};
            }
            
            .report-meta p {
              margin-bottom: 4px;
            }
            
            /* Table Styles */
            .table-container {
              overflow-x: auto;
              margin-bottom: 20px;
            }
            
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 20px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
              font-size: ${
                isVeryWideTable ? "9px" : isWideTable ? "10px" : "12px"
              };
            }
            
            th, td { 
              border: 1px solid #ddd; 
              padding: ${
                isVeryWideTable ? "4px" : isWideTable ? "5px" : "8px"
              }; 
              text-align: left;
              word-break: break-word;
              ${
                isVeryWideTable
                  ? "max-width: 4cm;"
                  : isWideTable
                  ? "max-width: 5cm;"
                  : ""
              }
            }
            
            th { 
              background-color: #1a56db;
              color: white;
              font-weight: 600;
              text-align: center;
            }
            
            th:first-child {
              text-align: left;
              ${isWideTable ? "position: sticky; left: 0; z-index: 2;" : ""}
            }
            
            td:first-child {
              background-color: #f2f2f2;
              font-weight: 600;
              ${isWideTable ? "position: sticky; left: 0; z-index: 1;" : ""}
            }
            
            tr:nth-child(even) td:not(:first-child):not(.total-col) {
              background-color: #f9f9f9;
            }
            
            .total-row td { 
              font-weight: bold; 
              background-color: #e6f0ff !important;
            }
            
            .total-col { 
              font-weight: bold; 
              background-color: #e6f0ff !important;
            }
            
            .total-cell {
              font-weight: bold;
              background-color: #d4e6ff !important;
              color: #1a56db;
            }
            
            .zero-value {
              color: #aaa;
              font-style: italic;
            }
            
            .filters { 
              margin-bottom: 15px;
              background-color: #f0f7ff;
              border-radius: 6px;
              padding: 10px 12px;
              border-left: 3px solid #1a56db;
              font-size: ${isWideTable ? "11px" : "12px"};
            }
            
            .filters h4 {
              color: #1a56db;
              font-size: ${isWideTable ? "14px" : "16px"};
              margin-top: 0;
              margin-bottom: 8px;
            }
            
            .filter-item { 
              margin-bottom: 4px;
              display: flex;
              align-items: center;
            }
            
            .filter-item:before {
              content: "•";
              margin-right: 8px;
              color: #1a56db;
            }
            
            .show-all-options-badge {
              display: inline-block;
              background-color: #e1f5fe;
              color: #0288d1;
              padding: 3px 6px;
              border-radius: 4px;
              font-weight: 600;
              font-size: 10px;
              margin-left: 8px;
            }
            
            /* Print-specific styles */
            @media print {
              body { 
                margin: 0;
                padding: 0;
              }
              .no-print { display: none; }
              .report-header { margin-bottom: 15px; }
              table { box-shadow: none; }
              
              /* Critical for proper color printing */
              th { background-color: #e0e0e0 !important; color: #333 !important; }
              .total-row td, .total-col { background-color: #f0f0f0 !important; }
              .total-cell { background-color: #e6e6e6 !important; color: #333 !important; }
              
              /* Page break control */
              .page-break { page-break-after: always; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; }
              thead { display: table-header-group; }
            }
            
            .generation-info {
              font-size: ${isWideTable ? "10px" : "12px"};
              color: #6c757d;
              text-align: center;
              margin-top: 20px;
              padding-top: 10px;
              border-top: 1px solid #eee;
            }
            
            .print-note {
              font-size: ${isWideTable ? "12px" : "14px"};
              color: #666;
              margin-top: 15px;
              padding: 8px;
              background-color: #f8f9fa;
              border-radius: 4px;
              text-align: center;
            }
            
            .print-instructions {
              background-color: #ffebee;
              border-left: 3px solid #f44336;
              padding: 8px 12px;
              margin: 15px 0;
              font-size: 13px;
              line-height: 1.4;
            }
            
            .print-button {
              background-color: #1a56db;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 4px;
              cursor: pointer;
              font-weight: 500;
              margin-right: 10px;
              transition: background-color 0.2s;
            }
            
            .print-button:hover {
              background-color: #0d47a1;
            }
            
            .close-button {
              background-color: #6c757d;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 4px;
              cursor: pointer;
              font-weight: 500;
              transition: background-color 0.2s;
            }
            
            .close-button:hover {
              background-color: #5a6268;
            }
            
            .button-container {
              text-align: center;
              margin-top: 20px;
              margin-bottom: 30px;
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
          
          <h2 class="report-title">${
            this.reportData.name || "Cross-Tabulation Analysis Report"
          }</h2>
    `);

    // Add report metadata
    // Get row and column field information
    const rowField = this.getFieldMetadata(
      this.reportData.config.rowVariableId
    );
    const colField = this.getFieldMetadata(
      this.reportData.config.columnVariableId
    );

    // Get the display names of selected variables
    const rowVarName = rowField ? rowField.display_name : "Not selected";
    const colVarName = colField ? colField.display_name : "Not selected";

    printWindow.document.write(`
      <div class="report-meta">
        <p><strong>Report Name:</strong> ${
          this.reportData.name || "Untitled Report"
        }</p>
        <p><strong>Row Variable:</strong> ${rowVarName}</p>
        <p><strong>Column Variable:</strong> ${colVarName}</p>
        <p><strong>Aggregation Type:</strong> ${this.formatAggregationType(
          this.reportData.config.aggregationType || "count"
        )}</p>
        <p><strong>Date Generated:</strong> ${new Date().toLocaleString()}</p>
        ${
          this.showFullTableView
            ? `<p><strong>Display Mode:</strong> Show All Options <span class="show-all-options-badge">FULL VIEW</span></p>`
            : ""
        }
      </div>
    `);

    // Add print instructions for wide tables
    if (isWideTable) {
      printWindow.document.write(`
        <div class="print-instructions no-print">
          <strong>Print Instructions:</strong> 
          <ul>
            <li>This report has been automatically set to landscape orientation to better fit the wide table.</li>
            <li>Font sizes have been reduced to fit more content on each page.</li>
            <li>When printing, select "Landscape" orientation in your print settings.</li>
            <li>For best results, use "Fit to page" or "Scale to fit" in your browser's print dialog.</li>
          </ul>
        </div>
      `);
    }

    // Add filters if any
    if (
      this.reportData.config.filters &&
      this.reportData.config.filters.length > 0
    ) {
      printWindow.document.write(
        '<div class="filters"><h4>Applied Filters</h4>'
      );

      this.reportData.config.filters.forEach((filter) => {
        const fieldInfo = this.getFieldMetadata(filter.fieldId);
        const fieldName = fieldInfo
          ? fieldInfo.display_name
          : filter.fieldName || filter.fieldId;

        let operatorText = this.getOperatorDisplayText(filter.operator);
        let filterValue = filter.value;

        // Format the filter display for better readability
        printWindow.document.write(
          `<div class="filter-item">${fieldName} <strong>${operatorText}</strong> ${filterValue}</div>`
        );
      });

      printWindow.document.write("</div>");
    }

    // Add the table with container for horizontal scrolling
    printWindow.document.write('<div class="table-container">');
    printWindow.document.write('<table class="table table-bordered">');

    // Add table header
    printWindow.document.write("<thead><tr><th></th>");
    processedData.columnLabels.forEach((label) => {
      // Check if label needs truncation for very wide tables
      let displayLabel = label;
      if (isVeryWideTable && label.length > 20) {
        displayLabel = label.substring(0, 18) + "...";
      }
      printWindow.document.write(`<th title="${label}">${displayLabel}</th>`);
    });
    printWindow.document.write('<th class="total-col">Total</th></tr></thead>');

    // Add table body
    printWindow.document.write("<tbody>");

    const aggregationType = this.reportData.config.aggregationType || "count";
    processedData.rowLabels.forEach((rowLabel, rowIndex) => {
      // Check if row label needs truncation for very wide tables
      let displayRowLabel = rowLabel;
      if (isVeryWideTable && rowLabel.length > 25) {
        displayRowLabel = rowLabel.substring(0, 23) + "...";
      }

      printWindow.document.write(
        `<tr><td title="${rowLabel}">${displayRowLabel}</td>`
      );

      processedData.columnLabels.forEach((_, colIndex) => {
        let cellValue = processedData.data[rowIndex][colIndex];
        let cellClass = "";

        // Format the cell value based on aggregation type
        if (aggregationType !== "count") {
          cellValue = `${cellValue.toFixed(1)}%`;
        }

        // Add special styling for zero values in Show All Options mode
        if (
          this.showFullTableView &&
          (cellValue === 0 || cellValue === "0" || cellValue === "0.0%")
        ) {
          cellClass = "zero-value";
        }

        printWindow.document.write(
          `<td class="${cellClass}">${cellValue}</td>`
        );
      });

      let rowTotal = processedData.rowTotals[rowIndex];
      if (aggregationType !== "count") {
        rowTotal = `${rowTotal.toFixed(1)}%`;
      }
      printWindow.document.write(`<td class="total-col">${rowTotal}</td></tr>`);
    });

    // Add totals row
    printWindow.document.write('<tr class="total-row"><td>Total</td>');
    processedData.columnTotals.forEach((total) => {
      let formattedTotal = total;
      if (aggregationType !== "count") {
        formattedTotal = `${formattedTotal.toFixed(1)}%`;
      }
      printWindow.document.write(`<td>${formattedTotal}</td>`);
    });

    let grandTotal = processedData.grandTotal;
    if (aggregationType !== "count") {
      grandTotal = "100.0%";
    }
    printWindow.document.write(
      `<td class="total-cell">${grandTotal}</td></tr>`
    );

    printWindow.document.write("</tbody></table>");
    printWindow.document.write("</div>"); // Close table-container

    // Add print notes
    printWindow.document.write(`
      <div class="print-note">
        ${
          this.showFullTableView
            ? '<i class="bi bi-info-circle"></i> Note: Entries with zero values are displayed in light gray italic text.<br>'
            : ""
        }
        ${
          isVeryWideTable
            ? '<i class="bi bi-exclamation-triangle"></i> Some content may be truncated due to space limitations. Hover over cells to see full text.'
            : ""
        }
      </div>
    `);

    // Add generation info
    printWindow.document.write(`
      <div class="generation-info">
        This report was generated from the DDRC Management System on ${new Date().toLocaleString()}
      </div>
    `);

    // Add print and close buttons
    printWindow.document.write(`
      <div class="button-container no-print">
        <button class="print-button" onclick="window.print()">
          <i class="bi bi-printer"></i> Print Report
        </button>
        <button class="close-button" onclick="window.close()">
          <i class="bi bi-x"></i> Close
        </button>
      </div>
    `);

    // Add script for better print handling
    printWindow.document.write(`
      <script>
        // Set the focus to the new window and add an onload event
        window.focus();
        window.onload = function() {
          // In very wide tables, add hover events for truncated cells
          const allCells = document.querySelectorAll('th, td');
          allCells.forEach(cell => {
            if (cell.title) {
              cell.style.cursor = 'help';
              cell.addEventListener('mouseenter', function() {
                if (this.scrollWidth > this.clientWidth) {
                  this.setAttribute('data-original-text', this.innerHTML);
                  this.innerHTML = this.title;
                }
              });
              cell.addEventListener('mouseleave', function() {
                if (this.hasAttribute('data-original-text')) {
                  this.innerHTML = this.getAttribute('data-original-text');
                }
              });
            }
          });
        };
      </script>
    `);

    printWindow.document.write("</body></html>");
    printWindow.document.close();
  }

  // Helper method to get operator display text
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

  formatAggregationType(type) {
    switch (type) {
      case "count":
        return "Count";
      case "percent_total":
        return "% of Total";
      case "percent_row":
        return "% of Row";
      case "percent_col":
        return "% of Column";
      default:
        return type || "Count";
    }
  }

  getChartColor(index) {
    const colors = [
      "#4285F4", // Blue
      "#EA4335", // Red
      "#FBBC05", // Yellow
      "#34A853", // Green
      "#8E24AA", // Purple
      "#16A2D7", // Light Blue
      "#FB8C00", // Orange
      "#6D4C41", // Brown
      "#757575", // Grey
      "#D81B60", // Pink
    ];

    return colors[index % colors.length];
  }

  showLoading() {
    if (this.loadingOverlay) {
      this.loadingOverlay.style.display = "flex";
    }
  }

  hideLoading() {
    if (this.loadingOverlay) {
      this.loadingOverlay.style.display = "none";
    }
  }

  showError(message) {
    // Create an error alert
    const errorDiv = document.createElement("div");
    errorDiv.className = "alert alert-danger mt-4";
    errorDiv.textContent = message;

    // Clear any existing errors
    document.querySelectorAll(".alert-danger").forEach((el) => el.remove());

    // Add to the document
    const container = document.querySelector(".admin-content");
    if (container) {
      container.prepend(errorDiv);
    }
  }

  // Set up Hierarchical Filters for nested-select fields
  setupNestedSelectFilters() {
    if (!this.reportData || !this.reportData.config) return;

    // Remove any existing hierarchical filter containers first
    const existingContainers = document.querySelectorAll(
      ".hierarchical-filters-container"
    );
    existingContainers.forEach((container) => container.remove());

    // Create container for hierarchical filters
    const container = document.createElement("div");
    container.id = "hierarchicalFiltersContainer";
    container.className = "hierarchical-filters-container mb-4";

    // Create a card-like container for the filters
    const filterCard = document.createElement("div");
    filterCard.className = "report-card";
    container.appendChild(filterCard);

    // Create a header for the filters
    const cardHeader = document.createElement("div");
    cardHeader.className = "report-header";
    filterCard.appendChild(cardHeader);

    // Add a title
    const title = document.createElement("h5");
    title.className = "mb-0";
    title.textContent = "Hierarchical Filters";
    cardHeader.appendChild(title);

    // Create card body
    const cardBody = document.createElement("div");
    cardBody.className = "report-body";
    filterCard.appendChild(cardBody);

    let filtersInserted = false;

    // Identify the fields used in this report
    const { rowVariableId, columnVariableId } = this.reportData.config;

    // Check if the row variable is a nested-select field
    if (rowVariableId) {
      const rowField = this.getFieldMetadata(rowVariableId);

      if (rowField && rowField.field_type === "nested-select") {
        this.createNestedSelectFilter(cardBody, rowVariableId, rowField, "row");
        filtersInserted = true;
      }
    }

    // Check if the column variable is a nested-select field
    if (columnVariableId) {
      const columnField = this.getFieldMetadata(columnVariableId);

      if (columnField && columnField.field_type === "nested-select") {
        this.createNestedSelectFilter(
          cardBody,
          columnVariableId,
          columnField,
          "column"
        );
        filtersInserted = true;
      }
    }

    // Insert the filters into the DOM if we created any
    if (filtersInserted) {
      // Find appropriate location to insert filters
      const tabContent = document.querySelector(".tab-content");
      if (tabContent) {
        // Insert before the first tab
        tabContent.parentNode.insertBefore(container, tabContent);
      } else {
        console.error(
          "Could not find tab-content to insert hierarchical filters"
        );
      }
    }
  }

  // Helper method to get field metadata from various sources
  getFieldMetadata(fieldId) {
    if (!fieldId) return null;

    // Convert to string for comparison
    const id = fieldId.toString();

    // First check if the field is directly available in the report data
    if (this.reportData) {
      if (
        this.reportData.rowField &&
        this.reportData.rowField.id.toString() === id
      ) {
        return this.reportData.rowField;
      }

      if (
        this.reportData.columnField &&
        this.reportData.columnField.id.toString() === id
      ) {
        return this.reportData.columnField;
      }
    }

    // Then check in the allFields array
    if (this.allFields && this.allFields.length > 0) {
      const field = this.allFields.find((f) => f.id.toString() === id);
      if (field) return field;
    }

    if (window.formFields) {
      const field = window.formFields.find((f) => f.id.toString() === id);
      if (field) return field;
    }

    // Create a minimal field object if we couldn't find it
    console.warn(`Could not find complete metadata for field ${fieldId}`);
    return {
      id: fieldId,
      field_type: "nested-select", // Assume it's a nested-select since we're in this context
      display_name: `Field ${fieldId}`,
      options: [], // Empty options as a fallback
    };
  }

  createNestedSelectFilter(container, fieldId, fieldData, variableType) {
    // Create filter container
    const filterContainer = document.createElement("div");
    filterContainer.id = `nestedSelectFilter_${fieldId}`;
    filterContainer.className =
      "nested-select-filter p-3 mb-3 bg-light rounded border";

    // Add title
    const title = document.createElement("h6");
    title.className = "mb-3 fw-bold";
    title.style.color = "#495057";
    if (variableType === "row") {
      title.textContent = `${fieldData.display_name} (Row Variable)`;
    } else if (variableType === "column") {
      title.textContent = `${fieldData.display_name} (Column Variable)`;
    } else {
      title.textContent = `${fieldData.display_name}`;
    }
    filterContainer.appendChild(title);

    // Parse the options structure - may be a JSON string
    let levelsStructure = [];
    let rawOptions = fieldData.options;

    try {
      // Options might be stored as a JSON string
      if (typeof rawOptions === "string") {
        try {
          rawOptions = JSON.parse(rawOptions);
        } catch (e) {
          console.warn(`Could not parse options as JSON: ${e.message}`);
          // Keep as string, we'll handle it below
        }
      }

      // Examine options to determine format
      if (!rawOptions) {
        console.warn("No options data found for field, using empty structure");
        levelsStructure = [{ level: 1, name: "Level 1", options: [] }];
      } else if (Array.isArray(rawOptions)) {
        // Check if it's an array of level definitions
        if (
          rawOptions.length > 0 &&
          (rawOptions[0].level !== undefined ||
            rawOptions[0].name !== undefined)
        ) {
          levelsStructure = rawOptions;
        }
        // Check if it's an array of parent-child objects
        else if (
          rawOptions.length > 0 &&
          rawOptions[0].children !== undefined
        ) {
          // Extract first and second levels from parent-child structure
          const level1Options = rawOptions.map(
            (item) => item.value || item.label || item.name || item
          );

          levelsStructure = [
            {
              level: 1,
              name: "Level 1",
              options: level1Options,
            },
            {
              level: 2,
              name: "Level 2",
              options: rawOptions, // Keep full structure for getChildOptions to use
            },
          ];
        }
        // Simple array of options - treat as a single level
        else {
          levelsStructure = [
            {
              level: 1,
              name: "Level 1",
              options: rawOptions,
            },
          ];
        }
      }
      // If it's a structured object with metadata
      else if (typeof rawOptions === "object") {
        if (rawOptions.levels && Array.isArray(rawOptions.levels)) {
          levelsStructure = rawOptions.levels;
        } else if (rawOptions.options && Array.isArray(rawOptions.options)) {
          levelsStructure = [
            {
              level: 1,
              name: "Level 1",
              options: rawOptions.options,
            },
          ];
        }
      }

      // Check if we have levels with string options that need to be parsed (parent:child format)
      levelsStructure.forEach((level, i) => {
        if (typeof level.options === "string" && level.options.includes(":")) {
          // Don't parse here, we'll do it in getChildOptions
        }
      });

      // If we still have no structure, create an empty array
      if (levelsStructure.length === 0) {
        console.warn("Could not determine levels structure");
        levelsStructure = [];
      }
    } catch (error) {
      console.error("Error processing nested select options:", error);
      levelsStructure = [];
    }

    // Store the levels structure on the filter container for later access
    filterContainer.dataset.levelsStructure = JSON.stringify(levelsStructure);

    // Create select container
    const selectContainer = document.createElement("div");
    selectContainer.className = "row g-3";

    // Create dropdowns for each level - let's always show at least 2 levels
    const numLevels = Math.max(2, levelsStructure.length);

    for (let index = 0; index < numLevels; index++) {
      const levelInfo = levelsStructure[index] || {
        level: index + 1,
        name: `Level ${index + 1}`,
        options: [],
      };

      const col = document.createElement("div");
      col.className = "col-md-6";

      const formGroup = document.createElement("div");
      formGroup.className = "form-group";
      col.appendChild(formGroup);

      const label = document.createElement("label");
      label.className = "form-label";
      label.textContent = levelInfo.name || `Level ${index + 1}`;
      formGroup.appendChild(label);

      const select = document.createElement("select");
      select.className = "form-select nested-level-select";
      select.id = `level${index + 1}Select_${fieldId}`;
      select.dataset.level = index + 1;

      // Add default option
      const defaultOption = document.createElement("option");
      defaultOption.value = "default";
      defaultOption.textContent = `Select ${
        levelInfo.name || `Level ${index + 1}`
      }`;
      select.appendChild(defaultOption);

      // Disable all selects after the first one initially
      if (index > 0) {
        select.disabled = true;
      }

      // Add event listener to handle level changes
      select.addEventListener("change", (e) => {
        this.handleNestedLevelChange(e.target, index);
      });

      formGroup.appendChild(select);
      selectContainer.appendChild(col);
    }

    filterContainer.appendChild(selectContainer);
    container.appendChild(filterContainer);

    // Populate options for first level
    this.populateNestedLevelOptions(fieldId, filterContainer, levelsStructure);
  }

  populateNestedLevelOptions(fieldId, filterContainer, levelsStructure) {
    // Find the first level select within this container
    const firstLevelSelect = filterContainer.querySelector(
      '.nested-level-select[data-level="1"]'
    );
    if (!firstLevelSelect) return;

    // Clear existing options except the default
    firstLevelSelect.innerHTML = `<option value="default">Select ${firstLevelSelect.previousElementSibling.textContent}</option>`;

    // Get options for first level
    let firstLevelOptions = [];
    try {
      // Get from the structure
      firstLevelOptions = levelsStructure[0].options;

      // If options is a string (e.g., line-break separated), convert to array
      if (typeof firstLevelOptions === "string") {
        firstLevelOptions = firstLevelOptions
          .split(/[\n,]/)
          .map((opt) => opt.trim())
          .filter((opt) => opt);
      }
    } catch (error) {
      console.error("Error getting first level options:", error);
      firstLevelOptions = [];
    }

    // Add options to the first level select
    firstLevelOptions.forEach((option) => {
      const optionElement = document.createElement("option");
      optionElement.value = option;
      optionElement.textContent = option;
      firstLevelSelect.appendChild(optionElement);
    });
  }

  // Helper method to extract child options based on parent selection
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

  handleNestedLevelChange(selectElement, levelIndex) {
    const fieldId = selectElement.id.split("_")[1];
    const selectedValue = selectElement.value;
    const currentLevel = parseInt(selectElement.dataset.level);

    // Get the filter container
    const filterContainer = document.getElementById(
      `nestedSelectFilter_${fieldId}`
    );
    if (!filterContainer) {
      console.error("Could not find filter container for field", fieldId);
      return;
    }

    // Find all level selects within this container
    const levelSelects = Array.from(
      filterContainer.querySelectorAll(".nested-level-select")
    );

    // Handle default selection (user clearing a level)
    if (selectedValue === "default") {
      // Reset but DON'T disable all levels after the current one
      // This is the key change to maintain consistency with the report generator
      for (let i = currentLevel; i < levelSelects.length; i++) {
        const nextSelect = levelSelects[i];
        if (nextSelect) {
          // Clear options but keep the default option
          nextSelect.innerHTML = `<option value="default">Select ${nextSelect.previousElementSibling.textContent}</option>`;

          // Important: Don't disable the select
          // nextSelect.disabled = true;  // Removed this line
        }
      }

      // Apply filter with current selection
      this.applyHierarchicalFilter(fieldId, filterContainer);
      return;
    }

    // Get field metadata to identify levels structure
    let levelsStructure = [];

    // First try to get it from the stored data attribute
    try {
      if (filterContainer.dataset.levelsStructure) {
        levelsStructure = JSON.parse(filterContainer.dataset.levelsStructure);
      }
    } catch (e) {
      console.warn("Could not parse levels structure from data attribute", e);
    }

    // If that failed, fall back to getting it from field metadata
    if (!levelsStructure || !levelsStructure.length) {
      const field = this.getFieldMetadata(fieldId);

      // Extract levels structure from field metadata
      if (field && field.options) {
        if (typeof field.options === "string") {
          try {
            levelsStructure = JSON.parse(field.options);
          } catch (e) {}
        } else {
          levelsStructure = field.options;
        }
      } else if (field && field.metadata && field.metadata.levels) {
        levelsStructure = field.metadata.levels;
      } else {
        // Create a default single level structure if no proper metadata is found
        console.warn(`No levels structure found for field ${fieldId}`);
      }
    }

    // Get the next level select if it exists
    if (currentLevel < levelSelects.length) {
      const nextLevelSelect = levelSelects[currentLevel];
      if (!nextLevelSelect) return;

      // Clear existing options in the next level but keep the default option
      nextLevelSelect.innerHTML = `<option value="default">Select ${nextLevelSelect.previousElementSibling.textContent}</option>`;

      // Always ensure the next level is enabled
      nextLevelSelect.disabled = false;

      // Find child options based on selected value
      const childOptions = this.getChildOptions(
        levelsStructure,
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
        // If no child options were found, leave next level enabled but with just the default option
        // This maintains consistency with the reports generator behavior
      }
    }

    // ALWAYS apply the filter with the current selections
    this.applyHierarchicalFilter(fieldId, filterContainer);
  }

  applyHierarchicalFilter(fieldId, filterContainer) {
    // Find all level selects in the container
    const levelSelects = Array.from(
      filterContainer.querySelectorAll(".nested-level-select")
    );

    // Track the deepest selected level and gather values
    let deepestSelectedLevel = -1;
    const selectedValues = [];
    const selectedPath = []; // For display purposes

    // Get the selected values at each level
    levelSelects.forEach((select, index) => {
      const value = select.value;
      if (value !== "default") {
        selectedValues[index] = value;
        selectedPath.push(value);
        deepestSelectedLevel = index;
      }
    });

    // If no selection, clear filters for this field
    if (deepestSelectedLevel < 0) {
      // Remove any existing filters for this field
      if (this.reportData.config.filters) {
        this.reportData.config.filters = this.reportData.config.filters.filter(
          (filter) => filter.fieldId !== fieldId
        );
      }

      // Regenerate report without this filter
      this.generateReportVisualization();
      return;
    }

    // Create filter object
    const hierarchicalFilter = {
      fieldId: fieldId,
      operator: "equals",
      level: deepestSelectedLevel + 1, // Convert to 1-based level
      value: selectedValues[deepestSelectedLevel],
      hierarchyPath: selectedValues.filter((v) => v),
      // Add display value for UI (not used in this implementation, but useful for debugging)
      displayValue: selectedPath.join(" > "),
    };

    // Add to the filters in the report config
    if (!this.reportData.config.filters) {
      this.reportData.config.filters = [];
    }

    // Check if we already have a filter for this field
    const existingFilterIndex = this.reportData.config.filters.findIndex(
      (filter) => filter.fieldId.toString() === fieldId.toString()
    );

    if (existingFilterIndex !== -1) {
      // Replace the existing filter
      this.reportData.config.filters[existingFilterIndex] = hierarchicalFilter;
    } else {
      // Add the new filter
      this.reportData.config.filters.push(hierarchicalFilter);
    }

    // Regenerate the report visualization
    this.generateReportVisualization();
  }

  // For backward compatibility
  exportToCsv() {
    // Call the new Excel export function instead
    this.exportToExcel();
  }
}

// Initialize ReportView on page load
window.addEventListener("DOMContentLoaded", () => {
  window.reportView = new ReportView();
});
