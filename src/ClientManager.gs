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

  // Build a lowercase key map for case-insensitive lookup
  // (sheetToObjects lowercases all headers, but KPI IDs may have mixed case)
  const clientKeysLower = {};
  for (const key of Object.keys(client)) {
    clientKeysLower[key.toLowerCase()] = key;
  }

  // Extract raw inputs from client data (CASE-INSENSITIVE)
  const rawInputs = {};
  for (const kpi of inputKPIs) {
    const kpiIdLower = kpi.id.toLowerCase();
    const actualKey = clientKeysLower[kpiIdLower];
    const value = actualKey ? client[actualKey] : undefined;
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
    formTier: client.form_tier || '',  // Empty string means unset - caller should prompt
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
 * Now tier-aware: detects form tier and handles updates to existing clients
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

    // Detect form tier from questions asked
    const formTier = detectFormTier(formHeaders);
    log(`Detected form tier: ${formTier}`);

    // Build column mapping (form question title -> kpi_id or field name)
    const columnMapping = buildFormColumnMapping();

    // Map form data to client record
    const clientRecord = mapFormDataToClient(formHeaders, formData, columnMapping);

    // Add form_tier to record
    clientRecord.form_tier = formTier;

    // Check if client already exists (by email or company name)
    const existingClient = findExistingClient(
      clientRecord.contact_email,
      clientRecord.company_name
    );

    if (existingClient) {
      // UPDATE existing client row
      updateClientRecord(existingClient.rowIndex, clientRecord, formTier);
      log(`Updated existing client: ${existingClient.clientId} (${clientRecord.company_name}), tier: ${formTier}`);
      return existingClient.clientId;
    } else {
      // CREATE new client row
      const clientId = generateClientId(clientRecord.company_name || 'Unknown');
      clientRecord.client_id = clientId;
      clientRecord.timestamp = clientRecord.timestamp || new Date();
      clientRecord.period_days = getPeriodDays(clientRecord.data_period);
      clientRecord.analysis_status = ANALYSIS_STATUS.PENDING;

      // Write to Clients sheet
      const clientsSheet = getRequiredSheet(SHEET_NAMES.CLIENTS);
      writeClientRecord(clientsSheet, clientRecord);

      log(`Created new client: ${clientId} (${clientRecord.company_name}), tier: ${formTier}`);
      return clientId;
    }

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
 * Auto-adds missing columns if they exist in Config_KPIs
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} record - Client record with KPI IDs as keys
 */
function writeClientRecord(sheet, record) {
  // Get current headers
  let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  let headersLower = headers.map(h => String(h).toLowerCase());

  // Find keys in record that aren't in headers
  const recordKeys = Object.keys(record);
  const missingKeys = recordKeys.filter(key =>
    !headersLower.includes(key.toLowerCase()) &&
    key !== '' &&
    record[key] !== undefined &&
    record[key] !== null &&
    record[key] !== ''
  );

  // Auto-add missing columns if they're valid KPI IDs or standard fields
  if (missingKeys.length > 0) {
    const kpiConfig = loadKPIConfig();
    const validKPIIds = new Set(kpiConfig.map(k => k.id.toLowerCase()));

    // Standard field names that are always valid
    const standardFields = new Set([
      'client_id', 'timestamp', 'company_name', 'contact_email',
      'industry', 'state', 'data_period', 'period_days', 'form_tier',
      'analysis_status', 'last_analyzed', 'notes'
    ]);

    const columnsToAdd = missingKeys.filter(key =>
      validKPIIds.has(key.toLowerCase()) || standardFields.has(key.toLowerCase())
    );

    if (columnsToAdd.length > 0) {
      // Add new columns at the end
      const lastCol = sheet.getLastColumn();
      for (let i = 0; i < columnsToAdd.length; i++) {
        sheet.getRange(1, lastCol + 1 + i).setValue(columnsToAdd[i]);
      }
      log(`Auto-added ${columnsToAdd.length} columns to Clients sheet: ${columnsToAdd.join(', ')}`);

      // Refresh headers after adding columns
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      headersLower = headers.map(h => String(h).toLowerCase());
    }

    // Log any keys that couldn't be mapped
    const unmappedKeys = missingKeys.filter(key =>
      !validKPIIds.has(key.toLowerCase()) && !standardFields.has(key.toLowerCase())
    );
    if (unmappedKeys.length > 0) {
      log(`WARNING: Could not map these fields (not in Config_KPIs): ${unmappedKeys.join(', ')}`);
    }
  }

  // Build row data matching header order (case-insensitive matching)
  const rowData = [];
  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i]).toLowerCase();

    // Find matching key in record (case-insensitive)
    let value = null;
    for (const key of recordKeys) {
      if (key.toLowerCase() === header) {
        value = record[key];
        break;
      }
    }

    rowData.push(value !== null && value !== undefined ? value : '');
  }

  // Append the row
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

