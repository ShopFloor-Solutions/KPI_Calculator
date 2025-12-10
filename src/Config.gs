/**
 * Config.gs
 * Configuration loading and parsing
 *
 * ShopFloor Solutions - Operational KPI Calculator
 */

// ============================================================================
// CONFIGURATION LOADING
// ============================================================================

/**
 * Load all KPI definitions from Config_KPIs sheet
 * Supports new v2.0 columns: form_tier, tier_order, tool_category, etc.
 * @returns {Object[]} Array of KPI definition objects
 */
function loadKPIConfig() {
  const sheet = getRequiredSheet(SHEET_NAMES.CONFIG_KPIS);
  const data = sheetToObjects(sheet);

  return data
    .filter(row => row.active === true || row.active === 'TRUE' || row.active === 1)
    .map(row => {
      // Normalize type to lowercase (handles 'calculated' vs 'Calculation')
      const rawType = String(row.type || '').toLowerCase().trim();
      const normalizedType = (rawType === 'calculation') ? 'calculated' : rawType;

      return {
        id: String(row.kpi_id || '').trim(),
        name: String(row.name || '').trim(),
        description: String(row.description || '').trim(),
        category: String(row.category || '').trim(), // Keep original case for section names
        type: normalizedType,
        dataType: String(row.data_type || 'number').toLowerCase().trim(),
        formula: row.formula ? String(row.formula).trim() : null,
        sections: parseSections(row.sections),
        pillar: parseInt(row.pillar, 10) || 1,
        required: row.required === true || row.required === 'TRUE' || row.required === 1,
        formOrder: parseInt(row.form_order, 10) || 999, // Deprecated - use tierOrder
        active: true,
        // New v2.0 columns
        formTier: String(row.form_tier || '').toLowerCase().trim(),
        tierOrder: parseInt(row.tier_order, 10) || 999,
        tierReason: String(row.tier_reason || '').trim(),
        toolCategory: String(row.tool_category || '').toLowerCase().trim(),
        recommendedTool: String(row.recommended_tool || '').trim(),
        toolNotes: String(row.tool_notes || '').trim(),
        importance: String(row.importance || '').trim(),
        // Visibility gap detection columns (v2.1)
        visibilityFlag: String(row.visibility_flag || '').toLowerCase().trim() || null,
        missingMessage: String(row.missing_message || '').trim() || null,
        missingRecommendation: String(row.missing_recommendation || '').trim() || null
      };
    })
    .filter(kpi => kpi.id); // Filter out rows without ID
}

/**
 * Load all validation rules from Config_Validations sheet
 * @returns {Object[]} Array of validation rule objects
 */
function loadValidationConfig() {
  const sheet = getRequiredSheet(SHEET_NAMES.CONFIG_VALIDATIONS);
  const data = sheetToObjects(sheet);

  return data
    .filter(row => row.active === true || row.active === 'TRUE')
    .map(row => ({
      id: String(row.rule_id || '').trim(),
      name: String(row.name || '').trim(),
      description: String(row.description || '').trim(),
      type: String(row.type || '').toLowerCase().trim(),
      formula: String(row.formula || '').trim(),
      tolerance: parseFloat(row.tolerance) || 0,
      severity: String(row.severity || 'warning').toLowerCase().trim(),
      message: String(row.message || '').trim(),
      affectedKPIs: parseAffectedKPIs(row.affected_kpis),
      formTier: String(row.form_tier || '').toLowerCase().trim(),
      active: true
    }))
    .filter(rule => rule.id && rule.formula); // Filter out incomplete rules
}

/**
 * Load section/pillar definitions from Config_Sections sheet
 * @returns {Object[]} Array of section definition objects
 */
function loadSectionConfig() {
  const sheet = getRequiredSheet(SHEET_NAMES.CONFIG_SECTIONS);
  const data = sheetToObjects(sheet);

  return data.map(row => ({
    sectionId: parseInt(row.section_id, 10),
    sectionName: String(row.section_name || '').trim(),
    sectionDescription: String(row.section_description || '').trim(),
    pillarId: parseInt(row.pillar_id, 10) || 1,
    pillarName: String(row.pillar_name || '').trim()
  })).filter(section => section.sectionId);
}

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
      direction: String(row.direction || 'higher').toLowerCase().trim(),
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
    // Benchmarks sheet is optional for phase 1
    log('Benchmarks sheet not found or empty - using defaults');
    return getDefaultBenchmarks();
  }
}

/**
 * Load insight configuration from Config_Insights sheet
 * @returns {Object[]} Array of insight rule objects
 */
