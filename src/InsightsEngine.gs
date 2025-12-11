/**
 * InsightsEngine.gs
 * Generate plain-English findings and recommendations
 *
 * ShopFloor Solutions - Operational KPI Calculator
 * v2.1 - Modular config-driven insights with visibility gap detection
 */

// ============================================================================
// SECTION ICONS
// ============================================================================

const SECTION_ICONS = {
  1: { icon: '', name: 'Marketing' },
  2: { icon: '', name: 'CSR/Call Center' },
  3: { icon: '', name: 'Sales' },
  4: { icon: '', name: 'Field Operations' },
  5: { icon: '', name: 'Scheduling/Dispatch' },
  6: { icon: '', name: 'Inventory/Warehouse' },
  7: { icon: '', name: 'Finance/Accounting' },
  8: { icon: '', name: 'HR/Training' },
  9: { icon: '', name: 'Management' }
};

// ============================================================================
// MAIN INSIGHTS GENERATION
// ============================================================================

/**
 * Generate all insights for a client (v2.1 - new main entry point)
 * Returns structured object with visibility gaps, data quality, and section-grouped insights
 *
 * @param {Object} clientData - Client data object
 * @param {Object} allValues - All KPI values (raw + calculated)
 * @param {Object} kpiRatings - Ratings keyed by kpiId {kpiId: {rating, value, benchmark}}
 * @param {Object[]} validationIssues - Validation issues array
 * @param {Object[]} kpiConfig - KPI definitions
 * @param {Object[]} insightConfig - Insight rules from Config_Insights
 * @param {Object[]} sectionConfig - Section definitions
 * @param {Object} benchmarks - Benchmarks keyed by kpiId
 * @returns {Object} {visibilityGaps, dataQuality, groupedInsights}
 */
function generateAllInsights(clientData, allValues, kpiRatings, validationIssues, kpiConfig, insightConfig, sectionConfig, benchmarks) {
  // 1. Generate visibility gap insights
  const visibilityGaps = generateVisibilityGapInsights(allValues, kpiConfig);

  // 2. Generate data quality insight
  const dataQuality = generateDataQualityInsight(validationIssues, kpiConfig);

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
 * Generate insights (backward-compatible wrapper)
 * @param {Object} clientData - Client data object
 * @param {Object} allValues - Raw + calculated KPIs
 * @param {Object[]} validationIssues - Validation issues
 * @param {Object[]} kpiConfig - KPI definitions
 * @param {Object[]} sectionConfig - Section definitions
 * @returns {Object[]} Array of insight objects (legacy format)
 */
function generateInsights(clientData, allValues, validationIssues, kpiConfig, sectionConfig) {
  const insights = [];

  // Load benchmarks and insight config
  const benchmarks = loadBenchmarksForInsights(clientData.industry, clientData.state);
  const insightConfig = loadInsightConfig();

  // Build kpiRatings object
  const kpiRatings = buildKPIRatings(allValues, kpiConfig, benchmarks);

  // Get all insights using new system
  const allInsights = generateAllInsights(
    clientData, allValues, kpiRatings, validationIssues,
    kpiConfig, insightConfig, sectionConfig, benchmarks
  );

  // Convert to legacy format (flat array)
  // 1. Add visibility gaps as insights
  for (const gap of allInsights.visibilityGaps) {
    insights.push({
      type: 'visibility_gap',
      title: `${gap.kpiName} Unknown`,
      status: gap.severity === 'critical' ? 'concern' : (gap.severity === 'important' ? 'warning' : 'good'),
      summary: gap.message,
      detail: `This is a ${gap.severity} operational visibility gap.`,
      affectedSections: [],
      recommendations: gap.recommendation ? [gap.recommendation] : []
    });
  }

  // 2. Add data quality insight
  if (allInsights.dataQuality) {
    insights.push(allInsights.dataQuality);
  }

  // 3. Add all section insights
  for (const sectionId of Object.keys(allInsights.groupedInsights)) {
    const section = allInsights.groupedInsights[sectionId];
    for (const insight of section.insights) {
      insights.push({
        type: insight.id,
        title: insight.title,
        status: insight.status,
        summary: insight.summary,
        detail: insight.detail,
        affectedSections: [parseInt(sectionId)],
        recommendations: insight.recommendations || []
      });
    }
  }

  return insights;
}

/**
 * Build KPI ratings object from values and benchmarks
 * @param {Object} allValues - All KPI values
 * @param {Object[]} kpiConfig - KPI definitions
 * @param {Object} benchmarks - Benchmarks keyed by kpiId
 * @returns {Object} Ratings keyed by kpiId
 */
function buildKPIRatings(allValues, kpiConfig, benchmarks) {
  const kpiRatings = {};

  for (const kpi of kpiConfig) {
    const value = allValues[kpi.id];
    const benchmark = benchmarks[kpi.id];

    if (benchmark && !isEmpty(value)) {
      const rating = getRating(value, benchmark, benchmark.direction || 'higher');
      kpiRatings[kpi.id] = {
        rating: rating,
        value: value,
        benchmark: benchmark
      };
    }
  }

  return kpiRatings;
}

/**
 * Load benchmarks for insights from Config.gs
 * Includes direction field for proper rating logic
 * @param {string} industry - Client industry
 * @param {string} state - Client state/province
 * @returns {Object} Benchmarks object keyed by kpiId
 */
function loadBenchmarksForInsights(industry, state) {
  const benchmarks = {};

  try {
    const configBenchmarks = loadBenchmarkConfig(industry, state);

    for (const benchmark of configBenchmarks) {
      if (!benchmarks[benchmark.kpiId]) {
        benchmarks[benchmark.kpiId] = {
          poor: benchmark.poor,
          average: benchmark.average,
          good: benchmark.good,
          excellent: benchmark.excellent,
          direction: benchmark.direction || 'higher'
        };
      }
    }
  } catch (e) {
    log('Error loading benchmarks: ' + e.message);
  }

  return benchmarks;
}

// ============================================================================
// VISIBILITY GAP DETECTION
// ============================================================================

/**
 * Generate visibility gap insights for missing critical/important inputs
 * @param {Object} allValues - All KPI values
 * @param {Object[]} kpiConfig - KPI definitions with visibility flags
 * @returns {Object[]} Array of visibility gap objects
 */
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
    if (isValueMissing(value)) {
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
  gaps.sort((a, b) => (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99));

  return gaps;
}

/**
 * Check if a value is considered "missing"
 * @param {any} value - Value to check
 * @returns {boolean} True if value is missing
 */
function isValueMissing(value) {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value === 'number' && isNaN(value)) return true;
  return false;
}

