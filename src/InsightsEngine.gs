/**
 * InsightsEngine.gs
 * Generate plain-English findings and recommendations
 *
 * ShopFloor Solutions - Operational KPI Calculator
 */

// ============================================================================
// BENCHMARK THRESHOLDS (Default values - can be overridden by Config_Benchmarks)
// ============================================================================

const DEFAULT_BENCHMARKS = {
  booking_rate: { poor: 30, average: 50, good: 70, excellent: 85 },
  close_rate: { poor: 20, average: 35, good: 50, excellent: 65 },
  profit_margin: { poor: 5, average: 12, good: 20, excellent: 30 },
  schedule_efficiency: { poor: 60, average: 80, good: 95, excellent: 100 }
};

// ============================================================================
// MAIN INSIGHTS GENERATION
// ============================================================================

/**
 * Generate all insights for a client
 * @param {Object} clientData - Client data object
 * @param {Object} allValues - Raw + calculated KPIs
 * @param {Object[]} validationIssues - Validation issues
 * @param {Object[]} kpiConfig - KPI definitions
 * @param {Object[]} sectionConfig - Section definitions
 * @returns {Object[]} Array of insight objects
 */
function generateInsights(clientData, allValues, validationIssues, kpiConfig, sectionConfig) {
  const insights = [];

  // Load benchmarks (with industry filter if available)
  const benchmarks = loadBenchmarksForInsights(clientData.industry);

  // 1. Data Quality insight (always first)
  const dataQualityInsight = generateDataQualityInsight(validationIssues, kpiConfig);
  if (dataQualityInsight) {
    insights.push(dataQualityInsight);
  }

  // 2. Booking Performance insight
  const bookingInsight = generateBookingInsight(allValues, benchmarks);
  if (bookingInsight) {
    insights.push(bookingInsight);
  }

  // 3. Sales Performance insight
  const salesInsight = generateSalesInsight(allValues, benchmarks);
  if (salesInsight) {
    insights.push(salesInsight);
  }

  // 4. Profitability insight
  const profitInsight = generateProfitabilityInsight(allValues, benchmarks);
  if (profitInsight) {
    insights.push(profitInsight);
  }

  // 5. Capacity Utilization insight
  const capacityInsight = generateCapacityInsight(allValues, benchmarks);
  if (capacityInsight) {
    insights.push(capacityInsight);
  }

  // 6. Vehicle/Crew Efficiency insight
  const efficiencyInsight = generateEfficiencyInsight(allValues, clientData);
  if (efficiencyInsight) {
    insights.push(efficiencyInsight);
  }

  // 7. Problem Sections summary
  const sectionInsight = generateSectionInsight(validationIssues, allValues, kpiConfig, sectionConfig);
  if (sectionInsight) {
    insights.push(sectionInsight);
  }

  return insights;
}

/**
 * Load benchmarks for insights, using config or defaults
 * @param {string} industry - Client industry
 * @returns {Object} Benchmarks object
 */
function loadBenchmarksForInsights(industry) {
  const benchmarks = {};

  // Start with defaults
  for (const kpiId in DEFAULT_BENCHMARKS) {
    benchmarks[kpiId] = { ...DEFAULT_BENCHMARKS[kpiId] };
  }

  // Try to load from config
  try {
    const configBenchmarks = loadBenchmarkConfig(industry);

    for (const benchmark of configBenchmarks) {
      benchmarks[benchmark.kpiId] = {
        poor: benchmark.poor,
        average: benchmark.average,
        good: benchmark.good,
        excellent: benchmark.excellent
      };
    }
  } catch (e) {
    // Use defaults
    log('Using default benchmarks');
  }

  return benchmarks;
}

// ============================================================================
// INDIVIDUAL INSIGHT GENERATORS
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
      recommendations: []
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
    recommendations: recommendations
  };
}

/**
 * Generate insight about booking performance
 * @param {Object} allValues
 * @param {Object} benchmarks
 * @returns {Object|null}
 */
