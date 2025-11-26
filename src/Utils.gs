/**
 * Utils.gs
 * Helper functions used across all modules
 *
 * ShopFloor Solutions - Operational KPI Calculator
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const SHEET_NAMES = {
  CONFIG_KPIS: 'Config_KPIs',
  CONFIG_VALIDATIONS: 'Config_Validations',
  CONFIG_SECTIONS: 'Config_Sections',
  CONFIG_BENCHMARKS: 'Config_Benchmarks',
  CLIENTS: 'Clients',
  RESULTS: 'Results',
  VALIDATION_LOG: 'Validation_Log',
  SETTINGS: '_Settings'
};

const SETTINGS_KEYS = {
  ACTIVE_CLIENT_ID: 'active_client_id',
  FORM_ID: 'form_id',
  FORM_URL: 'form_url',
  FORM_RESPONSE_URL: 'form_response_url',
  FORM_RESPONSES_SHEET: 'form_responses_sheet',
  LAST_FORM_SYNC: 'last_form_sync',
  AUTO_ANALYZE: 'auto_analyze',
  VERSION: 'version',
  NOTIFICATION_EMAIL: 'notification_email'
};

const DATA_TYPES = {
  CURRENCY: 'currency',
  PERCENTAGE: 'percentage',
  NUMBER: 'number',
  INTEGER: 'integer'
};

const SEVERITY_LEVELS = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

const VALIDATION_STATUS = {
  VALID: 'valid',
  WARNINGS: 'warnings',
  ERRORS: 'errors'
};

const ANALYSIS_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  ERROR: 'error'
};

// US States and Canadian Provinces
const STATES_PROVINCES = [
  // US States
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois',
  'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts',
  'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
  'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota',
  'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming',
  // Canadian Provinces and Territories
  'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador',
  'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island',
  'Quebec', 'Saskatchewan', 'Yukon'
];

const INDUSTRIES = [
  'HVAC',
  'Plumbing',
  'Roofing',
  'Electrical',
  'General Contracting'
];

const DATA_PERIODS = [
  { label: 'Monthly', value: 'monthly', days: 30 },
  { label: 'Quarterly', value: 'quarterly', days: 90 },
  { label: 'Annual', value: 'annual', days: 365 }
];

// ============================================================================
// SHEET OPERATIONS
// ============================================================================

/**
 * Get sheet by name, create if doesn't exist
 * @param {string} sheetName - Name of the sheet
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    log(`Created sheet: ${sheetName}`);
  }

  return sheet;
}

/**
 * Get sheet by name, throw error if doesn't exist
 * @param {string} sheetName - Name of the sheet
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 * @throws {Error} If sheet doesn't exist
 */
function getRequiredSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(`Required sheet "${sheetName}" not found. Please run "Initialize System" from the ShopFloor Tools menu.`);
  }

  return sheet;
}

/**
 * Check if a sheet exists
 * @param {string} sheetName - Name of the sheet
 * @returns {boolean}
 */
function sheetExists(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(sheetName) !== null;
}

/**
 * Convert sheet data to array of objects
 * Uses first row as headers
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {Object[]}
 */
function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();

  if (data.length < 2) {
    return []; // No data rows
  }

  // Process headers: handle duplicates by appending _2, _3, etc.
  const rawHeaders = data[0].map(h => String(h).trim().toLowerCase());
  const headers = [];
  const headerCounts = {};

  for (const header of rawHeaders) {
    if (!header) {
      headers.push('');
      continue;
    }

    if (headerCounts[header] === undefined) {
      headerCounts[header] = 1;
      headers.push(header);
    } else {
      headerCounts[header]++;
      headers.push(`${header}_${headerCounts[header]}`);
    }
  }

  const objects = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const obj = {};

    for (let j = 0; j < headers.length; j++) {
      if (headers[j]) {
        obj[headers[j]] = row[j];
      }
    }

    objects.push(obj);
  }

  return objects;
}

/**
 * Write array of objects to sheet
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object[]} data - Array of objects to write
 * @param {string[]} headers - Column order
 * @param {boolean} [clearFirst=true] - Whether to clear sheet first
 */