/**
 * Get visibility gap summary
 * @param {Object[]} gaps - Visibility gap objects
 * @returns {Object} Summary with counts and message
 */
function getVisibilityGapSummary(gaps) {
  const critical = gaps.filter(g => g.severity === 'critical').length;
  const important = gaps.filter(g => g.severity === 'important').length;
  const helpful = gaps.filter(g => g.severity === 'helpful').length;

  const total = critical + important + helpful;

  if (total === 0) {
    return {
      hasGaps: false,
      message: 'All visibility metrics are being tracked.',
      critical: 0,
      important: 0,
      helpful: 0
    };
  }

  let message = '';
  if (critical > 0) {
    message = `${critical} critical metric${critical > 1 ? 's' : ''} missing - address visibility gaps first.`;
  } else if (important > 0) {
    message = `${important} important metric${important > 1 ? 's' : ''} missing.`;
  } else {
    message = `${helpful} helpful metric${helpful > 1 ? 's' : ''} not tracked.`;
  }

  return {
    hasGaps: true,
    message: message,
    critical: critical,
    important: important,
    helpful: helpful
  };
}

// ============================================================================
// DATA QUALITY INSIGHT
// ============================================================================

/**
 * Generate insight about data quality
 * @param {Object[]} validationIssues
 * @param {Object[]} kpiConfig
 * @returns {Object|null}
 */
