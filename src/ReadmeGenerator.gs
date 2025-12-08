/**
 * ReadmeGenerator.gs
 * Creates a comprehensive README/Help sheet with user instructions
 *
 * ShopFloor Solutions - Operational KPI Calculator
 *
 * Run initializeReadmeSheet() to create/update the README sheet
 */

// ============================================================================
// MAIN INITIALIZATION FUNCTION
// ============================================================================

/**
 * Initialize the README sheet with comprehensive user instructions
 * Run this function to create or update the help documentation
 */
function initializeReadmeSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Delete existing README sheet if it exists
  let sheet = ss.getSheetByName('README');
  if (sheet) {
    ss.deleteSheet(sheet);
  }

  // Create new README sheet
  sheet = ss.insertSheet('README', 0); // Insert at first position

  // Set up the sheet
  sheet.setColumnWidth(1, 30);   // Spacer
  sheet.setColumnWidth(2, 250);  // Main content column 1
  sheet.setColumnWidth(3, 350);  // Main content column 2
  sheet.setColumnWidth(4, 350);  // Main content column 3
  sheet.setColumnWidth(5, 300);  // Main content column 4
  sheet.setColumnWidth(6, 30);   // Spacer

  let currentRow = 1;

  // ========== HEADER SECTION ==========
  currentRow = writeHeaderSection(sheet, currentRow);

  // ========== TABLE OF CONTENTS ==========
  currentRow = writeTableOfContents(sheet, currentRow);

  // ========== QUICK START GUIDE ==========
  currentRow = writeQuickStartSection(sheet, currentRow);

  // ========== SHEET OVERVIEW ==========
  currentRow = writeSheetOverviewSection(sheet, currentRow);

  // ========== CONFIG_KPIS DETAILED GUIDE ==========
  currentRow = writeKPIConfigSection(sheet, currentRow);

  // ========== CONFIG_VALIDATIONS DETAILED GUIDE ==========
  currentRow = writeValidationConfigSection(sheet, currentRow);

  // ========== CONFIG_SECTIONS DETAILED GUIDE ==========
  currentRow = writeSectionConfigSection(sheet, currentRow);

  // ========== CONFIG_BENCHMARKS DETAILED GUIDE ==========
  currentRow = writeBenchmarkConfigSection(sheet, currentRow);

  // ========== UNDERSTANDING PILLARS & SECTIONS ==========
  currentRow = writePillarsAndSectionsSection(sheet, currentRow);

  // ========== FORMULA REFERENCE ==========
  currentRow = writeFormulaReferenceSection(sheet, currentRow);

  // ========== TROUBLESHOOTING ==========
  currentRow = writeTroubleshootingSection(sheet, currentRow);

  // ========== GLOSSARY ==========
  currentRow = writeGlossarySection(sheet, currentRow);

  // Freeze the header
  sheet.setFrozenRows(3);

  // Protect the sheet (optional - comment out if editing needed)
  // sheet.protect().setDescription('README - Protected Documentation');

  // Set sheet tab color
  sheet.setTabColor('#1a237e');

  // Move to first position
  ss.setActiveSheet(sheet);
  ss.moveActiveSheet(1);

  SpreadsheetApp.getActiveSpreadsheet().toast('README sheet created successfully!', 'Documentation', 5);

  return sheet;
}

// ============================================================================
// SECTION WRITERS
// ============================================================================

/**
 * Write the header section
 */
function writeHeaderSection(sheet, startRow) {
  let row = startRow;

  // Title banner
  const titleRange = sheet.getRange(row, 2, 1, 4);
  titleRange.merge();
  titleRange.setValue('📊 SHOPFLOOR SOLUTIONS - OPERATIONAL KPI CALCULATOR');
  titleRange.setBackground('#1a237e');
  titleRange.setFontColor('#ffffff');
  titleRange.setFontSize(18);
  titleRange.setFontWeight('bold');
  titleRange.setHorizontalAlignment('center');
  titleRange.setVerticalAlignment('middle');
  sheet.setRowHeight(row, 50);
  row++;

  // Subtitle
  const subtitleRange = sheet.getRange(row, 2, 1, 4);
  subtitleRange.merge();
  subtitleRange.setValue('User Guide & System Documentation — Version 1.0');
  subtitleRange.setBackground('#3f51b5');
  subtitleRange.setFontColor('#ffffff');
  subtitleRange.setFontSize(12);
  subtitleRange.setHorizontalAlignment('center');
  sheet.setRowHeight(row, 30);
  row++;

  // Spacer
  row++;

  // Welcome message
  const welcomeRange = sheet.getRange(row, 2, 1, 4);
  welcomeRange.merge();
  welcomeRange.setValue('Welcome! This guide explains how to use the KPI Calculator system. Use the menu "ShopFloor Tools" to access all features.');
  welcomeRange.setFontSize(11);
  welcomeRange.setFontStyle('italic');
  welcomeRange.setBackground('#e8eaf6');
  welcomeRange.setWrap(true);
  sheet.setRowHeight(row, 40);
  row++;

  row++; // Spacer
  return row;
}

/**
 * Write table of contents
 */