function generateBookingInsight(allValues, benchmarks) {
  const bookingRate = allValues.booking_rate;
  const totalLeads = allValues.total_leads;
  const visits = allValues.in_home_visits;

  if (isEmpty(bookingRate)) {
    return null;
  }

  const benchmark = benchmarks.booking_rate || DEFAULT_BENCHMARKS.booking_rate;
  const rating = getRating(bookingRate, benchmark);

  let status, summary, detail;
  const recommendations = [];

  if (rating === 'poor') {
    status = 'concern';
    summary = `Your booking rate of ${formatPercentage(bookingRate)} is below industry average.`;
    detail = `For every 100 leads, only ${Math.round(bookingRate)} become appointments. ` +
      `Industry average is around ${benchmark.average}%.`;
    recommendations.push('Review CSR call scripts and training');
    recommendations.push('Analyze why leads aren\'t converting to appointments');
    recommendations.push('Consider implementing call monitoring or coaching');
    recommendations.push('Check if leads are being followed up promptly');
  } else if (rating === 'average') {
    status = 'warning';
    summary = `Your booking rate of ${formatPercentage(bookingRate)} is average.`;
    detail = `There's room to improve from ${bookingRate.toFixed(1)}% toward the ${benchmark.good}% benchmark.`;
    recommendations.push('Focus on CSR training to improve conversion');
    recommendations.push('Review call handling for improvement opportunities');
  } else if (rating === 'good') {
    status = 'good';
    summary = `Your booking rate of ${formatPercentage(bookingRate)} is above average.`;
    detail = `Good performance converting leads to appointments.`;
    recommendations.push('Document what\'s working for your CSR team');
    recommendations.push('Consider if you can scale lead volume');
  } else {
    status = 'good';
    summary = `Excellent booking rate of ${formatPercentage(bookingRate)}!`;
    detail = `You're converting leads to appointments at a top-tier rate.`;
  }

  return {
    type: 'booking',
    title: 'Booking Performance',
    status: status,
    summary: summary,
    detail: detail,
    affectedSections: [1, 2], // Marketing, CSR
    recommendations: recommendations
  };
}

/**
 * Generate insight about sales performance
 * @param {Object} allValues
 * @param {Object} benchmarks
 * @returns {Object|null}
 */
function generateSalesInsight(allValues, benchmarks) {
  const closeRate = allValues.close_rate;
  const visits = allValues.in_home_visits;
  const jobsClosed = allValues.jobs_closed;
  const avgTicket = allValues.calculated_avg_ticket || allValues.average_ticket;

  if (isEmpty(closeRate)) {
    return null;
  }

  const benchmark = benchmarks.close_rate || DEFAULT_BENCHMARKS.close_rate;
  const rating = getRating(closeRate, benchmark);

  let status, summary, detail;
  const recommendations = [];

  if (rating === 'poor') {
    status = 'concern';
    summary = `Your close rate of ${formatPercentage(closeRate)} needs improvement.`;
    detail = `Of ${visits || 'your'} appointments, only ${closeRate.toFixed(1)}% convert to sales. ` +
      `Industry average is ${benchmark.average}%.`;
    recommendations.push('Review sales process and presentation');
    recommendations.push('Analyze lost opportunities - why aren\'t customers buying?');
    recommendations.push('Consider sales training or coaching');
    recommendations.push('Evaluate pricing competitiveness');
  } else if (rating === 'average') {
    status = 'warning';
    summary = `Your close rate of ${formatPercentage(closeRate)} is average.`;
    detail = `Room to improve from ${closeRate.toFixed(1)}% toward ${benchmark.good}%.`;
    recommendations.push('Identify what top performers do differently');
    recommendations.push('Review proposal/quote process');
  } else if (rating === 'good') {
    status = 'good';
    summary = `Your close rate of ${formatPercentage(closeRate)} is strong.`;
    detail = `You're converting appointments to sales above average.`;
    if (!isEmpty(avgTicket)) {
      recommendations.push(`With ${formatCurrency(avgTicket)} average ticket, focus on maintaining quality`);
    }
  } else {
    status = 'good';
    summary = `Excellent close rate of ${formatPercentage(closeRate)}!`;
    detail = `Top-tier sales conversion. Keep doing what you're doing.`;
  }

  return {
    type: 'sales',
    title: 'Sales Performance',
    status: status,
    summary: summary,
    detail: detail,
    affectedSections: [3], // Sales
    recommendations: recommendations
  };
}

/**
 * Generate insight about profitability
 * @param {Object} allValues
 * @param {Object} benchmarks
 * @returns {Object|null}
 */
