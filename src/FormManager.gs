/**
 * FormManager.gs
 * Create, update, and manage Google Form integration
 *
 * ShopFloor Solutions - Operational KPI Calculator
 */

// ============================================================================
// FORM CREATION
// ============================================================================

/**
 * Create a new Google Form based on Config_KPIs
 * Links form to Clients sheet
 * Stores form ID in _Settings
 * @returns {string} Form URL
 */
function createClientIntakeForm() {
  try {
    // Check for existing form with responses
    const existingFormId = getSetting(SETTINGS_KEYS.FORM_ID);
    if (existingFormId) {
      const hasResponses = checkFormHasResponses(existingFormId);

      if (hasResponses) {
        const proceed = showYesNoConfirmation(
          'Warning: Existing Form Has Responses',
          'The existing form has responses. Recreating will unlink those responses.\n\n' +
          'Existing responses will remain in the Clients sheet, but the form link will be broken.\n\n' +
          'Are you sure you want to recreate the form?'
        );

        if (!proceed) {
          showToast('Form creation cancelled', 'Form Manager', 3);
          return null;
        }
      }

      // Delete old form
      try {
        deleteForm();
      } catch (e) {
        log('Could not delete old form: ' + e.message);
      }
    }

    showToast('Creating intake form...', 'Form Manager', 5);

    // Get input KPIs
    const inputKPIs = getInputKPIs();

    if (inputKPIs.length === 0) {
      showAlert('No input KPIs found in Config_KPIs. Please add KPIs with type="input".');
      return null;
    }

    // Create form
    const form = FormApp.create('Client Operational Assessment - ShopFloor Solutions');

    // Set form properties
    form.setDescription(
      'Thank you for taking the time to complete this operational assessment.\n\n' +
      'This information helps us understand your business and identify opportunities for improvement.\n\n' +
      'All fields marked with * are required. Please provide the most accurate data available.'
    );

    form.setCollectEmail(false);
    form.setAllowResponseEdits(false);
    form.setLimitOneResponsePerUser(false);
    form.setProgressBar(true);
    form.setConfirmationMessage(
      'Thank you for your submission!\n\n' +
      'Our team will analyze your data and reach out with insights.'
    );

    // Build form questions
    buildFormQuestions(form, inputKPIs);

    // Link form to Clients sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

    // Store form info in settings
    setSetting(SETTINGS_KEYS.FORM_ID, form.getId());
    setSetting(SETTINGS_KEYS.FORM_URL, form.getEditUrl());
    setSetting(SETTINGS_KEYS.FORM_RESPONSE_URL, form.getPublishedUrl());
    setSetting(SETTINGS_KEYS.LAST_FORM_SYNC, new Date().toISOString());

    // Install form submit trigger
    installFormTrigger(form.getId());

    // Rename the form responses sheet
    SpreadsheetApp.flush();
    Utilities.sleep(2000); // Wait for sheet to be created

    renameFormResponsesSheet();

    showAlert(
      'Form created successfully!\n\n' +
      'Form URL (share with clients):\n' +
      form.getPublishedUrl() + '\n\n' +
      'You can also access this URL via the menu: Form Management → Get Form URL'
    );

    log('Form created: ' + form.getId());

    return form.getPublishedUrl();

  } catch (error) {
    logError('Error creating form', error);
    showAlert('Error creating form: ' + error.message);
    return null;
  }
}

/**
 * Build form questions from KPI config
 * @param {GoogleAppsScript.Forms.Form} form
 * @param {Object[]} inputKPIs
 */
function buildFormQuestions(form, inputKPIs) {
  // ---- Section 1: Company Information ----
  form.addPageBreakItem()
    .setTitle('Company Information')
    .setHelpText('Please provide your company details.');

  // Company Name
  form.addTextItem()
    .setTitle('Company Name')
    .setRequired(true)
    .setHelpText('Your company or business name');

  // Contact Email
  form.addTextItem()
    .setTitle('Contact Email')
    .setRequired(true)
    .setHelpText('Email address for follow-up');

  // Industry
  form.addListItem()
    .setTitle('Industry')
    .setRequired(true)
    .setHelpText('Primary trade/industry')
    .setChoiceValues(INDUSTRIES);

  // State/Province
  form.addListItem()
    .setTitle('State/Province')
    .setRequired(true)
    .setHelpText('Your primary location')
    .setChoiceValues(STATES_PROVINCES);

  // Data Period
  form.addListItem()
    .setTitle('Data Period')
    .setRequired(true)
    .setHelpText('What time period does this data represent?')
    .setChoiceValues(DATA_PERIODS.map(p => p.label));

  // ---- Section 2: Volume Metrics ----
  const volumeKPIs = inputKPIs.filter(k => k.category === 'volume');

  if (volumeKPIs.length > 0) {
    form.addPageBreakItem()
      .setTitle('Volume Metrics')
      .setHelpText('These metrics measure the size and capacity of your operation.\n\n' +
        'Enter the values for the time period you selected above.');

    for (const kpi of volumeKPIs) {
      createFormQuestion(form, kpi);
    }
  }

  // ---- Section 3: Efficiency Metrics ----
  const efficiencyKPIs = inputKPIs.filter(k => k.category === 'efficiency');

  if (efficiencyKPIs.length > 0) {
    form.addPageBreakItem()
      .setTitle('Efficiency Metrics')
      .setHelpText('These metrics measure how well you perform relative to your capacity.\n\n' +
        'Leave blank if you don\'t know or track this metric.');

    for (const kpi of efficiencyKPIs) {
      createFormQuestion(form, kpi);
    }
  }

  // ---- Section 4: Additional Information ----
  form.addPageBreakItem()
    .setTitle('Additional Information')
    .setHelpText('Any other information you\'d like to share.');

  form.addParagraphTextItem()
    .setTitle('Notes or Comments')
    .setRequired(false)
    .setHelpText('Anything else we should know about your business or this data?');
}