function writeTableOfContents(sheet, startRow) {
  let row = startRow;

  // Section header
  row = writeSectionHeader(sheet, row, '📑 TABLE OF CONTENTS', '#1565c0');

  const tocItems = [
    ['1.', 'Quick Start Guide', 'Get up and running in 5 minutes'],
    ['2.', 'Sheet Overview', 'What each sheet does'],
    ['3.', 'Config_KPIs Guide', 'How to define and modify KPIs'],
    ['4.', 'Config_Validations Guide', 'How to set up data validation rules'],
    ['5.', 'Config_Sections Guide', 'Understanding business sections'],
    ['6.', 'Config_Benchmarks Guide', 'Setting industry benchmarks'],
    ['7.', 'Pillars & Sections Explained', 'The framework behind the tool'],
    ['8.', 'Formula Reference', 'All available formula types'],
    ['9.', 'Troubleshooting', 'Common issues and solutions'],
    ['10.', 'Glossary', 'Term definitions']
  ];

  for (const item of tocItems) {
    sheet.getRange(row, 2).setValue(item[0]).setFontWeight('bold').setFontColor('#1565c0');
    sheet.getRange(row, 3).setValue(item[1]).setFontWeight('bold');
    sheet.getRange(row, 4, 1, 2).merge().setValue(item[2]).setFontColor('#666666');
    row++;
  }

  row++; // Spacer
  return row;
}

/**
 * Write Quick Start section
 */
function writeQuickStartSection(sheet, startRow) {
  let row = startRow;

  row = writeSectionHeader(sheet, row, '🚀 1. QUICK START GUIDE', '#2e7d32');

  const steps = [
    ['Step 1:', 'Initialize the System', 'Go to ShopFloor Tools → Administration → Initialize System', 'This creates all required sheets with sample data'],
    ['Step 2:', 'Create the Form', 'Go to ShopFloor Tools → Form Management → Recreate Form', 'Creates a Google Form for client data collection'],
    ['Step 3:', 'Share the Form', 'Go to ShopFloor Tools → Form Management → Get Form URL', 'Copy the link and send to clients'],
    ['Step 4:', 'Select a Client', 'Go to ShopFloor Tools → Select Client...', 'Choose which client to analyze'],
    ['Step 5:', 'Run Analysis', 'Go to ShopFloor Tools → Run Analysis', 'Calculates KPIs and generates insights'],
    ['Step 6:', 'View Results', 'Check the "Results" sheet', 'See all calculated metrics and insights'],
    ['Step 7:', 'Check Validation', 'Go to ShopFloor Tools → View Validation Dashboard', 'Review any data quality issues']
  ];

  // Headers
  sheet.getRange(row, 2).setValue('').setBackground('#e8f5e9');
  sheet.getRange(row, 3).setValue('Action').setFontWeight('bold').setBackground('#e8f5e9');
  sheet.getRange(row, 4).setValue('How To').setFontWeight('bold').setBackground('#e8f5e9');
  sheet.getRange(row, 5).setValue('What It Does').setFontWeight('bold').setBackground('#e8f5e9');
  row++;

  for (const step of steps) {
    sheet.getRange(row, 2).setValue(step[0]).setFontWeight('bold').setFontColor('#2e7d32');
    sheet.getRange(row, 3).setValue(step[1]);
    sheet.getRange(row, 4).setValue(step[2]).setFontColor('#666666');
    sheet.getRange(row, 5).setValue(step[3]).setFontStyle('italic').setFontColor('#888888');
    sheet.setRowHeight(row, 25);
    row++;
  }

  row++; // Spacer
  return row;
}

/**
 * Write Sheet Overview section
 */
function writeSheetOverviewSection(sheet, startRow) {
  let row = startRow;

  row = writeSectionHeader(sheet, row, '📋 2. SHEET OVERVIEW', '#7b1fa2');

  // Intro text
  const introRange = sheet.getRange(row, 2, 1, 4);
  introRange.merge();
  introRange.setValue('This workbook contains several sheets. Here\'s what each one does:');
  introRange.setFontStyle('italic');
  row++;
  row++;

  const sheets = [
    ['📘 Config_KPIs', 'CONFIGURATION', 'Defines all metrics (KPIs) — both input fields and calculated values. Edit this to add/remove metrics.', '✏️ Editable'],
    ['📘 Config_Validations', 'CONFIGURATION', 'Defines data validation rules that check if client data makes sense mathematically.', '✏️ Editable'],
    ['📘 Config_Sections', 'CONFIGURATION', 'Defines the 9 business sections and 3 pillars. Rarely needs editing.', '✏️ Editable'],
    ['📘 Config_Benchmarks', 'CONFIGURATION', 'Defines industry benchmarks for performance ratings. Can be customized by industry/state.', '✏️ Editable'],
    ['📗 Clients', 'DATA', 'Stores all client submissions. Form responses land here. DO NOT manually edit.', '🔒 Auto-populated'],
    ['📗 Results', 'OUTPUT', 'Shows analysis results for the selected client. Regenerated each time you run analysis.', '🔒 Auto-generated'],
    ['📗 Validation_Log', 'OUTPUT', 'Lists all validation issues found in the current analysis.', '🔒 Auto-generated'],
    ['📙 _Settings', 'SYSTEM', 'System configuration. Only edit if you know what you\'re doing.', '⚠️ Advanced']
  ];

  // Headers
  sheet.getRange(row, 2).setValue('Sheet Name').setFontWeight('bold').setBackground('#f3e5f5');
  sheet.getRange(row, 3).setValue('Type').setFontWeight('bold').setBackground('#f3e5f5');
  sheet.getRange(row, 4).setValue('Purpose').setFontWeight('bold').setBackground('#f3e5f5');
  sheet.getRange(row, 5).setValue('Edit?').setFontWeight('bold').setBackground('#f3e5f5');
  row++;

  for (const s of sheets) {
    sheet.getRange(row, 2).setValue(s[0]).setFontWeight('bold');
    sheet.getRange(row, 3).setValue(s[1]).setFontColor('#7b1fa2');
    sheet.getRange(row, 4).setValue(s[2]).setWrap(true);
    sheet.getRange(row, 5).setValue(s[3]);
    sheet.setRowHeight(row, 35);
    row++;
  }

  row++; // Spacer
  return row;
}