function loadInsightConfig() {
  try {
    const sheet = getRequiredSheet(SHEET_NAMES.CONFIG_INSIGHTS);
    const data = sheetToObjects(sheet);

    return data
      .filter(row => row.active === true || row.active === 'TRUE' || row.active === 1)
      .map(row => ({
        id: String(row.insight_id || '').trim(),
        type: String(row.insight_type || 'single').toLowerCase().trim(),
        kpiIds: parseKpiIdsList(row.kpi_ids),
        triggerLogic: String(row.trigger_logic || '').trim(),
        title: String(row.title || '').trim(),
        status: String(row.status || 'good').toLowerCase().trim(),
        summaryTemplate: String(row.summary_template || '').trim(),
        detailTemplate: String(row.detail_template || '').trim(),
        recommendations: parseRecommendations(row.recommendations),
        sectionId: parseInt(row.section_id, 10) || 0,
        affectedSections: parseIntList(row.affected_sections),
        formTier: String(row.form_tier || 'onboarding').toLowerCase().trim(),
        priority: parseInt(row.priority, 10) || 99,
        active: true
      }))
      .filter(rule => rule.id && rule.triggerLogic);
  } catch (e) {
    log('Config_Insights sheet not found or empty - using empty list');
    return [];
  }
}

/**
 * Parse recommendations string (pipe-separated) into array
 * @param {string} str - Pipe-separated recommendations
 * @returns {string[]} Array of recommendations (max 5)
 */
function parseRecommendations(str) {
  if (!str) return [];
  return String(str).split('|').map(s => s.trim()).filter(s => s).slice(0, 5);
}

/**
 * Parse comma-separated integer list
 * @param {string} str - Comma-separated integers
 * @returns {number[]} Array of integers
 */
function parseIntList(str) {
  if (!str) return [];
  return String(str).split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
}

/**
 * Parse comma-separated KPI IDs list
 * @param {string} str - Comma-separated KPI IDs
 * @returns {string[]} Array of KPI IDs
 */
function parseKpiIdsList(str) {
  if (!str) return [];
  return String(str).split(',').map(s => s.trim()).filter(s => s);
}

/**
 * Get default benchmarks (hardcoded for phase 1)
 * Includes direction: 'higher' = higher is better, 'lower' = lower is better
 * @returns {Object[]}
 */
function getDefaultBenchmarks() {
  return [
    // Standard KPIs (higher is better)
    { kpiId: 'booking_rate', industry: 'all', state: 'all', poor: 30, average: 50, good: 70, excellent: 85, direction: 'higher' },
    { kpiId: 'close_rate', industry: 'all', state: 'all', poor: 20, average: 35, good: 50, excellent: 65, direction: 'higher' },
    { kpiId: 'profit_margin', industry: 'all', state: 'all', poor: 5, average: 12, good: 20, excellent: 30, direction: 'higher' },
    { kpiId: 'schedule_efficiency', industry: 'all', state: 'all', poor: 60, average: 80, good: 95, excellent: 100, direction: 'higher' },
    // Inverse KPIs (lower is better)
    { kpiId: 'rework_rate', industry: 'all', state: 'all', poor: 15, average: 10, good: 5, excellent: 2, direction: 'lower' },
    { kpiId: 'cost_per_lead', industry: 'all', state: 'all', poor: 200, average: 150, good: 100, excellent: 50, direction: 'lower' }
  ];
}

// ============================================================================
// FILTERED CONFIGURATION GETTERS
// ============================================================================

/**
 * Get only input KPIs (for form generation)
 * @param {string} [tier] - Optional tier filter: "onboarding", "detailed", "section_deep", or null for all
 * @returns {Object[]} Array of input-type KPI definitions sorted by tier_order
 */
function getInputKPIs(tier = null) {
  const kpis = loadKPIConfig();
  let inputKPIs = kpis.filter(kpi => kpi.type === 'input');

  // Filter by tier if specified
  if (tier) {
    inputKPIs = inputKPIs.filter(kpi => kpi.formTier === tier.toLowerCase());
  }

  // Sort by tier_order (fall back to form_order for backwards compatibility)
  return inputKPIs.sort((a, b) => {
    const orderA = a.tierOrder !== 999 ? a.tierOrder : a.formOrder;
    const orderB = b.tierOrder !== 999 ? b.tierOrder : b.formOrder;
    return orderA - orderB;
  });
}

/**
 * Get input KPIs for multiple tiers combined
 * @param {string[]} tiers - Array of tier names to include
 * @returns {Object[]} Array of input-type KPI definitions sorted by tier_order
 */
function getInputKPIsForTiers(tiers) {
  const kpis = loadKPIConfig();
  const tierSet = new Set(tiers.map(t => t.toLowerCase()));

  return kpis
    .filter(kpi => kpi.type === 'input' && tierSet.has(kpi.formTier))
    .sort((a, b) => {
      const orderA = a.tierOrder !== 999 ? a.tierOrder : a.formOrder;
      const orderB = b.tierOrder !== 999 ? b.tierOrder : b.formOrder;
      return orderA - orderB;
    });
}

/**
 * Get all KPIs (input + calculated) for a client's tier level (cumulative)
 * Excludes any KPIs without a form_tier classification
 * Tier hierarchy: onboarding < detailed < section_deep
 * @param {Object[]} kpiConfig - Full KPI configuration
 * @param {string} clientTier - Client's form tier
 * @returns {Object[]} KPIs applicable to this tier
 */
