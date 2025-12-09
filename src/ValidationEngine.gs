/**
 * ValidationEngine.gs
 * Data validation logic and consistency checks
 *
 * ShopFloor Solutions - Operational KPI Calculator
 */

// ============================================================================
// MAIN VALIDATION ENTRY POINT
// ============================================================================

/**
 * Run all validation rules against client data
 * @param {Object} allValues - Raw + calculated KPI values
 * @param {Object[]} validationConfig - Validation rules
 * @param {Object[]} [kpiConfig] - KPI definitions (for section lookup)
 * @returns {Object} {status: string, issues: ValidationIssue[]}
 */
function validateAll(allValues, validationConfig, kpiConfig) {
  const issues = [];

  // Sort validations by type (dependency first, then range, then reconciliation)
  const sortedRules = sortValidationRules(validationConfig);

  for (const rule of sortedRules) {
    try {
      const issue = runValidation(rule, allValues, kpiConfig);

      if (issue) {
        issues.push(issue);
      }
    } catch (error) {
      logError(`Error running validation ${rule.id}`, error);

      // Add error issue
      issues.push({
        ruleId: rule.id,
        ruleName: rule.name,
        severity: SEVERITY_LEVELS.ERROR,
        message: `Validation could not be completed: ${error.message}`,
        expected: null,
        actual: null,
        variance: null,
        affectedKPIs: rule.affectedKPIs || []
      });
    }
  }

  // Determine overall status
  const status = determineOverallStatus(issues);

  return {
    status: status,
    issues: issues
  };
}

/**
 * Sort validation rules by execution order
 * @param {Object[]} rules - Validation rules
 * @returns {Object[]} Sorted rules
 */
function sortValidationRules(rules) {
  const typeOrder = {
    'dependency': 1,
    'range': 2,
    'reconciliation': 3,
    'ratio': 4
  };

  return [...rules].sort((a, b) => {
    const orderA = typeOrder[a.type] || 99;
    const orderB = typeOrder[b.type] || 99;
    return orderA - orderB;
  });
}

// ============================================================================
// INDIVIDUAL VALIDATION EXECUTION
// ============================================================================

/**
 * Run a single validation rule
 * @param {Object} rule - Validation rule definition
 * @param {Object} values - All KPI values
 * @param {Object[]} [kpiConfig] - KPI definitions
 * @returns {Object|null} ValidationIssue or null if passed
 */
function runValidation(rule, values, kpiConfig) {
  let result;

  switch (rule.type) {
    case 'reconciliation':
      result = executeReconcile(rule.formula, values, rule.tolerance);
      break;

    case 'range':
      if (rule.formula.startsWith('RANGE:')) {
        result = executeRange(rule.formula, values);
      } else if (rule.formula.startsWith('GREATER:')) {
        result = executeGreater(rule.formula, values);
      } else {
        result = { passed: true };
      }
      break;

    case 'dependency':
      result = executeRequires(rule.formula, values);
      break;

    case 'ratio':
      result = executeEquals(rule.formula, values, rule.tolerance);
      break;

    default:
      // Unknown type - try to parse formula
      result = executeGenericValidation(rule.formula, values, rule.tolerance);
  }

  // If validation passed, return null
  if (result.passed) {
    return null;
  }

  // Build validation issue
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    severity: rule.severity,
    message: formatValidationMessage(rule.message, result),
    expected: result.expected,
    actual: result.actual,
    variance: result.variance,
    affectedKPIs: rule.affectedKPIs,
    affectedSections: getAffectedSections(rule.affectedKPIs, kpiConfig)
  };
}

// ============================================================================
// VALIDATION TYPE IMPLEMENTATIONS
// ============================================================================

/**
 * Execute RECONCILE validation
 * Check if calculated value matches reported value
 * Format: RECONCILE:expression:target
 *
 * Supported expression operators: +, -, *, /
 * Examples:
 *   RECONCILE:total_leads*booking_rate/100:in_home_visits
 *   RECONCILE:CSR_CORE_003+CSR_CORE_004:CSR_CORE_001  (addition)
 *   RECONCILE:SAL_CORE_003*SAL_DER_002:SAL_CORE_004  (multiplication)
 *
 * @param {string} formula
 * @param {Object} values
 * @param {number} tolerance
 * @returns {Object} {passed: boolean, expected, actual, variance}
 */
