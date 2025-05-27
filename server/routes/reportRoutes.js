const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const {
  verifyToken,
  checkDepartmentUser,
} = require("../middleware/authMiddleware");

/**
 * Get categorical form fields for reports
 * @route GET /api/form/fields
 * @access Private (Department users only)
 */
router.get(
  "/form/fields",
  verifyToken,
  checkDepartmentUser,
  async (req, res) => {
    try {
      const query = `
      SELECT ff.id, ff.name, ff.display_name, ff.field_type, ff.options, fs.name as section_name
      FROM form_fields ff
      JOIN form_sections fs ON ff.section_id = fs.id
      ORDER BY fs.order_index, ff.order_index
    `;

      const [fields] = await pool.query(query);
      res.json(fields);
    } catch (error) {
      console.error("Error fetching form fields:", error);
      res.status(500).json({ message: "Failed to fetch form fields" });
    }
  }
);

/**
 * Generate cross-tabulation report
 * @route POST /api/reports/cross-tab
 * @access Private (Department users only)
 */
router.post(
  "/cross-tab",
  verifyToken,
  checkDepartmentUser,
  async (req, res) => {
    try {
      const {
        rowVariableId,
        columnVariableId,
        filters,
        aggregationType,
        timeFilter,
      } = req.body;

      // Validate required fields
      if (!rowVariableId || !columnVariableId) {
        return res
          .status(400)
          .json({ message: "Row and column variables are required" });
      }

      // Get field information
      try {
        const [rowField] = await pool.query(
          "SELECT * FROM form_fields WHERE id = ?",
          [rowVariableId]
        );
        const [columnField] = await pool.query(
          "SELECT * FROM form_fields WHERE id = ?",
          [columnVariableId]
        );

        if (rowField.length === 0 || columnField.length === 0) {
          return res.status(400).json({
            message: "Invalid field IDs",
            rowFieldFound: rowField.length > 0,
            columnFieldFound: columnField.length > 0,
            rowVariableId,
            columnVariableId,
          });
        }

        // Parse options for row and column fields
        try {
          const rowOptions = parseFieldOptions(rowField[0].options);
          const columnOptions = parseFieldOptions(columnField[0].options);

          // Prepare filter conditions
          let filterConditions = "";
          let filterParams = [];

          if (filters && filters.length > 0) {
            try {
              const filterClauses = [];

              for (const filter of filters) {
                const { fieldId, operator, value } = filter;

                // Get field info to determine how to filter
                const [fieldInfo] = await pool.query(
                  "SELECT field_type, name FROM form_fields WHERE id = ?",
                  [fieldId]
                );

                if (fieldInfo.length === 0) {
                  console.warn(`Field not found for filter: ${fieldId}`);
                  continue;
                }

                const fieldType = fieldInfo[0].field_type;

                switch (operator) {
                  case "equals":
                    // Check if this is a nested-select field
                    if (fieldType === "nested-select") {
                      try {
                        // Get the field options structure
                        const [fullFieldInfo] = await pool.query(
                          "SELECT options FROM form_fields WHERE id = ?",
                          [fieldId]
                        );

                        if (
                          fullFieldInfo.length === 0 ||
                          !fullFieldInfo[0].options
                        ) {
                          console.warn(
                            `No options found for nested-select field: ${fieldId}`
                          );
                          filterClauses.push(
                            `(rr.field_id = ? AND rr.value = ?)`
                          );
                          filterParams.push(fieldId, value);
                          break;
                        }

                        // Parse the options to get the hierarchy
                        const fieldOptions = JSON.parse(
                          fullFieldInfo[0].options
                        );

                        // Check if we have hierarchical path information from the client
                        const filterLevel = filter.level || 1; // Default to level 1 if not specified
                        const hierarchyPath = filter.hierarchyPath || [value];
                        const targetValue = hierarchyPath[filterLevel - 1];

                        // For Level 1 filters - use REGEXP to match the value and all children
                        if (filterLevel === 1) {
                          // Escape special chars for REGEXP
                          const escapedValue = targetValue.replace(
                            /[.*+?^${}()|[\]\\]/g,
                            "\\$&"
                          );

                          // This pattern matches either:
                          // 1. The exact value (when it's at the end of string: ^value$)
                          // 2. The value followed by comma and any other characters (for hierarchical values: ^value,)
                          const regexpPattern = `^${escapedValue}(,|$)`;

                          filterClauses.push(
                            `(rr.field_id = ? AND rr.value REGEXP ?)`
                          );
                          filterParams.push(fieldId, regexpPattern);
                        }
                        // For Level 2 filters - use REGEXP to match the path and any deeper children
                        else if (filterLevel === 2) {
                          // Create the exact path to match
                          const exactPath = hierarchyPath.slice(0, 2).join(",");

                          // Escape special chars for REGEXP
                          const escapedPath = exactPath.replace(
                            /[.*+?^${}()|[\]\\]/g,
                            "\\$&"
                          );

                          // This pattern matches either:
                          // 1. The exact path (when it's at the end of string: ^parent,child$)
                          // 2. The path followed by comma and any other characters (for deeper hierarchies: ^parent,child,)
                          const regexpPattern = `^${escapedPath}(,|$)`;

                          filterClauses.push(
                            `(rr.field_id = ? AND rr.value REGEXP ?)`
                          );
                          filterParams.push(fieldId, regexpPattern);
                        }
                        // For deeper levels - use exact matching or more complex patterns
                        else {
                          // Fall back to exact match for deeper levels
                          const exactPath = hierarchyPath
                            .slice(0, filterLevel)
                            .join(",");
                          filterClauses.push(
                            `(rr.field_id = ? AND rr.value = ?)`
                          );
                          filterParams.push(fieldId, exactPath);
                        }
                      } catch (parseError) {
                        console.error(
                          "Error processing nested-select filter:",
                          parseError
                        );
                        filterClauses.push(
                          `(rr.field_id = ? AND rr.value = ?)`
                        );
                        filterParams.push(fieldId, value);
                      }
                    } else {
                      filterClauses.push(`(rr.field_id = ? AND rr.value = ?)`);
                      filterParams.push(fieldId, value);
                    }
                    break;
                  case "not_equals":
                    filterClauses.push(`(rr.field_id = ? AND rr.value != ?)`);
                    filterParams.push(fieldId, value);
                    break;
                  case "contains":
                    filterClauses.push(`(rr.field_id = ? AND rr.value LIKE ?)`);
                    filterParams.push(fieldId, `%${value}%`);
                    break;
                  case "starts_with":
                    filterClauses.push(`(rr.field_id = ? AND rr.value LIKE ?)`);
                    filterParams.push(fieldId, `${value}%`);
                    break;
                  case "ends_with":
                    filterClauses.push(`(rr.field_id = ? AND rr.value LIKE ?)`);
                    filterParams.push(fieldId, `%${value}`);
                    break;
                  case "greater_than":
                    if (["number", "date"].includes(fieldType)) {
                      filterClauses.push(`(rr.field_id = ? AND rr.value > ?)`);
                      filterParams.push(fieldId, value);
                    } else {
                      console.warn(
                        `greater_than not applicable for field type ${fieldType}`
                      );
                    }
                    break;
                  case "less_than":
                    if (["number", "date"].includes(fieldType)) {
                      filterClauses.push(`(rr.field_id = ? AND rr.value < ?)`);
                      filterParams.push(fieldId, value);
                    } else {
                      console.warn(
                        `less_than not applicable for field type ${fieldType}`
                      );
                    }
                    break;
                  case "between":
                    if (
                      ["number", "date"].includes(fieldType) &&
                      value.includes(",")
                    ) {
                      const [min, max] = value.split(",").map((v) => v.trim());

                      filterClauses.push(
                        `(rr.field_id = ? AND rr.value BETWEEN ? AND ?)`
                      );
                      filterParams.push(fieldId, min, max);
                    } else {
                      console.warn(
                        `between not applicable for field type ${fieldType} or improper value format`
                      );
                    }
                    break;
                  case "is_empty":
                    filterClauses.push(
                      `(rr.field_id = ? AND (rr.value IS NULL OR rr.value = ''))`
                    );
                    filterParams.push(fieldId);
                    break;
                  case "is_not_empty":
                    filterClauses.push(
                      `(rr.field_id = ? AND rr.value IS NOT NULL AND rr.value != ''))`
                    );
                    filterParams.push(fieldId);
                    break;
                  default:
                    console.warn(`Unknown operator: ${operator}`);
                }
              }

              if (filterClauses.length > 0) {
                // Instead of a subquery, use an EXISTS clause which is often clearer to MySQL optimizer
                // We need to modify how filters are combined - each filter needs to match
                // Create multiple EXISTS clauses joined by AND, each containing one filter condition
                filterConditions = filterClauses
                  .map(
                    (clause) =>
                      `AND EXISTS (
                  SELECT 1
                  FROM registration_responses AS rr
                  WHERE rr.registration_id = row_responses.registration_id
                    AND ${clause}
                  )`
                  )
                  .join(" ");
              }
            } catch (filterError) {
              console.error("Error processing filters:", filterError);
              return res.status(500).json({
                message: "Error processing filters",
                error: filterError.message,
                stack: filterError.stack,
              });
            }
          }

          // Add time filter condition if provided
          let timeFilterCondition = "";
          if (timeFilter && timeFilter.type !== "all") {
            // Join with registration_progress table to filter by completed_at
            timeFilterCondition = `
              AND EXISTS (
                SELECT 1 FROM registration_progress rp 
                WHERE rp.id = row_responses.registration_id 
                AND rp.status = 'completed'
            `;

            switch (timeFilter.type) {
              case "year":
                timeFilterCondition += ` AND YEAR(rp.completed_at) = ?`;
                filterParams.push(timeFilter.year);
                break;
              case "month":
                timeFilterCondition += ` AND YEAR(rp.completed_at) = ? AND MONTH(rp.completed_at) = ?`;
                filterParams.push(timeFilter.year, timeFilter.month);
                break;
              case "custom":
                timeFilterCondition += ` AND DATE(rp.completed_at) BETWEEN ? AND ?`;
                filterParams.push(timeFilter.startDate, timeFilter.endDate);
                break;
            }

            timeFilterCondition += ")";
          }

          // Query to get the cross-tabulation data
          const query = `
          SELECT 
            row_responses.value AS row_value,
            col_responses.value AS col_value,
            COUNT(DISTINCT row_responses.registration_id) AS count
          FROM 
            registration_responses AS row_responses
          JOIN 
            registration_responses AS col_responses 
            ON row_responses.registration_id = col_responses.registration_id
          WHERE 
            row_responses.field_id = ?
            AND col_responses.field_id = ?
            ${filterConditions}
            ${timeFilterCondition}
          GROUP BY 
            row_responses.value, col_responses.value
          ORDER BY 
            row_responses.value, col_responses.value
        `;

          // Execute query
          try {
            // Log the exact query with parameters substituted for debugging
            let debugQuery = query;
            [rowVariableId, columnVariableId, ...filterParams].forEach(
              (param, index) => {
                debugQuery = debugQuery.replace("?", `'${param}'`);
              }
            );

            const [results] = await pool.query(query, [
              rowVariableId,
              columnVariableId,
              ...filterParams,
            ]);

            // Get all unique row and column values
            try {
              let rowValues = new Set();
              let colValues = new Set();

              results.forEach((result) => {
                if (
                  result.row_value !== null &&
                  result.row_value !== undefined
                ) {
                  // For nested-select fields, handle the hierarchical display
                  if (rowField[0].field_type === "nested-select") {
                    // Split the hierarchical value into its parts
                    const levelParts = result.row_value.split(",");

                    // Check if we have a filter for this field to determine which level to display
                    if (filters && filters.length > 0) {
                      const nestedFilter = filters.find(
                        (f) => f.fieldId === rowVariableId
                      );

                      if (nestedFilter) {
                        // If we found a filter, use the level that was selected in the filter
                        const filterLevel = nestedFilter.level || 1;

                        // Get the next level value (if it exists)
                        // For Level 1 filter, show Level 2 values
                        // For Level 2 filter, show Level 3 values, etc.
                        if (levelParts.length > filterLevel) {
                          const displayValue = levelParts[filterLevel];
                          rowValues.add(displayValue);
                        } else {
                          // If there's no next level, show the current level value
                          const displayValue =
                            filterLevel <= levelParts.length
                              ? levelParts[filterLevel - 1]
                              : levelParts[0];
                          rowValues.add(displayValue);
                        }
                      } else {
                        // No filter for this field, use level 1
                        rowValues.add(levelParts[0]);
                      }
                    } else {
                      // No filters applied, show Level 1 values
                      rowValues.add(levelParts[0]);
                    }
                  } else {
                    rowValues.add(result.row_value);
                  }
                }

                if (
                  result.col_value !== null &&
                  result.col_value !== undefined
                ) {
                  colValues.add(result.col_value);
                }
              });

              // Convert to arrays and ensure they're in the same order as the options
              const rowLabels = Array.from(rowValues).sort((a, b) => {
                try {
                  const aIndex = rowOptions.findIndex((opt) => opt === a);
                  const bIndex = rowOptions.findIndex((opt) => opt === b);

                  return aIndex - bIndex;
                } catch (sortError) {
                  console.error("Error sorting row values:", sortError);
                  return 0;
                }
              });

              const columnLabels = Array.from(colValues).sort((a, b) => {
                try {
                  const aIndex = columnOptions.findIndex((opt) => opt === a);
                  const bIndex = columnOptions.findIndex((opt) => opt === b);

                  return aIndex - bIndex;
                } catch (sortError) {
                  console.error("Error sorting column values:", sortError);
                  return 0; // Default to no change in order
                }
              });

              // Initialize data matrix with zeros
              const data = Array(rowLabels.length)
                .fill()
                .map(() => Array(columnLabels.length).fill(0));

              // Fill in the matrix with actual counts
              try {
                results.forEach((result) => {
                  let rowValue = result.row_value;
                  // For nested-select fields, determine which level to display
                  if (rowField[0].field_type === "nested-select") {
                    // Split the hierarchical value into its parts
                    const levelParts = result.row_value.split(",");

                    // Check if we have a filter for this field to determine which level to display
                    if (filters && filters.length > 0) {
                      const nestedFilter = filters.find(
                        (f) => f.fieldId === rowVariableId
                      );

                      if (nestedFilter) {
                        // If we found a filter, use the next level after the selected level
                        const filterLevel = nestedFilter.level || 1;

                        // Get the next level value (if it exists)
                        if (levelParts.length > filterLevel) {
                          rowValue = levelParts[filterLevel];
                        } else {
                          // If there's no next level, show the current level value
                          rowValue =
                            filterLevel <= levelParts.length
                              ? levelParts[filterLevel - 1]
                              : levelParts[0];
                        }
                      } else {
                        // No filter for this field, use level 1
                        rowValue = levelParts[0];
                      }
                    } else {
                      // No filters applied, show Level 1 values
                      rowValue = levelParts[0];
                    }
                  }

                  const rowIndex = rowLabels.indexOf(rowValue);
                  const colIndex = columnLabels.indexOf(result.col_value);

                  if (rowIndex >= 0 && colIndex >= 0) {
                    data[rowIndex][colIndex] =
                      data[rowIndex][colIndex] + result.count;

                    // If this is a nested-select field with no specific level filter,
                    // we also need to add this count to all parent levels
                    if (
                      rowField[0].field_type === "nested-select" &&
                      (!filters ||
                        !filters.some((f) => f.fieldId === rowVariableId))
                    ) {
                      // Get the full hierarchical path
                      const levelParts = result.row_value.split(",");

                      // If we have multiple levels, add counts to parent levels
                      if (levelParts.length > 1) {
                        // For each parent level in the hierarchy
                        for (let i = 0; i < levelParts.length - 1; i++) {
                          const parentValue = levelParts[i];
                          const parentRowIndex = rowLabels.indexOf(parentValue);

                          // If the parent is in our row labels, add the count there too
                          if (
                            parentRowIndex >= 0 &&
                            parentRowIndex !== rowIndex
                          ) {
                            data[parentRowIndex][colIndex] =
                              data[parentRowIndex][colIndex] + result.count;
                          }
                        }
                      }
                    }
                  }
                });

                // Calculate row and column totals
                const rowTotals = data.map((row, i) => {
                  const total = row.reduce((sum, count) => sum + count, 0);
                  return total;
                });

                const columnTotals = columnLabels.map((colLabel, colIndex) => {
                  const total = data.reduce(
                    (sum, row) => sum + row[colIndex],
                    0
                  );
                  return total;
                });

                // Calculate grand total
                let grandTotal = rowTotals.reduce(
                  (sum, count) => sum + count,
                  0
                );

                // Apply aggregation transformations if needed
                if (aggregationType && aggregationType !== "count") {
                  try {
                    switch (aggregationType) {
                      case "percent_total":
                        // Transform to percentage of grand total
                        for (let i = 0; i < rowLabels.length; i++) {
                          for (let j = 0; j < columnLabels.length; j++) {
                            data[i][j] = (data[i][j] / grandTotal) * 100;
                          }
                        }
                        // Update totals
                        for (let i = 0; i < rowTotals.length; i++) {
                          rowTotals[i] = (rowTotals[i] / grandTotal) * 100;
                        }
                        for (let j = 0; j < columnTotals.length; j++) {
                          columnTotals[j] =
                            (columnTotals[j] / grandTotal) * 100;
                        }
                        break;

                      case "percent_row":
                        // Transform to percentage of row total
                        for (let i = 0; i < rowLabels.length; i++) {
                          if (rowTotals[i] > 0) {
                            for (let j = 0; j < columnLabels.length; j++) {
                              data[i][j] = (data[i][j] / rowTotals[i]) * 100;
                            }
                            // Row totals become 100%
                            rowTotals[i] = 100;
                          }
                        }
                        // Recalculate column totals based on percentages
                        for (let j = 0; j < columnLabels.length; j++) {
                          columnTotals[j] =
                            data.reduce((sum, row) => sum + row[j], 0) /
                            rowLabels.length;
                        }
                        break;

                      case "percent_col":
                        // Transform to percentage of column total
                        for (let j = 0; j < columnLabels.length; j++) {
                          if (columnTotals[j] > 0) {
                            for (let i = 0; i < rowLabels.length; i++) {
                              data[i][j] = (data[i][j] / columnTotals[j]) * 100;
                            }
                            // Column totals become 100%
                            columnTotals[j] = 100;
                          }
                        }
                        // Recalculate row totals based on percentages
                        for (let i = 0; i < rowLabels.length; i++) {
                          rowTotals[i] =
                            data[i].reduce((sum, val) => sum + val, 0) /
                            columnLabels.length;
                        }
                        break;
                    }

                    // In percentage modes, grand total is the average of appropriate totals
                    if (aggregationType === "percent_total") {
                      // Grand total remains 100%
                      grandTotal = 100; // Explicitly set grand total to 100 for percent_total mode
                    } else if (aggregationType === "percent_row") {
                      // Grand total is average of row totals (should be 100)
                      grandTotal = 100;
                    } else if (aggregationType === "percent_col") {
                      // Grand total is average of column totals (should be 100)
                      grandTotal = 100;
                    }
                  } catch (aggregationError) {
                    console.error(
                      "Error applying aggregation:",
                      aggregationError
                    );
                    return res.status(500).json({
                      message: "Error applying aggregation",
                      error: aggregationError.message,
                    });
                  }
                }

                // Return the processed data
                const response = {
                  rowLabels,
                  columnLabels,
                  data,
                  rowTotals,
                  columnTotals,
                  grandTotal,
                  metadata: {
                    rowField: rowField[0],
                    columnField: columnField[0],
                    aggregationType,
                  },
                };

                res.json(response);
              } catch (resultsError) {
                console.error("Error processing results:", resultsError);
                return res.status(500).json({
                  message: "Error processing results",
                  error: resultsError.message,
                });
              }
            } catch (valuesError) {
              console.error("Error extracting unique values:", valuesError);
              return res.status(500).json({
                message: "Error extracting unique values",
                error: valuesError.message,
              });
            }
          } catch (queryError) {
            console.error("Error executing query:", queryError);
            return res.status(500).json({
              message: "Error executing query",
              error: queryError.message,
              query: query,
              params: [rowVariableId, columnVariableId, ...filterParams],
            });
          }
        } catch (optionsError) {
          console.error("Error parsing field options:", optionsError);
          return res.status(500).json({
            message: "Error parsing field options",
            error: optionsError.message,
          });
        }
      } catch (fieldError) {
        console.error("Error retrieving field info:", fieldError);
        return res.status(500).json({
          message: "Error retrieving field info",
          error: fieldError.message,
        });
      }
    } catch (error) {
      console.error("Error generating cross-tab report:", error);
      res.status(500).json({
        message: "Failed to generate report",
        error: error.message,
        stack: error.stack,
      });
    }
  }
);