function getKPIsForTier(kpiConfig, clientTier) {
  const tierOrder = { 'onboarding': 1, 'detailed': 2, 'section_deep': 3 };
  const clientTierNum = tierOrder[clientTier.toLowerCase()] || 0;

  // If client tier is invalid or not set, return empty - caller should prompt user
  if (clientTierNum === 0) {
    return [];
  }

  return kpiConfig.filter(kpi => {
    // Skip unclassified KPIs (no form_tier)
    if (!kpi.formTier || kpi.formTier === '') {
      return false;
    }

    const kpiTierNum = tierOrder[kpi.formTier] || 0;
    // KPI is included if its tier <= client's tier
    return kpiTierNum > 0 && kpiTierNum <= clientTierNum;
  });
}

/**
 * Get tiers included for a given client tier (cumulative)
 * @param {string} clientTier - Client's form tier
 * @returns {string[]} Array of tier names included
 */
function getTiersForClientTier(clientTier) {
  const tier = clientTier.toLowerCase();
  switch (tier) {
    case 'onboarding':
      return ['onboarding'];
    case 'detailed':
      return ['onboarding', 'detailed'];
    case 'section_deep':
      return ['onboarding', 'detailed', 'section_deep'];
    default:
      return [];
  }
}

/**
 * Get only calculated KPIs (for calculation engine)
 * Type is already normalized in loadKPIConfig() (handles 'calculated' and 'Calculation')
 * @returns {Object[]} Array of calculated-type KPI definitions
 */
function getCalculatedKPIs() {
  const kpis = loadKPIConfig();
  return kpis.filter(kpi => kpi.type === 'calculated');
}

/**
 * Get KPIs by category
 * @param {string} category - 'volume' or 'efficiency'
 * @returns {Object[]} Array of KPI definitions
 */
function getKPIsByCategory(category) {
  const kpis = loadKPIConfig();
  return kpis.filter(kpi => kpi.category === category.toLowerCase());
}

/**
 * Get KPI definition by ID
 * @param {string} kpiId - KPI ID
 * @returns {Object|null} KPI definition or null
 */
function getKPIById(kpiId) {
  const kpis = loadKPIConfig();
  return kpis.find(kpi => kpi.id === kpiId) || null;
}

/**
 * Get section definition by ID
 * @param {number} sectionId - Section ID
 * @returns {Object|null} Section definition or null
 */
function getSectionById(sectionId) {
  const sections = loadSectionConfig();
  return sections.find(s => s.sectionId === sectionId) || null;
}

/**
 * Get section names for a list of section IDs
 * @param {number[]} sectionIds - Array of section IDs
 * @returns {string} Comma-separated section names
 */
function getSectionNames(sectionIds) {
  const sections = loadSectionConfig();
  const names = sectionIds
    .map(id => {
      const section = sections.find(s => s.sectionId === id);
      return section ? section.sectionName : null;
    })
    .filter(name => name !== null);

  return names.join(', ');
}

/**
 * Get benchmark for a KPI with priority matching
 * Priority: state+industry > state+all > all+industry > all+all
 * @param {string} kpiId - KPI ID
 * @param {string} [industry] - Industry filter
 * @param {string} [state] - State/province filter
 * @returns {Object|null} Benchmark object or null
 */
function getBenchmarkForKPI(kpiId, industry, state) {
  const benchmarks = loadBenchmarkConfig(industry, state);
  const industryLower = industry ? industry.toLowerCase() : null;
  const stateLower = state ? state.toLowerCase() : null;

  // Filter benchmarks for this KPI
  const kpiBenchmarks = benchmarks.filter(b => b.kpiId === kpiId);

  if (kpiBenchmarks.length === 0) {
    return null;
  }

  // Priority 1: Exact match (state + industry)
  if (industryLower && stateLower) {
    const exact = kpiBenchmarks.find(b =>
      b.industry === industryLower && b.state === stateLower
    );
    if (exact) return exact;
  }

  // Priority 2: State match with industry 'all'
  if (stateLower) {
    const stateMatch = kpiBenchmarks.find(b =>
      b.state === stateLower && b.industry === 'all'
    );
    if (stateMatch) return stateMatch;
  }

  // Priority 3: Industry match with state 'all'
  if (industryLower) {
    const industryMatch = kpiBenchmarks.find(b =>
      b.industry === industryLower && b.state === 'all'
    );
    if (industryMatch) return industryMatch;
  }

  // Priority 4: Default (all + all)
  return kpiBenchmarks.find(b => b.industry === 'all' && b.state === 'all') || null;
}

// ============================================================================
// CONFIGURATION VALIDATION
// ============================================================================

/**
 * Validate configuration integrity
 * Check for: duplicate IDs, invalid references, formula syntax
 * @returns {Object} {valid: boolean, errors: string[], warnings: string[]}
 */