/**
 * Write Config_KPIs detailed section
 */
function writeKPIConfigSection(sheet, startRow) {
  let row = startRow;

  row = writeSectionHeader(sheet, row, '📊 3. CONFIG_KPIS — DETAILED GUIDE', '#e65100');

  // Purpose
  const purposeRange = sheet.getRange(row, 2, 1, 4);
  purposeRange.merge();
  purposeRange.setValue('PURPOSE: This sheet defines every metric in the system. Each row is one KPI. Input KPIs appear on the client form. Calculated KPIs are computed automatically.');
  purposeRange.setBackground('#fff3e0');
  purposeRange.setWrap(true);
  sheet.setRowHeight(row, 40);
  row++;
  row++;

  // Column explanations
  row = writeSubHeader(sheet, row, '📝 Column Definitions:', '#e65100');

  const kpiColumns = [
    ['kpi_id', 'REQUIRED', 'Unique identifier for this KPI. Use lowercase with underscores.', 'total_leads, close_rate, profit_margin'],
    ['name', 'REQUIRED', 'Display name shown to users on forms and reports.', 'Total Leads, Close Rate, Profit Margin'],
    ['description', 'Optional', 'Help text explaining what this metric means. Shown on forms.', 'Number of leads generated in the period'],
    ['category', 'REQUIRED', 'Either "volume" (capacity/size metrics) or "efficiency" (performance metrics).', 'volume, efficiency'],
    ['type', 'REQUIRED', '"input" = collected from client via form. "calculated" = computed from formula.', 'input, calculated'],
    ['data_type', 'REQUIRED', 'How to format this value: "integer", "number", "currency", "percentage"', 'currency, percentage'],
    ['formula', 'For calculated', 'The calculation recipe. Leave blank for input KPIs. See Formula Reference.', 'PERCENTAGE:jobs:visits'],
    ['sections', 'Optional', 'Comma-separated section numbers (1-9) this KPI relates to.', '1,2,3 or 7'],
    ['pillar', 'Optional', 'Primary pillar (1, 2, or 3). See Pillars section for explanation.', '1, 2, or 3'],
    ['required', 'Optional', 'TRUE = client must fill this in. FALSE = optional field.', 'TRUE or FALSE'],
    ['form_order', 'For input only', 'Order in which this appears on the form. Lower = earlier.', '1, 2, 3...'],
    ['active', 'REQUIRED', 'TRUE = enabled. FALSE = disabled (won\'t appear anywhere).', 'TRUE or FALSE']
  ];

  // Headers
  sheet.getRange(row, 2).setValue('Column').setFontWeight('bold').setBackground('#ffe0b2');
  sheet.getRange(row, 3).setValue('Required?').setFontWeight('bold').setBackground('#ffe0b2');
  sheet.getRange(row, 4).setValue('What It Does').setFontWeight('bold').setBackground('#ffe0b2');
  sheet.getRange(row, 5).setValue('Example Values').setFontWeight('bold').setBackground('#ffe0b2');
  row++;

  for (const col of kpiColumns) {
    sheet.getRange(row, 2).setValue(col[0]).setFontFamily('Courier New').setFontWeight('bold');
    sheet.getRange(row, 3).setValue(col[1]).setFontColor(col[1] === 'REQUIRED' ? '#c62828' : '#666666');
    sheet.getRange(row, 4).setValue(col[2]).setWrap(true);
    sheet.getRange(row, 5).setValue(col[3]).setFontColor('#666666').setFontStyle('italic');
    sheet.setRowHeight(row, 30);
    row++;
  }

  row++;

  // Tips box
  row = writeTipBox(sheet, row, 'TIPS FOR EDITING CONFIG_KPIS', [
    '• Always use lowercase_with_underscores for kpi_id (e.g., "total_leads" not "Total Leads")',
    '• When adding a new input KPI, remember to sync the form: ShopFloor Tools → Form Management → Sync Form',
    '• Calculated KPIs must reference other kpi_ids that exist — check for typos!',
    '• Set active=FALSE to temporarily disable a KPI without deleting it',
    '• The form_order only matters for input KPIs — leave blank for calculated ones'
  ]);

  row++; // Spacer
  return row;
}

