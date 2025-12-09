/**
 * ResultsGenerator.gs
 * Populate the Results and Validation_Log sheets
 *
 * ShopFloor Solutions - Operational KPI Calculator
 */

// ============================================================================
// COLOR CONSTANTS
// ============================================================================

const COLORS = {
  // Pillar colors
  PILLAR_1: '#e8f5e9', // Light green - Operational Visibility
  PILLAR_2: '#e3f2fd', // Light blue - Operational Standardization
  PILLAR_3: '#fff3e0', // Light orange - Capacity & Growth

  // Status colors
  VALID: '#4caf50',    // Green
  WARNING: '#ff9800',  // Orange
  ERROR: '#f44336',    // Red
  INFO: '#2196f3',     // Blue
  NA: '#9e9e9e',       // Gray

  // Header colors
  HEADER_BG: '#1a237e',     // Dark blue
  HEADER_TEXT: '#ffffff',    // White
  SECTION_HEADER: '#3f51b5', // Indigo

  // Alternating rows
  ROW_ALT: '#f5f5f5'
};

// ============================================================================
// MAIN RESULTS GENERATION
// ============================================================================

/**
 * Generate complete results for a client
 * Now tier-aware: only shows KPIs applicable to client's form_tier
 * Clears and rebuilds Results and Validation_Log sheets
 * @param {string} clientId - Client ID
 * @param {Object} clientData - Client data object (includes formTier)
 * @param {Object} allValues - All KPI values (raw + calculated)
 * @param {Object} validationResult - Validation result {status, issues}
 * @param {Object[]} insights - Generated insights
 * @param {Object[]} kpiConfig - KPI definitions
 * @param {Object[]} sectionConfig - Section definitions
 */
function generateResults(clientId, clientData, allValues, validationResult, insights, kpiConfig, sectionConfig) {
  // Clear existing results
  clearResultsSheet();
  clearValidationLogSheet();

  // Get sheets
  const resultsSheet = getRequiredSheet(SHEET_NAMES.RESULTS);
  const validationSheet = getRequiredSheet(SHEET_NAMES.VALIDATION_LOG);

  // Get tier-filtered KPIs
  const clientTier = clientData.formTier || '';
  let tierKPIs = kpiConfig;
  if (clientTier) {
    tierKPIs = getKPIsForTier(kpiConfig, clientTier);
    log(`Results filtered to ${tierKPIs.length} KPIs for tier: ${clientTier}`);
  }

  // Write results
  let currentRow = 1;

  // Header section (now includes tier info)
  currentRow = writeResultsHeader(resultsSheet, currentRow, clientData, validationResult.status);
  currentRow += 1; // Blank row

  // Volume metrics section (filtered by tier)
  currentRow = writeKPISection(
    resultsSheet,
    currentRow,
    'VOLUME METRICS',
    'volume',
    allValues,
    tierKPIs,  // Use tier-filtered KPIs
    sectionConfig,
    validationResult.issues
  );
  currentRow += 1; // Blank row

  // Efficiency metrics section (filtered by tier)
  currentRow = writeKPISection(
    resultsSheet,
    currentRow,
    'EFFICIENCY METRICS',
    'efficiency',
    allValues,
    tierKPIs,  // Use tier-filtered KPIs
    sectionConfig,
    validationResult.issues
  );
  currentRow += 1; // Blank row

  // Insights section
  currentRow = writeInsightsSection(resultsSheet, currentRow, insights);

  // Format the results sheet
  formatResultsSheet(resultsSheet);

  // Write validation log
  writeValidationLog(validationSheet, validationResult.issues, tierKPIs, sectionConfig);

  // Flush changes
  SpreadsheetApp.flush();

  log(`Results generated for client ${clientId}`);
}

// ============================================================================
// CLEAR SHEETS
// ============================================================================

/**
 * Clear the Results sheet
 */