function validateConfig() {
  const errors = [];
  const warnings = [];

  try {
    // Load configurations
    const kpis = loadKPIConfig();
    const validations = loadValidationConfig();
    const sections = loadSectionConfig();

    // Check for duplicate KPI IDs
    const kpiIds = kpis.map(k => k.id);
    const duplicateKPIs = kpiIds.filter((id, i) => kpiIds.indexOf(id) !== i);
    if (duplicateKPIs.length > 0) {
      errors.push(`Duplicate KPI IDs found: ${duplicateKPIs.join(', ')}`);
    }

    // Check for duplicate validation rule IDs
    const ruleIds = validations.map(v => v.id);
    const duplicateRules = ruleIds.filter((id, i) => ruleIds.indexOf(id) !== i);
    if (duplicateRules.length > 0) {
      errors.push(`Duplicate validation rule IDs found: ${duplicateRules.join(', ')}`);
    }

    // Validate KPI formulas reference existing KPIs
    const calculatedKPIs = kpis.filter(k => k.type === 'calculated');
    for (const kpi of calculatedKPIs) {
      if (kpi.formula && !kpi.formula.startsWith('CUSTOM:')) {
        const deps = extractDependencies(kpi.formula);
        for (const dep of deps) {
          if (!kpiIds.includes(dep)) {
            errors.push(`KPI "${kpi.id}" references unknown KPI "${dep}" in formula`);
          }
        }
      }
    }

    // Validate section references
    const sectionIds = sections.map(s => s.sectionId);
    for (const kpi of kpis) {
      for (const sectionId of kpi.sections) {
        if (!sectionIds.includes(sectionId)) {
          warnings.push(`KPI "${kpi.id}" references unknown section ${sectionId}`);
        }
      }
    }

    // Validate validation rules reference existing KPIs
    for (const rule of validations) {
      for (const kpiId of rule.affectedKPIs) {
        if (!kpiIds.includes(kpiId)) {
          warnings.push(`Validation "${rule.id}" references unknown KPI "${kpiId}"`);
        }
      }
    }

    // Check for required input KPIs
    const inputKPIs = kpis.filter(k => k.type === 'input');
    if (inputKPIs.length === 0) {
      errors.push('No input KPIs defined - form will be empty');
    }

    // Check sections exist
    if (sections.length === 0) {
      warnings.push('No sections defined - section mapping will not work');
    }

  } catch (e) {
    errors.push(`Configuration loading failed: ${e.message}`);
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings
  };
}

/**
 * Extract KPI IDs referenced in a formula
 * @param {string} formula - Formula string
 * @returns {string[]} Array of KPI IDs
 */
function extractDependencies(formula) {
  if (!formula) return [];

  // Pattern: OPERATION:kpi_id:kpi_id or OPERATION:kpi_id
  // Also handle special cases like RANGE:kpi_id:number:number
  const parts = formula.split(':');
  const dependencies = [];

  if (parts.length < 2) return [];

  const operation = parts[0].toUpperCase();

  // Skip the operation, extract potential KPI references
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();

    // Skip if it looks like a number
    if (/^-?\d+\.?\d*$/.test(part)) continue;

    // Skip if it's a special keyword
    if (['period', 'days', 'true', 'false'].includes(part.toLowerCase())) continue;

    // This might be a KPI reference
    dependencies.push(part);
  }

  return dependencies;
}

// ============================================================================
// CONFIGURATION INITIALIZATION
// ============================================================================

/**
 * Create default Config_KPIs sheet with sample data
 */
