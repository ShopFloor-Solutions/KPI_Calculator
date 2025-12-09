# KPI Analyzer — Modularity Architecture Fix

**Purpose**: Document all changes required to make the system truly configuration-driven  
**Date**: December 9, 2024  
**Status**: Critical Fix Required

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Current vs Target Architecture](#2-current-vs-target-architecture)
3. [Root Cause Analysis](#3-root-cause-analysis)
4. [Required Changes Overview](#4-required-changes-overview)
5. [Change #1: Dynamic Clients Sheet](#5-change-1-dynamic-clients-sheet)
6. [Change #2: Dynamic Form-to-Client Mapping](#6-change-2-dynamic-form-to-client-mapping)
7. [Change #3: Config_KPIs as Single Source of Truth](#7-change-3-config_kpis-as-single-source-of-truth)
8. [Change #4: Results Generator Updates](#8-change-4-results-generator-updates)
9. [Change #5: Validation Engine Updates](#9-change-5-validation-engine-updates)
10. [Implementation Plan](#10-implementation-plan)
11. [Testing Checklist](#11-testing-checklist)

---

## 1. Problem Statement

### The Promise
The system was designed to be **modular and configuration-driven**:
- Add/modify KPIs in `Config_KPIs` sheet
- Add/modify validation rules in `Config_Validations` sheet
- System automatically adapts — no code changes needed

### The Reality
When a form is submitted with 18 data fields:
- **Form receives**: All 18 values correctly
- **Clients sheet stores**: Only 8 values (the rest are lost)
- **Results show**: "No data provided" for 10 fields that WERE provided

### Root Cause
The `Clients` sheet has **hardcoded columns** that don't match `Config_KPIs`:

| What's Defined | Count | What Works |
|----------------|-------|------------|
| Input KPIs in Config_KPIs | 97 | ✓ Defines the universe |
| Onboarding KPIs for form | 20 | ✓ Form collects correctly |
| Columns in Clients sheet | 13 | ✗ Only 13 data columns exist |
| Form fields that map | 8 | ✗ 10 fields have nowhere to go |

---

## 2. Current vs Target Architecture

### Current Architecture (BROKEN)

```
┌─────────────────┐
│  Config_KPIs    │ ← Defines 97 input KPIs
│  (97 inputs)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  FormManager    │ ← Reads Config_KPIs, builds form ✓
│  (Dynamic)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Google Form    │ ← Collects 20 onboarding KPIs ✓
│  (20 questions) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Form Responses  │ ← Stores all 20 values ✓
│  (20 columns)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ ClientManager   │ ← HARDCODED mapping to 13 columns ✗
│  (Hardcoded)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Clients Sheet  │ ← Only 13 data columns exist ✗
│  (13 columns)   │   10 values are LOST
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  KPIEngine      │ ← Tries to read from Clients ✗
│  (Reads Clients)│   Missing data = null
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Results        │ ← Shows "No data provided" ✗
│  (Wrong output) │
└─────────────────┘
```

### Target Architecture (FIXED)

```
┌─────────────────┐
│  Config_KPIs    │ ← SINGLE SOURCE OF TRUTH
│  (97 inputs)    │
└────────┬────────┘
         │
    ┌────┴────┬─────────────┬──────────────┐
    ▼         ▼             ▼              ▼
┌────────┐ ┌────────┐ ┌──────────┐ ┌────────────┐
│ Form   │ │Clients │ │ KPI      │ │ Results    │
│Manager │ │ Schema │ │ Engine   │ │ Generator  │
└────────┘ └────────┘ └──────────┘ └────────────┘
    │           │           │              │
    ▼           ▼           ▼              ▼
  Form      Columns      Formulas       Output
  Questions  Auto-Gen    Reference      KPIs from
  from KPIs  from KPIs   KPI IDs        Config
```

**Key Principle**: `Config_KPIs` defines everything. All other components READ from it.

---

## 3. Root Cause Analysis

### 3.1 Clients Sheet — Hardcoded Columns

**Location**: `Clients` sheet, row 1

**Current columns** (hardcoded):
```
client_id, timestamp, company_name, contact_email, industry, state,
data_period, period_days, total_leads, in_home_visits, jobs_closed,
gross_revenue, total_costs, num_employees, num_techs, num_vehicles,
hours_scheduled, hours_per_day, average_ticket, reported_close_rate,
reported_booking_rate, analysis_status, last_analyzed, notes
```

**Problem**: These don't include new KPIs like:
- `MKT_CORE_001` (Total Marketing Spend)
- `CSR_CORE_005` (Total Booked Jobs)
- `FIN_CORE_002` (Total COGS)
- `FLD_CORE_003`, `FLD_CORE_004`, `FLD_CORE_010` (QC/Rework metrics)
- `HR_CORE_003`, `HR_CORE_008` (Separations, Open Positions)
- etc.

### 3.2 ClientManager.gs — Hardcoded Mapping

**Location**: `ClientManager.gs`, `buildFormColumnMapping()` function

**Current code** (partially dynamic):
```javascript
function buildFormColumnMapping() {
  const mapping = {
    // Standard form fields - HARDCODED
    'Timestamp': 'timestamp',
    'Company Name': 'company_name',
    // ...
  };

  // KPI mappings - DYNAMIC (reads from config)
  const kpiConfig = loadKPIConfig();
  for (const kpi of kpiConfig) {
    if (kpi.type === 'input') {
      mapping[kpi.name] = kpi.id;  // Maps "Total Leads" → "total_leads"
    }
  }
  return mapping;
}
```

**Problem**: The mapping is built correctly, but `writeClientRecord()` tries to write to columns that **don't exist** in the Clients sheet.

### 3.3 writeClientRecord() — Silent Failure

**Location**: `ClientManager.gs`

```javascript
function writeClientRecord(sheet, record) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const rowData = [];
  for (const header of headers) {
    const value = record[header];  // ← If header doesn't exist, value = undefined
    rowData.push(value !== undefined ? value : '');
  }
  
  sheet.appendRow(rowData);
}
```

**Problem**: If `record` contains `MKT_CORE_001: 300` but `headers` doesn't include `MKT_CORE_001`, the value is simply **ignored** — no error, no warning.

### 3.4 Summary: Where Data Gets Lost

```
Form Response: { "Total Marketing Spend": 300, "Total COGS": 50000, ... }
                           │
                           ▼
Column Mapping: { "Total Marketing Spend": "MKT_CORE_001", "Total COGS": "FIN_CORE_002", ... }
                           │
                           ▼
Client Record:  { MKT_CORE_001: 300, FIN_CORE_002: 50000, ... }
                           │
                           ▼
Clients Headers: ["client_id", "company_name", ... "gross_revenue", ...]
                           │
                           ▼
writeClientRecord(): "MKT_CORE_001 not in headers, skip"  ← DATA LOST HERE
                           │
                           ▼
Clients Sheet:   MKT_CORE_001 column doesn't exist → value never written
                           │
                           ▼
Results:         "No data provided" for Total Marketing Spend
```

---

## 4. Required Changes Overview

| # | Component | Change | Effort |
|---|-----------|--------|--------|
| 1 | Clients Sheet | Add columns for all input KPIs OR make dynamic | Medium |
| 2 | ClientManager.gs | Auto-add missing columns before writing | Medium |
| 3 | Config_KPIs | Add `client_column` field for consistent naming | Low |
| 4 | ResultsGenerator.gs | Read KPI definitions from config (already does) | Low |
| 5 | ValidationEngine.gs | Ensure KPI ID references match Clients columns | Low |
| 6 | syncClientsSchema() | New function to sync Clients columns with Config_KPIs | High |

---

## 5. Change #1: Dynamic Clients Sheet

### Option A: Manual Column Addition (Quick Fix)

Add these columns to the Clients sheet immediately after `reported_booking_rate`:

```
MKT_CORE_001          (Total Marketing Spend)
CSR_CORE_005          (Total Booked Jobs)
total_capacity        (Total Capacity)
FIN_CORE_002          (Total COGS)
total_overhead_costs  (Total Overhead Costs)
FLD_CORE_010          (Total Jobs Inspected)
FLD_CORE_003          (Total Jobs Failed QC)
FLD_CORE_004          (Total Rework/Callback Jobs)
HR_CORE_003           (Total Separations)
HR_CORE_008           (Total Open Positions)
FIN_CORE_001          (Total Revenue)
SAL_CORE_003          (Total Jobs Sold)
```

**Pros**: Fast, simple
**Cons**: Must repeat every time you add KPIs

### Option B: Auto-Sync Function (Recommended)

Create a function that synchronizes Clients columns with Config_KPIs:

```javascript
/**
 * Synchronize Clients sheet columns with Config_KPIs input definitions
 * Adds missing columns, preserves existing data
 */
function syncClientsSchema() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const clientsSheet = ss.getSheetByName('Clients');
  const kpiConfig = loadKPIConfig();
  
  // Get current headers
  const currentHeaders = clientsSheet.getRange(1, 1, 1, clientsSheet.getLastColumn()).getValues()[0];
  const currentHeaderSet = new Set(currentHeaders.map(h => h.toString().toLowerCase()));
  
  // Define required system columns (always first)
  const systemColumns = [
    'client_id', 'timestamp', 'company_name', 'contact_email', 
    'industry', 'state', 'data_period', 'period_days'
  ];
  
  // Get all input KPI IDs
  const inputKPIs = kpiConfig.filter(k => k.type === 'input');
  const kpiColumns = inputKPIs.map(k => k.id);
  
  // Define required trailing columns
  const trailingColumns = ['analysis_status', 'last_analyzed', 'notes'];
  
  // Build complete column list
  const requiredColumns = [...systemColumns, ...kpiColumns, ...trailingColumns];
  
  // Find missing columns
  const missingColumns = requiredColumns.filter(col => 
    !currentHeaderSet.has(col.toLowerCase())
  );
  
  if (missingColumns.length === 0) {
    log('Clients schema is up to date');
    return { added: 0, columns: [] };
  }
  
  // Add missing columns at the end (before trailing columns)
  // For simplicity, we'll add them at the very end for now
  const lastCol = clientsSheet.getLastColumn();
  
  for (let i = 0; i < missingColumns.length; i++) {
    clientsSheet.getRange(1, lastCol + 1 + i).setValue(missingColumns[i]);
  }
  
  log(`Added ${missingColumns.length} columns to Clients sheet: ${missingColumns.join(', ')}`);
  
  return { 
    added: missingColumns.length, 
    columns: missingColumns 
  };
}
```

### Add Menu Option

```javascript
// In Main.gs, add to menu
.addItem('Sync Clients Schema with KPIs', 'syncClientsSchemaWithConfirmation')

function syncClientsSchemaWithConfirmation() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    'Sync Clients Schema',
    'This will add any missing KPI columns to the Clients sheet.\n\n' +
    'Existing data will NOT be affected.\n\nContinue?',
    ui.ButtonSet.YES_NO
  );
  
  if (result === ui.Button.YES) {
    const syncResult = syncClientsSchema();
    ui.alert(
      'Schema Sync Complete',
      `Added ${syncResult.added} new columns:\n${syncResult.columns.join('\n') || 'None needed'}`
    );
  }
}
```

---

## 6. Change #2: Dynamic Form-to-Client Mapping

### Problem
The mapping from form question names to KPI IDs works, but the write fails silently.

### Solution
Update `writeClientRecord()` to auto-add missing columns OR warn loudly:

```javascript
/**
 * Write client record to Clients sheet
 * UPDATED: Auto-adds missing columns if they exist in Config_KPIs
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} record - Client record with KPI IDs as keys
 */
function writeClientRecord(sheet, record) {
  // Get current headers
  let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  let headersLower = headers.map(h => String(h).toLowerCase());
  
  // Find keys in record that aren't in headers
  const recordKeys = Object.keys(record);
  const missingKeys = recordKeys.filter(key => 
    !headersLower.includes(key.toLowerCase()) &&
    key !== '' && 
    record[key] !== undefined &&
    record[key] !== null &&
    record[key] !== ''
  );
  
  // Auto-add missing columns if they're valid KPI IDs
  if (missingKeys.length > 0) {
    const kpiConfig = loadKPIConfig();
    const validKPIIds = new Set(kpiConfig.map(k => k.id.toLowerCase()));
    
    const columnsToAdd = missingKeys.filter(key => 
      validKPIIds.has(key.toLowerCase()) ||
      // Also allow standard field names
      ['client_id', 'timestamp', 'company_name', 'contact_email', 
       'industry', 'state', 'data_period', 'period_days',
       'analysis_status', 'last_analyzed', 'notes'].includes(key.toLowerCase())
    );
    
    if (columnsToAdd.length > 0) {
      // Add new columns
      const lastCol = sheet.getLastColumn();
      for (let i = 0; i < columnsToAdd.length; i++) {
        sheet.getRange(1, lastCol + 1 + i).setValue(columnsToAdd[i]);
      }
      log(`Auto-added ${columnsToAdd.length} columns: ${columnsToAdd.join(', ')}`);
      
      // Refresh headers
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      headersLower = headers.map(h => String(h).toLowerCase());
    }
    
    // Log any keys that couldn't be mapped
    const unmappedKeys = missingKeys.filter(key => !columnsToAdd.includes(key));
    if (unmappedKeys.length > 0) {
      log(`WARNING: Could not map these fields: ${unmappedKeys.join(', ')}`);
    }
  }
  
  // Build row data matching header order
  const rowData = [];
  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i]).toLowerCase();
    
    // Find matching key in record (case-insensitive)
    let value = null;
    for (const key of recordKeys) {
      if (key.toLowerCase() === header) {
        value = record[key];
        break;
      }
    }
    
    rowData.push(value !== null && value !== undefined ? value : '');
  }
  
  // Append the row
  sheet.appendRow(rowData);
}
```

---

## 7. Change #3: Config_KPIs as Single Source of Truth

### Current Issue
KPIs are identified by multiple names:
- `kpi_id`: "MKT_CORE_001" or "total_leads"
- `name`: "Total Marketing Spend" or "Total Leads"
- Form question title: "Total Marketing Spend"
- Clients column: should be `kpi_id`

### Principle
**All code should reference KPIs by `kpi_id` only.**

- Form questions use `name` for display, but map to `kpi_id` internally
- Clients sheet columns use `kpi_id` 
- Formulas reference `kpi_id`
- Validation rules reference `kpi_id`

### Already Correct
- FormManager creates questions from `name`, which is correct for UX
- `buildFormColumnMapping()` maps `name` → `kpi_id`

### Needs Update
- Ensure ALL calculated KPI formulas use `kpi_id`, not `name`
- Ensure ALL validation rules use `kpi_id`

---

## 8. Change #4: Results Generator Updates

### Current State
`ResultsGenerator.gs` reads from Config_KPIs and should work correctly IF the Clients sheet has the right columns.

### Verify This Logic
```javascript
function generateResults(clientId) {
  const clientData = getClientData(clientId);  // Reads from Clients sheet
  const kpiConfig = loadKPIConfig();           // Reads from Config_KPIs
  
  // For each KPI in config...
  for (const kpi of kpiConfig) {
    const value = clientData.rawInputs[kpi.id];  // ← Uses kpi.id
    // If Clients sheet doesn't have column kpi.id, value = undefined
  }
}
```

### No Code Change Needed
Once Clients sheet has correct columns, Results will work.

---

## 9. Change #5: Validation Engine Updates

### Ensure KPI ID Consistency

Validation rules in `Config_Validations` must use `kpi_id` values that match:
1. Clients sheet column names
2. Config_KPIs `kpi_id` values

### Example Validation Rule
```
rule_id: recon_revenue_calculation
formula: RECONCILE:jobs_closed*average_ticket:gross_revenue
affected_kpis: gross_revenue,jobs_closed,average_ticket
```

These KPI IDs (`jobs_closed`, `average_ticket`, `gross_revenue`) must:
- Exist in Config_KPIs as `kpi_id`
- Exist in Clients sheet as column headers

### Validation Check Function
```javascript
/**
 * Validate that all KPI IDs in validation rules exist in Config_KPIs
 * Run this during system initialization
 */
function validateRuleKPIReferences() {
  const kpiConfig = loadKPIConfig();
  const validIds = new Set(kpiConfig.map(k => k.id.toLowerCase()));
  
  const validationConfig = loadValidationConfig();
  const issues = [];
  
  for (const rule of validationConfig) {
    if (!rule.affectedKPIs) continue;
    
    const kpiIds = rule.affectedKPIs.split(',').map(id => id.trim().toLowerCase());
    
    for (const kpiId of kpiIds) {
      if (!validIds.has(kpiId)) {
        issues.push({
          ruleId: rule.ruleId,
          invalidKPI: kpiId
        });
      }
    }
  }
  
  if (issues.length > 0) {
    log('WARNING: Validation rules reference invalid KPI IDs:');
    issues.forEach(i => log(`  Rule ${i.ruleId}: unknown KPI "${i.invalidKPI}"`));
  }
  
  return issues;
}
```

---

## 10. Implementation Plan

### Phase 1: Immediate Fix (Do Now)

**Goal**: Make the current form submission work

1. **Manually add missing columns to Clients sheet**
   - Open Clients sheet
   - Add columns after `reported_booking_rate`:
     ```
     MKT_CORE_001, CSR_CORE_005, total_capacity, FIN_CORE_002, 
     total_overhead_costs, FLD_CORE_010, FLD_CORE_003, FLD_CORE_004,
     HR_CORE_003, HR_CORE_008, FIN_CORE_001, SAL_CORE_003
     ```
   - Re-submit test form
   - Verify data appears in all columns
   - Re-run analysis

**Time**: 15 minutes

### Phase 2: Auto-Sync Function (This Week)

**Goal**: Never have this problem again

1. **Add `syncClientsSchema()` function** to ClientManager.gs or new SchemaManager.gs
2. **Add menu option** to manually sync schema
3. **Call automatically** on system initialization
4. **Call automatically** when form is created/synced

**Time**: 2-3 hours

### Phase 3: Write Protection (Next Sprint)

**Goal**: Prevent silent data loss

1. **Update `writeClientRecord()`** to auto-add columns
2. **Add logging** for any unmapped fields
3. **Add validation** on form submission to verify all fields mapped

**Time**: 2-3 hours

### Phase 4: Full Modularity (Future)

**Goal**: True configuration-driven system

1. **Config_KPIs drives everything**:
   - Form questions
   - Clients columns
   - Calculations
   - Validation
   - Results output

2. **Single function** to regenerate entire system from config:
   ```javascript
   function regenerateSystem() {
     syncClientsSchema();      // Update Clients columns
     syncFormWithConfig();     // Update form questions  
     validateConfiguration();  // Check for issues
   }
   ```

**Time**: 1-2 days

---

## 11. Testing Checklist

### After Phase 1 (Manual Fix)

- [ ] Clients sheet has all 12 new columns
- [ ] Submit test form with all fields populated
- [ ] Verify Form Responses sheet has all values
- [ ] Verify Clients sheet has all values (no blanks except optional fields)
- [ ] Run analysis
- [ ] Verify Results shows actual values (not "No data provided")
- [ ] Verify Validation runs on all fields

### After Phase 2 (Auto-Sync)

- [ ] Delete one column from Clients sheet
- [ ] Run syncClientsSchema()
- [ ] Verify column is re-added
- [ ] Add new KPI to Config_KPIs
- [ ] Run syncClientsSchema()
- [ ] Verify new column appears in Clients sheet
- [ ] Submit form
- [ ] Verify new KPI data is captured

### After Phase 3 (Write Protection)

- [ ] Submit form with a KPI that has no Clients column
- [ ] Verify column is auto-created
- [ ] Verify log shows column addition
- [ ] Verify data is saved correctly

---

## Appendix A: Column Mapping Reference

### Current Onboarding KPIs → Required Clients Columns

| Form Question | KPI ID | Clients Column | Status |
|---------------|--------|----------------|--------|
| Number of Employees | num_employees | num_employees | ✓ Exists |
| Number of Technicians | num_techs | num_techs | ✓ Exists |
| Number of Vehicles | num_vehicles | num_vehicles | ✓ Exists |
| Total Marketing Spend | MKT_CORE_001 | MKT_CORE_001 | ✗ MISSING |
| Total Leads | total_leads | total_leads | ✓ Exists |
| Total Booked Jobs | CSR_CORE_005 | CSR_CORE_005 | ✗ MISSING |
| Jobs Closed | jobs_closed | jobs_closed | ✓ Exists |
| Total Capacity | total_capacity | total_capacity | ✗ MISSING |
| Gross Revenue | gross_revenue | gross_revenue | ✓ Exists |
| Total COGS | FIN_CORE_002 | FIN_CORE_002 | ✗ MISSING |
| Total Overhead Costs | total_overhead_costs | total_overhead_costs | ✗ MISSING |
| Total Jobs Inspected | FLD_CORE_010 | FLD_CORE_010 | ✗ MISSING |
| Total Jobs Failed QC | FLD_CORE_003 | FLD_CORE_003 | ✗ MISSING |
| Total Rework/Callback Jobs | FLD_CORE_004 | FLD_CORE_004 | ✗ MISSING |
| Total Separations | HR_CORE_003 | HR_CORE_003 | ✗ MISSING |
| Total Open Positions | HR_CORE_008 | HR_CORE_008 | ✗ MISSING |
| Reported Close Rate | reported_close_rate | reported_close_rate | ✓ Exists |
| Average Ticket | average_ticket | average_ticket | ✓ Exists |

**Summary**: 8 exist, 10 missing

---

## Appendix B: Quick Fix Script

Run this in Apps Script to add missing columns:

```javascript
function addMissingOnboardingColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Clients');
  
  const missingColumns = [
    'MKT_CORE_001',
    'CSR_CORE_005', 
    'total_capacity',
    'FIN_CORE_002',
    'total_overhead_costs',
    'FLD_CORE_010',
    'FLD_CORE_003',
    'FLD_CORE_004',
    'HR_CORE_003',
    'HR_CORE_008',
    'FIN_CORE_001',
    'SAL_CORE_003'
  ];
  
  const lastCol = sheet.getLastColumn();
  
  for (let i = 0; i < missingColumns.length; i++) {
    sheet.getRange(1, lastCol + 1 + i).setValue(missingColumns[i]);
  }
  
  SpreadsheetApp.getActiveSpreadsheet().toast(
    `Added ${missingColumns.length} columns`,
    'Schema Updated',
    5
  );
}
```

---

*End of Modularity Fix Documentation*