/**
 * Parse field options from string to array
 */
function parseFieldOptions(optionsStr) {
  if (!optionsStr) {
    return [];
  }

  try {
    // Check if it's already a JSON string
    if (optionsStr.startsWith("[") || optionsStr.startsWith("{")) {
      try {
        const parsedOptions = JSON.parse(optionsStr);

        // Handle case where options are in an options property
        if (parsedOptions.options && Array.isArray(parsedOptions.options)) {
          return parsedOptions.options;
        }

        // Handle nested-select structure which might have nested options
        if (
          Array.isArray(parsedOptions) &&
          parsedOptions.length > 0 &&
          (parsedOptions[0].options || parsedOptions[0].level)
        ) {
          // Extract all option values from nested structure
          const extractedOptions = parsedOptions.reduce((acc, level) => {
            if (level.options) {
              // Handle options stored as string with line breaks
              if (typeof level.options === "string") {
                // Split by line breaks first
                const lines = level.options
                  .split("\n")
                  .map((line) => line.trim())
                  .filter((line) => line);

                // For each line, handle comma-separated values
                const options = lines.reduce((lineAcc, line) => {
                  // If the line contains a colon, it's a parent option with child options
                  if (line.includes(":")) {
                    const [parent, children] = line
                      .split(":")
                      .map((part) => part.trim());
                    // Add the parent option
                    lineAcc.push(parent);
                    // Add child options if they exist
                    if (children) {
                      const childOptions = children
                        .split(",")
                        .map((opt) => opt.trim())
                        .filter((opt) => opt);
                      lineAcc.push(...childOptions);
                    }
                  } else {
                    // If no colon, just add the line as is
                    lineAcc.push(line);
                  }
                  return lineAcc;
                }, []);

                return [...acc, ...options];
              }
              // Handle options stored as array
              if (Array.isArray(level.options)) {
                const options = level.options.map((opt) => {
                  const value = opt.value || opt;
                  return value;
                });
                return [...acc, ...options];
              }
            }
            return acc;
          }, []);

          return extractedOptions;
        }

        // Handle array of objects with value property
        if (
          Array.isArray(parsedOptions) &&
          parsedOptions.length > 0 &&
          (parsedOptions[0].value !== undefined ||
            (typeof parsedOptions[0] === "object" && parsedOptions[0] !== null))
        ) {
          const extractedValues = parsedOptions.map((opt) => {
            if (typeof opt === "object" && opt !== null) {
              return opt.value !== undefined
                ? opt.value
                : opt.label || JSON.stringify(opt);
            }
            return opt;
          });

          return extractedValues;
        }

        // If it's a simple array, return as is
        if (Array.isArray(parsedOptions)) {
          return parsedOptions;
        }

        // If it's an object but not an array, convert to array of values
        if (typeof parsedOptions === "object" && parsedOptions !== null) {
          const values = Object.values(parsedOptions);
          return values;
        }

        // If we got here, JSON parsed but format is unexpected
        console.warn(
          "JSON parsed but format is unexpected, converting to string"
        );
        return [String(parsedOptions)];
      } catch (jsonError) {
        console.error(
          "Failed to parse options as JSON despite JSON-like format:",
          jsonError
        );
        // Fall back to line-break handling
      }
    }

    // Handle line-break separated options
    const options = optionsStr
      .split("\n")
      .map((opt) => opt.trim())
      .filter((opt) => opt);

    return options;
  } catch (error) {
    console.error("Error parsing field options:", error);
    console.warn("Falling back to simple string return");

    // Last resort: try to split by line breaks, or return the whole string
    try {
      return optionsStr
        .split("\n")
        .map((opt) => opt.trim())
        .filter((opt) => opt);
    } catch (fallbackError) {
      console.error("Even fallback parsing failed:", fallbackError);
      return [optionsStr];
    }
  }
}