function generateDataQualityInsight(validationIssues, kpiConfig) {
  const errorCount = validationIssues.filter(i => i.severity === 'error').length;
  const warningCount = validationIssues.filter(i => i.severity === 'warning').length;
  const infoCount = validationIssues.filter(i => i.severity === 'info').length;

  if (errorCount === 0 && warningCount === 0) {
    return {
      type: 'data_quality',
      title: 'Data Quality',
      status: 'good',
      summary: 'Your data is internally consistent with no validation errors.',
      detail: 'All reported metrics reconcile properly. This gives us confidence in the analysis.',
      affectedSections: [],
      recommendations: [],
      issues: []  // No issues
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

  const detail = `Errors: ${errorCount} | Warnings: ${warningCount} | Info: ${infoCount}. ` +
    'Data quality issues can affect the accuracy of calculated metrics and insights.';

  return {
    type: 'data_quality',
    title: 'Data Quality',
    status: status,
    summary: summary,
    detail: detail,
    affectedSections: getAffectedSectionsFromIssues(validationIssues),
    recommendations: recommendations,
    issues: validationIssues  // Include full validation issues for display
  };
}

// ============================================================================
// CONFIG-DRIVEN INSIGHTS
// ============================================================================

/**
 * Generate insights based on Config_Insights rules
 * @param {Object} clientData - Client data
 * @param {Object} allValues - All KPI values
 * @param {Object} kpiRatings - Ratings keyed by kpiId
 * @param {Object[]} insightConfig - Insight rules
 * @param {Object[]} kpiConfig - KPI definitions
 * @param {Object} benchmarks - Benchmarks keyed by kpiId
 * @returns {Object[]} Array of triggered insights
 */
function generateConfigInsights(clientData, allValues, kpiRatings, insightConfig, kpiConfig, benchmarks) {
  const triggeredInsights = [];

  for (const rule of insightConfig) {
    // Check if all required KPIs have ratings (for single-KPI) or values (for composite)
    if (rule.type === 'single') {
      const kpiId = rule.kpiIds[0];
      if (!kpiRatings[kpiId]?.rating) continue;
    } else if (rule.type === 'composite') {
      // For composite, check if all referenced KPIs have ratings
      const hasAllRatings = rule.kpiIds.every(id => kpiRatings[id]?.rating);
      if (!hasAllRatings) continue;
    }

    // Evaluate trigger condition
    if (!evaluateTrigger(rule.triggerLogic, kpiRatings, rule.type, rule.kpiIds)) continue;

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
      affectedSections: rule.affectedSections,
      priority: rule.priority
    });
  }

  return triggeredInsights;
}

// ============================================================================
// TRIGGER EVALUATION
// ============================================================================

/**
 * Evaluate trigger logic against KPI ratings
 * @param {string} triggerLogic - Trigger logic string
 * @param {Object} kpiRatings - Ratings keyed by kpiId
 * @param {string} insightType - 'single' or 'composite'
 * @param {string[]} ruleKpiIds - KPI IDs from the insight rule
 * @returns {boolean} True if trigger condition is met
 */