function executeReconcile(formula, values, tolerance) {
  // Parse formula: RECONCILE:expression:target
  const parts = formula.split(':');

  if (parts.length < 3) {
    return { passed: true }; // Invalid formula, skip
  }

  const expression = parts[1];
  const targetId = parts[2];

  // Evaluate expression (supports +, -, *, / operators)
  const expected = evaluateExpression(expression, values);
  const actual = values[targetId];

  // If either value is missing, can't validate
  if (isEmpty(expected) || isEmpty(actual)) {
    return { passed: true }; // Skip validation if data missing
  }

  // Calculate variance
  const variance = calculateVariance(expected, actual);

  // Check if within tolerance
  const passed = variance !== null && variance <= tolerance;

  return {
    passed: passed,
    expected: expected,
    actual: actual,
    variance: variance
  };
}

/**
 * Execute RANGE validation
 * Check if value is within acceptable bounds
 * Format: RANGE:kpi_id:min:max
 *
 * Supports negative values for min/max (e.g., RANGE:net_margin:-50:50)
 *
 * @param {string} formula
 * @param {Object} values
 * @returns {Object} {passed: boolean, actual, min, max}
 */
function executeRange(formula, values) {
  const parts = formula.split(':');

  if (parts.length < 4) {
    return { passed: true };
  }

  const kpiId = parts[1];
  const min = parseFloat(parts[2]);
  const max = parseFloat(parts[3]);
  const actual = values[kpiId];

  // Validate min/max are valid numbers
  if (isNaN(min) || isNaN(max)) {
    log(`Invalid RANGE bounds: min=${parts[2]}, max=${parts[3]}`);
    return { passed: true };
  }

  // If value is missing, skip validation
  if (isEmpty(actual)) {
    return { passed: true };
  }

  const numericActual = parseFloat(actual);
  if (isNaN(numericActual)) {
    return { passed: true };
  }

  const passed = numericActual >= min && numericActual <= max;

  // Format expected string to show negative signs clearly
  const minStr = min < 0 ? `(${min})` : String(min);
  const maxStr = max < 0 ? `(${max})` : String(max);

  return {
    passed: passed,
    actual: numericActual,
    expected: `${minStr} to ${maxStr}`,
    min: min,
    max: max,
    variance: passed ? 0 : (numericActual < min ? min - numericActual : numericActual - max)
  };
}

/**
 * Execute GREATER validation
 * Check if a > b
 * Format: GREATER:a:b
 * @param {string} formula
 * @param {Object} values
 * @returns {Object} {passed: boolean, actual, expected}
 */
function executeGreater(formula, values) {
  const parts = formula.split(':');

  if (parts.length < 3) {
    return { passed: true };
  }

  const aId = parts[1];
  const bId = parts[2];
  const a = values[aId];
  const b = values[bId];

  // If either value is missing, skip validation
  if (isEmpty(a) || isEmpty(b)) {
    return { passed: true };
  }

  const passed = a > b;

  return {
    passed: passed,
    actual: a,
    expected: `> ${b}`,
    variance: passed ? 0 : b - a
  };
}

/**
 * Execute EQUALS validation
 * Check if two values are equal within tolerance
 * Format: EQUALS:a:b
 * @param {string} formula
 * @param {Object} values
 * @param {number} tolerance
 * @returns {Object} {passed: boolean, expected, actual, variance}
 */
function executeEquals(formula, values, tolerance) {
  const parts = formula.split(':');

  if (parts.length < 3) {
    return { passed: true };
  }

  const aId = parts[1];
  const bId = parts[2];
  const a = values[aId];
  const b = values[bId];

  // If either value is missing, skip validation
  if (isEmpty(a) || isEmpty(b)) {
    return { passed: true };
  }

  const variance = calculateVariance(a, b);
  const passed = variance !== null && variance <= tolerance;

  return {
    passed: passed,
    expected: b,
    actual: a,
    variance: variance
  };
}

/**
 * Execute REQUIRES validation
 * Check if dependent value exists when parent should exist
 * Format: REQUIRES:dependent:parent
 * @param {string} formula
 * @param {Object} values
 * @returns {Object} {passed: boolean, message}
 */
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
  // Pass if: dependent is empty OR parent has value
  // Fail if: dependent has value AND parent is empty

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

  // Note: We intentionally do NOT check if dependent > parent here.
  // That comparison is not always valid (e.g., in_home_visits can exceed
  // total_leads if leads come from multiple sources or previous periods).
  // Use a separate GREATER validation rule if that check is needed.

  return { passed: true };
}

