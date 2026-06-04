import gspread
import json

gc = gspread.service_account(filename='./credentials/service_account.json')
with open('./credentials/sheet.json') as f:
    sheet_config = json.load(f)

def get_spreadsheet():
    return gc.open_by_key(sheet_config["FILE_KEY"])

def get_sheet_data():
    return get_spreadsheet().sheet1.get_all_records()