function evaluateTrigger(triggerLogic, kpiRatings, insightType, ruleKpiIds) {
  if (!triggerLogic) return false;

  if (insightType === 'single' || !triggerLogic.includes(' AND ')) {
    // For single-KPI insights, check the specific KPI from the rule
    if (ruleKpiIds && ruleKpiIds.length > 0) {
      const kpiId = ruleKpiIds[0];
      const actualRating = kpiRatings[kpiId]?.rating;
      return matchesRatingCondition(actualRating, triggerLogic);
    }
    return false;
  }

  // Composite trigger: split on AND
  const conditions = triggerLogic.split(/\s+AND\s+/i);

  // ALL conditions must be true
  for (const condition of conditions) {
    const colonIndex = condition.indexOf(':');
    if (colonIndex === -1) continue;

    const kpiId = condition.substring(0, colonIndex).trim();
    const ratingCondition = condition.substring(colonIndex + 1).trim();
    const actualRating = kpiRatings[kpiId]?.rating;

    if (!matchesRatingCondition(actualRating, ratingCondition)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if actual rating matches a rating condition
 * @param {string} actual - Actual rating (critical, poor, average, good, excellent)
 * @param {string} condition - Condition (e.g., 'good+', 'poor-', 'average', 'any')
 * @returns {boolean} True if matches
 */
function matchesRatingCondition(actual, condition) {
  const ratingOrder = { critical: 1, poor: 2, average: 3, good: 4, excellent: 5 };
  const actualOrder = ratingOrder[actual?.toLowerCase()];

  if (!actualOrder) return false;
  if (condition === 'any') return true;

  // Handle range conditions
  if (condition.endsWith('-')) {
    // poor- means poor or worse (poor, critical)
    const baseRating = condition.slice(0, -1);
    return actualOrder <= ratingOrder[baseRating];
  }

  if (condition.endsWith('+')) {
    // good+ means good or better (good, excellent)
    const baseRating = condition.slice(0, -1);
    return actualOrder >= ratingOrder[baseRating];
  }

  // Exact match
  return actual?.toLowerCase() === condition.toLowerCase();
}

// ============================================================================
// TEMPLATE SYSTEM
// ============================================================================

/**
 * Build template context for placeholder replacement
 * @param {Object} rule - Insight rule
 * @param {Object} allValues - All KPI values
 * @param {Object} kpiRatings - Ratings keyed by kpiId
 * @param {Object} benchmarks - Benchmarks keyed by kpiId
 * @param {Object[]} kpiConfig - KPI definitions
 * @param {Object} clientData - Client data
 * @returns {Object} Context object for template replacement
 */
function buildTemplateContext(rule, allValues, kpiRatings, benchmarks, kpiConfig, clientData) {
  const context = {
    // Universal placeholders
    company_name: clientData.companyName || '',
    industry: clientData.industry || '',
    state: clientData.state || ''
  };

  // For single-KPI insights
  if (rule.type === 'single' && rule.kpiIds.length > 0) {
    const kpiId = rule.kpiIds[0];
    const value = allValues[kpiId];
    const rating = kpiRatings[kpiId];
    const benchmark = benchmarks[kpiId];
    const kpiDef = kpiConfig.find(k => k.id === kpiId);

    context.value = value;
    context.value_formatted = formatValueForInsight(value, kpiDef?.dataType);
    context.value_rounded = Math.round(value || 0);
    context.kpi_name = kpiDef?.name || snakeToTitleCase(kpiId);
    context.rating = rating?.rating ? capitalizeFirst(rating.rating) : 'N/A';

    if (benchmark) {
      context.benchmark_poor = benchmark.poor;
      context.benchmark_average = benchmark.average;
      context.benchmark_good = benchmark.good;
      context.benchmark_excellent = benchmark.excellent;
    }
  }

  // For composite insights - add all KPI values
  if (rule.type === 'composite') {
    for (const kpiId of rule.kpiIds) {
      const value = allValues[kpiId];
      const rating = kpiRatings[kpiId];
      const benchmark = benchmarks[kpiId];
      const kpiDef = kpiConfig.find(k => k.id === kpiId);

      // Add with kpiId prefix
      context[kpiId] = value;
      context[`${kpiId}_formatted`] = formatValueForInsight(value, kpiDef?.dataType);
      context[`${kpiId}_rounded`] = Math.round(value || 0);
      context[`${kpiId}_rating`] = rating?.rating ? capitalizeFirst(rating.rating) : 'N/A';
      context[`${kpiId}_name`] = kpiDef?.name || snakeToTitleCase(kpiId);

      if (benchmark) {
        context[`${kpiId}_benchmark_poor`] = benchmark.poor;
        context[`${kpiId}_benchmark_average`] = benchmark.average;
        context[`${kpiId}_benchmark_good`] = benchmark.good;
        context[`${kpiId}_benchmark_excellent`] = benchmark.excellent;
      }
    }
  }

  return context;
}

/**
 * Replace template placeholders with actual values
 * @param {string} template - Template string with {placeholders}
 * @param {Object} context - Context object with values
 * @returns {string} Processed string
 */
function replaceTemplatePlaceholders(template, context) {
  if (!template) return '';

  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    const value = context[key];
    if (value !== undefined && value !== null) {
      return String(value);
    }
    return match; // Keep placeholder if not found
  });
}

/**
 * Format value for insight display
 * @param {any} value - Value to format
 * @param {string} dataType - Data type
 * @returns {string} Formatted value
 */
function formatValueForInsight(value, dataType) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }

  switch (dataType) {
    case 'currency':
      return formatCurrency(value);
    case 'percentage':
      return formatPercentage(value);
    case 'integer':
      return Math.round(value).toLocaleString();
    default:
      return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }
}

// ============================================================================
// SECTION GROUPING
// ============================================================================

/**
 * Group insights by section and sort within each group
 * @param {Object[]} insights - Array of triggered insights
 * @param {Object[]} sectionConfig - Section definitions
 * @returns {Object} Insights grouped by sectionId
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

  // Sort insights within each section: concerns first, then warnings, then good
  const statusOrder = { concern: 1, warning: 2, good: 3 };
  for (const sectionId of Object.keys(grouped)) {
    grouped[sectionId].insights.sort((a, b) => {
      const statusDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
      if (statusDiff !== 0) return statusDiff;
      return (a.priority || 99) - (b.priority || 99);
    });
  }

  return grouped;
}

/**
 * Get icon for a section
 * @param {number} sectionId - Section ID
 * @returns {string} Section icon
 */