function initializeKPIConfig() {
  const sheet = getOrCreateSheet(SHEET_NAMES.CONFIG_KPIS);

  const headers = [
    'kpi_id', 'name', 'description', 'category', 'type', 'data_type',
    'formula', 'sections', 'pillar', 'required', 'form_order', 'active'
  ];

  const sampleData = [
    // Volume Input KPIs
    ['total_leads', 'Total Leads', 'Number of leads generated in the period', 'volume', 'input', 'integer', '', '1', 1, true, 1, true],
    ['in_home_visits', 'In-Home Visits', 'Number of in-home sales appointments', 'volume', 'input', 'integer', '', '2,3', 1, true, 2, true],
    ['jobs_closed', 'Jobs Closed', 'Number of jobs sold/closed', 'volume', 'input', 'integer', '', '3', 1, true, 3, true],
    ['gross_revenue', 'Gross Revenue', 'Total revenue for the period', 'volume', 'input', 'currency', '', '7', 1, true, 4, true],
    ['total_costs', 'Total Costs', 'Total operating costs for the period', 'volume', 'input', 'currency', '', '7', 1, true, 5, true],
    ['num_employees', 'Number of Employees', 'Total employees', 'volume', 'input', 'integer', '', '8', 3, false, 6, true],
    ['num_techs', 'Number of Technicians', 'Field technicians/installers', 'volume', 'input', 'integer', '', '4,8', 3, false, 7, true],
    ['num_vehicles', 'Number of Vehicles', 'Service vehicles/trucks', 'volume', 'input', 'integer', '', '5,6', 3, false, 8, true],
    ['hours_scheduled', 'Hours Scheduled', 'Total man-hours scheduled to jobs', 'volume', 'input', 'number', '', '5', 2, false, 9, true],
    ['hours_per_day', 'Work Hours Per Day', 'Standard work hours per day for your techs', 'volume', 'input', 'number', '', '5', 2, false, 10, true],

    // Efficiency Input KPIs
    ['average_ticket', 'Average Ticket', 'Average revenue per job (as reported)', 'efficiency', 'input', 'currency', '', '3', 1, false, 11, true],
    ['reported_close_rate', 'Reported Close Rate', 'Close rate as reported by client (%)', 'efficiency', 'input', 'percentage', '', '3', 1, false, 12, true],
    ['reported_booking_rate', 'Reported Booking Rate', 'Booking rate as reported by client (%)', 'efficiency', 'input', 'percentage', '', '2', 1, false, 13, true],

    // Calculated KPIs
    ['booking_rate', 'Booking Rate', 'Calculated: In-home visits ÷ Total leads × 100', 'efficiency', 'calculated', 'percentage', 'PERCENTAGE:in_home_visits:total_leads', '1,2', 1, false, '', true],
    ['close_rate', 'Close Rate', 'Calculated: Jobs closed ÷ In-home visits × 100', 'efficiency', 'calculated', 'percentage', 'PERCENTAGE:jobs_closed:in_home_visits', '3', 1, false, '', true],
    ['net_profit', 'Net Profit', 'Calculated: Gross revenue - Total costs', 'efficiency', 'calculated', 'currency', 'SUBTRACT:gross_revenue:total_costs', '7', 1, false, '', true],
    ['profit_margin', 'Profit Margin', 'Calculated: Net profit ÷ Gross revenue × 100', 'efficiency', 'calculated', 'percentage', 'PERCENTAGE:net_profit:gross_revenue', '7', 1, false, '', true],
    ['schedule_capacity', 'Schedule Capacity', 'Calculated: Techs × hours per day × days in period', 'volume', 'calculated', 'number', 'CUSTOM:calculateScheduleCapacity', '5', 3, false, '', true],
    ['schedule_efficiency', 'Schedule Efficiency', 'Calculated: Hours scheduled ÷ Capacity × 100', 'efficiency', 'calculated', 'percentage', 'PERCENTAGE:hours_scheduled:schedule_capacity', '5', 2, false, '', true],
    ['revenue_per_vehicle', 'Revenue Per Vehicle', 'Calculated: Gross revenue ÷ Number of vehicles', 'efficiency', 'calculated', 'currency', 'DIVIDE:gross_revenue:num_vehicles', '5', 2, false, '', true],
    ['calculated_avg_ticket', 'Calculated Avg Ticket', 'Calculated: Gross revenue ÷ Jobs closed', 'efficiency', 'calculated', 'currency', 'DIVIDE:gross_revenue:jobs_closed', '3', 1, false, '', true],
    ['daily_revenue', 'Daily Revenue', 'Calculated: Gross revenue ÷ days in period', 'efficiency', 'calculated', 'currency', 'PER_DAY:gross_revenue', '7', 1, false, '', true],
    ['revenue_per_tech', 'Revenue Per Tech', 'Calculated: Gross revenue ÷ Number of technicians', 'efficiency', 'calculated', 'currency', 'DIVIDE:gross_revenue:num_techs', '4', 2, false, '', true]
  ];

  // Write headers and data
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, sampleData.length, headers.length).setValues(sampleData);

  // Format header row
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff');

  // Auto-resize columns
  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }

  // Freeze header row
  sheet.setFrozenRows(1);

  log('Initialized Config_KPIs sheet with sample data');
}

/**
 * Create default Config_Validations sheet with sample data
 */
