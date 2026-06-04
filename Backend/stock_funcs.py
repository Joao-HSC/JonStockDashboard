# This module contains functions related to stock operations, such as calculating the current price of a stock based on its price and amount.

import yfinance as yf

def get_transaction_value(transaction_price, stock_amount):
    return transaction_price * stock_amount

def get_current_stock_price(stock_symbol):
    try:
        stock = yf.Ticker(stock_symbol)
        current_price = stock.info['regularMarketPrice']
        return current_price
    except Exception as e:
        print(f"Error fetching stock price for {stock_symbol}: {e}")
        return None
    
def PnL(current_price, purchase_price, stock_amount):  # take price as param instead
    return (current_price - purchase_price) * stock_amount

def make_transaction_dict(stock_symbol, stock_amount, purchase_price):
    current_price = get_current_stock_price(stock_symbol)
    if current_price is not None:
        transaction_value = get_transaction_value(current_price, stock_amount)
        return {
            "stock_symbol": stock_symbol,
            "stock_amount": stock_amount,
            "purchase_price": purchase_price,
            "current_price": current_price,
            "transaction_value": transaction_value,
            "PnL": PnL(current_price, purchase_price, stock_amount)
        }
    else:
        return None
