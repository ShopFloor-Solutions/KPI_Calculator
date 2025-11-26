# Operational KPI Calculator

**ShopFloor Solutions - Trade Business Report Card Tool**

An internal diagnostic tool for analyzing trade business (HVAC, plumbing, roofing, electrical) operational data. It ingests client-provided KPIs, calculates derived metrics, validates data consistency, and generates actionable insights.

## Features

- **Data Collection**: Google Form integration for client data intake
- **KPI Calculation**: Automatic calculation of derived metrics (booking rate, close rate, profit margin, etc.)
- **Data Validation**: Checks for mathematical consistency and flags discrepancies
- **Plain-English Insights**: Generates actionable recommendations based on performance
- **Section Mapping**: Maps KPIs to 9 business sections and 3 operational pillars
- **Configuration-Driven**: Business logic defined in sheets, not hardcoded
- **Multi-Client Support**: Manage and analyze data for multiple clients

## System Architecture

```
Google Sheets (Spreadsheet)
├── Config_KPIs          - Define all metrics
├── Config_Validations   - Define validation rules
├── Config_Sections      - Define business sections
├── Config_Benchmarks    - Define industry benchmarks
├── Clients              - Client data storage
├── Results              - Analysis output
├── Validation_Log       - Validation issues
└── _Settings            - System configuration

Google Forms
└── Client Intake Form   - Data collection

Apps Script Modules
├── Main.gs              - Menu and orchestration
├── Config.gs            - Configuration loading
├── ClientManager.gs     - Client data handling
├── KPIEngine.gs         - KPI calculations
├── ValidationEngine.gs  - Data validation
├── InsightsEngine.gs    - Insight generation
├── ResultsGenerator.gs  - Results output
├── FormManager.gs       - Form management
├── UI.gs                - User interface
├── Triggers.gs          - Automation
└── Utils.gs             - Helper functions
```

## Deployment Instructions

### Step 1: Create a New Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new blank spreadsheet
3. Name it "ShopFloor KPI Calculator"

### Step 2: Open Apps Script Editor

1. In the spreadsheet, go to **Extensions → Apps Script**
2. This opens the script editor in a new tab

### Step 3: Create Script Files

Create each of the following script files by clicking the **+** next to "Files" and selecting "Script":

1. Delete the default `Code.gs` file
2. Create these `.gs` files and paste the contents from `src/`:
   - `Utils.gs`
   - `Config.gs`
   - `Main.gs`
   - `ClientManager.gs`
   - `KPIEngine.gs`
   - `ValidationEngine.gs`
   - `InsightsEngine.gs`
   - `ResultsGenerator.gs`
   - `FormManager.gs`
   - `UI.gs`
   - `Triggers.gs`

### Step 4: Create HTML Files

Create HTML files by clicking **+** → "HTML":

1. `Sidebar.html` - Validation dashboard sidebar
2. `ClientSelector.html` - Client selection dialog

Paste the contents from `src/`.

### Step 5: Save and Authorize

1. Click **Save** (Ctrl+S / Cmd+S)
2. Go back to your spreadsheet and refresh the page
3. You should see a new menu: **ShopFloor Tools**
4. Click any menu item to trigger authorization
5. Follow the prompts to authorize the script

### Step 6: Initialize the System

1. Go to **ShopFloor Tools → Administration → Initialize System**
2. Click "Yes" to confirm
3. This creates all required sheets with sample data

### Step 7: Create the Intake Form

1. Go to **ShopFloor Tools → Form Management → Recreate Form**
2. The form will be created and linked to the spreadsheet
3. Get the shareable URL via **Form Management → Get Form URL**

### Step 8: Test the System

1. Open the form URL and submit test data
2. Go to **ShopFloor Tools → Select Client...** and choose the test submission
3. Click "Select & Analyze" to run analysis
4. View results in the **Results** sheet

## Usage Guide

### Running Analysis