/**
 * Save a filter set to the database
 * @route POST /api/reports/filters/save
 * @access Private (Department users only)
 */
router.post(
  "/filters/save",
  verifyToken,
  checkDepartmentUser,
  async (req, res) => {
    try {
      const { name, filters, userId } = req.body;

      if (!name || !filters || !Array.isArray(filters)) {
        return res.status(400).json({
          message: "Filter name and filter array are required",
        });
      }

      // Check if a filter with the same name already exists for this user
      const [existingFilters] = await pool.query(
        "SELECT id FROM saved_report_filters WHERE name = ? AND user_id = ?",
        [name, userId]
      );

      if (existingFilters.length > 0) {
        // Update existing filter
        await pool.query(
          "UPDATE saved_report_filters SET filters = ?, updated_at = NOW() WHERE id = ?",
          [JSON.stringify(filters), existingFilters[0].id]
        );

        return res.json({
          message: "Filter updated successfully",
          id: existingFilters[0].id,
        });
      }

      // Insert new filter
      const [result] = await pool.query(
        "INSERT INTO saved_report_filters (name, filters, user_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())",
        [name, JSON.stringify(filters), userId]
      );

      res.status(201).json({
        message: "Filter saved successfully",
        id: result.insertId,
      });
    } catch (error) {
      console.error("Error saving filter:", error);
      res.status(500).json({
        message: "Failed to save filter",
        error: error.message,
      });
    }
  }
);

