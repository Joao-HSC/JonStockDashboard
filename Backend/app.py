import stock_funcs
from db import get_sheet_data

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='../Frontend', static_url_path='')
CORS(app)

# Register blueprint
from routes.portfolio import portfolio_bp
app.register_blueprint(portfolio_bp, url_prefix='/portfolio')

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/home', methods=['GET'])
def get_data():
    data = get_sheet_data()
    return jsonify(data)

@app.route('/routes', methods=['GET'])
def list_routes():
    return jsonify([str(rule) for rule in app.url_map.iter_rules()])

if __name__ == '__main__':
    app.run(debug=True)