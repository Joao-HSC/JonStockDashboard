import stock_funcs
from db import get_sheet_data

import gspread
from flask import Flask, jsonify
import json 

app = Flask(__name__)

# Load credentials and authorize
gc = gspread.service_account(filename='./credentials/service_account.json')
with open('./credentials/sheet.json') as f:
    sheet_config = json.load(f)

# Register blueprint
from routes.portfolio import portfolio_bp
app.register_blueprint(portfolio_bp, url_prefix='/portfolio')

@app.route('/home', methods=['GET'])
def get_data():
    data = get_sheet_data() 
    return jsonify(data)

@app.route('/routes', methods=['GET'])
def list_routes():
    return jsonify([str(rule) for rule in app.url_map.iter_rules()])

if __name__ == '__main__':
    app.run(debug=True)