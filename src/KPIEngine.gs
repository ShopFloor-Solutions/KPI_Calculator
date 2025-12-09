/**
 * KPIEngine.gs
 * Calculate derived KPIs from raw inputs
 *
 * ShopFloor Solutions - Operational KPI Calculator
 */

// ============================================================================
// MAIN CALCULATION ENTRY POINT
// ============================================================================

/**
 * Calculate all derived KPIs for a client
 * Now tier-aware: only calculates KPIs appropriate for client's form_tier
 * @param {Object} clientData - Client object with rawInputs and formTier
 * @param {Object[]} kpiConfig - KPI definitions
 * @returns {Object} Calculated KPI values {kpi_id: value}
 */
function calculateAllKPIs(clientData, kpiConfig) {
  const periodDays = clientData.periodDays || 30;
  const clientTier = clientData.formTier || '';

  // Get KPIs applicable to this tier (if tier is set)
  let tierKPIs = kpiConfig;
  if (clientTier) {
    tierKPIs = getKPIsForTier(kpiConfig, clientTier);
    log(`Tier ${clientTier}: ${tierKPIs.length} KPIs applicable out of ${kpiConfig.length} total`);
  }

  // Build set of tier KPI IDs for dependency checking
  const tierKPIIds = new Set(tierKPIs.map(k => k.id));

  // Get calculated KPIs for this tier
  const calculatedKPIs = tierKPIs.filter(k => k.type === 'calculated');

  // Filter to only those with all dependencies in the tier
  const calculableKPIs = calculatedKPIs.filter(kpi => {
    if (!kpi.formula) return false;
    const deps = extractDependencies(kpi.formula);
    return deps.every(dep => tierKPIIds.has(dep) || /^-?\d+\.?\d*$/.test(dep));
  });

  // Start with raw inputs
  const allValues = clone(clientData.rawInputs);

  // Sort calculated KPIs by dependency order
  const sortedKPIs = sortByDependencyOrder(calculableKPIs, tierKPIs);

  // Calculate each KPI in order
  for (const kpiDef of sortedKPIs) {
    try {
      const value = calculateKPI(kpiDef, allValues, periodDays);
      allValues[kpiDef.id] = value;

      if (value !== null) {
        log(`Calculated ${kpiDef.id} = ${value}`);
      }
    } catch (error) {
      logError(`Error calculating ${kpiDef.id}`, error);
      allValues[kpiDef.id] = null;
    }
  }

  // Extract only calculated values (not raw inputs)
  const result = {};
  for (const kpi of calculableKPIs) {
    result[kpi.id] = allValues[kpi.id];
  }

  return result;
}

/**
 * Calculate a single KPI
 * @param {Object} kpiDef - KPI definition
 * @param {Object} allValues - All available values (raw + already calculated)
 * @param {number} periodDays - Days in the client's data period
 * @returns {number|null} Calculated value or null if missing dependencies
 */
function calculateKPI(kpiDef, allValues, periodDays) {
  if (!kpiDef.formula) {
    return null;
  }

  // Check dependencies
  if (!hasDependencies(kpiDef.formula, allValues)) {
    return null;
  }

  return executeFormula(kpiDef.formula, allValues, periodDays);
}

// ============================================================================
// FORMULA EXECUTION
// ============================================================================

/**
 * Parse and execute a formula expression
 * @param {string} formula - Formula string (e.g., "DIVIDE:a:b")
 * @param {Object} values - Available values
 * @param {number} periodDays - Days in period
 * @returns {number|null}
 */
function executeFormula(formula, values, periodDays) {
  if (!formula) return null;

  const parts = formula.split(':');
  const operation = parts[0].toUpperCase();

  switch (operation) {
    case 'DIVIDE':
      return executeDivide(parts[1], parts[2], values);

    case 'MULTIPLY':
      return executeMultiply(parts[1], parts[2], values);

    case 'SUBTRACT':
      return executeSubtract(parts[1], parts[2], values);

    case 'ADD':
      return executeAdd(parts[1], parts[2], values);

    case 'PERCENTAGE':
      return executePercentage(parts[1], parts[2], values);

    case 'PER_DAY':
      return executePerDay(parts[1], values, periodDays);

    case 'PER_VEHICLE':
      return executeDivide(parts[1], parts[2], values);

    case 'CAPACITY':
      return executeCapacity(parts[1], parts[2], parts[3], values);

    case 'CUSTOM':
      return executeCustom(parts[1], values, periodDays);

    default:
      logError(`Unknown formula operation: ${operation}`);
      return null;
  }
}

/**
 * Execute DIVIDE operation (a ÷ b)
 * @param {string} numeratorId - Numerator KPI ID
 * @param {string} denominatorId - Denominator KPI ID
 * @param {Object} values - Available values
 * @returns {number|null}
 */
function executeDivide(numeratorId, denominatorId, values) {
  const a = getValueOrNumber(numeratorId, values);
  const b = getValueOrNumber(denominatorId, values);

  return safeDivide(a, b);
}

/**
 * Execute MULTIPLY operation (a × b)
 * @param {string} aId - First operand KPI ID
 * @param {string} bId - Second operand KPI ID
 * @param {Object} values - Available values
 * @returns {number|null}
 */