function generateProfitabilityInsight(allValues, benchmarks) {
  const profitMargin = allValues.profit_margin;
  const netProfit = allValues.net_profit;
  const grossRevenue = allValues.gross_revenue;
  const totalCosts = allValues.total_costs;

  if (isEmpty(profitMargin)) {
    return null;
  }

  const benchmark = benchmarks.profit_margin || DEFAULT_BENCHMARKS.profit_margin;

  let status, summary, detail;
  const recommendations = [];

  // Handle negative profit
  if (profitMargin < 0) {
    status = 'concern';
    summary = `You're operating at a loss with ${formatPercentage(profitMargin)} margin.`;
    detail = `Costs of ${formatCurrency(totalCosts)} exceed revenue of ${formatCurrency(grossRevenue)}.`;
    recommendations.push('Immediate review of pricing strategy required');
    recommendations.push('Analyze cost structure for reduction opportunities');
    recommendations.push('Identify unprofitable job types or customers');
    recommendations.push('Consider pausing growth to fix profitability first');

    return {
      type: 'profitability',
      title: 'Profitability',
      status: status,
      summary: summary,
      detail: detail,
      affectedSections: [3, 7], // Sales, Finance
      recommendations: recommendations
    };
  }

  const rating = getRating(profitMargin, benchmark);

  if (rating === 'poor') {
    status = 'concern';
    summary = `Profit margin of ${formatPercentage(profitMargin)} is below healthy levels.`;
    detail = `You're keeping only ${formatCurrency(netProfit)} from ${formatCurrency(grossRevenue)} revenue.`;
    recommendations.push('Review pricing - are you undercharging?');
    recommendations.push('Analyze job costs for inefficiencies');
    recommendations.push('Focus on higher-margin services');
  } else if (rating === 'average') {
    status = 'warning';
    summary = `Profit margin of ${formatPercentage(profitMargin)} is acceptable but could improve.`;
    detail = `Net profit of ${formatCurrency(netProfit)} on ${formatCurrency(grossRevenue)} revenue.`;
    recommendations.push('Look for cost reduction opportunities');
    recommendations.push('Consider premium service offerings');
  } else if (rating === 'good') {
    status = 'good';
    summary = `Healthy profit margin of ${formatPercentage(profitMargin)}.`;
    detail = `Generating ${formatCurrency(netProfit)} profit on ${formatCurrency(grossRevenue)} revenue.`;
  } else {
    status = 'good';
    summary = `Excellent profit margin of ${formatPercentage(profitMargin)}!`;
    detail = `Strong profitability - ${formatCurrency(netProfit)} on ${formatCurrency(grossRevenue)}.`;
  }

  return {
    type: 'profitability',
    title: 'Profitability',
    status: status,
    summary: summary,
    detail: detail,
    affectedSections: [3, 7], // Sales, Finance
    recommendations: recommendations
  };
}

/**
 * Generate insight about capacity utilization
 * @param {Object} allValues
 * @param {Object} benchmarks
 * @returns {Object|null}
 */
function generateCapacityInsight(allValues, benchmarks) {
  const scheduleEfficiency = allValues.schedule_efficiency;
  const scheduleCapacity = allValues.schedule_capacity;
  const hoursScheduled = allValues.hours_scheduled;

  if (isEmpty(scheduleEfficiency)) {
    return null;
  }

  const benchmark = benchmarks.schedule_efficiency || DEFAULT_BENCHMARKS.schedule_efficiency;

  let status, summary, detail;
  const recommendations = [];

  if (scheduleEfficiency > 100) {
    status = 'warning';
    summary = `Schedule efficiency of ${formatPercentage(scheduleEfficiency)} indicates overtime.`;
    detail = `You're scheduling ${formatValue(hoursScheduled, 'number')} hours against ` +
      `${formatValue(scheduleCapacity, 'number')} capacity.`;
    recommendations.push('Evaluate if overtime is sustainable');
    recommendations.push('Consider hiring additional technicians');
    recommendations.push('Review if capacity calculation is accurate');
  } else if (scheduleEfficiency < benchmark.poor) {
    status = 'concern';
    summary = `Low schedule efficiency of ${formatPercentage(scheduleEfficiency)}.`;
    detail = `Only using ${scheduleEfficiency.toFixed(1)}% of available capacity.`;
    recommendations.push('Review scheduling practices');
    recommendations.push('Analyze why capacity is underutilized');
    recommendations.push('Marketing may need to generate more demand');
    recommendations.push('Consider reducing staff if demand is consistently low');
  } else if (scheduleEfficiency < benchmark.average) {
    status = 'warning';
    summary = `Schedule efficiency of ${formatPercentage(scheduleEfficiency)} has room to improve.`;
    detail = `Using ${scheduleEfficiency.toFixed(1)}% of ${formatValue(scheduleCapacity, 'number')} available hours.`;
    recommendations.push('Work to fill schedule gaps');
    recommendations.push('Review routing and job duration estimates');
  } else {
    status = 'good';
    summary = `Good schedule efficiency of ${formatPercentage(scheduleEfficiency)}.`;
    detail = `Effectively utilizing technician capacity.`;
  }

  return {
    type: 'capacity',
    title: 'Capacity Utilization',
    status: status,
    summary: summary,
    detail: detail,
    affectedSections: [4, 5], // Field Operations, Scheduling
    recommendations: recommendations
  };
}

