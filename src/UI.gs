/**
 * UI.gs
 * Sidebar, dialogs, and user interaction
 *
 * ShopFloor Solutions - Operational KPI Calculator
 */

// ============================================================================
// SIDEBAR
// ============================================================================

/**
 * Show the validation dashboard sidebar
 */
function showValidationSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('Validation Dashboard')
    .setWidth(300);

  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Get data for sidebar display
 * Called from Sidebar.html
 * @returns {Object} {status, issues, client, lastAnalyzed, hasClient}
 */
function getSidebarData() {
  try {
    const clientId = getActiveClientId();

    if (!clientId) {
      return {
        hasClient: false,
        status: 'No client selected',
        issues: [],
        client: null,
        lastAnalyzed: null
      };
    }

    const client = getClientData(clientId);

    if (!client) {
      return {
        hasClient: false,
        status: 'Client not found',
        issues: [],
        client: null,
        lastAnalyzed: null
      };
    }

    // Get validation issues from Validation_Log sheet
    const issues = getValidationIssuesFromSheet();

    // Determine overall status
    const errorCount = issues.filter(i => i.severity === 'ERROR').length;
    const warningCount = issues.filter(i => i.severity === 'WARNING').length;

    let status = 'VALID';
    if (errorCount > 0) {
      status = 'ERRORS';
    } else if (warningCount > 0) {
      status = 'WARNINGS';
    }

    return {
      hasClient: true,
      status: status,
      errorCount: errorCount,
      warningCount: warningCount,
      issues: issues.slice(0, 10), // Limit to first 10
      client: {
        name: client.companyName,
        industry: client.industry,
        submittedAt: formatDate(client.submittedAt)
      },
      lastAnalyzed: client.lastAnalyzed ? formatDate(client.lastAnalyzed) : 'Never'
    };

  } catch (error) {
    logError('Error getting sidebar data', error);
    return {
      hasClient: false,
      status: 'Error loading data',
      issues: [],
      client: null,
      lastAnalyzed: null,
      error: error.message
    };
  }
}

/**
 * Get validation issues from Validation_Log sheet
 * @returns {Object[]}
 */
function getValidationIssuesFromSheet() {
  try {
    const sheet = getRequiredSheet(SHEET_NAMES.VALIDATION_LOG);
    const data = sheetToObjects(sheet);

    return data.map(row => ({
      severity: row.severity || 'INFO',
      ruleName: row['rule name'] || row.rule_name || '',
      message: row.message || '',
      sections: row['affected sections'] || row.affected_sections || ''
    })).filter(issue => issue.message && !issue.message.includes('No validation'));

  } catch (e) {
    return [];
  }
}

// ============================================================================
// CLIENT SELECTOR DIALOG
// ============================================================================

/**
 * Show the client selector dialog
 */
function showClientSelector() {
  const html = HtmlService.createHtmlOutputFromFile('ClientSelector')
    .setWidth(500)
    .setHeight(400);

  SpreadsheetApp.getUi().showModalDialog(html, 'Select Client');
}

/**
 * Get data for client selector dialog
 * Called from ClientSelector.html
 * @returns {Object} {clients, activeClientId}
 */
function getClientSelectorData() {
  try {
    const clients = getClientList();
    const activeClientId = getActiveClientId();

    // Sort by timestamp descending
    clients.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Format for display
    const formattedClients = clients.map(c => ({
      id: c.id,
      name: c.name,
      industry: c.industry,
      timestamp: formatDate(c.timestamp),
      status: c.status,
      display: `${c.name} (${formatDate(c.timestamp)}) - ${c.industry}`
    }));

    return {
      clients: formattedClients,
      activeClientId: activeClientId
    };

  } catch (error) {
    logError('Error getting client selector data', error);
    return {
      clients: [],
      activeClientId: null,
      error: error.message
    };
  }
}

/**
 * Handle client selection from dialog
 * Called from ClientSelector.html
 * @param {string} clientId
 * @param {boolean} shouldRunAnalysis - Whether to run analysis after selection
 */