// ============================================================================
// SCHEMA SYNCHRONIZATION
// ============================================================================

/**
 * Synchronize Clients sheet columns with Config_KPIs input definitions
 * Adds missing columns, preserves existing data
 * @returns {Object} {added: number, columns: string[]}
 */
function syncClientsSchema() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let clientsSheet = ss.getSheetByName(SHEET_NAMES.CLIENTS);

  // Create Clients sheet if it doesn't exist
  if (!clientsSheet) {
    clientsSheet = ss.insertSheet(SHEET_NAMES.CLIENTS);
    log('Created Clients sheet');
  }

  // Get KPI configuration
  const kpiConfig = loadKPIConfig();
  const inputKPIs = kpiConfig.filter(k => k.type === 'input');

  // Define required system columns (always first)
  const systemColumns = [
    'client_id', 'timestamp', 'company_name', 'contact_email',
    'industry', 'state', 'data_period', 'period_days', 'form_tier'
  ];

  // Get all input KPI IDs
  const kpiColumns = inputKPIs.map(k => k.id);

  // Define required trailing columns
  const trailingColumns = ['analysis_status', 'last_analyzed', 'notes'];

  // Build complete column list
  const requiredColumns = [...systemColumns, ...kpiColumns, ...trailingColumns];

  // Get current headers (handle empty sheet)
  let currentHeaders = [];
  if (clientsSheet.getLastColumn() > 0) {
    currentHeaders = clientsSheet.getRange(1, 1, 1, clientsSheet.getLastColumn()).getValues()[0];
  }
  const currentHeaderSet = new Set(currentHeaders.map(h => String(h).toLowerCase()));

  // Find missing columns
  const missingColumns = requiredColumns.filter(col =>
    !currentHeaderSet.has(col.toLowerCase())
  );

  if (missingColumns.length === 0) {
    log('Clients schema is up to date - no columns added');
    return { added: 0, columns: [] };
  }

  // Add missing columns at the end
  const lastCol = clientsSheet.getLastColumn() || 0;

  for (let i = 0; i < missingColumns.length; i++) {
    clientsSheet.getRange(1, lastCol + 1 + i).setValue(missingColumns[i]);
  }

  // Format header row if this is a new sheet
  if (lastCol === 0) {
    const headerRange = clientsSheet.getRange(1, 1, 1, missingColumns.length);
    headerRange.setFontWeight('bold')
      .setBackground('#4285f4')
      .setFontColor('#ffffff');
    clientsSheet.setFrozenRows(1);
  }

  log(`Added ${missingColumns.length} columns to Clients sheet: ${missingColumns.join(', ')}`);

  return {
    added: missingColumns.length,
    columns: missingColumns
  };
}

/**
 * Menu handler for schema sync with confirmation
 */
function syncClientsSchemaWithConfirmation() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    'Sync Clients Schema',
    'This will add any missing KPI columns to the Clients sheet based on Config_KPIs.\n\n' +
    'Existing data will NOT be affected.\n\nContinue?',
    ui.ButtonSet.YES_NO
  );

  if (result === ui.Button.YES) {
    try {
      const syncResult = syncClientsSchema();

      if (syncResult.added > 0) {
        ui.alert(
          'Schema Sync Complete',
          `Added ${syncResult.added} new columns:\n\n${syncResult.columns.join('\n')}`,
          ui.ButtonSet.OK
        );
      } else {
        ui.alert(
          'Schema Sync Complete',
          'Clients sheet is already up to date. No columns needed to be added.',
          ui.ButtonSet.OK
        );
      }
    } catch (error) {
      logError('Error syncing schema', error);
      ui.alert('Error', 'Failed to sync schema: ' + error.message, ui.ButtonSet.OK);
    }
  }
}

