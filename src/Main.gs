/**
 * Main.gs
 * Entry points, menu creation, high-level orchestration
 *
 * ShopFloor Solutions - Operational KPI Calculator
 */

// ============================================================================
// MENU CREATION
// ============================================================================

/**
 * onOpen trigger - Creates custom menu
 * Called automatically when spreadsheet opens
 */
function onOpen() {
  createMenu();
}

/**
 * Creates the ShopFloor Tools menu
 */
function createMenu() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('ShopFloor Tools')
    .addItem('Select Client...', 'showClientSelector')
    .addItem('Run Analysis', 'runAnalysis')
    .addSeparator()
    .addItem('View Validation Dashboard', 'showValidationSidebar')
    .addSeparator()
    .addSubMenu(ui.createMenu('Form Management')
      .addItem('Get Form URL', 'showFormUrl')
      .addItem('Sync Form with Config', 'syncFormWithConfig')
      .addItem('Recreate Form', 'createClientIntakeForm'))
    .addSeparator()
    .addSubMenu(ui.createMenu('Configuration')
      .addItem('Edit KPIs...', 'showKPIEditor')
      .addItem('Edit Benchmarks...', 'showBenchmarkEditor')
      .addItem('Edit Validation Rules...', 'showValidationEditor')
      .addItem('Edit Sections...', 'showSectionEditor')
      .addSeparator()
      .addItem('Export Configuration...', 'showExportConfig'))
    .addSeparator()
    .addSubMenu(ui.createMenu('Administration')
      .addItem('Validate Configuration', 'validateAndShowConfig')
      .addItem('View Settings', 'showSettings')
      .addSeparator()
      .addItem('Initialize System', 'initializeSystem')
      .addItem('Reset System...', 'resetSystem'))
    .addSeparator()
    .addSubMenu(ui.createMenu('Help')
      .addItem('Quick Start Guide', 'showHelp')
      .addItem('About', 'showAbout'))
    .addToUi();

  log('Menu created');
}

// ============================================================================
// MAIN ANALYSIS ORCHESTRATION
// ============================================================================

/**
 * Main entry point for running analysis on active client
 * Orchestrates: load config → get client data → calculate KPIs → validate → generate results
 */
function runAnalysis() {
  const startTime = new Date();

  try {
    showToast('Starting analysis...', 'KPI Calculator', 3);

    // 1. Get active client
    const clientId = getActiveClientId();
    if (!clientId) {
      showAlert('No client selected. Please select a client first using "Select Client..." from the menu.');
      return;
    }

    // 2. Load configuration
    const kpiConfig = loadKPIConfig();
    const validationConfig = loadValidationConfig();
    const sectionConfig = loadSectionConfig();

    if (kpiConfig.length === 0) {
      showAlert('No KPIs configured. Please check the Config_KPIs sheet.');
      return;
    }

    // 3. Get client data
    const clientData = getClientData(clientId);
    if (!clientData) {
      showAlert(`Client "${clientId}" not found. Please select a valid client.`);
      return;
    }

    showToast('Calculating KPIs...', 'KPI Calculator', 2);

    // 4. Calculate all KPIs
    const calculatedValues = calculateAllKPIs(clientData, kpiConfig);

    // 5. Merge raw inputs with calculated values
    const allValues = merge(clientData.rawInputs, calculatedValues);

    showToast('Validating data...', 'KPI Calculator', 2);

    // 6. Run validations
    const validationResult = validateAll(allValues, validationConfig, kpiConfig);

    showToast('Generating insights...', 'KPI Calculator', 2);

    // 7. Generate insights
    const insights = generateInsights(
      clientData,
      allValues,
      validationResult.issues,
      kpiConfig,
      sectionConfig
    );

    showToast('Writing results...', 'KPI Calculator', 2);

    // 8. Generate results sheet
    generateResults(clientId, clientData, allValues, validationResult, insights, kpiConfig, sectionConfig);

    // 9. Update client analysis status
    updateClientAnalysisStatus(clientId, ANALYSIS_STATUS.COMPLETED);

    // 10. Calculate elapsed time
    const elapsed = ((new Date() - startTime) / 1000).toFixed(1);

    showToast(
      `Analysis complete for ${clientData.companyName} (${elapsed}s)`,
      'KPI Calculator',
      5
    );

    log(`Analysis completed for client ${clientId} in ${elapsed}s`);

  } catch (error) {
    logError('Error in runAnalysis', error);
    showAlert(`Analysis failed: ${error.message}`);

    // Try to update client status to error
    try {
      const clientId = getActiveClientId();
      if (clientId) {
        updateClientAnalysisStatus(clientId, ANALYSIS_STATUS.ERROR);
      }
    } catch (e) {
      // Ignore
    }
  }
}