function handleClientSelection(clientId, shouldRunAnalysis) {
  try {
    setActiveClient(clientId);

    if (shouldRunAnalysis) {
      runAnalysis();
    }

    return { success: true };

  } catch (error) {
    logError('Error handling client selection', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle client selection and run analysis
 * Called from ClientSelector.html
 * @param {string} clientId
 */
function selectClientAndAnalyze(clientId) {
  try {
    setActiveClient(clientId);
    runAnalysis();
    return { success: true };
  } catch (error) {
    logError('Error in selectClientAndAnalyze', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// SETTINGS DIALOG
// ============================================================================

/**
 * Show system settings dialog
 */
function showSettings() {
  const settings = getAllSettings();
  const status = getSystemStatus();

  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      h3 { margin-top: 0; color: #1a237e; }
      table { width: 100%; border-collapse: collapse; margin-top: 15px; }
      td { padding: 8px; border-bottom: 1px solid #eee; }
      td:first-child { font-weight: bold; color: #666; width: 40%; }
      .status { padding: 3px 8px; border-radius: 3px; font-size: 12px; }
      .status.good { background: #e8f5e9; color: #2e7d32; }
      .status.bad { background: #ffebee; color: #c62828; }
      .section { margin-top: 20px; }
      .section-title { font-weight: bold; color: #1a237e; border-bottom: 2px solid #1a237e; padding-bottom: 5px; }
    </style>

    <h3>System Settings</h3>

    <div class="section">
      <div class="section-title">Status</div>
      <table>
        <tr>
          <td>Initialized</td>
          <td><span class="status ${status.initialized ? 'good' : 'bad'}">${status.initialized ? 'Yes' : 'No'}</span></td>
        </tr>
        <tr>
          <td>Config Valid</td>
          <td><span class="status ${status.configValid ? 'good' : 'bad'}">${status.configValid ? 'Yes' : 'No'}</span></td>
        </tr>
        <tr>
          <td>Form Linked</td>
          <td><span class="status ${status.formLinked ? 'good' : 'bad'}">${status.formLinked ? 'Yes' : 'No'}</span></td>
        </tr>
        <tr>
          <td>Total Clients</td>
          <td>${status.clientCount}</td>
        </tr>
        <tr>
          <td>Active Client</td>
          <td>${status.activeClient ? status.activeClient.name : 'None'}</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <div class="section-title">Configuration</div>
      <table>
        <tr>
          <td>Version</td>
          <td>${settings[SETTINGS_KEYS.VERSION] || '1.0'}</td>
        </tr>
        <tr>
          <td>Auto-Analyze</td>
          <td>${settings[SETTINGS_KEYS.AUTO_ANALYZE] ? 'Enabled' : 'Disabled'}</td>
        </tr>
        <tr>
          <td>Notification Email</td>
          <td>${settings[SETTINGS_KEYS.NOTIFICATION_EMAIL] || 'Not set'}</td>
        </tr>
        <tr>
          <td>Last Form Sync</td>
          <td>${settings[SETTINGS_KEYS.LAST_FORM_SYNC] ? formatDate(settings[SETTINGS_KEYS.LAST_FORM_SYNC]) : 'Never'}</td>
        </tr>
      </table>
    </div>

    <div style="margin-top: 20px; text-align: right;">
      <button onclick="google.script.host.close()" style="padding: 8px 16px;">Close</button>
    </div>
  `)
    .setWidth(450)
    .setHeight(450);

  SpreadsheetApp.getUi().showModalDialog(html, 'System Settings');
}

// ============================================================================
// ANALYSIS HANDLERS
// ============================================================================

/**
 * Handle "Run Analysis" button from sidebar
 * Called from Sidebar.html
 */
function handleRunAnalysis() {
  try {
    runAnalysis();
    return { success: true };
  } catch (error) {
    logError('Error in handleRunAnalysis', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle "Refresh" button from sidebar
 * Called from Sidebar.html
 */
function handleRefresh() {
  return getSidebarData();
}

// ============================================================================
// DELETE CLIENT CONFIRMATION
// ============================================================================

/**
 * Show delete client confirmation dialog
 * @param {string} clientId
 */
function confirmDeleteClient(clientId) {
  const client = getClientById(clientId);

  if (!client) {
    showAlert('Client not found.');
    return;
  }

  const proceed = showYesNoConfirmation(
    'Delete Client',
    `Are you sure you want to delete "${client.company_name}"?\n\n` +
    'This action cannot be undone.'
  );

  if (proceed) {
    deleteClient(clientId);
    showToast('Client deleted', 'Client Manager', 3);
  }
}

// ============================================================================
// UTILITY DIALOGS
// ============================================================================

/**
 * Show about dialog
 */
function showAbout() {
  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
      h2 { color: #1a237e; margin-bottom: 5px; }
      .version { color: #666; font-size: 14px; }
      .description { margin: 20px 0; color: #333; }
      .footer { margin-top: 20px; font-size: 12px; color: #999; }
    </style>

    <h2>Operational KPI Calculator</h2>
    <div class="version">Version 1.0</div>

    <div class="description">
      <p>Internal diagnostic tool for ShopFloor Solutions to analyze trade business operational data.</p>
      <p>Calculates derived KPIs, validates data consistency, and generates actionable insights.</p>
    </div>

    <div class="footer">
      <p>ShopFloor Solutions</p>
      <p>info@shopfloorsolutions.ca</p>
    </div>

    <button onclick="google.script.host.close()" style="margin-top: 20px; padding: 8px 20px;">Close</button>
  `)
    .setWidth(400)
    .setHeight(300);

  SpreadsheetApp.getUi().showModalDialog(html, 'About');
}

/**
 * Show help dialog
 */
function showHelp() {
  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      h3 { color: #1a237e; margin-top: 0; }
      h4 { color: #3f51b5; margin-top: 20px; margin-bottom: 10px; }
      ul { padding-left: 20px; }
      li { margin-bottom: 8px; }
      .step { background: #f5f5f5; padding: 10px; border-radius: 4px; margin: 10px 0; }
    </style>

    <h3>Quick Start Guide</h3>

    <h4>1. Initialize System</h4>
    <div class="step">
      Go to <strong>ShopFloor Tools → Administration → Initialize System</strong><br>
      This creates all required sheets and sample configurations.
    </div>

    <h4>2. Create Intake Form</h4>
    <div class="step">
      Go to <strong>ShopFloor Tools → Form Management → Recreate Form</strong><br>
      Share the form URL with clients.
    </div>

    <h4>3. Analyze Client Data</h4>
    <div class="step">
      <ol>
        <li>Select a client: <strong>ShopFloor Tools → Select Client...</strong></li>
        <li>Run analysis: <strong>ShopFloor Tools → Run Analysis</strong></li>
        <li>View results in the <strong>Results</strong> sheet</li>
      </ol>
    </div>

    <h4>4. View Validation Dashboard</h4>
    <div class="step">
      Go to <strong>ShopFloor Tools → View Validation Dashboard</strong><br>
      Shows validation issues and suggestions in a sidebar.
    </div>

    <h4>Configuration Sheets</h4>
    <ul>
      <li><strong>Config_KPIs</strong> - Define metrics to collect and calculate</li>
      <li><strong>Config_Validations</strong> - Define data consistency rules</li>
      <li><strong>Config_Sections</strong> - Define business areas</li>
      <li><strong>Config_Benchmarks</strong> - Define industry benchmarks</li>
    </ul>

    <div style="margin-top: 20px; text-align: right;">
      <button onclick="google.script.host.close()" style="padding: 8px 16px;">Close</button>
    </div>
  `)
    .setWidth(500)
    .setHeight(550);

  SpreadsheetApp.getUi().showModalDialog(html, 'Help');
}

// ============================================================================
// PROGRESS INDICATOR
// ============================================================================

/**
 * Show a progress dialog
 * @param {string} message
 */
function showProgress(message) {
  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 30px; text-align: center; }
      .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #3f51b5;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .message { color: #666; font-size: 14px; }
    </style>
    <div class="spinner"></div>
    <div class="message">${message}</div>
  `)
    .setWidth(250)
    .setHeight(150);

  SpreadsheetApp.getUi().showModelessDialog(html, 'Processing...');
}