/**
 * Write Config_Validations detailed section
 */
function writeValidationConfigSection(sheet, startRow) {
  let row = startRow;

  row = writeSectionHeader(sheet, row, '✅ 4. CONFIG_VALIDATIONS — DETAILED GUIDE', '#00695c');

  // Purpose
  const purposeRange = sheet.getRange(row, 2, 1, 4);
  purposeRange.merge();
  purposeRange.setValue('PURPOSE: Validation rules check if the client\'s data makes mathematical sense. For example: if they report a 50% close rate but their numbers show 10%, we flag it.');
  purposeRange.setBackground('#e0f2f1');
  purposeRange.setWrap(true);
  sheet.setRowHeight(row, 40);
  row++;
  row++;

  row = writeSubHeader(sheet, row, '📝 Column Definitions:', '#00695c');

  const valColumns = [
    ['rule_id', 'REQUIRED', 'Unique identifier for this rule. Use lowercase with underscores.', 'booking_rate_check'],
    ['name', 'REQUIRED', 'Display name shown in validation reports.', 'Booking Rate Reconciliation'],
    ['description', 'Optional', 'Explains what this rule checks.', 'Checks if booking rate matches actual data'],
    ['type', 'REQUIRED', 'Type of check: reconciliation, range, dependency, or ratio.', 'reconciliation'],
    ['formula', 'REQUIRED', 'The validation logic. See Formula Reference section.', 'RECONCILE:a*b:c'],
    ['tolerance', 'For reconciliation', 'How much variance is acceptable. 0.10 = 10% tolerance.', '0.10, 0.15'],
    ['severity', 'REQUIRED', '"error" (blocks valid status), "warning" (flag but OK), "info" (FYI only)', 'error, warning, info'],
    ['message', 'REQUIRED', 'Message shown to user when this rule fails. Use {expected} {actual} {variance} placeholders.', 'Expected {expected}, got {actual}'],
    ['affected_kpis', 'Optional', 'Comma-separated kpi_ids involved in this check.', 'total_leads,booking_rate'],
    ['active', 'REQUIRED', 'TRUE = enabled. FALSE = disabled.', 'TRUE or FALSE']
  ];

  // Headers
  sheet.getRange(row, 2).setValue('Column').setFontWeight('bold').setBackground('#b2dfdb');
  sheet.getRange(row, 3).setValue('Required?').setFontWeight('bold').setBackground('#b2dfdb');
  sheet.getRange(row, 4).setValue('What It Does').setFontWeight('bold').setBackground('#b2dfdb');
  sheet.getRange(row, 5).setValue('Example Values').setFontWeight('bold').setBackground('#b2dfdb');
  row++;

  for (const col of valColumns) {
    sheet.getRange(row, 2).setValue(col[0]).setFontFamily('Courier New').setFontWeight('bold');
    sheet.getRange(row, 3).setValue(col[1]).setFontColor(col[1] === 'REQUIRED' ? '#c62828' : '#666666');
    sheet.getRange(row, 4).setValue(col[2]).setWrap(true);
    sheet.getRange(row, 5).setValue(col[3]).setFontColor('#666666').setFontStyle('italic');
    sheet.setRowHeight(row, 30);
    row++;
  }

  row++;

  // Validation types explanation
  row = writeSubHeader(sheet, row, '🔍 Validation Types Explained:', '#00695c');

  const valTypes = [
    ['reconciliation', 'Checks if a calculation equals an expected value', 'RECONCILE:total_leads*booking_rate/100:in_home_visits', 'Does leads × rate = visits?'],
    ['range', 'Checks if a value is within min/max bounds', 'RANGE:close_rate:0:100', 'Is close rate between 0-100%?'],
    ['dependency', 'Checks if one field exists when another does', 'REQUIRES:in_home_visits:total_leads', 'If visits exist, leads must exist'],
    ['ratio', 'Checks if two values are approximately equal', 'EQUALS:reported_ticket:calculated_ticket', 'Do reported and calculated match?']
  ];

  sheet.getRange(row, 2).setValue('Type').setFontWeight('bold').setBackground('#b2dfdb');
  sheet.getRange(row, 3).setValue('What It Checks').setFontWeight('bold').setBackground('#b2dfdb');
  sheet.getRange(row, 4).setValue('Formula Example').setFontWeight('bold').setBackground('#b2dfdb');
  sheet.getRange(row, 5).setValue('Plain English').setFontWeight('bold').setBackground('#b2dfdb');
  row++;

  for (const vt of valTypes) {
    sheet.getRange(row, 2).setValue(vt[0]).setFontFamily('Courier New').setFontWeight('bold');
    sheet.getRange(row, 3).setValue(vt[1]);
    sheet.getRange(row, 4).setValue(vt[2]).setFontFamily('Courier New').setFontSize(10);
    sheet.getRange(row, 5).setValue(vt[3]).setFontStyle('italic').setFontColor('#666666');
    sheet.setRowHeight(row, 25);
    row++;
  }

  row++;
  return row;
}

/**
 * Write Config_Sections detailed section
 */
