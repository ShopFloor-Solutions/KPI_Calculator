# KPI Analyzer — Benchmark System Specification

**Date**: December 9, 2024  
**Priority**: HIGH  
**Prepared by**: Claude (AI Assistant)  
**For**: Lead Developer

---

## Executive Summary

The benchmark system compares client KPI values against industry/location-specific thresholds to rate performance as Critical/Poor/Average/Good/Excellent. This spec covers:

1. Schema updates to Config_Benchmarks (add `direction` column)
2. Corrected rating logic (fix threshold interpretation)
3. Results sheet updates (add Rating + Benchmark columns with color coding)
4. Support for inverse KPIs (lower is better)

---

## Table of Contents

1. [Config_Benchmarks Schema](#1-config_benchmarks-schema)
2. [Rating Logic](#2-rating-logic)
3. [Benchmark Lookup with Priority Matching](#3-benchmark-lookup-with-priority-matching)
4. [Results Sheet Updates](#4-results-sheet-updates)
5. [Code Changes Required](#5-code-changes-required)
6. [Testing Checklist](#6-testing-checklist)

---

## 1. Config_Benchmarks Schema

### Current Columns

| Column | Type | Description |
|--------|------|-------------|
| kpi_id | string | KPI identifier (must match Config_KPIs) |
| industry | string | "all" or specific (hvac, plumbing, roofing, electrical) |
| state | string | "all" or specific (california, ontario, texas, etc.) |
| poor | number | Threshold for poor performance |
| average | number | Threshold for average performance |
| good | number | Threshold for good performance |
| excellent | number | Threshold for excellent performance |
| notes | string | Optional explanation |

### New Column Required

| Column | Type | Description | Default |
|--------|------|-------------|---------|
| **direction** | string | `"higher"` = higher is better, `"lower"` = lower is better | `"higher"` |

### Updated Schema

```
kpi_id | industry | state | poor | average | good | excellent | direction | notes
```

### Example Data

```
# Standard KPIs (higher is better)
close_rate      | all      | all        | 20  | 35  | 50  | 65  | higher | % of appointments that close
booking_rate    | all      | all        | 30  | 50  | 70  | 85  | higher | % of leads that book
profit_margin   | all      | all        | 5   | 12  | 20  | 30  | higher | Net profit %

# Inverse KPIs (lower is better)
rework_rate     | all      | all        | 15  | 10  | 5   | 2   | lower  | % jobs requiring callback
cost_per_lead   | all      | all        | 200 | 150 | 100 | 50  | lower  | Marketing cost per lead
admin_ratio     | all      | all        | 0.5 | 0.35| 0.25| 0.15| lower  | Admin staff per tech

# Industry-specific
close_rate      | hvac     | all        | 25  | 40  | 55  | 70  | higher | HVAC typically higher
close_rate      | roofing  | all        | 30  | 45  | 60  | 75  | higher | Roofing urgency drives closes

# Location-specific
profit_margin   | all      | california | 8   | 15  | 23  | 33  | higher | Higher COL requires higher margins
```

### Threshold Interpretation

**For `direction: "higher"` (higher is better):**
```
Thresholds: poor=20, average=35, good=50, excellent=65

Value < 20        → Critical (below poor)
Value 20-34       → Poor
Value 35-49       → Average
Value 50-64       → Good
Value ≥ 65        → Excellent
```

**For `direction: "lower"` (lower is better):**
```
Thresholds: poor=15, average=10, good=5, excellent=2

Value > 15        → Critical (above poor)
Value 10.01-15    → Poor
Value 5.01-10     → Average
Value 2.01-5      → Good
Value ≤ 2         → Excellent
```

---

## 2. Rating Logic

### Current Code (INCORRECT)

```javascript
// InsightsEngine.gs - getRating()
function getRating(value, benchmark) {
  if (value < benchmark.poor) return 'poor';      // WRONG interpretation
  if (value < benchmark.average) return 'average';
  if (value < benchmark.good) return 'good';
  return 'excellent';
}
```

**Problem**: Labels don't match threshold names. A value of 25 with `poor=20, average=35` returns "average" but should return "poor".

### Corrected Code

**File**: `InsightsEngine.gs` (or create new `BenchmarkEngine.gs`)

```javascript
/**
 * Rating levels in order of severity
 */
const RATING_LEVELS = {
  CRITICAL: 'critical',
  POOR: 'poor',
  AVERAGE: 'average',
  GOOD: 'good',
  EXCELLENT: 'excellent'
};

/**
 * Get performance rating for a value against benchmark thresholds
 * 
 * @param {number} value - The KPI value to rate
 * @param {Object} benchmark - Benchmark object with poor/average/good/excellent thresholds
 * @param {string} [direction='higher'] - 'higher' = higher is better, 'lower' = lower is better
 * @returns {string} Rating: 'critical', 'poor', 'average', 'good', or 'excellent'
 */
function getRating(value, benchmark, direction = 'higher') {
  if (value === null || value === undefined || isNaN(value)) {
    return null;  // Can't rate missing values
  }
  
  if (!benchmark) {
    return null;  // No benchmark defined for this KPI
  }
  
  const { poor, average, good, excellent } = benchmark;
  
  // Validate benchmark thresholds exist
  if (poor === undefined || average === undefined || 
      good === undefined || excellent === undefined) {
    return null;
  }
  
  if (direction === 'lower') {
    // Lower is better: excellent < good < average < poor
    // Thresholds are in DESCENDING order (poor=15, avg=10, good=5, excellent=2)
    if (value <= excellent) return RATING_LEVELS.EXCELLENT;
    if (value <= good) return RATING_LEVELS.GOOD;
    if (value <= average) return RATING_LEVELS.AVERAGE;
    if (value <= poor) return RATING_LEVELS.POOR;
    return RATING_LEVELS.CRITICAL;  // Above poor threshold
  } else {
    // Higher is better: poor < average < good < excellent
    // Thresholds are in ASCENDING order (poor=20, avg=35, good=50, excellent=65)
    if (value >= excellent) return RATING_LEVELS.EXCELLENT;
    if (value >= good) return RATING_LEVELS.GOOD;
    if (value >= average) return RATING_LEVELS.AVERAGE;
    if (value >= poor) return RATING_LEVELS.POOR;
    return RATING_LEVELS.CRITICAL;  // Below poor threshold
  }
}

/**
 * Get rating with color and display info
 * 
 * @param {number} value - The KPI value
 * @param {Object} benchmark - Benchmark thresholds
 * @param {string} direction - 'higher' or 'lower'
 * @returns {Object} {rating, color, bgColor, icon, comparison}
 */
function getRatingDisplay(value, benchmark, direction = 'higher') {
  const rating = getRating(value, benchmark, direction);
  
  if (!rating) {
    return {
      rating: null,
      color: '#9e9e9e',      // Gray
      bgColor: '#f5f5f5',
      icon: '—',
      comparison: 'No benchmark'
    };
  }
  
  // Define colors for each rating
  const ratingConfig = {
    critical: {
      color: '#b71c1c',       // Dark red text
      bgColor: '#ffcdd2',     // Light red background
      icon: '⬇⬇',
      label: 'Critical'
    },
    poor: {
      color: '#c62828',       // Red text
      bgColor: '#ffebee',     // Very light red
      icon: '⬇',
      label: 'Poor'
    },
    average: {
      color: '#f57c00',       // Orange text
      bgColor: '#fff3e0',     // Light orange
      icon: '➡',
      label: 'Average'
    },
    good: {
      color: '#2e7d32',       // Green text
      bgColor: '#e8f5e9',     // Light green
      icon: '⬆',
      label: 'Good'
    },
    excellent: {
      color: '#1b5e20',       // Dark green text
      bgColor: '#c8e6c9',     // Medium green
      icon: '⬆⬆',
      label: 'Excellent'
    }
  };
  
  const config = ratingConfig[rating];
  
  // Build comparison string
  let comparison = '';
  if (direction === 'lower') {
    comparison = `≤${benchmark.good} is good`;
  } else {
    comparison = `≥${benchmark.good} is good`;
  }
  
  return {
    rating: rating,
    label: config.label,
    color: config.color,
    bgColor: config.bgColor,
    icon: config.icon,
    comparison: comparison
  };
}
```

---

## 3. Benchmark Lookup with Priority Matching

### Priority Order

When looking up a benchmark for a KPI, match in this order:

1. **Exact match**: industry + state (e.g., hvac + california)
2. **Industry match**: industry + all states (e.g., hvac + all)
3. **State match**: all industries + state (e.g., all + california)
4. **Default**: all + all

### Current Code (Config.gs)

The existing `getBenchmarkForKPI()` function already implements this correctly:

```javascript
function getBenchmarkForKPI(kpiId, industry, state) {
  const benchmarks = loadBenchmarkConfig(industry, state);
  // ... priority matching logic
}
```

### Required Update

Update `loadBenchmarkConfig()` to include the new `direction` column:

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
      state: String(row.state || 'all').toLowerCase().trim(),
      poor: parseFloat(row.poor),
      average: parseFloat(row.average),
      good: parseFloat(row.good),
      excellent: parseFloat(row.excellent),
      direction: String(row.direction || 'higher').toLowerCase().trim(),  // NEW
      notes: String(row.notes || '').trim()
    })).filter(b => b.kpiId && !isNaN(b.poor));

    // Filter by industry and state if specified
    if (industry || state) {
      const industryLower = industry ? industry.toLowerCase() : null;
      const stateLower = state ? state.toLowerCase() : null;

      benchmarks = benchmarks.filter(b => {
        const industryMatch = !industryLower || b.industry === 'all' || b.industry === industryLower;
        const stateMatch = !stateLower || b.state === 'all' || b.state === stateLower;
        return industryMatch && stateMatch;
      });
    }

    return benchmarks;
  } catch (e) {
    log('Benchmarks sheet not found or empty - using defaults');
    return getDefaultBenchmarks();
  }
}

/**
 * Get default benchmarks (fallback)
 * @returns {Object[]}
 */
function getDefaultBenchmarks() {
  return [
    { kpiId: 'booking_rate', industry: 'all', state: 'all', poor: 30, average: 50, good: 70, excellent: 85, direction: 'higher' },
    { kpiId: 'close_rate', industry: 'all', state: 'all', poor: 20, average: 35, good: 50, excellent: 65, direction: 'higher' },
    { kpiId: 'profit_margin', industry: 'all', state: 'all', poor: 5, average: 12, good: 20, excellent: 30, direction: 'higher' },
    { kpiId: 'schedule_efficiency', industry: 'all', state: 'all', poor: 60, average: 80, good: 95, excellent: 100, direction: 'higher' },
    { kpiId: 'rework_rate', industry: 'all', state: 'all', poor: 15, average: 10, good: 5, excellent: 2, direction: 'lower' }
  ];
}
```

---

## 4. Results Sheet Updates

### Current Columns

```
KPI Name | Value | Type | Status | Sections | Notes
```

### New Columns

```
KPI Name | Value | Type | Status | Rating | vs Benchmark | Sections | Notes
                          ^        ^        ^
                          |        |        |
                       Validation  |        +-- "≥50% is good"
                                   |
                                   +-- "Good" (color-coded cell)
```

### Column Definitions

| Column | Content | Formatting |
|--------|---------|------------|
| **KPI Name** | Display name | Left-aligned |
| **Value** | Formatted value | Right-aligned |
| **Type** | Input/Calculated | Center |
| **Status** | ✓/⚠/✗/— | Color by validation |
| **Rating** | Critical/Poor/Average/Good/Excellent | **Background color by rating** |
| **vs Benchmark** | "≥50% is good" or "≤5% is good" | Gray text |
| **Sections** | Business sections | Left-aligned |
| **Notes** | Validation messages | Wrap text |

### Rating Column Color Coding

| Rating | Background | Text Color |
|--------|------------|------------|
| Critical | `#ffcdd2` (light red) | `#b71c1c` (dark red) |
| Poor | `#ffebee` (very light red) | `#c62828` (red) |
| Average | `#fff3e0` (light orange) | `#f57c00` (orange) |
| Good | `#e8f5e9` (light green) | `#2e7d32` (green) |
| Excellent | `#c8e6c9` (medium green) | `#1b5e20` (dark green) |
| No Benchmark | `#f5f5f5` (light gray) | `#9e9e9e` (gray) |

### Color Logic for Inverse KPIs (IMPORTANT)

Colors are tied to the **business meaning** (rating), not the raw value:

**Example: rework_rate with direction="lower"**
```
Thresholds: poor=15, avg=10, good=5, excellent=2
Value: 3%

Step 1: getRating(3, benchmark, "lower")
        → 3 <= 5 (good threshold) → Returns "good"

Step 2: getRatingDisplay uses "good" rating
        → Background: light green
        → Text: green
        → Label: "Good"
```

**Result**: A LOW rework_rate shows as GREEN because low is good for this KPI.

**Example: close_rate with direction="higher"**
```
Thresholds: poor=20, avg=35, good=50, excellent=65
Value: 55%

Step 1: getRating(55, benchmark, "higher")
        → 55 >= 50 (good threshold) → Returns "good"

Step 2: getRatingDisplay uses "good" rating
        → Background: light green
        → Text: green
        → Label: "Good"
```

**Result**: A HIGH close_rate shows as GREEN because high is good for this KPI.

The `direction` column controls the rating logic; the rating controls the color. Business owners see green = good, red = bad, regardless of whether the underlying number is high or low.

---

## 5. Code Changes Required

### 5.1 Update Config.gs

Add `direction` to benchmark loading (see Section 3).

### 5.2 Update/Create BenchmarkEngine.gs (or add to InsightsEngine.gs)

Add `getRating()` and `getRatingDisplay()` functions (see Section 2).

### 5.3 Update ResultsGenerator.gs

#### Update COLORS constant

```javascript
const COLORS = {
  // ... existing colors ...
  
  // Benchmark rating colors
  RATING_CRITICAL_BG: '#ffcdd2',
  RATING_CRITICAL_TEXT: '#b71c1c',
  RATING_POOR_BG: '#ffebee',
  RATING_POOR_TEXT: '#c62828',
  RATING_AVERAGE_BG: '#fff3e0',
  RATING_AVERAGE_TEXT: '#f57c00',
  RATING_GOOD_BG: '#e8f5e9',
  RATING_GOOD_TEXT: '#2e7d32',
  RATING_EXCELLENT_BG: '#c8e6c9',
  RATING_EXCELLENT_TEXT: '#1b5e20',
  RATING_NONE_BG: '#f5f5f5',
  RATING_NONE_TEXT: '#9e9e9e'
};
```

#### Update writeKPISection()

```javascript
/**
 * Write a KPI section with benchmark ratings
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} startRow
 * @param {string} sectionTitle
 * @param {string} category
 * @param {Object} allValues
 * @param {Object[]} kpiConfig
 * @param {Object[]} sectionConfig
 * @param {Object[]} validationIssues
 * @param {Object} benchmarks - Benchmarks object keyed by kpiId
 * @param {Object} clientData - Client data for industry/state context
 * @returns {number} Next row number
 */
function writeKPISection(sheet, startRow, sectionTitle, category, allValues, kpiConfig, sectionConfig, validationIssues, benchmarks, clientData) {
  let row = startRow;

  // Section header
  sheet.getRange(row, 1).setValue(sectionTitle);
  sheet.getRange(row, 1, 1, 8).merge();  // Updated for 8 columns
  sheet.getRange(row, 1)
    .setFontSize(14)
    .setFontWeight('bold')
    .setBackground(COLORS.SECTION_HEADER)
    .setFontColor(COLORS.HEADER_TEXT);
  row++;

  // Column headers - UPDATED
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
    
    // Get benchmark rating - NEW
    const benchmark = benchmarks[kpi.id] || null;
    const ratingDisplay = getRatingDisplay(value, benchmark, benchmark?.direction || 'higher');

    const rowData = [
      kpi.name,
      formatValue(value, kpi.dataType),
      capitalizeFirst(kpi.type),
      status.icon,
      ratingDisplay.label || '—',           // NEW: Rating column
      ratingDisplay.comparison || '',        // NEW: vs Benchmark column
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

    // Rating column formatting (col 5) - NEW
    if (ratingDisplay.rating) {
      sheet.getRange(row, 5)
        .setBackground(ratingDisplay.bgColor)
        .setFontColor(ratingDisplay.color)
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

    // Alternating row tint (skip rating column which has its own color)
    if (i % 2 === 1) {
      // Apply alternating color to non-rating columns only
      sheet.getRange(row, 1, 1, 4).setBackground(adjustColor(pillarColor, -5));
      sheet.getRange(row, 6, 1, 3).setBackground(adjustColor(pillarColor, -5));
    }

    row++;
  }

  return row;
}
```

#### Update generateResults() to pass benchmarks

```javascript
function generateResults(clientId, clientData, allValues, validationResult, insights, kpiConfig, sectionConfig) {
  // ... existing code ...

  // Load benchmarks for this client's industry/state - NEW
  const benchmarks = loadBenchmarksForResults(clientData.industry, clientData.state);

  // ... 

  // Volume metrics section - UPDATED to pass benchmarks
  currentRow = writeKPISection(
    resultsSheet,
    currentRow,
    'VOLUME METRICS',
    'volume',
    allValues,
    tierKPIs,
    sectionConfig,
    validationResult.issues,
    benchmarks,        // NEW
    clientData         // NEW
  );

  // ... same for efficiency section ...
}

/**
 * Load benchmarks formatted for Results display
 * @param {string} industry - Client industry
 * @param {string} state - Client state
 * @returns {Object} Benchmarks keyed by kpiId
 */
function loadBenchmarksForResults(industry, state) {
  const benchmarkList = loadBenchmarkConfig(industry, state);
  const benchmarks = {};
  
  for (const b of benchmarkList) {
    // Use first match for each KPI (priority matching already done)
    if (!benchmarks[b.kpiId]) {
      benchmarks[b.kpiId] = {
        poor: b.poor,
        average: b.average,
        good: b.good,
        excellent: b.excellent,
        direction: b.direction || 'higher'
      };
    }
  }
  
  return benchmarks;
}
```

#### Update formatResultsSheet() for new columns

```javascript
function formatResultsSheet(sheet) {
  // Auto-resize columns
  for (let i = 1; i <= 8; i++) {  // Updated from 6 to 8
    sheet.autoResizeColumn(i);
  }

  // Set minimum widths
  if (sheet.getColumnWidth(1) < 180) sheet.setColumnWidth(1, 180);  // KPI Name
  if (sheet.getColumnWidth(5) < 80) sheet.setColumnWidth(5, 80);    // Rating
  if (sheet.getColumnWidth(6) < 100) sheet.setColumnWidth(6, 100);  // vs Benchmark
  if (sheet.getColumnWidth(8) < 250) sheet.setColumnWidth(8, 250);  // Notes

  // Add borders
  const lastRow = sheet.getLastRow();
  if (lastRow > 4) {
    sheet.getRange(5, 1, lastRow - 4, 8).setBorder(
      true, true, true, true, false, false,
      '#cccccc', SpreadsheetApp.BorderStyle.SOLID
    );
  }
}
```

### 5.4 Update initializeBenchmarkConfig() in Config.gs

Add the `direction` column to initialization:

```javascript
function initializeBenchmarkConfig() {
  const sheet = getOrCreateSheet(SHEET_NAMES.CONFIG_BENCHMARKS);

  // Updated headers with 'direction' column
  const headers = ['kpi_id', 'industry', 'state', 'poor', 'average', 'good', 'excellent', 'direction', 'notes'];

  const sampleData = [
    // Standard KPIs (higher is better)
    ['booking_rate', 'all', 'all', 30, 50, 70, 85, 'higher', 'Percentage of leads that become appointments'],
    ['close_rate', 'all', 'all', 20, 35, 50, 65, 'higher', 'Percentage of appointments that become sales'],
    ['profit_margin', 'all', 'all', 5, 12, 20, 30, 'higher', 'Net profit as percentage of revenue'],
    ['schedule_efficiency', 'all', 'all', 60, 80, 95, 100, 'higher', 'Utilization of available capacity'],
    
    // Inverse KPIs (lower is better)
    ['rework_rate', 'all', 'all', 15, 10, 5, 2, 'lower', 'Percentage of jobs requiring callback'],
    ['cost_per_lead', 'all', 'all', 200, 150, 100, 50, 'lower', 'Marketing cost per lead'],
    
    // Industry-specific examples
    ['close_rate', 'hvac', 'all', 25, 40, 55, 70, 'higher', 'HVAC typically has higher close rates'],
    ['close_rate', 'roofing', 'all', 30, 45, 60, 75, 'higher', 'Roofing urgency drives higher closes'],
    
    // State-specific examples
    ['profit_margin', 'all', 'california', 8, 15, 23, 33, 'higher', 'Higher COL requires higher margins'],
    ['profit_margin', 'all', 'ontario', 7, 14, 21, 30, 'higher', 'Ontario market benchmarks']
  ];

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, sampleData.length, headers.length).setValues(sampleData);

  // Delete extra rows
  const lastDataRow = sampleData.length + 1;
  const maxRows = sheet.getMaxRows();
  if (maxRows > lastDataRow + 5) {
    sheet.deleteRows(lastDataRow + 5, maxRows - lastDataRow - 5);
  }

  // Format header row
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff');

  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }

  sheet.setFrozenRows(1);

  log('Initialized Config_Benchmarks sheet with direction support');
}
```

---

## 6. Testing Checklist

### Schema Tests

- [ ] Config_Benchmarks has `direction` column
- [ ] Existing benchmarks default to `direction: "higher"`
- [ ] New benchmarks can be added with `direction: "lower"`

### Rating Logic Tests

**Higher is better (close_rate: poor=20, avg=35, good=50, excellent=65):**
- [ ] Value = 10 → Critical
- [ ] Value = 20 → Poor
- [ ] Value = 34 → Poor
- [ ] Value = 35 → Average
- [ ] Value = 49 → Average
- [ ] Value = 50 → Good
- [ ] Value = 64 → Good
- [ ] Value = 65 → Excellent
- [ ] Value = 90 → Excellent

**Lower is better (rework_rate: poor=15, avg=10, good=5, excellent=2):**
- [ ] Value = 20 → Critical
- [ ] Value = 15 → Poor
- [ ] Value = 14 → Poor
- [ ] Value = 10 → Average
- [ ] Value = 6 → Average
- [ ] Value = 5 → Good
- [ ] Value = 3 → Good
- [ ] Value = 2 → Excellent
- [ ] Value = 1 → Excellent

### Priority Matching Tests

Client: industry=hvac, state=california

- [ ] KPI with hvac+california benchmark → Uses that
- [ ] KPI with hvac+all benchmark → Uses that (no california-specific)
- [ ] KPI with all+california benchmark → Uses that (no hvac-specific)
- [ ] KPI with only all+all benchmark → Uses that

### Results Sheet Tests

- [ ] Results sheet has 8 columns (not 6)
- [ ] Rating column shows correct label (Critical/Poor/Average/Good/Excellent)
- [ ] Rating column has correct background color
- [ ] vs Benchmark column shows "≥50% is good" for higher-is-better
- [ ] vs Benchmark column shows "≤5% is good" for lower-is-better
- [ ] KPIs without benchmarks show "—" in Rating and "No benchmark" in vs Benchmark

### Integration Test

1. [ ] Create client in HVAC industry, California state
2. [ ] Submit form with close_rate = 45%
3. [ ] Run analysis
4. [ ] Verify Results shows:
   - Rating: "Average" (orange background)
   - vs Benchmark: "≥55% is good" (using HVAC-specific thresholds)

---

## Files to Modify

| File | Changes | Priority |
|------|---------|----------|
| `Config.gs` | Add `direction` to `loadBenchmarkConfig()`, update `getDefaultBenchmarks()` | HIGH |
| `Config.gs` | Update `initializeBenchmarkConfig()` with direction column | MEDIUM |
| `InsightsEngine.gs` | Fix `getRating()`, add `getRatingDisplay()` | HIGH |
| `ResultsGenerator.gs` | Add Rating + vs Benchmark columns, color coding | HIGH |
| `ResultsGenerator.gs` | Update `generateResults()` to pass benchmarks | HIGH |
| `ResultsGenerator.gs` | Update column widths and formatting | MEDIUM |

---

## Estimated Time

| Task | Time |
|------|------|
| Schema updates (Config.gs) | 30 minutes |
| Rating logic (InsightsEngine.gs) | 45 minutes |
| Results sheet updates | 1-2 hours |
| Testing | 1 hour |
| **Total** | **3-4 hours** |

---

*End of Benchmark System Specification*