function initializeValidationConfig() {
  const sheet = getOrCreateSheet(SHEET_NAMES.CONFIG_VALIDATIONS);

  const headers = [
    'rule_id', 'name', 'description', 'type', 'formula',
    'tolerance', 'severity', 'message', 'affected_kpis', 'active'
  ];

  const sampleData = [
    ['booking_rate_reconcile', 'Booking Rate Reconciliation', 'Check if reported booking rate matches leads vs visits', 'reconciliation', 'RECONCILE:total_leads*reported_booking_rate/100:in_home_visits', 0.10, 'error', 'Your reported booking rate doesn\'t match your leads and visits. Expected {expected}, got {actual}.', 'total_leads,reported_booking_rate,in_home_visits', true],
    ['close_rate_reconcile', 'Close Rate Reconciliation', 'Check if reported close rate matches visits vs jobs', 'reconciliation', 'RECONCILE:in_home_visits*reported_close_rate/100:jobs_closed', 0.10, 'error', 'Your close rate doesn\'t reconcile with your visits and jobs closed.', 'in_home_visits,reported_close_rate,jobs_closed', true],
    ['revenue_reconcile', 'Revenue Reconciliation', 'Check if revenue matches jobs × ticket', 'reconciliation', 'RECONCILE:jobs_closed*average_ticket:gross_revenue', 0.15, 'warning', 'Your revenue doesn\'t match jobs × average ticket. You may have missing job data.', 'jobs_closed,average_ticket,gross_revenue', true],
    ['profit_positive', 'Profit Should Be Positive', 'Revenue should exceed costs', 'range', 'GREATER:gross_revenue:total_costs', 0, 'warning', 'Your costs exceed your revenue. You\'re operating at a loss.', 'gross_revenue,total_costs', true],
    ['close_rate_range', 'Close Rate Realistic', 'Close rate should be between 0-100%', 'range', 'RANGE:close_rate:0:100', 0, 'error', 'Close rate must be between 0% and 100%.', 'close_rate', true],
    ['booking_rate_range', 'Booking Rate Realistic', 'Booking rate should be between 0-100%', 'range', 'RANGE:booking_rate:0:100', 0, 'error', 'Booking rate must be between 0% and 100%.', 'booking_rate', true],
    ['schedule_efficiency_range', 'Schedule Efficiency Range', 'Schedule efficiency typically 0-150%', 'range', 'RANGE:schedule_efficiency:0:150', 0, 'warning', 'Schedule efficiency over 100% means overtime. Over 150% is unusual.', 'schedule_efficiency', true],
    ['avg_ticket_match', 'Average Ticket Match', 'Reported vs calculated average ticket', 'reconciliation', 'EQUALS:average_ticket:calculated_avg_ticket', 0.15, 'info', 'Your reported average ticket differs from calculated. Using calculated value.', 'average_ticket,calculated_avg_ticket', true],
    ['has_leads_for_visits', 'Leads Required for Visits', 'Can\'t have visits without leads', 'dependency', 'REQUIRES:in_home_visits:total_leads', 0, 'error', 'You reported in-home visits but no leads. Where did these visits come from?', 'in_home_visits,total_leads', true],
    ['has_visits_for_jobs', 'Visits Required for Jobs', 'Can\'t close jobs without visits (usually)', 'dependency', 'REQUIRES:jobs_closed:in_home_visits', 0, 'warning', 'You reported closed jobs but no in-home visits. Is this phone sales only?', 'jobs_closed,in_home_visits', true]
  ];

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, sampleData.length, headers.length).setValues(sampleData);

  // Format header row
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff');

  // Auto-resize columns
  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }

  sheet.setFrozenRows(1);

  log('Initialized Config_Validations sheet with sample data');
}

/**
 * Create default Config_Sections sheet with sample data
 */
function initializeSectionConfig() {
  const sheet = getOrCreateSheet(SHEET_NAMES.CONFIG_SECTIONS);

  const headers = ['section_id', 'section_name', 'section_description', 'pillar_id', 'pillar_name'];

  const sampleData = [
    [1, 'Marketing', 'Lead generation, advertising, brand awareness', 1, 'Operational Visibility'],
    [2, 'CSR/Call Center', 'Call handling, booking, customer intake', 1, 'Operational Visibility'],
    [3, 'Sales', 'In-home visits, proposals, closing', 1, 'Operational Visibility'],
    [4, 'Field Operations', 'Technicians, installs, service delivery', 2, 'Operational Standardization'],
    [5, 'Scheduling/Dispatch', 'Job assignment, routing, capacity management', 2, 'Operational Standardization'],
    [6, 'Inventory/Warehouse', 'Parts, materials, truck stock', 2, 'Operational Standardization'],
    [7, 'Finance/Accounting', 'Cash flow, invoicing, collections, reporting', 1, 'Operational Visibility'],
    [8, 'HR/Training', 'Hiring, onboarding, skill development', 3, 'Capacity & Growth Readiness'],
    [9, 'Management', 'Oversight, strategy, decision-making', 3, 'Capacity & Growth Readiness']
  ];

  // Clear sheet and delete extra rows to prevent empty rows
  sheet.clear();

  // Set headers and data
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, sampleData.length, headers.length).setValues(sampleData);

  // Delete extra rows beyond data to keep sheet clean
  const lastDataRow = sampleData.length + 1; // +1 for header
  const maxRows = sheet.getMaxRows();
  if (maxRows > lastDataRow) {
    sheet.deleteRows(lastDataRow + 1, maxRows - lastDataRow);
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

  log('Initialized Config_Sections sheet with sample data');
}

/**
 * Create default Config_Benchmarks sheet (with state/province and direction support)
 */
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

    // Industry-specific examples (higher is better)
    ['close_rate', 'hvac', 'all', 25, 40, 55, 70, 'higher', 'HVAC typically has higher close rates'],
    ['close_rate', 'roofing', 'all', 30, 45, 60, 75, 'higher', 'Roofing urgency drives higher closes'],
    ['booking_rate', 'hvac', 'all', 35, 55, 75, 90, 'higher', 'HVAC typically has higher booking rates'],
    ['profit_margin', 'plumbing', 'all', 8, 15, 22, 32, 'higher', 'Plumbing service calls tend to have higher margins'],

    // State-specific examples
    ['profit_margin', 'all', 'california', 8, 15, 23, 33, 'higher', 'Higher COL requires higher margins'],
    ['profit_margin', 'all', 'ontario', 7, 14, 21, 30, 'higher', 'Ontario market benchmarks']
  ];

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, sampleData.length, headers.length).setValues(sampleData);

  // Delete extra rows to keep sheet clean
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

  // Add note about direction column
  sheet.getRange(sampleData.length + 3, 1).setValue(
    'Note: direction="higher" means higher values are better (close_rate). ' +
    'direction="lower" means lower values are better (rework_rate, cost_per_lead). ' +
    'Priority matching: industry+state > industry+all > all+state > all+all'
  );

  log('Initialized Config_Benchmarks sheet with direction support');
}

