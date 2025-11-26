/**
 * ClientManager.gs
 * Client CRUD operations and selection
 *
 * ShopFloor Solutions - Operational KPI Calculator
 */

// ============================================================================
// CLIENT RETRIEVAL
// ============================================================================

/**
 * Get all clients from Clients sheet
 * @returns {Object[]} Array of client objects
 */
function getAllClients() {
  const sheet = getRequiredSheet(SHEET_NAMES.CLIENTS);
  return sheetToObjects(sheet);
}

/**
 * Get client by ID
 * @param {string} clientId - Client ID
 * @returns {Object|null} Client object or null
 */
function getClientById(clientId) {
  const clients = getAllClients();
  return clients.find(c => c.client_id === clientId) || null;
}

/**
 * Get full client data including raw inputs
 * @param {string} clientId - Client ID
 * @returns {Object|null} Client object with rawInputs populated
 */
function getClientData(clientId) {
  const client = getClientById(clientId);

  if (!client) {
    return null;
  }

  // Load KPI config to identify input KPIs
  const kpiConfig = loadKPIConfig();
  const inputKPIs = kpiConfig.filter(k => k.type === 'input');

  // Extract raw inputs from client data
  const rawInputs = {};
  for (const kpi of inputKPIs) {
    const value = client[kpi.id];
    rawInputs[kpi.id] = parseNumber(value);
  }

  // Build structured client data object
  return {
    id: client.client_id,
    companyName: client.company_name || 'Unknown Company',
    contactEmail: client.contact_email || '',
    industry: client.industry || 'General Contracting',
    state: client.state || '',
    dataPeriod: client.data_period || 'monthly',
    periodDays: parseInt(client.period_days, 10) || getPeriodDays(client.data_period),
    submittedAt: client.timestamp ? new Date(client.timestamp) : new Date(),
    analysisStatus: client.analysis_status || ANALYSIS_STATUS.PENDING,
    lastAnalyzed: client.last_analyzed ? new Date(client.last_analyzed) : null,
    notes: client.notes || '',
    rawInputs: rawInputs
  };
}

/**
 * Get list of clients for dropdown (id, name, date)
 * @returns {Object[]} [{id, name, timestamp, industry, status}]
 */
function getClientList() {
  const clients = getAllClients();

  return clients.map(c => ({
    id: c.client_id,
    name: c.company_name || 'Unknown',
    timestamp: c.timestamp,
    industry: c.industry || '',
    status: c.analysis_status || ANALYSIS_STATUS.PENDING
  })).filter(c => c.id); // Filter out rows without ID
}

// ============================================================================
// ACTIVE CLIENT MANAGEMENT
// ============================================================================

/**
 * Get the currently active client ID from _Settings
 * @returns {string|null} Client ID or null
 */
function getActiveClientId() {
  return getSetting(SETTINGS_KEYS.ACTIVE_CLIENT_ID) || null;
}

/**
 * Set the active client
 * @param {string} clientId - Client ID to set as active
 */
function setActiveClient(clientId) {
  setSetting(SETTINGS_KEYS.ACTIVE_CLIENT_ID, clientId);
  log(`Active client set to: ${clientId}`);
}

/**
 * Get the currently active client's data
 * @returns {Object|null} Client data or null
 */
function getActiveClientData() {
  const clientId = getActiveClientId();
  if (!clientId) return null;
  return getClientData(clientId);
}

// ============================================================================
// CLIENT MODIFICATION
// ============================================================================

/**
 * Update client analysis status
 * @param {string} clientId - Client ID
 * @param {string} status - New status (pending, completed, error)
 */
function updateClientAnalysisStatus(clientId, status) {
  const sheet = getRequiredSheet(SHEET_NAMES.CLIENTS);
  const clientIdCol = getColumnByHeader(sheet, 'client_id');
  const statusCol = getColumnByHeader(sheet, 'analysis_status');
  const lastAnalyzedCol = getColumnByHeader(sheet, 'last_analyzed');

  if (clientIdCol < 0 || statusCol < 0) {
    logError('Could not find required columns for status update');
    return;
  }

  const row = findRowByValue(sheet, clientIdCol, clientId);

  if (row < 0) {
    logError(`Client not found for status update: ${clientId}`);
    return;
  }

  sheet.getRange(row, statusCol).setValue(status);

  if (lastAnalyzedCol > 0 && status === ANALYSIS_STATUS.COMPLETED) {
    sheet.getRange(row, lastAnalyzedCol).setValue(new Date());
  }

  log(`Updated client ${clientId} status to ${status}`);
}

/**
 * Delete a client record
 * @param {string} clientId - Client ID to delete
 * @returns {boolean} True if deleted
 */
