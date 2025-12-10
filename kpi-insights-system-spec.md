# KPI Insights System Specification

**Version**: 2.0
**Date**: December 9, 2024
**Status**: Ready for Implementation

---

## Overview

The Insights System generates plain-English findings and recommendations based on KPI performance. Insights are **fully configurable via spreadsheet** — no code changes needed to add, edit, or remove insights.

**Key Features**:
- Config-driven insight rules (Config_Insights sheet)
- Single-KPI and composite (multi-KPI) triggers
- Template-based messaging with placeholders
- Section-grouped output
- **NEW**: Operational Visibility Gap detection for missing data

---

## Table of Contents

1. [Visibility Gap Detection (NEW)](#1-visibility-gap-detection)
2. [Config_Insights Sheet Schema](#2-config_insights-sheet-schema)
3. [Insight Types & Trigger Logic](#3-insight-types--trigger-logic)
4. [Template System](#4-template-system)
5. [Results Output Format](#5-results-output-format)
6. [Implementation Guide](#6-implementation-guide)

---

## 1. Visibility Gap Detection

### Purpose

Missing critical inputs are **not neutral** — they indicate operational visibility problems. This is the foundation of **Pillar 1: Operational Visibility**.

If a user doesn't know their total leads, close rate, or COGS, that IS the diagnosis.

### How It Works

1. Each input KPI in Config_KPIs has a `visibility_flag` column
2. When an input is blank/null, system checks its visibility_flag
3. If flagged, generates a "Visibility Gap" insight
4. Visibility gaps appear FIRST in the Insights section

### Config_KPIs Column Additions

Add these columns to Config_KPIs:

| Column Name | Data Type | Values | Description |
|-------------|-----------|--------|-------------|
| `visibility_flag` | Text | `critical`, `important`, `helpful`, *(blank)* | Severity if this KPI is missing |
| `missing_message` | Text | Free text | Custom message explaining why this matters |
| `missing_recommendation` | Text | Free text | What to do to start tracking this |

### Visibility Flag Tiers

| Flag | Severity | Meaning | Example KPIs |
|------|----------|---------|--------------|
| `critical` | 🔴 Red | Cannot assess business without this | total_leads, gross_revenue, jobs_closed, num_employees, num_techs |
| `important` | 🟠 Orange | Needed for meaningful analysis | FIN_CORE_002, total_overhead_costs, CSR_CORE_005, reported_close_rate |
| `helpful` | 🟡 Yellow | Enhances analysis but not essential | FLD_CORE_010, HR_CORE_003, FLD_CORE_004 |
| *(blank)* | — | No insight if missing | Optional/detailed metrics |

### Recommended KPI Visibility Flags

**Critical (must know)**:
```
num_employees          → "You don't know your headcount"
num_techs              → "You don't know how many technicians you have"
total_leads            → "You don't know how many leads you're getting"
gross_revenue          → "You don't know your revenue"
jobs_closed            → "You don't know how many jobs you completed"
```

**Important (should know)**:
```
CSR_CORE_005 (booked)  → "You don't know your booking volume"
FIN_CORE_002 (COGS)    → "You don't know your direct job costs"
total_overhead_costs   → "You don't know your overhead costs"
reported_close_rate    → "You don't know your close rate"
total_capacity         → "You don't know your capacity"
MKT_CORE_001 (mkt $)   → "You don't know your marketing spend"
```

**Helpful (nice to know)**:
```
FLD_CORE_010 (inspected)   → "You're not tracking QC inspections"
FLD_CORE_003 (failed QC)   → "You're not tracking QC failures"
FLD_CORE_004 (rework)      → "You're not tracking rework/callbacks"
HR_CORE_003 (separations)  → "You're not tracking employee turnover"
```

### Visibility Gap Output Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ OPERATIONAL VISIBILITY GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 Critical: Lead Volume Unknown
   You left "Total Leads" blank. Without this, you can't measure
   marketing ROI, booking rate, or cost per lead.

   → Set up call tracking or log inquiries in a CRM
   → This is foundational data — prioritize this first

🟠 Important: Cost of Goods Sold Unknown
   You left "Total COGS" blank. Without this, you can't calculate
   true profit margin or job-level profitability.

   → Work with your bookkeeper to separate COGS from overhead
   → Track materials + subcontractor costs per job

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 VISIBILITY SUMMARY: 2 of 12 critical metrics missing
   Pillar 1 (Operational Visibility) needs attention before
   performance analysis can provide meaningful insights.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Visibility Gap Logic

```javascript
function generateVisibilityGapInsights(allValues, kpiConfig) {
  const gaps = [];

  // Only check input KPIs with visibility flags
  const flaggedInputs = kpiConfig.filter(k =>
    k.type === 'input' &&
    k.visibilityFlag &&
    k.active === true
  );

  for (const kpi of flaggedInputs) {
    const value = allValues[kpi.id];

    // Check if value is missing (null, undefined, empty, or NaN)
    if (isEmpty(value)) {
      gaps.push({
        kpiId: kpi.id,
        kpiName: kpi.name,
        severity: kpi.visibilityFlag,  // critical, important, helpful
        message: kpi.missingMessage || `You don't know your ${kpi.name.toLowerCase()}`,
        recommendation: kpi.missingRecommendation || 'Start tracking this metric'
      });
    }
  }

  // Sort by severity (critical first, then important, then helpful)
  const severityOrder = { critical: 1, important: 2, helpful: 3 };
  gaps.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return gaps;
}
```

---

## 2. Config_Insights Sheet Schema

### Sheet Structure

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `insight_id` | Text | Yes | Unique identifier (snake_case) |
| `insight_type` | Text | Yes | `single` or `composite` |
| `kpi_ids` | Text | Yes | Comma-separated KPI IDs |
| `trigger_logic` | Text | Yes | Rating condition(s) to trigger |
| `title` | Text | Yes | Insight heading |
| `status` | Text | Yes | `good`, `concern`, `warning` |
| `summary_template` | Text | Yes | One-line summary with placeholders |
| `detail_template` | Text | No | Extended explanation |
| `recommendations` | Text | No | Pipe-separated recommendations |
| `section_id` | Integer | Yes | Business section (1-9) |
| `affected_sections` | Text | No | Additional sections (comma-separated) |
| `form_tier` | Text | Yes | `onboarding`, `detailed`, `section_deep` |
| `priority` | Integer | Yes | Display order (lower = first) |
| `active` | Boolean | Yes | TRUE/FALSE |

### Example Rows

**Single-KPI Insight**:
```
insight_id: booking_good
insight_type: single
kpi_ids: booking_rate
trigger_logic: good+
title: Booking Performance
status: good
summary_template: Your booking rate of {value}% is above average.
detail_template: Good performance converting leads to appointments.
recommendations: Document what's working for your CSR team|Consider if you can scale lead volume
section_id: 2
form_tier: onboarding
priority: 10
active: TRUE
```

**Composite Insight** (multiple KPIs):
```
insight_id: funnel_leak
insight_type: composite
kpi_ids: booking_rate,close_rate
trigger_logic: booking_rate:good+ AND close_rate:poor-
title: Sales Funnel Leak
status: concern
summary_template: Marketing is generating leads, but sales isn't converting them.
detail_template: Booking rate of {booking_rate}% is strong, but close rate of {close_rate}% is below average.
recommendations: Focus on sales process, not lead generation|Review why appointments aren't closing|Consider sales training
section_id: 3
form_tier: onboarding
priority: 5
active: TRUE
```

---

## 3. Insight Types & Trigger Logic

### Single-KPI Triggers

| Trigger | Meaning | Example |
|---------|---------|---------|
| `critical` | Exactly critical rating | `critical` |
| `poor` | Exactly poor rating | `poor` |
| `poor-` | Poor or worse (poor, critical) | `poor-` |
| `average` | Exactly average rating | `average` |
| `good` | Exactly good rating | `good` |
| `good+` | Good or better (good, excellent) | `good+` |
| `excellent` | Exactly excellent rating | `excellent` |
| `any` | Any rating (always triggers if KPI has value) | `any` |

### Composite Triggers

Multiple conditions joined with `AND`:

```
booking_rate:good+ AND close_rate:poor-
```

**Meaning**: Triggers when booking_rate is good or better AND close_rate is poor or worse.

### Trigger Evaluation Logic

```javascript
function evaluateTrigger(triggerLogic, kpiRatings) {
  // Split on AND
  const conditions = triggerLogic.split(/\s+AND\s+/i);

  // ALL conditions must be true
  for (const condition of conditions) {
    const [kpiId, ratingCondition] = condition.split(':');
    const actualRating = kpiRatings[kpiId.trim()];

    if (!matchesRatingCondition(actualRating, ratingCondition.trim())) {
      return false;
    }
  }

  return true;
}

function matchesRatingCondition(actual, condition) {
  const ratingOrder = { critical: 1, poor: 2, average: 3, good: 4, excellent: 5 };
  const actualOrder = ratingOrder[actual?.toLowerCase()];

  if (!actualOrder) return false;

  if (condition === 'any') return true;

  // Handle range conditions
  if (condition.endsWith('-')) {
    const baseRating = condition.slice(0, -1);
    return actualOrder <= ratingOrder[baseRating];
  }

  if (condition.endsWith('+')) {
    const baseRating = condition.slice(0, -1);
    return actualOrder >= ratingOrder[baseRating];
  }

  // Exact match
  return actual?.toLowerCase() === condition.toLowerCase();
}
```

---

## 4. Template System

### Placeholder Types

**Universal Placeholders** (always available):
```
{company_name}  → Client's company name
{industry}      → Client's industry
{state}         → Client's state
```

**Single-KPI Placeholders** (when insight_type = single):
```
{value}              → Raw value (e.g., 75)
{value_formatted}    → Formatted value (e.g., "75.0%")
{value_rounded}      → Rounded integer (e.g., 75)
{kpi_name}           → KPI display name (e.g., "Booking Rate")
{rating}             → Rating label (e.g., "Good")
{benchmark_good}     → Good threshold from benchmark
{benchmark_poor}     → Poor threshold from benchmark
```

**Composite Placeholders** (use KPI ID as prefix):
```
{booking_rate}           → Raw value
{booking_rate_formatted} → Formatted value
{booking_rate_rating}    → Rating
{close_rate}             → Raw value
{close_rate_formatted}   → Formatted value
{close_rate_rating}      → Rating
```

### Template Examples

**Single-KPI**:
```
summary_template: Your {kpi_name} of {value_formatted} is {rating}.
→ "Your Booking Rate of 75.0% is Good."
```

**Composite**:
```
summary_template: Strong lead conversion ({booking_rate_formatted}) but weak close rate ({close_rate_formatted}).
→ "Strong lead conversion (75.0%) but weak close rate (32.0%)."
```

### Recommendations Format

Pipe-separated list (max 5):
```
recommendations: Review CSR scripts|Add call tracking|Train on objection handling
```

Output:
```
→ Review CSR scripts
→ Add call tracking
→ Train on objection handling
```

---

## 5. Results Output Format

### Section Order

1. **Operational Visibility Gaps** (if any missing critical/important inputs)
2. **Data Quality** (validation results)
3. **Section-Grouped Insights** (grouped by business section)

### Full Output Example

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSIGHTS & FINDINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ OPERATIONAL VISIBILITY GAPS

🔴 Critical: Lead Volume Unknown
   You left "Total Leads" blank.
   → Set up call tracking or CRM to log all inquiries

📊 1 of 12 critical metrics missing — address visibility gaps first.

────────────────────────────────────────────────────────────────────

📊 DATA QUALITY
✓ Data Quality
  Your data is internally consistent with no validation errors.

────────────────────────────────────────────────────────────────────

📞 CSR / CALL CENTER (Section 2)

✓ Booking Performance [GOOD]
  Your booking rate of 75.0% is above average.
  → Document what's working for your CSR team
  → Consider if you can scale lead volume

────────────────────────────────────────────────────────────────────

💼 SALES (Section 3)

⚠️ Sales Funnel Leak [CONCERN]
  Marketing is generating leads, but sales isn't converting them.
  Booking rate of 75.0% is strong, but close rate of 32.0% is below average.
  → Focus on sales process, not lead generation
  → Review why appointments aren't closing
  → Consider sales training

────────────────────────────────────────────────────────────────────

🔧 FIELD OPERATIONS (Section 4)

✓ No issues identified in this area.

────────────────────────────────────────────────────────────────────

💰 FINANCE/ACCOUNTING (Section 7)

✓ Profitability [GOOD]
  Profit margin of 28.5% is healthy for your industry.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section Icons

| Section ID | Name | Icon |
|------------|------|------|
| 1 | Marketing | 📣 |
| 2 | CSR/Call Center | 📞 |
| 3 | Sales | 💼 |
| 4 | Field Operations | 🔧 |
| 5 | Scheduling/Dispatch | 📅 |
| 6 | Inventory/Warehouse | 📦 |
| 7 | Finance/Accounting | 💰 |
| 8 | HR/Training | 👥 |
| 9 | Management | 📊 |

### Status Icons

| Status | Icon | Color |
|--------|------|-------|
| good | ✓ | Green |
| warning | ⚠️ | Orange |
| concern | ⚠️ | Red |

### Sorting Within Sections

1. Status severity: concern → warning → good
2. Priority number: lower first

---

## 6. Implementation Guide

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| **Config_Insights** | Create sheet | Store insight rules |
| **Config_KPIs** | Add columns | visibility_flag, missing_message, missing_recommendation |
| **Config.gs** | Add function | `loadInsightConfig()` |
| **InsightsEngine.gs** | Rewrite | Modular insight generation |
| **ResultsGenerator.gs** | Update | Section-grouped output |

### Config.gs Addition

```javascript
/**
 * Load insight configuration from Config_Insights sheet
 * @returns {Object[]} Array of insight rule objects
 */
function loadInsightConfig() {
  const sheet = getRequiredSheet('Config_Insights');
  const data = sheetToObjects(sheet);

  return data
    .filter(row => row.active === true || row.active === 'TRUE')
    .map(row => ({
      id: row.insight_id,
      type: row.insight_type,  // 'single' or 'composite'
      kpiIds: String(row.kpi_ids || '').split(',').map(s => s.trim()),
      triggerLogic: row.trigger_logic,
      title: row.title,
      status: row.status,
      summaryTemplate: row.summary_template,
      detailTemplate: row.detail_template || '',
      recommendations: parseRecommendations(row.recommendations),
      sectionId: parseInt(row.section_id) || 0,
      affectedSections: parseIntList(row.affected_sections),
      formTier: row.form_tier || 'onboarding',
      priority: parseInt(row.priority) || 99
    }));
}

function parseRecommendations(str) {
  if (!str) return [];
  return String(str).split('|').map(s => s.trim()).filter(s => s).slice(0, 5);
}

function parseIntList(str) {
  if (!str) return [];
  return String(str).split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
}
```

### InsightsEngine.gs Core Functions

```javascript
/**
 * Generate all insights for a client
 * @param {Object} clientData - Client data object
 * @param {Object} allValues - All KPI values (raw + calculated)
 * @param {Object} kpiRatings - Ratings keyed by kpiId {kpiId: {rating, value, benchmark}}
 * @param {Object[]} validationIssues - Validation issues array
 * @param {Object[]} kpiConfig - KPI definitions
 * @param {Object[]} insightConfig - Insight rules from Config_Insights
 * @param {Object[]} sectionConfig - Section definitions
 * @param {Object} benchmarks - Benchmarks keyed by kpiId
 * @returns {Object} {visibilityGaps, dataQuality, insights}
 */
function generateAllInsights(clientData, allValues, kpiRatings, validationIssues, kpiConfig, insightConfig, sectionConfig, benchmarks) {

  // 1. Generate visibility gap insights
  const visibilityGaps = generateVisibilityGapInsights(allValues, kpiConfig);

  // 2. Generate data quality insight
  const dataQuality = generateDataQualityInsight(validationIssues);

  // 3. Generate config-driven insights
  const insights = generateConfigInsights(clientData, allValues, kpiRatings, insightConfig, kpiConfig, benchmarks);

  // 4. Group insights by section
  const groupedInsights = groupInsightsBySection(insights, sectionConfig);

  return {
    visibilityGaps,
    dataQuality,
    groupedInsights
  };
}

/**
 * Generate insights based on Config_Insights rules
 */
function generateConfigInsights(clientData, allValues, kpiRatings, insightConfig, kpiConfig, benchmarks) {
  const triggeredInsights = [];

  for (const rule of insightConfig) {
    // Check if all required KPIs have ratings
    const hasAllRatings = rule.kpiIds.every(id => kpiRatings[id]?.rating);
    if (!hasAllRatings) continue;

    // Evaluate trigger condition
    if (!evaluateTrigger(rule.triggerLogic, kpiRatings)) continue;

    // Build template context
    const context = buildTemplateContext(rule, allValues, kpiRatings, benchmarks, kpiConfig, clientData);

    // Generate insight
    triggeredInsights.push({
      id: rule.id,
      title: rule.title,
      status: rule.status,
      summary: replaceTemplatePlaceholders(rule.summaryTemplate, context),
      detail: replaceTemplatePlaceholders(rule.detailTemplate, context),
      recommendations: rule.recommendations,
      sectionId: rule.sectionId,
      priority: rule.priority
    });
  }

  return triggeredInsights;
}

/**
 * Group insights by section and sort within each group
 */
function groupInsightsBySection(insights, sectionConfig) {
  const grouped = {};

  // Initialize all sections
  for (const section of sectionConfig) {
    grouped[section.sectionId] = {
      sectionId: section.sectionId,
      sectionName: section.sectionName,
      icon: getSectionIcon(section.sectionId),
      insights: []
    };
  }

  // Assign insights to sections
  for (const insight of insights) {
    if (grouped[insight.sectionId]) {
      grouped[insight.sectionId].insights.push(insight);
    }
  }

  // Sort insights within each section
  const statusOrder = { concern: 1, warning: 2, good: 3 };
  for (const sectionId of Object.keys(grouped)) {
    grouped[sectionId].insights.sort((a, b) => {
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      return a.priority - b.priority;
    });
  }

  return grouped;
}
```

---

## Config_KPIs Column Additions (Quick Reference)

Add these 3 columns after the existing columns:

| Column | Position | Values | Example |
|--------|----------|--------|---------|
| `visibility_flag` | After `tool_notes` | `critical`, `important`, `helpful`, or blank | `critical` |
| `missing_message` | After `visibility_flag` | Free text | `You don't know how many leads you're getting` |
| `missing_recommendation` | After `missing_message` | Free text | `Set up call tracking or log inquiries in a CRM` |

### Sample Data for Key KPIs

```
kpi_id              | visibility_flag | missing_message                                    | missing_recommendation
--------------------|-----------------|---------------------------------------------------|------------------------------------------
num_employees       | critical        | You don't know your total headcount               | This should be in your payroll system
num_techs           | critical        | You don't know how many technicians you have      | Count field staff on your payroll
total_leads         | critical        | You don't know how many leads you're getting      | Set up call tracking or log inquiries in a CRM
gross_revenue       | critical        | You don't know your revenue                       | Pull this from your accounting system
jobs_closed         | critical        | You don't know how many jobs you completed        | Check your invoicing or job management system
CSR_CORE_005        | important       | You don't know how many appointments were booked  | Have CSRs log bookings in a CRM or spreadsheet
FIN_CORE_002        | important       | You don't know your cost of goods sold            | Work with your bookkeeper to track COGS monthly
total_overhead_costs| important       | You don't know your overhead costs                | Separate overhead from COGS in your accounting
reported_close_rate | important       | You don't know your close rate                    | Track won vs lost opportunities in your CRM
MKT_CORE_001        | important       | You don't know your marketing spend               | Total all marketing invoices for the period
FLD_CORE_010        | helpful         | You're not tracking QC inspections                | Implement a job inspection checklist process
FLD_CORE_004        | helpful         | You're not tracking rework or callbacks           | Log every callback in your dispatch system
HR_CORE_003         | helpful         | You're not tracking employee turnover             | HR should log all separations
```

---

## Testing Checklist

### Visibility Gap Tests
- [ ] Leave `total_leads` blank → Critical visibility gap generated
- [ ] Leave `FIN_CORE_002` blank → Important visibility gap generated
- [ ] Leave all fields filled → No visibility gaps section shown
- [ ] Leave multiple critical fields blank → All shown, sorted by severity

### Config-Driven Insight Tests
- [ ] booking_rate = Good → "Booking Performance [GOOD]" insight triggers
- [ ] booking_rate = Good AND close_rate = Poor → "Sales Funnel Leak" composite insight triggers
- [ ] All KPIs rated Average → Only average-trigger insights fire
- [ ] Insight with inactive = FALSE → Does not appear

### Output Format Tests
- [ ] Insights grouped under correct section headers
- [ ] Within sections, concerns appear before warnings before good
- [ ] Empty sections show "No issues identified"
- [ ] Recommendations limited to 5 max

---

## Estimated Implementation Time

| Task | Time |
|------|------|
| Create Config_Insights sheet with initial rules | 1-2 hours |
| Add columns to Config_KPIs + populate flags | 1 hour |
| Update Config.gs (loadInsightConfig, loadKPIConfig) | 1 hour |
| Rewrite InsightsEngine.gs | 3-4 hours |
| Update ResultsGenerator.gs for new output format | 2-3 hours |
| Testing & refinement | 2-3 hours |
| **Total** | **10-14 hours** |

---

*End of Specification*