function clearResultsSheet() {
  const sheet = getOrCreateSheet(SHEET_NAMES.RESULTS);
  sheet.clearContents();
  sheet.clearFormats();

  // Reset column widths
  try {
    sheet.setColumnWidth(1, 200); // KPI Name
    sheet.setColumnWidth(2, 120); // Value
    sheet.setColumnWidth(3, 100); // Type
    sheet.setColumnWidth(4, 60);  // Status
    sheet.setColumnWidth(5, 150); // Sections
    sheet.setColumnWidth(6, 300); // Notes
  } catch (e) {
    // Ignore column width errors
  }
}

/**
 * Clear the Validation_Log sheet (keep headers)
 */
function clearValidationLogSheet() {
  const sheet = getOrCreateSheet(SHEET_NAMES.VALIDATION_LOG);
  const lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
}

// ============================================================================
// HEADER SECTION
// ============================================================================

/**
 * Write header section to Results sheet
 * Now includes tier information
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} startRow
 * @param {Object} clientData
 * @param {string} overallStatus
 * @returns {number} Next row number
 */
function writeResultsHeader(sheet, startRow, clientData, overallStatus) {
  let row = startRow;

  // Title
  sheet.getRange(row, 1).setValue('OPERATIONAL KPI ANALYSIS');
  sheet.getRange(row, 1, 1, 6).merge();
  sheet.getRange(row, 1)
    .setFontSize(18)
    .setFontWeight('bold')
    .setFontColor(COLORS.HEADER_BG)
    .setHorizontalAlignment('center');
  row++;

  // Client info
  const clientInfo = `${clientData.companyName} | ${clientData.industry} | ${clientData.state} | ${capitalizeFirst(clientData.dataPeriod)} Data`;
  sheet.getRange(row, 1).setValue(clientInfo);
  sheet.getRange(row, 1, 1, 6).merge();
  sheet.getRange(row, 1)
    .setFontSize(12)
    .setHorizontalAlignment('center')
    .setFontColor('#666666');
  row++;

  // Tier info (if set)
  if (clientData.formTier) {
    const tierLabels = {
      'onboarding': 'Quick Assessment',
      'detailed': 'Comprehensive Diagnostic',
      'section_deep': 'Full Operational Analysis'
    };
    const tierLabel = tierLabels[clientData.formTier.toLowerCase()] || clientData.formTier;
    const tierText = `Assessment Type: ${tierLabel}`;
    sheet.getRange(row, 1).setValue(tierText);
    sheet.getRange(row, 1, 1, 6).merge();
    sheet.getRange(row, 1)
      .setFontSize(11)
      .setHorizontalAlignment('center')
      .setFontColor('#1565c0')
      .setFontStyle('italic');
    row++;
  }

  // Analysis timestamp
  const timestamp = `Analyzed: ${formatDate(new Date())}`;
  sheet.getRange(row, 1).setValue(timestamp);
  sheet.getRange(row, 1, 1, 6).merge();
  sheet.getRange(row, 1)
    .setFontSize(10)
    .setHorizontalAlignment('center')
    .setFontColor('#999999');
  row++;

  // Overall status
  const statusText = `Status: ${overallStatus.toUpperCase()}`;
  sheet.getRange(row, 1).setValue(statusText);
  sheet.getRange(row, 1, 1, 6).merge();

  const statusColor = getStatusColor(overallStatus);
  sheet.getRange(row, 1)
    .setFontSize(14)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setFontColor(statusColor)
    .setBackground(statusColor + '22'); // Add alpha for light background

  row++;

  return row;
}

// ============================================================================
// KPI SECTIONS
// ============================================================================

/**
 * Write a KPI section (Volume or Efficiency)
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} startRow
 * @param {string} sectionTitle
 * @param {string} category
 * @param {Object} allValues
 * @param {Object[]} kpiConfig
 * @param {Object[]} sectionConfig
 * @param {Object[]} validationIssues
 * @returns {number} Next row number
 */