/**
 * Run analysis for a specific client (called from form submission)
 * @param {string} clientId - Client ID to analyze
 */
function runAnalysisForClient(clientId) {
  try {
    setActiveClient(clientId);
    runAnalysis();
  } catch (error) {
    logError('Error in runAnalysisForClient', error);
  }
}

// ============================================================================
// SYSTEM INITIALIZATION
// ============================================================================

/**
 * Initialize the system - create all sheets, set defaults
 * Should be run once on first setup
 */
function initializeSystem() {
  try {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
      'Initialize System',
      'This will create all required sheets and configuration. ' +
      'Existing configuration sheets will NOT be overwritten. Continue?',
      ui.ButtonSet.YES_NO
    );

    if (response !== ui.Button.YES) {
      showToast('Initialization cancelled', 'KPI Calculator', 3);
      return;
    }

    showToast('Initializing system...', 'KPI Calculator', 5);

    // Initialize configuration sheets (only if they don't exist or are empty)
    initializeConfigSheets();

    // Initialize data sheets
    initializeDataSheets();

    // Initialize settings
    if (!sheetExists(SHEET_NAMES.SETTINGS) || !getSetting(SETTINGS_KEYS.VERSION)) {
      initializeSettings();
    }

    // Validate configuration
    const validation = validateConfig();

    if (validation.errors.length > 0) {
      showAlert(
        'System initialized with errors:\n\n' +
        validation.errors.join('\n') +
        '\n\nPlease fix these issues in the configuration sheets.'
      );
    } else if (validation.warnings.length > 0) {
      showAlert(
        'System initialized with warnings:\n\n' +
        validation.warnings.join('\n') +
        '\n\nThese are not critical but should be reviewed.'
      );
    } else {
      showAlert('System initialized successfully!\n\nNext steps:\n1. Review configuration sheets\n2. Create intake form (Form Management → Recreate Form)\n3. Share form with clients');
    }

    // Recreate menu
    createMenu();

    log('System initialization completed');

  } catch (error) {
    logError('Error in initializeSystem', error);
    showAlert(`Initialization failed: ${error.message}`);
  }
}

/**
 * Initialize configuration sheets if they don't exist or are empty
 */
function initializeConfigSheets() {
  // Config_KPIs
  if (!sheetExists(SHEET_NAMES.CONFIG_KPIS) || isSheetEmpty(SHEET_NAMES.CONFIG_KPIS)) {
    initializeKPIConfig();
  } else {
    log('Config_KPIs sheet already exists with data - skipping');
  }

  // Config_Validations
  if (!sheetExists(SHEET_NAMES.CONFIG_VALIDATIONS) || isSheetEmpty(SHEET_NAMES.CONFIG_VALIDATIONS)) {
    initializeValidationConfig();
  } else {
    log('Config_Validations sheet already exists with data - skipping');
  }

  // Config_Sections
  if (!sheetExists(SHEET_NAMES.CONFIG_SECTIONS) || isSheetEmpty(SHEET_NAMES.CONFIG_SECTIONS)) {
    initializeSectionConfig();
  } else {
    log('Config_Sections sheet already exists with data - skipping');
  }

  // Config_Benchmarks
  if (!sheetExists(SHEET_NAMES.CONFIG_BENCHMARKS) || isSheetEmpty(SHEET_NAMES.CONFIG_BENCHMARKS)) {
    initializeBenchmarkConfig();
  } else {
    log('Config_Benchmarks sheet already exists with data - skipping');
  }
}