function writeSectionConfigSection(sheet, startRow) {
  let row = startRow;

  row = writeSectionHeader(sheet, row, '🏢 5. CONFIG_SECTIONS — DETAILED GUIDE', '#ad1457');

  // Purpose
  const purposeRange = sheet.getRange(row, 2, 1, 4);
  purposeRange.merge();
  purposeRange.setValue('PURPOSE: Defines the 9 business sections and 3 pillars. This maps KPIs and issues to specific parts of the business. Rarely needs editing.');
  purposeRange.setBackground('#fce4ec');
  purposeRange.setWrap(true);
  sheet.setRowHeight(row, 40);
  row++;
  row++;

  row = writeSubHeader(sheet, row, '📝 Column Definitions:', '#ad1457');

  const secColumns = [
    ['section_id', 'REQUIRED', 'Number 1-9 identifying this section.', '1, 2, 3... 9'],
    ['section_name', 'REQUIRED', 'Name of the business section.', 'Marketing, Sales, Finance'],
    ['section_description', 'Optional', 'What this section covers.', 'Lead generation, advertising...'],
    ['pillar_id', 'REQUIRED', 'Which pillar (1, 2, or 3) this section belongs to.', '1, 2, or 3'],
    ['pillar_name', 'REQUIRED', 'Name of the pillar.', 'Operational Visibility']
  ];

  // Headers
  sheet.getRange(row, 2).setValue('Column').setFontWeight('bold').setBackground('#f8bbd9');
  sheet.getRange(row, 3).setValue('Required?').setFontWeight('bold').setBackground('#f8bbd9');
  sheet.getRange(row, 4).setValue('What It Does').setFontWeight('bold').setBackground('#f8bbd9');
  sheet.getRange(row, 5).setValue('Example Values').setFontWeight('bold').setBackground('#f8bbd9');
  row++;

  for (const col of secColumns) {
    sheet.getRange(row, 2).setValue(col[0]).setFontFamily('Courier New').setFontWeight('bold');
    sheet.getRange(row, 3).setValue(col[1]).setFontColor(col[1] === 'REQUIRED' ? '#c62828' : '#666666');
    sheet.getRange(row, 4).setValue(col[2]).setWrap(true);
    sheet.getRange(row, 5).setValue(col[3]).setFontColor('#666666').setFontStyle('italic');
    sheet.setRowHeight(row, 25);
    row++;
  }

  row++;
  return row;
}

/**
 * Write Config_Benchmarks detailed section
 */
function writeBenchmarkConfigSection(sheet, startRow) {
  let row = startRow;

  row = writeSectionHeader(sheet, row, '📈 6. CONFIG_BENCHMARKS — DETAILED GUIDE', '#bf360c');

  // Purpose
  const purposeRange = sheet.getRange(row, 2, 1, 4);
  purposeRange.merge();
  purposeRange.setValue('PURPOSE: Defines performance thresholds for rating KPIs as poor/average/good/excellent. Can be customized by industry and state/province.');
  purposeRange.setBackground('#fbe9e7');
  purposeRange.setWrap(true);
  sheet.setRowHeight(row, 40);
  row++;
  row++;

  row = writeSubHeader(sheet, row, '📝 Column Definitions:', '#bf360c');

  const benchColumns = [
    ['kpi_id', 'REQUIRED', 'Which KPI this benchmark applies to. Must match a kpi_id from Config_KPIs.', 'booking_rate, close_rate'],
    ['industry', 'REQUIRED', 'Which industry: "all" (universal), or specific like "hvac", "plumbing", "roofing", "electrical"', 'all, hvac, plumbing'],
    ['state', 'REQUIRED', 'Which state/province: "all" (universal), or specific like "california", "ontario"', 'all, california, texas'],
    ['poor', 'REQUIRED', 'Threshold below which performance is "poor"', '30 (for 30%)'],
    ['average', 'REQUIRED', 'Threshold for "average" performance (between poor and good)', '50'],
    ['good', 'REQUIRED', 'Threshold for "good" performance', '70'],
    ['excellent', 'REQUIRED', 'Threshold above which performance is "excellent"', '85'],
    ['notes', 'Optional', 'Explanation or context for this benchmark.', 'HVAC typically higher']
  ];

  // Headers
  sheet.getRange(row, 2).setValue('Column').setFontWeight('bold').setBackground('#ffccbc');
  sheet.getRange(row, 3).setValue('Required?').setFontWeight('bold').setBackground('#ffccbc');
  sheet.getRange(row, 4).setValue('What It Does').setFontWeight('bold').setBackground('#ffccbc');
  sheet.getRange(row, 5).setValue('Example Values').setFontWeight('bold').setBackground('#ffccbc');
  row++;

  for (const col of benchColumns) {
    sheet.getRange(row, 2).setValue(col[0]).setFontFamily('Courier New').setFontWeight('bold');
    sheet.getRange(row, 3).setValue(col[1]).setFontColor(col[1] === 'REQUIRED' ? '#c62828' : '#666666');
    sheet.getRange(row, 4).setValue(col[2]).setWrap(true);
    sheet.getRange(row, 5).setValue(col[3]).setFontColor('#666666').setFontStyle('italic');
    sheet.setRowHeight(row, 30);
    row++;
  }

  row++;

  // Priority explanation
  row = writeTipBox(sheet, row, 'HOW BENCHMARKS ARE MATCHED (Priority Order)', [
    '1. FIRST: Exact match — same industry AND same state (e.g., hvac + california)',
    '2. SECOND: Industry match — same industry, any state (e.g., hvac + all)',
    '3. THIRD: State match — any industry, same state (e.g., all + california)',
    '4. FALLBACK: Universal — all + all (default benchmarks)',
    '',
    'Example: For an HVAC company in California, system checks: hvac+california → hvac+all → all+california → all+all'
  ]);

  row++;
  return row;
}