1. **Select Client**: ShopFloor Tools → Select Client...
2. **Run Analysis**: ShopFloor Tools → Run Analysis
3. **View Results**: Check the Results sheet
4. **Review Issues**: ShopFloor Tools → View Validation Dashboard

### Customizing KPIs

Edit the `Config_KPIs` sheet to:
- Add new input metrics (set type = "input")
- Add calculated metrics (set type = "calculated" with formula)
- Change which sections a KPI affects
- Enable/disable KPIs with the "active" column

### Customizing Validations

Edit the `Config_Validations` sheet to:
- Add new validation rules
- Adjust tolerance levels
- Change severity (error/warning/info)
- Customize error messages

### Adding Industry Benchmarks

Edit the `Config_Benchmarks` sheet to:
- Add industry-specific benchmarks
- Use "all" for benchmarks applying to all industries
- Define poor/average/good/excellent thresholds

## Formula Syntax

### KPI Formulas

| Pattern | Example | Description |
|---------|---------|-------------|
| `DIVIDE:a:b` | `DIVIDE:gross_revenue:jobs_closed` | a ÷ b |
| `MULTIPLY:a:b` | `MULTIPLY:jobs_closed:average_ticket` | a × b |
| `SUBTRACT:a:b` | `SUBTRACT:gross_revenue:total_costs` | a - b |
| `ADD:a:b` | `ADD:labor_cost:material_cost` | a + b |
| `PERCENTAGE:a:b` | `PERCENTAGE:net_profit:gross_revenue` | (a ÷ b) × 100 |
| `PER_DAY:a` | `PER_DAY:gross_revenue` | a ÷ period_days |
| `CUSTOM:func` | `CUSTOM:calculateScheduleCapacity` | Call custom function |

### Validation Formulas

| Pattern | Example | Description |
|---------|---------|-------------|
| `RECONCILE:expr:target` | `RECONCILE:leads*rate/100:visits` | Check if expr ≈ target |
| `RANGE:kpi:min:max` | `RANGE:close_rate:0:100` | Check if kpi is in range |
| `GREATER:a:b` | `GREATER:revenue:costs` | Check if a > b |
| `EQUALS:a:b` | `EQUALS:reported:calculated` | Check if a ≈ b |
| `REQUIRES:a:b` | `REQUIRES:visits:leads` | If a exists, b must exist |

## Configuration

### Settings (_Settings sheet)

| Setting | Description |
|---------|-------------|
| `active_client_id` | Currently selected client |
| `form_id` | Linked Google Form ID |
| `auto_analyze` | Auto-run analysis on form submit (TRUE/FALSE) |
| `notification_email` | Email for form submission notifications |

### Notification Email

By default, form submissions notify `info@shopfloorsolutions.ca`. Change this in the `_Settings` sheet.

## Troubleshooting

### Menu Not Appearing
- Refresh the spreadsheet
- Check that all script files are saved without errors
- Try Extensions → Apps Script → Run → onOpen

### Form Not Working
- Ensure form is linked: Form Management → Get Form URL
- Check that form trigger is installed
- Review Execution logs in Apps Script editor

### Analysis Errors
- Check Config_KPIs for valid formulas
- Ensure all referenced KPIs exist
- Run Administration → Validate Configuration

## File Structure

```
KPI_Calculator/
├── README.md
├── operational-kpi-calculator-spec.md
└── src/
    ├── Utils.gs
    ├── Config.gs
    ├── Main.gs
    ├── ClientManager.gs
    ├── KPIEngine.gs
    ├── ValidationEngine.gs
    ├── InsightsEngine.gs
    ├── ResultsGenerator.gs
    ├── FormManager.gs
    ├── UI.gs
    ├── Triggers.gs
    ├── Sidebar.html
    └── ClientSelector.html
```

## Version History

- **1.0** - Initial release
  - Core KPI calculation engine
  - Validation framework
  - Insights generation
  - Google Form integration
  - Multi-client support

## Support

For issues or questions, contact: info@shopfloorsolutions.ca
