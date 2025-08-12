const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const pool = require("../config/database");
const ExcelJS = require("exceljs");
const puppeteer = require("puppeteer");

// Create a transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "your-email@gmail.com",
    pass: process.env.EMAIL_PASSWORD || "your-app-password",
  },
});

// Verify the transporter
transporter.verify((error) => {
  if (error) {
    console.error("Email service error:", error);
  } else {
    console.log("Email service is ready to send messages");
  }
});

/**
 * Send a report email
 * @param {Object} notification - The notification object
 * @param {Array} recipients - List of recipient emails
 * @param {Object} report - The report object
 * @param {Object} reportConfig - The report configuration
 * @param {boolean} isManualSend - Whether this is a manual send (send now)
 * @param {Object} dateRange - Optional date range for manual send (startDate and endDate)
 * @param {string} userName - Optional user's name for personalized greeting
 * @returns {boolean} - Whether the email was sent successfully
 */
async function sendReportEmail(
  notification,
  recipients,
  report,
  reportConfig,
  isManualSend = false,
  dateRange = null,
  userName = null
) {
  try {
    // Ensure we have recipients
    if (!recipients || !recipients.length) {
      console.error(
        "No recipients provided for notification ID:",
        notification.id
      );
      return false;
    }

    // Apply monthly filter for manual send requests
    let configToUse = { ...reportConfig };
    if (isManualSend) {
      let startDate, endDate;
      let displayStartDate, displayEndDate;

      if (dateRange && dateRange.startDate && dateRange.endDate) {
        // Use provided date range
        startDate = dateRange.startDate;
        endDate = dateRange.endDate;

        // Format for display (DD-MM-YYYY)
        displayStartDate = formatDateForDisplay(startDate);
        displayEndDate = formatDateForDisplay(endDate);

        console.log(
          "Applied custom date range filter for manual send:",
          startDate,
          "to",
          endDate
        );
      } else {
        // Use default current month if no custom range provided
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

        // Format dates as YYYY-MM-DD for database
        startDate = formatDateForDatabase(firstDay);
        endDate = formatDateForDatabase(today);

        // Format for display (DD-MM-YYYY)
        displayStartDate = formatDateForDisplay(startDate);
        displayEndDate = formatDateForDisplay(endDate);

        console.log(
          "Applied default current month filter for manual send:",
          startDate,
          "to",
          endDate
        );
      }

      // If we already have filters, append to them
      if (!configToUse.filters) {
        configToUse.filters = [];
      }

      // Add date range filter using completed_at from registration_progress table
      configToUse.filters.push({
        fieldId: "completed_at", // Using completed_at instead of submission_date
        operator: "between",
        value: [startDate, endDate],
        displayValue: `${displayStartDate} to ${displayEndDate}`,
        // Add rich metadata for date filtering
        isDateFilter: true,
        table: "registration_progress",
        column: "completed_at",
        fieldName: "Completion Date",
        fieldType: "date",
      });
    }

    // Generate the report file
    const filePath = await generateReportFile(report.name, configToUse);
    if (!filePath) {
      throw new Error("Failed to generate report file");
    }

    // Prepare transporter
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE === "true",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Get date range for email subject and content
    let dateRangeDisplay = "";
    if (isManualSend) {
      // Check if we have a specific date range
      if (dateRange && dateRange.startDate && dateRange.endDate) {
        const displayStartDate = formatDateForDisplay(dateRange.startDate);
        const displayEndDate = formatDateForDisplay(dateRange.endDate);
        dateRangeDisplay = `${displayStartDate} to ${displayEndDate}`;
      } else {
        // Use current month as fallback
        dateRangeDisplay = getCurrentMonthYear();
      }
    } else {
      // For scheduled emails, use previous month
      const today = new Date();
      const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      dateRangeDisplay = previousMonth.toLocaleString("default", { month: "long", year: "numeric" });
    }

    // Prepare email content
    const reportTitle = report.name;
    const emailSubject = isManualSend
      ? `${reportTitle} - Report for ${dateRangeDisplay}`
      : `${reportTitle} - Monthly Report for ${dateRangeDisplay}`;

    // Create a modern, responsive HTML email template
    const emailHtml = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${reportTitle} Report</title>
          <style>
            /* Reset styles */
            body, html {
              margin: 0;
              padding: 0;
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              color: #333;
              line-height: 1.6;
              background-color: #f5f7fa;
            }
            
            /* Container styles */
            .container {
              max-width: 650px;
              margin: 0 auto;
              background-color: #ffffff;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            
            /* Header styles */
            .header {
              background-color: #0d6efd;
              background-image: linear-gradient(135deg, #0d6efd 0%, #0a4bb3 100%);
              color: white;
              padding: 30px;
              text-align: center;
            }
            
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 600;
            }
            
            .header p {
              margin: 10px 0 0;
              font-size: 16px;
              opacity: 0.9;
            }
            
            /* Content styles */
            .content {
              padding: 30px;
            }
            
            .content h2 {
              margin-top: 0;
              color: #0a4bb3;
              font-size: 20px;
            }
            
            .date-range {
              background-color: #f0f7ff;
              border-left: 4px solid #0d6efd;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            
            .date-range p {
              margin: 0;
              font-weight: 500;
            }
            
            .button-container {
              text-align: center;
              margin: 30px 0;
            }
            
            .button {
              display: inline-block;
              background-color: #0d6efd;
              color: #ffffff !important;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 4px;
              font-weight: 500;
              text-align: center;
            }
            
            /* Footer styles */
            .footer {
              background-color: #f8f9fa;
              padding: 20px 30px;
              color: #6c757d;
              font-size: 14px;
              text-align: center;
              border-top: 1px solid #e9ecef;
            }
            
            .footer p {
              margin: 0;
            }
            
            /* Responsive adjustments */
            @media screen and (max-width: 550px) {
              .header, .content, .footer {
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>DDRC Report</h1>
              <p>${reportTitle}</p>
            </div>
            
            <div class="content">
              <p>Hello${userName ? ' ' + userName : ''},</p>
              <p>Your requested report has been generated and is attached to this email.</p>
              
              <div class="date-range">
                <p><strong>Date Range:</strong> ${dateRangeDisplay}</p>
              </div>
              
              <p>This report ${
                isManualSend
                  ? `was manually requested and contains data for the specified date range.`
                  : `is automatically generated on the 1st of each month and contains data for the previous month.`
              }</p>
              
              <p>For detailed analytics and interactive reports, you can access the DDRC dashboard directly.</p>
              
              <div class="button-container">
                <a href="${process.env.APP_URL}/admin/reports" class="button">View Reports Dashboard</a>
              </div>
              
              <p>Thank you for using the DDRC Management System.</p>
              <p>Regards,<br>DDRC Team</p>
            </div>
            
            <div class="footer">
              <p>This is an automated message from the District Disability Rehabilitation Centre (DDRC) Management System.</p>
              <p>Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email
    const info = await transporter.sendMail({
      from: {
        name: "DDRC Reports",
        address: process.env.EMAIL_FROM
      },
      to: recipients.join(", "),
      subject: emailSubject,
      text: `${reportTitle} Report for ${dateRangeDisplay} is attached. This report ${
        isManualSend
          ? `was manually requested and contains data for the specified date range.`
          : `is automatically generated on the 1st of each month and contains data for the previous month.`
      }`,
      html: emailHtml,
      attachments: [
        {
          filename: path.basename(filePath),
          path: filePath,
        },
      ],
    });

    console.log("Email sent:", info.messageId);

    // Remove temporary file
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error("Error removing temporary file:", error);
    }

    return true;
  } catch (error) {
    console.error("Error sending report email:", error);
    return false;
  }
}

/**
 * Get current month and year as a string (e.g., "May 2023")
 * @returns {string} - Current month and year
 */
function getCurrentMonthYear() {
  const date = new Date();
  return date.toLocaleString("default", { month: "long", year: "numeric" });
}

/**
 * Generate a report file
 * @param {string} reportName - The name of the report
 * @param {Object} config - The report configuration
 * @returns {string} - Path to the generated file
 */
async function generateReportFile(reportName, config) {
  // Create a temporary directory if it doesn't exist
  const tempDir = path.join(__dirname, "../temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  // Create a unique filename
  const filename = `report_${Date.now()}.xlsx`;
  const filePath = path.join(tempDir, filename);

  try {
    // Create a new workbook with improved styling
    const workbook = new ExcelJS.Workbook();

    // Set workbook properties
    workbook.creator = "DDRC Management System";
    workbook.lastModifiedBy = "DDRC Management System";
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.properties.date1904 = false;

    // Sanitize worksheet name to remove invalid characters
    const sanitizedReportName = sanitizeWorksheetName(reportName);

    // Add a worksheet
    const worksheet = workbook.addWorksheet(sanitizedReportName, {
      pageSetup: {
        paperSize: 9, // A4
        orientation: "landscape",
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

    // Define enhanced styles
    const styles = {
      title: {
        font: { size: 22, bold: true, color: { argb: "1A56DB" } },
        alignment: { horizontal: "center", vertical: "middle" },
      },
      subtitle: {
        font: { size: 12, color: { argb: "333333" } },
        alignment: { horizontal: "center", vertical: "middle" },
      },
      reportTitle: {
        font: { size: 18, bold: true, color: { argb: "333333" } },
        alignment: { horizontal: "center", vertical: "middle" },
        border: { bottom: { style: "medium", color: { argb: "CCCCCC" } } },
      },
      metaLabel: {
        font: { size: 12, bold: true, color: { argb: "333333" } },
        alignment: { horizontal: "left", vertical: "middle" },
      },
      metaValue: {
        font: { size: 12, bold: false },
        alignment: { horizontal: "left", vertical: "middle" },
      },
      metaBg: {
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
      },
      tableHeader: {
        font: { size: 12, bold: true, color: { argb: "FFFFFF" } },
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
      },
      rowHeader: {
        font: { size: 11, bold: true },
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
      },
      dataCell: {
        font: { size: 11 },
        border: {
          top: { style: "thin", color: { argb: "DDDDDD" } },
          bottom: { style: "thin", color: { argb: "DDDDDD" } },
          left: { style: "thin", color: { argb: "DDDDDD" } },
          right: { style: "thin", color: { argb: "DDDDDD" } },
        },
        alignment: { horizontal: "center", vertical: "middle", wrapText: true },
      },
      zebraStripe: {
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "F9FAFB" },
        },
      },
      totalsRow: {
        font: { size: 11, bold: true },
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
      },
      totalsCol: {
        font: { size: 11, bold: true },
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
      },
      grandTotal: {
        font: { size: 11, bold: true, color: { argb: "1A56DB" } },
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
      },
      footer: {
        font: { size: 11, italic: true, color: { argb: "6C757D" } },
        alignment: { horizontal: "center", vertical: "middle" },
      },
    };

    try {
      // Fetch report data based on the configuration
      const reportData = await fetchReportData(config);

      if (!reportData || !reportData.data) {
        throw new Error("Failed to fetch report data");
      }

      // HEADER SECTION
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
      const reportTitleRow = worksheet.addRow([sanitizedReportName]);
      reportTitleRow.height = 30;

      // Row 6: Empty spacing
      worksheet.addRow([""]);

      // METADATA SECTION
      const metaStartRow = worksheet.rowCount + 1;

      // Get field information from metadata
      const rowFieldName =
        reportData.metadata?.rowField?.display_name || "Row Variable";
      const columnFieldName =
        reportData.metadata?.columnField?.display_name || "Column Variable";

      worksheet.addRow(["Report Name:", sanitizedReportName]);
      worksheet.addRow(["Row Variable:", rowFieldName]);
      worksheet.addRow(["Column Variable:", columnFieldName]);
      worksheet.addRow(["Date Generated:", new Date().toLocaleString()]);

      const metaEndRow = worksheet.rowCount;

      // Spacing
      worksheet.addRow([""]);

      // Add filters if any
      let filterStartRow = 0;
      let filterEndRow = 0;

      if (config.filters && config.filters.length > 0) {
        filterStartRow = worksheet.rowCount;
        worksheet.addRow(["Applied Filters"]);

        config.filters.forEach((filter) => {
          let fieldName = filter.fieldName || filter.fieldId;
          let operatorText = getOperatorDisplayText(filter.operator);
          let valueText = Array.isArray(filter.value)
            ? filter.value.join(" to ")
            : filter.value;

          worksheet.addRow([`• ${fieldName} ${operatorText} ${valueText}`]);
        });

        filterEndRow = worksheet.rowCount;

        // Spacing after filters
        worksheet.addRow([""]);
      }

      // REPORT TABLE
      // Create table header row
      const columnLabels = reportData.columnLabels;
      const headerCells = [""];
      columnLabels.forEach((label) => {
        headerCells.push(label);
      });
      headerCells.push("Total");

      const tableHeaderRow = worksheet.addRow(headerCells);
      tableHeaderRow.height = 25;

      // Add data rows
      const dataRows = [];
      reportData.rowLabels.forEach((rowLabel, rowIndex) => {
        const row = [rowLabel];

        reportData.columnLabels.forEach((_, colIndex) => {
          row.push(reportData.data[rowIndex][colIndex]);
        });

        // Add row total
        row.push(reportData.rowTotals[rowIndex]);

        const dataRow = worksheet.addRow(row);
        dataRow.height = 20;
        dataRows.push(dataRow);
      });

      // Add totals row
      const totalRowData = ["Total"];
      reportData.columnTotals.forEach((total) => {
        totalRowData.push(total);
      });

      // Add grand total
      totalRowData.push(reportData.total);
      const totalsRow = worksheet.addRow(totalRowData);
      totalsRow.height = 25;

      // Add footer information
      worksheet.addRow([""]);
      const footerRow = worksheet.addRow([
        `Report generated from DDRC Management System on ${new Date().toLocaleString()}`,
      ]);

      // APPLY STYLES
      const lastColumn = columnLabels.length + 2; // +2 for row label column and totals column

      // Style the main title (row 1)
      worksheet.mergeCells(1, 1, 1, lastColumn);
      titleRow.eachCell((cell) => {
        Object.assign(cell, styles.title);
      });

      // Style the department row (row 2)
      worksheet.mergeCells(2, 1, 2, lastColumn);
      deptRow.eachCell((cell) => {
        Object.assign(cell, styles.subtitle);
      });

      // Style the ministry row (row 3)
      worksheet.mergeCells(3, 1, 3, lastColumn);
      ministryRow.eachCell((cell) => {
        Object.assign(cell, styles.subtitle);
      });

      // Style report title (row 5)
      worksheet.mergeCells(5, 1, 5, lastColumn);
      reportTitleRow.eachCell((cell) => {
        Object.assign(cell, styles.reportTitle);
      });

      // Style metadata section
      for (let r = metaStartRow; r <= metaEndRow; r++) {
        // Apply background to entire metadata section
        for (let c = 1; c <= lastColumn; c++) {
          const cell = worksheet.getCell(r, c);
          Object.assign(cell, styles.metaBg);
        }

        // Style labels and values
        const labelCell = worksheet.getCell(r, 1);
        const valueCell = worksheet.getCell(r, 2);

        Object.assign(labelCell, styles.metaLabel);
        Object.assign(valueCell, styles.metaValue);

        // Merge the value cells
        if (worksheet.getCell(r, 2).value) {
          worksheet.mergeCells(r, 2, r, lastColumn);
        }
      }

      // Style filters section if present
      if (filterStartRow > 0) {
        const filterHeaderCell = worksheet.getCell(filterStartRow, 1);
        Object.assign(filterHeaderCell, {
          font: { size: 12, bold: true, color: { argb: "1A56DB" } },
        });
        worksheet.mergeCells(filterStartRow, 1, filterStartRow, lastColumn);

        for (let r = filterStartRow + 1; r <= filterEndRow; r++) {
          worksheet.mergeCells(r, 1, r, lastColumn);
        }
      }

      // Style table header row
      tableHeaderRow.eachCell((cell) => {
        Object.assign(cell, styles.tableHeader);
      });

      // Style data rows
      dataRows.forEach((row, rowIndex) => {
        // Style row header (first cell)
        const firstCell = row.getCell(1);
        Object.assign(firstCell, styles.rowHeader);

        // Style data cells
        for (let col = 2; col <= columnLabels.length + 1; col++) {
          const cell = row.getCell(col);
          Object.assign(cell, styles.dataCell);

          // Apply zebra striping
          if (rowIndex % 2 !== 0) {
            Object.assign(cell, styles.zebraStripe);
          }
        }

        // Style totals column (last cell)
        const totalCell = row.getCell(lastColumn);
        Object.assign(totalCell, styles.totalsCol);
      });

      // Style totals row
      totalsRow.eachCell((cell, colNumber) => {
        if (colNumber === 1) {
          // "Total" text cell
          Object.assign(cell, styles.totalsRow);
        } else if (colNumber === lastColumn) {
          // Grand total cell
          Object.assign(cell, styles.grandTotal);
        } else {
          // Column totals
          Object.assign(cell, styles.totalsRow);
        }
      });

      // Style footer
      worksheet.mergeCells(
        worksheet.rowCount,
        1,
        worksheet.rowCount,
        lastColumn
      );
      footerRow.eachCell((cell) => {
        Object.assign(cell, styles.footer);
      });

      // Set column widths
      worksheet.columns.forEach((column, index) => {
        if (index === 0) {
          // Row header column - wider
          column.width = 30;
        } else if (index === lastColumn - 1) {
          // Totals column - medium width
          column.width = 15;
        } else {
          // Data columns
          column.width = Math.max(15, columnLabels[index - 1]?.length || 15);
        }
      });
    } catch (error) {
      console.error("Error generating Excel data:", error);
      throw error;
    }

    // Write workbook to file
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  } catch (error) {
    console.error("Error generating report file:", error);
    return null;
  }
}

/**
 * Sanitize a worksheet name to comply with Excel's restrictions
 * @param {string} name - The original worksheet name
 * @returns {string} - A sanitized name valid for Excel
 */
function sanitizeWorksheetName(name) {
  if (!name) return "Report";
  
  // Replace all invalid characters with underscores
  let sanitized = name.replace(/[\*\?\:\\/\[\]]/g, '_');
  
  // Excel has a 31 character limit for worksheet names
  if (sanitized.length > 31) {
    sanitized = sanitized.substring(0, 31);
  }
  
  // Ensure the name isn't empty after sanitization
  if (!sanitized.trim()) {
    sanitized = "Report";
  }
  
  return sanitized;
}

// Helper method to get display text for operators
function getOperatorDisplayText(operator) {
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

/**
 * Fetch report data based on configuration
 * @param {Object} config - Report configuration
 * @returns {Object} - Report data
 */
async function fetchReportData(config) {
  try {
    // Validate configuration
    if (!config || !config.rowVariableId || !config.columnVariableId) {
      throw new Error("Invalid report configuration");
    }

    // Get field information for row and column variables
    const [rowFieldResult] = await pool.query(
      "SELECT * FROM form_fields WHERE id = ?",
      [config.rowVariableId]
    );

    const [columnFieldResult] = await pool.query(
      "SELECT * FROM form_fields WHERE id = ?",
      [config.columnVariableId]
    );

    if (!rowFieldResult.length || !columnFieldResult.length) {
      throw new Error("Field not found");
    }

    const rowField = rowFieldResult[0];
    const columnField = columnFieldResult[0];

    // Prepare filter conditions
    let filterConditions = "";
    let timeFilterCondition = "";
    let filterParams = [];

    // Add filters if present
    if (config.filters && config.filters.length > 0) {
      const filterClauses = [];

      for (const filter of config.filters) {
        // Skip filters without fieldId or operator
        if (!filter.fieldId || !filter.operator) continue;

        // Special handling for date filters using registration_progress table
        if (
          filter.isDateFilter ||
          filter.fieldId === "completed_at" ||
          filter.table === "registration_progress"
        ) {
          // Date filter specific to registration_progress table
          if (
            filter.operator === "between" &&
            Array.isArray(filter.value) &&
            filter.value.length === 2
          ) {
            filterClauses.push(`
              EXISTS (
                SELECT 1 FROM registration_progress rp 
                WHERE rp.id = row_responses.registration_id 
                AND rp.status = 'completed'
                AND DATE(rp.completed_at) BETWEEN ? AND ?
              )
            `);
            filterParams.push(filter.value[0], filter.value[1]);
            continue; // Skip the regular field processing
          }
          // Could add other date operators here if needed
        }

        // Get field info to determine how to filter (for regular fields)
        const [fieldInfo] = await pool.query(
          "SELECT field_type, name FROM form_fields WHERE id = ?",
          [filter.fieldId]
        );

        if (fieldInfo.length === 0) {
          console.warn(`Field not found for filter: ${filter.fieldId}`);
          continue;
        }

        // Handle different filter operators
        switch (filter.operator) {
          case "equals":
            filterClauses.push(`
              EXISTS (
                SELECT 1 FROM registration_responses AS filter_responses
                WHERE filter_responses.registration_id = row_responses.registration_id
                AND filter_responses.field_id = ?
                AND filter_responses.value = ?
              )
            `);
            filterParams.push(filter.fieldId, filter.value);
            break;
          case "not_equals":
            filterClauses.push(`
              NOT EXISTS (
                SELECT 1 FROM registration_responses AS filter_responses
                WHERE filter_responses.registration_id = row_responses.registration_id
                AND filter_responses.field_id = ?
                AND filter_responses.value = ?
              )
            `);
            filterParams.push(filter.fieldId, filter.value);
            break;
          case "contains":
            filterClauses.push(`
              EXISTS (
                SELECT 1 FROM registration_responses AS filter_responses
                WHERE filter_responses.registration_id = row_responses.registration_id
                AND filter_responses.field_id = ?
                AND filter_responses.value LIKE ?
              )
            `);
            filterParams.push(filter.fieldId, `%${filter.value}%`);
            break;
          case "between":
            if (Array.isArray(filter.value) && filter.value.length === 2) {
              // For regular fields (not date fields in registration_progress), handle the between operator
              filterClauses.push(`
                EXISTS (
                  SELECT 1 FROM registration_responses AS filter_responses
                  WHERE filter_responses.registration_id = row_responses.registration_id
                  AND filter_responses.field_id = ?
                  AND filter_responses.value BETWEEN ? AND ?
                )
              `);
              filterParams.push(
                filter.fieldId,
                filter.value[0],
                filter.value[1]
              );
            }
            break;
          // Add more operators as needed
        }
      }

      if (filterClauses.length > 0) {
        filterConditions = ` AND ${filterClauses.join(" AND ")}`;
      }
    }

    // Build the SQL query to fetch the report data using the registration_responses table
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

    // Log the query for debugging purposes
    console.log("Report query:", query, [
      config.rowVariableId,
      config.columnVariableId,
      ...filterParams,
    ]);

    // Execute the query
    const [results] = await pool.query(query, [
      config.rowVariableId,
      config.columnVariableId,
      ...filterParams,
    ]);

    // Process the results
    const rowLabels = [];
    const columnLabels = [];
    const data = [];
    const counts = {};

    // First pass: collect unique row and column labels
    results.forEach((row) => {
      const rowValue = row.row_value || "Not specified";
      const columnValue = row.col_value || "Not specified";

      if (!rowLabels.includes(rowValue)) {
        rowLabels.push(rowValue);
      }

      if (!columnLabels.includes(columnValue)) {
        columnLabels.push(columnValue);
      }

      // Store the count for this combination
      if (!counts[rowValue]) {
        counts[rowValue] = {};
      }
      counts[rowValue][columnValue] = row.count;
    });

    // Sort labels if needed
    rowLabels.sort();
    columnLabels.sort();

    // Second pass: build the data grid
    rowLabels.forEach((rowLabel) => {
      const row = columnLabels.map((columnLabel) => {
        return counts[rowLabel] && counts[rowLabel][columnLabel]
          ? counts[rowLabel][columnLabel]
          : 0;
      });
      data.push(row);
    });

    // Calculate row and column totals
    const rowTotals = data.map((row) =>
      row.reduce((sum, value) => sum + value, 0)
    );

    const columnTotals = columnLabels.map((_, colIndex) =>
      data.reduce((sum, row) => sum + row[colIndex], 0)
    );

    const total = rowTotals.reduce((sum, value) => sum + value, 0);

    return {
      rowLabels,
      columnLabels,
      data,
      rowTotals,
      columnTotals,
      total,
      metadata: {
        rowField,
        columnField,
      },
    };
  } catch (error) {
    console.error("Error fetching report data:", error);
    throw error;
  }
}

/**
 * Log notification status
 * @param {number} notificationId - The notification ID
 * @param {string} status - The status (success/failed)
 * @param {string} message - Additional message
 */
async function logNotificationStatus(notificationId, status, message) {
  try {
    await pool.query(
      "INSERT INTO report_notification_logs (notification_id, status, message) VALUES (?, ?, ?)",
      [notificationId, status, message]
    );
  } catch (error) {
    console.error("Error logging notification status:", error);
  }
}

/**
 * Update the notification status after sending
 * @param {Object} notification - The notification object
 * @returns {Promise<void>}
 */
async function updateNotificationStatus(notification) {
  try {
    // Calculate next scheduled date based on frequency
    const now = new Date();
    let nextScheduledDate = new Date();

    // Default to monthly if frequency is not specified
    const frequency = notification.frequency || "monthly";

    switch (frequency) {
      case "daily":
        nextScheduledDate.setDate(now.getDate() + 1);
        break;
      case "weekly":
        nextScheduledDate.setDate(now.getDate() + 7);
        break;
      case "monthly":
        // Set to the 1st of next month to avoid month-end date issues
        nextScheduledDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      case "quarterly":
        // Set to the 1st of the quarter (3 months ahead)
        nextScheduledDate = new Date(now.getFullYear(), now.getMonth() + 3, 1);
        break;
      case "yearly":
        // Set to the 1st of next year
        nextScheduledDate = new Date(now.getFullYear() + 1, 0, 1);
        break;
      default:
        // Default to monthly - 1st of next month
        nextScheduledDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    // Format date for MySQL
    const formattedDate = nextScheduledDate
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    // Update the notification with the next scheduled date
    await pool.query(
      `UPDATE report_notifications 
       SET next_scheduled_at = ?, 
           last_sent_at = NOW() 
       WHERE id = ?`,
      [formattedDate, notification.id]
    );

    console.log(
      `Updated notification ${notification.id} next scheduled date to ${formattedDate}`
    );
  } catch (error) {
    console.error(
      `Error updating notification status for ${notification.id}:`,
      error
    );
    throw error;
  }
}

/**
 * Process scheduled notifications
 * @returns {Promise<Object>} - Results of the processing
 */
async function processScheduledNotifications() {
  console.log("Processing scheduled notifications:", new Date().toISOString());
  const results = { success: 0, failure: 0, skipped: 0 };
  const processedNotifications = [];

  try {
    // Get all enabled notifications that are due to be sent
    // For monthly reports, this should run on the 1st of each month
    const [notifications] = await pool.query(
      `SELECT rn.*, sr.name, sr.description, sr.category, sr.config, u.full_name as user_name
       FROM report_notifications rn
       JOIN saved_reports sr ON rn.report_id = sr.id
       JOIN users u ON rn.user_id = u.id
       WHERE rn.enabled = 1 
       AND (rn.next_scheduled_at IS NULL OR DATE(rn.next_scheduled_at) <= CURDATE())
       ORDER BY rn.next_scheduled_at ASC`
    );

    console.log(`Found ${notifications.length} notifications to process`);

    // Process each notification
    for (const notification of notifications) {
      try {
        // Get recipients for this notification
        const [recipientsResult] = await pool.query(
          `SELECT email FROM report_notification_recipients 
           WHERE notification_id = ? 
           ORDER BY is_primary DESC`,
          [notification.id]
        );

        const recipients = recipientsResult.map((r) => r.email);

        // Skip if no recipients
        if (recipients.length === 0) {
          console.log(
            `Skipping notification ${notification.id}: No recipients found`
          );
          results.skipped++;

          // Log the skipped notification
          await pool.query(
            `INSERT INTO report_notification_logs 
             (notification_id, status, message) 
             VALUES (?, ?, ?)`,
            [notification.id, "skipped", "No recipients found"]
          );

          continue;
        }

        // Parse the report configuration
        let reportConfig;
        try {
          reportConfig = JSON.parse(notification.config);
        } catch (e) {
          throw new Error(`Invalid report configuration: ${e.message}`);
        }

        // Create report object
        const report = {
          id: notification.report_id,
          name: notification.name,
          description: notification.description,
          category: notification.category,
        };

        // Send the email
        const sendResult = await sendReportEmail(
          notification,
          recipients,
          report,
          reportConfig,
          false, // isManualSend
          null, // dateRange
          notification.user_name // user name
        );

        if (sendResult) {
          results.success++;

          // Log success
          await pool.query(
            `INSERT INTO report_notification_logs 
             (notification_id, status, message) 
             VALUES (?, ?, ?)`,
            [
              notification.id,
              "success",
              `Email sent to ${recipients.join(", ")}`,
            ]
          );
        } else {
          results.failure++;

          // Log failure
          await pool.query(
            `INSERT INTO report_notification_logs 
             (notification_id, status, message) 
             VALUES (?, ?, ?)`,
            [notification.id, "error", "Failed to send email"]
          );
        }

        // Update the next scheduled date
        await updateNotificationStatus(notification);

        // Add to processed list
        processedNotifications.push({
          id: notification.id,
          report_id: notification.report_id,
          recipients: recipients,
          success: sendResult,
          message: sendResult
            ? "Email sent successfully"
            : "Email sending failed",
        });
      } catch (notificationError) {
        console.error(
          `Error processing notification ${notification.id}:`,
          notificationError
        );
        results.failure++;

        // Log the error directly to the database
        await pool.query(
          `INSERT INTO report_notification_logs 
           (notification_id, status, message) 
           VALUES (?, ?, ?)`,
          [notification.id, "error", notificationError.message]
        );
      }
    }

    return { results, processedNotifications };
  } catch (error) {
    console.error("Error in processScheduledNotifications:", error);
    return { results, processedNotifications, error: error.message };
  }
}

// Helper function to format date as YYYY-MM-DD for database operations
function formatDateForDatabase(date) {
  if (typeof date === 'string') {
    // If already a string in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    date = new Date(date);
  }
  
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper function to format date as DD-MM-YYYY for display
function formatDateForDisplay(date) {
  if (typeof date === 'string') {
    // If it's a YYYY-MM-DD string, convert to DD-MM-YYYY
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [year, month, day] = date.split('-');
      return `${day}-${month}-${year}`;
    }
    date = new Date(date);
  }
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// Export the functions
module.exports = {
  sendReportEmail,
  generateReportFile,
  processScheduledNotifications,
  updateNotificationStatus,
};
