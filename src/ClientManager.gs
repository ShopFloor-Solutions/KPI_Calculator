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
 * Called by trigger - generates client_id, calculates period_days
 * @param {Object} e - Form submit event
 */
function processNewSubmission(e) {
  try {
    const sheet = getRequiredSheet(SHEET_NAMES.CLIENTS);
    const lastRow = sheet.getLastRow();

    if (lastRow < 2) {
      log('No data rows found after form submission');
      return;
    }

    // Get headers
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headersLower = headers.map(h => String(h).toLowerCase());

    // Find column indices
    const clientIdCol = headersLower.indexOf('client_id') + 1;
    const companyNameCol = headersLower.indexOf('company_name') + 1;
    const dataPeriodCol = headersLower.indexOf('data_period') + 1;
    const periodDaysCol = headersLower.indexOf('period_days') + 1;
    const analysisStatusCol = headersLower.indexOf('analysis_status') + 1;
    const timestampCol = headersLower.indexOf('timestamp') + 1;

    // Check if client_id is already set (skip if already processed)
    const existingClientId = sheet.getRange(lastRow, clientIdCol).getValue();
    if (existingClientId && String(existingClientId).trim() !== '') {
      log('Client ID already set, skipping processing');
      return;
    }

    // Get company name and data period from the new row
    const companyName = companyNameCol > 0 ?
      sheet.getRange(lastRow, companyNameCol).getValue() : 'Unknown';
    const dataPeriod = dataPeriodCol > 0 ?
      sheet.getRange(lastRow, dataPeriodCol).getValue() : 'monthly';

    // Generate and set client ID
    const clientId = generateClientId(companyName);
    if (clientIdCol > 0) {
      sheet.getRange(lastRow, clientIdCol).setValue(clientId);
    }

    // Set timestamp if not already set
    if (timestampCol > 0) {
      const existingTimestamp = sheet.getRange(lastRow, timestampCol).getValue();
      if (!existingTimestamp) {
        sheet.getRange(lastRow, timestampCol).setValue(new Date());
      }
    }

    // Calculate and set period days
    if (periodDaysCol > 0) {
      const periodDays = getPeriodDays(dataPeriod);
      sheet.getRange(lastRow, periodDaysCol).setValue(periodDays);
    }

    // Set analysis status to pending
    if (analysisStatusCol > 0) {
      sheet.getRange(lastRow, analysisStatusCol).setValue(ANALYSIS_STATUS.PENDING);
    }

    log(`Processed new submission: ${clientId} (${companyName})`);

    // Return the new client ID for further processing
    return clientId;

  } catch (error) {
    logError('Error processing new submission', error);
    throw error;
  }
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