function executeMultiply(aId, bId, values) {
  const a = getValueOrNumber(aId, values);
  const b = getValueOrNumber(bId, values);

  if (isEmpty(a) || isEmpty(b)) {
    return null;
  }

  return a * b;
}

/**
 * Execute SUBTRACT operation (a - b)
 * @param {string} aId - First operand KPI ID
 * @param {string} bId - Second operand KPI ID
 * @param {Object} values - Available values
 * @returns {number|null}
 */
function executeSubtract(aId, bId, values) {
  const a = getValueOrNumber(aId, values);
  const b = getValueOrNumber(bId, values);

  if (isEmpty(a) || isEmpty(b)) {
    return null;
  }

  return a - b;
}

/**
 * Execute ADD operation (a + b)
 * @param {string} aId - First operand KPI ID
 * @param {string} bId - Second operand KPI ID
 * @param {Object} values - Available values
 * @returns {number|null}
 */
function executeAdd(aId, bId, values) {
  const a = getValueOrNumber(aId, values);
  const b = getValueOrNumber(bId, values);

  if (isEmpty(a) || isEmpty(b)) {
    return null;
  }

  return a + b;
}

/**
 * Execute PERCENTAGE operation ((a ÷ b) × 100)
 * @param {string} numeratorId - Numerator KPI ID
 * @param {string} denominatorId - Denominator KPI ID
 * @param {Object} values - Available values
 * @returns {number|null}
 */
function executePercentage(numeratorId, denominatorId, values) {
  const result = executeDivide(numeratorId, denominatorId, values);

  if (result === null) {
    return null;
  }

  return result * 100;
}

/**
 * Execute PER_DAY normalization
 * @param {string} valueId - Value KPI ID
 * @param {Object} values - Available values
 * @param {number} periodDays - Days in period
 * @returns {number|null}
 */
function executePerDay(valueId, values, periodDays) {
  const value = getValueOrNumber(valueId, values);

  if (isEmpty(value) || !periodDays || periodDays <= 0) {
    return null;
  }

  return value / periodDays;
}

/**
 * Execute CAPACITY operation (a × b × c)
 * @param {string} aId - First operand (e.g., num_techs)
 * @param {string} bId - Second operand (e.g., hours per day)
 * @param {string} cId - Third operand (e.g., days)
 * @param {Object} values - Available values
 * @returns {number|null}
 */
function executeCapacity(aId, bId, cId, values) {
  const a = getValueOrNumber(aId, values);
  const b = getValueOrNumber(bId, values);
  const c = getValueOrNumber(cId, values);

  if (isEmpty(a) || isEmpty(b) || isEmpty(c)) {
    return null;
  }

  return a * b * c;
}

/**
 * Execute CUSTOM formula (calls named function)
 * @param {string} functionName - Name of custom function
 * @param {Object} values - Available values
 * @param {number} periodDays - Days in period
 * @returns {number|null}
 */
function executeCustom(functionName, values, periodDays) {
  switch (functionName) {
    case 'calculateScheduleCapacity':
      return calculateScheduleCapacity(values, periodDays);

    default:
      logError(`Unknown custom function: ${functionName}`);
      return null;
  }
}

// ============================================================================
// CUSTOM CALCULATION FUNCTIONS
// ============================================================================

/**
 * CUSTOM: Calculate schedule capacity
 * Techs × hours per day × days in period
 * Uses client's hours_per_day if provided, otherwise defaults to 8
 * @param {Object} values - Available values
 * @param {number} periodDays - Days in period
 * @returns {number|null}
 */
function calculateScheduleCapacity(values, periodDays) {
  const numTechs = values.num_techs;

  if (isEmpty(numTechs) || numTechs <= 0) {
    return null;
  }

  // Use client's configured hours per day, default to 8
  const hoursPerDay = values.hours_per_day || 8;

  // Calculate working days (assume 5-day work week)
  // For monthly (30 days) = ~22 working days
  // For quarterly (90 days) = ~66 working days
  // For annual (365 days) = ~260 working days
  const workingDays = Math.round(periodDays * (5 / 7));

  return numTechs * hoursPerDay * workingDays;
}

// ============================================================================
// DEPENDENCY MANAGEMENT
// ============================================================================

/**
 * Check if all dependencies for a formula are available
 * @param {string} formula - Formula string
 * @param {Object} values - Available values
 * @returns {boolean}
 */
function hasDependencies(formula, values) {
  const deps = extractDependencies(formula);

  for (const dep of deps) {
    // Skip if it's a number literal
    if (/^-?\d+\.?\d*$/.test(dep)) continue;

    const value = values[dep];
    if (isEmpty(value)) {
      return false;
    }
  }

  return true;
}

/**
 * Sort calculated KPIs by dependency order
 * Ensures dependencies are calculated before dependents
 * @param {Object[]} calculatedKPIs - Calculated KPI definitions
 * @param {Object[]} allKPIs - All KPI definitions (for reference)
 * @returns {Object[]} Sorted array
 */