function deleteClient(clientId) {
  const sheet = getRequiredSheet(SHEET_NAMES.CLIENTS);
  const clientIdCol = getColumnByHeader(sheet, 'client_id');

  if (clientIdCol < 0) {
    logError('Could not find client_id column');
    return false;
  }

  const row = findRowByValue(sheet, clientIdCol, clientId);

  if (row < 0) {
    logError(`Client not found for deletion: ${clientId}`);
    return false;
  }

  sheet.deleteRow(row);

  // Clear active client if this was the active one
  if (getActiveClientId() === clientId) {
    setSetting(SETTINGS_KEYS.ACTIVE_CLIENT_ID, '');
  }

  log(`Deleted client: ${clientId}`);
  return true;
}

/**
 * Update client notes
 * @param {string} clientId - Client ID
 * @param {string} notes - New notes
 */
function updateClientNotes(clientId, notes) {
  const sheet = getRequiredSheet(SHEET_NAMES.CLIENTS);
  const clientIdCol = getColumnByHeader(sheet, 'client_id');
  const notesCol = getColumnByHeader(sheet, 'notes');

  if (clientIdCol < 0 || notesCol < 0) {
    logError('Could not find required columns for notes update');
    return;
  }

  const row = findRowByValue(sheet, clientIdCol, clientId);

  if (row > 0) {
    sheet.getRange(row, notesCol).setValue(notes);
    log(`Updated notes for client ${clientId}`);
  }
}

// ============================================================================
// CLIENT CREATION (Form Submission Processing)
// ============================================================================

/**
 * Generate unique client ID
 * @param {string} companyName - Company name
 * @returns {string} Unique ID
 */
function generateClientId(companyName) {
  const timestamp = new Date().getTime();
  const sanitizedName = sanitizeForId(companyName).substring(0, 20);
  return `${timestamp}_${sanitizedName}`;
}

/**
 * Process new form submission
 * Called by trigger - reads from form responses sheet, maps columns, writes to Clients sheet
 * @param {Object} e - Form submit event
 */
function processNewSubmission(e) {
  try {
    // Get form responses sheet name from settings
    const formResponsesSheetName = getSetting(SETTINGS_KEYS.FORM_RESPONSES_SHEET);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Find the form responses sheet
    let formSheet = null;
    if (formResponsesSheetName) {
      formSheet = ss.getSheetByName(formResponsesSheetName);
    }

    // Fallback: find any sheet starting with "Form Responses"
    if (!formSheet) {
      const sheets = ss.getSheets();
      for (const sheet of sheets) {
        if (sheet.getName().startsWith('Form Responses')) {
          formSheet = sheet;
          break;
        }
      }
    }

    if (!formSheet) {
      log('No form responses sheet found');
      return;
    }

    const formLastRow = formSheet.getLastRow();
    if (formLastRow < 2) {
      log('No data rows in form responses sheet');
      return;
    }

    // Get form response headers and last row data
    const formHeaders = formSheet.getRange(1, 1, 1, formSheet.getLastColumn()).getValues()[0];
    const formData = formSheet.getRange(formLastRow, 1, 1, formSheet.getLastColumn()).getValues()[0];

    // Build column mapping (form question title -> kpi_id or field name)
    const columnMapping = buildFormColumnMapping();

    // Map form data to client record
    const clientRecord = mapFormDataToClient(formHeaders, formData, columnMapping);

    // Generate client ID
    const clientId = generateClientId(clientRecord.company_name || 'Unknown');
    clientRecord.client_id = clientId;
    clientRecord.timestamp = clientRecord.timestamp || new Date();
    clientRecord.period_days = getPeriodDays(clientRecord.data_period);
    clientRecord.analysis_status = ANALYSIS_STATUS.PENDING;

    // Write to Clients sheet
    const clientsSheet = getRequiredSheet(SHEET_NAMES.CLIENTS);
    writeClientRecord(clientsSheet, clientRecord);

    log(`Processed new submission: ${clientId} (${clientRecord.company_name})`);

    return clientId;

  } catch (error) {
    logError('Error processing new submission', error);
    throw error;
  }
}

/**
 * Build column mapping from form question titles to field names
 * @returns {Object} Mapping object
 */
function buildFormColumnMapping() {
  const mapping = {
    // Standard form fields
    'Timestamp': 'timestamp',
    'Company Name': 'company_name',
    'Contact Email': 'contact_email',
    'Industry': 'industry',
    'State/Province': 'state',
    'Data Period': 'data_period',
    'Notes or Comments': 'notes'
  };

  // Add KPI name to ID mappings
  try {
    const kpiConfig = loadKPIConfig();
    for (const kpi of kpiConfig) {
      if (kpi.type === 'input') {
        mapping[kpi.name] = kpi.id;
      }
    }
  } catch (e) {
    log('Could not load KPI config for column mapping: ' + e.message);
  }

  return mapping;
}