function writeKPISection(sheet, startRow, sectionTitle, category, allValues, kpiConfig, sectionConfig, validationIssues) {
  let row = startRow;

  // Section header
  sheet.getRange(row, 1).setValue(sectionTitle);
  sheet.getRange(row, 1, 1, 6).merge();
  sheet.getRange(row, 1)
    .setFontSize(14)
    .setFontWeight('bold')
    .setBackground(COLORS.SECTION_HEADER)
    .setFontColor(COLORS.HEADER_TEXT);
  row++;

  // Column headers
  const headers = ['KPI Name', 'Value', 'Type', 'Status', 'Sections', 'Notes'];
  sheet.getRange(row, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(row, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground(COLORS.HEADER_BG)
    .setFontColor(COLORS.HEADER_TEXT);
  row++;

  // Get KPIs for this category
  const categoryKPIs = kpiConfig
    .filter(k => k.category === category)
    .sort((a, b) => {
      // Sort: inputs first (by form_order), then calculated
      if (a.type !== b.type) {
        return a.type === 'input' ? -1 : 1;
      }
      return (a.formOrder || 999) - (b.formOrder || 999);
    });

  // Write each KPI row
  for (let i = 0; i < categoryKPIs.length; i++) {
    const kpi = categoryKPIs[i];
    const value = allValues[kpi.id];
    const status = getKPIStatus(kpi.id, value, validationIssues);
    const sectionNames = getSectionNamesForKPI(kpi, sectionConfig);
    const notes = getKPINotes(kpi.id, value, validationIssues);

    const rowData = [
      kpi.name,
      formatValue(value, kpi.dataType),
      capitalizeFirst(kpi.type),
      status.icon,
      sectionNames,
      notes
    ];

    sheet.getRange(row, 1, 1, rowData.length).setValues([rowData]);

    // Apply row formatting
    const rowRange = sheet.getRange(row, 1, 1, rowData.length);

    // Pillar-based background color
    const pillarColor = getPillarColor(kpi.pillar);
    rowRange.setBackground(pillarColor);

    // Status-based text color for status column
    sheet.getRange(row, 4)
      .setFontColor(status.color)
      .setFontWeight('bold')
      .setHorizontalAlignment('center');

    // Value alignment
    sheet.getRange(row, 2).setHorizontalAlignment('right');

    // Alternating row tint
    if (i % 2 === 1) {
      // Slightly darker for alternating rows
      rowRange.setBackground(adjustColor(pillarColor, -5));
    }

    row++;
  }

  return row;
}

// ============================================================================
// INSIGHTS SECTION
// ============================================================================

/**
 * Write Insights section
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} startRow
 * @param {Object[]} insights
 * @returns {number} Next row number
 */
function writeInsightsSection(sheet, startRow, insights) {
  let row = startRow;

  // Section header
  sheet.getRange(row, 1).setValue('INSIGHTS & FINDINGS');
  sheet.getRange(row, 1, 1, 6).merge();
  sheet.getRange(row, 1)
    .setFontSize(14)
    .setFontWeight('bold')
    .setBackground(COLORS.SECTION_HEADER)
    .setFontColor(COLORS.HEADER_TEXT);
  row++;

  if (!insights || insights.length === 0) {
    sheet.getRange(row, 1).setValue('No insights generated. More data may be needed.');
    sheet.getRange(row, 1, 1, 6).merge();
    sheet.getRange(row, 1).setFontStyle('italic').setFontColor('#999999');
    return row + 1;
  }

  // Write each insight
  for (const insight of insights) {
    // Insight title
    const statusIcon = getInsightStatusIcon(insight.status);
    sheet.getRange(row, 1).setValue(`${statusIcon} ${insight.title}`);
    sheet.getRange(row, 1, 1, 6).merge();
    sheet.getRange(row, 1)
      .setFontWeight('bold')
      .setFontSize(11)
      .setFontColor(getInsightStatusColor(insight.status));
    row++;

    // Summary
    sheet.getRange(row, 1).setValue(insight.summary);
    sheet.getRange(row, 1, 1, 6).merge();
    sheet.getRange(row, 1).setWrap(true);
    row++;

    // Detail (if different from summary)
    if (insight.detail && insight.detail !== insight.summary) {
      sheet.getRange(row, 1).setValue(insight.detail);
      sheet.getRange(row, 1, 1, 6).merge();
      sheet.getRange(row, 1)
        .setWrap(true)
        .setFontColor('#666666')
        .setFontSize(10);
      row++;
    }

    // Recommendations
    if (insight.recommendations && insight.recommendations.length > 0) {
      for (const rec of insight.recommendations) {
        sheet.getRange(row, 1).setValue(`  → ${rec}`);
        sheet.getRange(row, 1, 1, 6).merge();
        sheet.getRange(row, 1)
          .setFontColor('#1565c0')
          .setFontSize(10);
        row++;
      }
    }

    row++; // Space between insights
  }

  return row;
}

// ============================================================================
// VALIDATION LOG
// ============================================================================

/**
 * Write validation issues to Validation_Log sheet
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object[]} issues
 * @param {Object[]} kpiConfig
 * @param {Object[]} sectionConfig
 */
function writeValidationLog(sheet, issues, kpiConfig, sectionConfig) {
  // Ensure headers exist
  const headers = [
    'Severity', 'Rule Name', 'Message', 'Expected', 'Actual',
    'Variance', 'Affected KPIs', 'Affected Sections', 'Suggested Action'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground(COLORS.HEADER_BG)
    .setFontColor(COLORS.HEADER_TEXT);

  if (!issues || issues.length === 0) {
    sheet.getRange(2, 1).setValue('No validation issues found');
    sheet.getRange(2, 1, 1, headers.length).merge();
    sheet.getRange(2, 1).setFontStyle('italic').setFontColor('#4caf50');
    return;
  }

  // Sort issues by severity
  const sortedIssues = [...issues].sort((a, b) => {
    const order = { error: 0, warning: 1, info: 2 };
    return (order[a.severity] || 99) - (order[b.severity] || 99);
  });

  // Write issues
  const rows = sortedIssues.map(issue => {
    const sectionNames = issue.affectedSections ?
      issue.affectedSections.map(id => {
        const section = sectionConfig.find(s => s.sectionId === id);
        return section ? section.sectionName : `Section ${id}`;
      }).join(', ') : '';

    return [
      issue.severity.toUpperCase(),
      issue.ruleName,
      issue.message,
      issue.expected !== null ? String(issue.expected) : '',
      issue.actual !== null ? String(issue.actual) : '',
      issue.variance !== null ? (issue.variance * 100).toFixed(1) + '%' : '',
      issue.affectedKPIs ? issue.affectedKPIs.join(', ') : '',
      sectionNames,
      getSuggestedAction(issue)
    ];
  });

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

  // Color code by severity
  for (let i = 0; i < sortedIssues.length; i++) {
    const severity = sortedIssues[i].severity;
    const color = severity === 'error' ? COLORS.ERROR :
                  severity === 'warning' ? COLORS.WARNING : COLORS.INFO;

    sheet.getRange(i + 2, 1)
      .setFontColor(color)
      .setFontWeight('bold');
  }

  // Auto-resize columns
  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }

  sheet.setFrozenRows(1);
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Apply final formatting to Results sheet
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 */
function formatResultsSheet(sheet) {
  // Auto-resize columns
  for (let i = 1; i <= 6; i++) {
    sheet.autoResizeColumn(i);
  }

  // Set minimum widths
  if (sheet.getColumnWidth(1) < 180) sheet.setColumnWidth(1, 180);
  if (sheet.getColumnWidth(6) < 250) sheet.setColumnWidth(6, 250);

  // Add borders to data sections
  const lastRow = sheet.getLastRow();
  if (lastRow > 4) {
    sheet.getRange(5, 1, lastRow - 4, 6).setBorder(
      true, true, true, true, false, false,
      '#cccccc', SpreadsheetApp.BorderStyle.SOLID
    );
  }
}

/**
 * Get status for a KPI
 * @param {string} kpiId
 * @param {any} value
 * @param {Object[]} validationIssues
 * @returns {Object} {icon, color, text}
 */
function getKPIStatus(kpiId, value, validationIssues) {
  // Check if value is missing
  if (isEmpty(value)) {
    return {
      icon: '—',
      color: COLORS.NA,
      text: 'N/A'
    };
  }

  // Find most severe issue for this KPI
  const issue = getMostSevereIssueForKPI(kpiId, validationIssues);

  if (!issue) {
    return {
      icon: '✓',
      color: COLORS.VALID,
      text: 'Valid'
    };
  }

  switch (issue.severity) {
    case 'error':
      return { icon: '✗', color: COLORS.ERROR, text: 'Error' };
    case 'warning':
      return { icon: '⚠', color: COLORS.WARNING, text: 'Warning' };
    case 'info':
      return { icon: 'ℹ', color: COLORS.INFO, text: 'Info' };
    default:
      return { icon: '✓', color: COLORS.VALID, text: 'Valid' };
  }
}

/**
 * Get notes for a KPI based on validation issues
 * @param {string} kpiId
 * @param {any} value
 * @param {Object[]} validationIssues
 * @returns {string}
 */
function getKPINotes(kpiId, value, validationIssues) {
  if (isEmpty(value)) {
    return 'No data provided';
  }

  const issues = getIssuesForKPI(kpiId, validationIssues);

  if (issues.length === 0) {
    return '';
  }

  // Return the first issue message
  return issues[0].message;
}

/**
 * Get section names for a KPI
 * @param {Object} kpi
 * @param {Object[]} sectionConfig
 * @returns {string}
 */
function getSectionNamesForKPI(kpi, sectionConfig) {
  if (!kpi.sections || kpi.sections.length === 0) {
    return '';
  }

  const names = kpi.sections.map(id => {
    const section = sectionConfig.find(s => s.sectionId === id);
    return section ? section.sectionName : '';
  }).filter(n => n);

  return names.join(', ');
}

/**
 * Get background color for pillar
 * @param {number} pillarId
 * @returns {string} Hex color
 */
function getPillarColor(pillarId) {
  switch (pillarId) {
    case 1: return COLORS.PILLAR_1;
    case 2: return COLORS.PILLAR_2;
    case 3: return COLORS.PILLAR_3;
    default: return '#ffffff';
  }
}

/**
 * Get color for overall status
 * @param {string} status
 * @returns {string}
 */
function getStatusColor(status) {
  switch (status) {
    case VALIDATION_STATUS.VALID: return COLORS.VALID;
    case VALIDATION_STATUS.WARNINGS: return COLORS.WARNING;
    case VALIDATION_STATUS.ERRORS: return COLORS.ERROR;
    default: return COLORS.NA;
  }
}

/**
 * Get status icon for insight
 * @param {string} status
 * @returns {string}
 */
function getInsightStatusIcon(status) {
  switch (status) {
    case 'good': return '✓';
    case 'warning': return '⚠';
    case 'concern': return '✗';
    case 'unknown': return '?';
    default: return '•';
  }
}

/**
 * Get color for insight status
 * @param {string} status
 * @returns {string}
 */
function getInsightStatusColor(status) {
  switch (status) {
    case 'good': return COLORS.VALID;
    case 'warning': return COLORS.WARNING;
    case 'concern': return COLORS.ERROR;
    default: return '#666666';
  }
}

/**
 * Capitalize first letter
 * @param {string} str
 * @returns {string}
 */
function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Adjust color brightness
 * @param {string} hex - Hex color
 * @param {number} amount - Amount to adjust (-255 to 255)
 * @returns {string} Adjusted hex color
 */
function adjustColor(hex, amount) {
  // Remove # if present
  hex = hex.replace('#', '');

  // Parse RGB
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);

  // Adjust
  r = Math.max(0, Math.min(255, r + amount));
  g = Math.max(0, Math.min(255, g + amount));
  b = Math.max(0, Math.min(255, b + amount));

  // Convert back to hex
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}