function sortByDependencyOrder(calculatedKPIs, allKPIs) {
  // Build dependency graph
  const graph = {};
  const inDegree = {};

  for (const kpi of calculatedKPIs) {
    graph[kpi.id] = [];
    inDegree[kpi.id] = 0;
  }

  // Add edges for dependencies between calculated KPIs
  const calculatedIds = calculatedKPIs.map(k => k.id);

  for (const kpi of calculatedKPIs) {
    const deps = extractDependencies(kpi.formula);

    for (const dep of deps) {
      // Only consider dependencies that are also calculated KPIs
      if (calculatedIds.includes(dep)) {
        graph[dep].push(kpi.id);
        inDegree[kpi.id]++;
      }
    }
  }

  // Topological sort using Kahn's algorithm
  const queue = [];
  const sorted = [];

  // Start with KPIs that have no calculated dependencies
  for (const id in inDegree) {
    if (inDegree[id] === 0) {
      queue.push(id);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift();
    const kpi = calculatedKPIs.find(k => k.id === current);

    if (kpi) {
      sorted.push(kpi);
    }

    for (const dependent of graph[current] || []) {
      inDegree[dependent]--;
      if (inDegree[dependent] === 0) {
        queue.push(dependent);
      }
    }
  }

  // Check for cycles (should not happen with proper config)
  if (sorted.length !== calculatedKPIs.length) {
    logError('Circular dependency detected in KPI formulas');
    // Return original order as fallback
    return calculatedKPIs;
  }

  return sorted;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get value from values object, or parse as number if it's a literal
 * @param {string} idOrNumber - KPI ID or number literal
 * @param {Object} values - Available values
 * @returns {number|null}
 */
function getValueOrNumber(idOrNumber, values) {
  if (!idOrNumber) return null;

  // Check if it's a number literal
  if (/^-?\d+\.?\d*$/.test(idOrNumber)) {
    return parseFloat(idOrNumber);
  }

  // Look up in values
  return values[idOrNumber] !== undefined ? values[idOrNumber] : null;
}

/**
 * Get all KPI values for a specific category
 * @param {Object} allValues - All KPI values
 * @param {Object[]} kpiConfig - KPI definitions
 * @param {string} category - 'volume' or 'efficiency'
 * @returns {Object} Filtered values
 */
function getValuesByCategory(allValues, kpiConfig, category) {
  const result = {};
  const categoryKPIs = kpiConfig.filter(k => k.category === category);

  for (const kpi of categoryKPIs) {
    if (allValues.hasOwnProperty(kpi.id)) {
      result[kpi.id] = allValues[kpi.id];
    }
  }

  return result;
}

/**
 * Get summary of calculated values
 * @param {Object} calculatedValues - Calculated KPI values
 * @param {Object[]} kpiConfig - KPI definitions
 * @returns {Object} Summary with counts and status
 */
function getCalculationSummary(calculatedValues, kpiConfig) {
  const calculatedKPIs = kpiConfig.filter(k => k.type === 'calculated');

  let successful = 0;
  let failed = 0;

  for (const kpi of calculatedKPIs) {
    if (calculatedValues[kpi.id] !== null && calculatedValues[kpi.id] !== undefined) {
      successful++;
    } else {
      failed++;
    }
  }

  return {
    total: calculatedKPIs.length,
    successful: successful,
    failed: failed,
    completionRate: calculatedKPIs.length > 0 ?
      Math.round((successful / calculatedKPIs.length) * 100) : 0
  };
}

/**
 * Recalculate a single KPI and its dependents
 * @param {string} kpiId - KPI ID to recalculate
 * @param {Object} allValues - All current values
 * @param {Object[]} kpiConfig - KPI definitions
 * @param {number} periodDays - Period days
 * @returns {Object} Updated values
 */
function recalculateKPIAndDependents(kpiId, allValues, kpiConfig, periodDays) {
  const values = clone(allValues);
  const calculatedKPIs = kpiConfig.filter(k => k.type === 'calculated');

  // Find the KPI and all its dependents
  const toRecalculate = findDependents(kpiId, calculatedKPIs);

  // Sort by dependency order
  const sorted = sortByDependencyOrder(
    calculatedKPIs.filter(k => toRecalculate.includes(k.id)),
    kpiConfig
  );

  // Recalculate each
  for (const kpi of sorted) {
    values[kpi.id] = calculateKPI(kpi, values, periodDays);
  }

  return values;
}

/**
 * Find all KPIs that depend on a given KPI
 * @param {string} kpiId - Source KPI ID
 * @param {Object[]} calculatedKPIs - Calculated KPI definitions
 * @returns {string[]} Array of dependent KPI IDs
 */
function findDependents(kpiId, calculatedKPIs) {
  const dependents = [kpiId];
  const queue = [kpiId];

  while (queue.length > 0) {
    const current = queue.shift();

    for (const kpi of calculatedKPIs) {
      if (dependents.includes(kpi.id)) continue;

      const deps = extractDependencies(kpi.formula);
      if (deps.includes(current)) {
        dependents.push(kpi.id);
        queue.push(kpi.id);
      }
    }
  }

  return dependents;
}
