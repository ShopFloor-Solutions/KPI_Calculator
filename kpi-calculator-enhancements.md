# KPI Calculator System — Enhancement Specifications

**Document Version**: 1.0  
**Date**: November 26, 2025  
**Author**: ShopFloor Solutions  
**For**: Lead Developer

---

## Table of Contents

1. [Enhancement #1: State/Province Benchmarking Support](#enhancement-1-stateprovince-benchmarking-support)
2. [Enhancement #2: Config Management UI Dialogs](#enhancement-2-config-management-ui-dialogs)
3. [Enhancement #3: Form Response Integration Fix](#enhancement-3-form-response-integration-fix)
4. [Implementation Priority](#implementation-priority)

---

## Enhancement #1: State/Province Benchmarking Support

### Current State

The `Config_Benchmarks` sheet currently has these columns:
```
kpi_id | industry | poor | average | good | excellent | notes
```

Benchmarks can be filtered by `industry` (e.g., "hvac", "plumbing", "all"), but there is **no capability** to filter by geographic region (state/province).

The client intake form **does collect** `State/Province` data, and it's stored in the `Clients` sheet under the `state` column. However, this data is not utilized for benchmark comparisons.

### Problem

Regional differences in trade businesses are significant:
- Labor costs vary dramatically (California vs. Mississippi)
- Cost of living affects pricing and margins
- Market saturation differs by region
- Weather patterns affect HVAC/roofing seasonality and performance

Without regional benchmarking, a plumber in San Francisco with a 15% profit margin might be flagged as "average" when they're actually outperforming their regional peers.

### Required Changes

#### 1. Update `Config_Benchmarks` Sheet Structure

Add new column `state` between `industry` and `poor`:

```
kpi_id | industry | state | poor | average | good | excellent | notes
```

**Column specifications:**
| Column | Header | Type | Description |
|--------|--------|------|-------------|
| A | `kpi_id` | String | KPI identifier (must match Config_KPIs) |
| B | `industry` | String | Industry filter ("all", "hvac", "plumbing", etc.) |
| C | `state` | String | **NEW** — State/province filter ("all", "California", "Ontario", etc.) |
| D | `poor` | Number | Threshold for poor performance |
| E | `average` | Number | Threshold for average performance |
| F | `good` | Number | Threshold for good performance |
| G | `excellent` | Number | Threshold for excellent performance |
| H | `notes` | String | Description/context |

**Sample data with new column:**
```
kpi_id        | industry | state      | poor | average | good | excellent | notes
booking_rate  | all      | all        | 30   | 50      | 70   | 85        | Default for all regions
booking_rate  | hvac     | all        | 35   | 55      | 75   | 90        | HVAC typically higher
booking_rate  | all      | California | 25   | 45      | 65   | 80        | CA market is more competitive
profit_margin | all      | all        | 5    | 12      | 20   | 30        | Default margin benchmarks
profit_margin | all      | California | 8    | 15      | 22   | 32        | Higher COL requires higher margins
profit_margin | plumbing | Texas      | 10   | 18      | 25   | 35        | TX plumbing market specific
```

**Matching logic priority (most specific to least specific):**
1. Exact match: `industry` + `state` (e.g., "plumbing" + "Texas")
2. Industry match with all states: `industry` + "all"
3. State match with all industries: "all" + `state`
4. Universal default: "all" + "all"

#### 2. Update `Config.gs` — `loadBenchmarkConfig()` Function

**Current implementation:**
```javascript
function loadBenchmarkConfig(industry) {
  // ... loads benchmarks, filters by industry only
}
```

**New implementation:**
```javascript
/**
 * Load industry benchmarks from Config_Benchmarks sheet
 * @param {string} [industry] - Optional industry filter
 * @param {string} [state] - Optional state/province filter
 * @returns {Object[]} Array of benchmark objects
 */
function loadBenchmarkConfig(industry, state) {
  try {
    const sheet = getRequiredSheet(SHEET_NAMES.CONFIG_BENCHMARKS);
    const data = sheetToObjects(sheet);

    let benchmarks = data.map(row => ({
      kpiId: String(row.kpi_id || '').trim(),
      industry: String(row.industry || 'all').toLowerCase().trim(),
      state: String(row.state || 'all').toLowerCase().trim(), // NEW
      poor: parseFloat(row.poor),
      average: parseFloat(row.average),
      good: parseFloat(row.good),
      excellent: parseFloat(row.excellent)
    })).filter(b => b.kpiId);

    // If no filters, return all
    if (!industry && !state) {
      return benchmarks;
    }

    const industryLower = industry ? industry.toLowerCase() : null;
    const stateLower = state ? state.toLowerCase() : null;

    // Filter with priority matching
    benchmarks = benchmarks.filter(b => {
      const industryMatch = !industryLower || 
                            b.industry === 'all' || 
                            b.industry === industryLower;
      const stateMatch = !stateLower || 
                         b.state === 'all' || 
                         b.state === stateLower;
      return industryMatch && stateMatch;
    });

    return benchmarks;
  } catch (e) {
    log('Benchmarks sheet not found or empty - using defaults');
    return getDefaultBenchmarks();
  }
}
```

#### 3. Update `Config.gs` — `getBenchmarkForKPI()` Function

**New implementation with priority matching:**
```javascript
/**
 * Get benchmark for a KPI with priority matching
 * Priority: 1) industry+state, 2) industry+all, 3) all+state, 4) all+all
 * @param {string} kpiId - KPI ID
 * @param {string} [industry] - Industry filter
 * @param {string} [state] - State/province filter
 * @returns {Object|null} Benchmark object or null
 */
function getBenchmarkForKPI(kpiId, industry, state) {
  const benchmarks = loadBenchmarkConfig();
  const kpiBenchmarks = benchmarks.filter(b => b.kpiId === kpiId);

  if (kpiBenchmarks.length === 0) return null;

  const industryLower = industry ? industry.toLowerCase() : 'all';
  const stateLower = state ? state.toLowerCase() : 'all';

  // Priority 1: Exact match (industry + state)
  let match = kpiBenchmarks.find(b => 
    b.industry === industryLower && b.state === stateLower
  );
  if (match) return match;

  // Priority 2: Industry match with all states
  match = kpiBenchmarks.find(b => 
    b.industry === industryLower && b.state === 'all'
  );
  if (match) return match;

  // Priority 3: State match with all industries
  match = kpiBenchmarks.find(b => 
    b.industry === 'all' && b.state === stateLower
  );
  if (match) return match;

  // Priority 4: Universal default
  match = kpiBenchmarks.find(b => 
    b.industry === 'all' && b.state === 'all'
  );
  return match || null;
}
```

#### 4. Update `InsightsEngine.gs` — `loadBenchmarksForInsights()` Function

Pass both industry AND state to benchmark loading:

```javascript
/**
 * Load benchmarks for insights, using config or defaults
 * @param {string} industry - Client industry
 * @param {string} state - Client state/province
 * @returns {Object} Benchmarks object
 */
function loadBenchmarksForInsights(industry, state) {
  const benchmarks = {};

  // Start with defaults
  for (const kpiId in DEFAULT_BENCHMARKS) {
    benchmarks[kpiId] = { ...DEFAULT_BENCHMARKS[kpiId] };
  }

  // Load from config with both filters
  try {
    const configBenchmarks = loadBenchmarkConfig(industry, state);

    for (const benchmark of configBenchmarks) {
      // Use priority matching
      const existing = benchmarks[benchmark.kpiId];
      const isMoreSpecific = !existing || 
        (benchmark.industry !== 'all' || benchmark.state !== 'all');
      
      if (isMoreSpecific) {
        benchmarks[benchmark.kpiId] = {
          poor: benchmark.poor,
          average: benchmark.average,
          good: benchmark.good,
          excellent: benchmark.excellent
        };
      }
    }
  } catch (e) {
    log('Using default benchmarks');
  }

  return benchmarks;
}
```

#### 5. Update `generateInsights()` Call Signature

In `InsightsEngine.gs`, update the main function to pass state:

```javascript
function generateInsights(clientData, allValues, validationIssues, kpiConfig, sectionConfig) {
  const insights = [];

  // Load benchmarks with BOTH industry and state
  const benchmarks = loadBenchmarksForInsights(clientData.industry, clientData.state);
  
  // ... rest of function
}
```

#### 6. Update `initializeBenchmarkConfig()` in `Config.gs`

Add the new `state` column to initialization:

```javascript
function initializeBenchmarkConfig() {
  const sheet = getOrCreateSheet(SHEET_NAMES.CONFIG_BENCHMARKS);

  // Updated headers with 'state' column
  const headers = ['kpi_id', 'industry', 'state', 'poor', 'average', 'good', 'excellent', 'notes'];

  const sampleData = [
    // Universal defaults (applies to all industries and all states)
    ['booking_rate', 'all', 'all', 30, 50, 70, 85, 'Percentage of leads that become appointments'],
    ['close_rate', 'all', 'all', 20, 35, 50, 65, 'Percentage of appointments that become sales'],
    ['profit_margin', 'all', 'all', 5, 12, 20, 30, 'Net profit as percentage of revenue'],
    ['schedule_efficiency', 'all', 'all', 60, 80, 95, 100, 'Utilization of available capacity'],

    // Industry-specific (all states)
    ['booking_rate', 'hvac', 'all', 35, 55, 75, 90, 'HVAC typically has higher booking rates'],
    ['close_rate', 'roofing', 'all', 25, 40, 55, 70, 'Roofing often has higher close rates due to urgency'],
    ['profit_margin', 'plumbing', 'all', 8, 15, 22, 32, 'Plumbing service calls tend to have higher margins'],

    // State-specific examples (can be expanded)
    ['profit_margin', 'all', 'California', 8, 15, 23, 33, 'Higher COL requires higher margins'],
    ['profit_margin', 'all', 'Ontario', 7, 14, 21, 30, 'Ontario market benchmarks']
  ];

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, sampleData.length, headers.length).setValues(sampleData);

  // Format header row
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff');

  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }

  sheet.setFrozenRows(1);

  // Add usage note
  sheet.getRange(sampleData.length + 3, 1).setValue(
    'Note: Benchmarks are matched by priority: 1) exact industry+state, 2) industry only, ' +
    '3) state only, 4) universal "all". Use "all" for benchmarks that apply broadly.'
  );

  log('Initialized Config_Benchmarks sheet with state support');
}
```

#### 7. Migration Script for Existing Sheets

Add a function to migrate existing Config_Benchmarks sheets:

```javascript
/**
 * Migrate existing Config_Benchmarks to include state column
 * Run this once to update existing sheets
 */
function migrateBenchmarksAddState() {
  const sheet = getRequiredSheet(SHEET_NAMES.CONFIG_BENCHMARKS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Check if 'state' column already exists
  const headersLower = headers.map(h => String(h).toLowerCase());
  if (headersLower.includes('state')) {
    log('State column already exists - no migration needed');
    return;
  }

  // Find position of 'industry' column
  const industryCol = headersLower.indexOf('industry') + 1;
  if (industryCol === 0) {
    throw new Error('Industry column not found - cannot migrate');
  }

  // Insert new column after 'industry'
  sheet.insertColumnAfter(industryCol);
  
  // Set header
  sheet.getRange(1, industryCol + 1).setValue('state');
  
  // Set all existing rows to 'all'
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const stateValues = Array(lastRow - 1).fill(['all']);
    sheet.getRange(2, industryCol + 1, lastRow - 1, 1).setValues(stateValues);
  }

  // Format the new header
  sheet.getRange(1, industryCol + 1)
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff');

  log('Migration complete - state column added to Config_Benchmarks');
  showToast('Benchmarks sheet updated with state column', 'Migration', 5);
}
```

---

## Enhancement #2: Config Management UI Dialogs

### Current State

Currently, Robert and Alex must manually edit the config sheets (Config_KPIs, Config_Validations, Config_Sections, Config_Benchmarks) directly in Google Sheets. This is:

- Error-prone (typos in KPI IDs, incorrect formula syntax)
- Intimidating for non-technical users
- No validation before saving
- No guidance on available options

### Proposed Solution

Create a suite of modal dialog windows accessible from the ShopFloor Tools menu that provide:

1. **Guided forms** for adding/editing config items
2. **Dropdown selectors** for valid options (data types, severity levels, etc.)
3. **Live validation** before saving
4. **Preview** of changes before committing

### Required Changes

#### 1. Update Menu Structure in `Main.gs`

Add new submenu for Configuration Management:

```javascript
function createMenu() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('ShopFloor Tools')
    .addItem('Select Client...', 'showClientSelector')
    .addItem('Run Analysis', 'runAnalysis')
    .addSeparator()
    .addItem('View Validation Dashboard', 'showValidationSidebar')
    .addSeparator()
    .addSubMenu(ui.createMenu('Form Management')
      .addItem('Get Form URL', 'showFormUrl')
      .addItem('Sync Form with Config', 'syncFormWithConfig')
      .addItem('Recreate Form', 'createClientIntakeForm'))
    .addSeparator()
    // NEW: Configuration Management Submenu
    .addSubMenu(ui.createMenu('Configuration')
      .addItem('Manage KPIs...', 'showKPIManager')
      .addItem('Manage Validations...', 'showValidationManager')
      .addItem('Manage Sections...', 'showSectionManager')
      .addItem('Manage Benchmarks...', 'showBenchmarkManager')
      .addSeparator()
      .addItem('Validate All Configuration', 'validateAndShowConfig'))
    .addSeparator()
    .addSubMenu(ui.createMenu('Administration')
      .addItem('View Settings', 'showSettings')
      .addItem('Initialize System', 'initializeSystem')
      .addItem('Reset System...', 'resetSystem'))
    .addToUi();
}
```

#### 2. Create New File: `ConfigManager.gs`

```javascript
/**
 * ConfigManager.gs
 * UI dialogs for managing configuration sheets
 *
 * ShopFloor Solutions - Operational KPI Calculator
 */

// ============================================================================
// KPI MANAGER
// ============================================================================

/**
 * Show KPI Manager dialog
 */
function showKPIManager() {
  const html = HtmlService.createHtmlOutputFromFile('KPIManager')
    .setWidth(700)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Manage KPIs');
}

/**
 * Get all KPIs for the manager dialog
 * @returns {Object} {kpis: Object[], sections: Object[], dataTypes: string[], categories: string[]}
 */
function getKPIManagerData() {
  const kpis = loadKPIConfig();
  const sections = loadSectionConfig();
  
  return {
    kpis: kpis,
    sections: sections,
    dataTypes: Object.values(DATA_TYPES),
    categories: ['volume', 'efficiency'],
    types: ['input', 'calculated']
  };
}

/**
 * Save a new or updated KPI
 * @param {Object} kpiData - KPI data from form
 * @param {boolean} isNew - Whether this is a new KPI
 * @returns {Object} {success: boolean, error?: string}
 */
function saveKPI(kpiData, isNew) {
  try {
    const sheet = getRequiredSheet(SHEET_NAMES.CONFIG_KPIS);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headersLower = headers.map(h => String(h).toLowerCase());
    
    // Validate KPI ID
    if (!kpiData.kpi_id || !/^[a-z][a-z0-9_]*$/.test(kpiData.kpi_id)) {
      return { success: false, error: 'KPI ID must start with a letter and contain only lowercase letters, numbers, and underscores' };
    }
    
    // Check for duplicate ID if new
    if (isNew) {
      const existingKPIs = loadKPIConfig();
      if (existingKPIs.some(k => k.id === kpiData.kpi_id)) {
        return { success: false, error: 'A KPI with this ID already exists' };
      }
    }
    
    // Build row data
    const rowData = headers.map(h => {
      const key = h.toLowerCase();
      return kpiData[key] !== undefined ? kpiData[key] : '';
    });
    
    if (isNew) {
      // Append new row
      sheet.appendRow(rowData);
    } else {
      // Find and update existing row
      const kpiIdCol = headersLower.indexOf('kpi_id') + 1;
      const row = findRowByValue(sheet, kpiIdCol, kpiData.kpi_id);
      if (row < 0) {
        return { success: false, error: 'KPI not found for update' };
      }
      sheet.getRange(row, 1, 1, rowData.length).setValues([rowData]);
    }
    
    return { success: true };
  } catch (error) {
    logError('Error saving KPI', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a KPI
 * @param {string} kpiId - KPI ID to delete
 * @returns {Object} {success: boolean, error?: string}
 */
function deleteKPI(kpiId) {
  try {
    const sheet = getRequiredSheet(SHEET_NAMES.CONFIG_KPIS);
    const kpiIdCol = getColumnByHeader(sheet, 'kpi_id');
    const row = findRowByValue(sheet, kpiIdCol, kpiId);
    
    if (row < 0) {
      return { success: false, error: 'KPI not found' };
    }
    
    // Check if KPI is referenced in validations
    const validations = loadValidationConfig();
    const referencingRules = validations.filter(v => 
      v.affectedKPIs.includes(kpiId) || 
      (v.formula && v.formula.includes(kpiId))
    );
    
    if (referencingRules.length > 0) {
      const ruleNames = referencingRules.map(r => r.name).join(', ');
      return { 
        success: false, 
        error: `Cannot delete: KPI is referenced by validation rules: ${ruleNames}` 
      };
    }
    
    // Check if KPI is referenced in other calculated KPIs
    const kpis = loadKPIConfig();
    const referencingKPIs = kpis.filter(k => 
      k.formula && k.formula.includes(kpiId) && k.id !== kpiId
    );
    
    if (referencingKPIs.length > 0) {
      const kpiNames = referencingKPIs.map(k => k.name).join(', ');
      return { 
        success: false, 
        error: `Cannot delete: KPI is used in formulas for: ${kpiNames}` 
      };
    }
    
    sheet.deleteRow(row);
    return { success: true };
  } catch (error) {
    logError('Error deleting KPI', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// VALIDATION RULE MANAGER
// ============================================================================

/**
 * Show Validation Manager dialog
 */
function showValidationManager() {
  const html = HtmlService.createHtmlOutputFromFile('ValidationManager')
    .setWidth(700)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Manage Validation Rules');
}

/**
 * Get all validation rules for the manager dialog
 * @returns {Object} {rules: Object[], kpis: Object[], severities: string[], types: string[]}
 */
function getValidationManagerData() {
  const rules = loadValidationConfig();
  const kpis = loadKPIConfig();
  
  return {
    rules: rules,
    kpis: kpis,
    severities: Object.values(SEVERITY_LEVELS),
    types: ['reconciliation', 'range', 'dependency', 'ratio']
  };
}

/**
 * Save a new or updated validation rule
 * @param {Object} ruleData - Rule data from form
 * @param {boolean} isNew - Whether this is a new rule
 * @returns {Object} {success: boolean, error?: string}
 */
function saveValidationRule(ruleData, isNew) {
  try {
    const sheet = getRequiredSheet(SHEET_NAMES.CONFIG_VALIDATIONS);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headersLower = headers.map(h => String(h).toLowerCase());
    
    // Validate rule ID
    if (!ruleData.rule_id || !/^[a-z][a-z0-9_]*$/.test(ruleData.rule_id)) {
      return { success: false, error: 'Rule ID must start with a letter and contain only lowercase letters, numbers, and underscores' };
    }
    
    // Validate formula syntax
    const formulaValid = validateFormulasSyntax(ruleData.formula, ruleData.type);
    if (!formulaValid.valid) {
      return { success: false, error: formulaValid.error };
    }
    
    // Build row data
    const rowData = headers.map(h => {
      const key = h.toLowerCase();
      return ruleData[key] !== undefined ? ruleData[key] : '';
    });
    
    if (isNew) {
      sheet.appendRow(rowData);
    } else {
      const ruleIdCol = headersLower.indexOf('rule_id') + 1;
      const row = findRowByValue(sheet, ruleIdCol, ruleData.rule_id);
      if (row < 0) {
        return { success: false, error: 'Rule not found for update' };
      }
      sheet.getRange(row, 1, 1, rowData.length).setValues([rowData]);
    }
    
    return { success: true };
  } catch (error) {
    logError('Error saving validation rule', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a validation rule
 * @param {string} ruleId - Rule ID to delete
 * @returns {Object} {success: boolean, error?: string}
 */
function deleteValidationRule(ruleId) {
  try {
    const sheet = getRequiredSheet(SHEET_NAMES.CONFIG_VALIDATIONS);
    const ruleIdCol = getColumnByHeader(sheet, 'rule_id');
    const row = findRowByValue(sheet, ruleIdCol, ruleId);
    
    if (row < 0) {
      return { success: false, error: 'Rule not found' };
    }
    
    sheet.deleteRow(row);
    return { success: true };
  } catch (error) {
    logError('Error deleting validation rule', error);
    return { success: false, error: error.message };
  }
}

/**
 * Validate formula syntax
 * @param {string} formula - Formula to validate
 * @param {string} type - Validation type
 * @returns {Object} {valid: boolean, error?: string}
 */
function validateFormulasSyntax(formula, type) {
  if (!formula) {
    return { valid: false, error: 'Formula is required' };
  }
  
  const validPrefixes = {
    'reconciliation': ['RECONCILE:', 'EQUALS:'],
    'range': ['RANGE:', 'GREATER:'],
    'dependency': ['REQUIRES:'],
    'ratio': ['EQUALS:', 'RECONCILE:']
  };
  
  const allowedPrefixes = validPrefixes[type] || [];
  const hasValidPrefix = allowedPrefixes.some(p => formula.toUpperCase().startsWith(p));
  
  if (!hasValidPrefix && allowedPrefixes.length > 0) {
    return { 
      valid: false, 
      error: `Formula must start with one of: ${allowedPrefixes.join(', ')}` 
    };
  }
  
  return { valid: true };
}

// ============================================================================
// SECTION MANAGER
// ============================================================================

/**
 * Show Section Manager dialog
 */
function showSectionManager() {
  const html = HtmlService.createHtmlOutputFromFile('SectionManager')
    .setWidth(600)
    .setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, 'Manage Business Sections');
}

/**
 * Get all sections for the manager dialog
 * @returns {Object} {sections: Object[], pillars: Object[]}
 */
function getSectionManagerData() {
  const sections = loadSectionConfig();
  
  const pillars = [
    { id: 1, name: 'Operational Visibility' },
    { id: 2, name: 'Operational Standardization' },
    { id: 3, name: 'Capacity & Growth Readiness' }
  ];
  
  return {
    sections: sections,
    pillars: pillars
  };
}

/**
 * Save a new or updated section
 * @param {Object} sectionData - Section data from form
 * @param {boolean} isNew - Whether this is a new section
 * @returns {Object} {success: boolean, error?: string}
 */
function saveSection(sectionData, isNew) {
  try {
    const sheet = getRequiredSheet(SHEET_NAMES.CONFIG_SECTIONS);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headersLower = headers.map(h => String(h).toLowerCase());
    
    // Build row data
    const rowData = headers.map(h => {
      const key = h.toLowerCase();
      return sectionData[key] !== undefined ? sectionData[key] : '';
    });
    
    if (isNew) {
      sheet.appendRow(rowData);
    } else {
      const sectionIdCol = headersLower.indexOf('section_id') + 1;
      const row = findRowByValue(sheet, sectionIdCol, sectionData.section_id);
      if (row < 0) {
        return { success: false, error: 'Section not found for update' };
      }
      sheet.getRange(row, 1, 1, rowData.length).setValues([rowData]);
    }
    
    return { success: true };
  } catch (error) {
    logError('Error saving section', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// BENCHMARK MANAGER
// ============================================================================

/**
 * Show Benchmark Manager dialog
 */
function showBenchmarkManager() {
  const html = HtmlService.createHtmlOutputFromFile('BenchmarkManager')
    .setWidth(700)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Manage Industry Benchmarks');
}

/**
 * Get all benchmarks for the manager dialog
 * @returns {Object} {benchmarks: Object[], kpis: Object[], industries: string[], states: string[]}
 */
function getBenchmarkManagerData() {
  const benchmarks = loadBenchmarkConfig();
  const kpis = loadKPIConfig().filter(k => k.type === 'calculated' || k.dataType === 'percentage');
  
  return {
    benchmarks: benchmarks,
    kpis: kpis,
    industries: ['all', ...INDUSTRIES.map(i => i.toLowerCase())],
    states: ['all', ...STATES_PROVINCES]
  };
}

/**
 * Save a new or updated benchmark
 * @param {Object} benchmarkData - Benchmark data from form
 * @param {boolean} isNew - Whether this is a new benchmark
 * @returns {Object} {success: boolean, error?: string}
 */
function saveBenchmark(benchmarkData, isNew) {
  try {
    const sheet = getRequiredSheet(SHEET_NAMES.CONFIG_BENCHMARKS);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Validate thresholds are in order
    const poor = parseFloat(benchmarkData.poor);
    const average = parseFloat(benchmarkData.average);
    const good = parseFloat(benchmarkData.good);
    const excellent = parseFloat(benchmarkData.excellent);
    
    if (!(poor < average && average < good && good < excellent)) {
      return { 
        success: false, 
        error: 'Thresholds must be in ascending order: poor < average < good < excellent' 
      };
    }
    
    // Build row data
    const rowData = headers.map(h => {
      const key = h.toLowerCase();
      return benchmarkData[key] !== undefined ? benchmarkData[key] : '';
    });
    
    if (isNew) {
      sheet.appendRow(rowData);
    } else {
      // Find existing row by kpi_id + industry + state combination
      const data = sheet.getDataRange().getValues();
      let rowIndex = -1;
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === benchmarkData.kpi_id &&
            String(data[i][1]).toLowerCase() === benchmarkData.industry.toLowerCase() &&
            String(data[i][2]).toLowerCase() === benchmarkData.state.toLowerCase()) {
          rowIndex = i + 1;
          break;
        }
      }
      
      if (rowIndex < 0) {
        return { success: false, error: 'Benchmark not found for update' };
      }
      
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    }
    
    return { success: true };
  } catch (error) {
    logError('Error saving benchmark', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a benchmark
 * @param {string} kpiId - KPI ID
 * @param {string} industry - Industry
 * @param {string} state - State
 * @returns {Object} {success: boolean, error?: string}
 */
function deleteBenchmark(kpiId, industry, state) {
  try {
    const sheet = getRequiredSheet(SHEET_NAMES.CONFIG_BENCHMARKS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === kpiId &&
          String(data[i][1]).toLowerCase() === industry.toLowerCase() &&
          String(data[i][2]).toLowerCase() === state.toLowerCase()) {
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    
    return { success: false, error: 'Benchmark not found' };
  } catch (error) {
    logError('Error deleting benchmark', error);
    return { success: false, error: error.message };
  }
}
```

#### 3. Create New File: `KPIManager.html`

```html
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Roboto', Arial, sans-serif; font-size: 14px; padding: 20px; background: #fafafa; }
    
    h3 { color: #1a237e; margin-bottom: 16px; font-size: 18px; }
    
    .tabs { display: flex; border-bottom: 2px solid #e0e0e0; margin-bottom: 20px; }
    .tab { padding: 10px 20px; cursor: pointer; color: #666; border-bottom: 2px solid transparent; margin-bottom: -2px; }
    .tab.active { color: #1a237e; border-bottom-color: #1a237e; font-weight: 500; }
    
    .panel { display: none; }
    .panel.active { display: block; }
    
    .kpi-list { max-height: 300px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; background: white; }
    .kpi-item { padding: 10px 15px; border-bottom: 1px solid #eee; cursor: pointer; display: flex; justify-content: space-between; }
    .kpi-item:hover { background: #f5f5f5; }
    .kpi-item.selected { background: #e3f2fd; }
    .kpi-item .name { font-weight: 500; }
    .kpi-item .type { font-size: 11px; color: #666; }
    .kpi-item .badge { font-size: 10px; padding: 2px 6px; border-radius: 3px; }
    .kpi-item .badge.input { background: #e8f5e9; color: #2e7d32; }
    .kpi-item .badge.calculated { background: #e3f2fd; color: #1565c0; }
    
    .form-group { margin-bottom: 15px; }
    label { display: block; font-size: 12px; color: #666; margin-bottom: 5px; text-transform: uppercase; }
    input, select, textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
    input:focus, select:focus, textarea:focus { outline: none; border-color: #1a237e; }
    textarea { resize: vertical; min-height: 60px; }
    
    .form-row { display: flex; gap: 15px; }
    .form-row .form-group { flex: 1; }
    
    .checkbox-group { display: flex; align-items: center; gap: 8px; }
    .checkbox-group input { width: auto; }
    
    .section-checkboxes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .section-checkbox { display: flex; align-items: center; gap: 5px; font-size: 12px; }
    .section-checkbox input { width: auto; }
    
    .button-group { display: flex; gap: 10px; margin-top: 20px; }
    button { padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
    button.primary { background: #1a237e; color: white; }
    button.primary:hover { background: #283593; }
    button.secondary { background: #e0e0e0; color: #333; }
    button.danger { background: #f44336; color: white; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    
    .error { color: #f44336; font-size: 12px; margin-top: 5px; }
    .success { color: #4caf50; font-size: 12px; margin-top: 5px; }
    
    .help-text { font-size: 11px; color: #999; margin-top: 3px; }
  </style>
</head>
<body>
  <h3>KPI Configuration Manager</h3>
  
  <div class="tabs">
    <div class="tab active" onclick="showPanel('list')">KPI List</div>
    <div class="tab" onclick="showPanel('form')">Add/Edit KPI</div>
  </div>
  
  <div id="listPanel" class="panel active">
    <div class="kpi-list" id="kpiList">
      <!-- Populated by JavaScript -->
    </div>
    <div class="button-group">
      <button class="primary" onclick="newKPI()">+ Add New KPI</button>
      <button class="secondary" onclick="editSelected()">Edit Selected</button>
      <button class="danger" onclick="deleteSelected()">Delete Selected</button>
    </div>
  </div>
  
  <div id="formPanel" class="panel">
    <form id="kpiForm" onsubmit="saveKPI(event)">
      <div class="form-row">
        <div class="form-group">
          <label>KPI ID *</label>
          <input type="text" id="kpi_id" required pattern="[a-z][a-z0-9_]*" placeholder="e.g., booking_rate">
          <div class="help-text">Lowercase letters, numbers, underscores only</div>
        </div>
        <div class="form-group">
          <label>Display Name *</label>
          <input type="text" id="name" required placeholder="e.g., Booking Rate">
        </div>
      </div>
      
      <div class="form-group">
        <label>Description</label>
        <textarea id="description" placeholder="Help text shown to users"></textarea>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>Category *</label>
          <select id="category" required>
            <option value="volume">Volume (Growth)</option>
            <option value="efficiency">Efficiency (Performance)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Type *</label>
          <select id="type" required onchange="toggleFormulaField()">
            <option value="input">Input (from form)</option>
            <option value="calculated">Calculated (from formula)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Data Type *</label>
          <select id="data_type" required>
            <option value="integer">Integer (whole number)</option>
            <option value="number">Number (decimal)</option>
            <option value="currency">Currency ($)</option>
            <option value="percentage">Percentage (%)</option>
          </select>
        </div>
      </div>
      
      <div class="form-group" id="formulaGroup" style="display: none;">
        <label>Formula *</label>
        <input type="text" id="formula" placeholder="e.g., PERCENTAGE:jobs_closed:in_home_visits">
        <div class="help-text">Formulas: DIVIDE:a:b, MULTIPLY:a:b, SUBTRACT:a:b, ADD:a:b, PERCENTAGE:a:b, PER_DAY:a, CUSTOM:func</div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>Primary Pillar *</label>
          <select id="pillar" required>
            <option value="1">1 - Operational Visibility</option>
            <option value="2">2 - Operational Standardization</option>
            <option value="3">3 - Capacity & Growth Readiness</option>
          </select>
        </div>
        <div class="form-group">
          <label>Form Order</label>
          <input type="number" id="form_order" min="1" placeholder="Display order in form">
          <div class="help-text">Only for input KPIs</div>
        </div>
      </div>
      
      <div class="form-group">
        <label>Affected Business Sections</label>
        <div class="section-checkboxes" id="sectionCheckboxes">
          <!-- Populated by JavaScript -->
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <div class="checkbox-group">
            <input type="checkbox" id="required">
            <label for="required" style="margin: 0;">Required field</label>
          </div>
        </div>
        <div class="form-group">
          <div class="checkbox-group">
            <input type="checkbox" id="active" checked>
            <label for="active" style="margin: 0;">Active (enabled)</label>
          </div>
        </div>
      </div>
      
      <div id="formMessage"></div>
      
      <div class="button-group">
        <button type="button" class="secondary" onclick="showPanel('list')">Cancel</button>
        <button type="submit" class="primary" id="saveBtn">Save KPI</button>
      </div>
    </form>
  </div>

  <script>
    let kpis = [];
    let sections = [];
    let selectedKPI = null;
    let isNew = true;
    
    document.addEventListener('DOMContentLoaded', loadData);
    
    function loadData() {
      google.script.run
        .withSuccessHandler(function(data) {
          kpis = data.kpis;
          sections = data.sections;
          renderKPIList();
          renderSectionCheckboxes();
        })
        .withFailureHandler(showError)
        .getKPIManagerData();
    }
    
    function renderKPIList() {
      const list = document.getElementById('kpiList');
      list.innerHTML = kpis.map(kpi => `
        <div class="kpi-item" onclick="selectKPI('${kpi.id}')" data-id="${kpi.id}">
          <div>
            <div class="name">${escapeHtml(kpi.name)}</div>
            <div class="type">${kpi.id} | ${kpi.category}</div>
          </div>
          <span class="badge ${kpi.type}">${kpi.type}</span>
        </div>
      `).join('');
    }
    
    function renderSectionCheckboxes() {
      const container = document.getElementById('sectionCheckboxes');
      container.innerHTML = sections.map(s => `
        <label class="section-checkbox">
          <input type="checkbox" name="sections" value="${s.sectionId}">
          ${s.sectionId}. ${escapeHtml(s.sectionName)}
        </label>
      `).join('');
    }
    
    function selectKPI(id) {
      document.querySelectorAll('.kpi-item').forEach(el => el.classList.remove('selected'));
      document.querySelector(`.kpi-item[data-id="${id}"]`).classList.add('selected');
      selectedKPI = kpis.find(k => k.id === id);
    }
    
    function showPanel(panel) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      document.querySelector(`.tab:nth-child(${panel === 'list' ? 1 : 2})`).classList.add('active');
      document.getElementById(panel + 'Panel').classList.add('active');
    }
    
    function newKPI() {
      isNew = true;
      selectedKPI = null;
      document.getElementById('kpiForm').reset();
      document.getElementById('active').checked = true;
      document.getElementById('kpi_id').disabled = false;
      toggleFormulaField();
      showPanel('form');
    }
    
    function editSelected() {
      if (!selectedKPI) {
        alert('Please select a KPI first');
        return;
      }
      isNew = false;
      populateForm(selectedKPI);
      document.getElementById('kpi_id').disabled = true;
      showPanel('form');
    }
    
    function populateForm(kpi) {
      document.getElementById('kpi_id').value = kpi.id;
      document.getElementById('name').value = kpi.name;
      document.getElementById('description').value = kpi.description || '';
      document.getElementById('category').value = kpi.category;
      document.getElementById('type').value = kpi.type;
      document.getElementById('data_type').value = kpi.dataType;
      document.getElementById('formula').value = kpi.formula || '';
      document.getElementById('pillar').value = kpi.pillar;
      document.getElementById('form_order').value = kpi.formOrder || '';
      document.getElementById('required').checked = kpi.required;
      document.getElementById('active').checked = kpi.active;
      
      // Set section checkboxes
      document.querySelectorAll('input[name="sections"]').forEach(cb => {
        cb.checked = kpi.sections && kpi.sections.includes(parseInt(cb.value));
      });
      
      toggleFormulaField();
    }
    
    function toggleFormulaField() {
      const type = document.getElementById('type').value;
      document.getElementById('formulaGroup').style.display = type === 'calculated' ? 'block' : 'none';
    }
    
    function saveKPI(e) {
      e.preventDefault();
      
      const checkedSections = Array.from(document.querySelectorAll('input[name="sections"]:checked'))
        .map(cb => cb.value).join(',');
      
      const kpiData = {
        kpi_id: document.getElementById('kpi_id').value,
        name: document.getElementById('name').value,
        description: document.getElementById('description').value,
        category: document.getElementById('category').value,
        type: document.getElementById('type').value,
        data_type: document.getElementById('data_type').value,
        formula: document.getElementById('formula').value,
        sections: checkedSections,
        pillar: document.getElementById('pillar').value,
        form_order: document.getElementById('form_order').value,
        required: document.getElementById('required').checked,
        active: document.getElementById('active').checked
      };
      
      document.getElementById('saveBtn').disabled = true;
      
      google.script.run
        .withSuccessHandler(function(result) {
          document.getElementById('saveBtn').disabled = false;
          if (result.success) {
            showMessage('KPI saved successfully!', 'success');
            loadData();
            setTimeout(() => showPanel('list'), 1000);
          } else {
            showMessage(result.error, 'error');
          }
        })
        .withFailureHandler(function(err) {
          document.getElementById('saveBtn').disabled = false;
          showMessage(err.message, 'error');
        })
        .saveKPI(kpiData, isNew);
    }
    
    function deleteSelected() {
      if (!selectedKPI) {
        alert('Please select a KPI first');
        return;
      }
      if (!confirm(`Delete "${selectedKPI.name}"? This cannot be undone.`)) return;
      
      google.script.run
        .withSuccessHandler(function(result) {
          if (result.success) {
            alert('KPI deleted');
            selectedKPI = null;
            loadData();
          } else {
            alert('Error: ' + result.error);
          }
        })
        .withFailureHandler(showError)
        .deleteKPI(selectedKPI.id);
    }
    
    function showMessage(msg, type) {
      const el = document.getElementById('formMessage');
      el.className = type;
      el.textContent = msg;
    }
    
    function showError(err) {
      alert('Error: ' + (err.message || err));
    }
    
    function escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  </script>
</body>
</html>
```

#### 4. Create Similar HTML Files for Other Managers

Create the following additional HTML files following the same pattern:

- `ValidationManager.html` — For managing validation rules
- `SectionManager.html` — For managing business sections  
- `BenchmarkManager.html` — For managing industry benchmarks

Each should follow the same structure: list view + form view with appropriate fields.

---

## Enhancement #3: Form Response Integration Fix

### Current State Analysis

Based on code review, there is a **critical integration issue** between the Google Form responses and the Clients sheet:

**The Problem:**

1. When `createClientIntakeForm()` runs, it creates a Google Form and links it to the spreadsheet
2. Google automatically creates a "Form Responses 1" sheet to receive submissions
3. The code attempts to rename this to "Clients" OR copy data to existing Clients sheet
4. However, the column headers DON'T MATCH between Form Responses and Clients:

**Form Responses 1 columns (from form):**
```
Timestamp | Company Name | Contact Email | Industry | State/Province | Data Period | Total Leads | In-Home Visits | ...
```

**Clients sheet expected columns:**
```
client_id | timestamp | company_name | contact_email | industry | state | data_period | period_days | total_leads | in_home_visits | ...
```

**Key mismatches:**
- Form uses display names ("Company Name"), Clients expects snake_case (`company_name`)
- Form doesn't generate `client_id` (must be added post-submission)
- Form doesn't calculate `period_days` (must be derived from `data_period`)
- Form uses "State/Province", Clients expects `state`

### Current Code Flow

In `FormManager.gs`:
```javascript
function renameFormResponsesSheet() {
  // Tries to rename "Form Responses 1" to "Clients"
  // OR deletes the form responses sheet if Clients already exists
}
```

In `Triggers.gs`:
```javascript
function onFormSubmit(e) {
  // Calls processNewSubmission() to add client_id and period_days
}
```

In `ClientManager.gs`:
```javascript
function processNewSubmission(e) {
  // Tries to find columns by header name
  // But the form creates different header names!
}
```

### The Core Issue

**The form creates a separate "Form Responses 1" sheet** that has different column headers than the "Clients" sheet. The current code tries to work around this but doesn't properly:

1. Map form column names to expected Clients column names
2. Ensure form responses land in the right columns
3. Handle the case where both sheets exist

### Required Fix

#### Option A: Use Form Responses Sheet Directly (Recommended)

Configure the system to use the form-generated sheet and adapt to its structure.

#### Option B: Proper Column Mapping (Current Approach Fixed)

Fix the column mapping to translate between form headers and system headers.

### Implementation: Option B (Fixing Current Approach)

#### 1. Update `FormManager.gs` — New Function for Form Destination

```javascript
/**
 * Configure form to write to Clients sheet with proper column mapping
 * This should be called after form creation
 */
function configureFormDestination() {
  const formId = getSetting(SETTINGS_KEYS.FORM_ID);
  if (!formId) {
    throw new Error('No form found');
  }

  const form = FormApp.openById(formId);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Set form destination to the spreadsheet
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  
  // Wait for sheet to be created
  SpreadsheetApp.flush();
  Utilities.sleep(2000);
  
  // Find and configure the form responses sheet
  const sheets = ss.getSheets();
  let formResponsesSheet = null;
  
  for (const sheet of sheets) {
    if (sheet.getName().startsWith('Form Responses')) {
      formResponsesSheet = sheet;
      break;
    }
  }
  
  if (!formResponsesSheet) {
    log('Form responses sheet not found');
    return;
  }
  
  // Store the form responses sheet name for later reference
  setSetting('form_responses_sheet', formResponsesSheet.getName());
  
  log('Form destination configured: ' + formResponsesSheet.getName());
}
```

#### 2. Update `ClientManager.gs` — Process Form Submission with Mapping

```javascript
/**
 * Column mapping from form question titles to Clients sheet column names
 */
const FORM_TO_CLIENT_MAPPING = {
  'Timestamp': 'timestamp',
  'Company Name': 'company_name',
  'Contact Email': 'contact_email',
  'Industry': 'industry',
  'State/Province': 'state',
  'Data Period': 'data_period',
  'Total Leads': 'total_leads',
  'In-Home Visits': 'in_home_visits',
  'Jobs Closed': 'jobs_closed',
  'Gross Revenue': 'gross_revenue',
  'Total Costs': 'total_costs',
  'Number of Employees': 'num_employees',
  'Number of Technicians': 'num_techs',
  'Number of Vehicles': 'num_vehicles',
  'Hours Scheduled': 'hours_scheduled',
  'Work Hours Per Day': 'hours_per_day',
  'Average Ticket': 'average_ticket',
  'Reported Close Rate': 'reported_close_rate',
  'Reported Booking Rate': 'reported_booking_rate',
  'Notes or Comments': 'notes'
};

/**
 * Process form submission and copy to Clients sheet
 * @param {Object} e - Form submit event
 * @returns {string|null} Client ID or null
 */
function processNewSubmission(e) {
  try {
    log('Processing form submission...');
    
    // Get the form responses sheet
    const formResponsesSheetName = getSetting('form_responses_sheet') || 'Form Responses 1';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const formSheet = ss.getSheetByName(formResponsesSheetName);
    
    if (!formSheet) {
      logError('Form responses sheet not found: ' + formResponsesSheetName);
      return null;
    }
    
    // Get the Clients sheet
    const clientsSheet = getRequiredSheet(SHEET_NAMES.CLIENTS);
    
    // Get the last row from form responses (the new submission)
    const formLastRow = formSheet.getLastRow();
    if (formLastRow < 2) {
      log('No data in form responses');
      return null;
    }
    
    // Get form headers and data
    const formHeaders = formSheet.getRange(1, 1, 1, formSheet.getLastColumn()).getValues()[0];
    const formData = formSheet.getRange(formLastRow, 1, 1, formSheet.getLastColumn()).getValues()[0];
    
    // Get clients headers
    const clientsHeaders = clientsSheet.getRange(1, 1, 1, clientsSheet.getLastColumn()).getValues()[0];
    const clientsHeadersLower = clientsHeaders.map(h => String(h).toLowerCase());
    
    // Build mapped data object
    const mappedData = {};
    for (let i = 0; i < formHeaders.length; i++) {
      const formHeader = formHeaders[i];
      const clientHeader = FORM_TO_CLIENT_MAPPING[formHeader];
      if (clientHeader) {
        mappedData[clientHeader] = formData[i];
      }
    }
    
    // Generate client_id
    const companyName = mappedData.company_name || 'Unknown';
    const clientId = generateClientId(companyName);
    mappedData.client_id = clientId;
    
    // Calculate period_days
    const dataPeriod = mappedData.data_period || 'monthly';
    mappedData.period_days = getPeriodDays(dataPeriod);
    
    // Set analysis status
    mappedData.analysis_status = ANALYSIS_STATUS.PENDING;
    
    // Build row for Clients sheet
    const clientRow = clientsHeaders.map(h => {
      const key = String(h).toLowerCase();
      return mappedData[key] !== undefined ? mappedData[key] : '';
    });
    
    // Append to Clients sheet
    clientsSheet.appendRow(clientRow);
    
    log(`Processed submission: ${clientId} (${companyName})`);
    return clientId;
    
  } catch (error) {
    logError('Error processing form submission', error);
    return null;
  }
}
```

#### 3. Update `Triggers.gs` — Improved Form Submit Handler

```javascript
/**
 * onFormSubmit trigger handler
 * Processes new submission, optionally runs analysis
 * @param {Object} e - Event object from form submission
 */
function onFormSubmit(e) {
  try {
    log('Form submission received');
    
    // Small delay to ensure form response is written
    Utilities.sleep(1000);
    
    // Process the new submission
    const clientId = processNewSubmission(e);
    
    if (!clientId) {
      logError('Could not process form submission - no client ID returned');
      return;
    }
    
    // Send email notification
    sendSubmissionNotification(clientId);
    
    // Auto-analyze if enabled
    const autoAnalyze = getSetting(SETTINGS_KEYS.AUTO_ANALYZE);
    
    if (autoAnalyze === true || autoAnalyze === 'TRUE' || autoAnalyze === 'true') {
      log('Auto-analyze enabled, running analysis...');
      setActiveClient(clientId);
      
      // Small delay before analysis
      Utilities.sleep(500);
      runAnalysis();
      
      log('Auto-analysis completed for ' + clientId);
    }
    
    // Show toast (may not show if user not viewing sheet)
    try {
      const client = getClientById(clientId);
      const companyName = client ? client.company_name : 'New client';
      SpreadsheetApp.getActiveSpreadsheet().toast(
        `New submission from ${companyName}`,
        'Form Received',
        5
      );
    } catch (toastError) {
      // Toast may fail if no active user session
    }
    
  } catch (error) {
    logError('Error in onFormSubmit trigger', error);
  }
}
```

#### 4. Add Diagnostic Function to Verify Form Integration

```javascript
/**
 * Diagnose form-to-client integration
 * Run this to check if form responses are being captured correctly
 */
function diagnoseFormIntegration() {
  const issues = [];
  const info = [];
  
  // Check for form
  const formId = getSetting(SETTINGS_KEYS.FORM_ID);
  if (!formId) {
    issues.push('❌ No form ID found in settings. Create a form first.');
  } else {
    info.push('✓ Form ID found: ' + formId);
    
    // Check if form exists
    try {
      const form = FormApp.openById(formId);
      info.push('✓ Form accessible: ' + form.getTitle());
    } catch (e) {
      issues.push('❌ Form ID exists but form not accessible: ' + e.message);
    }
  }
  
  // Check for form responses sheet
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const formResponsesSheetName = getSetting('form_responses_sheet');
  
  let formSheet = null;
  if (formResponsesSheetName) {
    formSheet = ss.getSheetByName(formResponsesSheetName);
  }
  
  // Also check for default name
  if (!formSheet) {
    formSheet = ss.getSheetByName('Form Responses 1');
  }
  
  if (formSheet) {
    info.push('✓ Form responses sheet found: ' + formSheet.getName());
    info.push('  - Rows: ' + formSheet.getLastRow());
    
    // Check headers
    const headers = formSheet.getRange(1, 1, 1, formSheet.getLastColumn()).getValues()[0];
    info.push('  - Columns: ' + headers.filter(h => h).join(', '));
  } else {
    issues.push('❌ No form responses sheet found. Submit a test response.');
  }
  
  // Check Clients sheet
  const clientsSheet = ss.getSheetByName(SHEET_NAMES.CLIENTS);
  if (clientsSheet) {
    info.push('✓ Clients sheet found');
    info.push('  - Rows: ' + clientsSheet.getLastRow());
  } else {
    issues.push('❌ Clients sheet not found. Run Initialize System.');
  }
  
  // Check triggers
  const triggers = ScriptApp.getProjectTriggers();
  const formTrigger = triggers.find(t => t.getHandlerFunction() === 'onFormSubmit');
  
  if (formTrigger) {
    info.push('✓ Form submit trigger installed');
  } else {
    issues.push('❌ No form submit trigger found. Reinstall with reinstallFormTrigger()');
  }
  
  // Show results
  let message = '=== FORM INTEGRATION DIAGNOSIS ===\n\n';
  
  if (issues.length > 0) {
    message += 'ISSUES FOUND:\n' + issues.join('\n') + '\n\n';
  }
  
  message += 'STATUS:\n' + info.join('\n');
  
  if (issues.length === 0) {
    message += '\n\n✅ Form integration appears healthy!';
  } else {
    message += '\n\n⚠️ Please address the issues above.';
  }
  
  SpreadsheetApp.getUi().alert('Form Integration Diagnosis', message, SpreadsheetApp.getUi().ButtonSet.OK);
  
  return { issues, info };
}
```

#### 5. Add Menu Item for Diagnosis

In `Main.gs`, add to Administration submenu:

```javascript
.addSubMenu(ui.createMenu('Administration')
  .addItem('Validate Configuration', 'validateAndShowConfig')
  .addItem('Diagnose Form Integration', 'diagnoseFormIntegration')  // NEW
  .addItem('View Settings', 'showSettings')
  .addItem('Initialize System', 'initializeSystem')
  .addItem('Reset System...', 'resetSystem'))
```

---

## Implementation Priority

### Priority 1: Critical (Do First)
**Enhancement #3: Form Response Integration Fix**
- This is blocking core functionality
- Without this fix, client data won't flow properly from form submissions
- Estimated effort: 2-3 hours

### Priority 2: High (Do Next)
**Enhancement #2: Config Management UI Dialogs**
- Enables Robert and Alex to maintain the system without developer help
- Reduces risk of configuration errors
- Estimated effort: 6-8 hours (all managers)

### Priority 3: Medium (Can Wait)
**Enhancement #1: State/Province Benchmarking**
- Not needed for initial launch
- Can be added when Phase 2 (benchmarking) begins
- Estimated effort: 2-3 hours

---

## Testing Checklist

### Enhancement #3 Testing
- [ ] Submit test form response
- [ ] Verify data appears in Form Responses sheet
- [ ] Verify data is copied to Clients sheet with correct columns
- [ ] Verify client_id is generated
- [ ] Verify period_days is calculated
- [ ] Run analysis on new submission
- [ ] Test auto-analyze feature

### Enhancement #2 Testing
- [ ] Add new KPI via UI
- [ ] Edit existing KPI via UI
- [ ] Delete KPI (verify dependency check)
- [ ] Add new validation rule via UI
- [ ] Add new benchmark via UI
- [ ] Verify all changes persist correctly

### Enhancement #1 Testing
- [ ] Run migration script
- [ ] Verify state column added
- [ ] Add state-specific benchmark
- [ ] Run analysis for client in that state
- [ ] Verify correct benchmark is applied

---

*End of Enhancement Documentation*