function objectsToSheet(sheet, data, headers, clearFirst = true) {
  if (clearFirst) {
    sheet.clearContents();
  }

  if (data.length === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  const rows = [headers];

  for (const obj of data) {
    const row = headers.map(h => obj[h.toLowerCase()] !== undefined ? obj[h.toLowerCase()] : '');
    rows.push(row);
  }

  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
}

/**
 * Get column index by header name (1-based)
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string} headerName
 * @returns {number} Column index (1-based) or -1 if not found
 */
function getColumnByHeader(sheet, headerName) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const index = headers.findIndex(h =>
    String(h).trim().toLowerCase() === headerName.toLowerCase()
  );
  return index >= 0 ? index + 1 : -1;
}

/**
 * Find row by value in a specific column
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} column - Column index (1-based)
 * @param {any} value - Value to find
 * @returns {number} Row index (1-based) or -1 if not found
 */
function findRowByValue(sheet, column, value) {
  const data = sheet.getRange(1, column, sheet.getLastRow(), 1).getValues();

  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === value) {
      return i + 1;
    }
  }

  return -1;
}

// ============================================================================
// SETTINGS OPERATIONS
// ============================================================================

/**
 * Get value from _Settings sheet
 * @param {string} key - Setting key
 * @returns {any} Setting value or null
 */
function getSetting(key) {
  try {
    const sheet = getRequiredSheet(SHEET_NAMES.SETTINGS);
    const data = sheet.getDataRange().getValues();

    for (const row of data) {
      if (row[0] === key) {
        return row[1];
      }
    }

    return null;
  } catch (e) {
    log(`Error getting setting "${key}": ${e.message}`);
    return null;
  }
}

/**
 * Set value in _Settings sheet
 * @param {string} key - Setting key
 * @param {any} value - Setting value
 */
function setSetting(key, value) {
  const sheet = getOrCreateSheet(SHEET_NAMES.SETTINGS);
  const data = sheet.getDataRange().getValues();

  // Find existing key
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }

  // Key not found, append new row
  const lastRow = Math.max(sheet.getLastRow(), 0);
  sheet.getRange(lastRow + 1, 1, 1, 2).setValues([[key, value]]);
}

/**
 * Get all settings as an object
 * @returns {Object} Settings object
 */
function getAllSettings() {
  try {
    const sheet = getRequiredSheet(SHEET_NAMES.SETTINGS);
    const data = sheet.getDataRange().getValues();
    const settings = {};

    for (const row of data) {
      if (row[0]) {
        settings[row[0]] = row[1];
      }
    }

    return settings;
  } catch (e) {
    return {};
  }
}

// ============================================================================
// STRING UTILITIES
// ============================================================================

/**
 * Sanitize string for use in IDs
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeForId(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Convert snake_case to Title Case
 * @param {string} str - Snake case string
 * @returns {string} Title case string
 */
function snakeToTitleCase(str) {
  if (!str) return '';
  return String(str)
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Parse sections string "1,2,3" into array [1,2,3]
 * @param {string} sectionsStr - Comma-separated section numbers
 * @returns {number[]} Array of section IDs
 */
function parseSections(sectionsStr) {
  if (!sectionsStr) return [];
  return String(sectionsStr)
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n));
}

/**
 * Parse affected KPIs string into array
 * @param {string} kpisStr - Comma-separated KPI IDs
 * @returns {string[]} Array of KPI IDs
 */