/**
 * Create default Config_Insights sheet with sample insight rules
 */
function initializeInsightConfig() {
  const sheet = getOrCreateSheet(SHEET_NAMES.CONFIG_INSIGHTS);

  const headers = [
    'insight_id', 'insight_type', 'kpi_ids', 'trigger_logic', 'title', 'status',
    'summary_template', 'detail_template', 'recommendations', 'section_id',
    'affected_sections', 'form_tier', 'priority', 'active'
  ];

  const sampleData = [
    // Single-KPI insights - Booking Performance
    ['booking_good', 'single', 'booking_rate', 'good+', 'Booking Performance', 'good',
      'Your booking rate of {value_formatted} is above average.',
      'Good performance converting leads to appointments.',
      'Document what\'s working for your CSR team|Consider if you can scale lead volume',
      2, '', 'onboarding', 10, true],

    ['booking_average', 'single', 'booking_rate', 'average', 'Booking Performance', 'warning',
      'Your booking rate of {value_formatted} is average.',
      'There\'s room to improve toward the {benchmark_good}% benchmark.',
      'Focus on CSR training to improve conversion|Review call handling for improvement opportunities',
      2, '', 'onboarding', 10, true],

    ['booking_poor', 'single', 'booking_rate', 'poor-', 'Booking Performance', 'concern',
      'Your booking rate of {value_formatted} is below industry average.',
      'For every 100 leads, only {value_rounded} become appointments. Industry average is around {benchmark_average}%.',
      'Review CSR call scripts and training|Analyze why leads aren\'t converting|Consider call monitoring or coaching|Check if leads are being followed up promptly',
      2, '1', 'onboarding', 5, true],

    // Single-KPI insights - Close Rate
    ['close_good', 'single', 'close_rate', 'good+', 'Sales Performance', 'good',
      'Your close rate of {value_formatted} is strong.',
      'You\'re converting appointments to sales above average.',
      'Maintain current sales process|Document best practices',
      3, '', 'onboarding', 10, true],

    ['close_average', 'single', 'close_rate', 'average', 'Sales Performance', 'warning',
      'Your close rate of {value_formatted} is average.',
      'Room to improve from {value_rounded}% toward {benchmark_good}%.',
      'Identify what top performers do differently|Review proposal/quote process',
      3, '', 'onboarding', 10, true],

    ['close_poor', 'single', 'close_rate', 'poor-', 'Sales Performance', 'concern',
      'Your close rate of {value_formatted} needs improvement.',
      'Close rate of {value_rounded}% is below industry average of {benchmark_average}%.',
      'Review sales process and presentation|Analyze lost opportunities|Consider sales training|Evaluate pricing competitiveness',
      3, '', 'onboarding', 5, true],

    // Single-KPI insights - Profitability
    ['profit_good', 'single', 'profit_margin', 'good+', 'Profitability', 'good',
      'Healthy profit margin of {value_formatted}.',
      'Strong profitability - maintaining good balance between revenue and costs.',
      '',
      7, '', 'onboarding', 10, true],

    ['profit_average', 'single', 'profit_margin', 'average', 'Profitability', 'warning',
      'Profit margin of {value_formatted} is acceptable but could improve.',
      'Net profit is acceptable but there\'s room for improvement.',
      'Look for cost reduction opportunities|Consider premium service offerings',
      7, '3', 'onboarding', 10, true],

    ['profit_poor', 'single', 'profit_margin', 'poor-', 'Profitability', 'concern',
      'Profit margin of {value_formatted} is below healthy levels.',
      'Profitability needs attention - you\'re keeping less than industry average.',
      'Review pricing - are you undercharging?|Analyze job costs for inefficiencies|Focus on higher-margin services',
      7, '3', 'onboarding', 5, true],

    // Composite insights - Funnel Analysis
    ['funnel_leak', 'composite', 'booking_rate,close_rate', 'booking_rate:good+ AND close_rate:poor-', 'Sales Funnel Leak', 'concern',
      'Marketing is generating leads, but sales isn\'t converting them.',
      'Booking rate of {booking_rate_formatted} is strong, but close rate of {close_rate_formatted} is below average.',
      'Focus on sales process, not lead generation|Review why appointments aren\'t closing|Consider sales training',
      3, '1,2', 'onboarding', 3, true],

    ['funnel_healthy', 'composite', 'booking_rate,close_rate', 'booking_rate:good+ AND close_rate:good+', 'Sales Funnel', 'good',
      'Healthy sales funnel with strong booking and close rates.',
      'Both booking rate ({booking_rate_formatted}) and close rate ({close_rate_formatted}) are performing well.',
      'Maintain current processes|Consider scaling lead volume',
      3, '1,2', 'onboarding', 15, true]
  ];

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, sampleData.length, headers.length).setValues(sampleData);

  // Delete extra rows to keep sheet clean
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

  // Add explanatory notes
  const noteRow = sampleData.length + 3;
  sheet.getRange(noteRow, 1).setValue(
    'Trigger Logic Reference:'
  ).setFontWeight('bold');
  sheet.getRange(noteRow + 1, 1).setValue(
    'Single: poor-, poor, average, good, good+, excellent, any | Composite: kpi_id:condition AND kpi_id:condition'
  );
  sheet.getRange(noteRow + 2, 1).setValue(
    'Status: good (green), warning (orange), concern (red) | Placeholders: {value}, {value_formatted}, {benchmark_good}, {kpi_id}'
  );

  log('Initialized Config_Insights sheet with sample insight rules');
}

