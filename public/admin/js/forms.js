class FormManager {
  constructor() {
    this.sections = [];
    this.checkAdminAccess();
  }

  async checkAdminAccess() {
    try {
      const userInfo = AuthManager.getUserInfo();
      if (!userInfo || userInfo.role !== "admin") {
        document.getElementById("authLoader").style.display = "none";
        document.getElementById("mainContent").innerHTML = `
          <div class="admin-top-bar">
            <div class="left-links">
              <a href="/admin/dashboard">Dashboard</a>
              <a href="/admin/reports">Reports</a>
              <a href="/admin/forms" class="active">Form Management</a>
              <a href="/admin/news/index.html">News</a>
              <a href="/admin/events/index.html">Events</a>
              <a href="/admin/logbook">Logs</a>
              <a href="/admin/users">Users</a>
            </div>
            <div class="right-links">
              <span id="userInfo">${
                userInfo?.full_name || userInfo?.email || ""
              }</span>
              <button id="logoutBtn" class="btn btn-link" onclick="AuthManager.logout()">Logout</button>
            </div>
          </div>
          <header class="main-header">
            <div class="logo-section">
              <img
                src="/images/emblem.png"
                alt="Government of India Emblem"
                class="emblem-logo"
              />
              <div class="header-text">
                <h1>District Disability Rehabilitation Centre, Mumbai</h1>
                <p>Department of Empowerment of Persons with Disabilities,</p>
                <p>Ministry of Social Justice and Empowerment</p>
              </div>
              <img src="/images/ddrc-logo.png" alt="DDRC Logo" class="ddrc-logo" />
            </div>
          </header>
          <div class="admin-content">
            <div class="dashboard-header">
              <h1>Form Management</h1>
              <p class="text-muted">Manage form sections and fields</p>
            </div>
            <div class="content-card p-0">
              <div class="unauthorized-container">
                <div class="icon-container mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="M8 11h8"/>
                  </svg>
                </div>
                <h2 class="mb-3">Access Restricted</h2>
                <p class="text-muted mb-4">This section is only accessible to administrators.</p>
                <div class="action-buttons">
                  <a href="/admin/dashboard" class="btn btn-primary">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="me-2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                      <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    Back to Dashboard
                  </a>
                </div>
              </div>
            </div>
          </div>`;

        // Add custom styles for unauthorized page
        const style = document.createElement("style");
        style.textContent = `
          .unauthorized-container {
            padding: 4rem 2rem;
            text-align: center;
            background: #fff;
            border-radius: 8px;
          }
          .icon-container {
            width: 80px;
            height: 80px;
            margin: 0 auto;
            background: #fee2e2;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .icon-container svg {
            color: #dc2626;
          }
          .action-buttons {
            display: flex;
            justify-content: center;
            gap: 1rem;
          }
          .action-buttons .btn {
            display: inline-flex;
            align-items: center;
            padding: 0.75rem 1.5rem;
            font-weight: 500;
          }
          .action-buttons svg {
            margin-right: 0.5rem;
          }
        `;
        document.head.appendChild(style);
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error checking admin access:", error);
      return false;
    }
  }

  async initialize() {
    try {
      // Fetch form sections
      const response = await fetchWithAuth("/api/form/sections");
      this.sections = await response.json();
      renderFormSections(this.sections);

      // Initialize event listeners
      initializeFormEventListeners();
    } catch (error) {
      console.error("Error initializing form management:", error);
    }
  }

  // Add method to get all fields across sections
  getAllFields() {
    return this.sections.flatMap((section) =>
      section.fields.map((field) => ({
        ...field,
        sectionName: section.name,
      }))
    );
  }
}

async function initializeFormManagement() {
  try {
    // Fetch form sections
    const response = await fetchWithAuth("/api/form/sections");
    const sections = await response.json();
    renderFormSections(sections);

    // Initialize event listeners
    initializeFormEventListeners();
  } catch (error) {
    console.error("Error initializing form management:", error);
  }
}

function initializeFormEventListeners() {
  // Add Section button
  document.getElementById("addSectionBtn").addEventListener("click", () => {
    const modal = new bootstrap.Modal(document.getElementById("sectionModal"));
    modal.show();
  });

  // Save Section button
  document
    .getElementById("saveSectionBtn")
    .addEventListener("click", saveSection);

  // Field type change
  document.getElementById("fieldType").addEventListener("change", (e) => {
    const optionsContainer = document.querySelector(".field-options-container");
    const fileSizeContainer = document.querySelector(".file-size-container");
    const nestedOptionsContainer = document.querySelector(
      ".nested-options-container"
    );
    const validationRulesContainer = document.querySelector(".validation-rules-container");
    const numberRangeContainer = document.querySelector(".number-range-container");

    // Reset all containers
    optionsContainer.style.display = "none";
    fileSizeContainer.style.display = "none";
    nestedOptionsContainer.style.display = "none";
    validationRulesContainer.style.display = "none";
    numberRangeContainer.style.display = "none";

    if (["select", "radio", "checkbox"].includes(e.target.value)) {
      optionsContainer.style.display = "block";

      // Clear existing options
      document.getElementById("options").value = "";

      // For radio buttons, add conditional logic container
      if (e.target.value === "radio") {
        // Remove existing conditional logic container if any
        const existingContainer = optionsContainer.querySelector(
          ".conditional-logic-container"
        );
        if (existingContainer) {
          existingContainer.remove();
        }

        // Add new conditional logic container
        const conditionalLogicContainer = document.createElement("div");
        conditionalLogicContainer.className =
          "conditional-logic-container mt-3";
        conditionalLogicContainer.innerHTML = `
          <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h6 class="mb-0">Conditional Logic</h6>
              <button type="button" class="btn btn-sm btn-outline-primary" onclick="addConditionalLogic()">
                Add Condition
              </button>
            </div>
            <div class="card-body conditional-rules">
              <p class="text-muted mb-0">Add options above to configure conditions</p>
            </div>
          </div>
        `;
        optionsContainer.appendChild(conditionalLogicContainer);

        // Add input event listener for options textarea
        document
          .getElementById("options")
          .addEventListener("input", updateConditionalLogicOptions);
      }
    } else if (e.target.value === "file") {
      fileSizeContainer.style.display = "block";
    } else if (e.target.value === "nested-select") {
      nestedOptionsContainer.style.display = "block";
    } else if (["text", "alphanumeric", "email", "tel"].includes(e.target.value)) {
      // Show validation rules for text-based fields
      validationRulesContainer.style.display = "block";
    } else if (e.target.value === "number") {
      // Show both validation rules and number range for number fields
      validationRulesContainer.style.display = "block";
      numberRangeContainer.style.display = "block";
    }
  });

  // Save Field button
  document.getElementById("saveFieldBtn").addEventListener("click", saveField);
  
  // Pattern tester functionality
  setupPatternTester();
}

function setupPatternTester() {
  const patternInput = document.getElementById("validationPattern");
  const patternTesterContainer = document.getElementById("patternTesterContainer");
  const patternTestInput = document.getElementById("patternTestInput");
  const patternTestResult = document.getElementById("patternTestResult");
  
  if (!patternInput || !patternTesterContainer) return;
  
  // Show/hide pattern tester based on whether pattern is entered
  patternInput.addEventListener('input', function() {
    if (this.value.trim()) {
      patternTesterContainer.style.display = 'block';
      testPattern();
    } else {
      patternTesterContainer.style.display = 'none';
      patternTestResult.innerHTML = '';
    }
  });
  
  // Test pattern as user types in test input
  patternTestInput.addEventListener('input', testPattern);
  
  function testPattern() {
    const pattern = patternInput.value.trim();
    const testValue = patternTestInput.value;
    
    if (!pattern) {
      patternTestResult.innerHTML = '';
      return;
    }
    
    // Strip ^ and $ if present (since HTML pattern adds them automatically)
    const cleanPattern = pattern.replace(/^\^/, '').replace(/\$$/, '');
    
    try {
      const regex = new RegExp(`^${cleanPattern}$`);
      
      if (!testValue) {
        patternTestResult.innerHTML = `
          <div class="alert alert-secondary mb-0">
            <small>Enter a test value to see if it matches the pattern</small>
          </div>
        `;
        return;
      }
      
      const matches = regex.test(testValue);
      
      if (matches) {
        patternTestResult.innerHTML = `
          <div class="alert alert-success mb-0">
            <strong>✅ Valid!</strong> "${testValue}" matches the pattern
          </div>
        `;
      } else {
        patternTestResult.innerHTML = `
          <div class="alert alert-danger mb-0">
            <strong>❌ Invalid!</strong> "${testValue}" does not match the pattern
          </div>
        `;
      }
    } catch (error) {
      patternTestResult.innerHTML = `
        <div class="alert alert-warning mb-0">
          <strong>⚠️ Invalid Pattern!</strong> ${error.message}
        </div>
      `;
    }
  }
}

function renderFormSections(sections) {
  const container = document.querySelector(".sections-container");
  container.innerHTML = sections
    .map(
      (section) => `
    <div class="section-item" data-section-id="${section.id}">
      <div class="section-header">
        <h3>${section.name}</h3>
        <div class="section-actions">
          <button class="btn btn-primary btn-sm add-field-btn">Add Field</button>
          <button class="btn btn-danger btn-sm delete-section-btn">Delete</button>
        </div>
      </div>
      <div class="fields-container">
        ${renderFields(section.fields)}
      </div>
    </div>
  `
    )
    .join("");

  // Add event listeners for the new buttons
  addSectionEventListeners();
}

function renderFields(fields) {
  return fields
    .map(
      (field) => `
    <div class="field-item" data-field-id="${field.id}">
      <div class="field-info">
        <span class="field-name">${field.display_name}</span>
        <span class="field-type">${
          field.field_type === "nested-select"
            ? "Nested Dropdown"
            : field.field_type
        }</span>
        ${
          field.is_required
            ? '<span class="required-badge">Required</span>'
            : ""
        }
        ${
          field.field_type === "file"
            ? `<span class="badge rounded-pill bg-light text-dark border">
                Max: ${field.max_file_size || 5}MB | Types: ${
                field.allowed_types || ".pdf,.jpg,.jpeg,.png"
              }
               </span>`
            : ""
        }
        ${
          field.field_type === "nested-select"
            ? `<span class="badge rounded-pill bg-light text-dark border">
                ${(() => {
                  try {
                    const config = JSON.parse(field.options);
                    return `${config.length} Levels`;
                  } catch (e) {
                    return "0 Levels";
                  }
                })()}
               </span>`
            : ""
        }
      </div>
      <div class="field-actions">
        <button class="btn btn-sm btn-outline-primary edit-field-btn">Edit</button>
        <button class="btn btn-sm btn-outline-danger delete-field-btn">Delete</button>
      </div>
    </div>
  `
    )
    .join("");
}

async function saveSection() {
  const sectionName = document.getElementById("sectionName").value.trim();
  if (!sectionName) {
    alert("Please enter a section name");
    return;
  }

  try {
    const response = await fetchWithAuth("/api/form/sections", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: sectionName }),
    });

    if (!response.ok) {
      throw new Error("Failed to create section");
    }

    // Refresh sections
    await initializeFormManagement();

    // Close modal and reset form
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("sectionModal")
    );
    modal.hide();
    document.getElementById("sectionName").value = "";
  } catch (error) {
    alert("Failed to save section. Please try again.");
  }
}

