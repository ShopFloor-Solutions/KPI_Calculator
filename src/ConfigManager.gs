/**
 * ConfigManager.gs
 * Configuration management UI dialogs
 *
 * ShopFloor Solutions - Operational KPI Calculator
 */

// ============================================================================
// KPI EDITOR
// ============================================================================

/**
 * Show the KPI Editor dialog
 */
function showKPIEditor() {
  const html = HtmlService.createHtmlOutputFromFile('KPIEditor')
    .setWidth(800)
    .setHeight(600);

  SpreadsheetApp.getUi().showModalDialog(html, 'KPI Configuration Editor');
}

/**
 * Get KPI data for editor
 * Called from KPIEditor.html
 * @returns {Object} {kpis, categories, dataTypes}
 */
function getKPIEditorData() {
  try {
    const kpis = loadKPIConfig();
    const sections = loadSectionConfig();

    return {
      kpis: kpis,
      sections: sections,
      categories: ['volume', 'efficiency'],
      dataTypes: Object.values(DATA_TYPES),
      types: ['input', 'calculated']
    };
  } catch (error) {
    logError('Error getting KPI editor data', error);
    return { error: error.message };
  }
}

/**
 * Save KPI configuration
 * Called from KPIEditor.html
 * @param {Object[]} kpis - Array of KPI objects
 * @returns {Object} {success: boolean, error?: string}
 */