/**
 * Write Pillars and Sections explanation
 */
function writePillarsAndSectionsSection(sheet, startRow) {
  let row = startRow;

  row = writeSectionHeader(sheet, row, '🏛️ 7. UNDERSTANDING PILLARS & SECTIONS', '#1565c0');

  // Intro
  const introRange = sheet.getRange(row, 2, 1, 4);
  introRange.merge();
  introRange.setValue('ShopFloor Solutions organizes trade businesses into 3 PILLARS (strategic areas) and 9 SECTIONS (operational areas). This framework helps identify where problems exist.');
  introRange.setBackground('#e3f2fd');
  introRange.setWrap(true);
  sheet.setRowHeight(row, 50);
  row++;
  row++;

  // Pillar 1
  row = writeSubHeader(sheet, row, '🟢 PILLAR 1: Operational Visibility', '#2e7d32');

  const pillar1Text = sheet.getRange(row, 2, 1, 4);
  pillar1Text.merge();
  pillar1Text.setValue('"Know what\'s happening" — Can you see your numbers? Do you know how your business is performing?');
  pillar1Text.setFontStyle('italic');
  row++;

  const p1Sections = [
    ['Section 1', 'Marketing', 'Lead generation, advertising, brand awareness, marketing attribution'],
    ['Section 2', 'CSR/Call Center', 'Call handling, booking appointments, customer intake'],
    ['Section 3', 'Sales', 'In-home visits, proposals, closing deals, average ticket'],
    ['Section 7', 'Finance/Accounting', 'Cash flow, invoicing, collections, financial reporting']
  ];

  for (const sec of p1Sections) {
    sheet.getRange(row, 2).setValue(sec[0]).setFontWeight('bold').setFontColor('#2e7d32');
    sheet.getRange(row, 3).setValue(sec[1]).setFontWeight('bold');
    sheet.getRange(row, 4, 1, 2).merge().setValue(sec[2]).setFontColor('#666666');
    row++;
  }
  row++;

  // Pillar 2
  row = writeSubHeader(sheet, row, '🔵 PILLAR 2: Operational Standardization', '#1565c0');

  const pillar2Text = sheet.getRange(row, 2, 1, 4);
  pillar2Text.merge();
  pillar2Text.setValue('"Do it consistently" — Are processes standardized? Is quality consistent? Are you efficient?');
  pillar2Text.setFontStyle('italic');
  row++;

  const p2Sections = [
    ['Section 4', 'Field Operations', 'Technicians, installations, service delivery, job quality'],
    ['Section 5', 'Scheduling/Dispatch', 'Job assignment, routing, capacity management, efficiency'],
    ['Section 6', 'Inventory/Warehouse', 'Parts, materials, truck stock, equipment']
  ];

  for (const sec of p2Sections) {
    sheet.getRange(row, 2).setValue(sec[0]).setFontWeight('bold').setFontColor('#1565c0');
    sheet.getRange(row, 3).setValue(sec[1]).setFontWeight('bold');
    sheet.getRange(row, 4, 1, 2).merge().setValue(sec[2]).setFontColor('#666666');
    row++;
  }
  row++;

  // Pillar 3
  row = writeSubHeader(sheet, row, '🟠 PILLAR 3: Capacity & Growth Readiness', '#e65100');

  const pillar3Text = sheet.getRange(row, 2, 1, 4);
  pillar3Text.merge();
  pillar3Text.setValue('"Scale effectively" — Can you handle more volume? Are you ready to grow?');
  pillar3Text.setFontStyle('italic');
  row++;

  const p3Sections = [
    ['Section 8', 'HR/Training', 'Hiring, onboarding, skill development, retention'],
    ['Section 9', 'Management/Leadership', 'Oversight, strategy, decision-making, culture']
  ];

  for (const sec of p3Sections) {
    sheet.getRange(row, 2).setValue(sec[0]).setFontWeight('bold').setFontColor('#e65100');
    sheet.getRange(row, 3).setValue(sec[1]).setFontWeight('bold');
    sheet.getRange(row, 4, 1, 2).merge().setValue(sec[2]).setFontColor('#666666');
    row++;
  }
  row++;

  // Why it matters
  row = writeTipBox(sheet, row, 'WHY SECTIONS MATTER', [
    'When you assign a KPI to sections (e.g., sections = "1,2"), the system knows:',
    '• Which part of the business to blame when that KPI has issues',
    '• How to group insights by business area',
    '• Which team should fix the problem',
    '',
    'Example: "booking_rate" is assigned to sections 1,2 (Marketing, CSR) because it depends on lead quality AND call handling.'
  ]);

  row++;
  return row;
}