async function saveField() {
  const form = document.getElementById("fieldModal");
  const fieldName = form.querySelector("#fieldName").value.trim();
  const displayName = form.querySelector("#displayName").value.trim();
  const fieldType = form.querySelector("#fieldType").value;
  const isRequired = form.querySelector("#required").checked;
  const sectionId = form.dataset.sectionId;
  const fieldId = form.dataset.fieldId;

  let fieldData = {
    name: fieldName,
    display_name: displayName,
    field_type: fieldType,
    is_required: isRequired,
  };

  // Add options for select/radio/checkbox fields
  if (["select", "radio", "checkbox"].includes(fieldType)) {
    const options = form
      .querySelector("#options")
      .value.split("\n")
      .map((opt) => opt.trim())
      .filter((opt) => opt);

    if (fieldType === "radio") {
      // Get conditional logic
      const conditionalLogic = {};
      form.querySelectorAll(".conditional-rule").forEach((rule) => {
        const optionText = rule
          .querySelector("strong")
          .textContent.match(/\"([^\"]+)\"/)[1];
        const showFields = Array.from(
          rule.querySelector(".show-fields").selectedOptions
        ).map((opt) => parseInt(opt.value));
        const hideFields = Array.from(
          rule.querySelector(".hide-fields").selectedOptions
        ).map((opt) => parseInt(opt.value));

        conditionalLogic[optionText] = {
          show: showFields,
          hide: hideFields,
        };
      });

      // Store as object directly, not as JSON string
      fieldData.options = {
        options,
        conditionalLogic,
      };
    } else {
      // For select and checkbox, store as array directly
      fieldData.options = options;
    }
  }

  // Add file configuration for file type fields
  if (fieldType === "file") {
    fieldData.max_file_size =
      parseInt(form.querySelector("#maxFileSize").value) || 5;
    fieldData.allowed_types =
      form.querySelector("#allowedTypes").value.trim() ||
      ".pdf,.jpg,.jpeg,.png";
  }

  // Handle nested-select type
  if (fieldType === "nested-select") {
    const levelNames = Array.from(
      form.querySelectorAll('[name="level_names[]"]')
    )
      .map((input) => input.value.trim())
      .filter((name) => name);

    const levelOptions = Array.from(
      form.querySelectorAll('[name="level_options[]"]')
    )
      .map((textarea) => textarea.value.trim())
      .filter((options) => options);

    // Store nested configuration as an array of objects
    const nestedConfig = levelNames.map((name, index) => ({
      level: index + 1,
      name: name,
      options: levelOptions[index] || "",
    }));

    // Store config directly as an object, let JSON.stringify handle it in the request
    fieldData.options = nestedConfig;
  }

  // Add validation rules for applicable field types
  if (["text", "alphanumeric", "email", "tel", "number"].includes(fieldType)) {
    const validationRules = {};
    
    // Get custom pattern and message
    const pattern = form.querySelector("#validationPattern")?.value.trim();
    const message = form.querySelector("#validationMessage")?.value.trim();
    const minLength = form.querySelector("#minLength")?.value;
    const maxLength = form.querySelector("#maxLength")?.value;
    
    if (pattern) validationRules.pattern = pattern;
    if (message) validationRules.message = message;
    if (minLength) validationRules.minLength = parseInt(minLength);
    if (maxLength) validationRules.maxLength = parseInt(maxLength);
    
    // Add number-specific validation
    if (fieldType === "number") {
      const minValue = form.querySelector("#minValue")?.value;
      const maxValue = form.querySelector("#maxValue")?.value;
      
      if (minValue) validationRules.min = parseFloat(minValue);
      if (maxValue) validationRules.max = parseFloat(maxValue);
    }
    
    // Only add validation_rules if there are any rules
    if (Object.keys(validationRules).length > 0) {
      fieldData.validation_rules = validationRules;
    }
  }

  try {
    const url = fieldId
      ? `/api/form/fields/${fieldId}`
      : `/api/form/sections/${sectionId}/fields`;

    const response = await fetchWithAuth(url, {
      method: fieldId ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fieldData),
    });

    if (!response.ok) throw new Error("Failed to save field");

    // Refresh sections
    const sectionsResponse = await fetchWithAuth("/api/form/sections");
    if (sectionsResponse.ok) {
      const sections = await sectionsResponse.json();
      renderFormSections(sections);
    }

    // Close modal
    bootstrap.Modal.getInstance(form).hide();
  } catch (error) {
    console.error("Error saving field:", error);
    alert("Failed to save field");
  }
}

