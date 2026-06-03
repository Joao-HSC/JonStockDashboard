import gspread
from flask import Flask, jsonify

app = Flask(__name__)

# Load credentials and authorize
gc = gspread.service_account(filename='./credentials/service_account.json')

def get_sheet_data():
    # Spreadsheet key
    sh = gc.open_by_key("FILE_KEY")
    worksheet = sh.sheet1
    return worksheet.get_all_records()

@app.route('/home', methods=['GET'])
def get_data():
    try:
        data = get_sheet_data()
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)