/**
 * Create appropriate form question based on KPI definition
 * @param {GoogleAppsScript.Forms.Form} form
 * @param {Object} kpi
 * @returns {GoogleAppsScript.Forms.Item}
 */
function createFormQuestion(form, kpi) {
  const item = form.addTextItem()
    .setTitle(kpi.name)
    .setRequired(kpi.required)
    .setHelpText(kpi.description);

  // Add validation based on data type
  const validation = createValidation(kpi.dataType);

  if (validation) {
    item.setValidation(validation);
  }

  return item;
}

/**
 * Create validation for form question based on data type
 * @param {string} dataType
 * @returns {GoogleAppsScript.Forms.TextValidation|null}
 */
function createValidation(dataType) {
  const textValidation = FormApp.createTextValidation();

  switch (dataType) {
    case DATA_TYPES.INTEGER:
      return textValidation
        .setHelpText('Please enter a whole number')
        .requireWholeNumber()
        .build();

    case DATA_TYPES.NUMBER:
    case DATA_TYPES.CURRENCY:
      return textValidation
        .setHelpText('Please enter a number')
        .requireNumber()
        .build();

    case DATA_TYPES.PERCENTAGE:
      return textValidation
        .setHelpText('Please enter a number between 0 and 100')
        .requireNumberBetween(0, 100)
        .build();

    default:
      return null;
  }
}

// ============================================================================
// FORM MANAGEMENT
// ============================================================================

/**
 * Update existing form to match current Config_KPIs
 * Adds new questions, removes deleted ones, updates text
 */
function syncFormWithConfig() {
  try {
    const formId = getSetting(SETTINGS_KEYS.FORM_ID);

    if (!formId) {
      showAlert('No form found. Please create a form first.');
      return;
    }

    showToast('Syncing form with configuration...', 'Form Manager', 5);

    // For simplicity, we'll recreate the form
    // A more sophisticated version would update in place
    const proceed = showYesNoConfirmation(
      'Sync Form',
      'This will recreate the form with the current KPI configuration.\n\n' +
      'The form URL will remain the same, but all questions will be rebuilt.\n\n' +
      'Continue?'
    );

    if (!proceed) {
      return;
    }

    // Get current form
    const form = FormApp.openById(formId);

    // Remove all items except page breaks
    const items = form.getItems();
    for (const item of items) {
      form.deleteItem(item);
    }

    // Rebuild questions
    const inputKPIs = getInputKPIs();
    buildFormQuestions(form, inputKPIs);

    // Update sync timestamp
    setSetting(SETTINGS_KEYS.LAST_FORM_SYNC, new Date().toISOString());

    showToast('Form synced successfully!', 'Form Manager', 3);
    log('Form synced with config');

  } catch (error) {
    logError('Error syncing form', error);
    showAlert('Error syncing form: ' + error.message);
  }
}

/**
 * Get the shareable form URL
 * @returns {string} Form response URL
 */
function getFormUrl() {
  const url = getSetting(SETTINGS_KEYS.FORM_RESPONSE_URL);

  if (!url) {
    return null;
  }

  return url;
}

/**
 * Show the form URL in a dialog
 */