/**
 * Generate insight about vehicle/crew efficiency
 * @param {Object} allValues
 * @param {Object} clientData
 * @returns {Object|null}
 */
function generateEfficiencyInsight(allValues, clientData) {
  const revenuePerVehicle = allValues.revenue_per_vehicle;
  const revenuePerTech = allValues.revenue_per_tech;
  const numVehicles = allValues.num_vehicles;
  const numTechs = allValues.num_techs;
  const periodDays = clientData.periodDays || 30;

  // Need at least one metric
  if (isEmpty(revenuePerVehicle) && isEmpty(revenuePerTech)) {
    return null;
  }

  let summary = '';
  let detail = '';
  const recommendations = [];

  // Calculate daily revenue per asset
  if (!isEmpty(revenuePerVehicle)) {
    const dailyPerVehicle = revenuePerVehicle / periodDays;
    summary += `Revenue per vehicle: ${formatCurrency(revenuePerVehicle)} (${formatCurrency(dailyPerVehicle)}/day). `;
  }

  if (!isEmpty(revenuePerTech)) {
    const dailyPerTech = revenuePerTech / periodDays;
    detail += `Revenue per technician: ${formatCurrency(revenuePerTech)} (${formatCurrency(dailyPerTech)}/day). `;
  }

  // General recommendations
  recommendations.push('Compare these metrics month-over-month to track trends');

  if (!isEmpty(revenuePerVehicle) && revenuePerVehicle < 30000) {
    recommendations.push('Consider if you have too many vehicles for current demand');
  }

  if (!isEmpty(revenuePerTech) && revenuePerTech < 25000) {
    recommendations.push('Review technician productivity and job routing');
  }

  return {
    type: 'efficiency',
    title: 'Asset Efficiency',
    status: 'good', // This is informational
    summary: summary.trim(),
    detail: detail.trim() || 'Track these metrics over time to identify trends.',
    affectedSections: [4, 5], // Field Operations, Scheduling
    recommendations: recommendations
  };
}

/**
 * Generate insight about problem sections
 * @param {Object[]} validationIssues
 * @param {Object} allValues
 * @param {Object[]} kpiConfig
 * @param {Object[]} sectionConfig
 * @returns {Object|null}
 */
function generateSectionInsight(validationIssues, allValues, kpiConfig, sectionConfig) {
  const problemSections = identifyProblemSections(validationIssues, allValues, kpiConfig, sectionConfig);

  if (problemSections.length === 0) {
    return null;
  }

  const sectionNames = problemSections.map(s => s.sectionName).join(', ');

  return {
    type: 'sections',
    title: 'Areas Needing Attention',
    status: 'warning',
    summary: `The following areas have issues: ${sectionNames}`,
    detail: problemSections.map(s => `${s.sectionName}: ${s.reasons.join('; ')}`).join(' | '),
    affectedSections: problemSections.map(s => s.sectionId),
    recommendations: [
      'Focus improvement efforts on these areas first',
      'Review the specific KPIs flagged in each section'
    ]
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get rating based on value and benchmarks
 * @param {number} value
 * @param {Object} benchmark - {poor, average, good, excellent}
 * @returns {string} 'poor', 'average', 'good', or 'excellent'
 */
function getRating(value, benchmark) {
  if (value < benchmark.poor) return 'poor';
  if (value < benchmark.average) return 'average';
  if (value < benchmark.good) return 'good';
  return 'excellent';
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