/**
 * Initialize data sheets (Clients, Results, Validation_Log)
 */
function initializeDataSheets() {
  // Clients sheet
  initializeClientsSheet();

  // Results sheet
  const resultsSheet = getOrCreateSheet(SHEET_NAMES.RESULTS);
  resultsSheet.clearContents();
  resultsSheet.getRange('A1').setValue('Run analysis to see results here');

  // Validation_Log sheet
  const validationSheet = getOrCreateSheet(SHEET_NAMES.VALIDATION_LOG);
  validationSheet.clearContents();
  const validationHeaders = [
    'Severity', 'Rule Name', 'Message', 'Expected', 'Actual',
    'Variance', 'Affected KPIs', 'Affected Sections', 'Suggested Action'
  ];
  validationSheet.getRange(1, 1, 1, validationHeaders.length).setValues([validationHeaders]);
  validationSheet.getRange(1, 1, 1, validationHeaders.length)
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff');
}

/**
 * Initialize Clients sheet with proper headers
 */
function initializeClientsSheet() {
  const sheet = getOrCreateSheet(SHEET_NAMES.CLIENTS);

  // Get input KPIs for dynamic columns
  let inputKPIs = [];
  try {
    inputKPIs = getInputKPIs();
  } catch (e) {
    // Config not ready yet, use minimal headers
    log('Could not load KPI config for Clients sheet - using minimal headers');
  }

  // Base headers
  const baseHeaders = [
    'client_id', 'timestamp', 'company_name', 'contact_email',
    'industry', 'state', 'data_period', 'period_days'
  ];

  // KPI columns
  const kpiHeaders = inputKPIs.map(kpi => kpi.id);

  // Status columns
  const statusHeaders = ['analysis_status', 'last_analyzed', 'notes'];

  // Combine all headers
  const allHeaders = [...baseHeaders, ...kpiHeaders, ...statusHeaders];

  // Only write headers if sheet is empty
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, allHeaders.length).setValues([allHeaders]);
    sheet.getRange(1, 1, 1, allHeaders.length)
      .setFontWeight('bold')
      .setBackground('#4285f4')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }

  log('Clients sheet initialized');
}

/**
 * Check if a sheet is empty (no data rows)
 * @param {string} sheetName
 * @returns {boolean}
 */
function isSheetEmpty(sheetName) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) return true;
    return sheet.getLastRow() <= 1; // Only header or nothing
  } catch (e) {
    return true;
  }
}

// ============================================================================
// SYSTEM RESET
// ============================================================================

/**
 * Reset system - clear all client data, keep config
 * Confirmation required
 */
