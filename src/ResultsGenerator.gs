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
  ROW_ALT: '#f5f5f5',

  // Benchmark rating colors (background)
  RATING_CRITICAL_BG: '#ffcdd2',   // Light red
  RATING_POOR_BG: '#ffebee',       // Very light red
  RATING_AVERAGE_BG: '#fff3e0',    // Light orange
  RATING_GOOD_BG: '#e8f5e9',       // Light green
  RATING_EXCELLENT_BG: '#c8e6c9',  // Medium green
  RATING_NONE_BG: '#f5f5f5',       // Light gray

  // Benchmark rating colors (text)
  RATING_CRITICAL_TEXT: '#b71c1c', // Dark red
  RATING_POOR_TEXT: '#c62828',     // Red
  RATING_AVERAGE_TEXT: '#f57c00',  // Orange
  RATING_GOOD_TEXT: '#2e7d32',     // Green
  RATING_EXCELLENT_TEXT: '#1b5e20', // Dark green
  RATING_NONE_TEXT: '#9e9e9e'      // Gray
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

  // Load benchmarks for this client's industry/state
  const benchmarks = loadBenchmarksForResults(clientData.industry, clientData.state);

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
    validationResult.issues,
    benchmarks,  // Pass benchmarks for rating
    clientData   // Pass clientData for period adjustment
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
    validationResult.issues,
    benchmarks,  // Pass benchmarks for rating
    clientData   // Pass clientData for period adjustment
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

  // Reset column widths (8 columns now with Rating and vs Benchmark)
  try {
    sheet.setColumnWidth(1, 200); // KPI Name
    sheet.setColumnWidth(2, 120); // Value
    sheet.setColumnWidth(3, 100); // Type
    sheet.setColumnWidth(4, 60);  // Status
    sheet.setColumnWidth(5, 80);  // Rating
    sheet.setColumnWidth(6, 110); // vs Benchmark
    sheet.setColumnWidth(7, 150); // Sections
    sheet.setColumnWidth(8, 300); // Notes
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
  const colSpan = 8;  // Updated for 8 columns

  // Title
  sheet.getRange(row, 1).setValue('OPERATIONAL KPI ANALYSIS');
  sheet.getRange(row, 1, 1, colSpan).merge();
  sheet.getRange(row, 1)
    .setFontSize(18)
    .setFontWeight('bold')
    .setFontColor(COLORS.HEADER_BG)
    .setHorizontalAlignment('center');
  row++;

  // Client info
  const clientInfo = `${clientData.companyName} | ${clientData.industry} | ${clientData.state} | ${capitalizeFirst(clientData.dataPeriod)} Data`;
  sheet.getRange(row, 1).setValue(clientInfo);
  sheet.getRange(row, 1, 1, colSpan).merge();
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
    sheet.getRange(row, 1, 1, colSpan).merge();
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
  sheet.getRange(row, 1, 1, colSpan).merge();
  sheet.getRange(row, 1)
    .setFontSize(10)
    .setHorizontalAlignment('center')
    .setFontColor('#999999');
  row++;

  // Overall status
  const statusText = `Status: ${overallStatus.toUpperCase()}`;
  sheet.getRange(row, 1).setValue(statusText);
  sheet.getRange(row, 1, 1, colSpan).merge();

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
 * Write a KPI section (Volume or Efficiency) with benchmark ratings
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} startRow
 * @param {string} sectionTitle
 * @param {string} category
 * @param {Object} allValues
 * @param {Object[]} kpiConfig
 * @param {Object[]} sectionConfig
 * @param {Object[]} validationIssues
 * @param {Object} benchmarks - Benchmarks keyed by kpiId (from loadBenchmarksForResults)
 * @param {Object} clientData - Client data object (for period adjustment)
 * @returns {number} Next row number
 */
function writeKPISection(sheet, startRow, sectionTitle, category, allValues, kpiConfig, sectionConfig, validationIssues, benchmarks, clientData) {
  let row = startRow;
  const colSpan = 8;  // Updated for 8 columns

  // Section header
  sheet.getRange(row, 1).setValue(sectionTitle);
  sheet.getRange(row, 1, 1, colSpan).merge();
  sheet.getRange(row, 1)
    .setFontSize(14)
    .setFontWeight('bold')
    .setBackground(COLORS.SECTION_HEADER)
    .setFontColor(COLORS.HEADER_TEXT);
  row++;

  // Column headers - updated with Rating and vs Benchmark
  const headers = ['KPI Name', 'Value', 'Type', 'Status', 'Rating', 'vs Benchmark', 'Sections', 'Notes'];
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

    // Get benchmark rating using the new BenchmarkEngine functions
    // Adjust benchmark thresholds for user's data period (monthly/quarterly/annual)
    const rawBenchmark = benchmarks ? benchmarks[kpi.id] : null;
    const userPeriod = clientData?.dataPeriod || 'annual';
    const benchmark = adjustBenchmarkForPeriod(rawBenchmark, userPeriod);
    const ratingDisplay = getRatingDisplay(value, benchmark, benchmark?.direction || 'higher');

    const rowData = [
      kpi.name,
      formatValue(value, kpi.dataType),
      capitalizeFirst(kpi.type),
      status.icon,
      ratingDisplay.label || '—',           // Rating column
      ratingDisplay.comparison || '',        // vs Benchmark column
      sectionNames,
      notes
    ];

    sheet.getRange(row, 1, 1, rowData.length).setValues([rowData]);

    // Apply row formatting
    const rowRange = sheet.getRange(row, 1, 1, rowData.length);

    // Pillar-based background color (for non-rating columns)
    const pillarColor = getPillarColor(kpi.pillar);
    rowRange.setBackground(pillarColor);

    // Status-based text color for status column (col 4)
    sheet.getRange(row, 4)
      .setFontColor(status.color)
      .setFontWeight('bold')
      .setHorizontalAlignment('center');

    // Rating column formatting (col 5) - override pillar color with rating color
    if (ratingDisplay.rating) {
      const ratingBgColor = getRatingBackgroundColor(ratingDisplay.rating);
      const ratingTextColor = getRatingTextColor(ratingDisplay.rating);
      sheet.getRange(row, 5)
        .setBackground(ratingBgColor)
        .setFontColor(ratingTextColor)
        .setFontWeight('bold')
        .setHorizontalAlignment('center');
    } else {
      sheet.getRange(row, 5)
        .setBackground(COLORS.RATING_NONE_BG)
        .setFontColor(COLORS.RATING_NONE_TEXT)
        .setHorizontalAlignment('center');
    }

    // vs Benchmark column formatting (col 6) - gray italic
    sheet.getRange(row, 6)
      .setFontColor('#9e9e9e')
      .setFontStyle('italic')
      .setFontSize(9);

    // Value alignment
    sheet.getRange(row, 2).setHorizontalAlignment('right');

    // Alternating row tint (but keep rating column with its own color)
    if (i % 2 === 1) {
      // Apply alternating color to non-rating columns only
      sheet.getRange(row, 1, 1, 4).setBackground(adjustColor(pillarColor, -5));
      sheet.getRange(row, 6, 1, 3).setBackground(adjustColor(pillarColor, -5));
    }

    row++;
  }

  return row;
}

