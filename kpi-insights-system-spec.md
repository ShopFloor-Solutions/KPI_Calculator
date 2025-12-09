# KPI Analyzer — Insights System Specification

**Date**: December 9, 2024  
**Priority**: HIGH  
**Prepared by**: Claude (AI Assistant)  
**For**: Lead Developer

---

## Executive Summary

The Insights System generates actionable findings based on KPI performance against benchmarks. This spec covers:

1. New Config_Insights sheet for modular insight rules
2. Support for single-KPI and composite (multi-KPI) insights
3. Template-based text with placeholders
4. Section-grouped output in Results sheet
5. Proper color coding based on business meaning (not just rating direction)

---

## Table of Contents

1. [Config_Insights Schema](#1-config_insights-schema)
2. [Single-KPI Insights](#2-single-kpi-insights)
3. [Composite Insights (Multi-KPI)](#3-composite-insights-multi-kpi)
4. [Template Placeholders](#4-template-placeholders)
5. [Results Sheet Output](#5-results-sheet-output)
6. [Code Architecture](#6-code-architecture)
7. [Migration from Hardcoded Insights](#7-migration-from-hardcoded-insights)
8. [Testing Checklist](#8-testing-checklist)

---

## 1. Config_Insights Schema

### Sheet Structure

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `insight_id` | string | Yes | Unique identifier (e.g., `booking_poor`, `sales_funnel_leak`) |
| `insight_type` | string | Yes | `single` (one KPI) or `composite` (multiple KPIs) |
| `kpi_ids` | string | Yes | Single KPI ID or comma-separated list |
| `trigger_logic` | string | Yes | Rating condition(s) — see syntax below |
| `title` | string | Yes | Display title (e.g., "Booking Performance") |
| `status` | string | Yes | `concern`, `warning`, `good` — controls icon/color |
| `summary_template` | string | Yes | Summary text with placeholders |
| `detail_template` | string | No | Extended detail text with placeholders |
| `recommendations` | string | No | Pipe-separated list, max 5 (`rec1\|rec2\|rec3`) |
| `section_id` | integer | Yes | Primary section for grouping (1-9) |
| `affected_sections` | string | No | Additional sections (comma-separated) |
| `form_tier` | string | No | `onboarding`, `detailed`, `section_deep`, or blank for all |
| `priority` | integer | No | Display order within section (lower = first). Default: 100 |
| `active` | boolean | Yes | `TRUE` to enable, `FALSE` to disable |

### Trigger Logic Syntax

#### For Single-KPI Insights (`insight_type: single`)

| Syntax | Meaning |
|--------|---------|
| `critical` | Exactly critical rating |
| `poor` | Exactly poor rating |
| `average` | Exactly average rating |
| `good` | Exactly good rating |
| `excellent` | Exactly excellent rating |
| `poor-` | Poor or worse (poor, critical) |
| `good+` | Good or better (good, excellent) |
| `average-` | Average or worse (average, poor, critical) |
| `average+` | Average or better (average, good, excellent) |
| `any` | Any rating (always triggers if KPI has value) |

**Examples:**
```
kpi_ids: close_rate
trigger_logic: poor-
→ Triggers when close_rate is "poor" or "critical"

kpi_ids: booking_rate
trigger_logic: good+
→ Triggers when booking_rate is "good" or "excellent"
```

#### For Composite Insights (`insight_type: composite`)

Use `AND` to combine conditions:

```
kpi_ids: booking_rate,close_rate
trigger_logic: booking_rate:good+ AND close_rate:poor-
```

**Syntax:** `kpi_id:condition AND kpi_id:condition [AND ...]`

**Examples:**
```
# Marketing working but sales failing
kpi_ids: booking_rate,close_rate
trigger_logic: booking_rate:good+ AND close_rate:poor-

# High volume but quality issues
kpi_ids: jobs_closed,rework_rate
trigger_logic: jobs_closed:good+ AND rework_rate:poor-

# Profitable but capacity constrained
kpi_ids: profit_margin,schedule_efficiency
trigger_logic: profit_margin:good+ AND schedule_efficiency:critical
```

---

## 2. Single-KPI Insights

### Example Rows

```
insight_id       | insight_type | kpi_ids      | trigger_logic | title               | status  | summary_template                                          | detail_template                                                         | recommendations                                                                          | section_id | form_tier  | priority | active
-----------------|--------------|--------------|---------------|---------------------|---------|-----------------------------------------------------------|-------------------------------------------------------------------------|------------------------------------------------------------------------------------------|------------|------------|----------|-------
booking_critical | single       | booking_rate | critical      | Booking Performance | concern | Your booking rate of {value}% is critically low.          | This is well below the {benchmark_poor}% minimum. Immediate action needed. | Urgent: Audit CSR call handling|Review lead quality|Check phone system issues           | 2          | onboarding | 10       | TRUE
booking_poor     | single       | booking_rate | poor          | Booking Performance | concern | Your booking rate of {value}% is below average.           | For every 100 leads, only {value_rounded} become appointments. Industry average is {benchmark_avg}%. | Review CSR call scripts and training|Analyze why leads aren't converting|Implement call monitoring | 2 | onboarding | 10 | TRUE
booking_average  | single       | booking_rate | average       | Booking Performance | warning | Your booking rate of {value}% is average.                 | Room to improve from {value}% toward the {benchmark_good}% benchmark.    | Focus on CSR training to improve conversion|Review call handling for improvements       | 2          | onboarding | 10       | TRUE
booking_good     | single       | booking_rate | good+         | Booking Performance | good    | Your booking rate of {value}% is above average.           | Good performance converting leads to appointments.                       | Document what's working|Consider if you can scale lead volume                            | 2          | onboarding | 10       | TRUE
close_critical   | single       | close_rate   | critical      | Sales Performance   | concern | Your close rate of {value}% is critically low.            | Significantly below the {benchmark_poor}% threshold. Urgent attention required. | Urgent: Review entire sales process|Shadow top performers|Invest in sales coaching     | 3          | onboarding | 20       | TRUE
close_poor       | single       | close_rate   | poor          | Sales Performance   | concern | Your close rate of {value}% needs improvement.            | Of your appointments, only {value}% convert to sales. Industry average is {benchmark_avg}%. | Review sales process and presentation|Analyze lost opportunities|Consider sales training | 3 | onboarding | 20 | TRUE
close_average    | single       | close_rate   | average       | Sales Performance   | warning | Your close rate of {value}% is average.                   | Room to improve from {value}% toward {benchmark_good}%.                  | Identify what top performers do differently|Review proposal process                     | 3          | onboarding | 20       | TRUE
close_good       | single       | close_rate   | good+         | Sales Performance   | good    | Your close rate of {value}% is strong.                    | You're converting appointments to sales above average.                   | Maintain quality|Document successful techniques                                          | 3          | onboarding | 20       | TRUE
rework_poor      | single       | rework_rate  | poor-         | Quality Issues      | concern | Rework rate of {value}% is too high.                      | Industry target is below {benchmark_good}%. High rework hurts profitability. | Implement QC checkpoints|Review technician training|Analyze root causes of callbacks   | 4          | detailed   | 30       | TRUE
rework_good      | single       | rework_rate  | good+         | Quality Performance | good    | Your rework rate of {value}% is excellent.                | Below the {benchmark_good}% industry target.                             | Document quality processes|Share best practices across team                              | 4          | detailed   | 30       | TRUE
profit_critical  | single       | profit_margin| critical      | Profitability Alert | concern | You're operating at a loss with {value}% margin.          | Costs exceed revenue. Immediate attention required.                      | Review pricing strategy|Analyze cost structure|Identify unprofitable jobs|Pause growth   | 7          | onboarding | 5        | TRUE
profit_poor      | single       | profit_margin| poor          | Profitability       | concern | Profit margin of {value}% is below healthy levels.        | Industry target is {benchmark_avg}%+. Review your cost structure.        | Review pricing - are you undercharging?|Identify high-cost jobs|Negotiate supplier terms | 7          | onboarding | 15       | TRUE
profit_good      | single       | profit_margin| good+         | Profitability       | good    | Strong profit margin of {value}%.                         | Above the {benchmark_good}% benchmark.                                   | Maintain pricing discipline|Consider strategic investments                                | 7          | onboarding | 15       | TRUE
```

---

## 3. Composite Insights (Multi-KPI)

### Use Cases

| Scenario | KPIs Involved | Business Meaning |
|----------|---------------|------------------|
| Marketing-Sales Disconnect | booking_rate + close_rate | Leads coming in but not closing |
| Volume vs Quality | jobs_closed + rework_rate | High volume but quality suffering |
| Growth vs Capacity | gross_revenue + schedule_efficiency | Growing but can't keep up |
| Sales vs Profit | close_rate + profit_margin | Closing deals but not profitably |

### Example Rows

```
insight_id           | insight_type | kpi_ids                       | trigger_logic                                    | title                    | status  | summary_template                                                                           | detail_template                                                                                             | recommendations                                                                                      | section_id | form_tier  | priority | active
---------------------|--------------|-------------------------------|--------------------------------------------------|--------------------------|---------|--------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------|------------|------------|----------|-------
funnel_leak          | composite    | booking_rate,close_rate       | booking_rate:good+ AND close_rate:poor-          | Sales Funnel Leak        | concern | Marketing is generating leads, but sales isn't converting them.                            | Booking rate of {booking_rate}% is strong, but close rate of {close_rate}% is low. The problem is in sales, not marketing. | Focus on sales process, not lead generation|Review why appointments aren't closing|Sales training may help | 3          | onboarding | 8        | TRUE
volume_quality       | composite    | jobs_closed,rework_rate       | jobs_closed:good+ AND rework_rate:poor-          | Volume vs Quality        | warning | High job volume but quality is suffering.                                                  | Closing {jobs_closed} jobs is great, but {rework_rate}% rework rate indicates rushing.                       | Slow down to maintain quality|Add QC checkpoints|Review technician workloads                           | 4          | detailed   | 25       | TRUE
growth_capacity      | composite    | gross_revenue,schedule_efficiency | gross_revenue:good+ AND schedule_efficiency:critical | Capacity Constraint   | warning | Revenue is strong but you're maxed out on capacity.                                        | {gross_revenue_formatted} revenue with {schedule_efficiency}% capacity utilization means you're at the limit. | Consider hiring|Optimize scheduling|May need to raise prices to manage demand                       | 5          | detailed   | 20       | TRUE
closing_unprofitably | composite    | close_rate,profit_margin      | close_rate:good+ AND profit_margin:poor-         | Closing Unprofitably     | concern | You're closing deals but not making money on them.                                         | Close rate of {close_rate}% is good, but profit margin of {profit_margin}% is concerning.                    | Review pricing - you may be underselling|Analyze job costs|Ensure estimates include all costs         | 3,7        | onboarding | 7        | TRUE
marketing_waste      | composite    | cost_per_lead,booking_rate    | cost_per_lead:poor- AND booking_rate:poor-       | Marketing Inefficiency   | concern | Marketing spend is high but results are poor.                                              | Cost per lead of {cost_per_lead_formatted} is high, and only {booking_rate}% of leads book.                  | Audit marketing channels|Cut underperforming campaigns|Review lead quality vs quantity               | 1          | detailed   | 12       | TRUE
balanced_growth      | composite    | gross_revenue,profit_margin,schedule_efficiency | gross_revenue:good+ AND profit_margin:good+ AND schedule_efficiency:average+ | Healthy Growth | good | Business is growing sustainably with healthy margins and manageable capacity.              | Revenue, profitability, and capacity are all in good balance.                                                | Maintain current trajectory|Consider strategic expansion                                              | 7          | onboarding | 50       | TRUE
```

### Composite Placeholder Access

For composite insights, access each KPI's value using the KPI ID as prefix:

| Placeholder | Description |
|-------------|-------------|
| `{booking_rate}` | booking_rate value |
| `{booking_rate_formatted}` | booking_rate formatted |
| `{close_rate}` | close_rate value |
| `{close_rate_formatted}` | close_rate formatted |
| `{gross_revenue}` | gross_revenue value |
| `{gross_revenue_formatted}` | gross_revenue formatted (e.g., "$125,000") |

---

## 4. Template Placeholders

### Universal Placeholders (All Insights)

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{company_name}` | Client company name | "ABC Plumbing" |
| `{industry}` | Client industry | "HVAC" |
| `{state}` | Client state/province | "California" |

### Single-KPI Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{value}` | Raw KPI value | 45.5 |
| `{value_rounded}` | Rounded to integer | 46 |
| `{value_formatted}` | Formatted per data_type | "45.5%" or "$1,234" |
| `{kpi_name}` | KPI display name | "Close Rate" |
| `{rating}` | Current rating | "Average" |
| `{benchmark_poor}` | Poor threshold | 20 |
| `{benchmark_avg}` | Average threshold | 35 |
| `{benchmark_good}` | Good threshold | 50 |
| `{benchmark_excellent}` | Excellent threshold | 65 |

### Composite-KPI Placeholders

For each KPI in the composite, use `{kpi_id}` and `{kpi_id_formatted}`:

```
kpi_ids: booking_rate,close_rate

Available placeholders:
{booking_rate}           → 72
{booking_rate_formatted} → "72%"
{booking_rate_rating}    → "Good"
{close_rate}             → 25
{close_rate_formatted}   → "25%"
{close_rate_rating}      → "Poor"
```

---

## 5. Results Sheet Output

### Section-Grouped Layout

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSIGHTS & FINDINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 DATA QUALITY
━━━━━━━━━━━━━━━
✓ Data Quality
  Your data is internally consistent with no validation errors.
  All reported metrics reconcile properly.

📣 MARKETING (Section 1)
━━━━━━━━━━━━━━━━━━━━━━━━
[No insights for this section]

📞 CSR / CALL CENTER (Section 2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⬇ Booking Performance                                          [CONCERN]
  Your booking rate of 32% is below average.
  For every 100 leads, only 32 become appointments. Industry average is 50%.
    → Review CSR call scripts and training
    → Analyze why leads aren't converting to appointments
    → Consider implementing call monitoring

💼 SALES (Section 3)
━━━━━━━━━━━━━━━━━━━━
⬇⬇ Sales Funnel Leak                                           [CONCERN]
  Marketing is generating leads, but sales isn't converting them.
  Booking rate of 72% is strong, but close rate of 25% is low.
    → Focus on sales process, not lead generation
    → Review why appointments aren't closing
    → Sales training may help

➡ Sales Performance                                             [WARNING]
  Your close rate of 35% is average.
  Room to improve from 35% toward 50%.
    → Identify what top performers do differently
    → Review proposal process

🔧 FIELD OPERATIONS (Section 4)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⬆ Quality Performance                                           [GOOD]
  Your rework rate of 4% is excellent.
  Below the 5% industry target.
    → Document quality processes
    → Share best practices across team

💰 FINANCE (Section 7)
━━━━━━━━━━━━━━━━━━━━━━
⬆ Profitability                                                 [GOOD]
  Strong profit margin of 22%.
  Above the 20% benchmark.
    → Maintain pricing discipline
    → Consider strategic investments
```

### Section Headers

| Section ID | Icon | Name |
|------------|------|------|
| 1 | 📣 | Marketing |
| 2 | 📞 | CSR / Call Center |
| 3 | 💼 | Sales |
| 4 | 🔧 | Field Operations |
| 5 | 📅 | Scheduling / Dispatch |
| 6 | 📦 | Inventory / Warehouse |
| 7 | 💰 | Finance / Accounting |
| 8 | 👥 | HR / Training |
| 9 | 📋 | Management |

### Status Icons and Colors

| Status | Icon | Text Color | Background |
|--------|------|------------|------------|
| `concern` | ⬇⬇ or ⬇ | `#c62828` (red) | `#ffebee` (light red) |
| `warning` | ➡ | `#f57c00` (orange) | `#fff3e0` (light orange) |
| `good` | ⬆ or ⬆⬆ | `#2e7d32` (green) | `#e8f5e9` (light green) |

### Empty Section Handling

Sections with no insights show a positive confirmation message:

```
📣 MARKETING (Section 1)
━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ No issues identified in this area.
```

This reassures users that the section was evaluated, not skipped.

### Insight Sorting Within Sections

Insights are sorted in two passes:

1. **Status severity** (concerns first, then warnings, then good)
2. **Priority number** (lower = first, within same status)

**Example:**
```
Config_Insights rows:
- booking_good (status: good, priority: 10)
- close_critical (status: concern, priority: 20)
- rework_warning (status: warning, priority: 15)
- profit_poor (status: concern, priority: 25)

Output order:
1. close_critical (concern, priority 20) ← concerns first
2. profit_poor (concern, priority 25)    ← concern, higher priority number
3. rework_warning (warning, priority 15) ← warnings second
4. booking_good (good, priority 10)      ← good last, even though lowest priority number
```

### Maximum Recommendations

Each insight displays a maximum of **5 recommendations**. If more than 5 are provided in the config, only the first 5 are shown.

---

## 6. Code Architecture

### New File: InsightEngine.gs (or update InsightsEngine.gs)

```javascript
/**
 * InsightEngine.gs
 * Generate modular insights from Config_Insights rules
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_RECOMMENDATIONS_PER_INSIGHT = 5;

// ============================================================================
// CONFIGURATION LOADING
// ============================================================================

/**
 * Load insight rules from Config_Insights sheet
 * @param {string} [tier] - Optional form tier filter
 * @returns {Object[]} Array of insight rule objects
 */
function loadInsightConfig(tier = null) {
  const sheet = getRequiredSheet(SHEET_NAMES.CONFIG_INSIGHTS);
  const data = sheetToObjects(sheet);
  
  let insights = data
    .filter(row => row.active === true || row.active === 'TRUE')
    .map(row => ({
      id: String(row.insight_id || '').trim(),
      type: String(row.insight_type || 'single').toLowerCase().trim(),
      kpiIds: parseKpiIds(row.kpi_ids),
      triggerLogic: String(row.trigger_logic || '').trim(),
      title: String(row.title || '').trim(),
      status: String(row.status || 'warning').toLowerCase().trim(),
      summaryTemplate: String(row.summary_template || '').trim(),
      detailTemplate: String(row.detail_template || '').trim(),
      recommendations: parseRecommendations(row.recommendations),
      sectionId: parseInt(row.section_id, 10) || 0,
      affectedSections: parseSections(row.affected_sections),
      formTier: String(row.form_tier || '').toLowerCase().trim(),
      priority: parseInt(row.priority, 10) || 100,
      active: true
    }))
    .filter(i => i.id && i.kpiIds.length > 0 && i.triggerLogic);
  
  // Filter by tier if specified
  if (tier) {
    const tierLower = tier.toLowerCase();
    insights = insights.filter(i => !i.formTier || i.formTier === tierLower);
  }
  
  return insights;
}

/**
 * Parse comma-separated KPI IDs
 */
function parseKpiIds(str) {
  if (!str) return [];
  return String(str).split(',').map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Parse pipe-separated recommendations (max 5)
 */
function parseRecommendations(str) {
  if (!str) return [];
  const recs = String(str).split('|').map(s => s.trim()).filter(s => s.length > 0);
  return recs.slice(0, MAX_RECOMMENDATIONS_PER_INSIGHT);
}

// ============================================================================
// MAIN INSIGHT GENERATION
// ============================================================================

/**
 * Generate all insights for a client
 * @param {Object} clientData - Client data object
 * @param {Object} allValues - All KPI values (raw + calculated)
 * @param {Object[]} validationIssues - Validation issues
 * @param {Object[]} kpiConfig - KPI definitions
 * @param {Object[]} sectionConfig - Section definitions
 * @returns {Object} Insights grouped by section
 */
function generateInsights(clientData, allValues, validationIssues, kpiConfig, sectionConfig) {
  const clientTier = clientData.formTier || '';
  
  // Initialize results structure with all sections
  const insightsBySection = {
    0: [],  // Data Quality (special section)
    1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: []
  };
  
  // 1. Data Quality insight (hardcoded - based on validation)
  const dataQualityInsight = generateDataQualityInsight(validationIssues, kpiConfig);
  if (dataQualityInsight) {
    insightsBySection[0].push(dataQualityInsight);
  }
  
  // 2. Load insight rules and benchmarks
  const insightRules = loadInsightConfig(clientTier);
  const benchmarks = loadBenchmarksForInsights(clientData.industry, clientData.state);
  
  // 3. Build KPI rating map (calculate once, use many times)
  const kpiRatings = buildKPIRatings(allValues, benchmarks, kpiConfig);
  
  // 4. Process each insight rule
  for (const rule of insightRules) {
    const insight = evaluateInsightRule(rule, allValues, kpiRatings, benchmarks, kpiConfig, clientData);
    
    if (insight) {
      insightsBySection[rule.sectionId].push(insight);
    }
  }
  
  // 5. Sort insights within each section: status severity first, then priority
  const statusOrder = { concern: 0, warning: 1, good: 2 };
  
  for (const sectionId in insightsBySection) {
    insightsBySection[sectionId].sort((a, b) => {
      // First sort by status severity (concern > warning > good)
      const statusDiff = (statusOrder[a.status] || 1) - (statusOrder[b.status] || 1);
      if (statusDiff !== 0) return statusDiff;
      
      // Then by priority number (lower = first)
      return (a.priority || 100) - (b.priority || 100);
    });
  }
  
  return insightsBySection;
}

/**
 * Build map of KPI ID → rating info
 */
function buildKPIRatings(allValues, benchmarks, kpiConfig) {
  const ratings = {};
  
  for (const kpiId of Object.keys(allValues)) {
    const value = allValues[kpiId];
    if (isEmpty(value)) continue;
    
    const benchmark = benchmarks[kpiId];
    if (!benchmark) continue;
    
    const direction = benchmark.direction || 'higher';
    const rating = getRating(value, benchmark, direction);
    
    ratings[kpiId] = {
      value: value,
      rating: rating,
      benchmark: benchmark,
      direction: direction
    };
  }
  
  return ratings;
}

/**
 * Evaluate a single insight rule
 * @returns {Object|null} Insight object or null if rule doesn't trigger
 */
function evaluateInsightRule(rule, allValues, kpiRatings, benchmarks, kpiConfig, clientData) {
  // Check if rule triggers
  let triggers = false;
  
  if (rule.type === 'single') {
    triggers = evaluateSingleTrigger(rule.kpiIds[0], rule.triggerLogic, kpiRatings);
  } else if (rule.type === 'composite') {
    triggers = evaluateCompositeTrigger(rule.triggerLogic, kpiRatings);
  }
  
  if (!triggers) return null;
  
  // Build template context
  const context = buildTemplateContext(rule, allValues, kpiRatings, benchmarks, kpiConfig, clientData);
  
  // Generate insight
  return {
    id: rule.id,
    type: rule.type,
    title: rule.title,
    status: rule.status,
    summary: replaceTemplatePlaceholders(rule.summaryTemplate, context),
    detail: replaceTemplatePlaceholders(rule.detailTemplate, context),
    recommendations: rule.recommendations,
    sectionId: rule.sectionId,
    affectedSections: [rule.sectionId, ...rule.affectedSections],
    priority: rule.priority
  };
}

// ============================================================================
// TRIGGER EVALUATION
// ============================================================================

/**
 * Evaluate single-KPI trigger
 * @param {string} kpiId - KPI ID
 * @param {string} triggerLogic - Rating condition (e.g., "poor-", "good+", "average")
 * @param {Object} kpiRatings - Map of KPI ratings
 * @returns {boolean}
 */
function evaluateSingleTrigger(kpiId, triggerLogic, kpiRatings) {
  const ratingInfo = kpiRatings[kpiId];
  if (!ratingInfo) return false;
  
  return matchesRatingCondition(ratingInfo.rating, triggerLogic);
}

/**
 * Evaluate composite trigger (multiple KPIs with AND)
 * @param {string} triggerLogic - e.g., "booking_rate:good+ AND close_rate:poor-"
 * @param {Object} kpiRatings - Map of KPI ratings
 * @returns {boolean}
 */
function evaluateCompositeTrigger(triggerLogic, kpiRatings) {
  // Split by AND
  const conditions = triggerLogic.split(/\s+AND\s+/i);
  
  for (const condition of conditions) {
    // Parse "kpi_id:rating_condition"
    const match = condition.trim().match(/^([a-z_][a-z0-9_]*):(.+)$/i);
    if (!match) {
      log(`Invalid composite condition: ${condition}`);
      return false;
    }
    
    const kpiId = match[1];
    const ratingCondition = match[2];
    
    const ratingInfo = kpiRatings[kpiId];
    if (!ratingInfo) return false;  // KPI not available
    
    if (!matchesRatingCondition(ratingInfo.rating, ratingCondition)) {
      return false;  // Condition not met
    }
  }
  
  return true;  // All conditions met
}

/**
 * Check if a rating matches a condition
 * @param {string} rating - Actual rating (critical, poor, average, good, excellent)
 * @param {string} condition - Condition string (e.g., "poor", "poor-", "good+", "any")
 * @returns {boolean}
 */
function matchesRatingCondition(rating, condition) {
  if (!rating) return false;
  
  const conditionLower = condition.toLowerCase().trim();
  const ratingLower = rating.toLowerCase();
  
  // Rating hierarchy for comparison
  const ratingOrder = {
    'critical': 0,
    'poor': 1,
    'average': 2,
    'good': 3,
    'excellent': 4
  };
  
  const actualOrder = ratingOrder[ratingLower];
  if (actualOrder === undefined) return false;
  
  // Handle special conditions
  if (conditionLower === 'any') return true;
  
  // Handle range conditions
  if (conditionLower.endsWith('-')) {
    // "poor-" means poor or worse (critical, poor)
    const baseRating = conditionLower.slice(0, -1);
    const baseOrder = ratingOrder[baseRating];
    return baseOrder !== undefined && actualOrder <= baseOrder;
  }
  
  if (conditionLower.endsWith('+')) {
    // "good+" means good or better (good, excellent)
    const baseRating = conditionLower.slice(0, -1);
    const baseOrder = ratingOrder[baseRating];
    return baseOrder !== undefined && actualOrder >= baseOrder;
  }
  
  // Exact match
  return ratingLower === conditionLower;
}

// ============================================================================
// TEMPLATE PROCESSING
// ============================================================================

/**
 * Build context object for template replacement
 */
function buildTemplateContext(rule, allValues, kpiRatings, benchmarks, kpiConfig, clientData) {
  const context = {
    company_name: clientData.companyName || '',
    industry: clientData.industry || '',
    state: clientData.state || ''
  };
  
  // Add values for each KPI in the rule
  for (const kpiId of rule.kpiIds) {
    const value = allValues[kpiId];
    const ratingInfo = kpiRatings[kpiId];
    const kpiDef = kpiConfig.find(k => k.id === kpiId);
    const benchmark = benchmarks[kpiId];
    
    // For single-KPI insights, use unprefixed placeholders
    if (rule.type === 'single' && rule.kpiIds.length === 1) {
      context.value = value;
      context.value_rounded = value !== null ? Math.round(value) : '';
      context.value_formatted = formatValue(value, kpiDef?.dataType);
      context.kpi_name = kpiDef?.name || kpiId;
      context.rating = ratingInfo ? capitalizeFirst(ratingInfo.rating) : '';
      context.benchmark_poor = benchmark?.poor;
      context.benchmark_avg = benchmark?.average;
      context.benchmark_good = benchmark?.good;
      context.benchmark_excellent = benchmark?.excellent;
    }
    
    // For all insights (including composite), use prefixed placeholders
    context[kpiId] = value;
    context[`${kpiId}_rounded`] = value !== null ? Math.round(value) : '';
    context[`${kpiId}_formatted`] = formatValue(value, kpiDef?.dataType);
    context[`${kpiId}_rating`] = ratingInfo ? capitalizeFirst(ratingInfo.rating) : '';
    context[`${kpiId}_name`] = kpiDef?.name || kpiId;
  }
  
  return context;
}

/**
 * Replace {placeholder} tokens in template string
 */
function replaceTemplatePlaceholders(template, context) {
  if (!template) return '';
  
  let result = template;
  
  for (const [key, value] of Object.entries(context)) {
    const placeholder = `{${key}}`;
    const replacement = value !== null && value !== undefined ? String(value) : '';
    // Use split/join for global replace (no regex needed)
    result = result.split(placeholder).join(replacement);
  }
  
  // Clean up any unreplaced placeholders
  result = result.replace(/\{[a-z_][a-z0-9_]*\}/gi, '');
  
  return result;
}

// ============================================================================
// DATA QUALITY INSIGHT (HARDCODED)
// ============================================================================

/**
 * Generate Data Quality insight based on validation results
 * This remains hardcoded as it's based on validation rules, not benchmarks
 */
function generateDataQualityInsight(validationIssues, kpiConfig) {
  const errorCount = validationIssues.filter(i => i.severity === 'error').length;
  const warningCount = validationIssues.filter(i => i.severity === 'warning').length;
  const infoCount = validationIssues.filter(i => i.severity === 'info').length;

  if (errorCount === 0 && warningCount === 0) {
    return {
      id: '_data_quality',
      type: 'system',
      title: 'Data Quality',
      status: 'good',
      summary: 'Your data is internally consistent with no validation errors.',
      detail: 'All reported metrics reconcile properly. This gives us confidence in the analysis.',
      recommendations: [],
      sectionId: 0,
      affectedSections: [],
      priority: 0
    };
  }

  let status = 'warning';
  let summary = '';
  const recommendations = [];

  if (errorCount > 0) {
    status = 'concern';
    summary = `Found ${errorCount} data inconsistenc${errorCount === 1 ? 'y' : 'ies'} that need attention.`;
    recommendations.push('Review the Validation Log sheet for detailed issue descriptions');
    recommendations.push('Correct the source data and re-run analysis');
  } else if (warningCount > 0) {
    summary = `Found ${warningCount} warning${warningCount === 1 ? '' : 's'} worth reviewing.`;
    recommendations.push('Check the Validation Log for details');
    recommendations.push('These may indicate data entry errors or unusual business situations');
  }

  const detail = `Errors: ${errorCount} | Warnings: ${warningCount} | Info: ${infoCount}`;

  return {
    id: '_data_quality',
    type: 'system',
    title: 'Data Quality',
    status: status,
    summary: summary,
    detail: detail,
    recommendations: recommendations,
    sectionId: 0,
    affectedSections: getAffectedSectionsFromIssues(validationIssues),
    priority: 0
  };
}
```

### Update ResultsGenerator.gs

```javascript
/**
 * Write Insights section grouped by business section
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} startRow
 * @param {Object} insightsBySection - Insights grouped by section ID
 * @param {Object[]} sectionConfig - Section definitions
 * @returns {number} Next row number
 */
function writeInsightsSection(sheet, startRow, insightsBySection, sectionConfig) {
  let row = startRow;

  // Main header
  sheet.getRange(row, 1).setValue('INSIGHTS & FINDINGS');
  sheet.getRange(row, 1, 1, 8).merge();
  sheet.getRange(row, 1)
    .setFontSize(16)
    .setFontWeight('bold')
    .setBackground(COLORS.SECTION_HEADER)
    .setFontColor(COLORS.HEADER_TEXT);
  row++;
  row++;  // Blank row

  // Section icons
  const sectionIcons = {
    0: '📊', 1: '📣', 2: '📞', 3: '💼', 4: '🔧',
    5: '📅', 6: '📦', 7: '💰', 8: '👥', 9: '📋'
  };

  // Section names (fallback if not in sectionConfig)
  const sectionNames = {
    0: 'Data Quality',
    1: 'Marketing', 2: 'CSR / Call Center', 3: 'Sales', 4: 'Field Operations',
    5: 'Scheduling / Dispatch', 6: 'Inventory / Warehouse', 7: 'Finance / Accounting',
    8: 'HR / Training', 9: 'Management'
  };

  // Write each section (always show all sections)
  const sectionOrder = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  
  for (const sectionId of sectionOrder) {
    const insights = insightsBySection[sectionId] || [];

    // Get section info
    const sectionDef = sectionConfig.find(s => s.sectionId === sectionId);
    const sectionName = sectionDef?.sectionName || sectionNames[sectionId] || `Section ${sectionId}`;
    const icon = sectionIcons[sectionId] || '📌';

    // Section header
    sheet.getRange(row, 1).setValue(`${icon} ${sectionName.toUpperCase()}`);
    sheet.getRange(row, 1, 1, 8).merge();
    sheet.getRange(row, 1)
      .setFontSize(12)
      .setFontWeight('bold')
      .setBackground('#e0e0e0')
      .setFontColor('#333333');
    row++;

    // Write insights or "no issues" message
    if (insights.length === 0) {
      sheet.getRange(row, 1).setValue('  ✓ No issues identified in this area.');
      sheet.getRange(row, 1, 1, 8).merge();
      sheet.getRange(row, 1)
        .setFontStyle('italic')
        .setFontColor('#4caf50');
      row++;
    } else {
      for (const insight of insights) {
        row = writeInsightRow(sheet, row, insight);
      }
    }

    row++;  // Space between sections
  }

  return row;
}

/**
 * Write a single insight row
 */
function writeInsightRow(sheet, startRow, insight) {
  let row = startRow;

  // Status config
  const statusConfig = {
    concern: { icon: '⬇', color: '#c62828', bgColor: '#ffebee', label: 'CONCERN' },
    warning: { icon: '➡', color: '#f57c00', bgColor: '#fff3e0', label: 'WARNING' },
    good: { icon: '⬆', color: '#2e7d32', bgColor: '#e8f5e9', label: 'GOOD' }
  };
  
  const config = statusConfig[insight.status] || statusConfig.warning;

  // Title row with status
  const titleText = `${config.icon} ${insight.title}`;
  sheet.getRange(row, 1).setValue(titleText);
  sheet.getRange(row, 1, 1, 6).merge();
  sheet.getRange(row, 1)
    .setFontWeight('bold')
    .setFontColor(config.color)
    .setBackground(config.bgColor);
  
  // Status label in last columns
  sheet.getRange(row, 7).setValue(`[${config.label}]`);
  sheet.getRange(row, 7, 1, 2).merge();
  sheet.getRange(row, 7)
    .setFontWeight('bold')
    .setFontColor(config.color)
    .setHorizontalAlignment('right');
  row++;

  // Summary
  sheet.getRange(row, 1).setValue(`  ${insight.summary}`);
  sheet.getRange(row, 1, 1, 8).merge();
  sheet.getRange(row, 1).setWrap(true);
  row++;

  // Detail (if different from summary)
  if (insight.detail && insight.detail !== insight.summary) {
    sheet.getRange(row, 1).setValue(`  ${insight.detail}`);
    sheet.getRange(row, 1, 1, 8).merge();
    sheet.getRange(row, 1)
      .setWrap(true)
      .setFontColor('#666666')
      .setFontSize(10);
    row++;
  }

  // Recommendations
  if (insight.recommendations && insight.recommendations.length > 0) {
    for (const rec of insight.recommendations) {
      sheet.getRange(row, 1).setValue(`    → ${rec}`);
      sheet.getRange(row, 1, 1, 8).merge();
      sheet.getRange(row, 1)
        .setFontColor('#1565c0')
        .setFontSize(10);
      row++;
    }
  }

  return row;
}
```

---

## 7. Migration from Hardcoded Insights

### Current Hardcoded Insights to Migrate

| Function | KPI(s) | Migrate To |
|----------|--------|------------|
| `generateBookingInsight()` | booking_rate | Config_Insights rows |
| `generateSalesInsight()` | close_rate | Config_Insights rows |
| `generateProfitabilityInsight()` | profit_margin | Config_Insights rows |
| `generateCapacityInsight()` | schedule_efficiency | Config_Insights rows |
| `generateEfficiencyInsight()` | revenue_per_vehicle | Config_Insights rows |
| `generateDataQualityInsight()` | _validation | **Keep hardcoded** |
| `generateSectionInsight()` | _sections | **Remove** (replaced by grouped view) |

### Migration Steps

1. Create Config_Insights sheet with schema
2. Add rows for all existing insight logic
3. Update `generateInsights()` to use new modular approach
4. Update `writeInsightsSection()` to use grouped output
5. Remove old hardcoded insight functions
6. Test with all form tiers

---

## 8. Testing Checklist

### Config Loading
- [ ] Config_Insights sheet loads correctly
- [ ] Tier filtering works (onboarding only sees onboarding insights)
- [ ] Active/inactive toggle works
- [ ] Priority sorting works

### Single-KPI Triggers
- [ ] `critical` triggers only on critical rating
- [ ] `poor` triggers only on poor rating
- [ ] `poor-` triggers on poor AND critical
- [ ] `good+` triggers on good AND excellent
- [ ] `any` triggers on any rating

### Composite Triggers
- [ ] AND logic works (all conditions must be true)
- [ ] Mixed conditions work (e.g., `booking_rate:good+ AND close_rate:poor-`)
- [ ] Missing KPIs prevent trigger (don't error)

### Template Replacement
- [ ] Single-KPI placeholders work: `{value}`, `{benchmark_good}`, etc.
- [ ] Composite placeholders work: `{booking_rate}`, `{close_rate_formatted}`, etc.
- [ ] Client data placeholders work: `{company_name}`, `{industry}`
- [ ] Unreplaced placeholders are cleaned up

### Results Output
- [ ] Insights grouped by section
- [ ] Empty sections show "No issues" or are hidden
- [ ] Status colors match business meaning
- [ ] Recommendations display correctly
- [ ] Data Quality insight always appears first

### Edge Cases
- [ ] KPI with no benchmark defined → No insight generated (not error)
- [ ] KPI with null value → No insight generated
- [ ] Composite where one KPI is missing → No insight generated
- [ ] Empty Config_Insights sheet → Only Data Quality insight shows

---

## Files to Modify/Create

| File | Action | Priority |
|------|--------|----------|
| `Config_Insights` sheet | **CREATE** | HIGH |
| `InsightsEngine.gs` | **REWRITE** | HIGH |
| `ResultsGenerator.gs` | Update `writeInsightsSection()` | HIGH |
| `Config.gs` | Add `SHEET_NAMES.CONFIG_INSIGHTS` | MEDIUM |
| `Config.gs` | Add `initializeInsightConfig()` | MEDIUM |

---

## Estimated Time

| Task | Time |
|------|------|
| Create Config_Insights sheet + sample data | 1 hour |
| Rewrite InsightsEngine.gs | 2-3 hours |
| Update ResultsGenerator.gs | 1-2 hours |
| Migrate existing insight logic to config | 1 hour |
| Testing | 1-2 hours |
| **Total** | **6-9 hours** |

---

*End of Insights System Specification*