function resetSystem() {
  const ui = SpreadsheetApp.getUi();

  const response = ui.alert(
    'Reset System',
    'WARNING: This will delete ALL client data and analysis results.\n\n' +
    'Configuration sheets will be preserved.\n\n' +
    'This action cannot be undone. Are you sure?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    showToast('Reset cancelled', 'KPI Calculator', 3);
    return;
  }

  // Second confirmation
  const response2 = ui.alert(
    'Confirm Reset',
    'Are you absolutely sure you want to delete all client data?',
    ui.ButtonSet.YES_NO
  );

  if (response2 !== ui.Button.YES) {
    showToast('Reset cancelled', 'KPI Calculator', 3);
    return;
  }

  try {
    // Clear Clients sheet (keep headers)
    const clientsSheet = getRequiredSheet(SHEET_NAMES.CLIENTS);
    if (clientsSheet.getLastRow() > 1) {
      clientsSheet.deleteRows(2, clientsSheet.getLastRow() - 1);
    }

    // Clear Results sheet
    const resultsSheet = getRequiredSheet(SHEET_NAMES.RESULTS);
    resultsSheet.clearContents();
    resultsSheet.getRange('A1').setValue('Run analysis to see results here');

    // Clear Validation_Log (keep headers)
    const validationSheet = getRequiredSheet(SHEET_NAMES.VALIDATION_LOG);
    if (validationSheet.getLastRow() > 1) {
      validationSheet.deleteRows(2, validationSheet.getLastRow() - 1);
    }

    // Reset active client setting
    setSetting(SETTINGS_KEYS.ACTIVE_CLIENT_ID, '');

    showAlert('System reset complete. All client data has been deleted.');
    log('System reset completed');

  } catch (error) {
    logError('Error in resetSystem', error);
    showAlert(`Reset failed: ${error.message}`);
  }
}

// ============================================================================
// CONFIGURATION VALIDATION
// ============================================================================

/**
 * Validate configuration and show results to user
 */
function validateAndShowConfig() {
  try {
    const result = validateConfig();

    let message = 'Configuration Validation Results\n';
    message += '================================\n\n';

    if (result.valid && result.warnings.length === 0) {
      message += '✓ All checks passed!\n\n';
      message += 'Your configuration is valid and ready to use.';
    } else {
      if (result.errors.length > 0) {
        message += '✗ ERRORS (must fix):\n';
        result.errors.forEach(e => message += `  • ${e}\n`);
        message += '\n';
      }

      if (result.warnings.length > 0) {
        message += '⚠ WARNINGS (should review):\n';
        result.warnings.forEach(w => message += `  • ${w}\n`);
      }
    }

    showAlert(message);

  } catch (error) {
    logError('Error validating config', error);
    showAlert(`Validation failed: ${error.message}`);
  }
}

// ============================================================================
// QUICK ACTIONS
// ============================================================================

/**
 * Quick action: Analyze most recent client
 */
function analyzeLatestClient() {
  try {
    const clients = getClientList();

    if (clients.length === 0) {
      showAlert('No clients found. Please submit data via the intake form first.');
      return;
    }

    // Sort by timestamp descending
    clients.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const latestClient = clients[0];
    setActiveClient(latestClient.id);
    runAnalysis();

  } catch (error) {
    logError('Error in analyzeLatestClient', error);
    showAlert(`Error: ${error.message}`);
  }
}

/**
 * Get system status summary
 * @returns {Object} Status summary
 */
function getSystemStatus() {
  try {
    const status = {
      initialized: false,
      configValid: false,
      formLinked: false,
      clientCount: 0,
      activeClient: null,
      version: getSetting(SETTINGS_KEYS.VERSION) || 'Unknown'
    };

    // Check initialization
    status.initialized = sheetExists(SHEET_NAMES.CONFIG_KPIS) &&
                         sheetExists(SHEET_NAMES.CLIENTS) &&
                         sheetExists(SHEET_NAMES.SETTINGS);

    // Check config validity
    if (status.initialized) {
      const validation = validateConfig();
      status.configValid = validation.valid;
    }

    // Check form
    status.formLinked = !!getSetting(SETTINGS_KEYS.FORM_ID);

    // Count clients
    try {
      status.clientCount = getClientList().length;
    } catch (e) {
      status.clientCount = 0;
    }

    // Active client
    const activeId = getActiveClientId();
    if (activeId) {
      try {
        const client = getClientById(activeId);
        if (client) {
          status.activeClient = {
            id: activeId,
            name: client.companyName
          };
        }
      } catch (e) {
        // Ignore
      }
    }

    return status;

  } catch (error) {
    logError('Error getting system status', error);
    return {
      initialized: false,
      configValid: false,
      formLinked: false,
      clientCount: 0,
      activeClient: null,
      version: 'Error',
      error: error.message
    };
  }
}