/**
 * Get background color for a rating level
 * @param {string} rating - Rating level: critical, poor, average, good, excellent
 * @returns {string} Hex color
 */
function getRatingBackgroundColor(rating) {
  switch (rating) {
    case 'critical': return COLORS.RATING_CRITICAL_BG;
    case 'poor': return COLORS.RATING_POOR_BG;
    case 'average': return COLORS.RATING_AVERAGE_BG;
    case 'good': return COLORS.RATING_GOOD_BG;
    case 'excellent': return COLORS.RATING_EXCELLENT_BG;
    default: return COLORS.RATING_NONE_BG;
  }
}

/**
 * Get text color for a rating level
 * @param {string} rating - Rating level: critical, poor, average, good, excellent
 * @returns {string} Hex color
 */
function getRatingTextColor(rating) {
  switch (rating) {
    case 'critical': return COLORS.RATING_CRITICAL_TEXT;
    case 'poor': return COLORS.RATING_POOR_TEXT;
    case 'average': return COLORS.RATING_AVERAGE_TEXT;
    case 'good': return COLORS.RATING_GOOD_TEXT;
    case 'excellent': return COLORS.RATING_EXCELLENT_TEXT;
    default: return COLORS.RATING_NONE_TEXT;
  }
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
  const colSpan = 8;  // Updated for 8 columns

  // Section header
  sheet.getRange(row, 1).setValue('INSIGHTS & FINDINGS');
  sheet.getRange(row, 1, 1, colSpan).merge();
  sheet.getRange(row, 1)
    .setFontSize(14)
    .setFontWeight('bold')
    .setBackground(COLORS.SECTION_HEADER)
    .setFontColor(COLORS.HEADER_TEXT);
  row++;

  if (!insights || insights.length === 0) {
    sheet.getRange(row, 1).setValue('No insights generated. More data may be needed.');
    sheet.getRange(row, 1, 1, colSpan).merge();
    sheet.getRange(row, 1).setFontStyle('italic').setFontColor('#999999');
    return row + 1;
  }

  // Write each insight
  for (const insight of insights) {
    // Insight title
    const statusIcon = getInsightStatusIcon(insight.status);
    sheet.getRange(row, 1).setValue(`${statusIcon} ${insight.title}`);
    sheet.getRange(row, 1, 1, colSpan).merge();
    sheet.getRange(row, 1)
      .setFontWeight('bold')
      .setFontSize(11)
      .setFontColor(getInsightStatusColor(insight.status));
    row++;

    // Summary
    sheet.getRange(row, 1).setValue(insight.summary);
    sheet.getRange(row, 1, 1, colSpan).merge();
    sheet.getRange(row, 1).setWrap(true);
    row++;

    // Detail (if different from summary)
    if (insight.detail && insight.detail !== insight.summary) {
      sheet.getRange(row, 1).setValue(insight.detail);
      sheet.getRange(row, 1, 1, colSpan).merge();
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
        sheet.getRange(row, 1, 1, colSpan).merge();
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
  // Auto-resize columns (8 columns now)
  for (let i = 1; i <= 8; i++) {
    sheet.autoResizeColumn(i);
  }

  // Set minimum widths
  if (sheet.getColumnWidth(1) < 180) sheet.setColumnWidth(1, 180);  // KPI Name
  if (sheet.getColumnWidth(5) < 80) sheet.setColumnWidth(5, 80);    // Rating
  if (sheet.getColumnWidth(6) < 100) sheet.setColumnWidth(6, 100);  // vs Benchmark
  if (sheet.getColumnWidth(8) < 250) sheet.setColumnWidth(8, 250);  // Notes

  // Add borders to data sections
  const lastRow = sheet.getLastRow();
  if (lastRow > 4) {
    sheet.getRange(5, 1, lastRow - 4, 8).setBorder(
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