function parseAffectedKPIs(kpisStr) {
  if (!kpisStr) return [];
  return String(kpisStr)
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

// ============================================================================
// NUMBER UTILITIES
// ============================================================================

/**
 * Parse number from string, handling currency/percentage symbols
 * @param {string|number} str - Value to parse
 * @returns {number|null} Parsed number or null
 */
function parseNumber(str) {
  if (str === null || str === undefined || str === '') {
    return null;
  }

  if (typeof str === 'number') {
    return isNaN(str) ? null : str;
  }

  // Remove currency symbols, commas, percentage signs
  const cleaned = String(str)
    .replace(/[$€£¥,]/g, '')
    .replace(/%$/, '')
    .trim();

  if (cleaned === '') {
    return null;
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Format number as currency
 * @param {number} value - Value to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Format number as percentage
 * @param {number} value - Value to format (e.g., 50 for 50%)
 * @returns {string} Formatted percentage string
 */
function formatPercentage(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }

  return value.toFixed(1) + '%';
}

/**
 * Format number based on data type
 * @param {number} value - Value to format
 * @param {string} dataType - Data type (currency, percentage, number, integer)
 * @returns {string} Formatted string
 */
function formatValue(value, dataType) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }

  switch (dataType) {
    case DATA_TYPES.CURRENCY:
      return formatCurrency(value);
    case DATA_TYPES.PERCENTAGE:
      return formatPercentage(value);
    case DATA_TYPES.INTEGER:
      return Math.round(value).toLocaleString();
    case DATA_TYPES.NUMBER:
    default:
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
}

/**
 * Check if value is null, undefined, or empty string
 * @param {any} value - Value to check
 * @returns {boolean}
 */
function isEmpty(value) {
  return value === null || value === undefined || value === '';
}

/**
 * Safe division (returns null if denominator is 0 or missing)
 * @param {number} a - Numerator
 * @param {number} b - Denominator
 * @returns {number|null}
 */
function safeDivide(a, b) {
  if (isEmpty(a) || isEmpty(b) || b === 0) {
    return null;
  }
  return a / b;
}

/**
 * Clamp value between min and max
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Get current timestamp string
 * @returns {string} ISO timestamp
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Format date for display
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  if (!date) return 'N/A';

  const d = date instanceof Date ? date : new Date(date);

  if (isNaN(d.getTime())) {
    return 'N/A';
  }

  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Calculate period days from period type
 * @param {string} dataPeriod - "monthly", "quarterly", "annual"
 * @returns {number} Days in period
 */
function getPeriodDays(dataPeriod) {
  const period = DATA_PERIODS.find(p =>
    p.value.toLowerCase() === String(dataPeriod).toLowerCase()
  );
  return period ? period.days : 30; // Default to monthly
}

// ============================================================================
// OBJECT UTILITIES
// ============================================================================

/**
 * Deep clone an object
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Merge objects (shallow)
 * @param {...Object} objects - Objects to merge
 * @returns {Object} Merged object
 */
function merge(...objects) {
  return Object.assign({}, ...objects);
}

// ============================================================================
// LOGGING
// ============================================================================

/**
 * Log with timestamp
 * @param {string} message - Message to log
 */
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

/**
 * Log error with timestamp
 * @param {string} message - Error message
 * @param {Error} [error] - Error object
 */
function logError(message, error) {
  const timestamp = new Date().toISOString();
  const errorDetails = error ? ` | ${error.message}` : '';
  console.error(`[${timestamp}] ERROR: ${message}${errorDetails}`);
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Check if a value is a valid number
 * @param {any} value
 * @returns {boolean}
 */
function isValidNumber(value) {
  const num = parseNumber(value);
  return num !== null && !isNaN(num);
}

/**
 * Check if a value is within a range
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {boolean}
 */
function isInRange(value, min, max) {
  if (!isValidNumber(value)) return false;
  return value >= min && value <= max;
}

/**
 * Calculate percentage variance between two values
 * @param {number} expected
 * @param {number} actual
 * @returns {number|null} Variance as decimal (0.1 = 10%)
 */
function calculateVariance(expected, actual) {
  if (isEmpty(expected) || isEmpty(actual)) {
    return null;
  }

  const maxVal = Math.max(Math.abs(expected), Math.abs(actual));

  if (maxVal === 0) {
    return 0;
  }

  return Math.abs(expected - actual) / maxVal;
}

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Show toast notification
 * @param {string} message - Message to show
 * @param {string} [title=''] - Toast title
 * @param {number} [duration=5] - Duration in seconds
 */
function showToast(message, title = '', duration = 5) {
  SpreadsheetApp.getActiveSpreadsheet().toast(message, title, duration);
}

/**
 * Show alert dialog
 * @param {string} message - Alert message
 */
function showAlert(message) {
  SpreadsheetApp.getUi().alert(message);
}

/**
 * Show confirmation dialog
 * @param {string} message - Confirmation message
 * @returns {boolean} True if user clicked OK
 */
function showConfirmation(message) {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(message, ui.ButtonSet.OK_CANCEL);
  return response === ui.Button.OK;
}

/**
 * Show yes/no confirmation dialog
 * @param {string} title - Dialog title
 * @param {string} message - Confirmation message
 * @returns {boolean} True if user clicked Yes
 */
function showYesNoConfirmation(title, message) {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(title, message, ui.ButtonSet.YES_NO);
  return response === ui.Button.YES;
}
