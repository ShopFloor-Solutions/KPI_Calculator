/**
 * Triggers.gs
 * Trigger handlers and installation
 *
 * ShopFloor Solutions - Operational KPI Calculator
 */

// ============================================================================
// TRIGGER HANDLERS
// ============================================================================

/**
 * onFormSubmit trigger handler
 * Processes new submission, optionally runs analysis
 * @param {Object} e - Event object from form submission
 */
function onFormSubmit(e) {
  try {
    log('Form submission received');

    // Process the new submission (generate client_id, period_days, etc.)
    const clientId = processNewSubmission(e);

    if (!clientId) {
      log('Could not process form submission');
      return;
    }

    // Send email notification
    sendSubmissionNotification(clientId);

    // Auto-analyze if enabled
    const autoAnalyze = getSetting(SETTINGS_KEYS.AUTO_ANALYZE);

    if (autoAnalyze === true || autoAnalyze === 'TRUE') {
      log('Auto-analyze enabled, running analysis...');

      // Set as active client and run analysis
      setActiveClient(clientId);
      runAnalysis();

      log('Auto-analysis completed for ' + clientId);
    }

    // Show toast notification (may not show if user not viewing sheet)
    try {
      const client = getClientById(clientId);
      const companyName = client ? client.company_name : 'New client';
      showToast(`New submission from ${companyName}`, 'Form Received', 5);
    } catch (toastError) {
      // Toast may fail if no active user session
    }

  } catch (error) {
    logError('Error in onFormSubmit', error);
  }
}

/**
 * Send email notification about new form submission
 * @param {string} clientId
 */
function sendSubmissionNotification(clientId) {
  try {
    const notificationEmail = getSetting(SETTINGS_KEYS.NOTIFICATION_EMAIL);

    if (!notificationEmail) {
      log('No notification email configured');
      return;
    }

    const client = getClientById(clientId);

    if (!client) {
      log('Client not found for notification');
      return;
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const spreadsheetUrl = spreadsheet.getUrl();

    const subject = `New KPI Submission: ${client.company_name}`;

    const body = `
A new client has submitted their operational data.

Company: ${client.company_name}
Industry: ${client.industry || 'Not specified'}
Location: ${client.state || 'Not specified'}
Data Period: ${client.data_period || 'Not specified'}
Submitted: ${formatDate(new Date())}

${getSetting(SETTINGS_KEYS.AUTO_ANALYZE) ? 'Analysis has been automatically run.' : 'Please run analysis manually.'}

View in spreadsheet: ${spreadsheetUrl}

---
ShopFloor Solutions KPI Calculator
    `.trim();

    MailApp.sendEmail({
      to: notificationEmail,
      subject: subject,
      body: body
    });

    log('Notification email sent to ' + notificationEmail);

  } catch (error) {
    logError('Error sending notification email', error);
    // Don't throw - email failure shouldn't break form processing
  }
}

// ============================================================================
// TRIGGER INSTALLATION
// ============================================================================

/**
 * Install all triggers
 * Called during system initialization
 */
function installTriggers() {
  try {
    // Remove existing triggers first to avoid duplicates
    uninstallTriggers();

    // Install onOpen trigger (simple trigger - already handled by function name)
    // Note: Simple triggers like onOpen don't need to be installed

    // Form submit trigger is installed when form is created
    // See FormManager.gs - installFormTrigger()

    log('Triggers installation complete');

  } catch (error) {
    logError('Error installing triggers', error);
  }
}

/**
 * Uninstall all project triggers
 */
function uninstallTriggers() {
  try {
    const triggers = ScriptApp.getProjectTriggers();

    for (const trigger of triggers) {
      ScriptApp.deleteTrigger(trigger);
      log('Deleted trigger: ' + trigger.getHandlerFunction());
    }

  } catch (error) {
    logError('Error uninstalling triggers', error);
  }
}

/**
 * Check if triggers are installed
 * @returns {Object} Status of each trigger type
 */
function getTriggerStatus() {
  const status = {
    formSubmit: false,
    formId: null
  };

  try {
    const triggers = ScriptApp.getProjectTriggers();

    for (const trigger of triggers) {
      const handler = trigger.getHandlerFunction();

      if (handler === 'onFormSubmit') {
        status.formSubmit = true;
        status.formId = trigger.getTriggerSourceId();
      }
    }

  } catch (error) {
    logError('Error getting trigger status', error);
  }

  return status;
}

/**
 * Reinstall form submit trigger if form exists
 */
function reinstallFormTrigger() {
  try {
    const formId = getSetting(SETTINGS_KEYS.FORM_ID);

    if (!formId) {
      log('No form ID found - cannot install form trigger');
      return false;
    }

    // Remove existing form triggers
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
      if (trigger.getHandlerFunction() === 'onFormSubmit') {
        ScriptApp.deleteTrigger(trigger);
      }
    }

    // Install new trigger
    const form = FormApp.openById(formId);
    ScriptApp.newTrigger('onFormSubmit')
      .forForm(form)
      .onFormSubmit()
      .create();

    log('Form trigger reinstalled for form ' + formId);
    return true;

  } catch (error) {
    logError('Error reinstalling form trigger', error);
    return false;
  }
}

