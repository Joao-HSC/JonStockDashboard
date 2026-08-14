import statistics
import os
from datetime import datetime

RISK_FREE_RATE_FILE = os.path.join(os.path.dirname(__file__), "risk_free_rate.txt")

def read_risk_free_rate():
    with open(RISK_FREE_RATE_FILE) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            return float(line.rstrip("%")) / 100
    raise ValueError(f"No risk-free rate value found in {RISK_FREE_RATE_FILE}")

def parse_date(date_str):
    return datetime.strptime(date_str, "%d %B %Y")

def compute_cagr(history):
    first, last = history[0], history[-1]
    years = (parse_date(last["date"]) - parse_date(first["date"])).days / 365.25
    if years <= 0 or first["total"] <= 0:
        return None
    return (last["total"] / first["total"]) ** (1 / years) - 1

def compute_max_drawdown(history):
    peak = history[0]["total"]
    peak_date = history[0]["date"]
    max_dd = 0
    max_dd_peak_date = peak_date
    max_dd_trough_date = peak_date
    for row in history:
        if row["total"] > peak:
            peak = row["total"]
            peak_date = row["date"]
        drawdown = (row["total"] - peak) / peak if peak else 0
        if drawdown < max_dd:
            max_dd = drawdown
            max_dd_peak_date = peak_date
            max_dd_trough_date = row["date"]
    return max_dd, max_dd_peak_date, max_dd_trough_date

def resample_monthly(history):
    monthly = {}
    for row in history:
        d = parse_date(row["date"])
        monthly[(d.year, d.month)] = row
    return [monthly[key] for key in sorted(monthly.keys())]

def compute_sharpe(history, risk_free_annual=None):
    if risk_free_annual is None:
        risk_free_annual = read_risk_free_rate()
    monthly = resample_monthly(history)
    if len(monthly) < 3:
        return None

    returns = []
    for i in range(1, len(monthly)):
        prev, curr = monthly[i - 1]["total"], monthly[i]["total"]
        if prev > 0:
            returns.append((curr - prev) / prev)

    if len(returns) < 2:
        return None

    stdev_r = statistics.stdev(returns)
    if stdev_r == 0:
        return None

    monthly_rf = (1 + risk_free_annual) ** (1 / 12) - 1
    return (statistics.mean(returns) - monthly_rf) / stdev_r * (12 ** 0.5)
