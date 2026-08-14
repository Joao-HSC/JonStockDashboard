import gspread
import json

gc = gspread.service_account(filename='./credentials/service_account.json')
with open('./credentials/sheet.json') as f:
    sheet_config = json.load(f)

def get_spreadsheet():
    return gc.open_by_key(sheet_config["spreadsheet_id"])

def get_sheet_data():
    return get_spreadsheet().sheet1.get_all_records()

def get_master_history():
    ws = get_spreadsheet().sheet1
    values = ws.get_values(
        value_render_option='UNFORMATTED_VALUE',
        date_time_render_option='FORMATTED_STRING',
    )
    headers, rows = values[0], values[1:]
    return [dict(zip(headers, row)) for row in rows]