function saveKPIConfig(kpis) {
  try {
    const sheet = getRequiredSheet(SHEET_NAMES.CONFIG_KPIS);

    const headers = [
      'kpi_id', 'name', 'description', 'category', 'type', 'data_type',
      'formula', 'sections', 'pillar', 'required', 'form_order', 'active'
    ];

    // Convert KPI objects to rows
    const rows = kpis.map(kpi => [
      kpi.id,
      kpi.name,
      kpi.description,
      kpi.category,
      kpi.type,
      kpi.dataType,
      kpi.formula || '',
      Array.isArray(kpi.sections) ? kpi.sections.join(',') : kpi.sections,
      kpi.pillar || 1,
      kpi.required || false,
      kpi.formOrder || 999,
      kpi.active !== false
    ]);

    // Clear and write
    sheet.clearContents();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }

    // Format header row
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#4285f4')
      .setFontColor('#ffffff');

    sheet.setFrozenRows(1);

    log('Saved KPI configuration');
    return { success: true };

  } catch (error) {
    logError('Error saving KPI config', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// BENCHMARK EDITOR
// ============================================================================

/**
 * Show the Benchmark Editor dialog
 */
function showBenchmarkEditor() {
  const html = HtmlService.createHtmlOutputFromFile('BenchmarkEditor')
    .setWidth(800)
    .setHeight(600);

  SpreadsheetApp.getUi().showModalDialog(html, 'Benchmark Configuration Editor');
}

/**
 * Get benchmark data for editor
 * Called from BenchmarkEditor.html
 * @returns {Object} {benchmarks, kpiOptions, industryOptions, stateOptions}
 */
function getBenchmarkEditorData() {
  try {
    const benchmarks = loadBenchmarkConfig();
    const kpis = loadKPIConfig();

    return {
      benchmarks: benchmarks,
      kpiOptions: kpis.map(k => ({ id: k.id, name: k.name })),
      industryOptions: ['all', ...INDUSTRIES.map(i => i.toLowerCase())],
      stateOptions: ['all', ...STATES_PROVINCES.map(s => s.toLowerCase())]
    };
  } catch (error) {
    logError('Error getting benchmark editor data', error);
    return { error: error.message };
  }
}

/**
 * Save benchmark configuration
 * Called from BenchmarkEditor.html
 * @param {Object[]} benchmarks - Array of benchmark objects
 * @returns {Object} {success: boolean, error?: string}
 */
function saveBenchmarkConfig(benchmarks) {
  try {
    const sheet = getRequiredSheet(SHEET_NAMES.CONFIG_BENCHMARKS);

    const headers = ['kpi_id', 'industry', 'state', 'poor', 'average', 'good', 'excellent', 'notes'];

    // Convert benchmark objects to rows
    const rows = benchmarks.map(b => [
      b.kpiId,
      b.industry || 'all',
      b.state || 'all',
      b.poor,
      b.average,
      b.good,
      b.excellent,
      b.notes || ''
    ]);

    // Clear and write
    sheet.clearContents();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }

    // Format header row
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#4285f4')
      .setFontColor('#ffffff');

    sheet.setFrozenRows(1);

    log('Saved benchmark configuration');
    return { success: true };

  } catch (error) {
    logError('Error saving benchmark config', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// VALIDATION RULE EDITOR
// ============================================================================

/**
 * Show the Validation Rule Editor dialog
 */
function showValidationEditor() {
  const html = HtmlService.createHtmlOutputFromFile('ValidationEditor')
    .setWidth(800)
    .setHeight(600);

  SpreadsheetApp.getUi().showModalDialog(html, 'Validation Rules Editor');
}

/**
 * Get validation data for editor
 * Called from ValidationEditor.html
 * @returns {Object} {validations, kpiOptions, severityOptions, typeOptions}
 */
function getValidationEditorData() {
  try {
    const validations = loadValidationConfig();
    const kpis = loadKPIConfig();

    return {
      validations: validations,
      kpiOptions: kpis.map(k => ({ id: k.id, name: k.name })),
      severityOptions: Object.values(SEVERITY_LEVELS),
      typeOptions: ['reconciliation', 'range', 'dependency', 'ratio']
    };
  } catch (error) {
    logError('Error getting validation editor data', error);
    return { error: error.message };
  }
}

/**
 * Save validation configuration
 * Called from ValidationEditor.html
 * @param {Object[]} validations - Array of validation rule objects
 * @returns {Object} {success: boolean, error?: string}
 */
function saveValidationConfig(validations) {
  try {
    const sheet = getRequiredSheet(SHEET_NAMES.CONFIG_VALIDATIONS);

    const headers = [
      'rule_id', 'name', 'description', 'type', 'formula',
      'tolerance', 'severity', 'message', 'affected_kpis', 'active'
    ];

    // Convert validation objects to rows
    const rows = validations.map(v => [
      v.id,
      v.name,
      v.description,
      v.type,
      v.formula,
      v.tolerance || 0,
      v.severity || 'warning',
      v.message,
      Array.isArray(v.affectedKPIs) ? v.affectedKPIs.join(',') : v.affectedKPIs,
      v.active !== false
    ]);

    // Clear and write
    sheet.clearContents();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }

    // Format header row
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#4285f4')
      .setFontColor('#ffffff');

    sheet.setFrozenRows(1);

    log('Saved validation configuration');
    return { success: true };

  } catch (error) {
    logError('Error saving validation config', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// SECTION EDITOR
// ============================================================================

/**
 * Show the Section Editor dialog
 */
function showSectionEditor() {
  const html = HtmlService.createHtmlOutputFromFile('SectionEditor')
    .setWidth(700)
    .setHeight(500);

  SpreadsheetApp.getUi().showModalDialog(html, 'Section Configuration Editor');
}

/**
 * Get section data for editor
 * Called from SectionEditor.html
 * @returns {Object} {sections, pillarOptions}
 */
function getSectionEditorData() {
  try {
    const sections = loadSectionConfig();

    return {
      sections: sections,
      pillarOptions: [
        { id: 1, name: 'Operational Visibility' },
        { id: 2, name: 'Operational Standardization' },
        { id: 3, name: 'Capacity & Growth Readiness' }
      ]
    };
  } catch (error) {
    logError('Error getting section editor data', error);
    return { error: error.message };
  }
}

/**
 * Save section configuration
 * Called from SectionEditor.html
 * @param {Object[]} sections - Array of section objects
 * @returns {Object} {success: boolean, error?: string}
 */
function saveSectionConfig(sections) {
  try {
    const sheet = getRequiredSheet(SHEET_NAMES.CONFIG_SECTIONS);

    const headers = ['section_id', 'section_name', 'section_description', 'pillar_id', 'pillar_name'];

    // Convert section objects to rows
    const rows = sections.map(s => [
      s.sectionId,
      s.sectionName,
      s.sectionDescription,
      s.pillarId,
      s.pillarName
    ]);

    // Clear and write
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }

    // Delete extra rows to keep sheet clean
    const lastDataRow = rows.length + 1;
    const maxRows = sheet.getMaxRows();
    if (maxRows > lastDataRow) {
      sheet.deleteRows(lastDataRow + 1, maxRows - lastDataRow);
    }

    // Format header row
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#4285f4')
      .setFontColor('#ffffff');

    sheet.setFrozenRows(1);

    log('Saved section configuration');
    return { success: true };

  } catch (error) {
    logError('Error saving section config', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// CONFIG EXPORT/IMPORT
// ============================================================================

/**
 * Export all configuration to JSON
 * @returns {string} JSON string
 */
function exportAllConfig() {
  try {
    const config = {
      version: getSetting(SETTINGS_KEYS.VERSION),
      exportedAt: new Date().toISOString(),
      kpis: loadKPIConfig(),
      validations: loadValidationConfig(),
      sections: loadSectionConfig(),
      benchmarks: loadBenchmarkConfig()
    };

    return JSON.stringify(config, null, 2);

  } catch (error) {
    logError('Error exporting config', error);
    throw error;
  }
}

/**
 * Show export config dialog
 */
function showExportConfig() {
  try {
    const configJson = exportAllConfig();

    const html = HtmlService.createHtmlOutput(`
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h3 { margin-top: 0; color: #1a237e; }
        textarea { width: 100%; height: 300px; font-family: monospace; font-size: 12px; }
        .buttons { margin-top: 15px; }
        button { padding: 8px 16px; margin-right: 10px; cursor: pointer; }
        .primary { background: #4285f4; color: white; border: none; border-radius: 4px; }
      </style>
      <h3>Export Configuration</h3>
      <p>Copy this JSON to save your configuration:</p>
      <textarea id="config" readonly>${configJson.replace(/</g, '&lt;')}</textarea>
      <div class="buttons">
        <button class="primary" onclick="copyConfig()">Copy to Clipboard</button>
        <button onclick="google.script.host.close()">Close</button>
      </div>
      <script>
        function copyConfig() {
          document.getElementById('config').select();
          document.execCommand('copy');
          alert('Configuration copied to clipboard!');
        }
      </script>
    `)
      .setWidth(600)
      .setHeight(450);

    SpreadsheetApp.getUi().showModalDialog(html, 'Export Configuration');

  } catch (error) {
    showAlert('Error exporting configuration: ' + error.message);
  }
}