/**
 * Execute generic validation (tries to determine type from formula)
 * @param {string} formula
 * @param {Object} values
 * @param {number} tolerance
 * @returns {Object}
 */
function executeGenericValidation(formula, values, tolerance) {
  if (formula.startsWith('RECONCILE:')) {
    return executeReconcile(formula, values, tolerance);
  } else if (formula.startsWith('RANGE:')) {
    return executeRange(formula, values);
  } else if (formula.startsWith('GREATER:')) {
    return executeGreater(formula, values);
  } else if (formula.startsWith('EQUALS:')) {
    return executeEquals(formula, values, tolerance);
  } else if (formula.startsWith('REQUIRES:')) {
    return executeRequires(formula, values);
  }

  return { passed: true };
}

// ============================================================================
// EXPRESSION EVALUATION
// ============================================================================

/**
 * Evaluate a mathematical expression with KPI values
 * Supports: +, -, *, /, and KPI references
 * Example: "total_leads*booking_rate/100"
 * @param {string} expression
 * @param {Object} values
 * @returns {number|null}
 */
function evaluateExpression(expression, values) {
  try {
    // Replace KPI IDs with their values
    let evalExpr = expression;

    // Find all word tokens (potential KPI IDs)
    const tokens = expression.match(/[a-z_][a-z0-9_]*/gi) || [];

    for (const token of tokens) {
      if (values.hasOwnProperty(token)) {
        const value = values[token];
        if (isEmpty(value)) {
          return null; // Missing value, can't evaluate
        }
        // Replace token with value (use regex to avoid partial replacements)
        const regex = new RegExp(`\\b${token}\\b`, 'g');
        evalExpr = evalExpr.replace(regex, value);
      }
    }

    // Safely evaluate the mathematical expression
    // Only allow numbers, operators, parentheses, and decimal points
    if (!/^[\d\s\+\-\*\/\.\(\)]+$/.test(evalExpr)) {
      logError(`Invalid expression after substitution: ${evalExpr}`);
      return null;
    }

    // Use Function constructor for safe evaluation
    const result = Function(`"use strict"; return (${evalExpr})`)();

    if (typeof result !== 'number' || isNaN(result)) {
      return null;
    }

    return result;

  } catch (error) {
    logError(`Error evaluating expression: ${expression}`, error);
    return null;
  }
}

// ============================================================================
// MESSAGE FORMATTING
// ============================================================================

/**
 * Format validation message with actual values
 * Replace {expected}, {actual}, {variance} placeholders
 * @param {string} template - Message template
 * @param {Object} data - Validation result data
 * @returns {string}
 */
function formatValidationMessage(template, data) {
  let message = template;

  // Replace placeholders
  if (data.expected !== null && data.expected !== undefined) {
    const expectedStr = typeof data.expected === 'number' ?
      formatNumber(data.expected) : String(data.expected);
    message = message.replace(/\{expected\}/g, expectedStr);
  }

  if (data.actual !== null && data.actual !== undefined) {
    const actualStr = typeof data.actual === 'number' ?
      formatNumber(data.actual) : String(data.actual);
    message = message.replace(/\{actual\}/g, actualStr);
  }

  if (data.variance !== null && data.variance !== undefined) {
    const varianceStr = (data.variance * 100).toFixed(1) + '%';
    message = message.replace(/\{variance\}/g, varianceStr);
  }

  return message;
}

/**
 * Format number for display in messages
 * @param {number} value
 * @returns {string}
 */