function getSectionIcon(sectionId) {
  return SECTION_ICONS[sectionId]?.icon || '';
}

/**
 * Get section display name with icon
 * @param {number} sectionId - Section ID
 * @param {Object[]} sectionConfig - Section definitions
 * @returns {string} Display name with icon
 */
function getSectionDisplayName(sectionId, sectionConfig) {
  const section = sectionConfig.find(s => s.sectionId === sectionId);
  const icon = getSectionIcon(sectionId);
  const name = section?.sectionName || `Section ${sectionId}`;
  return icon ? `${icon} ${name.toUpperCase()}` : name.toUpperCase();
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get affected sections from validation issues
 * @param {Object[]} issues
 * @returns {number[]}
 */
function getAffectedSectionsFromIssues(issues) {
  const sections = new Set();

  for (const issue of issues) {
    if (issue.affectedSections) {
      for (const s of issue.affectedSections) {
        sections.add(s);
      }
    }
  }

  return Array.from(sections);
}

/**
 * Generate overall summary paragraph
 * @param {Object} clientData
 * @param {Object} allValues
 * @param {Object[]} insights
 * @returns {string} Executive summary paragraph
 */
function generateSummary(clientData, allValues, insights) {
  const parts = [];

  parts.push(`Analysis of ${clientData.companyName} (${clientData.industry}) for the ${clientData.dataPeriod} period.`);

  // Count insight statuses
  const goodCount = insights.filter(i => i.status === 'good').length;
  const warningCount = insights.filter(i => i.status === 'warning').length;
  const concernCount = insights.filter(i => i.status === 'concern').length;

  if (concernCount > 0) {
    parts.push(`${concernCount} area${concernCount > 1 ? 's' : ''} require${concernCount === 1 ? 's' : ''} immediate attention.`);
  }

  if (warningCount > 0) {
    parts.push(`${warningCount} area${warningCount > 1 ? 's' : ''} should be reviewed.`);
  }

  if (goodCount > 0) {
    parts.push(`${goodCount} area${goodCount > 1 ? 's are' : ' is'} performing well.`);
  }

  // Add key metrics if available
  if (!isEmpty(allValues.profit_margin)) {
    parts.push(`Profit margin: ${formatPercentage(allValues.profit_margin)}.`);
  }

  if (!isEmpty(allValues.close_rate)) {
    parts.push(`Close rate: ${formatPercentage(allValues.close_rate)}.`);
  }

  return parts.join(' ');
}

/**
 * Identify which business sections need attention
 * @param {Object[]} validationIssues
 * @param {Object} allValues
 * @param {Object[]} kpiConfig
 * @param {Object[]} sectionConfig
 * @returns {Object[]} [{sectionId, sectionName, severity, reasons}]
 */
function identifyProblemSections(validationIssues, allValues, kpiConfig, sectionConfig) {
  const sectionIssues = {};

  // Aggregate issues by section
  for (const issue of validationIssues) {
    if (issue.severity === 'info') continue; // Skip info-level

    const sections = issue.affectedSections || [];

    for (const sectionId of sections) {
      if (!sectionIssues[sectionId]) {
        const section = sectionConfig.find(s => s.sectionId === sectionId);
        sectionIssues[sectionId] = {
          sectionId: sectionId,
          sectionName: section ? section.sectionName : `Section ${sectionId}`,
          severity: 'info',
          reasons: []
        };
      }

      // Update severity (escalate to most severe)
      if (issue.severity === 'error') {
        sectionIssues[sectionId].severity = 'error';
      } else if (issue.severity === 'warning' && sectionIssues[sectionId].severity !== 'error') {
        sectionIssues[sectionId].severity = 'warning';
      }

      // Add reason
      sectionIssues[sectionId].reasons.push(issue.ruleName);
    }
  }

  // Convert to array and sort by severity
  return Object.values(sectionIssues)
    .filter(s => s.reasons.length > 0)
    .sort((a, b) => {
      const order = { error: 0, warning: 1, info: 2 };
      return (order[a.severity] || 99) - (order[b.severity] || 99);
    });
}

/**
 * Capitalize first letter of a string
 * @param {string} str - Input string
 * @returns {string} Capitalized string
 */
function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
