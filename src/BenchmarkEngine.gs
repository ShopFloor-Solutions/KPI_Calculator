/**
 * BenchmarkEngine.gs
 * Benchmark comparison and rating logic
 *
 * ShopFloor Solutions - Operational KPI Calculator
 */

// ============================================================================
// RATING LEVELS
// ============================================================================

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

// ============================================================================
// BENCHMARK PERIOD ADJUSTMENT
// ============================================================================

/**
 * Get the divisor for converting annual benchmarks to user's period
 * @param {string} userPeriod - User's data period ('monthly', 'quarterly', 'annual')
 * @returns {number} Divisor to apply to annual benchmarks
 */
function getPeriodDivisor(userPeriod) {
  if (!userPeriod) return 1;

  switch (userPeriod.toLowerCase().trim()) {
    case 'monthly':
      return 12;
    case 'quarterly':
      return 4;
    case 'annual':
    case 'annually':
      return 1;
    default:
      return 1;
  }
}

/**
 * Adjust benchmark thresholds based on user's reporting period
 * Only applies to time-sensitive KPIs (benchmark_period = 'annual')
 *
 * Example: User submits quarterly data ($85K revenue/tech)
 * - Benchmark says "Good = $300K" (annual)
 * - We divide: $300K / 4 = $75K quarterly threshold
 * - Compare: $85K > $75K = "Good"
 *
 * @param {Object} benchmark - Benchmark object with poor/average/good/excellent thresholds
 * @param {string} userPeriod - User's data period from form ('monthly', 'quarterly', 'annual')
 * @returns {Object} Adjusted benchmark object (or original if no adjustment needed)
 */
function adjustBenchmarkForPeriod(benchmark, userPeriod) {
  // If no benchmark or no period info, return as-is
  if (!benchmark || !userPeriod) {
    return benchmark;
  }

  // Only adjust if benchmark is explicitly marked as 'annual'
  const benchmarkPeriod = (benchmark.benchmarkPeriod || 'agnostic').toLowerCase().trim();

  if (benchmarkPeriod !== 'annual') {
    // Ratios and percentages don't need adjustment
    return benchmark;
  }

  // Get divisor based on user's period
  const divisor = getPeriodDivisor(userPeriod);

  // If user submitted annual data, no adjustment needed
  if (divisor === 1) {
    return benchmark;
  }

  // Divide all thresholds by the period divisor
  return {
    poor: benchmark.poor / divisor,
    average: benchmark.average / divisor,
    good: benchmark.good / divisor,
    excellent: benchmark.excellent / divisor,
    direction: benchmark.direction,
    benchmarkPeriod: benchmark.benchmarkPeriod,
    // Preserve other properties
    matchType: benchmark.matchType
  };
}

// ============================================================================
// RATING LOGIC
// ============================================================================

/**
 * Get performance rating for a value against benchmark thresholds
 *
 * For direction='higher' (higher is better):
 *   Thresholds in ASCENDING order: poor < average < good < excellent
 *   Value >= excellent -> Excellent
 *   Value >= good -> Good
 *   Value >= average -> Average
 *   Value >= poor -> Poor
 *   Value < poor -> Critical
 *
 * For direction='lower' (lower is better):
 *   Thresholds in DESCENDING order: poor > average > good > excellent
 *   Value <= excellent -> Excellent
 *   Value <= good -> Good
 *   Value <= average -> Average
 *   Value <= poor -> Poor
 *   Value > poor -> Critical
 *
 * @param {number} value - The KPI value to rate
 * @param {Object} benchmark - Benchmark object with poor/average/good/excellent thresholds
 * @param {string} [direction='higher'] - 'higher' = higher is better, 'lower' = lower is better
 * @returns {string|null} Rating: 'critical', 'poor', 'average', 'good', or 'excellent', or null if can't rate
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

  // Validate thresholds are numbers
  if (isNaN(poor) || isNaN(average) || isNaN(good) || isNaN(excellent)) {
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
 * @param {string} [direction='higher'] - 'higher' or 'lower'
 * @returns {Object} {rating, label, color, bgColor, icon, comparison}
 */