// ============================================================================
// CLIENT LOOKUP AND UPDATE (Tier-Aware)
// ============================================================================

/**
 * Find existing client by email address
 * @param {string} email - Contact email to search for
 * @returns {Object|null} {rowIndex, data, clientId} or null
 */
function findClientByEmail(email) {
  if (!email || email.trim() === '') return null;

  const sheet = getRequiredSheet(SHEET_NAMES.CLIENTS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const emailCol = headers.findIndex(h => String(h).toLowerCase() === 'contact_email');
  const clientIdCol = headers.findIndex(h => String(h).toLowerCase() === 'client_id');

  if (emailCol < 0) return null;

  const emailLower = email.toLowerCase().trim();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][emailCol]).toLowerCase().trim() === emailLower) {
      return {
        rowIndex: i + 1,  // 1-based row index
        data: data[i],
        clientId: clientIdCol >= 0 ? data[i][clientIdCol] : null
      };
    }
  }
  return null;
}

/**
 * Find existing client by company name
 * @param {string} companyName - Company name to search for
 * @returns {Object|null} {rowIndex, data, clientId} or null
 */
function findClientByCompanyName(companyName) {
  if (!companyName || companyName.trim() === '') return null;

  const sheet = getRequiredSheet(SHEET_NAMES.CLIENTS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const nameCol = headers.findIndex(h => String(h).toLowerCase() === 'company_name');
  const clientIdCol = headers.findIndex(h => String(h).toLowerCase() === 'client_id');

  if (nameCol < 0) return null;

  const nameLower = companyName.toLowerCase().trim();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][nameCol]).toLowerCase().trim() === nameLower) {
      return {
        rowIndex: i + 1,  // 1-based row index
        data: data[i],
        clientId: clientIdCol >= 0 ? data[i][clientIdCol] : null
      };
    }
  }
  return null;
}

/**
 * Find existing client by email OR company name
 * @param {string} email - Contact email
 * @param {string} companyName - Company name
 * @returns {Object|null} {rowIndex, data, clientId} or null
 */
function findExistingClient(email, companyName) {
  // Try email first (more unique)
  const byEmail = findClientByEmail(email);
  if (byEmail) return byEmail;

  // Fall back to company name
  return findClientByCompanyName(companyName);
}

/**
 * Get the higher of two tiers
 * @param {string} tier1 - First tier
 * @param {string} tier2 - Second tier
 * @returns {string} Higher tier
 */
function getHigherTier(tier1, tier2) {
  const tierOrder = { 'onboarding': 1, 'detailed': 2, 'section_deep': 3 };
  const t1 = tierOrder[(tier1 || '').toLowerCase()] || 0;
  const t2 = tierOrder[(tier2 || '').toLowerCase()] || 0;

  if (t2 >= t1) return tier2 || tier1;
  return tier1;
}

/**
 * Update existing client row with new data from form submission
 * Merges new data with existing, keeping values for fields not in new data
 * Updates form_tier to the higher tier
 * @param {number} rowIndex - 1-based row index in Clients sheet
 * @param {Object} newData - New KPI values from form
 * @param {string} newTier - New form tier
 */