function showFormUrl() {
  const url = getFormUrl();

  if (!url) {
    showAlert('No form has been created yet.\n\nUse "Form Management → Recreate Form" to create one.');
    return;
  }

  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      h3 { margin-top: 0; }
      .url-box {
        background: #f5f5f5;
        padding: 10px;
        border-radius: 4px;
        word-break: break-all;
        font-family: monospace;
        font-size: 12px;
        margin: 15px 0;
      }
      .buttons { margin-top: 20px; }
      button {
        padding: 8px 16px;
        margin-right: 10px;
        cursor: pointer;
      }
      .primary {
        background: #4285f4;
        color: white;
        border: none;
        border-radius: 4px;
      }
    </style>
    <h3>Client Intake Form</h3>
    <p>Share this link with clients:</p>
    <div class="url-box">${url}</div>
    <div class="buttons">
      <button class="primary" onclick="copyUrl()">Copy Link</button>
      <button onclick="window.open('${url}', '_blank')">Open Form</button>
      <button onclick="google.script.host.close()">Close</button>
    </div>
    <script>
      function copyUrl() {
        navigator.clipboard.writeText('${url}');
        alert('Link copied to clipboard!');
      }
    </script>
  `)
    .setWidth(500)
    .setHeight(250);

  SpreadsheetApp.getUi().showModalDialog(html, 'Form URL');
}

/**
 * Unlink and delete the form
 */
function deleteForm() {
  const formId = getSetting(SETTINGS_KEYS.FORM_ID);

  if (!formId) {
    return;
  }

  try {
    // Remove form trigger
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
      if (trigger.getTriggerSourceId() === formId) {
        ScriptApp.deleteTrigger(trigger);
      }
    }

    // Try to delete the form file
    try {
      DriveApp.getFileById(formId).setTrashed(true);
      log('Form deleted: ' + formId);
    } catch (e) {
      log('Could not delete form file: ' + e.message);
    }

  } catch (error) {
    logError('Error deleting form', error);
  }

  // Clear settings regardless
  setSetting(SETTINGS_KEYS.FORM_ID, '');
  setSetting(SETTINGS_KEYS.FORM_URL, '');
  setSetting(SETTINGS_KEYS.FORM_RESPONSE_URL, '');
}

/**
 * Check if form has any responses
 * @param {string} formId
 * @returns {boolean}
 */
function checkFormHasResponses(formId) {
  try {
    const form = FormApp.openById(formId);
    const responses = form.getResponses();
    return responses.length > 0;
  } catch (e) {
    return false;
  }
}

/**
 * Install form submit trigger
 * @param {string} formId
 */
function installFormTrigger(formId) {
  try {
    // Remove existing form triggers
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
      if (trigger.getHandlerFunction() === 'onFormSubmit') {
        ScriptApp.deleteTrigger(trigger);
      }
    }

    // Create new trigger
    const form = FormApp.openById(formId);
    ScriptApp.newTrigger('onFormSubmit')
      .forForm(form)
      .onFormSubmit()
      .create();

    log('Form trigger installed');

  } catch (error) {
    logError('Error installing form trigger', error);
  }
}

/**
 * Rename the form responses sheet to 'Clients'
 */
function renameFormResponsesSheet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();

    for (const sheet of sheets) {
      const name = sheet.getName();
      if (name.startsWith('Form Responses')) {
        // Check if Clients sheet exists
        const clientsSheet = ss.getSheetByName(SHEET_NAMES.CLIENTS);

        if (clientsSheet) {
          // Copy headers from Clients to form responses (to ensure column mapping)
          const clientHeaders = clientsSheet.getRange(1, 1, 1, clientsSheet.getLastColumn()).getValues()[0];
          const formHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

          // Delete the form responses sheet, keep Clients
          ss.deleteSheet(sheet);
          log('Deleted Form Responses sheet - using existing Clients sheet');
        } else {
          // Rename form responses to Clients
          sheet.setName(SHEET_NAMES.CLIENTS);
          log('Renamed Form Responses to Clients');

          // Add missing columns
          addMissingClientColumns(sheet);
        }

        break;
      }
    }
  } catch (error) {
    logError('Error renaming form responses sheet', error);
  }
}

/**
 * Add missing columns to Clients sheet (client_id, period_days, etc.)
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 */
function addMissingClientColumns(sheet) {
  try {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headersLower = headers.map(h => String(h).toLowerCase());

    const requiredColumns = [
      { name: 'client_id', position: 'first' },
      { name: 'period_days', position: 'after:data_period' },
      { name: 'analysis_status', position: 'last' },
      { name: 'last_analyzed', position: 'last' },
      { name: 'notes', position: 'last' }
    ];

    for (const col of requiredColumns) {
      if (!headersLower.includes(col.name)) {
        // Add column at the end
        const lastCol = sheet.getLastColumn() + 1;
        sheet.getRange(1, lastCol).setValue(col.name);
        log(`Added column: ${col.name}`);
      }
    }

  } catch (error) {
    logError('Error adding missing columns', error);
  }
}

// ============================================================================
// FORM RESPONSE MAPPING
// ============================================================================

/**
 * Map form response columns to expected Clients sheet format
 * This handles the difference between form question titles and KPI IDs
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 */
function mapFormResponseColumns(sheet) {
  // This is called after form submission to ensure columns are properly named

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const kpiConfig = loadKPIConfig();

  const columnMapping = {
    'Company Name': 'company_name',
    'Contact Email': 'contact_email',
    'Industry': 'industry',
    'State/Province': 'state',
    'Data Period': 'data_period',
    'Notes or Comments': 'notes'
  };

  // Add KPI name to ID mappings
  for (const kpi of kpiConfig) {
    columnMapping[kpi.name] = kpi.id;
  }

  // Update headers
  let updated = false;
  const newHeaders = headers.map(h => {
    const mapped = columnMapping[h];
    if (mapped && mapped !== h) {
      updated = true;
      return mapped;
    }
    return h;
  });

  if (updated) {
    sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
    log('Updated column headers to KPI IDs');
  }
}
