# Portfolio Dashboard

A personal net-worth tracker backed by a Google Sheet. Log snapshots of your
investments from a small web UI, and it writes them straight into the sheet
(preserving your existing formulas/formatting), then reads them back for
growth charts and performance metrics.

## Features

- **Add Snapshot** - enter balances for Stocks/ETFs (Revolut, Trading212,
  XTB, Robinhood), Loans (Personal, Twino, Peerberry), Crypto, Cash, and an
  optional note. Submitting appends a new dated row to the sheet.
- **Charts** - total portfolio growth over time, plus a breakdown by asset
  category (Stocks/ETFs, Crypto, Cash, Loans). Hover for exact values, or
  switch to a table view.
- **Performance Metrics** - CAGR, max drawdown, and Sharpe ratio computed
  from your snapshot history.

## Project structure

```
Backend/
  app.py              Flask app entrypoint, serves the frontend + API
  db.py                Google Sheets read helpers (gspread)
  performance.py        CAGR / max drawdown / Sharpe ratio math
  risk_free_rate.txt    Annual risk-free rate assumption used in Sharpe (edit this to change it)
  stock_funcs.py         yfinance helpers
  routes/portfolio.py    /portfolio/* API endpoints
  credentials/            Google service account key + spreadsheet config (gitignored, not in repo)
Frontend/
  index.html, app.js, charts.js, style.css   Static UI, served by Flask — no build step
launch.sh                 One-click launcher (starts the server if needed, opens the browser)
portfolio-dashboard.desktop   Desktop/app-menu shortcut that runs launch.sh
```

## Setup

### 1. Python environment

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Google Sheets access

The app authenticates with a Google service account and needs two files in
`Backend/credentials/` (this directory is gitignored, you have to create it
yourself):

**`Backend/credentials/service_account.json`**, a service account key from
[Google Cloud Console](https://console.cloud.google.com/) with the Google
Sheets API enabled. Share your spreadsheet with the service account's
`client_email` (Editor access).

**`Backend/credentials/sheet.json`**:

```json
{
    "spreadsheet_id": "<your spreadsheet ID, from its URL>",
    "worksheets": {
        "master": "<name of your main sheet tab>",
        "stocks": "Stocks/ETFs",
        "loans": "Loans"
    }
}
```

The master sheet tab is expected to have these columns (A→O): Date,
Stocks/ETFs (€), Stocks/ETFs (%), Crypto (€), Crypto (%), Cash (€), Cash (%),
Loans (€), Loans (%), Total invested (€), Total (€), Change (€), Change (%),
Yearly change, Notes and important marks.

The "Stocks/ETFs" and "Loans" tabs each need a `Date` column, then one column
per account you want to track, then a `Total` column. The app reads whatever
account names sit between `Date` and `Total` at startup and builds the "Add
Snapshot" form from them, so it doesn't matter which brokers/platforms you
use or how many, as long as the columns follow that layout. A section with no
account columns just shows as empty on the form.

### 3. Risk-free rate (optional)

`Backend/risk_free_rate.txt` holds the annual risk-free rate assumption used
in the Sharpe ratio calculation, as a plain percentage. Edit the number and
reload the Performance Metrics tab to apply it, no restart needed.

## Running

**One click:** double-click the **Portfolio Dashboard** icon on your Desktop
or find it in your app menu. It starts the server in the background if it
isn't already running, then opens your browser to the dashboard. Safe to
click again later, it won't spawn a duplicate server.

**Manually:**

```bash
source venv/bin/activate
cd Backend
python app.py
```

Then open http://127.0.0.1:5000/.

The server keeps running in the background after you close the browser tab, that's intentional, so relaunching is instant. Stop it with your process
manager (or `pkill -f "python app.py"`) if you want to shut it down.
