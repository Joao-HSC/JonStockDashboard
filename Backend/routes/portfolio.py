from db import get_spreadsheet, get_sheet_data
import stock_funcs
from datetime import date
import re
from flask import Blueprint, jsonify, request

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

@portfolio_bp.route('/add-snapshot', methods=['POST'])
def add_snapshot():
    try:
        body = request.get_json()
        sh = get_spreadsheet()
        current_date = get_today_date()

        master_ws = sh.get_worksheet(0)
        stocks_ws = sh.worksheet("Stocks/ETFs")
        loans_ws = sh.worksheet("Loans")

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
        copy_format_and_formulas(sh, stocks_ws, stocks_next, stocks_next - 1, 6)
        copy_format_and_formulas(sh, loans_ws, loans_next, loans_next - 1, 5)

        # finally update manual values
        master_ws.update(f'A{master_next}', [[current_date]], value_input_option='USER_ENTERED')
        master_ws.update(f'D{master_next}', [[body["crypto"]]], value_input_option='USER_ENTERED')
        master_ws.update(f'F{master_next}', [[body["cash"]]], value_input_option='USER_ENTERED')
        stocks_ws.update(f'B{stocks_next}:E{stocks_next}', [[body["revolut"], body["trading212"], body["xtb"], body["robinhood"]]], value_input_option='USER_ENTERED')
        loans_ws.update(f'B{loans_next}:D{loans_next}', [[body["personal"], body["twino"], body["peerberry"]]], value_input_option='USER_ENTERED')

        return jsonify({"success": True, "date": current_date})
    except Exception as e:
        return jsonify({"error": str(e)}), 500