function updateClientRecord(rowIndex, newData, newTier) {
  const sheet = getRequiredSheet(SHEET_NAMES.CLIENTS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const headersLower = headers.map(h => String(h).toLowerCase());

  // Get existing row data
  const existingRow = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Merge: new data overwrites, but keep existing values for fields not in new data
  const newDataKeys = Object.keys(newData);
  for (let i = 0; i < headers.length; i++) {
    const headerLower = headersLower[i];

    // Find matching key in new data (case-insensitive)
    for (const key of newDataKeys) {
      if (key.toLowerCase() === headerLower) {
        const newValue = newData[key];
        // Only overwrite if new value is not empty
        if (newValue !== undefined && newValue !== null && newValue !== '') {
          existingRow[i] = newValue;
        }
        break;
      }
    }
  }

  // Update form_tier to the higher tier
  const tierIndex = headersLower.indexOf('form_tier');
  if (tierIndex >= 0) {
    const currentTier = existingRow[tierIndex] || '';
    existingRow[tierIndex] = getHigherTier(currentTier, newTier);
  }

  // Update timestamp
  const tsIndex = headersLower.indexOf('timestamp');
  if (tsIndex >= 0) {
    existingRow[tsIndex] = new Date();
  }

  // Reset analysis status since data changed
  const statusIndex = headersLower.indexOf('analysis_status');
  if (statusIndex >= 0) {
    existingRow[statusIndex] = ANALYSIS_STATUS.PENDING;
  }

  // Write back
  sheet.getRange(rowIndex, 1, 1, existingRow.length).setValues([existingRow]);

  log(`Updated existing client at row ${rowIndex}, tier: ${existingRow[tierIndex] || newTier}`);
}

/**
 * Update client's form_tier
 * @param {string} clientId - Client ID
 * @param {string} newTier - New form tier
 */
function updateClientFormTier(clientId, newTier) {
  const sheet = getRequiredSheet(SHEET_NAMES.CLIENTS);
  const clientIdCol = getColumnByHeader(sheet, 'client_id');
  const tierCol = getColumnByHeader(sheet, 'form_tier');

  if (clientIdCol < 0 || tierCol < 0) {
    logError('Could not find required columns for tier update');
    return;
  }

  const row = findRowByValue(sheet, clientIdCol, clientId);

  if (row < 0) {
    logError(`Client not found for tier update: ${clientId}`);
    return;
  }

  sheet.getRange(row, tierCol).setValue(newTier);
  log(`Updated client ${clientId} form_tier to ${newTier}`);
}

// ============================================================================
// DEBUG UTILITIES
// ============================================================================

/**
 * Debug function to diagnose client data reading issues
 * Logs detailed information about:
 * - Raw client record keys and their values
 * - KPI config input IDs
 * - Case sensitivity matching
 * - Values successfully retrieved vs missing
 *
 * @param {string} clientId - Client ID to debug (uses active client if not provided)
 * @returns {Object} Debug report object
 */
function debugClientDataReading(clientId) {
  const report = {
    timestamp: new Date().toISOString(),
    clientId: clientId || getActiveClientId(),
    issues: [],
    warnings: [],
    details: {}
  };

  try {
    // Get raw client record
    const client = getClientById(report.clientId);
    if (!client) {
      report.issues.push(`Client not found: ${report.clientId}`);
      log('DEBUG: ' + JSON.stringify(report, null, 2));
      return report;
    }

    // Get client record keys (after sheetToObjects lowercasing)
    const clientKeys = Object.keys(client);
    report.details.clientRecordKeys = clientKeys;

    // Get KPI config
    const kpiConfig = loadKPIConfig();
    const inputKPIs = kpiConfig.filter(k => k.type === 'input');
    report.details.inputKPICount = inputKPIs.length;
    report.details.inputKPIIds = inputKPIs.map(k => k.id);

    // Check case sensitivity issues
    const clientKeysLower = {};
    for (const key of clientKeys) {
      clientKeysLower[key.toLowerCase()] = key;
    }

    const matched = [];
    const mismatched = [];
    const missing = [];

    for (const kpi of inputKPIs) {
      const kpiId = kpi.id;
      const kpiIdLower = kpiId.toLowerCase();
      const actualKey = clientKeysLower[kpiIdLower];

      if (!actualKey) {
        missing.push({
          kpiId: kpiId,
          reason: 'No matching key in client record (even case-insensitive)'
        });
      } else if (actualKey === kpiId) {
        matched.push({
          kpiId: kpiId,
          value: client[actualKey],
          match: 'exact'
        });
      } else {
        mismatched.push({
          kpiId: kpiId,
          actualKey: actualKey,
          value: client[actualKey],
          match: 'case-insensitive'
        });
      }
    }

    report.details.matched = matched;
    report.details.mismatched = mismatched;
    report.details.missing = missing;

    // Add summary statistics
    report.summary = {
      totalInputKPIs: inputKPIs.length,
      exactMatches: matched.length,
      caseInsensitiveMatches: mismatched.length,
      missingKeys: missing.length
    };

    // Generate warnings and issues
    if (mismatched.length > 0) {
      report.warnings.push(
        `${mismatched.length} KPI IDs required case-insensitive matching. ` +
        `This is handled correctly but indicates potential case inconsistencies in your sheets.`
      );
    }

    if (missing.length > 0) {
      report.issues.push(
        `${missing.length} KPI IDs have no matching column in Clients sheet. ` +
        `Run syncClientsSchema() to add missing columns.`
      );
    }

    // Log the report
    log('=== DEBUG CLIENT DATA READING REPORT ===');
    log(`Client ID: ${report.clientId}`);
    log(`Input KPIs: ${inputKPIs.length}`);
    log(`Exact matches: ${matched.length}`);
    log(`Case-insensitive matches: ${mismatched.length}`);
    log(`Missing: ${missing.length}`);

    if (mismatched.length > 0) {
      log('Case mismatches:');
      for (const m of mismatched.slice(0, 10)) {
        log(`  KPI "${m.kpiId}" -> actual key "${m.actualKey}"`);
      }
      if (mismatched.length > 10) {
        log(`  ... and ${mismatched.length - 10} more`);
      }
    }

    if (missing.length > 0) {
      log('Missing KPIs:');
      for (const m of missing.slice(0, 10)) {
        log(`  "${m.kpiId}"`);
      }
      if (missing.length > 10) {
        log(`  ... and ${missing.length - 10} more`);
      }
    }

    log('========================================');

  } catch (error) {
    report.issues.push(`Error during debug: ${error.message}`);
    logError('debugClientDataReading error', error);
  }

  return report;
}

/**
 * Menu handler to run debug on active client
 */
function debugActiveClient() {
  const clientId = getActiveClientId();
  if (!clientId) {
    SpreadsheetApp.getUi().alert('No active client selected. Please select a client first.');
    return;
  }

  const report = debugClientDataReading(clientId);

  // Show summary in UI
  const ui = SpreadsheetApp.getUi();
  let message = `Debug Report for ${clientId}\n\n`;
  message += `Total Input KPIs: ${report.summary?.totalInputKPIs || 0}\n`;
  message += `Exact matches: ${report.summary?.exactMatches || 0}\n`;
  message += `Case-insensitive matches: ${report.summary?.caseInsensitiveMatches || 0}\n`;
  message += `Missing keys: ${report.summary?.missingKeys || 0}\n\n`;

  if (report.issues.length > 0) {
    message += 'Issues:\n' + report.issues.join('\n') + '\n\n';
  }

  if (report.warnings.length > 0) {
    message += 'Warnings:\n' + report.warnings.join('\n');
  }

  message += '\n\nFull details logged to Apps Script console.';

  ui.alert('Client Data Debug Report', message, ui.ButtonSet.OK);
}

/**
 * Validate that all KPI IDs in validation rules exist in Config_KPIs
 * @returns {Object[]} Array of issues found
 */
function validateRuleKPIReferences() {
  const kpiConfig = loadKPIConfig();
  const validIds = new Set(kpiConfig.map(k => k.id.toLowerCase()));

  const validationConfig = loadValidationConfig();
  const issues = [];

  for (const rule of validationConfig) {
    if (!rule.affectedKPIs || rule.affectedKPIs.length === 0) continue;

    // affectedKPIs can be a string or array
    const kpiIds = Array.isArray(rule.affectedKPIs)
      ? rule.affectedKPIs
      : rule.affectedKPIs.split(',').map(id => id.trim());

    for (const kpiId of kpiIds) {
      const kpiIdLower = kpiId.toLowerCase();
      if (kpiIdLower && !validIds.has(kpiIdLower)) {
        issues.push({
          ruleId: rule.id,
          ruleName: rule.name,
          invalidKPI: kpiId
        });
      }
    }
  }

  if (issues.length > 0) {
    log('WARNING: Validation rules reference invalid KPI IDs:');
    issues.forEach(i => log(`  Rule ${i.ruleId}: unknown KPI "${i.invalidKPI}"`));
  } else {
    log('All validation rule KPI references are valid');
  }

  return issues;
}