/**
 * Write Formula Reference section
 */
function writeFormulaReferenceSection(sheet, startRow) {
  let row = startRow;

  row = writeSectionHeader(sheet, row, '🔢 8. FORMULA REFERENCE', '#5d4037');

  // KPI Formulas
  row = writeSubHeader(sheet, row, '📐 KPI Calculation Formulas (for Config_KPIs)', '#5d4037');

  const kpiFormulas = [
    ['DIVIDE:a:b', 'a ÷ b', 'DIVIDE:gross_revenue:jobs_closed', 'Revenue per job'],
    ['MULTIPLY:a:b', 'a × b', 'MULTIPLY:jobs_closed:average_ticket', 'Expected revenue'],
    ['SUBTRACT:a:b', 'a − b', 'SUBTRACT:gross_revenue:total_costs', 'Net profit'],
    ['ADD:a:b', 'a + b', 'ADD:labor_cost:material_cost', 'Total cost'],
    ['PERCENTAGE:a:b', '(a ÷ b) × 100', 'PERCENTAGE:jobs_closed:in_home_visits', 'Close rate'],
    ['PER_DAY:a', 'a ÷ period_days', 'PER_DAY:gross_revenue', 'Daily revenue'],
    ['CUSTOM:func', 'Calls custom code', 'CUSTOM:calculateScheduleCapacity', 'Complex calculation']
  ];

  sheet.getRange(row, 2).setValue('Formula Pattern').setFontWeight('bold').setBackground('#d7ccc8');
  sheet.getRange(row, 3).setValue('Math').setFontWeight('bold').setBackground('#d7ccc8');
  sheet.getRange(row, 4).setValue('Example').setFontWeight('bold').setBackground('#d7ccc8');
  sheet.getRange(row, 5).setValue('Use Case').setFontWeight('bold').setBackground('#d7ccc8');
  row++;

  for (const f of kpiFormulas) {
    sheet.getRange(row, 2).setValue(f[0]).setFontFamily('Courier New').setFontWeight('bold');
    sheet.getRange(row, 3).setValue(f[1]);
    sheet.getRange(row, 4).setValue(f[2]).setFontFamily('Courier New').setFontSize(10);
    sheet.getRange(row, 5).setValue(f[3]).setFontStyle('italic').setFontColor('#666666');
    row++;
  }
  row++;

  // Validation Formulas
  row = writeSubHeader(sheet, row, '✓ Validation Formulas (for Config_Validations)', '#5d4037');

  const valFormulas = [
    ['RECONCILE:expr:target', 'Check if expression ≈ target value', 'RECONCILE:leads*rate/100:visits', 'Does the math add up?'],
    ['RANGE:kpi:min:max', 'Check if value is between min and max', 'RANGE:close_rate:0:100', 'Is value realistic?'],
    ['GREATER:a:b', 'Check if a > b', 'GREATER:revenue:costs', 'Is company profitable?'],
    ['EQUALS:a:b', 'Check if a ≈ b (within tolerance)', 'EQUALS:reported:calculated', 'Do values match?'],
    ['REQUIRES:a:b', 'If a has value, b must have value', 'REQUIRES:visits:leads', 'Is dependency met?']
  ];

  sheet.getRange(row, 2).setValue('Formula Pattern').setFontWeight('bold').setBackground('#d7ccc8');
  sheet.getRange(row, 3).setValue('What It Checks').setFontWeight('bold').setBackground('#d7ccc8');
  sheet.getRange(row, 4).setValue('Example').setFontWeight('bold').setBackground('#d7ccc8');
  sheet.getRange(row, 5).setValue('Plain English').setFontWeight('bold').setBackground('#d7ccc8');
  row++;

  for (const f of valFormulas) {
    sheet.getRange(row, 2).setValue(f[0]).setFontFamily('Courier New').setFontWeight('bold');
    sheet.getRange(row, 3).setValue(f[1]);
    sheet.getRange(row, 4).setValue(f[2]).setFontFamily('Courier New').setFontSize(10);
    sheet.getRange(row, 5).setValue(f[3]).setFontStyle('italic').setFontColor('#666666');
    row++;
  }

  row++;
  return row;
}

/**
 * Write Troubleshooting section
 */