function getRatingDisplay(value, benchmark, direction = 'higher') {
  const rating = getRating(value, benchmark, direction);

  if (!rating) {
    return {
      rating: null,
      label: null,
      color: '#9e9e9e',      // Gray
      bgColor: '#f5f5f5',
      icon: '—',
      comparison: 'No benchmark'
    };
  }

  // Define colors and labels for each rating
  const ratingConfig = {
    critical: {
      color: '#b71c1c',       // Dark red text
      bgColor: '#ffcdd2',     // Light red background
      icon: '!!',
      label: 'Critical'
    },
    poor: {
      color: '#c62828',       // Red text
      bgColor: '#ffebee',     // Very light red
      icon: '!',
      label: 'Poor'
    },
    average: {
      color: '#f57c00',       // Orange text
      bgColor: '#fff3e0',     // Light orange
      icon: '~',
      label: 'Average'
    },
    good: {
      color: '#2e7d32',       // Green text
      bgColor: '#e8f5e9',     // Light green
      icon: '+',
      label: 'Good'
    },
    excellent: {
      color: '#1b5e20',       // Dark green text
      bgColor: '#c8e6c9',     // Medium green
      icon: '++',
      label: 'Excellent'
    }
  };

  const config = ratingConfig[rating];

  // Build comparison string showing what "good" looks like
  let comparison = '';
  if (benchmark && benchmark.good !== undefined) {
    if (direction === 'lower') {
      comparison = `<=${benchmark.good} is good`;
    } else {
      comparison = `>=${benchmark.good} is good`;
    }
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

// ============================================================================
// BENCHMARK LOOKUP HELPERS
// ============================================================================

/**
 * Load benchmarks formatted for Results display (keyed by kpiId)
 * Uses priority matching: industry+state > industry+all > all+state > all+all
 * @param {string} industry - Client industry
 * @param {string} state - Client state
 * @returns {Object} Benchmarks keyed by kpiId with direction included
 */
function loadBenchmarksForResults(industry, state) {
  const benchmarkList = loadBenchmarkConfig(industry, state);
  const benchmarks = {};

  // Build lookup by kpiId with priority matching
  // loadBenchmarkConfig already filters by industry/state, so we just need
  // to pick the best match for each kpiId
  const industryLower = industry ? industry.toLowerCase() : '';
  const stateLower = state ? state.toLowerCase() : '';

  for (const b of benchmarkList) {
    const kpiId = b.kpiId;

    if (!benchmarks[kpiId]) {
      // First match for this KPI
      benchmarks[kpiId] = {
        poor: b.poor,
        average: b.average,
        good: b.good,
        excellent: b.excellent,
        direction: b.direction || 'higher',
        benchmarkPeriod: b.benchmarkPeriod || 'agnostic',
        matchType: getMatchType(b, industryLower, stateLower)
      };
    } else {
      // Check if this is a better match (more specific)
      const existingMatchType = benchmarks[kpiId].matchType;
      const newMatchType = getMatchType(b, industryLower, stateLower);

      // Priority: exact > industry > state > default
      const priority = { exact: 4, industry: 3, state: 2, default: 1 };

      if (priority[newMatchType] > priority[existingMatchType]) {
        benchmarks[kpiId] = {
          poor: b.poor,
          average: b.average,
          good: b.good,
          excellent: b.excellent,
          direction: b.direction || 'higher',
          benchmarkPeriod: b.benchmarkPeriod || 'agnostic',
          matchType: newMatchType
        };
      }
    }
  }

  return benchmarks;
}

/**
 * Determine the match type for a benchmark against client industry/state
 * @param {Object} benchmark - Benchmark object
 * @param {string} industry - Client industry (lowercase)
 * @param {string} state - Client state (lowercase)
 * @returns {string} 'exact', 'industry', 'state', or 'default'
 */
function getMatchType(benchmark, industry, state) {
  const isIndustryMatch = benchmark.industry !== 'all' && benchmark.industry === industry;
  const isStateMatch = benchmark.state !== 'all' && benchmark.state === state;

  if (isIndustryMatch && isStateMatch) return 'exact';
  if (isIndustryMatch) return 'industry';
  if (isStateMatch) return 'state';
  return 'default';
}

/**
 * Get benchmark for a specific KPI with best match logic
 * @param {string} kpiId - KPI identifier
 * @param {string} industry - Client industry
 * @param {string} state - Client state
 * @returns {Object|null} Best matching benchmark or null
 */
function getBenchmarkForKPIWithDirection(kpiId, industry, state) {
  const benchmarks = loadBenchmarksForResults(industry, state);
  return benchmarks[kpiId] || null;
}

// ============================================================================
// RATING SUMMARY HELPERS
// ============================================================================

/**
 * Get rating distribution summary for a set of KPI values
 * @param {Object} allValues - All KPI values
 * @param {Object} benchmarks - Benchmarks keyed by kpiId
 * @returns {Object} {critical, poor, average, good, excellent, unrated}
 */
function getRatingSummary(allValues, benchmarks) {
  const summary = {
    critical: 0,
    poor: 0,
    average: 0,
    good: 0,
    excellent: 0,
    unrated: 0
  };

  for (const kpiId of Object.keys(allValues)) {
    const value = allValues[kpiId];
    const benchmark = benchmarks[kpiId];

    if (!benchmark) {
      summary.unrated++;
      continue;
    }

    const rating = getRating(value, benchmark, benchmark.direction || 'higher');

    if (rating && summary.hasOwnProperty(rating)) {
      summary[rating]++;
    } else {
      summary.unrated++;
    }
  }

  return summary;
}

/**
 * Get the overall performance level based on rating distribution
 * @param {Object} summary - Rating summary from getRatingSummary()
 * @returns {string} 'critical', 'poor', 'average', 'good', or 'excellent'
 */
function getOverallPerformanceLevel(summary) {
  // If any critical metrics, overall is critical
  if (summary.critical > 0) return RATING_LEVELS.CRITICAL;

  // If more than 30% poor, overall is poor
  const total = summary.poor + summary.average + summary.good + summary.excellent;
  if (total === 0) return RATING_LEVELS.AVERAGE;  // No rated metrics

  const poorRatio = summary.poor / total;
  if (poorRatio > 0.3) return RATING_LEVELS.POOR;

  // If more excellent+good than average+poor, good/excellent
  const goodCount = summary.good + summary.excellent;
  const notGoodCount = summary.poor + summary.average;

  if (summary.excellent > goodCount / 2 && summary.excellent > notGoodCount) {
    return RATING_LEVELS.EXCELLENT;
  }

  if (goodCount > notGoodCount) {
    return RATING_LEVELS.GOOD;
  }

  return RATING_LEVELS.AVERAGE;
}