/**
 * Get saved filters for all department users
 * @route GET /api/reports/filters
 * @access Private (Department users only)
 */
router.get("/filters", verifyToken, checkDepartmentUser, async (req, res) => {
  try {
    // Fetch all filters with creator information
    const [filters] = await pool.query(
      `SELECT srf.id, srf.name, srf.filters, srf.created_at, srf.updated_at, 
       srf.user_id, u.full_name as creator_name
       FROM saved_report_filters srf
       JOIN users u ON srf.user_id = u.id
       ORDER BY srf.updated_at DESC`
    );

    // Parse the JSON filter data
    const parsedFilters = filters.map((filter) => ({
      ...filter,
      filters: JSON.parse(filter.filters),
    }));

    res.json(parsedFilters);
  } catch (error) {
    console.error("Error fetching saved filters:", error);
    res.status(500).json({
      message: "Failed to fetch saved filters",
      error: error.message,
    });
  }
});

/**
 * Delete a saved filter
 * @route DELETE /api/reports/filters/:id
 * @access Private (Department users only)
 */
router.delete(
  "/filters/:id",
  verifyToken,
  checkDepartmentUser,
  async (req, res) => {
    try {
      const filterId = req.params.id;
      const userId = req.user.id;

      // Check if the filter exists
      const [filter] = await pool.query(
        "SELECT id, user_id FROM saved_report_filters WHERE id = ?",
        [filterId]
      );

      if (filter.length === 0) {
        return res.status(404).json({
          message: "Filter not found",
        });
      }

      // Only the creator can delete the filter
      if (filter[0].user_id !== userId) {
        return res.status(403).json({
          message: "You can only delete filters that you created",
        });
      }

      await pool.query("DELETE FROM saved_report_filters WHERE id = ?", [
        filterId,
      ]);

      res.json({
        message: "Filter deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting filter:", error);
      res.status(500).json({
        message: "Failed to delete filter",
        error: error.message,
      });
    }
  }
);

/**
 * Save a report configuration to the database
 * @route POST /api/reports/save
 * @access Private (Department users only)
 */
router.post("/save", verifyToken, checkDepartmentUser, async (req, res) => {
  try {
    const { name, config, userId, category } = req.body;

    if (!name || !config) {
      return res.status(400).json({
        message: "Report name and configuration are required",
      });
    }

    // Use default category if not provided
    const reportCategory = category || "General";

    // Check if a report with the same name already exists for this user
    const [existingReports] = await pool.query(
      "SELECT id FROM saved_reports WHERE name = ? AND user_id = ?",
      [name, userId]
    );

    if (existingReports.length > 0) {
      // Update existing report
      await pool.query(
        "UPDATE saved_reports SET config = ?, category = ?, updated_at = NOW() WHERE id = ?",
        [JSON.stringify(config), reportCategory, existingReports[0].id]
      );

      return res.json({
        message: "Report updated successfully",
        id: existingReports[0].id,
      });
    }

    // Insert new report
    const [result] = await pool.query(
      "INSERT INTO saved_reports (name, config, category, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())",
      [name, JSON.stringify(config), reportCategory, userId]
    );

    res.status(201).json({
      message: "Report saved successfully",
      id: result.insertId,
    });
  } catch (error) {
    console.error("Error saving report:", error);
    res.status(500).json({
      message: "Failed to save report",
      error: error.message,
    });
  }
});

/**
 * Get all saved reports for all department users
 * @route GET /api/reports/saved
 * @access Private (Department users only)
 */
router.get("/saved", verifyToken, checkDepartmentUser, async (req, res) => {
  try {
    // Fetch all reports with creator information instead of just current user's reports
    const [reports] = await pool.query(
      `SELECT sr.id, sr.name, sr.config, sr.category, sr.created_at, sr.updated_at, 
       sr.user_id, u.full_name as creator_name
       FROM saved_reports sr 
       JOIN users u ON sr.user_id = u.id 
       ORDER BY sr.category, sr.updated_at DESC`
    );

    // Parse the JSON config data
    const parsedReports = reports.map((report) => ({
      ...report,
      config: JSON.parse(report.config),
    }));

    res.json(parsedReports);
  } catch (error) {
    console.error("Error fetching saved reports:", error);
    res.status(500).json({
      message: "Failed to fetch saved reports",
      error: error.message,
    });
  }
});

/**
 * Get a specific saved report by ID
 * @route GET /api/reports/saved/:id
 * @access Private (Department users only)
 */
router.get("/saved/:id", verifyToken, checkDepartmentUser, async (req, res) => {
  try {
    const reportId = req.params.id;

    // Anyone can access any report, regardless of creator
    const [reports] = await pool.query(
      `SELECT sr.id, sr.name, sr.config, sr.category, sr.created_at, sr.updated_at, 
       sr.user_id, u.full_name as creator_name
       FROM saved_reports sr 
       JOIN users u ON sr.user_id = u.id 
       WHERE sr.id = ?`,
      [reportId]
    );

    if (reports.length === 0) {
      return res.status(404).json({
        message: "Report not found",
      });
    }

    // Parse the JSON config data
    const report = {
      ...reports[0],
      config: JSON.parse(reports[0].config),
    };

    res.json(report);
  } catch (error) {
    console.error("Error fetching saved report:", error);
    res.status(500).json({
      message: "Failed to fetch saved report",
      error: error.message,
    });
  }
});

/**
 * Delete a saved report
 * @route DELETE /api/reports/saved/:id
 * @access Private (Department users only)
 */
router.delete(
  "/saved/:id",
  verifyToken,
  checkDepartmentUser,
  async (req, res) => {
    try {
      const reportId = req.params.id;
      const userId = req.user.id;

      // Check if the report exists
      const [report] = await pool.query(
        "SELECT id, user_id FROM saved_reports WHERE id = ?",
        [reportId]
      );

      if (report.length === 0) {
        return res.status(404).json({
          message: "Report not found",
        });
      }

      // Only the creator can delete the report
      if (report[0].user_id !== userId) {
        return res.status(403).json({
          message: "You can only delete reports that you created",
        });
      }

      await pool.query("DELETE FROM saved_reports WHERE id = ?", [reportId]);

      res.json({
        message: "Report deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting report:", error);
      res.status(500).json({
        message: "Failed to delete report",
        error: error.message,
      });
    }
  }
);

/**
 * Get all unique categories
 * @route GET /api/reports/categories
 * @access Private (Department users only)
 */
router.get(
  "/categories",
  verifyToken,
  checkDepartmentUser,
  async (req, res) => {
    try {
      // Get categories from all reports, not just current user's
      const [categories] = await pool.query(
        "SELECT DISTINCT category FROM saved_reports ORDER BY category"
      );

      // Extract categories into a simple array
      const categoryList = categories.map((item) => item.category);

      // Always include 'General' if it doesn't exist
      if (!categoryList.includes("General")) {
        categoryList.push("General");
      }

      res.json(categoryList);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({
        message: "Failed to fetch categories",
        error: error.message,
      });
    }
  }
);

// SQL to create the saved_report_filters table:
/*
CREATE TABLE IF NOT EXISTS saved_report_filters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  filters TEXT NOT NULL,
  user_id INT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
*/

// SQL to create the saved_reports table:
/*
CREATE TABLE IF NOT EXISTS saved_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  config TEXT NOT NULL,
  user_id INT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
*/

module.exports = router;