function formatNumber(value) {
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// ============================================================================
// STATUS DETERMINATION
// ============================================================================

/**
 * Determine overall validation status
 * @param {Object[]} issues - Array of validation issues
 * @returns {string} "valid", "warnings", "errors"
 */
function determineOverallStatus(issues) {
  const hasErrors = issues.some(i => i.severity === SEVERITY_LEVELS.ERROR);
  const hasWarnings = issues.some(i => i.severity === SEVERITY_LEVELS.WARNING);

  if (hasErrors) {
    return VALIDATION_STATUS.ERRORS;
  } else if (hasWarnings) {
    return VALIDATION_STATUS.WARNINGS;
  } else {
    return VALIDATION_STATUS.VALID;
  }
}

// ============================================================================
// AFFECTED ELEMENTS
// ============================================================================

/**
 * Get business sections affected by validation issues
 * @param {string[]} kpiIds - Affected KPI IDs
 * @param {Object[]} kpiConfig - KPI definitions
 * @returns {number[]} Section IDs
 */
function getAffectedSections(kpiIds, kpiConfig) {
  if (!kpiConfig || !kpiIds || kpiIds.length === 0) {
    return [];
  }

  const sections = new Set();

  for (const kpiId of kpiIds) {
    const kpi = kpiConfig.find(k => k.id === kpiId);
    if (kpi && kpi.sections) {
      for (const sectionId of kpi.sections) {
        sections.add(sectionId);
      }
    }
  }

  return Array.from(sections).sort((a, b) => a - b);
}

/**
 * Get KPIs with validation issues
 * @param {Object[]} issues - Validation issues
 * @returns {string[]} Array of KPI IDs with issues
 */
function getKPIsWithIssues(issues) {
  const kpis = new Set();

  for (const issue of issues) {
    if (issue.affectedKPIs) {
      for (const kpiId of issue.affectedKPIs) {
        kpis.add(kpiId);
      }
    }
  }

  return Array.from(kpis);
}

/**
 * Get issues affecting a specific KPI
 * @param {string} kpiId - KPI ID
 * @param {Object[]} issues - All validation issues
 * @returns {Object[]} Issues affecting this KPI
 */
function getIssuesForKPI(kpiId, issues) {
  return issues.filter(issue =>
    issue.affectedKPIs && issue.affectedKPIs.includes(kpiId)
  );
}

/**
 * Get the most severe issue for a KPI
 * @param {string} kpiId - KPI ID
 * @param {Object[]} issues - All validation issues
 * @returns {Object|null} Most severe issue or null
 */
function getMostSevereIssueForKPI(kpiId, issues) {
  const kpiIssues = getIssuesForKPI(kpiId, issues);

  if (kpiIssues.length === 0) {
    return null;
  }

  // Sort by severity (error > warning > info)
  const severityOrder = { error: 0, warning: 1, info: 2 };

  kpiIssues.sort((a, b) =>
    (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99)
  );

  return kpiIssues[0];
}

// ============================================================================
// VALIDATION SUMMARY
// ============================================================================

/**
 * Get validation summary statistics
 * @param {Object[]} issues - Validation issues
 * @returns {Object} Summary statistics
 */
function getValidationSummary(issues) {
  const summary = {
    total: issues.length,
    byType: {
      error: 0,
      warning: 0,
      info: 0
    },
    affectedKPIs: [],
    affectedSections: []
  };

  const kpis = new Set();
  const sections = new Set();

  for (const issue of issues) {
    // Count by severity
    if (summary.byType.hasOwnProperty(issue.severity)) {
      summary.byType[issue.severity]++;
    }

    // Collect affected KPIs
    if (issue.affectedKPIs) {
      for (const kpi of issue.affectedKPIs) {
        kpis.add(kpi);
      }
    }

    // Collect affected sections
    if (issue.affectedSections) {
      for (const section of issue.affectedSections) {
        sections.add(section);
      }
    }
  }

  summary.affectedKPIs = Array.from(kpis);
  summary.affectedSections = Array.from(sections).sort((a, b) => a - b);

  return summary;
}

/**
 * Generate suggested actions for issues
 * @param {Object} issue - Validation issue
 * @returns {string} Suggested action
 */
function getSuggestedAction(issue) {
  const suggestions = {
    'booking_rate_reconcile': 'Review your lead count and visit records. Either the booking rate or the counts may be incorrect.',
    'close_rate_reconcile': 'Check your visit and job records. The close rate should equal jobs ÷ visits.',
    'revenue_reconcile': 'Verify your job count and average ticket. Revenue should equal jobs × average ticket.',
    'profit_positive': 'Review your revenue and cost figures. Consider pricing adjustments or cost reductions.',
    'close_rate_range': 'Close rate should be a percentage between 0 and 100. Check your input.',
    'booking_rate_range': 'Booking rate should be a percentage between 0 and 100. Check your input.',
    'schedule_efficiency_range': 'High schedule efficiency may indicate overtime. Verify your hours and capacity.',
    'avg_ticket_match': 'Your reported average ticket differs from calculated. This may indicate missing jobs.',
    'has_leads_for_visits': 'You have visits but no leads recorded. All appointments should trace back to leads.',
    'has_visits_for_jobs': 'You have closed jobs but no visits. Unless these are phone sales, visits should be recorded.'
  };

  return suggestions[issue.ruleId] ||
    'Review the affected metrics and verify the data is accurate.';
}
