# KPI Calculator System — Enhancement & Bug Fix Specifications

**Document Version**: 2.0
**Date**: November 26, 2025
**Author**: ShopFloor Solutions (System Audit)
**For**: Lead Developer

---

## Table of Contents

1. [Critical Bugs](#critical-bugs)
2. [High Priority Issues](#high-priority-issues)
3. [Medium Priority Issues](#medium-priority-issues)
4. [Low Priority Issues](#low-priority-issues)
5. [Implementation Priority Matrix](#implementation-priority-matrix)
6. [Testing Checklist](#testing-checklist)

---

## Critical Bugs

### Bug #1: UI.gs — Recursive Function Name Shadowing (BREAKS FUNCTIONALITY)

**File**: `UI.gs`
**Function**: `handleClientSelection()`
**Severity**: 🔴 **CRITICAL** — Function will fail silently

**Problem**:
```javascript
// Current code (lines ~230-240 in UI.gs)
function handleClientSelection(clientId, runAnalysis) {
  try {
    setActiveClient(clientId);

    if (runAnalysis) {
      runAnalysis();  // ❌ BUG: This calls the boolean parameter, not the function!
    }

    return { success: true };

  } catch (error) {
    logError('Error handling client selection', error);
    return { success: false, error: error.message };
  }
}
```

The parameter `runAnalysis` shadows the global function `runAnalysis()`. When `runAnalysis` is `true`, the code tries to call `true()` which will throw a TypeError.

**Fix**:
```javascript
function handleClientSelection(clientId, shouldRunAnalysis) {  // Renamed parameter
  try {
    setActiveClient(clientId);

    if (shouldRunAnalysis) {
      runAnalysis();  // ✓ Now correctly calls the global function
    }

    return { success: true };

  } catch (error) {
    logError('Error handling client selection', error);
    return { success: false, error: error.message };
  }
}
```

---

### Bug #2: ValidationEngine.gs — Incorrect REQUIRES Logic

**File**: `ValidationEngine.gs`
**Function**: `executeRequires()`
**Severity**: 🔴 **CRITICAL** — Produces false validation errors

**Problem**:
```javascript
// Current code includes this secondary check:
if (dependent > parent) {
  return {
    passed: false,
    actual: dependent,
    expected: `≤ ${parent}`,
    variance: (dependent - parent) / parent
  };
}
```

This logic is **WRONG** for trade businesses:
- `in_home_visits` CAN exceed `total_leads` (walk-ins, referrals, repeat visits)
- `jobs_closed` CAN exceed `in_home_visits` (phone sales, maintenance contracts)

**Fix**:
Remove the secondary check entirely. The REQUIRES validation should ONLY check:
- "If A exists, B must exist" (dependency check)
- NOT "A must be ≤ B" (that's a different validation type)

```javascript
function executeRequires(formula, values) {
  const parts = formula.split(':');

  if (parts.length < 3) {
    return { passed: true };
  }

  const dependentId = parts[1];
  const parentId = parts[2];
  const dependent = values[dependentId];
  const parent = values[parentId];

  // Rule: if dependent has a value, parent must also have a value
  if (isEmpty(dependent)) {
    return { passed: true }; // No dependent value, nothing to check
  }

  if (isEmpty(parent)) {
    return {
      passed: false,
      actual: dependent,
      expected: `${parentId} required`,
      variance: null
    };
  }

  // ✓ REMOVED the incorrect "dependent > parent" check
  return { passed: true };
}
```

---

### Bug #3: Validation Formulas Reference Wrong KPIs

**File**: `Config_Validations` sheet
**Severity**: 🔴 **CRITICAL** — Reconciliation checks will always pass or fail incorrectly

**Problem**:
The validation formulas reference CALCULATED KPIs instead of INPUT KPIs:

| Rule | Current Formula | Problem |
|------|-----------------|---------|
| `booking_rate_reconcile` | `RECONCILE:total_leads*booking_rate/100:in_home_visits` | Uses calculated `booking_rate`, not input `reported_booking_rate` |
| `close_rate_reconcile` | `RECONCILE:in_home_visits*close_rate/100:jobs_closed` | Uses calculated `close_rate`, not input `reported_close_rate` |

The purpose of these validations is to check if the CLIENT'S REPORTED rate matches reality. Using the calculated rate creates circular logic.

**Fix**: Update `Config_Validations` sheet:

| rule_id | Corrected formula |
|---------|------------------|
| `booking_rate_reconcile` | `RECONCILE:total_leads*reported_booking_rate/100:in_home_visits` |
| `close_rate_reconcile` | `RECONCILE:in_home_visits*reported_close_rate/100:jobs_closed` |

Also update `affected_kpis` column:
- `booking_rate_reconcile`: `total_leads,reported_booking_rate,in_home_visits`
- `close_rate_reconcile`: `in_home_visits,reported_close_rate,jobs_closed`

---

## High Priority Issues

### Issue #1: Duplicate Function Definition — `getSectionNames()`

**Files**: `Config.gs` (line ~108) and `ResultsGenerator.gs` (line ~282)
**Severity**: 🟠 **HIGH** — Will cause unpredictable behavior

**Problem**:
Both files define `getSectionNames()` with DIFFERENT signatures:

```javascript
// Config.gs version
function getSectionNames(sectionIds) {  // Takes array of section IDs
  // Returns comma-separated names
}

// ResultsGenerator.gs version
function getSectionNamesForKPI(kpi, sectionConfig) {  // Takes KPI object and config
  // Returns comma-separated names
}
```

In Google Apps Script, all functions share global scope. The function that loads last will overwrite the first, causing unpredictable behavior depending on execution order.

**Fix Options**:

**Option A (Recommended)**: Rename for clarity
```javascript
// Config.gs - already correct name
function getSectionNames(sectionIds) { ... }

// ResultsGenerator.gs - rename (already done, but verify usage)
function getSectionNamesForKPI(kpi, sectionConfig) { ... }
```

**Option B**: Consolidate into single function in Utils.gs with flexible signature.

---

### Issue #2: Missing Setting — `form_responses_sheet`

**File**: `Utils.gs` — `initializeSettings()` and `Triggers.gs` — `diagnoseFormIntegration()`
**Severity**: 🟠 **HIGH** — Diagnostic function will fail

**Problem**:
```javascript
// In Triggers.gs diagnoseFormIntegration():
const formResponsesSheetName = getSetting('form_responses_sheet');  // ❌ Never set!
```

But in `initializeSettings()`, this setting is NOT included:
```javascript
const settings = [
  [SETTINGS_KEYS.ACTIVE_CLIENT_ID, ''],
  [SETTINGS_KEYS.FORM_ID, ''],
  // ... 'form_responses_sheet' is MISSING
];
```

**Fix**: Add to `SETTINGS_KEYS` constant and initialization:

```javascript
// In Utils.gs, add to SETTINGS_KEYS:
const SETTINGS_KEYS = {
  // ... existing keys
  FORM_RESPONSES_SHEET: 'form_responses_sheet'  // NEW
};

// In Config.gs initializeSettings(), add:
const settings = [
  // ... existing settings
  [SETTINGS_KEYS.FORM_RESPONSES_SHEET, 'Form Responses 1']  // NEW - default value
];
```

---

### Issue #3: `processNewSubmission()` Event Handling Mismatch

**File**: `ClientManager.gs`
**Severity**: 🟠 **HIGH** — Form submissions not processed correctly

**Problem**:
The `processNewSubmission(e)` function receives the form submit event but doesn't use it. Instead, it tries to find the last row in the Clients sheet:

```javascript
function processNewSubmission(e) {
  try {
    const sheet = getRequiredSheet(SHEET_NAMES.CLIENTS);
    const lastRow = sheet.getLastRow();  // ❌ Looks in Clients, but form writes to "Form Responses 1"
    // ...
  }
}
```

Form responses go to "Form Responses 1" sheet, NOT the Clients sheet. The code never reads from the correct sheet.

**Fix**: This is documented in Enhancement #3 (Form Response Integration Fix). The fix involves:
1. Reading from the Form Responses sheet
2. Transforming headers from Title Case to snake_case
3. Writing to the Clients sheet with proper mapping

---

### Issue #4: Silent Failures When Optional KPIs Missing

**File**: `KPIEngine.gs`
**Severity**: 🟠 **HIGH** — Cascading calculation failures with no feedback

**Problem**:
When `hours_per_day` is not provided (it's optional: `required: false`):
1. `calculateScheduleCapacity()` silently defaults to 8
2. If `num_techs` is also missing, `schedule_capacity` returns `null`
3. This causes `schedule_efficiency` to also be `null`
4. User sees "N/A" but doesn't know WHY

**Current code**:
```javascript
function calculateScheduleCapacity(values, periodDays) {
  const numTechs = values.num_techs;
  if (isEmpty(numTechs) || numTechs <= 0) {
    return null;  // Silent failure - user doesn't know why
  }
  const hoursPerDay = values.hours_per_day || 8;  // Silent default
  // ...
}
```

**Fix**: Add tracking for "why null" and surface in Results:

```javascript
// In KPIEngine.gs, create a calculation context
function calculateAllKPIs(clientData, kpiConfig) {
  const calculatedKPIs = kpiConfig.filter(k => k.type === 'calculated');
  const periodDays = clientData.periodDays || 30;

  const allValues = clone(clientData.rawInputs);
  const calculationNotes = {};  // NEW: Track why calculations failed/defaulted

  const sortedKPIs = sortByDependencyOrder(calculatedKPIs, kpiConfig);

  for (const kpiDef of sortedKPIs) {
    try {
      const result = calculateKPIWithNotes(kpiDef, allValues, periodDays);
      allValues[kpiDef.id] = result.value;
      if (result.note) {
        calculationNotes[kpiDef.id] = result.note;
      }
    } catch (error) {
      logError(`Error calculating ${kpiDef.id}`, error);
      allValues[kpiDef.id] = null;
      calculationNotes[kpiDef.id] = `Error: ${error.message}`;
    }
  }

  return {
    values: allValues,
    notes: calculationNotes  // Surface this in Results sheet
  };
}
```

---

## Medium Priority Issues

### Issue #5: `sheetToObjects()` Duplicate Header Handling

**File**: `Utils.gs`
**Severity**: 🟡 **MEDIUM** — Data corruption if headers duplicated

**Problem**:
```javascript
function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim().toLowerCase());
  // If headers = ['name', 'value', 'name'], the second 'name' column is silently lost
  // ...
}
```

**Fix**:
```javascript
function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0].map(h => String(h).trim().toLowerCase());

  // NEW: Check for duplicates
  const headerCount = {};
  const uniqueHeaders = headers.map((h, idx) => {
    if (!h) return `column_${idx}`;  // Handle empty headers
    if (headerCount[h]) {
      headerCount[h]++;
      log(`Warning: Duplicate header "${h}" found, renaming to "${h}_${headerCount[h]}"`);
      return `${h}_${headerCount[h]}`;
    }
    headerCount[h] = 1;
    return h;
  });

  const objects = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const obj = {};
    for (let j = 0; j < uniqueHeaders.length; j++) {
      obj[uniqueHeaders[j]] = row[j];
    }
    objects.push(obj);
  }

  return objects;
}
```

---

### Issue #6: Benchmark Lookup Missing State Parameter

**File**: `InsightsEngine.gs`
**Severity**: 🟡 **MEDIUM** — Regional benchmarks not utilized

**Problem**:
Even though the system collects client `state`, it's not passed to benchmark lookup:

```javascript
// Current code in generateInsights():
function generateInsights(clientData, allValues, validationIssues, kpiConfig, sectionConfig) {
  const benchmarks = loadBenchmarksForInsights(clientData.industry);  // ❌ Missing state!
  // ...
}

// And loadBenchmarksForInsights only takes industry:
function loadBenchmarksForInsights(industry) {  // ❌ No state parameter
  // ...
}
```

**Fix**: This is documented in Enhancement #1. Update to:
```javascript
const benchmarks = loadBenchmarksForInsights(clientData.industry, clientData.state);
```

---

### Issue #7: Config_Sections Sheet Has 1000 Empty Rows

**File**: Config_Sections sheet (exported Excel)
**Severity**: 🟡 **MEDIUM** — Performance impact, confusing export

**Problem**:
The Excel export shows `Config_Sections` with 1000 rows but only 10 have data. This is likely because:
1. Sheet was initialized with extra rows
2. Or formatting was applied beyond data range

**Fix**:
In `initializeSectionConfig()`, after writing data, clear any rows beyond the data:
```javascript
function initializeSectionConfig() {
  const sheet = getOrCreateSheet(SHEET_NAMES.CONFIG_SECTIONS);
  // ... write data ...

  // Clear any rows beyond our data
  const dataRowCount = sampleData.length + 1; // +1 for header
  const lastRow = sheet.getMaxRows();
  if (lastRow > dataRowCount) {
    sheet.deleteRows(dataRowCount + 1, lastRow - dataRowCount);
  }
}
```

---

### Issue #8: InsightsEngine Default Benchmarks Mismatch

**File**: `InsightsEngine.gs`
**Severity**: 🟡 **MEDIUM** — Inconsistent benchmark sources

**Problem**:
`InsightsEngine.gs` has its own `DEFAULT_BENCHMARKS` constant that may diverge from `Config_Benchmarks` sheet:

```javascript
// In InsightsEngine.gs:
const DEFAULT_BENCHMARKS = {
  booking_rate: { poor: 30, average: 50, good: 70, excellent: 85 },
  // ...
};

// In Config_Benchmarks sheet (and getDefaultBenchmarks() in Config.gs):
// booking_rate: poor=30, average=50, good=70, excellent=85
```

If someone updates one but not the other, benchmarks become inconsistent.

**Fix**: Remove `DEFAULT_BENCHMARKS` from InsightsEngine.gs and always call `getDefaultBenchmarks()` from Config.gs:

```javascript
// In InsightsEngine.gs, replace:
// const DEFAULT_BENCHMARKS = { ... };

// With:
function getDefaultBenchmarksForInsights() {
  return getDefaultBenchmarks().reduce((acc, b) => {
    acc[b.kpiId] = {
      poor: b.poor,
      average: b.average,
      good: b.good,
      excellent: b.excellent
    };
    return acc;
  }, {});
}
```

---

## Low Priority Issues

### Issue #9: Hardcoded Email in Multiple Places

**Files**: `Triggers.gs`, `README.md`
**Severity**: 🟢 **LOW** — Maintenance burden

**Problem**:
The email `info@shopfloorsolutions.ca` appears:
1. As default in `initializeSettings()`
2. In `README.md` documentation

If email changes, must update multiple places.

**Fix**: Only store in `_Settings` sheet. Update README to say "configured in Settings" instead of hardcoding.

---

### Issue #10: No Input Validation on KPI Values

**File**: `FormManager.gs`
**Severity**: 🟢 **LOW** — Poor data quality possible

**Problem**:
The form accepts any numeric input, including:
- Negative leads (-50)
- Impossible percentages (500%)
- Zero values for required denominators

While validations catch some issues post-submission, preventing bad data at entry is better.

**Fix**: Add Google Forms validation where possible:
```javascript
function createFormQuestion(form, kpi) {
  const item = form.addTextItem()
    .setTitle(kpi.name)
    .setRequired(kpi.required)
    .setHelpText(kpi.description);

  // Enhanced validation based on data type
  switch (kpi.dataType) {
    case DATA_TYPES.INTEGER:
      item.setValidation(FormApp.createTextValidation()
        .setHelpText('Please enter a whole number (0 or greater)')
        .requireNumberGreaterThanOrEqualTo(0)  // Prevent negatives
        .build());
      break;

    case DATA_TYPES.PERCENTAGE:
      item.setValidation(FormApp.createTextValidation()
        .setHelpText('Please enter a percentage between 0 and 100')
        .requireNumberBetween(0, 100)
        .build());
      break;
    // ...
  }
}
```

---

### Issue #11: ResultsGenerator Color Constants Not Configurable

**File**: `ResultsGenerator.gs`
**Severity**: 🟢 **LOW** — Hardcoded branding

**Problem**:
```javascript
const COLORS = {
  PILLAR_1: '#e8f5e9', // Light green
  PILLAR_2: '#e3f2fd', // Light blue
  PILLAR_3: '#fff3e0', // Light orange
  // ...
};
```

If ShopFloor Solutions wants to change branding colors, must modify code.

**Fix**: Move to `_Settings` sheet or a new `Config_Branding` sheet (low priority, nice-to-have).

---

### Issue #12: Missing JSDoc in Several Functions

**Files**: Various
**Severity**: 🟢 **LOW** — Maintainability

**Problem**:
Some helper functions lack proper JSDoc comments:
- `merge()` in Utils.gs
- `clone()` in Utils.gs
- Several internal functions

**Fix**: Add JSDoc to all public and important private functions.

---

## Summary: Issue Count by Severity

| Severity | Count | Must Fix Before Launch? |
|----------|-------|------------------------|
| 🔴 Critical | 3 | YES |
| 🟠 High | 4 | YES |
| 🟡 Medium | 4 | Recommended |
| 🟢 Low | 4 | Nice-to-have |

---

## Enhancement #1: State/Province Benchmarking Support

*(Content unchanged from v1.0 — see original document)*

---

## Enhancement #2: Config Management UI Dialogs

*(Content unchanged from v1.0 — see original document)*

---

## Enhancement #3: Form Response Integration Fix

*(Content unchanged from v1.0 — see original document)*

---

## Implementation Priority Matrix

### Phase 1: Critical Fixes (Do Immediately)

| Item | Type | Est. Time | Risk if Skipped |
|------|------|-----------|-----------------|
| Bug #1: UI.gs function shadowing | Bug Fix | 15 min | App crashes on client selection |
| Bug #2: REQUIRES validation logic | Bug Fix | 30 min | False errors shown to users |
| Bug #3: Validation formula KPIs | Config Fix | 15 min | Reconciliation checks meaningless |
| Enhancement #3: Form Integration | Enhancement | 2-3 hrs | No data flows from form to analysis |

### Phase 2: High Priority (Before Client Use)

| Item | Type | Est. Time | Risk if Skipped |
|------|------|-----------|-----------------|
| Issue #1: Duplicate function names | Code Fix | 30 min | Unpredictable behavior |
| Issue #2: Missing setting | Code Fix | 15 min | Diagnostic function fails |
| Issue #3: processNewSubmission | Covered by Enh #3 | — | — |
| Issue #4: Silent calculation failures | Enhancement | 1-2 hrs | Users confused by N/A values |

### Phase 3: Medium Priority (Before Scale)

| Item | Type | Est. Time | Risk if Skipped |
|------|------|-----------|-----------------|
| Issue #5: Duplicate header handling | Code Fix | 30 min | Data corruption edge case |
| Issue #6: Benchmark state param | Covered by Enh #1 | — | — |
| Issue #7: Empty rows in Config_Sections | Code Fix | 15 min | Performance, confusing exports |
| Issue #8: Default benchmarks sync | Code Fix | 30 min | Inconsistent benchmark values |
| Enhancement #1: State benchmarks | Enhancement | 2-3 hrs | Regional variations ignored |

### Phase 4: Polish (As Time Allows)

| Item | Type | Est. Time | Risk if Skipped |
|------|------|-----------|-----------------|
| Issue #9: Hardcoded email | Cleanup | 15 min | Maintenance burden |
| Issue #10: Input validation | Enhancement | 1 hr | Bad data entry |
| Issue #11: Color constants | Enhancement | 30 min | Hardcoded branding |
| Issue #12: JSDoc comments | Documentation | 1-2 hrs | Maintainability |
| Enhancement #2: Config UI | Enhancement | 6-8 hrs | Partners need dev help for config |

---

## Testing Checklist

### Critical Bug Fixes

- [ ] **Bug #1**: Create client selector, confirm "Select & Analyze" works without error
- [ ] **Bug #2**: Submit form with `in_home_visits > total_leads`, confirm no false REQUIRES error
- [ ] **Bug #3**: Submit form with known booking rate, confirm reconciliation uses `reported_booking_rate`

### Form Integration (Enhancement #3)

- [ ] Submit form with test data
- [ ] Verify "Form Responses 1" sheet receives data
- [ ] Verify `onFormSubmit` trigger fires
- [ ] Verify data is transformed and written to `Clients` sheet
- [ ] Verify `client_id` is auto-generated
- [ ] Verify `period_days` is calculated from `data_period`
- [ ] Verify auto-analyze runs (if enabled)
- [ ] Run manual analysis, verify Results sheet populated
- [ ] Verify Validation_Log shows correct issues

### Calculation Engine

- [ ] Submit form with all KPIs populated
- [ ] Verify all calculated KPIs have values (not N/A)
- [ ] Submit form with only required KPIs
- [ ] Verify optional calculated KPIs show N/A appropriately
- [ ] Verify calculation notes explain WHY values are N/A

### Validation Engine

- [ ] Submit form with intentionally mismatched data
- [ ] Verify correct validation errors appear
- [ ] Verify tolerance is respected (10% variance should pass)
- [ ] Verify severity levels correct (error vs warning vs info)

### Insights Engine

- [ ] Run analysis on good data, verify positive insights
- [ ] Run analysis on poor data, verify concern insights
- [ ] Verify section mapping in insights
- [ ] Verify recommendations are actionable

---

## Appendix: Quick Reference — Files Modified

| File | Bugs Fixed | Issues Addressed | Enhancements |
|------|------------|------------------|--------------|
| `UI.gs` | #1 | — | — |
| `ValidationEngine.gs` | #2 | — | — |
| `Config_Validations` (sheet) | #3 | — | — |
| `Utils.gs` | — | #2, #5 | — |
| `Config.gs` | — | #1, #8 | #1 |
| `ClientManager.gs` | — | #3 | #3 |
| `Triggers.gs` | — | #2 | #3 |
| `InsightsEngine.gs` | — | #6, #8 | #1 |
| `KPIEngine.gs` | — | #4 | — |
| `FormManager.gs` | — | #10 | #3 |
| `ResultsGenerator.gs` | — | #1, #11 | — |
| `Main.gs` | — | — | #3 |

---

*End of Enhancement & Bug Fix Documentation v2.0*
