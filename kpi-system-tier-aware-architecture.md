# KPI Analyzer — Tier-Aware Architecture

**Purpose**: Fix the system to properly handle multiple form tiers  
**Date**: December 9, 2024  
**Status**: Critical Architecture Update

---

## Table of Contents

1. [Problem Summary](#1-problem-summary)
2. [Target Architecture](#2-target-architecture)
3. [Data Model Changes](#3-data-model-changes)
4. [Code Changes Required](#4-code-changes-required)
5. [Config_KPIs Tier Classification](#5-config_kpis-tier-classification)
6. [Implementation Plan](#6-implementation-plan)

---

## 1. Problem Summary

### What's Happening

```
Onboarding Form submitted (20 KPIs)
          │
          ▼
Clients Sheet has 106 columns (ALL KPIs)
          │
          ▼
Analysis runs against ALL 106 columns
          │
          ▼
77 columns are empty → "No data provided"
          │
          ▼
Results show errors/warnings for KPIs that WEREN'T ASKED
```

### What Should Happen

```
Onboarding Form submitted (20 KPIs)
          │
          ▼
Clients Sheet: Row created with form_tier = "onboarding"
          │
          ▼
Analysis checks form_tier, only processes ONBOARDING KPIs
          │
          ▼
Only 20 KPIs validated/calculated
          │
          ▼
Results show only onboarding metrics (no false "no data" errors)
```

---

## 2. Target Architecture

### Tier Hierarchy

```
ONBOARDING (Tier 1)
├── 20 input KPIs
├── ~10 calculated KPIs
├── ~15 validation rules
└── Basic diagnostic results

DETAILED (Tier 2) = Onboarding + Additional
├── 20 onboarding KPIs
├── +28 detailed KPIs (48 total)
├── +20 calculated KPIs
├── +25 validation rules
└── Comprehensive diagnostic results

FULL (Tier 3) = All KPIs
├── 97 input KPIs
├── All calculated KPIs
├── All validation rules
└── Complete diagnostic results
```

### Client Journey

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT: "ABC Plumbing"                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Week 1: Fills Onboarding Form                                  │
│  ├── Clients row created: form_tier = "onboarding"              │
│  ├── Analysis runs: 20 KPIs validated                           │
│  └── Results: Basic health check                                │
│                                                                  │
│  Week 3: Wants deeper insight → Fills Detailed Form             │
│  ├── Clients row UPDATED: form_tier = "detailed"                │
│  ├── 28 additional KPI columns populated                        │
│  ├── Analysis runs: 48 KPIs validated                           │
│  └── Results: Comprehensive diagnostic                          │
│                                                                  │
│  Week 6: Full deep dive → Fills Full Form                       │
│  ├── Clients row UPDATED: form_tier = "full"                    │
│  ├── All remaining KPI columns populated                        │
│  ├── Analysis runs: 97 KPIs validated                           │
│  └── Results: Complete operational analysis                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Model Changes

### 3.1 Clients Sheet — Add `form_tier` Column

**Add column after `period_days` (or wherever appropriate):**

| Column | Purpose |
|--------|---------|
| `form_tier` | "onboarding" / "detailed" / "full" |

**On form submission:**
- Detect which form was submitted
- Set `form_tier` accordingly
- If same client submits higher tier, UPDATE row and change `form_tier`

### 3.2 Config_KPIs — Complete Tier Classification

**Current state:**
- 20 KPIs tagged as `onboarding`
- 77 KPIs have no tier (blank)

**Required:**
- ALL 97 input KPIs must have a `form_tier` value
- Calculated KPIs should inherit tier from their dependencies

**Tier Assignment Logic:**

| Tier | Criteria |
|------|----------|
| `onboarding` | Essential metrics any business can provide |
| `detailed` | Requires some tracking/systems in place |
| `section_deep` | Granular metrics, requires mature operations |

### 3.3 Config_Validations — Add `form_tier` Column

**Each validation rule should specify which tier it applies to:**

| rule_id | form_tier | Description |
|---------|-----------|-------------|
| range_close_rate | onboarding | Applies to onboarding+ |
| recon_revenue | onboarding | Applies to onboarding+ |
| csr_answer_rate | detailed | Only for detailed+ |
| inv_accuracy | section_deep | Only for full diagnostic |

**Interpretation:**
- `onboarding` rules run for ALL tiers
- `detailed` rules run for detailed and full tiers
- `section_deep` rules run for full tier only

---

## 4. Code Changes Required

### 4.1 syncClientsSchema() — Keep As-Is

The current behavior (adding all columns) is actually correct. We WANT all columns to exist so that:
- Client can progress from onboarding → detailed → full
- Data accumulates in the same row
- No schema changes needed when client upgrades tier

**No change needed.**

### 4.2 Form Submission Handler — Record Tier

```javascript
/**
 * Process form submission with tier awareness
 * @param {Object} e - Form submit event
 */
function processNewSubmission(e) {
  // ... existing code to get form data ...
  
  // Determine which form tier was submitted
  const formTier = detectFormTier(formHeaders);
  
  // Check if client already exists
  const existingClient = findClientByEmail(clientRecord.contact_email);
  
  if (existingClient) {
    // UPDATE existing row
    updateClientRecord(existingClient.rowIndex, clientRecord, formTier);
    log(`Updated existing client: ${clientRecord.company_name}, tier: ${formTier}`);
  } else {
    // CREATE new row
    clientRecord.form_tier = formTier;
    writeClientRecord(clientsSheet, clientRecord);
    log(`Created new client: ${clientRecord.company_name}, tier: ${formTier}`);
  }
}

/**
 * Detect form tier based on which questions were asked
 * @param {string[]} formHeaders - Column headers from form response
 * @returns {string} "onboarding" | "detailed" | "full"
 */
function detectFormTier(formHeaders) {
  const kpiConfig = loadKPIConfig();
  
  // Count how many KPIs from each tier are in the form
  let onboardingCount = 0;
  let detailedCount = 0;
  let fullCount = 0;
  
  for (const header of formHeaders) {
    const kpi = kpiConfig.find(k => k.name === header);
    if (kpi) {
      if (kpi.formTier === 'onboarding') onboardingCount++;
      else if (kpi.formTier === 'detailed') detailedCount++;
      else if (kpi.formTier === 'section_deep') fullCount++;
    }
  }
  
  // Determine tier based on what was asked
  if (fullCount > 0) return 'full';
  if (detailedCount > 0) return 'detailed';
  return 'onboarding';
}

/**
 * Find existing client by email
 * @param {string} email
 * @returns {Object|null} {rowIndex, data} or null
 */
function findClientByEmail(email) {
  const sheet = getRequiredSheet(SHEET_NAMES.CLIENTS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const emailCol = headers.indexOf('contact_email');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][emailCol] === email) {
      return { rowIndex: i + 1, data: data[i] };
    }
  }
  return null;
}

/**
 * Update existing client row with new data
 * @param {number} rowIndex - 1-based row index
 * @param {Object} newData - New KPI values
 * @param {string} newTier - New form tier
 */
function updateClientRecord(rowIndex, newData, newTier) {
  const sheet = getRequiredSheet(SHEET_NAMES.CLIENTS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Get existing row
  const existingRow = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Merge: new data overwrites, but keep existing values for columns not in new data
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (newData[header] !== undefined && newData[header] !== null && newData[header] !== '') {
      existingRow[i] = newData[header];
    }
  }
  
  // Update form_tier to the higher tier
  const tierIndex = headers.indexOf('form_tier');
  if (tierIndex >= 0) {
    existingRow[tierIndex] = getHigherTier(existingRow[tierIndex], newTier);
  }
  
  // Update timestamp
  const tsIndex = headers.indexOf('last_analyzed');
  if (tsIndex >= 0) {
    existingRow[tsIndex] = new Date();
  }
  
  // Write back
  sheet.getRange(rowIndex, 1, 1, existingRow.length).setValues([existingRow]);
}

/**
 * Get the higher of two tiers
 */
function getHigherTier(tier1, tier2) {
  const tierOrder = { 'onboarding': 1, 'detailed': 2, 'full': 3 };
  const t1 = tierOrder[tier1] || 0;
  const t2 = tierOrder[tier2] || 0;
  
  if (t2 >= t1) return tier2;
  return tier1;
}
```

### 4.3 getClientData() — Include Tier

```javascript
/**
 * Get client data including form tier
 * @param {string} clientId
 * @returns {Object} Client data with tier info
 */
function getClientData(clientId) {
  const client = getClientById(clientId);
  if (!client) return null;
  
  // ... existing code ...
  
  return {
    // ... existing fields ...
    formTier: client.form_tier || 'onboarding',  // Default to onboarding
    // ... rest of fields ...
  };
}
```

### 4.4 Validation Engine — Filter by Tier

```javascript
/**
 * Run validations filtered by client's form tier
 * @param {Object} allValues - All KPI values
 * @param {Object[]} validationConfig - All validation rules
 * @param {string} clientTier - "onboarding" | "detailed" | "full"
 * @returns {Object} Validation results
 */
function validateAll(allValues, validationConfig, kpiConfig, clientTier) {
  const issues = [];
  
  // Get KPIs that apply to this tier
  const tierKPIs = getKPIsForTier(kpiConfig, clientTier);
  const tierKPIIds = new Set(tierKPIs.map(k => k.id.toLowerCase()));
  
  for (const rule of validationConfig) {
    if (!rule.active) continue;
    
    // Check if rule applies to this tier
    if (!ruleAppliesToTier(rule, clientTier)) {
      continue;  // Skip rules for higher tiers
    }
    
    // Check if all affected KPIs are in this tier
    const affectedKPIs = (rule.affectedKPIs || '').split(',').map(id => id.trim().toLowerCase());
    const allInTier = affectedKPIs.every(id => tierKPIIds.has(id));
    
    if (!allInTier) {
      continue;  // Skip if rule references KPIs not in this tier
    }
    
    // Run the validation
    const result = runValidation(rule, allValues);
    
    if (result && !result.passed && !result.skipped) {
      issues.push({
        // ... existing issue fields ...
      });
    }
  }
  
  return {
    status: determineOverallStatus(issues),
    issues: issues,
    tierFiltered: clientTier,
    rulesRun: issues.length,
    rulesSkipped: validationConfig.length - issues.length
  };
}

/**
 * Check if a validation rule applies to a given tier
 * @param {Object} rule - Validation rule
 * @param {string} clientTier - Client's tier
 * @returns {boolean}
 */
function ruleAppliesToTier(rule, clientTier) {
  const ruleTier = rule.formTier || 'onboarding';  // Default rules to onboarding
  
  const tierOrder = { 'onboarding': 1, 'detailed': 2, 'full': 3 };
  
  // Rule applies if client tier >= rule tier
  return tierOrder[clientTier] >= tierOrder[ruleTier];
}

/**
 * Get all KPIs that apply to a given tier (cumulative)
 * @param {Object[]} kpiConfig
 * @param {string} tier
 * @returns {Object[]}
 */
function getKPIsForTier(kpiConfig, tier) {
  const tierOrder = { 'onboarding': 1, 'detailed': 2, 'full': 3, 'section_deep': 3 };
  const clientTierNum = tierOrder[tier] || 1;
  
  return kpiConfig.filter(kpi => {
    const kpiTier = kpi.formTier || 'full';  // Unclassified = full tier only
    const kpiTierNum = tierOrder[kpiTier] || 3;
    return kpiTierNum <= clientTierNum;
  });
}
```

### 4.5 KPI Engine — Filter Calculations by Tier

```javascript
/**
 * Calculate KPIs filtered by tier
 * @param {Object} clientData - Client data including formTier
 * @param {Object[]} kpiConfig - All KPI definitions
 * @returns {Object} Calculated values for tier-appropriate KPIs only
 */
function calculateAllKPIs(clientData, kpiConfig) {
  const clientTier = clientData.formTier || 'onboarding';
  
  // Get KPIs for this tier
  const tierKPIs = getKPIsForTier(kpiConfig, clientTier);
  const tierKPIIds = new Set(tierKPIs.map(k => k.id));
  
  // Filter calculated KPIs to those with all dependencies in tier
  const calculatedKPIs = tierKPIs.filter(k => 
    k.type === 'calculated' || k.type === 'Calculation'
  );
  
  // Only calculate if all dependencies are available in this tier
  const calculableKPIs = calculatedKPIs.filter(kpi => {
    const deps = getDependencies(kpi.formula);
    return deps.every(dep => tierKPIIds.has(dep));
  });
  
  // ... rest of calculation logic using calculableKPIs ...
}
```

### 4.6 Results Generator — Filter Output by Tier

```javascript
/**
 * Generate results filtered by client tier
 * @param {string} clientId
 */
function generateResults(clientId) {
  const clientData = getClientData(clientId);
  const clientTier = clientData.formTier || 'onboarding';
  const kpiConfig = loadKPIConfig();
  
  // Get only KPIs for this tier
  const tierKPIs = getKPIsForTier(kpiConfig, clientTier);
  
  // Generate results only for tier KPIs
  for (const kpi of tierKPIs) {
    // ... existing result generation ...
  }
  
  // Add tier info to results header
  writeResultsHeader(clientData, clientTier);
}

/**
 * Write results header with tier info
 */
function writeResultsHeader(clientData, tier) {
  const tierLabels = {
    'onboarding': 'Quick Assessment (20 KPIs)',
    'detailed': 'Comprehensive Diagnostic (48 KPIs)',
    'full': 'Full Operational Analysis (97 KPIs)'
  };
  
  // ... write header including tier label ...
}
```

---

## 5. Config_KPIs Tier Classification

### Current State
- 20 KPIs: `onboarding`
- 77 KPIs: blank (unclassified)

### Required: Classify All 97 Input KPIs

Here's my recommended classification:

#### Onboarding (20) — Already Done ✓
Essential metrics any business knows off the top of their head.

#### Detailed (30-35) — Needs Classification
Metrics that require basic tracking/software:

| kpi_id | name | Recommended Tier |
|--------|------|------------------|
| CSR_CORE_001 | Total Inbound Calls | detailed |
| CSR_CORE_003 | Total Calls Answered | detailed |
| CSR_CORE_004 | Total Calls Missed | detailed |
| FIN_CORE_004 | Total Payroll Cost | detailed |
| FIN_CORE_005 | Total Accounts Receivable | detailed |
| SAL_CORE_001 | Total Run Appointments | detailed |
| SAL_CORE_002 | Total Estimates Sent | detailed |
| FLD_CORE_001 | Total Scheduled Jobs | detailed |
| FLD_CORE_002 | Total Completed Jobs | detailed |
| SCH_CORE_001 | Total Technician Hours Available | detailed |
| SCH_CORE_002 | Total Technician Hours Booked | detailed |
| HR_CORE_001 | Total Employees | detailed |
| HR_CORE_002 | Total New Hires | detailed |
| INV_CORE_001 | Total Inventory Value | detailed |
| ... | ... | ... |

#### Section Deep (40-45) — Needs Classification
Granular metrics for mature operations:

| kpi_id | name | Recommended Tier |
|--------|------|------------------|
| CSR_CORE_006 | Total Follow-Up Tasks Assigned | section_deep |
| CSR_CORE_008 | Total Talk Time | section_deep |
| CSR_CORE_010 | Total CSR Active Hours | section_deep |
| FIN_CORE_006 | Total Accounts Payable | section_deep |
| FIN_CORE_008 | Total Refunds Issued | section_deep |
| FLD_CORE_005 | Total Actual Labor Hours | section_deep |
| FLD_CORE_008 | Total Travel Time | section_deep |
| INV_CORE_003 | Total Physical Inventory Count | section_deep |
| ... | ... | ... |

### Action Required

You need to classify the 77 unassigned KPIs. I can generate a spreadsheet with my recommended tier for each if you'd like.

---

## 6. Implementation Plan

### Phase 1: Data Setup (Today)

1. **Add `form_tier` column to Clients sheet**
   - Add after `period_days` column
   - For existing rows, set to "onboarding" (or leave blank)

2. **Add `form_tier` column to Config_Validations**
   - Add column
   - Set all current rules to "onboarding"

3. **Classify remaining KPIs in Config_KPIs**
   - Update `form_tier` for all 97 input KPIs
   - I can provide recommendations

### Phase 2: Code Updates (Developer)

1. **Update `processNewSubmission()`**
   - Detect form tier
   - Handle client updates (not just creates)
   - Record `form_tier` in Clients sheet

2. **Update `validateAll()`**
   - Filter rules by tier
   - Skip rules for KPIs not in tier

3. **Update `calculateAllKPIs()`**
   - Only calculate KPIs with dependencies in tier

4. **Update `generateResults()`**
   - Only output KPIs for client's tier
   - Show tier label in header

### Phase 3: Testing

- [ ] Submit onboarding form → only 20 KPIs shown in results
- [ ] Submit detailed form for SAME client → 48 KPIs shown
- [ ] Verify no "no data provided" for KPIs not in tier
- [ ] Verify validation only runs tier-appropriate rules

---

## Quick Reference: Tier Filtering Logic

```
┌─────────────────────────────────────────────────────────────┐
│                     TIER FILTERING                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Client.form_tier = "onboarding"                           │
│  ├── Show KPIs where form_tier = "onboarding"              │
│  ├── Run validations where form_tier = "onboarding"        │
│  └── Calculate KPIs with all deps in onboarding            │
│                                                             │
│  Client.form_tier = "detailed"                             │
│  ├── Show KPIs where form_tier IN (onboarding, detailed)   │
│  ├── Run validations where form_tier IN (onboarding, detailed) │
│  └── Calculate KPIs with all deps in onboarding+detailed   │
│                                                             │
│  Client.form_tier = "full"                                 │
│  ├── Show ALL KPIs                                         │
│  ├── Run ALL validations                                   │
│  └── Calculate ALL KPIs                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary

The system isn't broken — it's just missing **tier awareness**. The fix requires:

| Component | Change |
|-----------|--------|
| Clients sheet | Add `form_tier` column |
| Config_Validations | Add `form_tier` column |
| Config_KPIs | Classify all 97 KPIs into tiers |
| Form submission | Record tier, handle updates |
| Validation | Filter by tier |
| Calculations | Filter by tier |
| Results | Filter by tier |

Once implemented, each form tier will produce a clean, focused analysis with no false "no data" errors.

---

*End of Tier-Aware Architecture Document*
