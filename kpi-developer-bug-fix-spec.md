# KPI Analyzer — Developer Bug Fix Specification

**Date**: December 9, 2024  
**Priority**: CRITICAL  
**Prepared by**: Claude (AI Assistant)  
**For**: Lead Developer

---

## Executive Summary

The KPI Analyzer system has **one critical bug** causing cascading failures across validation and results generation. This document provides exact locations, root causes, and fixes.

**Primary Symptom**: Form submissions with valid data show "No data provided" for multiple KPIs in Results sheet.

**Root Cause**: Case sensitivity mismatch between Clients sheet column headers and KPI ID lookups.

---

## Table of Contents

1. [Bug #1: Case Sensitivity in Data Reading (CRITICAL)](#bug-1-case-sensitivity-in-data-reading-critical)
2. [Bug #2: Validation Engine Formula Types (MEDIUM)](#bug-2-validation-engine-formula-types-medium)
3. [Bug #3: Tier Filtering Not Applied to Results (LOW)](#bug-3-tier-filtering-not-applied-to-results-low)
4. [New Validation Formula Types Required](#new-validation-formula-types-required)
5. [Testing Checklist](#testing-checklist)

---

## Bug #1: Case Sensitivity in Data Reading (CRITICAL)

### Symptom

Form submission data shows correctly in:
- ✓ Form Responses 2 sheet
- ✓ Clients sheet (values are present)

But Results sheet shows:
- ✗ "No data provided" for MKT_CORE_001, CSR_CORE_005, FIN_CORE_002, etc.

### Evidence

**Clients Sheet Row (V2 TEST)**:
```
MKT_CORE_001: 1000      ← Value EXISTS
CSR_CORE_005: 50        ← Value EXISTS
FIN_CORE_002: 75000     ← Value EXISTS
```

**Results Sheet**:
```
Total Marketing Spend: NaN ("No data provided")  ← NOT READING
Total Booked Jobs: NaN ("No data provided")      ← NOT READING
Total COGS: NaN ("No data provided")             ← NOT READING
```

### Root Cause

**File**: `Utils.gs` → `sheetToObjects()`  
**Line**: Header processing

```javascript
// Utils.gs - sheetToObjects()
const rawHeaders = data[0].map(h => String(h).trim().toLowerCase());
//                                                    ^^^^^^^^^^^
// Headers are converted to LOWERCASE
// "MKT_CORE_001" becomes "mkt_core_001"
```

**File**: `ClientManager.gs` → `getClientData()`  
**Line**: Raw inputs extraction

```javascript
// ClientManager.gs - getClientData()
const rawInputs = {};
for (const kpi of inputKPIs) {
  const value = client[kpi.id];  // kpi.id = "MKT_CORE_001" (original case)
  //                   ^^^^^^
  // Lookup uses ORIGINAL CASE from Config_KPIs
  // But client object has LOWERCASE keys from sheetToObjects()
  
  rawInputs[kpi.id] = parseNumber(value);  // value = undefined!
}
```

### The Mismatch

| Source | Key Format | Example |
|--------|------------|---------|
| Config_KPIs `kpi_id` column | Mixed case | `MKT_CORE_001` |
| Clients sheet headers | Mixed case | `MKT_CORE_001` |
| `sheetToObjects()` output | **Lowercase** | `mkt_core_001` |
| `getClientData()` lookup | Mixed case | `MKT_CORE_001` |

**Result**: `client["MKT_CORE_001"]` returns `undefined` because the key is actually `"mkt_core_001"`.

### Fix Option A: Case-Insensitive Lookup in getClientData() (RECOMMENDED)

**File**: `ClientManager.gs`  
**Function**: `getClientData()`

```javascript
/**
 * Get full client data including raw inputs
 * @param {string} clientId - Client ID
 * @returns {Object|null} Client object with rawInputs populated
 */
function getClientData(clientId) {
  const client = getClientById(clientId);

  if (!client) {
    return null;
  }

  // Load KPI config to identify input KPIs
  const kpiConfig = loadKPIConfig();
  const inputKPIs = kpiConfig.filter(k => k.type === 'input');

  // Build a lowercase key map for case-insensitive lookup
  const clientKeysLower = {};
  for (const key of Object.keys(client)) {
    clientKeysLower[key.toLowerCase()] = key;
  }

  // Extract raw inputs from client data (CASE-INSENSITIVE)
  const rawInputs = {};
  for (const kpi of inputKPIs) {
    const kpiIdLower = kpi.id.toLowerCase();
    const actualKey = clientKeysLower[kpiIdLower];
    const value = actualKey ? client[actualKey] : undefined;
    rawInputs[kpi.id] = parseNumber(value);
  }

  // Build structured client data object
  return {
    id: client.client_id,
    companyName: client.company_name || 'Unknown Company',
    contactEmail: client.contact_email || '',
    industry: client.industry || 'General Contracting',
    state: client.state || '',
    dataPeriod: client.data_period || 'monthly',
    periodDays: parseInt(client.period_days, 10) || getPeriodDays(client.data_period),
    formTier: client.form_tier || '',
    submittedAt: client.timestamp ? new Date(client.timestamp) : new Date(),
    analysisStatus: client.analysis_status || ANALYSIS_STATUS.PENDING,
    lastAnalyzed: client.last_analyzed ? new Date(client.last_analyzed) : null,
    notes: client.notes || '',
    rawInputs: rawInputs
  };
}
```

### Fix Option B: Preserve Case in sheetToObjects() (ALTERNATIVE)

**File**: `Utils.gs`  
**Function**: `sheetToObjects()`

Change:
```javascript
const rawHeaders = data[0].map(h => String(h).trim().toLowerCase());
```

To:
```javascript
const rawHeaders = data[0].map(h => String(h).trim());  // Keep original case
```

**Warning**: This may break other code that expects lowercase keys. Option A is safer.

### Verification After Fix

Add this debug function temporarily:

```javascript
function debugClientDataReading() {
  const clientId = getActiveClientId();
  const client = getClientById(clientId);
  const kpiConfig = loadKPIConfig();
  const inputKPIs = kpiConfig.filter(k => k.type === 'input' && k.formTier === 'onboarding');
  
  log('=== DEBUG: Client Data Reading ===');
  log('Client keys: ' + Object.keys(client).slice(0, 20).join(', '));
  
  for (const kpi of inputKPIs) {
    const directValue = client[kpi.id];
    const lowerValue = client[kpi.id.toLowerCase()];
    log(`${kpi.id}: direct="${directValue}", lower="${lowerValue}"`);
  }
}
```

---

## Bug #2: Validation Engine Formula Types (MEDIUM)

### Issue 2a: New Formula Types Not Implemented

The new validation rules use formula types that don't exist in the current ValidationEngine:

| Formula Type | Example | Status |
|--------------|---------|--------|
| `GTE:a:b` | `GTE:CSR_CORE_005:jobs_closed` | **NOT IMPLEMENTED** |
| `GT:a:expr` | `GT:gross_revenue:FIN_CORE_002+total_overhead_costs` | **NOT IMPLEMENTED** |
| `RATIO_MIN:expr:val` | `RATIO_MIN:(num_employees-num_techs)/num_techs:0.125` | **NOT IMPLEMENTED** |
| `RATIO_MAX:expr:val` | `RATIO_MAX:(FLD_CORE_004/jobs_closed)*100:15` | **NOT IMPLEMENTED** |

### Required Implementation

**File**: `ValidationEngine.gs`

Add these functions:

```javascript
/**
 * Execute GTE (Greater Than or Equal) validation
 * Format: GTE:a:b
 * @param {string} formula
 * @param {Object} values
 * @returns {Object} {passed, value1, value2}
 */
function executeGTE(formula, values) {
  const parts = formula.split(':');
  if (parts.length < 3) {
    return { passed: true, skipped: true };
  }
  
  const aId = parts[1];
  const bId = parts[2];
  const a = getValue(aId, values);
  const b = getValue(bId, values);
  
  // Skip if either value is missing
  if (isEmpty(a) || isEmpty(b)) {
    return { passed: true, skipped: true };
  }
  
  const passed = a >= b;
  
  return {
    passed: passed,
    skipped: false,
    value1: a,
    value2: b,
    actual: a,
    expected: `≥ ${b}`
  };
}

/**
 * Execute GT (Greater Than) validation with expression support
 * Format: GT:a:b OR GT:a:expr (where expr can include + - * /)
 * @param {string} formula
 * @param {Object} values
 * @returns {Object}
 */
function executeGT(formula, values) {
  const parts = formula.split(':');
  if (parts.length < 3) {
    return { passed: true, skipped: true };
  }
  
  const aId = parts[1];
  const bExpr = parts[2];
  
  const a = getValue(aId, values);
  if (isEmpty(a)) {
    return { passed: true, skipped: true };
  }
  
  // Evaluate b (could be simple KPI ID or expression like "FIN_CORE_002+total_overhead_costs")
  let b;
  if (bExpr.includes('+') || bExpr.includes('-') || bExpr.includes('*') || bExpr.includes('/')) {
    b = evaluateExpression(bExpr, values);
  } else {
    b = getValue(bExpr, values);
  }
  
  if (isEmpty(b)) {
    return { passed: true, skipped: true };
  }
  
  const passed = a > b;
  
  return {
    passed: passed,
    skipped: false,
    value1: a,
    value2: b,
    actual: a,
    expected: `> ${b}`
  };
}

/**
 * Execute RATIO_MIN validation
 * Format: RATIO_MIN:expression:threshold
 * Passes if expression >= threshold
 * @param {string} formula
 * @param {Object} values
 * @returns {Object}
 */
function executeRatioMin(formula, values) {
  const parts = formula.split(':');
  if (parts.length < 3) {
    return { passed: true, skipped: true };
  }
  
  const expression = parts[1];
  const threshold = parseFloat(parts[2]);
  
  if (isNaN(threshold)) {
    return { passed: true, skipped: true };
  }
  
  const actual = evaluateExpression(expression, values);
  if (actual === null) {
    return { passed: true, skipped: true };
  }
  
  const passed = actual >= threshold;
  
  return {
    passed: passed,
    skipped: false,
    actual: actual,
    expected: `≥ ${threshold}`,
    threshold: threshold
  };
}

/**
 * Execute RATIO_MAX validation
 * Format: RATIO_MAX:expression:threshold
 * Passes if expression <= threshold
 * @param {string} formula
 * @param {Object} values
 * @returns {Object}
 */
function executeRatioMax(formula, values) {
  const parts = formula.split(':');
  if (parts.length < 3) {
    return { passed: true, skipped: true };
  }
  
  const expression = parts[1];
  const threshold = parseFloat(parts[2]);
  
  if (isNaN(threshold)) {
    return { passed: true, skipped: true };
  }
  
  const actual = evaluateExpression(expression, values);
  if (actual === null) {
    return { passed: true, skipped: true };
  }
  
  const passed = actual <= threshold;
  
  return {
    passed: passed,
    skipped: false,
    actual: actual,
    expected: `≤ ${threshold}`,
    threshold: threshold
  };
}

/**
 * Helper: Get value from values object (case-insensitive)
 * @param {string} kpiId
 * @param {Object} values
 * @returns {number|null}
 */
function getValue(kpiId, values) {
  // Try exact match first
  if (values.hasOwnProperty(kpiId)) {
    return parseFloat(values[kpiId]);
  }
  
  // Try lowercase
  const lower = kpiId.toLowerCase();
  if (values.hasOwnProperty(lower)) {
    return parseFloat(values[lower]);
  }
  
  // Try case-insensitive search
  for (const key of Object.keys(values)) {
    if (key.toLowerCase() === lower) {
      return parseFloat(values[key]);
    }
  }
  
  return null;
}
```

### Update runValidation() to Handle New Types

**File**: `ValidationEngine.gs`  
**Function**: `runValidation()`

Add to the switch statement:

```javascript
switch (rule.type) {
  // ... existing cases ...
  
  case 'comparison':
    if (rule.formula.startsWith('GTE:')) {
      result = executeGTE(rule.formula, values);
    } else if (rule.formula.startsWith('GT:')) {
      result = executeGT(rule.formula, values);
    } else if (rule.formula.startsWith('GREATER:')) {
      result = executeGreater(rule.formula, values);  // Keep for backwards compatibility
    } else {
      result = { passed: true };
    }
    break;
    
  case 'ratio':
    if (rule.formula.startsWith('RATIO_MIN:')) {
      result = executeRatioMin(rule.formula, values);
    } else if (rule.formula.startsWith('RATIO_MAX:')) {
      result = executeRatioMax(rule.formula, values);
    } else if (rule.formula.startsWith('EQUALS:')) {
      result = executeEquals(rule.formula, values, rule.tolerance);
    } else {
      result = { passed: true };
    }
    break;
    
  // ... rest of cases ...
}
```

### Update executeGenericValidation() for Fallback

```javascript
function executeGenericValidation(formula, values, tolerance) {
  if (formula.startsWith('RECONCILE:')) {
    return executeReconcile(formula, values, tolerance);
  } else if (formula.startsWith('RANGE:')) {
    return executeRange(formula, values);
  } else if (formula.startsWith('GTE:')) {
    return executeGTE(formula, values);
  } else if (formula.startsWith('GT:')) {
    return executeGT(formula, values);
  } else if (formula.startsWith('GREATER:')) {
    return executeGreater(formula, values);
  } else if (formula.startsWith('EQUALS:')) {
    return executeEquals(formula, values, tolerance);
  } else if (formula.startsWith('REQUIRES:')) {
    return executeRequires(formula, values);
  } else if (formula.startsWith('RATIO_MIN:')) {
    return executeRatioMin(formula, values);
  } else if (formula.startsWith('RATIO_MAX:')) {
    return executeRatioMax(formula, values);
  }

  return { passed: true };
}
```

---

## Bug #3: Tier Filtering Not Applied to Results (LOW)

### Issue

Results sheet shows ALL KPIs including those not in the client's form tier, resulting in many "No data provided" entries for KPIs that weren't asked.

### Current Behavior

```
Client form_tier: "onboarding" (20 KPIs)
Results shows: ALL 97+ KPIs
77+ KPIs show "No data provided"
```

### Expected Behavior

```
Client form_tier: "onboarding" (20 KPIs)
Results shows: Only 20 onboarding KPIs
Only KPIs without values show "No data provided"
```

### Fix Location

**File**: `ResultsGenerator.gs`  
**Function**: `generateResults()`

The tier filtering logic exists in Main.gs but may not be fully passed through to ResultsGenerator.

### Verification

1. Check that `clientData.formTier` is correctly populated
2. Check that `getKPIsForTier()` is called before generating results
3. Check that only tier-appropriate KPIs are written to Results sheet

---

## New Validation Formula Types Required

### Summary Table

| Formula | Syntax | Example | Purpose |
|---------|--------|---------|---------|
| GTE | `GTE:a:b` | `GTE:CSR_CORE_005:jobs_closed` | a ≥ b |
| GT | `GT:a:b` | `GT:gross_revenue:FIN_CORE_002` | a > b |
| GT (expr) | `GT:a:b+c` | `GT:revenue:cogs+overhead` | a > (b+c) |
| RATIO_MIN | `RATIO_MIN:expr:val` | `RATIO_MIN:(emp-tech)/tech:0.125` | expr ≥ val |
| RATIO_MAX | `RATIO_MAX:expr:val` | `RATIO_MAX:(rework/closed)*100:15` | expr ≤ val |

### Expression Evaluator Enhancement

The existing `evaluateExpression()` function should already handle:
- Addition: `a+b`
- Subtraction: `a-b`
- Multiplication: `a*b`
- Division: `a/b`
- Parentheses: `(a-b)/c`
- Chained operations: `a*b/100`

Verify this works with complex expressions like:
- `(num_employees-num_techs)/num_techs`
- `(FLD_CORE_004/jobs_closed)*100`

---

## Testing Checklist

### After Bug #1 Fix (Data Reading)

Run this test sequence:

1. [ ] Submit form with ALL onboarding fields populated
2. [ ] Verify Clients sheet row has all values (check MKT_CORE_001, CSR_CORE_005, etc.)
3. [ ] Run `debugClientDataReading()` function
4. [ ] Verify log shows values for both "direct" and "lower" lookups
5. [ ] Run analysis
6. [ ] Verify Results sheet shows actual values (not "No data provided") for:
   - [ ] Total Marketing Spend (MKT_CORE_001)
   - [ ] Total Booked Jobs (CSR_CORE_005)
   - [ ] Total COGS (FIN_CORE_002)
   - [ ] Total Overhead Costs (total_overhead_costs)
   - [ ] Total Jobs Inspected (FLD_CORE_010)
   - [ ] Total Jobs Failed QC (FLD_CORE_003)
   - [ ] Total Rework/Callback Jobs (FLD_CORE_004)
   - [ ] Total Separations (HR_CORE_003)
   - [ ] Total Open Positions (HR_CORE_008)

### After Bug #2 Fix (Validation Types)

1. [ ] Create test validation rule: `GTE:num_employees:num_techs`
2. [ ] Submit data with employees=10, techs=8 → Should PASS
3. [ ] Submit data with employees=8, techs=10 → Should FAIL
4. [ ] Create test validation rule: `GT:gross_revenue:FIN_CORE_002+total_overhead_costs`
5. [ ] Submit data where revenue > (cogs + overhead) → Should PASS
6. [ ] Submit data where revenue < (cogs + overhead) → Should FAIL
7. [ ] Create test validation rule: `RATIO_MAX:(FLD_CORE_004/jobs_closed)*100:15`
8. [ ] Submit data with rework=5, closed=100 (5%) → Should PASS
9. [ ] Submit data with rework=20, closed=100 (20%) → Should FAIL

### Full Integration Test

1. [ ] Delete all test clients
2. [ ] Submit fresh onboarding form with known values
3. [ ] Run analysis
4. [ ] Verify:
   - [ ] All 20 input KPIs show correct values in Results
   - [ ] Calculated KPIs compute correctly
   - [ ] Validation rules fire appropriately (no false positives)
   - [ ] Only onboarding-tier KPIs appear in Results

---

## Files to Modify

| File | Changes | Priority |
|------|---------|----------|
| `ClientManager.gs` | Fix case-insensitive lookup in `getClientData()` | **CRITICAL** |
| `ValidationEngine.gs` | Add `executeGTE()`, `executeGT()`, `executeRatioMin()`, `executeRatioMax()`, `getValue()` | **HIGH** |
| `ValidationEngine.gs` | Update `runValidation()` switch statement | **HIGH** |
| `ValidationEngine.gs` | Update `executeGenericValidation()` | **MEDIUM** |
| `ResultsGenerator.gs` | Verify tier filtering is applied | **LOW** |

---

## Estimated Time

| Task | Time |
|------|------|
| Bug #1: Case sensitivity fix | 30 minutes |
| Bug #2: New validation types | 1-2 hours |
| Bug #3: Tier filtering verification | 30 minutes |
| Testing | 1 hour |
| **Total** | **3-4 hours** |

---

## Questions for Developer

1. **Option A vs Option B for Bug #1**: Do you prefer fixing the lookup (Option A) or changing `sheetToObjects()` (Option B)? Option A is safer but Option B is more consistent.

2. **Backwards Compatibility**: Should `GREATER:a:b` continue to work alongside new `GTE:a:b` and `GT:a:b`? (Recommended: Yes, keep for backwards compatibility)

3. **Expression Complexity**: Are there any concerns about using `eval()` or `Function()` for expression evaluation? The current code sanitizes input but additional validation could be added.

---

*End of Developer Bug Fix Specification*
