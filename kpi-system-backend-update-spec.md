# KPI Analyzer System — Backend Update Specification

**Project**: ShopFloor Solutions - Operational KPI Calculator  
**Version**: 2.0 Update  
**Date**: December 8, 2024  
**Purpose**: Document all configuration changes and required backend updates

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Configuration Changes Overview](#2-configuration-changes-overview)
3. [Config_KPIs Schema Updates](#3-config_kpis-schema-updates)
4. [Config_Validations Updates](#4-config_validations-updates)
5. [FormManager.gs Updates](#5-formmanagergs-updates)
6. [ValidationEngine.gs Updates](#6-validationenginegs-updates)
7. [KPIEngine.gs Updates](#7-kpienginejs-updates)
8. [ResultsGenerator.gs Updates](#8-resultsgeneratorgs-updates)
9. [Config.gs Updates](#9-configgs-updates)
10. [InsightsEngine.gs Updates](#10-insightsenginejs-updates)
11. [UI Updates](#11-ui-updates)
12. [New Settings Required](#12-new-settings-required)
13. [Testing Checklist](#13-testing-checklist)
14. [Migration Steps](#14-migration-steps)

---

## 1. Executive Summary

### What Changed

The KPI system has been significantly expanded:

| Area | Before | After |
|------|--------|-------|
| **Input KPIs** | ~14 | 96 |
| **Calculated KPIs** | ~10 | 90 |
| **Validation Rules** | 11 | 86 |
| **Business Sections** | 9 | 9 (unchanged) |
| **Form Structure** | 2 sections (Volume/Efficiency) | 3 tiers (Onboarding/Detailed/Deep) |
| **Tool Mapping** | None | New columns for recommendations |

### New Features to Implement

1. **Tiered Form Generation** — Create forms based on `form_tier` column
2. **Extended Validation Engine** — Handle new formula types and 75 new rules
3. **Tool Recommendations** — Display recommended tools in results
4. **Section-Specific KPIs** — Handle KPIs organized by 9 business sections

---

## 2. Configuration Changes Overview

### Config_KPIs — New Columns Added

| Column | Type | Purpose |
|--------|------|---------|
| `form_tier` | String | "onboarding" / "detailed" / "section_deep" |
| `tier_order` | Integer | Display order within tier (1-232) |
| `tier_reason` | String | Why KPI is in that tier |
| `tool_category` | String | "out_of_box" / "build_internal" / "not_us" / "hybrid" |
| `recommended_tool` | String | Specific tool/vendor names |
| `tool_notes` | String | Implementation notes |
| `Importance` | String | High/Medium/Low priority indicator |

### Config_KPIs — Existing Columns (Review for Conflicts)

| Column | Current Use | Potential Conflict |
|--------|-------------|-------------------|
| `required` | Boolean - form field required | Some `form_tier` KPIs have `required=FALSE` — **this is OK** |
| `form_order` | Legacy display order | **DEPRECATE** — use `tier_order` instead |
| `active` | Boolean - KPI enabled | All tiered KPIs are `active=TRUE` — **no conflict** |
| `category` | "volume" / "efficiency" / section name | Now mixed (some are section names like "Marketing") |

### Config_Validations — New Rules Added

| Section | New Rules | Key Formula Types |
|---------|-----------|-------------------|
| Marketing | 8 | RANGE, REQUIRES, GREATER |
| CSR/Call Center | 9 | RANGE, RECONCILE (with + operator) |
| Sales | 9 | RANGE, RECONCILE, GREATER |
| Field Operations | 10 | RANGE, RECONCILE, GREATER |
| Scheduling/Dispatch | 9 | RANGE, RECONCILE |
| Inventory/Warehouse | 8 | RANGE, RECONCILE, GREATER |
| Finance/Accounting | 9 | RANGE, RECONCILE, GREATER |
| HR/Training | 11 | RANGE, RECONCILE, GREATER |
| Health Ratios | 2 | RANGE |
| **Total New** | **75** | |

---

## 3. Config_KPIs Schema Updates

### Current Column Order (After Updates)

```
A: Importance
B: kpi_id
C: name
D: description
E: category
F: type
G: data_type
H: formula
I: sections
J: pillar
K: required
L: form_order (DEPRECATED - use tier_order)
M: active
N: form_tier
O: tier_order
P: tier_reason
Q: tool_category
R: recommended_tool
S: tool_notes
```

### KPI Type Values

The `type` column now has inconsistent casing:

| Value | Count | Meaning |
|-------|-------|---------|
| `input` | 96 | User-entered value |
| `calculated` | 10 | Original calculated KPIs |
| `Calculation` | 80 | New calculated KPIs |

**Action Required**: Normalize to lowercase `calculated` OR update code to handle both:

```javascript
// In Config.gs getInputKPIs() and getCalculatedKPIs()
const isInput = kpi.type === 'input';
const isCalculated = kpi.type === 'calculated' || kpi.type === 'Calculation';
```

### Category Values

The `category` column now has mixed values:

| Value Type | Examples | Count |
|------------|----------|-------|
| Legacy categories | "volume", "efficiency" | 23 |
| Section names | "Marketing", "CSR/Call Center", "Sales", etc. | 166 |

**Impact**: The current `buildFormQuestions()` filters by `category === 'volume'` and `category === 'efficiency'`. This will **miss 166 KPIs**.

**Action Required**: Update form building logic to use `form_tier` instead of `category`.

---

## 4. Config_Validations Updates

### New Formula Patterns

The validation engine must handle these new formula patterns:

#### 1. RECONCILE with Addition Operator (NEW)

```
RECONCILE:CSR_CORE_003+CSR_CORE_004:CSR_CORE_001
```

Meaning: `CSR_CORE_003 + CSR_CORE_004` should equal `CSR_CORE_001`

**Current Code Cannot Handle This** — the `+` operator is not parsed.

#### 2. RECONCILE with Multiplication (Existing)

```
RECONCILE:SAL_CORE_003*SAL_DER_002:SAL_CORE_004
```

Meaning: `Jobs Sold × Avg Ticket` should equal `Sales Revenue`

#### 3. GREATER (Existing but More Used)

```
GREATER:CSR_CORE_003:CSR_CORE_005
```

Meaning: `Calls Answered` should be greater than `Booked Jobs`

#### 4. REQUIRES (Existing)

```
REQUIRES:MKT_CORE_003:MKT_CORE_001
```

Meaning: If `Total Leads Generated` exists, `Total Marketing Spend` must exist

#### 5. RANGE (Existing but New Ranges)

```
RANGE:MKT_DER_001:1:500
RANGE:FIN_DER_002:-50:50
```

Note: Some ranges now allow **negative values** (e.g., net margin can be negative).

### Validation Rule IDs by Section

```
Core/Legacy (11):
  booking_rate_reconcile, close_rate_reconcile, revenue_reconcile,
  profit_positive, close_rate_range, booking_rate_range,
  schedule_efficiency_range, avg_ticket_match, has_leads_for_visits,
  has_visits_for_jobs, rule_1764251527760

Marketing (8):
  mkt_cpl_range, mkt_website_conv_range, mkt_spend_pct_range,
  mkt_lead_quality_range, mkt_roas_positive, mkt_qualified_vs_total,
  mkt_leads_require_spend, mkt_revenue_attr_vs_total

CSR/Call Center (9):
  csr_answer_rate_range, csr_abandon_rate_range, csr_answer_abandon_reconcile,
  csr_booking_rate_range, csr_followup_range, csr_booked_vs_answered,
  csr_outbound_booked_vs_total, csr_followup_completed_vs_assigned,
  csr_avg_handle_time_range

Sales (9):
  sal_close_rate_range, sal_jobs_vs_appointments, sal_estimate_hit_range,
  sal_jobs_vs_estimates, sal_first_call_vs_total, sal_first_call_rate_range,
  sal_followup_range, sal_revenue_reconcile, sal_financing_range

Field Operations (10):
  fld_completion_rate_range, fld_completed_vs_scheduled, fld_qc_pass_range,
  fld_qc_failed_vs_inspected, fld_rework_rate_range, fld_labor_efficiency_range,
  fld_ontime_range, fld_first_fix_range, fld_safety_rate_range,
  fld_ontime_vs_scheduled

Scheduling/Dispatch (9):
  sch_utilization_range, sch_booked_vs_available, sch_dispatch_accuracy_range,
  sch_incorrect_vs_dispatched, sch_reschedule_range, sch_routing_efficiency_range,
  sch_arrival_window_range, sch_first_visit_range, sch_travel_onsite_reconcile

Inventory/Warehouse (8):
  inv_accuracy_range, inv_shrinkage_range, inv_fulfillment_range,
  inv_correct_vs_filled, inv_po_receipt_range, inv_received_vs_issued,
  inv_damage_range, inv_backorder_range

Finance/Accounting (9):
  fin_gross_margin_range, fin_net_margin_range, fin_payroll_ratio_range,
  fin_opex_ratio_range, fin_dso_range, fin_refund_range, fin_cogs_vs_revenue,
  fin_cash_coverage_range, fin_ar_vs_revenue

HR/Training (11):
  hr_turnover_range, hr_retention_range, hr_training_compliance_range,
  hr_training_completed_vs_required, hr_review_completion_range,
  hr_reviews_completed_vs_due, hr_vacancy_range, hr_app_to_hire_range,
  hr_hires_vs_apps, hr_interviews_vs_apps, hr_separations_vs_employees

Health Ratios (2):
  ratio_field_to_office, ratio_revenue_per_employee
```

---

## 5. FormManager.gs Updates

### Current State (BROKEN)

```javascript
// Current buildFormQuestions() logic:
const volumeKPIs = inputKPIs.filter(k => k.category === 'volume');
const efficiencyKPIs = inputKPIs.filter(k => k.category === 'efficiency');
```

This only captures 23 of 96 input KPIs because the new KPIs use section names as categories.

### Required Changes

#### 5.1 Update getInputKPIs() in Config.gs

```javascript
/**
 * Get input KPIs filtered by form tier
 * @param {string} tier - "onboarding", "detailed", "section_deep", or null for all
 * @returns {Object[]} Input KPI definitions
 */
function getInputKPIs(tier = null) {
  const kpiConfig = getKPIConfig();
  let inputKPIs = kpiConfig.filter(k => k.type === 'input');
  
  if (tier) {
    inputKPIs = inputKPIs.filter(k => k.formTier === tier);
  }
  
  // Sort by tier_order
  inputKPIs.sort((a, b) => (a.tierOrder || 999) - (b.tierOrder || 999));
  
  return inputKPIs;
}
```

#### 5.2 New Function: createTieredForm()

```javascript
/**
 * Create form for a specific tier
 * @param {string} tier - "onboarding", "detailed", or "all"
 * @returns {string} Form URL
 */
function createTieredForm(tier = 'onboarding') {
  // ... existing form setup code ...
  
  let inputKPIs;
  let formTitle;
  
  switch (tier) {
    case 'onboarding':
      inputKPIs = getInputKPIs('onboarding');
      formTitle = 'Quick Business Assessment - ShopFloor Solutions';
      break;
    case 'detailed':
      // Detailed includes onboarding + detailed tier
      inputKPIs = [...getInputKPIs('onboarding'), ...getInputKPIs('detailed')];
      formTitle = 'Comprehensive Business Assessment - ShopFloor Solutions';
      break;
    case 'all':
      inputKPIs = getInputKPIs(); // All input KPIs
      formTitle = 'Full Diagnostic Assessment - ShopFloor Solutions';
      break;
    default:
      inputKPIs = getInputKPIs('onboarding');
      formTitle = 'Quick Business Assessment - ShopFloor Solutions';
  }
  
  buildFormQuestionsBySection(form, inputKPIs);
  // ... rest of form creation ...
}
```

#### 5.3 New Function: buildFormQuestionsBySection()

Replace the old `buildFormQuestions()` with section-aware version:

```javascript
/**
 * Build form questions organized by business section
 * @param {GoogleAppsScript.Forms.Form} form
 * @param {Object[]} inputKPIs - Pre-filtered and sorted KPIs
 */
function buildFormQuestionsBySection(form, inputKPIs) {
  // ---- Section 1: Company Information ----
  // ... existing company info questions ...
  
  // Group KPIs by section (using category field)
  const sections = {};
  for (const kpi of inputKPIs) {
    const section = kpi.category || 'General';
    if (!sections[section]) {
      sections[section] = [];
    }
    sections[section].push(kpi);
  }
  
  // Define section order and display names
  const sectionOrder = [
    { key: 'volume', name: 'Volume Metrics', help: 'Size and capacity of your operation' },
    { key: 'efficiency', name: 'Efficiency Metrics', help: 'Performance relative to capacity' },
    { key: 'Marketing', name: 'Marketing', help: 'Lead generation and advertising' },
    { key: 'CSR/Call Center', name: 'CSR / Call Center', help: 'Call handling and booking' },
    { key: 'Sales', name: 'Sales', help: 'Sales appointments and closing' },
    { key: 'Field Operations', name: 'Field Operations', help: 'Job execution and quality' },
    { key: 'Scheduling/Dispatch', name: 'Scheduling & Dispatch', help: 'Job assignment and routing' },
    { key: 'Inventory/Warehouse', name: 'Inventory & Warehouse', help: 'Parts and materials' },
    { key: 'Finance/Accounting', name: 'Finance & Accounting', help: 'Revenue, costs, and cash flow' },
    { key: 'HR/Training', name: 'HR & Training', help: 'Staffing and development' }
  ];
  
  // Create form sections
  for (const sectionDef of sectionOrder) {
    const sectionKPIs = sections[sectionDef.key];
    if (!sectionKPIs || sectionKPIs.length === 0) continue;
    
    // Add page break / section header
    form.addPageBreakItem()
      .setTitle(sectionDef.name)
      .setHelpText(sectionDef.help + '\n\nLeave blank if you don\'t track this metric.');
    
    // Add questions for this section
    for (const kpi of sectionKPIs) {
      createFormQuestion(form, kpi);
    }
  }
  
  // ---- Final Section: Additional Information ----
  // ... existing notes/comments question ...
}
```

#### 5.4 Update Menu to Support Tier Selection

Add new menu option in Main.gs:

```javascript
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('ShopFloor Tools')
    // ... existing items ...
    .addSubMenu(ui.createMenu('Form Management')
      .addItem('Create Onboarding Form (35 questions)', 'createOnboardingForm')
      .addItem('Create Detailed Form (63 questions)', 'createDetailedForm')
      .addItem('Create Full Form (96 questions)', 'createFullForm')
      .addSeparator()
      .addItem('Get Form URL', 'showFormUrl')
      .addItem('Delete Form', 'deleteFormWithConfirmation'))
    // ... rest of menu ...
}

function createOnboardingForm() {
  createTieredForm('onboarding');
}

function createDetailedForm() {
  createTieredForm('detailed');
}

function createFullForm() {
  createTieredForm('all');
}
```

---

## 6. ValidationEngine.gs Updates

### 6.1 Update executeReconcile() to Handle Addition

Current code only handles multiplication. Update to handle `+`:

```javascript
/**
 * Execute RECONCILE validation
 * Handles: RECONCILE:a*b:c, RECONCILE:a+b:c, RECONCILE:a*b/100:c
 * @param {string} formula
 * @param {Object} values
 * @param {number} tolerance
 * @returns {Object}
 */
function executeReconcile(formula, values, tolerance) {
  // Parse formula: RECONCILE:expression:target
  const parts = formula.replace('RECONCILE:', '').split(':');
  if (parts.length !== 2) {
    return { passed: true, skipped: true, reason: 'Invalid formula format' };
  }
  
  const expression = parts[0];
  const targetKPI = parts[1];
  
  const targetValue = getValue(targetKPI, values);
  if (targetValue === null || targetValue === undefined) {
    return { passed: true, skipped: true, reason: 'Target value missing' };
  }
  
  // Evaluate expression
  const calculatedValue = evaluateExpression(expression, values);
  if (calculatedValue === null) {
    return { passed: true, skipped: true, reason: 'Expression dependencies missing' };
  }
  
  // Compare with tolerance
  const variance = Math.abs(calculatedValue - targetValue) / Math.max(Math.abs(targetValue), 1);
  const passed = variance <= tolerance;
  
  return {
    passed: passed,
    skipped: false,
    expected: calculatedValue,
    actual: targetValue,
    variance: variance,
    variancePercent: (variance * 100).toFixed(1) + '%'
  };
}

/**
 * Evaluate arithmetic expression with KPI values
 * Handles: a*b, a+b, a-b, a/b, a*b/100, a+b+c
 * @param {string} expression
 * @param {Object} values
 * @returns {number|null}
 */
function evaluateExpression(expression, values) {
  // Replace KPI IDs with values
  let expr = expression;
  
  // Find all KPI IDs in expression (alphanumeric with underscores)
  const kpiPattern = /[A-Za-z_][A-Za-z0-9_]*/g;
  const kpiIds = expression.match(kpiPattern) || [];
  
  for (const kpiId of kpiIds) {
    const value = getValue(kpiId, values);
    if (value === null || value === undefined) {
      return null; // Missing dependency
    }
    // Replace KPI ID with value (use word boundary to avoid partial replacement)
    expr = expr.replace(new RegExp('\\b' + kpiId + '\\b', 'g'), value.toString());
  }
  
  // Evaluate the expression safely
  try {
    // Only allow numbers and basic operators
    if (!/^[\d\s\.\+\-\*\/\(\)]+$/.test(expr)) {
      log('Invalid expression characters: ' + expr);
      return null;
    }
    return eval(expr);
  } catch (e) {
    log('Expression evaluation error: ' + e.message);
    return null;
  }
}
```

### 6.2 Update executeRange() for Negative Values

```javascript
/**
 * Execute RANGE validation
 * @param {string} formula - e.g., "RANGE:close_rate:0:100" or "RANGE:net_margin:-50:50"
 * @param {Object} values
 * @returns {Object}
 */
function executeRange(formula, values) {
  const parts = formula.replace('RANGE:', '').split(':');
  if (parts.length !== 3) {
    return { passed: true, skipped: true, reason: 'Invalid range formula' };
  }
  
  const kpiId = parts[0];
  const min = parseFloat(parts[1]);
  const max = parseFloat(parts[2]);
  
  const value = getValue(kpiId, values);
  if (value === null || value === undefined) {
    return { passed: true, skipped: true, reason: 'Value missing' };
  }
  
  // Note: min can be negative (e.g., -50 for net margin)
  const passed = value >= min && value <= max;
  
  return {
    passed: passed,
    skipped: false,
    actual: value,
    min: min,
    max: max
  };
}
```

### 6.3 Add Section Tracking to Validation Results

```javascript
/**
 * Run all validation rules
 * @param {Object} allValues
 * @param {Object[]} validationConfig
 * @param {Object[]} kpiConfig - Needed to map KPIs to sections
 * @returns {Object}
 */
function validateAll(allValues, validationConfig, kpiConfig) {
  const issues = [];
  
  for (const rule of validationConfig) {
    if (!rule.active) continue;
    
    const result = runValidation(rule, allValues);
    
    if (result && !result.passed && !result.skipped) {
      // Get affected sections from KPI config
      const affectedKPIs = rule.affectedKPIs ? rule.affectedKPIs.split(',') : [];
      const affectedSections = getAffectedSectionsFromKPIs(affectedKPIs, kpiConfig);
      
      issues.push({
        ruleId: rule.ruleId,
        ruleName: rule.name,
        severity: rule.severity,
        message: formatValidationMessage(rule.message, result),
        expected: result.expected,
        actual: result.actual,
        variance: result.variancePercent || null,
        affectedKPIs: affectedKPIs,
        affectedSections: affectedSections, // NEW
        suggestedAction: rule.suggestedAction || null
      });
    }
  }
  
  return {
    status: determineOverallStatus(issues),
    issues: issues,
    errorCount: issues.filter(i => i.severity === 'error').length,
    warningCount: issues.filter(i => i.severity === 'warning').length,
    infoCount: issues.filter(i => i.severity === 'info').length
  };
}

/**
 * Get business sections affected by a list of KPIs
 * @param {string[]} kpiIds
 * @param {Object[]} kpiConfig
 * @returns {string[]} Section names
 */
function getAffectedSectionsFromKPIs(kpiIds, kpiConfig) {
  const sections = new Set();
  
  for (const kpiId of kpiIds) {
    const kpi = kpiConfig.find(k => k.id === kpiId.trim());
    if (kpi && kpi.category) {
      sections.add(kpi.category);
    }
    if (kpi && kpi.sections) {
      // sections field contains comma-separated section IDs
      kpi.sections.split(',').forEach(s => sections.add(s.trim()));
    }
  }
  
  return Array.from(sections);
}
```

---

## 7. KPIEngine.gs Updates

### 7.1 Handle New Formula Formats

The new calculated KPIs use different formula formats:

| Old Format | New Format | Example |
|------------|------------|---------|
| `DIVIDE:a:b` | `a/b` | `TotalMarketingSpend/TotalLeadsGenerated` |
| `PERCENTAGE:a:b` | `a/b` (then ×100) | `TotalJobsSold/TotalRunAppointments` |
| `MULTIPLY:a:b` | `a*b` | N/A |

**Problem**: The new formulas use **KPI names** not **KPI IDs**:

```
Formula: TotalMarketingSpend/TotalLeadsGenerated
KPI IDs: MKT_CORE_001 / MKT_CORE_003
```

**Solution Options**:

1. **Option A** (Recommended): Update formulas in Config_KPIs to use KPI IDs
2. **Option B**: Create a name-to-ID mapping function
3. **Option C**: Support both formats

#### Option A: Update Config_KPIs Formulas

This requires a sheet update. Change formulas like:

```
FROM: TotalMarketingSpend/TotalLeadsGenerated
TO:   DIVIDE:MKT_CORE_001:MKT_CORE_003
```

Or simpler:

```
TO: MKT_CORE_001/MKT_CORE_003
```

#### Option B: Name-to-ID Mapping (Code Solution)

```javascript
/**
 * Build mapping of KPI names to IDs
 * @param {Object[]} kpiConfig
 * @returns {Object} {name: id}
 */
function buildNameToIdMap(kpiConfig) {
  const map = {};
  for (const kpi of kpiConfig) {
    // Normalize name (remove spaces, lowercase)
    const normalizedName = kpi.name.replace(/\s+/g, '').toLowerCase();
    map[normalizedName] = kpi.id;
    
    // Also map the original name
    map[kpi.name] = kpi.id;
  }
  return map;
}

/**
 * Convert formula with names to formula with IDs
 * @param {string} formula
 * @param {Object} nameToIdMap
 * @returns {string}
 */
function normalizeFormula(formula, nameToIdMap) {
  let normalized = formula;
  
  // Find potential KPI references (CamelCase words)
  const namePattern = /[A-Z][A-Za-z]+(?:[A-Z][A-Za-z]+)*/g;
  const matches = formula.match(namePattern) || [];
  
  for (const match of matches) {
    const id = nameToIdMap[match] || nameToIdMap[match.toLowerCase()];
    if (id) {
      normalized = normalized.replace(match, id);
    }
  }
  
  return normalized;
}
```

### 7.2 Handle Type Inconsistency

```javascript
/**
 * Check if KPI is calculated type
 * @param {Object} kpi
 * @returns {boolean}
 */
function isCalculatedKPI(kpi) {
  const type = (kpi.type || '').toLowerCase();
  return type === 'calculated' || type === 'calculation';
}

/**
 * Get all calculated KPIs
 * @param {Object[]} kpiConfig
 * @returns {Object[]}
 */
function getCalculatedKPIs(kpiConfig) {
  return kpiConfig.filter(k => isCalculatedKPI(k));
}
```

---

## 8. ResultsGenerator.gs Updates

### 8.1 Add Tool Recommendations Column

Update the Results sheet generation to include tool recommendations:

```javascript
/**
 * Generate results row for a KPI
 * @param {Object} kpi - KPI definition
 * @param {*} value - Calculated or input value
 * @param {string} status - Validation status
 * @param {string} notes - Validation notes
 * @returns {Array} Row data
 */
function generateResultRow(kpi, value, status, notes) {
  return [
    kpi.name,
    formatValueForDisplay(value, kpi.dataType),
    kpi.type === 'input' ? 'Input' : 'Calculated',
    status,  // ✓, ⚠, ✗, or —
    kpi.category || '',
    notes,
    // NEW COLUMNS
    kpi.toolCategory || '',
    kpi.recommendedTool || '',
    kpi.toolNotes || ''
  ];
}

/**
 * Get Results sheet headers
 * @returns {string[]}
 */
function getResultsHeaders() {
  return [
    'KPI Name',
    'Value',
    'Type',
    'Status',
    'Section',
    'Notes',
    // NEW COLUMNS
    'Tool Category',
    'Recommended Tool',
    'Tool Notes'
  ];
}
```

### 8.2 Add Tool Summary Section

Add a summary section at the bottom of results:

```javascript
/**
 * Generate tool recommendations summary
 * @param {Object[]} kpiResults - KPIs with issues
 * @param {Object[]} kpiConfig
 * @returns {Object[]} Summary rows
 */
function generateToolSummary(kpiResults, kpiConfig) {
  const recommendations = [];
  
  // Group by tool category
  const byCategory = {
    out_of_box: [],
    build_internal: [],
    hybrid: []
  };
  
  for (const result of kpiResults) {
    if (result.status === 'concern' || result.status === 'warning') {
      const kpi = kpiConfig.find(k => k.id === result.kpiId);
      if (kpi && kpi.toolCategory && kpi.recommendedTool) {
        byCategory[kpi.toolCategory]?.push({
          kpi: kpi.name,
          tool: kpi.recommendedTool,
          notes: kpi.toolNotes
        });
      }
    }
  }
  
  return byCategory;
}
```

### 8.3 Update Results Sheet Layout

```
Row 1: Header - "OPERATIONAL KPI ANALYSIS"
Row 2: Client info
Row 3: Timestamp
Row 4: Overall status
Row 5: Blank
Row 6-N: KPI Results by section
Row N+1: Blank
Row N+2: "VALIDATION ISSUES"
Row N+3-M: Validation log
Row M+1: Blank
Row M+2: "TOOL RECOMMENDATIONS"  <-- NEW
Row M+3+: Tool recommendations grouped by category  <-- NEW
```

---

## 9. Config.gs Updates

### 9.1 Update getKPIConfig() to Load New Columns

```javascript
/**
 * Load KPI configuration from Config_KPIs sheet
 * @returns {Object[]} Array of KPI definition objects
 */
function getKPIConfig() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CONFIG_KPIS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const kpis = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[getColIndex(headers, 'kpi_id')]) continue; // Skip empty rows
    
    kpis.push({
      id: row[getColIndex(headers, 'kpi_id')],
      name: row[getColIndex(headers, 'name')],
      description: row[getColIndex(headers, 'description')],
      category: row[getColIndex(headers, 'category')],
      type: row[getColIndex(headers, 'type')],
      dataType: row[getColIndex(headers, 'data_type')],
      formula: row[getColIndex(headers, 'formula')],
      sections: row[getColIndex(headers, 'sections')],
      pillar: row[getColIndex(headers, 'pillar')],
      required: row[getColIndex(headers, 'required')] === true || row[getColIndex(headers, 'required')] === 1,
      formOrder: row[getColIndex(headers, 'form_order')],  // DEPRECATED
      active: row[getColIndex(headers, 'active')] !== false && row[getColIndex(headers, 'active')] !== 0,
      // NEW COLUMNS
      formTier: row[getColIndex(headers, 'form_tier')],
      tierOrder: row[getColIndex(headers, 'tier_order')],
      tierReason: row[getColIndex(headers, 'tier_reason')],
      toolCategory: row[getColIndex(headers, 'tool_category')],
      recommendedTool: row[getColIndex(headers, 'recommended_tool')],
      toolNotes: row[getColIndex(headers, 'tool_notes')],
      importance: row[getColIndex(headers, 'Importance')]
    });
  }
  
  return kpis;
}

/**
 * Get column index by header name (case-insensitive)
 * @param {string[]} headers
 * @param {string} columnName
 * @returns {number} Column index or -1
 */
function getColIndex(headers, columnName) {
  const lowerName = columnName.toLowerCase();
  return headers.findIndex(h => (h || '').toString().toLowerCase() === lowerName);
}
```

### 9.2 Update getValidationConfig() for New Columns

```javascript
/**
 * Load validation configuration
 * @returns {Object[]}
 */
function getValidationConfig() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CONFIG_VALIDATIONS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const rules = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const ruleId = row[getColIndex(headers, 'rule_id')];
    if (!ruleId) continue;
    
    rules.push({
      ruleId: ruleId,
      name: row[getColIndex(headers, 'name')],
      description: row[getColIndex(headers, 'description')],
      type: row[getColIndex(headers, 'type')],
      formula: row[getColIndex(headers, 'formula')],
      tolerance: parseFloat(row[getColIndex(headers, 'tolerance')]) || 0,
      severity: row[getColIndex(headers, 'severity')] || 'warning',
      message: row[getColIndex(headers, 'message')],
      affectedKPIs: row[getColIndex(headers, 'affected_kpis')],
      active: row[getColIndex(headers, 'active')] !== false && row[getColIndex(headers, 'active')] !== 'FALSE',
      suggestedAction: row[getColIndex(headers, 'suggested_action')] // If this column exists
    });
  }
  
  return rules;
}
```

---

## 10. InsightsEngine.gs Updates

### 10.1 Add Section-Based Insights

```javascript
/**
 * Generate section-specific insights
 * @param {Object} allValues
 * @param {Object[]} kpiConfig
 * @param {Object[]} validationIssues
 * @returns {Object[]} Section insights
 */
function generateSectionInsights(allValues, kpiConfig, validationIssues) {
  const sectionInsights = [];
  
  const sections = [
    'Marketing', 'CSR/Call Center', 'Sales', 'Field Operations',
    'Scheduling/Dispatch', 'Inventory/Warehouse', 'Finance/Accounting', 'HR/Training'
  ];
  
  for (const section of sections) {
    const sectionKPIs = kpiConfig.filter(k => k.category === section);
    const sectionIssues = validationIssues.filter(i => 
      i.affectedSections && i.affectedSections.includes(section)
    );
    
    if (sectionIssues.length > 0) {
      const errorCount = sectionIssues.filter(i => i.severity === 'error').length;
      const warningCount = sectionIssues.filter(i => i.severity === 'warning').length;
      
      sectionInsights.push({
        section: section,
        status: errorCount > 0 ? 'concern' : (warningCount > 0 ? 'attention' : 'good'),
        issueCount: sectionIssues.length,
        errorCount: errorCount,
        warningCount: warningCount,
        summary: generateSectionSummary(section, sectionIssues, allValues, kpiConfig),
        recommendations: generateSectionRecommendations(section, sectionIssues, kpiConfig)
      });
    }
  }
  
  return sectionInsights;
}

/**
 * Generate recommendations for a section including tool suggestions
 * @param {string} section
 * @param {Object[]} issues
 * @param {Object[]} kpiConfig
 * @returns {string[]}
 */
function generateSectionRecommendations(section, issues, kpiConfig) {
  const recommendations = [];
  const toolsSuggested = new Set();
  
  for (const issue of issues) {
    // Add issue-specific recommendation
    if (issue.suggestedAction) {
      recommendations.push(issue.suggestedAction);
    }
    
    // Add tool recommendations
    for (const kpiId of issue.affectedKPIs || []) {
      const kpi = kpiConfig.find(k => k.id === kpiId.trim());
      if (kpi && kpi.recommendedTool && !toolsSuggested.has(kpi.recommendedTool)) {
        toolsSuggested.add(kpi.recommendedTool);
        recommendations.push(`Consider: ${kpi.recommendedTool} (${kpi.toolCategory})`);
      }
    }
  }
  
  return recommendations;
}
```

---

## 11. UI Updates

### 11.1 Update Sidebar to Show Section Health

Update `Sidebar.html` to display section-by-section status:

```html
<!-- Add to Sidebar.html -->
<div id="sectionHealth">
  <h4>Section Health</h4>
  <div id="sectionList"></div>
</div>

<script>
function updateSectionHealth(sections) {
  const container = document.getElementById('sectionList');
  container.innerHTML = '';
  
  for (const section of sections) {
    const statusIcon = section.status === 'concern' ? '🔴' : 
                       section.status === 'attention' ? '🟡' : '🟢';
    
    const div = document.createElement('div');
    div.className = 'section-item';
    div.innerHTML = `
      <span class="status-icon">${statusIcon}</span>
      <span class="section-name">${section.section}</span>
      <span class="issue-count">${section.issueCount} issues</span>
    `;
    container.appendChild(div);
  }
}
</script>
```

### 11.2 Add Form Tier Selector Dialog

Create new HTML file `FormTierSelector.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    .tier-option { 
      padding: 15px; 
      margin: 10px 0; 
      border: 1px solid #ddd; 
      border-radius: 8px;
      cursor: pointer;
    }
    .tier-option:hover { background: #f5f5f5; }
    .tier-option.selected { border-color: #4285f4; background: #e8f0fe; }
    .tier-name { font-weight: bold; font-size: 16px; }
    .tier-desc { color: #666; margin-top: 5px; }
    .tier-count { color: #1a73e8; font-size: 14px; }
    .buttons { margin-top: 20px; text-align: right; }
    button { padding: 10px 20px; margin-left: 10px; }
    .primary { background: #4285f4; color: white; border: none; border-radius: 4px; }
  </style>
</head>
<body>
  <h3>Select Form Type</h3>
  
  <div class="tier-option" data-tier="onboarding" onclick="selectTier(this)">
    <div class="tier-name">Quick Assessment</div>
    <div class="tier-count">35 questions • 5-10 minutes</div>
    <div class="tier-desc">Essential metrics for initial client intake</div>
  </div>
  
  <div class="tier-option" data-tier="detailed" onclick="selectTier(this)">
    <div class="tier-name">Comprehensive Diagnostic</div>
    <div class="tier-count">63 questions • 15-20 minutes</div>
    <div class="tier-desc">Full assessment for engaged clients</div>
  </div>
  
  <div class="tier-option" data-tier="all" onclick="selectTier(this)">
    <div class="tier-name">Full Deep Dive</div>
    <div class="tier-count">96 questions • 30+ minutes</div>
    <div class="tier-desc">Complete diagnostic across all sections</div>
  </div>
  
  <div class="buttons">
    <button onclick="google.script.host.close()">Cancel</button>
    <button class="primary" onclick="createForm()">Create Form</button>
  </div>
  
  <script>
    let selectedTier = 'onboarding';
    
    function selectTier(element) {
      document.querySelectorAll('.tier-option').forEach(el => el.classList.remove('selected'));
      element.classList.add('selected');
      selectedTier = element.dataset.tier;
    }
    
    function createForm() {
      google.script.run
        .withSuccessHandler(() => google.script.host.close())
        .createTieredForm(selectedTier);
    }
    
    // Select first option by default
    document.querySelector('.tier-option').classList.add('selected');
  </script>
</body>
</html>
```

---

## 12. New Settings Required

Add to `_Settings` sheet:

| Key | Value | Description |
|-----|-------|-------------|
| `form_tier` | onboarding | Current form tier |
| `last_form_tier` | onboarding | Tier of last created form |
| `show_tool_recommendations` | TRUE | Include tools in results |
| `enable_section_insights` | TRUE | Generate section-specific insights |

Add to settings keys constant:

```javascript
const SETTINGS_KEYS = {
  // ... existing keys ...
  FORM_TIER: 'form_tier',
  LAST_FORM_TIER: 'last_form_tier',
  SHOW_TOOL_RECOMMENDATIONS: 'show_tool_recommendations',
  ENABLE_SECTION_INSIGHTS: 'enable_section_insights'
};
```

---

## 13. Testing Checklist

### Configuration Loading

- [ ] `getKPIConfig()` loads all 189 KPIs
- [ ] `getKPIConfig()` loads new columns (formTier, tierOrder, toolCategory, etc.)
- [ ] `getValidationConfig()` loads all 86 validation rules
- [ ] `getInputKPIs()` returns 96 input KPIs
- [ ] `getInputKPIs('onboarding')` returns 35 KPIs
- [ ] `getCalculatedKPIs()` handles both "calculated" and "Calculation" types

### Form Generation

- [ ] Onboarding form creates with 35 questions
- [ ] Detailed form creates with 63 questions
- [ ] Full form creates with 96 questions
- [ ] Questions are grouped by section
- [ ] Questions are ordered by `tier_order`
- [ ] Form submit triggers `onFormSubmit`

### Validation Engine

- [ ] RECONCILE with `+` operator works: `RECONCILE:CSR_CORE_003+CSR_CORE_004:CSR_CORE_001`
- [ ] RECONCILE with `*` operator works: `RECONCILE:SAL_CORE_003*SAL_DER_002:SAL_CORE_004`
- [ ] RANGE with negative min works: `RANGE:FIN_DER_002:-50:50`
- [ ] GREATER validation works
- [ ] REQUIRES validation works
- [ ] All 86 rules execute without error
- [ ] Affected sections are correctly identified

### KPI Calculation

- [ ] Original formula format works: `DIVIDE:a:b`
- [ ] New formula format works: `a/b` (if keeping this format)
- [ ] All 90 calculated KPIs compute correctly
- [ ] Missing dependencies return null (not error)

### Results Output

- [ ] Results sheet includes tool recommendation columns
- [ ] Validation issues show affected sections
- [ ] Section insights generate correctly
- [ ] Tool summary section appears at bottom

### Edge Cases

- [ ] Empty form submission handled gracefully
- [ ] Partial data (some sections blank) works
- [ ] All validation types handle missing values
- [ ] Division by zero handled

---

## 14. Migration Steps

### Step 1: Backup

1. Make a copy of the existing Google Sheet
2. Export Apps Script files to backup location

### Step 2: Update Config Sheets

1. Ensure Config_KPIs has all new columns populated
2. Ensure Config_Validations has all 86 rules
3. Normalize `type` column values (optional but recommended)

### Step 3: Update Code Files

Update in this order:

1. **Utils.gs** — Add new helper functions
2. **Config.gs** — Update config loading for new columns
3. **ValidationEngine.gs** — Add expression evaluation, update RECONCILE
4. **KPIEngine.gs** — Handle formula variations, type normalization
5. **FormManager.gs** — Add tiered form creation
6. **ResultsGenerator.gs** — Add tool columns, section grouping
7. **InsightsEngine.gs** — Add section insights, tool recommendations
8. **UI.gs** — Add form tier selector
9. **Main.gs** — Update menu structure

### Step 4: Test

1. Run analysis on existing client data
2. Verify all validations execute
3. Create onboarding form, test submission
4. Verify results include new columns

### Step 5: Deploy

1. Sync form with new config
2. Notify users of new form options
3. Document new features

---

## Appendix: Quick Reference

### KPI ID Patterns

| Pattern | Section | Example |
|---------|---------|---------|
| (no prefix) | Core/Volume/Efficiency | `total_leads`, `booking_rate` |
| `MKT_CORE_###` | Marketing Input | `MKT_CORE_001` |
| `MKT_DER_###` | Marketing Calculated | `MKT_DER_001` |
| `CSR_CORE_###` | CSR Input | `CSR_CORE_001` |
| `CSR_DER_###` | CSR Calculated | `CSR_DER_001` |
| `SAL_CORE_###` | Sales Input | `SAL_CORE_001` |
| `SAL_DER_###` | Sales Calculated | `SAL_DER_001` |
| `FLD_CORE_###` | Field Ops Input | `FLD_CORE_001` |
| `FLD_DER_###` | Field Ops Calculated | `FLD_DER_001` |
| `SCH_CORE_###` | Scheduling Input | `SCH_CORE_001` |
| `SCH_DER_###` | Scheduling Calculated | `SCH_DER_001` |
| `INV_CORE_###` | Inventory Input | `INV_CORE_001` |
| `INV_DER_###` | Inventory Calculated | `INV_DER_001` |
| `FIN_CORE_###` | Finance Input | `FIN_CORE_001` |
| `FIN_DER_###` | Finance Calculated | `FIN_DER_001` |
| `HR_CORE_###` | HR Input | `HR_CORE_001` |
| `HR_DER_###` | HR Calculated | `HR_DER_001` |

### Validation Rule ID Patterns

| Prefix | Section |
|--------|---------|
| `mkt_` | Marketing |
| `csr_` | CSR/Call Center |
| `sal_` | Sales |
| `fld_` | Field Operations |
| `sch_` | Scheduling |
| `inv_` | Inventory |
| `fin_` | Finance |
| `hr_` | HR/Training |
| `ratio_` | Health Ratios |

---

*End of Backend Update Specification*
