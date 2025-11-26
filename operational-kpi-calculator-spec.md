# Operational KPI Calculator — System Architecture Specification

**Project**: ShopFloor Solutions - Trade Business Report Card Tool  
**Version**: 1.0  
**Date**: November 26, 2025  
**Author**: System Architect  
**Target Platform**: Google Apps Script + Google Sheets + Google Forms

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Context](#2-business-context)
3. [System Overview](#3-system-overview)
4. [Data Model](#4-data-model)
5. [Sheet Specifications](#5-sheet-specifications)
6. [Script Module Specifications](#6-script-module-specifications)
7. [KPI Engine Logic](#7-kpi-engine-logic)
8. [Validation Engine Logic](#8-validation-engine-logic)
9. [Insights Engine Logic](#9-insights-engine-logic)
10. [Google Form Integration](#10-google-form-integration)
11. [User Interface Specifications](#11-user-interface-specifications)
12. [Trigger Configuration](#12-trigger-configuration)
13. [Error Handling](#13-error-handling)
14. [Testing Scenarios](#14-testing-scenarios)
15. [Future Considerations](#15-future-considerations)
16. [Appendix: KPI Reference](#appendix-a-kpi-reference)
17. [Appendix: Validation Rules Reference](#appendix-b-validation-rules-reference)

---

## 1. Executive Summary

### Purpose
This system is an internal diagnostic tool for ShopFloor Solutions to analyze trade business (HVAC, plumbing, roofing, electrical) operational data. It ingests client-provided KPIs, calculates derived metrics, validates data consistency, and generates actionable insights.

### Key Objectives
1. **Validate client data** — Ensure reported numbers are mathematically consistent
2. **Calculate derived KPIs** — Compute rates, margins, and efficiency metrics from raw inputs
3. **Identify problem areas** — Flag where the business needs improvement
4. **Map to business sections** — Connect KPIs to the 9 operational areas and 3 service pillars
5. **Support multiple clients** — Manage data for many clients over time
6. **Enable iteration** — Configuration-driven design allows KPI/validation changes without code rewrites

### Design Principles
- **Configuration over code**: Business logic defined in sheets, not hardcoded
- **Modularity**: Each script file has a single responsibility
- **Non-technical user friendly**: Robert/Alex can modify KPIs and rules without coding
- **Fail gracefully**: Missing data should not crash the system; flag and continue

---

## 2. Business Context

### The Problem Being Solved
Trade business owners often don't know their key operational metrics. When they do report numbers, those numbers frequently don't reconcile (e.g., claiming a 50% close rate but the math shows 10%). This tool:

1. Collects raw business data via a form
2. Calculates metrics the owner may not know (booking rate, scheduling efficiency, etc.)
3. Validates that reported numbers are mathematically possible
4. Translates findings into plain-English insights
5. Maps problems to specific areas of the business

### The Three Pillars Framework
ShopFloor Solutions organizes trade business operations into three pillars:

| Pillar | Focus | Description |
|--------|-------|-------------|
| **Pillar 1: Operational Visibility** | Know what's happening | Marketing attribution, sales performance, KPIs, data insights |
| **Pillar 2: Operational Standardization** | Do it consistently | SOPs, processes, training, quality control |
| **Pillar 3: Capacity & Growth Readiness** | Scale effectively | Volume, hiring, equipment, expansion |

### The Nine Business Sections
Each pillar connects to these operational areas:

| Section | Name | Description |
|---------|------|-------------|
| 1 | Marketing | Lead generation, advertising, brand |
| 2 | CSR/Call Center | Booking, customer intake, call handling |
| 3 | Sales | In-home visits, closing, proposals |
| 4 | Field Operations | Technicians, installs, service delivery |
| 5 | Scheduling/Dispatch | Job assignment, routing, capacity |
| 6 | Inventory/Warehouse | Parts, materials, truck stock |
| 7 | Finance/Accounting | Cash flow, invoicing, collections |
| 8 | HR/Training | Hiring, onboarding, skill development |
| 9 | Management/Leadership | Oversight, strategy, decision-making |

### KPI Categories
KPIs are divided into two categories per Robert's framework:

**Volume (Growth)** — What are you physically capable of doing?
- Number of employees
- Schedule capacity (man-hours)
- Lead volume
- Equipment/vehicles
- Gross revenue

**Efficiency (Doing Better)** — How well do you do it?
- Booking rate
- Close rate
- Scheduling efficiency
- Revenue per crew/vehicle per day
- EBITDA
- Profit margin

---

## 3. System Overview

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         GOOGLE SHEETS                                │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │ Config_KPIs │  │Config_Validations│  │ Config_Sections │          │
│  │             │  │                 │  │                 │          │
│  │ Define all  │  │ Define math     │  │ Define 9 sections│         │
│  │ metrics     │  │ validation rules│  │ and 3 pillars   │          │
│  └──────┬──────┘  └────────┬────────┘  └────────┬────────┘          │
│         │                  │                    │                    │
│         └──────────────────┼────────────────────┘                    │
│                            │                                         │
│                            ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                      SCRIPT ENGINE                           │    │
│  │  ┌──────────┐ ┌──────────────┐ ┌──────────────────────────┐ │    │
│  │  │  Config  │ │  KPI Engine  │ │   Validation Engine      │ │    │
│  │  │  Loader  │ │  (Calculate) │ │   (Check Consistency)    │ │    │
│  │  └────┬─────┘ └──────┬───────┘ └────────────┬─────────────┘ │    │
│  │       │              │                      │                │    │
│  │       │              ▼                      ▼                │    │
│  │       │       ┌──────────────┐    ┌─────────────────┐       │    │
│  │       │       │   Results    │    │  Validation_Log │       │    │
│  │       │       │  Generator   │    │    Generator    │       │    │
│  │       │       └──────┬───────┘    └────────┬────────┘       │    │
│  │       │              │                     │                 │    │
│  │       │              ▼                     ▼                 │    │
│  │       │       ┌───────────────────────────────────┐         │    │
│  │       │       │        Insights Engine            │         │    │
│  │       │       │   (Plain-English Findings)        │         │    │
│  │       │       └───────────────────────────────────┘         │    │
│  └───────┼──────────────────────────────────────────────────────┘    │
│          │                                                           │
│          ▼                                                           │
│  ┌───────────────┐  ┌──────────────┐  ┌─────────────────────┐       │
│  │   Clients     │  │   Results    │  │   Validation_Log    │       │
│  │  (All data)   │  │ (Active)     │  │   (Active)          │       │
│  └───────────────┘  └──────────────┘  └─────────────────────┘       │
│          ▲                                                           │
│          │                                                           │
│  ┌───────┴───────┐                                                  │
│  │ Google Form   │◄──── Client submits data                         │
│  └───────────────┘                                                  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE                             │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌─────────────────┐  ┌────────────────────┐  │
│  │ Custom Menu      │  │ Sidebar         │  │ Dialog             │  │
│  │ "ShopFloor Tools"│  │ (Validation     │  │ (Client Selector)  │  │
│  │                  │  │  Dashboard)     │  │                    │  │
│  │ • Select Client  │  │                 │  │                    │  │
│  │ • Run Analysis   │  │ • Status        │  │ • Dropdown list    │  │
│  │ • View Validation│  │ • Issues list   │  │ • Confirm button   │  │
│  │ • Export Results │  │ • Suggestions   │  │                    │  │
│  │ • Create Form    │  │                 │  │                    │  │
│  └──────────────────┘  └─────────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### File Structure

```
Project Root (Google Sheets bound script)
│
├── Main.gs                 # Entry points, menu creation, orchestration
├── Config.gs               # Configuration loading and parsing
├── FormManager.gs          # Google Form creation and linking
├── ClientManager.gs        # Client CRUD operations
├── KPIEngine.gs            # Derived KPI calculations
├── ValidationEngine.gs     # Data validation logic
├── InsightsEngine.gs       # Plain-English insight generation
├── ResultsGenerator.gs     # Results sheet population
├── UI.gs                   # Sidebar and dialog management
├── Triggers.gs             # onOpen, onFormSubmit handlers
├── Utils.gs                # Helper functions
│
├── Sidebar.html            # Validation dashboard sidebar
├── ClientSelector.html     # Client picker modal dialog
└── Stylesheet.html         # Shared CSS (include in other HTML)
```

---

## 4. Data Model

### Core Entities

#### Client
Represents a single client submission/snapshot.

```javascript
{
  id: string,              // Unique identifier (timestamp-based)
  companyName: string,
  industry: string,        // "roofing" | "hvac" | "plumbing" | "electrical" | "general"
  state: string,           // US state or Canadian province
  dataPeriod: string,      // "monthly" | "quarterly" | "annual"
  submittedAt: Date,
  rawInputs: {             // Key-value pairs of raw KPI inputs
    [kpiId: string]: number | null
  },
  calculatedKPIs: {        // Populated after analysis
    [kpiId: string]: number | null
  },
  validationStatus: string, // "valid" | "warnings" | "errors"
  validationIssues: ValidationIssue[]
}
```

#### KPI Definition
Defines a single KPI (raw input or calculated).

```javascript
{
  id: string,              // Unique identifier (snake_case)
  name: string,            // Display name
  description: string,     // Help text for form/user
  category: string,        // "volume" | "efficiency"
  type: string,            // "input" | "calculated"
  dataType: string,        // "currency" | "percentage" | "number" | "integer"
  formula: string | null,  // Calculation recipe (null for inputs)
  sections: number[],      // Related business sections [1-9]
  pillar: number,          // Primary pillar [1-3]
  required: boolean,       // Is this required for analysis?
  formOrder: number        // Order in form (inputs only)
}
```

#### Validation Rule
Defines a consistency check.

```javascript
{
  id: string,              // Unique identifier
  name: string,            // Display name
  description: string,     // What this checks
  type: string,            // "reconciliation" | "range" | "dependency" | "ratio"
  formula: string,         // Validation expression
  tolerance: number,       // Acceptable variance (e.g., 0.10 for 10%)
  severity: string,        // "error" | "warning" | "info"
  message: string,         // User-facing message when triggered
  affectedKPIs: string[]   // KPI IDs involved
}
```

#### Validation Issue
Result of a failed validation.

```javascript
{
  ruleId: string,
  ruleName: string,
  severity: string,
  message: string,
  expected: number | null,
  actual: number | null,
  variance: number | null,
  affectedKPIs: string[]
}
```

### Formula Expression Syntax

To allow non-technical configuration of calculated KPIs, use a simple expression syntax:

| Pattern | Example | Description |
|---------|---------|-------------|
| `DIVIDE:a:b` | `DIVIDE:in_home_visits:total_leads` | a ÷ b |
| `MULTIPLY:a:b` | `MULTIPLY:jobs_closed:average_ticket` | a × b |
| `SUBTRACT:a:b` | `SUBTRACT:gross_revenue:total_costs` | a - b |
| `ADD:a:b` | `ADD:labor_cost:material_cost` | a + b |
| `PERCENTAGE:a:b` | `PERCENTAGE:net_profit:gross_revenue` | (a ÷ b) × 100 |
| `PER_DAY:a:period` | `PER_DAY:gross_revenue:period` | Normalize to daily based on period |
| `PER_VEHICLE:a:b` | `PER_VEHICLE:gross_revenue:num_vehicles` | a ÷ b |
| `CAPACITY:employees:hours:days` | `CAPACITY:num_techs:8:5` | employees × hours × days |

Complex formulas can be chained or, if too complex, flagged as `CUSTOM:function_name` which requires a code implementation.

### Validation Expression Syntax

| Pattern | Example | Description |
|---------|---------|-------------|
| `EQUALS:a:b` | `EQUALS:reported_close_rate:calculated_close_rate` | a should equal b |
| `RECONCILE:a*b:c` | `RECONCILE:total_leads*booking_rate:in_home_visits` | a×b should equal c |
| `RANGE:a:min:max` | `RANGE:close_rate:0:100` | a should be between min and max |
| `GREATER:a:b` | `GREATER:gross_revenue:total_costs` | a should be > b (else losing money) |
| `REQUIRES:a:b` | `REQUIRES:booking_rate:total_leads` | If a exists, b must exist |

---

## 5. Sheet Specifications

### 5.1 Config_KPIs

**Purpose**: Define all KPIs (both raw inputs and calculated metrics)

**Columns**:

| Column | Header | Type | Description |
|--------|--------|------|-------------|
| A | `kpi_id` | String | Unique identifier (snake_case, e.g., `total_leads`) |
| B | `name` | String | Display name (e.g., "Total Leads") |
| C | `description` | String | Help text shown on form |
| D | `category` | String | `volume` or `efficiency` |
| E | `type` | String | `input` or `calculated` |
| F | `data_type` | String | `currency`, `percentage`, `number`, `integer` |
| G | `formula` | String | Calculation recipe (blank for inputs) |
| H | `sections` | String | Comma-separated section numbers (e.g., "1,2,3") |
| I | `pillar` | Integer | Primary pillar (1, 2, or 3) |
| J | `required` | Boolean | TRUE/FALSE |
| K | `form_order` | Integer | Display order in form (inputs only) |
| L | `active` | Boolean | TRUE to include, FALSE to disable |

**Sample Data**:

```
kpi_id              | name                    | description                                      | category   | type       | data_type  | formula                                    | sections | pillar | required | form_order | active
--------------------|-------------------------|--------------------------------------------------|------------|------------|------------|--------------------------------------------|----------|--------|----------|------------|-------
total_leads         | Total Leads             | Number of leads generated in the period          | volume     | input      | integer    |                                            | 1        | 1      | TRUE     | 1          | TRUE
in_home_visits      | In-Home Visits          | Number of in-home sales appointments             | volume     | input      | integer    |                                            | 2,3      | 1      | TRUE     | 2          | TRUE
jobs_closed         | Jobs Closed             | Number of jobs sold/closed                       | volume     | input      | integer    |                                            | 3        | 1      | TRUE     | 3          | TRUE
gross_revenue       | Gross Revenue           | Total revenue for the period                     | volume     | input      | currency   |                                            | 7        | 1      | TRUE     | 4          | TRUE
total_costs         | Total Costs             | Total operating costs for the period             | volume     | input      | currency   |                                            | 7        | 1      | TRUE     | 5          | TRUE
num_employees       | Number of Employees     | Total employees                                  | volume     | input      | integer    |                                            | 8        | 3      | FALSE    | 6          | TRUE
num_techs           | Number of Technicians   | Field technicians/installers                     | volume     | input      | integer    |                                            | 4,8      | 3      | FALSE    | 7          | TRUE
num_vehicles        | Number of Vehicles      | Service vehicles/trucks                          | volume     | input      | integer    |                                            | 5,6      | 3      | FALSE    | 8          | TRUE
hours_scheduled     | Hours Scheduled         | Total man-hours scheduled to jobs                | volume     | input      | number     |                                            | 5        | 2      | FALSE    | 9          | TRUE
average_ticket      | Average Ticket          | Average revenue per job                          | efficiency | input      | currency   |                                            | 3        | 1      | FALSE    | 10         | TRUE
reported_close_rate | Reported Close Rate     | Close rate as reported by client (%)             | efficiency | input      | percentage |                                            | 3        | 1      | FALSE    | 11         | TRUE
reported_booking_rate| Reported Booking Rate  | Booking rate as reported by client (%)           | efficiency | input      | percentage |                                            | 2        | 1      | FALSE    | 12         | TRUE
booking_rate        | Booking Rate            | Calculated: In-home visits ÷ Total leads × 100   | efficiency | calculated | percentage | PERCENTAGE:in_home_visits:total_leads      | 1,2      | 1      | FALSE    |            | TRUE
close_rate          | Close Rate              | Calculated: Jobs closed ÷ In-home visits × 100   | efficiency | calculated | percentage | PERCENTAGE:jobs_closed:in_home_visits      | 3        | 1      | FALSE    |            | TRUE
net_profit          | Net Profit              | Calculated: Gross revenue - Total costs          | efficiency | calculated | currency   | SUBTRACT:gross_revenue:total_costs         | 7        | 1      | FALSE    |            | TRUE
profit_margin       | Profit Margin           | Calculated: Net profit ÷ Gross revenue × 100     | efficiency | calculated | percentage | PERCENTAGE:net_profit:gross_revenue        | 7        | 1      | FALSE    |            | TRUE
schedule_capacity   | Schedule Capacity       | Calculated: Techs × 8 hours × days in period     | volume     | calculated | number     | CUSTOM:calculateScheduleCapacity           | 5        | 3      | FALSE    |            | TRUE
schedule_efficiency | Schedule Efficiency     | Calculated: Hours scheduled ÷ Capacity × 100     | efficiency | calculated | percentage | PERCENTAGE:hours_scheduled:schedule_capacity| 5       | 2      | FALSE    |            | TRUE
revenue_per_vehicle | Revenue Per Vehicle     | Calculated: Gross revenue ÷ Number of vehicles   | efficiency | calculated | currency   | DIVIDE:gross_revenue:num_vehicles          | 5        | 2      | FALSE    |            | TRUE
calculated_avg_ticket| Calculated Avg Ticket  | Calculated: Gross revenue ÷ Jobs closed          | efficiency | calculated | currency   | DIVIDE:gross_revenue:jobs_closed           | 3        | 1      | FALSE    |            | TRUE
```

### 5.2 Config_Validations

**Purpose**: Define validation rules for data consistency checks

**Columns**:

| Column | Header | Type | Description |
|--------|--------|------|-------------|
| A | `rule_id` | String | Unique identifier |
| B | `name` | String | Display name |
| C | `description` | String | What this rule checks |
| D | `type` | String | `reconciliation`, `range`, `dependency`, `ratio` |
| E | `formula` | String | Validation expression |
| F | `tolerance` | Number | Acceptable variance (0.10 = 10%) |
| G | `severity` | String | `error`, `warning`, `info` |
| H | `message` | String | User-facing message when triggered |
| I | `affected_kpis` | String | Comma-separated KPI IDs involved |
| J | `active` | Boolean | TRUE to enable |

**Sample Data**:

```
rule_id                | name                        | description                                                | type           | formula                                                      | tolerance | severity | message                                                                                           | affected_kpis                              | active
-----------------------|-----------------------------|------------------------------------------------------------|----------------|--------------------------------------------------------------|-----------|----------|---------------------------------------------------------------------------------------------------|--------------------------------------------|-------
booking_rate_reconcile | Booking Rate Reconciliation | Check if booking rate matches leads vs visits              | reconciliation | RECONCILE:total_leads*booking_rate/100:in_home_visits        | 0.10      | error    | Your reported booking rate doesn't match your leads and visits. Expected {expected}, got {actual}. | total_leads,booking_rate,in_home_visits    | TRUE
close_rate_reconcile   | Close Rate Reconciliation   | Check if close rate matches visits vs jobs                 | reconciliation | RECONCILE:in_home_visits*close_rate/100:jobs_closed          | 0.10      | error    | Your close rate doesn't reconcile with your visits and jobs closed.                               | in_home_visits,close_rate,jobs_closed      | TRUE
revenue_reconcile      | Revenue Reconciliation      | Check if revenue matches jobs × ticket                     | reconciliation | RECONCILE:jobs_closed*average_ticket:gross_revenue           | 0.15      | warning  | Your revenue doesn't match jobs × average ticket. You may have missing job data.                  | jobs_closed,average_ticket,gross_revenue   | TRUE
profit_positive        | Profit Should Be Positive   | Revenue should exceed costs                                | range          | GREATER:gross_revenue:total_costs                            | 0         | warning  | Your costs exceed your revenue. You're operating at a loss.                                       | gross_revenue,total_costs                  | TRUE
close_rate_range       | Close Rate Realistic        | Close rate should be between 0-100%                        | range          | RANGE:close_rate:0:100                                       | 0         | error    | Close rate must be between 0% and 100%.                                                           | close_rate                                 | TRUE
booking_rate_range     | Booking Rate Realistic      | Booking rate should be between 0-100%                      | range          | RANGE:booking_rate:0:100                                     | 0         | error    | Booking rate must be between 0% and 100%.                                                         | booking_rate                               | TRUE
schedule_efficiency_range | Schedule Efficiency Range | Schedule efficiency typically 0-120%                       | range          | RANGE:schedule_efficiency:0:150                              | 0         | warning  | Schedule efficiency over 100% means overtime. Over 150% is unusual.                               | schedule_efficiency                        | TRUE
avg_ticket_match       | Average Ticket Match        | Reported vs calculated average ticket                      | reconciliation | EQUALS:average_ticket:calculated_avg_ticket                  | 0.15      | info     | Your reported average ticket differs from calculated. Using calculated value.                     | average_ticket,calculated_avg_ticket       | TRUE
has_leads_for_visits   | Leads Required for Visits   | Can't have visits without leads                            | dependency     | REQUIRES:in_home_visits:total_leads                          | 0         | error    | You reported in-home visits but no leads. Where did these visits come from?                       | in_home_visits,total_leads                 | TRUE
has_visits_for_jobs    | Visits Required for Jobs    | Can't close jobs without visits (usually)                  | dependency     | REQUIRES:jobs_closed:in_home_visits                          | 0         | warning  | You reported closed jobs but no in-home visits. Is this phone sales only?                         | jobs_closed,in_home_visits                 | TRUE
```

### 5.3 Config_Sections

**Purpose**: Define the 9 business sections and 3 pillars with their descriptions

**Columns**:

| Column | Header | Type | Description |
|--------|--------|------|-------------|
| A | `section_id` | Integer | 1-9 |
| B | `section_name` | String | Display name |
| C | `section_description` | String | What this section covers |
| D | `pillar_id` | Integer | Primary pillar (1-3) |
| E | `pillar_name` | String | Pillar display name |

**Sample Data**:

```
section_id | section_name        | section_description                           | pillar_id | pillar_name
-----------|---------------------|-----------------------------------------------|-----------|---------------------------
1          | Marketing           | Lead generation, advertising, brand awareness | 1         | Operational Visibility
2          | CSR/Call Center     | Call handling, booking, customer intake       | 1         | Operational Visibility
3          | Sales               | In-home visits, proposals, closing            | 1         | Operational Visibility
4          | Field Operations    | Technicians, installs, service delivery       | 2         | Operational Standardization
5          | Scheduling/Dispatch | Job assignment, routing, capacity management  | 2         | Operational Standardization
6          | Inventory/Warehouse | Parts, materials, truck stock                 | 2         | Operational Standardization
7          | Finance/Accounting  | Cash flow, invoicing, collections, reporting  | 1         | Operational Visibility
8          | HR/Training         | Hiring, onboarding, skill development         | 3         | Capacity & Growth Readiness
9          | Management          | Oversight, strategy, decision-making          | 3         | Capacity & Growth Readiness
```

### 5.4 Clients

**Purpose**: Store all client submissions (form responses land here)

**Columns**:

| Column | Header | Type | Description |
|--------|--------|------|-------------|
| A | `client_id` | String | Unique ID (auto-generated) |
| B | `timestamp` | DateTime | Submission timestamp |
| C | `company_name` | String | Client company name |
| D | `contact_email` | String | Contact email |
| E | `industry` | String | Business type |
| F | `state` | String | Location |
| G | `data_period` | String | Period type (monthly/quarterly/annual) |
| H | `period_days` | Integer | Days in period (calculated from data_period) |
| I+ | `[kpi_id]` | Various | One column per input KPI from Config_KPIs |
| LAST-2 | `analysis_status` | String | `pending`, `completed`, `error` |
| LAST-1 | `last_analyzed` | DateTime | When analysis was last run |
| LAST | `notes` | String | Internal notes |

**Notes**:
- Columns H onwards are dynamically generated based on Config_KPIs (input type only)
- The form populates columns A-G plus all KPI columns
- `client_id` is generated as: `[timestamp]_[sanitized_company_name]`
- `period_days` is auto-calculated: monthly=30, quarterly=90, annual=365

### 5.5 Results

**Purpose**: Display analysis results for the currently selected client

**Structure**: This sheet is regenerated each time analysis runs. It does NOT store historical data (that's in Clients).

**Layout**:

```
Row 1: Header - "OPERATIONAL KPI ANALYSIS"
Row 2: Client info - "{Company Name} | {Industry} | {State} | {Period}"
Row 3: Analysis timestamp - "Analyzed: {datetime}"
Row 4: Overall status - "Status: {VALID / WARNINGS / ERRORS}" with color coding
Row 5: Blank
Row 6: Section header - "VOLUME METRICS"
Rows 7-N: Volume KPIs (one per row)
Row N+1: Blank  
Row N+2: Section header - "EFFICIENCY METRICS"
Rows N+3-M: Efficiency KPIs (one per row)
Row M+1: Blank
Row M+2: Section header - "INSIGHTS & FINDINGS"
Rows M+3+: Plain-English insights
```

**KPI Row Columns**:

| Column | Header | Description |
|--------|--------|-------------|
| A | KPI Name | Display name |
| B | Value | Calculated or input value |
| C | Type | "Input" or "Calculated" |
| D | Status | ✓ (valid), ⚠ (warning), ✗ (error), — (N/A) |
| E | Sections | Business sections this affects |
| F | Notes | Validation messages or context |

**Color Coding**:
- Green background: Pillar 1 (Visibility)
- Blue background: Pillar 2 (Standardization)  
- Orange background: Pillar 3 (Growth)
- Red text: Error status
- Yellow text: Warning status
- Gray text: N/A (missing input data)

### 5.6 Validation_Log

**Purpose**: Detailed log of all validation issues for current client

**Columns**:

| Column | Header | Type | Description |
|--------|--------|------|-------------|
| A | `severity` | String | ERROR, WARNING, INFO |
| B | `rule_name` | String | Which rule triggered |
| C | `message` | String | User-facing explanation |
| D | `expected` | String | What value was expected |
| E | `actual` | String | What value was found |
| F | `variance` | String | How far off (percentage) |
| G | `affected_kpis` | String | Which KPIs are involved |
| H | `affected_sections` | String | Which business sections |
| I | `suggested_action` | String | What to do about it |

### 5.7 _Settings

**Purpose**: System configuration and state

**Structure**: Key-value pairs

| Row | Key | Value | Description |
|-----|-----|-------|-------------|
| 1 | `active_client_id` | (client_id) | Currently selected client |
| 2 | `form_id` | (Google Form ID) | Linked form ID |
| 3 | `form_url` | (URL) | Form edit URL |
| 4 | `form_response_url` | (URL) | Form response URL (shareable) |
| 5 | `last_form_sync` | (DateTime) | When form was last synced with Config |
| 6 | `auto_analyze` | TRUE/FALSE | Run analysis on form submit |
| 7 | `version` | 1.0 | System version |

---

## 6. Script Module Specifications

### 6.1 Main.gs

**Purpose**: Entry points, menu creation, high-level orchestration

**Functions**:

```javascript
/**
 * onOpen trigger - Creates custom menu
 * Called automatically when spreadsheet opens
 */
function onOpen()

/**
 * Creates the ShopFloor Tools menu
 */
function createMenu()

/**
 * Main entry point for running analysis on active client
 * Orchestrates: load config → get client data → calculate KPIs → validate → generate results
 */
function runAnalysis()

/**
 * Initialize the system - create all sheets, set defaults
 * Should be run once on first setup
 */
function initializeSystem()

/**
 * Reset system - clear all client data, keep config
 * Confirmation required
 */
function resetSystem()
```

### 6.2 Config.gs

**Purpose**: Load and parse configuration from sheets

**Functions**:

```javascript
/**
 * Load all KPI definitions from Config_KPIs sheet
 * @returns {Object[]} Array of KPI definition objects
 */
function loadKPIConfig()

/**
 * Load all validation rules from Config_Validations sheet
 * @returns {Object[]} Array of validation rule objects
 */
function loadValidationConfig()

/**
 * Load section/pillar definitions from Config_Sections sheet
 * @returns {Object[]} Array of section definition objects
 */
function loadSectionConfig()

/**
 * Get only input KPIs (for form generation)
 * @returns {Object[]} Array of input-type KPI definitions
 */
function getInputKPIs()

/**
 * Get only calculated KPIs (for calculation engine)
 * @returns {Object[]} Array of calculated-type KPI definitions
 */
function getCalculatedKPIs()

/**
 * Parse sections string "1,2,3" into array [1,2,3]
 * @param {string} sectionsStr - Comma-separated section numbers
 * @returns {number[]} Array of section IDs
 */
function parseSections(sectionsStr)

/**
 * Validate configuration integrity
 * Check for: duplicate IDs, invalid references, formula syntax
 * @returns {Object} {valid: boolean, errors: string[]}
 */
function validateConfig()
```

### 6.3 FormManager.gs

**Purpose**: Create, update, and manage Google Form integration

**Functions**:

```javascript
/**
 * Create a new Google Form based on Config_KPIs
 * Links form to Clients sheet
 * Stores form ID in _Settings
 * @returns {string} Form URL
 */
function createClientIntakeForm()

/**
 * Update existing form to match current Config_KPIs
 * Adds new questions, removes deleted ones, updates text
 */
function syncFormWithConfig()

/**
 * Get the shareable form URL
 * @returns {string} Form response URL
 */
function getFormUrl()

/**
 * Unlink and delete the form
 */
function deleteForm()

/**
 * Build form structure from KPI config
 * @param {GoogleAppsScript.Forms.Form} form - Form object
 * @param {Object[]} inputKPIs - Input KPI definitions
 */
function buildFormQuestions(form, inputKPIs)

/**
 * Map form response columns to Clients sheet
 * Ensures form responses land in correct columns
 */
function configureFormDestination()

/**
 * Create appropriate form question based on data type
 * @param {GoogleAppsScript.Forms.Form} form
 * @param {Object} kpi - KPI definition
 * @returns {GoogleAppsScript.Forms.Item}
 */
function createFormQuestion(form, kpi)
```

**Form Structure**:

The form should have these sections:
1. **Company Information** (required)
   - Company Name (short text)
   - Contact Email (short text, email validation)
   - Industry (dropdown: Roofing, HVAC, Plumbing, Electrical, General Contracting)
   - State/Province (dropdown)
   - Data Period (dropdown: Monthly, Quarterly, Annual)

2. **Volume Metrics** (section header)
   - All input KPIs where category = "volume", ordered by form_order

3. **Efficiency Metrics** (section header)
   - All input KPIs where category = "efficiency", ordered by form_order

Each KPI question should:
- Use the `name` as question title
- Use the `description` as help text
- Set required based on `required` field
- Use appropriate input type based on `data_type`:
  - `currency` → Text (with validation for numbers)
  - `percentage` → Text (with validation for 0-100 or 0-1)
  - `number` → Text (with validation for numbers)
  - `integer` → Text (with validation for whole numbers)

### 6.4 ClientManager.gs

**Purpose**: Client CRUD operations and selection

**Functions**:

```javascript
/**
 * Get all clients from Clients sheet
 * @returns {Object[]} Array of client objects
 */
function getAllClients()

/**
 * Get client by ID
 * @param {string} clientId
 * @returns {Object|null} Client object or null
 */
function getClientById(clientId)

/**
 * Get the currently active client ID from _Settings
 * @returns {string|null} Client ID or null
 */
function getActiveClientId()

/**
 * Set the active client
 * @param {string} clientId
 */
function setActiveClient(clientId)

/**
 * Get full client data including raw inputs
 * @param {string} clientId
 * @returns {Object} Client object with rawInputs populated
 */
function getClientData(clientId)

/**
 * Get list of clients for dropdown (id, name, date)
 * @returns {Object[]} [{id, name, date, industry}]
 */
function getClientList()

/**
 * Delete a client record
 * @param {string} clientId
 */
function deleteClient(clientId)

/**
 * Generate unique client ID
 * @param {string} companyName
 * @returns {string} Unique ID
 */
function generateClientId(companyName)

/**
 * Calculate period_days from data_period
 * @param {string} dataPeriod - "monthly", "quarterly", "annual"
 * @returns {number} Days in period
 */
function getPeriodDays(dataPeriod)

/**
 * Process new form submission
 * Called by trigger - generates client_id, calculates period_days
 * @param {Object} e - Form submit event
 */
function processNewSubmission(e)
```

### 6.5 KPIEngine.gs

**Purpose**: Calculate derived KPIs from raw inputs

**Functions**:

```javascript
/**
 * Calculate all derived KPIs for a client
 * @param {Object} clientData - Client object with rawInputs
 * @param {Object[]} kpiConfig - KPI definitions
 * @returns {Object} Calculated KPI values {kpi_id: value}
 */
function calculateAllKPIs(clientData, kpiConfig)

/**
 * Calculate a single KPI
 * @param {Object} kpiDef - KPI definition
 * @param {Object} allValues - All available values (raw + already calculated)
 * @param {number} periodDays - Days in the client's data period
 * @returns {number|null} Calculated value or null if missing dependencies
 */
function calculateKPI(kpiDef, allValues, periodDays)

/**
 * Parse and execute a formula expression
 * @param {string} formula - Formula string (e.g., "DIVIDE:a:b")
 * @param {Object} values - Available values
 * @param {number} periodDays
 * @returns {number|null}
 */
function executeFormula(formula, values, periodDays)

/**
 * Execute DIVIDE operation
 * @param {string} numeratorId
 * @param {string} denominatorId
 * @param {Object} values
 * @returns {number|null}
 */
function executeDivide(numeratorId, denominatorId, values)

/**
 * Execute MULTIPLY operation
 */
function executeMultiply(aId, bId, values)

/**
 * Execute SUBTRACT operation
 */
function executeSubtract(aId, bId, values)

/**
 * Execute ADD operation
 */
function executeAdd(aId, bId, values)

/**
 * Execute PERCENTAGE operation (a/b * 100)
 */
function executePercentage(numeratorId, denominatorId, values)

/**
 * Execute PER_DAY normalization
 * @param {string} valueId
 * @param {Object} values
 * @param {number} periodDays
 * @returns {number|null}
 */
function executePerDay(valueId, values, periodDays)

/**
 * Execute CUSTOM formula (calls named function)
 * @param {string} functionName
 * @param {Object} values
 * @param {number} periodDays
 * @returns {number|null}
 */
function executeCustom(functionName, values, periodDays)

/**
 * CUSTOM: Calculate schedule capacity
 * Techs × 8 hours × days in period
 */
function calculateScheduleCapacity(values, periodDays)

/**
 * Check if all dependencies for a KPI are available
 * @param {string} formula
 * @param {Object} values
 * @returns {boolean}
 */
function hasDependencies(formula, values)

/**
 * Extract KPI IDs referenced in a formula
 * @param {string} formula
 * @returns {string[]}
 */
function extractDependencies(formula)

/**
 * Sort calculated KPIs by dependency order
 * Ensures dependencies are calculated before dependents
 * @param {Object[]} calculatedKPIs
 * @returns {Object[]} Sorted array
 */
function sortByDependencyOrder(calculatedKPIs)
```

**Calculation Flow**:

1. Load all input values from client data
2. Get calculated KPI definitions, sorted by dependency order
3. For each calculated KPI:
   a. Check if all dependencies are available
   b. If yes, execute formula and store result
   c. If no, skip (will be null)
4. Return all calculated values

### 6.6 ValidationEngine.gs

**Purpose**: Validate data consistency and flag issues

**Functions**:

```javascript
/**
 * Run all validation rules against client data
 * @param {Object} allValues - Raw + calculated KPI values
 * @param {Object[]} validationConfig - Validation rules
 * @returns {Object} {status: string, issues: ValidationIssue[]}
 */
function validateAll(allValues, validationConfig)

/**
 * Run a single validation rule
 * @param {Object} rule - Validation rule definition
 * @param {Object} values - All KPI values
 * @returns {Object|null} ValidationIssue or null if passed
 */
function runValidation(rule, values)

/**
 * Execute RECONCILE validation
 * Check if calculated value matches reported value
 * @param {string} formula - e.g., "RECONCILE:a*b:c"
 * @param {Object} values
 * @param {number} tolerance
 * @returns {Object} {passed: boolean, expected, actual, variance}
 */
function executeReconcile(formula, values, tolerance)

/**
 * Execute RANGE validation
 * Check if value is within acceptable range
 * @param {string} formula - e.g., "RANGE:close_rate:0:100"
 * @param {Object} values
 * @returns {Object} {passed: boolean, actual, min, max}
 */
function executeRange(formula, values)

/**
 * Execute GREATER validation
 * Check if a > b
 */
function executeGreater(formula, values)

/**
 * Execute EQUALS validation
 * Check if two values are equal within tolerance
 */
function executeEquals(formula, values, tolerance)

/**
 * Execute REQUIRES validation
 * Check if dependency exists when dependent exists
 */
function executeRequires(formula, values)

/**
 * Format validation message with actual values
 * Replace {expected}, {actual}, {variance} placeholders
 * @param {string} template
 * @param {Object} data
 * @returns {string}
 */
function formatValidationMessage(template, data)

/**
 * Determine overall validation status
 * @param {Object[]} issues
 * @returns {string} "valid", "warnings", "errors"
 */
function determineOverallStatus(issues)

/**
 * Get KPIs affected by a validation issue
 * @param {Object} rule
 * @returns {string[]} KPI IDs
 */
function getAffectedKPIs(rule)

/**
 * Get business sections affected by a validation issue
 * @param {string[]} kpiIds
 * @param {Object[]} kpiConfig
 * @returns {number[]} Section IDs
 */
function getAffectedSections(kpiIds, kpiConfig)
```

### 6.7 InsightsEngine.gs

**Purpose**: Generate plain-English findings and recommendations

**Functions**:

```javascript
/**
 * Generate all insights for a client
 * @param {Object} clientData
 * @param {Object} allValues - Raw + calculated KPIs
 * @param {Object[]} validationIssues
 * @param {Object[]} kpiConfig
 * @param {Object[]} sectionConfig
 * @returns {Object[]} Array of insight objects
 */
function generateInsights(clientData, allValues, validationIssues, kpiConfig, sectionConfig)

/**
 * Generate insight about data quality
 * Based on validation results
 */
function generateDataQualityInsight(validationIssues)

/**
 * Generate insight about booking performance
 */
function generateBookingInsight(allValues)

/**
 * Generate insight about sales performance
 */
function generateSalesInsight(allValues)

/**
 * Generate insight about profitability
 */
function generateProfitabilityInsight(allValues)

/**
 * Generate insight about capacity utilization
 */
function generateCapacityInsight(allValues)

/**
 * Generate insight about vehicle/crew efficiency
 */
function generateEfficiencyInsight(allValues)

/**
 * Identify which business sections need attention
 * @param {Object[]} validationIssues
 * @param {Object} allValues
 * @param {Object[]} kpiConfig
 * @returns {Object[]} [{sectionId, sectionName, severity, reasons}]
 */
function identifyProblemSections(validationIssues, allValues, kpiConfig)

/**
 * Generate overall summary
 * @param {Object} clientData
 * @param {Object} allValues
 * @param {Object[]} insights
 * @returns {string} Executive summary paragraph
 */
function generateSummary(clientData, allValues, insights)

/**
 * Format a number for display based on data type
 * @param {number} value
 * @param {string} dataType - "currency", "percentage", "number", "integer"
 * @returns {string}
 */
function formatValue(value, dataType)
```

**Insight Object Structure**:

```javascript
{
  type: string,           // "data_quality", "booking", "sales", "profitability", etc.
  title: string,          // "Booking Performance"
  status: string,         // "good", "warning", "concern", "unknown"
  summary: string,        // One-line summary
  detail: string,         // Fuller explanation
  affectedSections: number[],
  recommendations: string[]
}
```

### 6.8 ResultsGenerator.gs

**Purpose**: Populate the Results and Validation_Log sheets

**Functions**:

```javascript
/**
 * Generate complete results for active client
 * Clears and rebuilds Results and Validation_Log sheets
 * @param {string} clientId
 */
function generateResults(clientId)

/**
 * Clear the Results sheet
 */
function clearResultsSheet()

/**
 * Clear the Validation_Log sheet
 */
function clearValidationLogSheet()

/**
 * Write header section to Results sheet
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} clientData
 * @param {string} overallStatus
 */
function writeResultsHeader(sheet, clientData, overallStatus)

/**
 * Write Volume KPIs section
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} startRow
 * @param {Object} allValues
 * @param {Object[]} kpiConfig
 * @param {Object[]} validationIssues
 * @returns {number} Next row number
 */
function writeVolumeSection(sheet, startRow, allValues, kpiConfig, validationIssues)

/**
 * Write Efficiency KPIs section
 */
function writeEfficiencySection(sheet, startRow, allValues, kpiConfig, validationIssues)

/**
 * Write Insights section
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} startRow
 * @param {Object[]} insights
 */
function writeInsightsSection(sheet, startRow, insights)

/**
 * Write validation issues to Validation_Log sheet
 * @param {Object[]} issues
 */
function writeValidationLog(issues)

/**
 * Apply formatting to Results sheet
 * Colors, fonts, borders, conditional formatting
 */
function formatResultsSheet()

/**
 * Get status icon for a KPI
 * @param {string} kpiId
 * @param {Object[]} validationIssues
 * @returns {string} "✓", "⚠", "✗", or "—"
 */
function getStatusIcon(kpiId, validationIssues)

/**
 * Get background color for pillar
 * @param {number} pillarId
 * @returns {string} Hex color
 */
function getPillarColor(pillarId)

/**
 * Get section names string for a KPI
 * @param {Object} kpiDef
 * @param {Object[]} sectionConfig
 * @returns {string} e.g., "Marketing, CSR"
 */
function getSectionNames(kpiDef, sectionConfig)
```

### 6.9 UI.gs

**Purpose**: Sidebar, dialogs, and user interaction

**Functions**:

```javascript
/**
 * Show the validation dashboard sidebar
 */
function showValidationSidebar()

/**
 * Show the client selector dialog
 */
function showClientSelector()

/**
 * Show system settings dialog
 */
function showSettings()

/**
 * Show the form URL in a dialog
 */
function showFormUrl()

/**
 * Show confirmation dialog
 * @param {string} message
 * @returns {boolean}
 */
function showConfirmation(message)

/**
 * Show alert message
 * @param {string} message
 */
function showAlert(message)

/**
 * Show toast notification
 * @param {string} message
 * @param {number} duration - seconds
 */
function showToast(message, duration)

/**
 * Get data for sidebar display
 * @returns {Object} {status, issues, client, lastAnalyzed}
 */
function getSidebarData()

/**
 * Get data for client selector
 * @returns {Object[]} Client list
 */
function getClientSelectorData()

/**
 * Handle client selection from dialog
 * @param {string} clientId
 */
function handleClientSelection(clientId)

/**
 * Handle "Run Analysis" button from sidebar
 */
function handleRunAnalysis()

/**
 * Handle "Refresh" button from sidebar
 */
function handleRefresh()
```

### 6.10 Triggers.gs

**Purpose**: Trigger handlers and installation

**Functions**:

```javascript
/**
 * onOpen trigger handler
 * Creates menu
 */
function onOpen()

/**
 * onFormSubmit trigger handler
 * Processes new submission, optionally runs analysis
 * @param {Object} e - Event object
 */
function onFormSubmit(e)

/**
 * Install all triggers
 * Called during system initialization
 */
function installTriggers()

/**
 * Uninstall all triggers
 */
function uninstallTriggers()

/**
 * Check if triggers are installed
 * @returns {boolean}
 */
function triggersInstalled()
```

### 6.11 Utils.gs

**Purpose**: Helper functions used across modules

**Functions**:

```javascript
/**
 * Get sheet by name, create if doesn't exist
 * @param {string} sheetName
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getOrCreateSheet(sheetName)

/**
 * Get sheet by name, throw error if doesn't exist
 * @param {string} sheetName
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getRequiredSheet(sheetName)

/**
 * Convert sheet data to array of objects
 * Uses first row as headers
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {Object[]}
 */
function sheetToObjects(sheet)

/**
 * Write array of objects to sheet
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object[]} data
 * @param {string[]} headers - Column order
 */
function objectsToSheet(sheet, data, headers)

/**
 * Get value from _Settings sheet
 * @param {string} key
 * @returns {any}
 */
function getSetting(key)

/**
 * Set value in _Settings sheet
 * @param {string} key
 * @param {any} value
 */
function setSetting(key, value)

/**
 * Sanitize string for use in IDs
 * @param {string} str
 * @returns {string}
 */
function sanitizeForId(str)

/**
 * Parse number from string, handling currency/percentage symbols
 * @param {string} str
 * @returns {number|null}
 */
function parseNumber(str)

/**
 * Format number as currency
 * @param {number} value
 * @returns {string}
 */
function formatCurrency(value)

/**
 * Format number as percentage
 * @param {number} value
 * @returns {string}
 */
function formatPercentage(value)

/**
 * Check if value is null, undefined, or empty string
 * @param {any} value
 * @returns {boolean}
 */
function isEmpty(value)

/**
 * Safe division (returns null if denominator is 0)
 * @param {number} a
 * @param {number} b
 * @returns {number|null}
 */
function safeDivide(a, b)

/**
 * Clamp value between min and max
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max)

/**
 * Deep clone an object
 * @param {Object} obj
 * @returns {Object}
 */
function clone(obj)

/**
 * Log with timestamp
 * @param {string} message
 */
function log(message)

/**
 * Get current timestamp string
 * @returns {string}
 */
function getTimestamp()
```

---

## 7. KPI Engine Logic

### Calculation Order

Calculated KPIs must be processed in dependency order. For example:
- `net_profit` depends on `gross_revenue` and `total_costs` (both inputs)
- `profit_margin` depends on `net_profit` (calculated) and `gross_revenue` (input)

**Algorithm**:
1. Build dependency graph from formulas
2. Topological sort to determine order
3. Process in order, skipping any with missing dependencies

### Dependency Graph Example

```
total_leads (input)
in_home_visits (input)
jobs_closed (input)
gross_revenue (input)
total_costs (input)
average_ticket (input)
num_techs (input)
hours_scheduled (input)

booking_rate ← total_leads, in_home_visits
close_rate ← in_home_visits, jobs_closed
net_profit ← gross_revenue, total_costs
profit_margin ← net_profit, gross_revenue
schedule_capacity ← num_techs, period_days
schedule_efficiency ← hours_scheduled, schedule_capacity
calculated_avg_ticket ← gross_revenue, jobs_closed
revenue_per_vehicle ← gross_revenue, num_vehicles
```

### Handling Missing Data

When a calculation cannot be completed due to missing inputs:
1. Set the calculated value to `null`
2. Do NOT propagate errors (allow other calculations to proceed)
3. Mark the KPI as "N/A" in results
4. If the missing input was required, generate a validation issue

### Period Normalization

When comparing across different time periods, normalize to daily:

```javascript
// If client reports monthly data (30 days)
// and we want daily revenue:
dailyRevenue = grossRevenue / periodDays

// If client reports annual (365 days)
// and we want monthly approximation:
monthlyRevenue = (grossRevenue / 365) * 30
```

The `data_period` field determines `period_days`:
- "monthly" → 30
- "quarterly" → 90
- "annual" → 365

---

## 8. Validation Engine Logic

### Validation Types

#### 1. Reconciliation
Check if calculated value matches expected value within tolerance.

```
RECONCILE:a*b:c means: (a × b) should equal c

Example: RECONCILE:total_leads*booking_rate/100:in_home_visits
- Calculate: total_leads × (booking_rate/100)
- Compare to: in_home_visits
- Pass if: |calculated - actual| / actual ≤ tolerance
```

#### 2. Range
Check if value falls within acceptable bounds.

```
RANGE:kpi:min:max

Example: RANGE:close_rate:0:100
- Pass if: 0 ≤ close_rate ≤ 100
```

#### 3. Greater Than
Check if one value exceeds another.

```
GREATER:a:b means: a should be > b

Example: GREATER:gross_revenue:total_costs
- Pass if: gross_revenue > total_costs
```

#### 4. Equals
Check if two values are equal within tolerance.

```
EQUALS:a:b

Example: EQUALS:average_ticket:calculated_avg_ticket
- Pass if: |a - b| / max(a,b) ≤ tolerance
```

#### 5. Requires (Dependency)
Check if dependent value exists when parent exists.

```
REQUIRES:dependent:parent means: if dependent has value, parent must have value

Example: REQUIRES:in_home_visits:total_leads
- Pass if: in_home_visits is empty OR total_leads has value
- Fail if: in_home_visits has value AND total_leads is empty
```

### Tolerance Handling

Tolerance is expressed as a decimal (0.10 = 10%).

For reconciliation/equals:
```javascript
variance = Math.abs(expected - actual) / Math.max(Math.abs(expected), Math.abs(actual))
passed = variance <= tolerance
```

### Severity Levels

| Level | Meaning | UI Treatment |
|-------|---------|--------------|
| `error` | Data is definitely wrong | Red, blocks "valid" status |
| `warning` | Data is suspicious but possible | Yellow, results still usable |
| `info` | FYI, may indicate data quality opportunity | Gray, informational only |

### Validation Execution Order

1. Run all `dependency` validations first (check data completeness)
2. Run all `range` validations (sanity checks)
3. Run all `reconciliation` validations (cross-checks)
4. Run all `ratio` validations (business logic)
5. Compile results and determine overall status

---

## 9. Insights Engine Logic

### Insight Generation Process

1. **Data Quality Assessment**
   - Count validation errors/warnings
   - Identify which sections have issues
   - Rate overall data reliability

2. **Performance Analysis**
   - Compare calculated metrics to typical benchmarks (hardcoded initially)
   - Identify outliers (unusually high/low values)
   - Note missing data that prevents analysis

3. **Section Mapping**
   - For each issue/insight, identify affected business sections
   - Aggregate to show which sections need most attention

4. **Recommendation Generation**
   - Based on identified issues, suggest next steps
   - Keep recommendations actionable and specific

### Benchmark Thresholds (Initial Hardcoded Values)

These can be moved to config later, but start with:

| Metric | Poor | Average | Good | Excellent |
|--------|------|---------|------|-----------|
| Booking Rate | <30% | 30-50% | 50-70% | >70% |
| Close Rate | <20% | 20-35% | 35-50% | >50% |
| Profit Margin | <5% | 5-12% | 12-20% | >20% |
| Schedule Efficiency | <60% | 60-80% | 80-95% | >95% |

### Insight Templates

```javascript
// Booking Performance
if (bookingRate < 30) {
  status = "concern"
  summary = "Your booking rate of {rate}% is below industry average."
  detail = "You're losing potential customers at the CSR stage. For every 100 leads, only {visits} become appointments."
  recommendations = [
    "Review CSR call scripts and training",
    "Analyze why leads aren't converting to appointments",
    "Consider CSR coaching or call monitoring"
  ]
  affectedSections = [1, 2] // Marketing, CSR
}

// Profitability
if (profitMargin < 5) {
  status = "concern"
  summary = "Your profit margin of {margin}% is critically low."
  detail = "After costs, you're keeping only ${profit} from ${revenue} in revenue."
  recommendations = [
    "Review pricing strategy - are you undercharging?",
    "Analyze cost structure for reduction opportunities",
    "Focus on higher-margin job types"
  ]
  affectedSections = [3, 7] // Sales, Finance
}
```

---

## 10. Google Form Integration

### Form Creation Process

1. Create new Google Form
2. Set form title: "Client Operational Assessment - ShopFloor Solutions"
3. Set form description (intro text)
4. Add sections and questions based on Config_KPIs
5. Set form destination to Clients sheet
6. Configure submission settings (collect email: optional)
7. Store form ID and URLs in _Settings
8. Install onFormSubmit trigger

### Form Question Mapping

| Data Type | Form Question Type | Validation |
|-----------|-------------------|------------|
| `integer` | Short answer | Number, whole numbers only |
| `number` | Short answer | Number |
| `currency` | Short answer | Number (user enters digits only) |
| `percentage` | Short answer | Number, 0-100 |

### Form Structure

```
Section 1: "Company Information"
- Company Name (required, short answer)
- Contact Email (required, short answer with email validation)
- Industry (required, dropdown)
- State/Province (required, dropdown)
- Data Period (required, dropdown: "Monthly", "Quarterly", "Annual")

Section 2: "Volume Metrics"
- Description: "These metrics measure the size and capacity of your operation."
- [All input KPIs where category="volume", ordered by form_order]

Section 3: "Efficiency Metrics"  
- Description: "These metrics measure how well you perform relative to your capacity."
- [All input KPIs where category="efficiency", ordered by form_order]

Section 4: "Additional Information"
- Notes (optional, paragraph)
```

### Form Response Processing

When form is submitted:

1. `onFormSubmit` trigger fires
2. Extract response values
3. Generate `client_id` from timestamp + company name
4. Calculate `period_days` from `data_period`
5. Write to Clients sheet (form does this automatically, but we augment)
6. Update `client_id` and `period_days` columns
7. If `auto_analyze` setting is TRUE:
   - Set this client as active
   - Run analysis
   - (Optionally) Send email notification

---

## 11. User Interface Specifications

### 11.1 Custom Menu

**Menu Name**: "ShopFloor Tools"

**Menu Items**:
```
ShopFloor Tools
├── Select Client...           → showClientSelector()
├── Run Analysis               → runAnalysis()
├── ─────────────              (separator)
├── View Validation Dashboard  → showValidationSidebar()
├── ─────────────              (separator)
├── Form Management
│   ├── Get Form URL           → showFormUrl()
│   ├── Sync Form with Config  → syncFormWithConfig()
│   └── Recreate Form          → createClientIntakeForm()
├── ─────────────              (separator)
├── Settings                   → showSettings()
└── Initialize System          → initializeSystem()
```

### 11.2 Client Selector Dialog

**Purpose**: Allow user to select which client to analyze

**HTML Template**: `ClientSelector.html`

**Layout**:
```
┌────────────────────────────────────────────┐
│  Select Client                          X  │
├────────────────────────────────────────────┤
│                                            │
│  Choose a client to analyze:               │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ ▼ Select client...                   │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  Client details:                           │
│  • Company: {name}                         │
│  • Industry: {industry}                    │
│  • Submitted: {date}                       │
│  • Status: {analysis_status}               │
│                                            │
│         [Cancel]  [Select & Analyze]       │
│                                            │
└────────────────────────────────────────────┘
```

**Dropdown Contents**:
- List all clients from Clients sheet
- Format: "{Company Name} ({Date}) - {Industry}"
- Sort by date descending (newest first)

**Behavior**:
- On dropdown change: Update client details preview
- Cancel: Close dialog
- Select & Analyze: Set active client, run analysis, close dialog

### 11.3 Validation Dashboard Sidebar

**Purpose**: Persistent view of validation status and issues

**HTML Template**: `Sidebar.html`

**Layout**:
```
┌──────────────────────────────────┐
│  Validation Dashboard            │
├──────────────────────────────────┤
│                                  │
│  Current Client:                 │
│  {Company Name}                  │
│  {Industry} | {Date}             │
│                                  │
│  ┌────────────────────────────┐  │
│  │ STATUS: ✓ VALID            │  │
│  │         ⚠ 2 WARNINGS       │  │
│  │         ✗ 0 ERRORS         │  │
│  └────────────────────────────┘  │
│                                  │
│  Issues:                         │
│  ┌────────────────────────────┐  │
│  │ ⚠ Revenue doesn't match    │  │
│  │   jobs × average ticket    │  │
│  │   Expected: $125,000       │  │
│  │   Actual: $150,000         │  │
│  │   Sections: Sales          │  │
│  ├────────────────────────────┤  │
│  │ ⚠ Schedule efficiency      │  │
│  │   over 100% (overtime)     │  │
│  │   Value: 115%              │  │
│  │   Sections: Scheduling     │  │
│  └────────────────────────────┘  │
│                                  │
│  [↻ Refresh]  [Run Analysis]     │
│                                  │
│  Last updated: {timestamp}       │
│                                  │
└──────────────────────────────────┘
```

**Behavior**:
- Opens as sidebar (300px width)
- Refresh button: Reloads data from sheets
- Run Analysis button: Re-runs analysis for current client
- Updates automatically after analysis runs

### 11.4 Form URL Dialog

**Purpose**: Display shareable form link

**Layout**:
```
┌────────────────────────────────────────────┐
│  Client Intake Form                        │
├────────────────────────────────────────────┤
│                                            │
│  Share this link with clients:             │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ https://docs.google.com/forms/d/e/...│  │
│  └──────────────────────────────────────┘  │
│                                            │
│  [Copy Link]  [Open Form]  [Close]         │
│                                            │
└────────────────────────────────────────────┘
```

---

## 12. Trigger Configuration

### Triggers Required

| Trigger | Type | Function | Purpose |
|---------|------|----------|---------|
| onOpen | Simple | `onOpen()` | Create menu when sheet opens |
| onFormSubmit | Installable | `onFormSubmit(e)` | Process new form submissions |

### Trigger Installation

The `installTriggers()` function should:
1. Check for existing triggers (avoid duplicates)
2. Create onFormSubmit trigger for linked form
3. Store trigger IDs for later management

```javascript
function installTriggers() {
  // Remove existing triggers first
  uninstallTriggers();
  
  // Install form submit trigger
  const form = FormApp.openById(getSetting('form_id'));
  ScriptApp.newTrigger('onFormSubmit')
    .forForm(form)
    .onFormSubmit()
    .create();
}
```

### Form Submit Handler

```javascript
function onFormSubmit(e) {
  try {
    // 1. Get the new response row
    const response = e.response;
    const itemResponses = response.getItemResponses();
    
    // 2. Find the row in Clients sheet
    const clientsSheet = getRequiredSheet('Clients');
    const lastRow = clientsSheet.getLastRow();
    
    // 3. Generate and set client_id
    const companyName = getResponseValue(itemResponses, 'Company Name');
    const clientId = generateClientId(companyName);
    clientsSheet.getRange(lastRow, 1).setValue(clientId);
    
    // 4. Calculate and set period_days
    const dataPeriod = getResponseValue(itemResponses, 'Data Period');
    const periodDays = getPeriodDays(dataPeriod);
    clientsSheet.getRange(lastRow, 8).setValue(periodDays); // Assuming column H
    
    // 5. Set analysis status
    clientsSheet.getRange(lastRow, ANALYSIS_STATUS_COL).setValue('pending');
    
    // 6. Auto-analyze if enabled
    if (getSetting('auto_analyze') === true) {
      setActiveClient(clientId);
      runAnalysis();
    }
    
    // 7. Show toast notification
    SpreadsheetApp.getActive().toast(
      `New submission from ${companyName}`,
      'Form Received',
      5
    );
    
  } catch (error) {
    log('Error in onFormSubmit: ' + error.message);
  }
}
```

---

## 13. Error Handling

### Error Categories

| Category | Examples | Handling |
|----------|----------|----------|
| Config Errors | Missing sheet, invalid formula syntax | Block operation, show specific error |
| Data Errors | Invalid numbers, missing required fields | Flag in validation, continue processing |
| Calculation Errors | Division by zero, missing dependencies | Return null, mark as N/A |
| System Errors | API failures, quota exceeded | Log, show generic error, suggest retry |

### Error Handling Patterns

```javascript
// Wrap main entry points
function runAnalysis() {
  try {
    // ... main logic
  } catch (error) {
    log('Error in runAnalysis: ' + error.message);
    showAlert('Analysis failed: ' + error.message);
  }
}

// Safe calculations
function calculateKPI(kpiDef, allValues, periodDays) {
  try {
    if (!hasDependencies(kpiDef.formula, allValues)) {
      return null; // Missing dependencies, not an error
    }
    return executeFormula(kpiDef.formula, allValues, periodDays);
  } catch (error) {
    log(`Error calculating ${kpiDef.id}: ${error.message}`);
    return null;
  }
}

// Validation should never throw
function runValidation(rule, values) {
  try {
    // ... validation logic
  } catch (error) {
    log(`Error in validation ${rule.id}: ${error.message}`);
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      severity: 'error',
      message: 'Validation could not be completed due to an error.',
      affectedKPIs: rule.affected_kpis.split(',')
    };
  }
}
```

### User-Facing Error Messages

- Be specific about what went wrong
- Suggest what user can do
- Don't expose technical details
- Log full details for debugging

```javascript
// Good
showAlert('Could not find the Config_KPIs sheet. Please run "Initialize System" from the menu.');

// Bad
showAlert('TypeError: Cannot read property "getRange" of null');
```

---

## 14. Testing Scenarios

### Setup Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Initialize fresh system | Run initializeSystem() | All sheets created with headers, settings populated |
| Create form | Run createClientIntakeForm() | Form created with all input KPIs as questions |
| Form-sheet link | Submit test form response | Response appears in Clients sheet |

### Calculation Tests

| Test | Input Data | Expected Calculation |
|------|------------|---------------------|
| Booking rate | 100 leads, 40 visits | 40% |
| Close rate | 40 visits, 20 jobs | 50% |
| Profit margin | $100K revenue, $80K costs | 20% |
| Missing data | 100 leads, no visits | booking_rate = null, no error |

### Validation Tests

| Test | Input Data | Expected Result |
|------|------------|-----------------|
| Valid reconciliation | 100 leads × 40% = 40 visits (actual: 40) | Pass |
| Failed reconciliation | 100 leads × 40% = 40 visits (actual: 25) | Fail, error |
| Within tolerance | 100 leads × 40% = 40 visits (actual: 38) | Pass (within 10%) |
| Range violation | Close rate: 150% | Fail, error |
| Missing dependency | Visits reported but no leads | Fail, error |

### Multi-Client Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Switch clients | Select Client A, analyze, select Client B, analyze | Results sheet shows Client B data |
| New submission | Submit form while viewing Client A | New client appears in list |
| Data isolation | Analyze Client A, then Client B | Client A results not mixed with B |

### Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| All KPIs missing | Results show all N/A, validation notes missing data |
| Zero values | Handle division by zero gracefully |
| Very large numbers | Display formatted correctly |
| Negative profit | Show warning, but don't error |
| Form sync with deleted KPIs | Remove questions no longer in config |

---

## 15. Future Considerations

### Phase 2: Benchmarking
- Add Config_Benchmarks sheet with industry/state averages
- Compare client values to benchmarks in insights
- Show percentile ranking

### Phase 2: Section Report
- Dedicated view showing all KPIs by business section
- "Section Health Score" aggregation
- Detailed section-specific recommendations

### Phase 3: Historical Tracking
- Store analysis results over time
- Show trends (improving/declining)
- Month-over-month comparisons

### Phase 3: Client Portal
- Web app for clients to view their results
- Self-service re-submission
- Goal setting and tracking

### Technical Debt to Address
- Move benchmark thresholds to config sheet
- Add unit tests (QUnit or similar)
- Performance optimization for large client lists
- Export to PDF report

---

## Appendix A: KPI Reference

### Volume KPIs

| ID | Name | Description | Formula |
|----|------|-------------|---------|
| total_leads | Total Leads | Number of leads generated | Input |
| in_home_visits | In-Home Visits | Sales appointments conducted | Input |
| jobs_closed | Jobs Closed | Jobs sold/completed | Input |
| gross_revenue | Gross Revenue | Total revenue | Input |
| total_costs | Total Costs | Total operating costs | Input |
| num_employees | Number of Employees | Total headcount | Input |
| num_techs | Number of Technicians | Field staff count | Input |
| num_vehicles | Number of Vehicles | Service vehicles | Input |
| hours_scheduled | Hours Scheduled | Man-hours on jobs | Input |
| schedule_capacity | Schedule Capacity | Available man-hours | Techs × 8 × period_days |

### Efficiency KPIs

| ID | Name | Description | Formula |
|----|------|-------------|---------|
| booking_rate | Booking Rate | Lead-to-appointment conversion | in_home_visits / total_leads × 100 |
| close_rate | Close Rate | Appointment-to-sale conversion | jobs_closed / in_home_visits × 100 |
| average_ticket | Average Ticket | Revenue per job | Input |
| calculated_avg_ticket | Calculated Avg Ticket | Computed average ticket | gross_revenue / jobs_closed |
| net_profit | Net Profit | Revenue minus costs | gross_revenue - total_costs |
| profit_margin | Profit Margin | Profit as % of revenue | net_profit / gross_revenue × 100 |
| schedule_efficiency | Schedule Efficiency | Capacity utilization | hours_scheduled / schedule_capacity × 100 |
| revenue_per_vehicle | Revenue Per Vehicle | Vehicle productivity | gross_revenue / num_vehicles |

---

## Appendix B: Validation Rules Reference

### Reconciliation Rules

| ID | Check | Formula | Tolerance |
|----|-------|---------|-----------|
| booking_rate_reconcile | Booking rate × leads = visits | leads × rate/100 ≈ visits | 10% |
| close_rate_reconcile | Close rate × visits = jobs | visits × rate/100 ≈ jobs | 10% |
| revenue_reconcile | Jobs × ticket = revenue | jobs × ticket ≈ revenue | 15% |
| avg_ticket_match | Reported = calculated ticket | reported ≈ calculated | 15% |

### Range Rules

| ID | Check | Range |
|----|-------|-------|
| close_rate_range | Close rate realistic | 0-100% |
| booking_rate_range | Booking rate realistic | 0-100% |
| schedule_efficiency_range | Efficiency realistic | 0-150% |

### Dependency Rules

| ID | Check | Logic |
|----|-------|-------|
| has_leads_for_visits | Visits require leads | If visits > 0, leads must exist |
| has_visits_for_jobs | Jobs require visits | If jobs > 0, visits must exist |

### Business Logic Rules

| ID | Check | Logic |
|----|-------|-------|
| profit_positive | Making money | revenue > costs |

---

## Implementation Notes for Developer

### Getting Started

1. Create a new Google Sheet
2. Open Extensions → Apps Script
3. Create file structure as specified
4. Implement in this order:
   - Utils.gs (helpers needed everywhere)
   - Config.gs (configuration loading)
   - Main.gs (menu and orchestration)
   - ClientManager.gs (client data handling)
   - KPIEngine.gs (calculations)
   - ValidationEngine.gs (validations)
   - ResultsGenerator.gs (output)
   - InsightsEngine.gs (plain-English findings)
   - FormManager.gs (form creation)
   - UI.gs (sidebar/dialogs)
   - Triggers.gs (automation)

5. Run initializeSystem() to create sheets
6. Populate Config_KPIs with sample data
7. Test with manual data entry before form integration

### Key Implementation Details

- Use `PropertiesService.getScriptProperties()` for persistent settings if _Settings sheet approach becomes cumbersome
- Consider caching config data in memory during analysis runs to reduce sheet reads
- Use `SpreadsheetApp.flush()` after batch writes
- Wrap sheet operations in try-catch to handle concurrent access issues

### Code Style

- Use JSDoc comments for all public functions
- Use descriptive variable names
- Keep functions small and focused
- Log important operations for debugging
- Use constants for column indices and sheet names

---

*End of Specification Document*