/**
 * Map form data to client record using column mapping
 * @param {string[]} headers - Form column headers
 * @param {any[]} data - Form row data
 * @param {Object} mapping - Column name mapping
 * @returns {Object} Client record
 */
function mapFormDataToClient(headers, data, mapping) {
  const record = {};

  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i]).trim();
    const value = data[i];

    // Try to map the header
    const mappedKey = mapping[header];
    if (mappedKey) {
      record[mappedKey] = value;
    } else {
      // Use sanitized header as key
      const sanitizedKey = sanitizeForId(header);
      if (sanitizedKey) {
        record[sanitizedKey] = value;
      }
    }
  }

  return record;
}

/**
 * Write client record to Clients sheet
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} record - Client record
 */
function writeClientRecord(sheet, record) {
  // Get headers from Clients sheet
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const headersLower = headers.map(h => String(h).toLowerCase());

  // Build row data matching header order
  const rowData = [];
  for (const header of headersLower) {
    const value = record[header];
    rowData.push(value !== undefined ? value : '');
  }

  // Append row
  const newRow = sheet.getLastRow() + 1;
  sheet.getRange(newRow, 1, 1, rowData.length).setValues([rowData]);
}

// ============================================================================
// CLIENT SEARCH AND FILTERING
// ============================================================================

/**
 * Search clients by company name
 * @param {string} searchTerm - Search term
 * @returns {Object[]} Matching clients
 */
function searchClients(searchTerm) {
  const clients = getClientList();
  const term = searchTerm.toLowerCase();

  return clients.filter(c =>
    c.name.toLowerCase().includes(term) ||
    c.industry.toLowerCase().includes(term)
  );
}

/**
 * Get clients by industry
 * @param {string} industry - Industry to filter by
 * @returns {Object[]} Matching clients
 */
function getClientsByIndustry(industry) {
  const clients = getClientList();
  return clients.filter(c =>
    c.industry.toLowerCase() === industry.toLowerCase()
  );
}

/**
 * Get clients by analysis status
 * @param {string} status - Status to filter by
 * @returns {Object[]} Matching clients
 */
function getClientsByStatus(status) {
  const clients = getClientList();
  return clients.filter(c => c.status === status);
}

/**
 * Get most recent clients
 * @param {number} [limit=10] - Number of clients to return
 * @returns {Object[]} Most recent clients
 */
function getRecentClients(limit = 10) {
  const clients = getClientList();

  return clients
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

// ============================================================================
// CLIENT STATISTICS
// ============================================================================

/**
 * Get client statistics
 * @returns {Object} Statistics object
 */
function getClientStatistics() {
  const clients = getClientList();

  const stats = {
    total: clients.length,
    byStatus: {
      pending: 0,
      completed: 0,
      error: 0
    },
    byIndustry: {}
  };

  for (const client of clients) {
    // Count by status
    const status = client.status || ANALYSIS_STATUS.PENDING;
    if (stats.byStatus.hasOwnProperty(status)) {
      stats.byStatus[status]++;
    }

    // Count by industry
    const industry = client.industry || 'Unknown';
    if (!stats.byIndustry[industry]) {
      stats.byIndustry[industry] = 0;
    }
    stats.byIndustry[industry]++;
  }

  return stats;
}

// ============================================================================
// CLIENT DATA EXPORT
// ============================================================================

/**
 * Export client data to JSON format
 * @param {string} clientId - Client ID
 * @returns {string} JSON string
 */
function exportClientToJSON(clientId) {
  const clientData = getClientData(clientId);

  if (!clientData) {
    throw new Error(`Client not found: ${clientId}`);
  }

  return JSON.stringify(clientData, null, 2);
}

/**
 * Get client summary for display
 * @param {string} clientId - Client ID
 * @returns {Object} Summary object
 */
function getClientSummary(clientId) {
  const client = getClientData(clientId);

  if (!client) {
    return null;
  }

  // Count non-null inputs
  let inputCount = 0;
  let totalInputs = 0;

  for (const key in client.rawInputs) {
    totalInputs++;
    if (client.rawInputs[key] !== null) {
      inputCount++;
    }
  }

  return {
    id: client.id,
    companyName: client.companyName,
    industry: client.industry,
    state: client.state,
    dataPeriod: client.dataPeriod,
    submittedAt: formatDate(client.submittedAt),
    analysisStatus: client.analysisStatus,
    lastAnalyzed: client.lastAnalyzed ? formatDate(client.lastAnalyzed) : 'Never',
    dataCompleteness: totalInputs > 0 ? Math.round((inputCount / totalInputs) * 100) : 0,
    inputsProvided: inputCount,
    totalInputs: totalInputs
  };
}