/**
 * Initialize _Settings sheet with defaults
 */
function initializeSettings() {
  const sheet = getOrCreateSheet(SHEET_NAMES.SETTINGS);
  sheet.clearContents();

  const settings = [
    [SETTINGS_KEYS.ACTIVE_CLIENT_ID, ''],
    [SETTINGS_KEYS.FORM_ID, ''],
    [SETTINGS_KEYS.FORM_URL, ''],
    [SETTINGS_KEYS.FORM_RESPONSE_URL, ''],
    [SETTINGS_KEYS.FORM_RESPONSES_SHEET, ''],
    [SETTINGS_KEYS.LAST_FORM_SYNC, ''],
    [SETTINGS_KEYS.AUTO_ANALYZE, true],
    [SETTINGS_KEYS.VERSION, '1.0'],
    [SETTINGS_KEYS.NOTIFICATION_EMAIL, 'info@shopfloorsolutions.ca']
  ];

  sheet.getRange(1, 1, settings.length, 2).setValues(settings);

  log('Initialized _Settings sheet with defaults');
}

// ============================================================================
// SCHEMA MIGRATION
// ============================================================================

/**
 * Migrate Config_Benchmarks sheet to add 'direction' column if missing
 * Existing rows get 'higher' as the default direction
 * @returns {Object} {migrated: boolean, rowsUpdated: number, message: string}
 */
function migrateBenchmarksAddDirection() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.CONFIG_BENCHMARKS);

    if (!sheet) {
      return {
        migrated: false,
        rowsUpdated: 0,
        message: 'Config_Benchmarks sheet not found - no migration needed'
      };
    }

    // Get headers
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) {
      return {
        migrated: false,
        rowsUpdated: 0,
        message: 'Config_Benchmarks sheet is empty - no migration needed'
      };
    }

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const headersLower = headers.map(h => String(h).toLowerCase().trim());

    // Check if 'direction' column already exists
    const directionIndex = headersLower.indexOf('direction');
    if (directionIndex >= 0) {
      return {
        migrated: false,
        rowsUpdated: 0,
        message: 'direction column already exists - no migration needed'
      };
    }

    // Find where to insert 'direction' (before 'notes' if exists, otherwise at end)
    const notesIndex = headersLower.indexOf('notes');
    let insertCol;

    if (notesIndex >= 0) {
      // Insert before 'notes'
      insertCol = notesIndex + 1;  // 1-based column
      sheet.insertColumnBefore(insertCol);
    } else {
      // Insert at end
      insertCol = lastCol + 1;
    }

    // Add header
    sheet.getRange(1, insertCol).setValue('direction');

    // Format header to match other headers
    sheet.getRange(1, insertCol)
      .setFontWeight('bold')
      .setBackground('#4285f4')
      .setFontColor('#ffffff');

    // Fill in 'higher' for all existing data rows
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const directionValues = [];
      for (let i = 2; i <= lastRow; i++) {
        directionValues.push(['higher']);
      }
      sheet.getRange(2, insertCol, lastRow - 1, 1).setValues(directionValues);
    }

    // Auto-resize the new column
    sheet.autoResizeColumn(insertCol);

    log(`Migrated Config_Benchmarks: added direction column with ${lastRow - 1} rows set to 'higher'`);

    return {
      migrated: true,
      rowsUpdated: lastRow - 1,
      message: `Added direction column. ${lastRow - 1} existing rows set to 'higher' (default).`
    };

  } catch (error) {
    logError('Error migrating Config_Benchmarks', error);
    return {
      migrated: false,
      rowsUpdated: 0,
      message: `Migration error: ${error.message}`
    };
  }
}

/**
 * Menu handler for benchmark migration with confirmation
 */
function migrateBenchmarksWithConfirmation() {
  const ui = SpreadsheetApp.getUi();

  const result = ui.alert(
    'Migrate Benchmarks Schema',
    'This will add a "direction" column to Config_Benchmarks if it doesn\'t exist.\n\n' +
    'Existing benchmarks will default to "higher" (higher values are better).\n' +
    'You can then edit specific KPIs to "lower" for metrics like rework_rate, cost_per_lead.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );

  if (result === ui.Button.YES) {
    const migrationResult = migrateBenchmarksAddDirection();
    ui.alert('Migration Complete', migrationResult.message, ui.ButtonSet.OK);
  }
}