// ============================================================================
// SCHEDULED TRIGGERS (Future Use)
// ============================================================================

/**
 * Install daily summary trigger (for future use)
 * Could send daily/weekly summary emails
 */
function installDailySummaryTrigger() {
  try {
    // Remove existing daily trigger
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
      if (trigger.getHandlerFunction() === 'sendDailySummary') {
        ScriptApp.deleteTrigger(trigger);
      }
    }

    // Install new daily trigger at 8 AM
    ScriptApp.newTrigger('sendDailySummary')
      .timeBased()
      .atHour(8)
      .everyDays(1)
      .create();

    log('Daily summary trigger installed');

  } catch (error) {
    logError('Error installing daily summary trigger', error);
  }
}

/**
 * Send daily summary email (for future use)
 * Called by daily trigger
 */
function sendDailySummary() {
  try {
    const notificationEmail = getSetting(SETTINGS_KEYS.NOTIFICATION_EMAIL);

    if (!notificationEmail) {
      return;
    }

    // Get statistics
    const stats = getClientStatistics();

    if (stats.total === 0) {
      return; // No clients, no summary needed
    }

    const pendingCount = stats.byStatus.pending || 0;

    if (pendingCount === 0) {
      return; // No pending items, skip summary
    }

    const subject = `KPI Calculator Daily Summary: ${pendingCount} pending analysis`;

    const body = `
Daily Summary - ShopFloor Solutions KPI Calculator

Total Clients: ${stats.total}
- Pending Analysis: ${pendingCount}
- Completed: ${stats.byStatus.completed || 0}
- Errors: ${stats.byStatus.error || 0}

${pendingCount > 0 ? 'Please review pending clients and run analysis.' : 'All clients have been analyzed.'}

---
This is an automated message from the KPI Calculator.
    `.trim();

    MailApp.sendEmail({
      to: notificationEmail,
      subject: subject,
      body: body
    });

    log('Daily summary email sent');

  } catch (error) {
    logError('Error sending daily summary', error);
  }
}

// ============================================================================
// TRIGGER DIAGNOSTICS
// ============================================================================

/**
 * List all installed triggers (for debugging)
 * @returns {Object[]} Array of trigger info objects
 */
function listAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();

  return triggers.map(trigger => ({
    id: trigger.getUniqueId(),
    handler: trigger.getHandlerFunction(),
    type: trigger.getEventType().toString(),
    source: trigger.getTriggerSource().toString(),
    sourceId: trigger.getTriggerSourceId()
  }));
}

/**
 * Test form trigger (for debugging)
 * Simulates a form submission
 */
function testFormTrigger() {
  log('Testing form trigger...');

  // Create mock event
  const mockEvent = {
    response: {
      getItemResponses: function() {
        return [];
      }
    }
  };

  try {
    // This won't actually process data, but will test the trigger path
    onFormSubmit(mockEvent);
    log('Form trigger test completed');
  } catch (error) {
    logError('Form trigger test failed', error);
  }
}

/**
 * Check if the script has necessary permissions
 * @returns {Object} Permission status
 */
function checkPermissions() {
  const permissions = {
    spreadsheet: false,
    forms: false,
    mail: false,
    triggers: false
  };

  try {
    SpreadsheetApp.getActiveSpreadsheet();
    permissions.spreadsheet = true;
  } catch (e) {
    log('Spreadsheet permission missing');
  }

  try {
    FormApp.getActiveForm(); // May be null but won't throw if permission exists
    permissions.forms = true;
  } catch (e) {
    log('Forms permission missing');
  }

  try {
    MailApp.getRemainingDailyQuota();
    permissions.mail = true;
  } catch (e) {
    log('Mail permission missing');
  }

  try {
    ScriptApp.getProjectTriggers();
    permissions.triggers = true;
  } catch (e) {
    log('Triggers permission missing');
  }

  return permissions;
}