function addSectionEventListeners() {
  // Add Field buttons
  document.querySelectorAll(".add-field-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const sectionId = e.target.closest(".section-item").dataset.sectionId;
      const modal = document.getElementById("fieldModal");
      modal.dataset.sectionId = sectionId;
      resetFieldForm();
      new bootstrap.Modal(modal).show();
    });
  });

  // Delete Section buttons
  document.querySelectorAll(".delete-section-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      if (
        !confirm(
          "Are you sure you want to delete this section and all its fields?"
        )
      ) {
        return;
      }

      const sectionId = e.target.closest(".section-item").dataset.sectionId;
      try {
        const response = await fetchWithAuth(
          `/api/form/sections/${sectionId}`,
          {
            method: "DELETE",
          }
        );

        if (!response.ok) {
          throw new Error("Failed to delete section");
        }

        // Refresh sections
        await initializeFormManagement();
      } catch (error) {
        alert("Failed to delete section. Please try again.");
      }
    });
  });

  // Delete Field buttons
  document.querySelectorAll(".delete-field-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      if (!confirm("Are you sure you want to delete this field?")) {
        return;
      }

      const fieldId = e.target.closest(".field-item").dataset.fieldId;
      try {
        const response = await fetchWithAuth(`/api/form/fields/${fieldId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to delete field");
        }

        // Refresh sections
        await initializeFormManagement();
      } catch (error) {
        alert("Failed to delete field. Please try again.");
      }
    });
  });

  // Edit Field buttons
  document.querySelectorAll(".edit-field-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const fieldId = e.target.closest(".field-item").dataset.fieldId;
      try {
        const response = await fetchWithAuth(`/api/form/fields/${fieldId}`);
        if (!response.ok) throw new Error("Failed to fetch field");

        const field = await response.json();
        const modal = document.getElementById("fieldModal");
        modal.dataset.fieldId = fieldId;
        modal.dataset.sectionId = field.section_id;
        populateFieldForm(field);
        new bootstrap.Modal(modal).show();
      } catch (error) {
        console.error("Error editing field:", error);
        alert("Failed to edit field");
      }
    });
  });
}

function resetFieldForm() {
  const form = document.getElementById("fieldModal");
  form.querySelector("#fieldName").value = "";
  form.querySelector("#displayName").value = "";
  form.querySelector("#fieldType").value = "text";
  form.querySelector("#required").checked = false;
  form.querySelector("#options").value = "";
  form.querySelector(".field-options-container").style.display = "none";
  form.querySelector(".file-size-container").style.display = "none";
  form.querySelector(".nested-options-container").style.display = "none";
  
  // Reset validation rules fields
  if (form.querySelector("#validationPattern")) {
    form.querySelector("#validationPattern").value = "";
  }
  if (form.querySelector("#validationMessage")) {
    form.querySelector("#validationMessage").value = "";
  }
  if (form.querySelector("#minLength")) {
    form.querySelector("#minLength").value = "";
  }
  if (form.querySelector("#maxLength")) {
    form.querySelector("#maxLength").value = "";
  }
  if (form.querySelector("#minValue")) {
    form.querySelector("#minValue").value = "";
  }
  if (form.querySelector("#maxValue")) {
    form.querySelector("#maxValue").value = "";
  }
  
  // Reset pattern tester
  const patternTesterContainer = form.querySelector("#patternTesterContainer");
  const patternTestInput = form.querySelector("#patternTestInput");
  const patternTestResult = form.querySelector("#patternTestResult");
  if (patternTesterContainer) {
    patternTesterContainer.style.display = "none";
  }
  if (patternTestInput) {
    patternTestInput.value = "";
  }
  if (patternTestResult) {
    patternTestResult.innerHTML = "";
  }
  
  // Show validation rules container for default "text" field type
  form.querySelector(".validation-rules-container").style.display = "block";
  form.querySelector(".number-range-container").style.display = "none";
  
  delete form.dataset.fieldId;
}

function populateFieldForm(field) {
  const form = document.getElementById("fieldModal");
  if (!form) return;

  form.querySelector("#fieldName").value = field.name;
  form.querySelector("#displayName").value = field.display_name;
  form.querySelector("#fieldType").value = field.field_type;
  form.querySelector("#required").checked = field.is_required;

  const optionsContainer = form.querySelector(".field-options-container");
  const fileSizeContainer = form.querySelector(".file-size-container");
  const nestedOptionsContainer = form.querySelector(
    ".nested-options-container"
  );

  // Reset all containers
  optionsContainer.style.display = "none";
  fileSizeContainer.style.display = "none";
  nestedOptionsContainer.style.display = "none";

  if (["select", "radio", "checkbox"].includes(field.field_type)) {
    optionsContainer.style.display = "block";
    let options = [];
    let parsedOptions = field.options;

    try {
      // If options is a string, try to parse it
      if (typeof field.options === "string") {
        parsedOptions = JSON.parse(field.options);
      }

      // Handle different formats based on field type
      if (field.field_type === "radio") {
        options = Array.isArray(parsedOptions.options)
          ? parsedOptions.options
          : typeof parsedOptions === "object" && parsedOptions.options
          ? parsedOptions.options
          : [];
      } else {
        options = Array.isArray(parsedOptions)
          ? parsedOptions
          : typeof parsedOptions === "string"
          ? parsedOptions.split(",").map((opt) => opt.trim())
          : [];
      }
    } catch (e) {
      console.error("Error parsing options:", e);
      options = [];
    }

    form.querySelector("#options").value = options.join("\n");

    // Handle conditional logic for radio buttons
    if (field.field_type === "radio") {
      const conditionalLogicContainer = document.createElement("div");
      conditionalLogicContainer.className = "conditional-logic-container mt-3";
      conditionalLogicContainer.innerHTML = `
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h6 class="mb-0">Conditional Logic</h6>
            <button type="button" class="btn btn-sm btn-outline-primary" onclick="addConditionalLogic()">
              Add Condition
            </button>
          </div>
          <div class="card-body conditional-rules">
            ${renderConditionalLogic(parsedOptions)}
          </div>
        </div>
      `;
      optionsContainer.appendChild(conditionalLogicContainer);
    }
  } else if (field.field_type === "file") {
    fileSizeContainer.style.display = "block";
    form.querySelector("#maxFileSize").value = field.max_file_size || 5;
    form.querySelector("#allowedTypes").value =
      field.allowed_types || ".pdf,.jpg,.jpeg,.png";
  } else if (field.field_type === "nested-select") {
    nestedOptionsContainer.style.display = "block";
    const levelsContainer =
      nestedOptionsContainer.querySelector(".nested-levels");
    if (!levelsContainer) return;

    levelsContainer.innerHTML = ""; // Clear existing levels

    try {
      let nestedConfig = [];
      if (typeof field.options === "string") {
        try {
          nestedConfig = JSON.parse(field.options);
          // Handle double-encoded JSON
          if (typeof nestedConfig === "string") {
            nestedConfig = JSON.parse(nestedConfig);
          }
        } catch (e) {
          console.error("Error parsing nested config:", e);
          nestedConfig = [];
        }
      } else {
        nestedConfig = field.options || [];
      }

      if (nestedConfig.length === 0) {
        addDefaultLevel(levelsContainer);
      } else {
        nestedConfig.forEach((level, index) => {
          const levelElement = document.createElement("div");
          levelElement.className = "nested-level mb-4";

          const placeholder =
            index === 0
              ? "तालुका / म.न.पा. / Tahsil / Municipality"
              : index === 1
              ? "ग्रा.पं / प्रभाग / Grampanchayat / Ward"
              : "Sector";

          const optionsPlaceholder =
            index === 0
              ? "अंधेरी\nबोरीवली\nकुर्ला\nबृहन्मुंबई महानगरपालिका"
              : "ParentOption:Option1, Option2";

          levelElement.innerHTML = `
            <div class="card shadow-sm">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-3">
                  <h6 class="card-title mb-0 text-primary">Level ${
                    index + 1
                  }</h6>
                  <button type="button" class="btn-plain remove-level">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9.41421 8L15.7782 1.63604C16.0718 1.34245 16.0718 0.867544 15.7782 0.573954C15.4846 0.280364 15.0097 0.280364 14.7161 0.573954L8.35214 6.93791L1.98818 0.573954C1.69459 0.280364 1.21968 0.280364 0.926091 0.573954C0.632501 0.867544 0.632501 1.34245 0.926091 1.63604L7.29006 8L0.926091 14.364C0.632501 14.6575 0.632501 15.1325 0.926091 15.426C1.21968 15.7196 1.69459 15.7196 1.98818 15.426L8.35214 9.06209L14.7161 15.426C15.0097 15.7196 15.4846 15.7196 15.7782 15.426C16.0718 15.1325 16.0718 14.6575 15.7782 14.364L9.41421 8Z" fill="currentColor"/>
                    </svg>
                  </button>
                </div>
                
                <div class="mb-3">
                  <label class="form-label">Level Name</label>
                  <input type="text" class="form-control" placeholder="${placeholder}" name="level_names[]" value="${
            level.name || ""
          }">
                </div>
                
                <div class="mb-2">
                  <label class="form-label">Options</label>
                  <textarea class="form-control" rows="3" placeholder="${optionsPlaceholder}" name="level_options[]">${
            level.options || ""
          }</textarea>
                </div>
                
                <div class="form-text text-muted small">
                  ${
                    index === 0
                      ? "Enter each option on a new line"
                      : 'Use format "ParentOption:Option1, Option2"'
                  }
                </div>
              </div>
            </div>
          `;
          levelsContainer.appendChild(levelElement);

          // Add remove button event listener
          const removeBtn = levelElement.querySelector(".remove-level");
          if (removeBtn) {
            removeBtn.addEventListener("click", function () {
              levelElement.remove();
              updateLevelNumbers();
              updateRemoveButtonsVisibility();
              updateNestedPreview();
            });
          }
        });
      }

      updateRemoveButtonsVisibility();
      updateNestedPreview();
    } catch (e) {
      console.error("Error setting up nested config:", e);
      addDefaultLevel(levelsContainer);
    }
  }
  
  // Handle validation rules for applicable field types
  const validationRulesContainer = form.querySelector(".validation-rules-container");
  const numberRangeContainer = form.querySelector(".number-range-container");
  
  // Reset containers
  validationRulesContainer.style.display = "none";
  numberRangeContainer.style.display = "none";
  
  if (["text", "alphanumeric", "email", "tel", "number"].includes(field.field_type)) {
    validationRulesContainer.style.display = "block";
    
    // Parse validation rules if they exist
    let validationRules = {};
    if (field.validation_rules) {
      try {
        validationRules = typeof field.validation_rules === "string" 
          ? JSON.parse(field.validation_rules) 
          : field.validation_rules;
      } catch (e) {
        console.error("Error parsing validation rules:", e);
      }
    }
    
    // Populate validation fields
    form.querySelector("#validationPattern").value = validationRules.pattern || "";
    form.querySelector("#validationMessage").value = validationRules.message || "";
    form.querySelector("#minLength").value = validationRules.minLength || "";
    form.querySelector("#maxLength").value = validationRules.maxLength || "";
    
    // Show number range for number fields
    if (field.field_type === "number") {
      numberRangeContainer.style.display = "block";
      form.querySelector("#minValue").value = validationRules.min !== undefined ? validationRules.min : "";
      form.querySelector("#maxValue").value = validationRules.max !== undefined ? validationRules.max : "";
    }
  }
}

function renderConditionalLogic(options) {
  let conditionalLogic = {};

  // Handle both string and object formats
  if (typeof options === "string") {
    try {
      const parsed = JSON.parse(options);
      conditionalLogic = parsed.conditionalLogic || {};
    } catch (e) {
      console.error("Error parsing conditional logic:", e);
    }
  } else if (typeof options === "object" && options !== null) {
    conditionalLogic = options.conditionalLogic || {};
  }

  return (
    Object.entries(conditionalLogic)
      .map(
        ([option, rules]) => `
      <div class="conditional-rule mb-3">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <strong>When "${option}" is selected:</strong>
          <button type="button" class="btn-plain text-danger" onclick="removeConditionalRule(this)">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
          </button>
        </div>
        <div class="conditional-fields-container">
          <div class="mb-3">
            <label class="form-label">Show Fields</label>
            <select class="form-select show-fields" multiple>
              ${renderFieldOptions(rules.show || [])}
            </select>
          </div>
          <div class="mb-3">
            <label class="form-label">Hide Fields</label>
            <select class="form-select hide-fields" multiple>
              ${renderFieldOptions(rules.hide || [])}
            </select>
          </div>
        </div>
      </div>
    `
      )
      .join("") ||
    '<p class="text-muted mb-0">Add options above to configure conditions</p>'
  );
}

function renderFieldOptions(selectedFields = []) {
  const formManager = window.formManager;
  if (!formManager || !formManager.sections) {
    console.error("Form manager or sections not initialized");
    return "";
  }

  const currentSectionId =
    document.getElementById("fieldModal").dataset.sectionId;

  // First, render fields from the current section
  let optionsHtml = formManager.sections
    .filter((section) => section.id === parseInt(currentSectionId))
    .flatMap((section) =>
      section.fields.map(
        (field) => `
          <option value="${field.id}" ${
          selectedFields.includes(field.id) ? "selected" : ""
        }>
            ${section.name} - ${field.display_name}
          </option>
        `
      )
    )
    .join("");

  // Then, render fields from other sections
  optionsHtml += formManager.sections
    .filter((section) => section.id !== parseInt(currentSectionId))
    .flatMap((section) =>
      section.fields.map(
        (field) => `
          <option value="${field.id}" ${
          selectedFields.includes(field.id) ? "selected" : ""
        }>
            ${section.name} - ${field.display_name}
          </option>
        `
      )
    )
    .join("");

  return optionsHtml;
}

function addConditionalLogic() {
  const fieldType = document.getElementById("fieldType").value;
  if (fieldType !== "radio") return;

  const optionsText = document.getElementById("options").value;
  let options = [];
  try {
    options = optionsText
      .split("\n")
      .map((opt) => opt.trim())
      .filter((opt) => opt);
  } catch (e) {
    console.error("Error parsing options:", e);
    return;
  }

  if (options.length === 0) {
    alert("Please add radio options first");
    return;
  }

  updateConditionalLogicOptions();
}

function removeConditionalRule(button) {
  const rule = button.closest(".conditional-rule");
  rule.remove();
}

// Helper function to update level numbers
function updateLevelNumbers() {
  document.querySelectorAll(".nested-level").forEach((level, idx) => {
    const title = level.querySelector(".card-title");
    if (title) {
      title.textContent = `Level ${idx + 1}`;
    }
  });
}

// Helper function to update remove buttons visibility
function updateRemoveButtonsVisibility() {
  const removeButtons = document.querySelectorAll(".remove-level");
  const shouldShow = removeButtons.length > 1;
  removeButtons.forEach((btn) => {
    if (btn) {
      btn.style.display = shouldShow ? "block" : "none";
    }
  });
}

// Helper function to add a default level
function addDefaultLevel(container) {
  const defaultLevel = document.createElement("div");
  defaultLevel.className = "nested-level mb-4";
  defaultLevel.innerHTML = `
    <div class="card shadow-sm">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h6 class="card-title mb-0 text-primary">Level 1</h6>
          <button type="button" class="btn-plain remove-level">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9.41421 8L15.7782 1.63604C16.0718 1.34245 16.0718 0.867544 15.7782 0.573954C15.4846 0.280364 15.0097 0.280364 14.7161 0.573954L8.35214 6.93791L1.98818 0.573954C1.69459 0.280364 1.21968 0.280364 0.926091 0.573954C0.632501 0.867544 0.632501 1.34245 0.926091 1.63604L7.29006 8L0.926091 14.364C0.632501 14.6575 0.632501 15.1325 0.926091 15.426C1.21968 15.7196 1.69459 15.7196 1.98818 15.426L8.35214 9.06209L14.7161 15.426C15.0097 15.7196 15.4846 15.7196 15.7782 15.426C16.0718 15.1325 16.0718 14.6575 15.7782 14.364L9.41421 8Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
        
        <div class="mb-3">
          <label class="form-label">Level Name</label>
          <input type="text" class="form-control" placeholder="तालुका / म.न.पा. / Tahsil / Municipality" name="level_names[]">
        </div>
        
        <div class="mb-2">
          <label class="form-label">Options</label>
          <textarea class="form-control" rows="3" placeholder="अंधेरी\nबोरीवली\nकुर्ला\nबृहन्मुंबई महानगरपालिका" name="level_options[]"></textarea>
        </div>
        
        <div class="form-text text-muted small">Enter each option on a new line</div>
      </div>
    </div>
  `;
  container.appendChild(defaultLevel);

  // Add remove button event listener
  const removeBtn = defaultLevel.querySelector(".remove-level");
  if (removeBtn) {
    removeBtn.addEventListener("click", function () {
      defaultLevel.remove();
      updateLevelNumbers();
      updateRemoveButtonsVisibility();
      updateNestedPreview();
    });
  }
}

// Move the event listener initialization to DOMContentLoaded
document.addEventListener("DOMContentLoaded", async () => {
  window.formManager = new FormManager();
  if (await window.formManager.checkAdminAccess()) {
    await window.formManager.initialize();

    // Initialize event listeners for modals
    document.getElementById("addSectionBtn")?.addEventListener("click", () => {
      new bootstrap.Modal(document.getElementById("sectionModal")).show();
    });

    document
      .getElementById("saveSectionBtn")
      ?.addEventListener("click", saveSection);
    document
      .getElementById("saveFieldBtn")
      ?.addEventListener("click", saveField);

    // Field type change handler
    document.getElementById("fieldType")?.addEventListener("change", (e) => {
      const optionsContainer = document.querySelector(
        ".field-options-container"
      );
      const fileSizeContainer = document.querySelector(".file-size-container");
      const nestedOptionsContainer = document.querySelector(
        ".nested-options-container"
      );

      // Reset all containers
      optionsContainer.style.display = "none";
      fileSizeContainer.style.display = "none";
      nestedOptionsContainer.style.display = "none";

      if (["select", "radio", "checkbox"].includes(e.target.value)) {
        optionsContainer.style.display = "block";

        // Clear existing options
        document.getElementById("options").value = "";

        // For radio buttons, add conditional logic container
        if (e.target.value === "radio") {
          // Remove existing conditional logic container if any
          const existingContainer = optionsContainer.querySelector(
            ".conditional-logic-container"
          );
          if (existingContainer) {
            existingContainer.remove();
          }

          // Add new conditional logic container
          const conditionalLogicContainer = document.createElement("div");
          conditionalLogicContainer.className =
            "conditional-logic-container mt-3";
          conditionalLogicContainer.innerHTML = `
            <div class="card">
              <div class="card-header d-flex justify-content-between align-items-center">
                <h6 class="mb-0">Conditional Logic</h6>
                <button type="button" class="btn btn-sm btn-outline-primary" onclick="addConditionalLogic()">
                  Add Condition
                </button>
              </div>
              <div class="card-body conditional-rules">
                <p class="text-muted mb-0">Add options above to configure conditions</p>
              </div>
            </div>
          `;
          optionsContainer.appendChild(conditionalLogicContainer);

          // Add input event listener for options textarea
          document
            .getElementById("options")
            .addEventListener("input", updateConditionalLogicOptions);
        }
      } else if (e.target.value === "file") {
        fileSizeContainer.style.display = "block";
      } else if (e.target.value === "nested-select") {
        nestedOptionsContainer.style.display = "block";
      }
    });

    // Add nested level button handler
    document
      .getElementById("addNestedLevelBtn")
      ?.addEventListener("click", () => {
        const levelsContainer = document.querySelector(".nested-levels");
        if (!levelsContainer) return;

        const levelCount = levelsContainer.children.length + 1;
        addDefaultLevel(levelsContainer);
        updateLevelNumbers();
        updateRemoveButtonsVisibility();
        updateNestedPreview();
      });

    // Add event listeners for live preview updates
    document
      .querySelector(".nested-levels")
      ?.addEventListener("input", updateNestedPreview);
    document
      .getElementById("refreshPreviewBtn")
      ?.addEventListener("click", updateNestedPreview);
  }
});

// Update the field modal HTML in index.html to add the new field type
document.querySelector("#fieldType").innerHTML += `
  <option value="nested-select">Nested Dropdown</option>
`;

// Update the nested dropdown configuration HTML
const modalBody = document.querySelector("#fieldModal .modal-body");
modalBody.innerHTML += `
  <div class="nested-options-container" style="display: none">
    <div class="mb-4">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <label class="form-label h5 mb-0">Nested Dropdown Configuration</label>
        <button type="button" class="btn btn-sm custom-btn-primary" id="addNestedLevelBtn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" class="me-1">
            <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
          </svg>
          Add Level
        </button>
      </div>

      <div class="alert alert-info mb-3 shadow-sm">
        <div class="d-flex">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" class="me-2 flex-shrink-0 mt-1">
            <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
          </svg>
          <div class="configuration-guide">
            <strong class="d-block mb-2">Configuration Guide:</strong>
            <div class="guide-section mb-3">
              <strong class="text-primary d-block mb-1">Level 1 (तालुका / म.न.पा. / Tahsil / Municipality):</strong>
              <div class="bg-white rounded p-2 border">
                <pre class="mb-0 text-dark">अंधेरी
बोरीवली
कुर्ला
बृहन्मुंबई महानगरपालिका</pre>
              </div>
            </div>
            <div class="guide-section">
              <strong class="text-primary d-block mb-1">Level 2 (ग्रा.पं / प्रभाग / Grampanchayat / Ward):</strong>
              <div class="bg-white rounded p-2 border">
                <pre class="mb-0 text-dark">अंधेरी:आंबिवली, अंधेरी, बांदिवली
बोरीवली:आरे, आक्से, आकुर्ली</pre>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="nested-levels mb-4"></div>

      <!-- Live Preview Section -->
      <div class="preview-section border rounded p-3 bg-white shadow-sm">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h6 class="mb-0 text-primary">Live Preview</h6>
          <button type="button" class="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2" id="refreshPreviewBtn">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 3a5 5 0 0 0-5 5v.5a.5.5 0 0 1-1 0V8a6 6 0 1 1 6 6 6 6 0 0 1-6-6V7a.5.5 0 0 1 1 0v1a5 5 0 1 0 5-5z"/>
            </svg>
            Refresh Preview
          </button>
        </div>
        <div id="nestedPreview" class="p-3 rounded border"></div>
      </div>
    </div>
  </div>
`;

// Add this function to handle live preview
function updateNestedPreview() {
  const previewContainer = document.getElementById("nestedPreview");
  if (!previewContainer) return; // Guard clause if container doesn't exist

  const levelNames = Array.from(
    document.querySelectorAll('[name="level_names[]"]')
  )
    .map((input) => input.value.trim())
    .filter((name) => name);

  const levelOptions = Array.from(
    document.querySelectorAll('[name="level_options[]"]')
  )
    .map((textarea) => textarea.value.trim())
    .filter((options) => options);

  // Create preview HTML
  let previewHtml = "";
  levelNames.forEach((name, index) => {
    const options = levelOptions[index] || "";
    previewHtml += `
      <div class="form-group mb-3">
        <label class="form-label">${name}</label>
        <select class="form-select preview-select" data-level="${index + 1}">
          <option value="">Select ${name}</option>
          ${
            index === 0 && options
              ? options
                  .split("\n")
                  .map(
                    (opt) =>
                      `<option value="${opt.trim()}">${opt.trim()}</option>`
                  )
                  .join("")
              : ""
          }
        </select>
      </div>
    `;
  });

  previewContainer.innerHTML = previewHtml;

  // Add change event listeners for preview dropdowns
  document.querySelectorAll(".preview-select").forEach((select) => {
    select.addEventListener("change", function () {
      const level = parseInt(this.dataset.level);
      const selectedValue = this.value;
      const nextSelect = document.querySelector(
        `.preview-select[data-level="${level + 1}"]`
      );

      if (nextSelect && selectedValue && levelOptions[level]) {
        // Clear and disable all subsequent dropdowns
        const allSelects = document.querySelectorAll(".preview-select");
        Array.from(allSelects)
          .filter((s) => parseInt(s.dataset.level) > level)
          .forEach((s) => {
            s.innerHTML = `<option value="">Select ${s.previousElementSibling.textContent}</option>`;
            s.disabled = true;
          });

        // Enable and populate next dropdown
        nextSelect.disabled = false;
        const optionsText = levelOptions[level];
        if (!optionsText) return;

        const parentOptions = optionsText
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.startsWith(`${selectedValue}:`))
          .map((line) => {
            const parts = line.split(":");
            return parts.length > 1
              ? parts[1].split(",").map((o) => o.trim())
              : [];
          })
          .flat();

        parentOptions.forEach((opt) => {
          const option = document.createElement("option");
          option.value = opt;
          option.textContent = opt;
          nextSelect.appendChild(option);
        });
      }
    });
  });
}

// Update the add level button handler with proper remove functionality
document.getElementById("addNestedLevelBtn").addEventListener("click", () => {
  const levelsContainer = document.querySelector(".nested-levels");
  const levelCount = levelsContainer.children.length + 1;

  let placeholder = "तालुका / म.न.पा. / Tahsil / Municipality";
  let optionsPlaceholder = `Format: Enter each option on a new line
Example:
अंधेरी
बोरीवली
कुर्ला
बृहन्मुंबई महानगरपालिका`;

  if (levelCount === 2) {
    placeholder = "ग्रा.पं / प्रभाग / Grampanchayat / Ward";
    optionsPlaceholder = `Format: ParentOption:Option1, Option2
Example:
अंधेरी:आंबिवली, अंधेरी, बांदिवली
बोरीवली:आरे, आक्से, आकुर्ली`;
  } else if (levelCount === 3) {
    placeholder = "Sector";
    optionsPlaceholder = "Format: ParentOption:Option1, Option2";
  }

  const newLevel = document.createElement("div");
  newLevel.className = "nested-level";
  newLevel.innerHTML = `
    <div class="card mb-3">
      <div class="card-body position-relative">
        <h6 class="card-title text-primary mb-3">Level ${levelCount}</h6>
        ${
          levelCount > 1
            ? `
          <button type="button" class="position-absolute top-0 end-0 mt-3 me-3 btn-plain remove-level">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9.41421 8L15.7782 1.63604C16.0718 1.34245 16.0718 0.867544 15.7782 0.573954C15.4846 0.280364 15.0097 0.280364 14.7161 0.573954L8.35214 6.93791L1.98818 0.573954C1.69459 0.280364 1.21968 0.280364 0.926091 0.573954C0.632501 0.867544 0.632501 1.34245 0.926091 1.63604L7.29006 8L0.926091 14.364C0.632501 14.6575 0.632501 15.1325 0.926091 15.426C1.21968 15.7196 1.69459 15.7196 1.98818 15.426L8.35214 9.06209L14.7161 15.426C15.0097 15.7196 15.4846 15.7196 15.7782 15.426C16.0718 15.1325 16.0718 14.6575 15.7782 14.364L9.41421 8Z" fill="currentColor"/>
            </svg>
          </button>
        `
            : ""
        }
        
        <div class="mb-3">
          <label class="form-label">Level Name</label>
          <input type="text" class="form-control" placeholder="${placeholder}" name="level_names[]">
        </div>
        
        <div class="mb-2">
          <label class="form-label">Options</label>
          <textarea class="form-control" rows="3" placeholder="${optionsPlaceholder}" name="level_options[]"></textarea>
        </div>
        
        <div class="form-text text-muted small">
          ${
            levelCount === 1
              ? "Enter each option on a new line"
              : 'Use format "ParentOption:Option1, Option2"'
          }
        </div>
      </div>
    </div>
  `;

  levelsContainer.appendChild(newLevel);

  // Add remove button event listener
  const removeBtn = newLevel.querySelector(".remove-level");
  removeBtn.addEventListener("click", function () {
    newLevel.remove();
    // Update level numbers
    document.querySelectorAll(".nested-level").forEach((level, idx) => {
      level.querySelector(".card-title").textContent = `Level ${idx + 1}`;
    });
    // Update remove buttons visibility
    const remainingButtons = document.querySelectorAll(".remove-level");
    remainingButtons.forEach((btn) => {
      btn.style.display = remainingButtons.length > 1 ? "block" : "none";
    });

    // Update preview
    updateNestedPreview();
  });

  // Show all remove buttons if there's more than one level
  const removeButtons = document.querySelectorAll(".remove-level");
  removeButtons.forEach(
    (btn) => (btn.style.display = removeButtons.length > 1 ? "block" : "none")
  );

  // Update preview
  updateNestedPreview();
});

// Add event listeners for live preview updates
document
  .querySelector(".nested-levels")
  .addEventListener("input", updateNestedPreview);
document
  .getElementById("refreshPreviewBtn")
  .addEventListener("click", updateNestedPreview);

// Add CSS for modal scrolling and nested options container
const style = document.createElement("style");
style.textContent += `
  /* Modal and Container Styles */
  .modal-body {
    max-height: calc(100vh - 210px);
    overflow-y: auto;
    padding: 1.5rem;
  }

  .nested-options-container {
    padding-right: 5px;
  }

  /* Scrollbar Styling */
  .modal-body::-webkit-scrollbar {
    width: 6px;
  }

  .modal-body::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }

  .modal-body::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 3px;
  }

  .modal-body::-webkit-scrollbar-thumb:hover {
    background: #555;
  }

  /* Card Styling */
  .nested-options-container .card {
    border: 1px solid rgba(0,0,0,.1);
    box-shadow: 0 2px 4px rgba(0,0,0,.05);
    transition: all 0.3s ease;
    border-radius: 8px;
  }
  
  .nested-options-container .card:hover {
    box-shadow: 0 4px 8px rgba(0,0,0,.1);
    transform: translateY(-1px);
  }

  .nested-options-container .card-body {
    padding: 1.25rem;
  }
  
  /* Button Styling */
  .remove-level {
    width: 32px;
    height: 32px;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: all 0.2s ease;
  }

  .remove-level:hover {
    background-color: #dc3545;
    color: white;
  }
  
  #addNestedLevelBtn {
    font-size: 0.875rem;
    height: 32px;
    padding: 0 12px;
    border-radius: 6px;
  }

  /* Configuration Guide Styling */
  .configuration-guide {
    font-size: 0.9rem;
  }

  .configuration-guide pre {
    font-size: 0.85rem;
    margin: 0;
    padding: 0.75rem;
    background-color: #f8f9fa;
    border-radius: 6px;
    white-space: pre-wrap;
  }

  /* Form Elements Styling */
  .nested-options-container textarea {
    min-height: 120px;
    font-size: 0.9rem;
    line-height: 1.5;
    resize: vertical;
  }

  .nested-options-container input {
    font-size: 0.9rem;
  }

  .form-text {
    font-size: 0.85rem;
    color: #6c757d;
    margin-top: 0.5rem;
  }

  /* Preview Section Styling */
  .preview-section {
    border-radius: 8px;
  }

  #nestedPreview {
    min-height: 100px;
    background-color: #f8f9fa;
  }

  #nestedPreview .form-select {
    font-size: 0.9rem;
    border-radius: 6px;
  }

  #nestedPreview .form-select:disabled {
    background-color: #e9ecef;
  }

  /* Responsive Adjustments */
  @media (max-width: 768px) {
    .modal-body {
      padding: 1rem;
    }

    .nested-options-container .card-body {
      padding: 1rem;
    }

    .configuration-guide pre {
      font-size: 0.8rem;
    }
  }

  /* Level Connection Lines */
  .nested-level {
    position: relative;
    margin-bottom: 1.5rem;
  }

  .nested-level:not(:first-child)::before {
    content: '';
    position: absolute;
    left: 24px;
    top: -16px;
    width: 2px;
    height: 16px;
    background: #dee2e6;
  }

  .nested-level:last-child {
    margin-bottom: 0;
  }

  /* Updated Button Styling */
  .custom-btn-primary {
    background: #1a73e8;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .custom-btn-primary:hover {
    background: #1557b0;
    color: white;
    box-shadow: 0 1px 3px rgba(0,0,0,0.12);
  }

  .custom-btn-primary:active {
    background: #174ea6;
  }

  .custom-btn-icon {
    width: 36px;
    height: 36px;
    padding: 0;
    border: none;
    background: transparent;
    color: #dc3545;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .custom-btn-icon:hover {
    background: rgba(220, 53, 69, 0.1);
    color: #dc3545;
  }

  .custom-btn-icon:active {
    background: rgba(220, 53, 69, 0.2);
  }

  /* Remove old button styles */
  .remove-level {
    width: 36px;
    height: 36px;
  }

  #addNestedLevelBtn {
    font-size: 0.875rem;
  }

  /* Adjust card header spacing */
  .nested-options-container .card-body {
    padding: 1.25rem;
  }

  .nested-options-container .card-title {
    font-size: 1rem;
    font-weight: 500;
    color: #1a73e8;
  }

  /* Make textareas more spacious for the content */
  .nested-options-container textarea {
    min-height: 150px;
    font-size: 0.9rem;
    line-height: 1.6;
    padding: 12px;
  }

  /* Remove Button Styling */
  .btn-plain {
    background: none;
    border: none;
    padding: 0;
    color: #000;
    opacity: 0.5;
    cursor: pointer;
    line-height: 1;
    transition: opacity 0.2s ease;
  }

  .btn-plain:hover {
    opacity: 1;
  }

  /* Form Control Styling */
  .nested-level .form-control {
    border-color: #e0e0e0;
  }

  .nested-level .form-control:focus {
    border-color: #1a73e8;
    box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.1);
  }

  .nested-level textarea.form-control {
    min-height: 120px;
    font-size: 0.9rem;
    line-height: 1.5;
  }

  /* Add Level Button Styling */
  #addNestedLevelBtn {
    height: 32px;
    padding: 0 12px;
    font-size: 0.875rem;
    background-color: #1a73e8;
    border-color: #1a73e8;
  }

  #addNestedLevelBtn:hover {
    background-color: #1557b0;
    border-color: #1557b0;
  }

  /* Preview Section Styling */
  .preview-section {
    background-color: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
  }

  #nestedPreview {
    background-color: white;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
  }

  /* Conditional Logic Styling */
  .conditional-fields-container {
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 6px;
    margin-top: 0.5rem;
  }

  .conditional-fields-container select {
    min-height: 120px;
  }

  .conditional-rule {
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 1rem;
    background: white;
  }

  .conditional-rule + .conditional-rule {
    margin-top: 1rem;
  }

  /* Modal Styling */
  .modal-dialog {
    max-width: 800px !important;  /* Make modal wider */
  }

  .modal-body {
    padding: 1.5rem;
  }

  /* Conditional Logic Container Styling */
  .conditional-fields-container {
    padding: 1.25rem;
    background: #f8f9fa;
    border-radius: 8px;
    margin-top: 0.75rem;
  }

  .conditional-fields-container select {
    min-height: 150px;  /* Make select boxes taller */
  }

  .conditional-fields-container select option {
    padding: 8px 12px;
    border-bottom: 1px solid #eee;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .conditional-fields-container select option:hover {
    background-color: #e9ecef;
  }

  /* Add horizontal scrolling for select options */
  .form-select {
    width: 100%;
  }

  .form-select option {
    max-width: none;  /* Allow options to be wider than select box */
  }

  /* Conditional Rule Styling */
  .conditional-rule {
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 1.25rem;
    background: white;
    margin-bottom: 1rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }

  .conditional-rule:last-child {
    margin-bottom: 0;
  }

  .conditional-rule strong {
    font-size: 1rem;
    color: #1a73e8;
  }

  /* Field Labels */
  .conditional-fields-container .form-label {
    font-weight: 500;
    color: #444;
    margin-bottom: 0.5rem;
  }

  /* Options Container */
  .field-options-container {
    margin-bottom: 1.5rem;
  }

  .field-options-container textarea {
    min-height: 120px;
  }

  /* Add Condition Button */
  .add-condition-btn {
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
    border-radius: 4px;
    background-color: #1a73e8;
    color: white;
    border: none;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .add-condition-btn:hover {
    background-color: #1557b0;
  }

  /* Remove Button */
  .btn-plain.text-danger {
    padding: 6px;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .btn-plain.text-danger:hover {
    background-color: #fde8e8;
  }

  /* Scrollbar Styling for Select Boxes */
  .form-select::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .form-select::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }

  .form-select::-webkit-scrollbar-thumb {
    background: #ccc;
    border-radius: 4px;
  }

  .form-select::-webkit-scrollbar-thumb:hover {
    background: #999;
  }
`;
document.head.appendChild(style);

// Function to update conditional logic options when radio options change
function updateConditionalLogicOptions() {
  const optionsText = document.getElementById("options").value;
  const options = optionsText
    .split("\n")
    .map((opt) => opt.trim())
    .filter((opt) => opt);
  const rulesContainer = document.querySelector(".conditional-rules");

  if (!rulesContainer) return;

  if (options.length === 0) {
    rulesContainer.innerHTML =
      '<p class="text-muted mb-0">Add options above to configure conditions</p>';
    return;
  }

  // Get existing rules
  const existingRules = Array.from(
    rulesContainer.querySelectorAll(".conditional-rule")
  )
    .map((rule) => {
      const optionText = rule
        .querySelector("strong")
        ?.textContent.match(/\"([^\"]+)\"/)?.[1];
      if (!optionText) return null;

      const showFields = Array.from(
        rule.querySelector(".show-fields")?.selectedOptions || []
      ).map((opt) => parseInt(opt.value));
      const hideFields = Array.from(
        rule.querySelector(".hide-fields")?.selectedOptions || []
      ).map((opt) => parseInt(opt.value));

      return {
        option: optionText,
        show: showFields,
        hide: hideFields,
      };
    })
    .filter((rule) => rule !== null);

  // Update rules container with vertical layout
  rulesContainer.innerHTML =
    options
      .map((option) => {
        const existingRule = existingRules.find(
          (rule) => rule.option === option
        );

        return `
      <div class="conditional-rule mb-3">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <strong>When "${option}" is selected:</strong>
          <button type="button" class="btn-plain text-danger" onclick="removeConditionalRule(this)">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
          </button>
        </div>
        <div class="conditional-fields-container">
          <div class="mb-3">
            <label class="form-label">Show Fields</label>
            <select class="form-select show-fields" multiple>
              ${renderFieldOptions(existingRule?.show || [])}
            </select>
          </div>
          <div class="mb-3">
            <label class="form-label">Hide Fields</label>
            <select class="form-select hide-fields" multiple>
              ${renderFieldOptions(existingRule?.hide || [])}
            </select>
          </div>
        </div>
      </div>
    `;
      })
      .join("") ||
    '<p class="text-muted mb-0">Add options above to configure conditions</p>';
}

// Update the modal class when showing
document
  .querySelector("#fieldModal")
  .addEventListener("show.bs.modal", function () {
    this.querySelector(".modal-dialog").classList.add("modal-lg");
  });