function writeTroubleshootingSection(sheet, startRow) {
  let row = startRow;

  row = writeSectionHeader(sheet, row, '🔧 9. TROUBLESHOOTING', '#c62828');

  const issues = [
    ['Menu not appearing', 'Refresh the page. If still missing, go to Extensions → Apps Script → Run → onOpen', '🔄'],
    ['Form not linked', 'Go to ShopFloor Tools → Form Management → Recreate Form', '📝'],
    ['Analysis shows errors', 'Check the Validation_Log sheet for specific issues. May need client to correct data.', '⚠️'],
    ['KPI shows "N/A"', 'Required input data is missing. Check if client filled in all required fields.', '❓'],
    ['New KPI not on form', 'After adding input KPI, must sync: ShopFloor Tools → Form Management → Sync Form', '🔗'],
    ['Benchmarks not applying', 'Check industry/state spelling matches exactly. Use lowercase.', '📊'],
    ['Form responses not appearing', 'Check that form trigger is installed. Run diagnoseFormIntegration() from script editor.', '📋'],
    ['System not initialized', 'Run: ShopFloor Tools → Administration → Initialize System', '🚀']
  ];

  sheet.getRange(row, 2).setValue('').setBackground('#ffebee');
  sheet.getRange(row, 3).setValue('Problem').setFontWeight('bold').setBackground('#ffebee');
  sheet.getRange(row, 4, 1, 2).merge().setValue('Solution').setFontWeight('bold').setBackground('#ffebee');
  row++;

  for (const issue of issues) {
    sheet.getRange(row, 2).setValue(issue[2]).setHorizontalAlignment('center');
    sheet.getRange(row, 3).setValue(issue[0]).setFontWeight('bold');
    sheet.getRange(row, 4, 1, 2).merge().setValue(issue[1]).setWrap(true);
    sheet.setRowHeight(row, 35);
    row++;
  }

  row++;
  return row;
}

/**
 * Write Glossary section
 */
function writeGlossarySection(sheet, startRow) {
  let row = startRow;

  row = writeSectionHeader(sheet, row, '📖 10. GLOSSARY', '#37474f');

  const terms = [
    ['KPI', 'Key Performance Indicator — a measurable value showing business performance'],
    ['Booking Rate', 'Percentage of leads that become appointments: (visits ÷ leads) × 100'],
    ['Close Rate', 'Percentage of appointments that become sales: (jobs ÷ visits) × 100'],
    ['Average Ticket', 'Average revenue per job: revenue ÷ jobs'],
    ['Profit Margin', 'Percentage of revenue kept as profit: (revenue - costs) ÷ revenue × 100'],
    ['Schedule Efficiency', 'How much capacity is being used: scheduled hours ÷ available hours × 100'],
    ['Pillar', 'One of 3 strategic business areas (Visibility, Standardization, Growth)'],
    ['Section', 'One of 9 operational business areas (Marketing, Sales, etc.)'],
    ['Reconciliation', 'Checking if related numbers are mathematically consistent'],
    ['Tolerance', 'How much variance is acceptable (0.10 = 10% difference allowed)'],
    ['Input KPI', 'A metric collected from the client via the form'],
    ['Calculated KPI', 'A metric computed automatically from other values'],
    ['Severity', 'How serious a validation issue is: error (bad), warning (check it), info (FYI)']
  ];

  sheet.getRange(row, 2, 1, 2).merge().setValue('Term').setFontWeight('bold').setBackground('#cfd8dc');
  sheet.getRange(row, 4, 1, 2).merge().setValue('Definition').setFontWeight('bold').setBackground('#cfd8dc');
  row++;

  for (const term of terms) {
    sheet.getRange(row, 2, 1, 2).merge().setValue(term[0]).setFontWeight('bold');
    sheet.getRange(row, 4, 1, 2).merge().setValue(term[1]).setWrap(true);
    sheet.setRowHeight(row, 30);
    row++;
  }

  row++;

  // Footer
  const footerRange = sheet.getRange(row, 2, 1, 4);
  footerRange.merge();
  footerRange.setValue('📧 Questions? Contact: info@shopfloorsolutions.ca | 💡 For updates, run initializeReadmeSheet() from the script editor');
  footerRange.setFontColor('#666666');
  footerRange.setFontStyle('italic');
  footerRange.setHorizontalAlignment('center');

  return row + 2;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Write a section header with colored banner
 */
function writeSectionHeader(sheet, row, title, color) {
  const range = sheet.getRange(row, 2, 1, 4);
  range.merge();
  range.setValue(title);
  range.setBackground(color);
  range.setFontColor('#ffffff');
  range.setFontSize(14);
  range.setFontWeight('bold');
  sheet.setRowHeight(row, 35);
  return row + 2;
}

/**
 * Write a sub-header
 */
function writeSubHeader(sheet, row, title, color) {
  const range = sheet.getRange(row, 2, 1, 4);
  range.merge();
  range.setValue(title);
  range.setFontColor(color);
  range.setFontSize(12);
  range.setFontWeight('bold');
  return row + 1;
}

/**
 * Write a tip/info box
 */
function writeTipBox(sheet, row, title, lines) {
  // Title
  const titleRange = sheet.getRange(row, 2, 1, 4);
  titleRange.merge();
  titleRange.setValue('💡 ' + title);
  titleRange.setBackground('#fff9c4');
  titleRange.setFontWeight('bold');
  row++;

  // Content
  for (const line of lines) {
    const lineRange = sheet.getRange(row, 2, 1, 4);
    lineRange.merge();
    lineRange.setValue(line);
    lineRange.setBackground('#fffde7');
    lineRange.setWrap(true);
    if (line === '') {
      sheet.setRowHeight(row, 10);
    }
    row++;
  }

  return row;
}

// ============================================================================
// MENU INTEGRATION
// ============================================================================

/**
 * Add README generator to admin menu
 * Call this from Main.gs createMenu() if you want menu access
 */
function addReadmeToMenu() {
  // This would be added to the Administration submenu in Main.gs:
  // .addItem('Generate README Sheet', 'initializeReadmeSheet')
}
