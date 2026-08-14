from db import get_spreadsheet, get_sheet_data, get_master_history, get_worksheet
from performance import compute_cagr, compute_max_drawdown, compute_sharpe, parse_date, read_risk_free_rate
import stock_funcs
from datetime import date
import re
from flask import Blueprint, jsonify, request
from gspread.utils import rowcol_to_a1

portfolio_bp = Blueprint('portfolio', __name__)

@portfolio_bp.route('/latest', methods=['GET'])
def get_latest():
    try:
        from app import get_sheet_data
        data = get_sheet_data()
        filled = [row for row in data if row.get("Total (\u20ac)") not in ("", "\u20ac0.00", None)]
        latest = filled[-1]
        return jsonify({
            "date": latest["Date"],
            "total": latest["Total (\u20ac)"],
            "stocks": latest["Stocks/ETFs (\u20ac)"],
            "cash": latest["Cash (\u20ac)"],
            "crypto": latest["Crypto (\u20ac)"],
            "change": latest["Change (\u20ac)"],
            "change_pct": latest["Change (%)"],
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def get_today_date():
    today = date.today()
    return today.strftime("%Y-%m-%d")

def copy_format_and_formulas(sh, ws, next_row, last_row, num_cols):
    sh.batch_update({
        "requests": [
            {
                "copyPaste": {
                    "source": {"sheetId": ws.id, "startRowIndex": last_row - 1, "endRowIndex": last_row, "startColumnIndex": 0, "endColumnIndex": num_cols},
                    "destination": {"sheetId": ws.id, "startRowIndex": next_row - 1, "endRowIndex": next_row, "startColumnIndex": 0, "endColumnIndex": num_cols},
                    "pasteType": "PASTE_FORMULA",
                    "pasteOrientation": "NORMAL"
                }
            },
            {
                "copyPaste": {
                    "source": {"sheetId": ws.id, "startRowIndex": last_row - 1, "endRowIndex": last_row, "startColumnIndex": 0, "endColumnIndex": num_cols},
                    "destination": {"sheetId": ws.id, "startRowIndex": next_row - 1, "endRowIndex": next_row, "startColumnIndex": 0, "endColumnIndex": num_cols},
                    "pasteType": "PASTE_FORMAT",
                    "pasteOrientation": "NORMAL"
                }
            }
        ]
    })

def get_account_columns(ws):
    """Account names are whatever columns sit between 'Date' and the 'Total' column."""
    headers = ws.row_values(1)
    accounts = []
    for h in headers[1:]:
        h = (h or "").strip()
        if not h or h.lower().startswith("total"):
            break
        accounts.append(h)
    return accounts

def account_range(row, account_count):
    start = rowcol_to_a1(row, 2)  # column B, right after Date
    end = rowcol_to_a1(row, 1 + account_count)
    return f'{start}:{end}'

@portfolio_bp.route('/accounts', methods=['GET'])
def get_accounts():
    try:
        return jsonify({
            "stocks_accounts": get_account_columns(get_worksheet("stocks")),
            "loans_accounts": get_account_columns(get_worksheet("loans")),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@portfolio_bp.route('/add-snapshot', methods=['POST'])
def add_snapshot():
    try:
        body = request.get_json()
        sh = get_spreadsheet()
        current_date = get_today_date()

        master_ws = get_worksheet("master")
        stocks_ws = get_worksheet("stocks")
        loans_ws = get_worksheet("loans")

        stocks_accounts = get_account_columns(stocks_ws)
        loans_accounts = get_account_columns(loans_ws)

        # calculate next rows before any insertions
        master_next = len(master_ws.col_values(1)) + 1
        stocks_next = len(stocks_ws.col_values(1)) + 1
        loans_next = len(loans_ws.col_values(1)) + 1

        # insert all empty rows first
        master_ws.insert_row([], master_next)
        stocks_ws.insert_row([], stocks_next)
        loans_ws.insert_row([], loans_next)

        # copy formulas and formatting
        copy_format_and_formulas(sh, master_ws, master_next, master_next - 1, 13)
        copy_format_and_formulas(sh, stocks_ws, stocks_next, stocks_next - 1, len(stocks_accounts) + 2)
        copy_format_and_formulas(sh, loans_ws, loans_next, loans_next - 1, len(loans_accounts) + 2)

        # finally update manual values
        master_ws.update(f'A{master_next}', [[current_date]], value_input_option='USER_ENTERED')
        master_ws.update(f'D{master_next}', [[body["crypto"]]], value_input_option='USER_ENTERED')
        master_ws.update(f'F{master_next}', [[body["cash"]]], value_input_option='USER_ENTERED')

        stocks_values = body.get("stocks", {})
        if stocks_accounts:
            row_values = [stocks_values.get(acc, 0) for acc in stocks_accounts]
            stocks_ws.update(account_range(stocks_next, len(stocks_accounts)), [row_values], value_input_option='USER_ENTERED')

        loans_values = body.get("loans", {})
        if loans_accounts:
            row_values = [loans_values.get(acc, 0) for acc in loans_accounts]
            loans_ws.update(account_range(loans_next, len(loans_accounts)), [row_values], value_input_option='USER_ENTERED')

        note = body.get("note", "").strip()
        if note:
            master_ws.update(f'O{master_next}', [[note]], value_input_option='USER_ENTERED')

        return jsonify({"success": True, "date": current_date})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def get_filled_history():
    rows = get_master_history()
    history = []
    for row in rows:
        total = row.get("Total (€)")
        if not row.get("Date") or not isinstance(total, (int, float)) or total == 0:
            continue
        history.append({
            "date": row.get("Date"),
            "stocks": row.get("Stocks/ETFs (€)") or 0,
            "crypto": row.get("Crypto (€)") or 0,
            "cash": row.get("Cash (€)") or 0,
            "loans": row.get("Loans (€)") or 0,
            "total": total,
            "note": row.get("Notes and important marks", ""),
        })
    return history

@portfolio_bp.route('/history', methods=['GET'])
def get_history():
    try:
        return jsonify(get_filled_history())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@portfolio_bp.route('/performance', methods=['GET'])
def get_performance():
    try:
        history = get_filled_history()
        if len(history) < 2:
            return jsonify({"error": "Not enough snapshots yet to compute performance metrics."}), 400

        first, last = history[0], history[-1]
        days = (parse_date(last["date"]) - parse_date(first["date"])).days
        max_dd, dd_peak_date, dd_trough_date = compute_max_drawdown(history)

        return jsonify({
            "cagr": compute_cagr(history),
            "max_drawdown": max_dd,
            "max_drawdown_peak_date": dd_peak_date,
            "max_drawdown_trough_date": dd_trough_date,
            "sharpe_ratio": compute_sharpe(history),
            "risk_free_rate": read_risk_free_rate(),
            "start_date": first["date"],
            "end_date": last["date"],
            "start_value": first["total"],
            "end_value": last["total"],
            "days": days,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500