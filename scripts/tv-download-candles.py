#!/usr/bin/env python3
"""
Download OHLCV candles from TradingView via tv_scraper WITHOUT B-ADJ (Back-Adjustment).
Ensures raw futures contract prices matching broker execution fills.
"""

import argparse
import csv
import os
import sys
from datetime import datetime, timezone

try:
    import tv_scraper.core.validation_data as tv_vd
    import tv_scraper.core.base as tv_base
    EXTENDED_TIMEFRAMES = {
        "1m": "1",
        "3m": "3",
        "5m": "5",
        "15m": "15",
        "30m": "30",
        "1h": "60",
        "2h": "120",
        "4h": "240",
        "1d": "1D",
        "1w": "1W",
        "1mo": "1M",
        "1M": "1M",
    }
    tv_vd.TIMEFRAMES.update(EXTENDED_TIMEFRAMES)
    tv_base.TIMEFRAMES.update(EXTENDED_TIMEFRAMES)
    from tv_scraper import CandleStreamer
except ImportError:
    print("Error: tv_scraper is not installed. Run: pip install tv-scraper", file=sys.stderr)
    sys.exit(1)

EXCHANGE_MAP = {
    "MES": "CME_MINI",
    "MES1!": "CME_MINI",
    "MNQ": "CME_MINI",
    "MNQ1!": "CME_MINI",
    "ES": "CME_MINI",
    "ES1!": "CME_MINI",
    "NQ": "CME_MINI",
    "NQ1!": "CME_MINI",
    "MYM": "CBOT_MINI",
    "MYM1!": "CBOT_MINI",
    "YM": "CBOT",
    "YM1!": "CBOT",
    "CL": "NYMEX",
    "CL1!": "NYMEX",
    "GC": "COMEX",
    "GC1!": "COMEX",
    "BTC": "BINANCE",
    "BTCUSDT": "BINANCE",
    "ETH": "BINANCE",
    "ETHUSDT": "BINANCE",
}

def main():
    parser = argparse.ArgumentParser(
        description="Download raw TradingView candles without B-ADJ via tv_scraper."
    )
    parser.add_argument(
        "-s", "--symbol", default="MES1!", help="Symbol to fetch (e.g. MES1!, NQ1!, ES1!)"
    )
    parser.add_argument(
        "-e",
        "--exchange",
        default="",
        help="Exchange (e.g. CME_MINI, CBOT). Defaults to auto-detection.",
    )
    parser.add_argument(
        "-t",
        "--timeframe",
        default="5m",
        choices=["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "1d", "1w", "1mo"],
        help="Candle timeframe (default: 5m)",
    )
    parser.add_argument(
        "-c",
        "--count",
        type=int,
        default=300,
        help="Number of candles (1 to 5000, default: 300)",
    )
    parser.add_argument(
        "-o",
        "--out",
        default="",
        help="Output CSV file path. Defaults to export/<symbol>_<timeframe>_raw.csv",
    )

    args = parser.parse_args()

    sym_clean = args.symbol.strip().upper()
    exchange = args.exchange.strip().upper() if args.exchange else EXCHANGE_MAP.get(sym_clean, "CME_MINI")

    print(f"Connecting to TradingView via tv_scraper...")
    print(f"Target: {exchange}:{sym_clean} | Timeframe: {args.timeframe} | Count: {args.count}")
    print(f"B-ADJ: OFF (Unadjusted raw prices matching broker fills)")

    streamer = CandleStreamer()
    result = streamer.get_candles(
        exchange=exchange,
        symbol=sym_clean,
        timeframe=args.timeframe,
        numb_candles=args.count,
    )

    if result.get("status") != "success" or not result.get("data") or not result["data"].get("ohlcv"):
        error_msg = result.get("error") or "Unknown error fetching candles"
        print(f"Failed to fetch candles: {error_msg}", file=sys.stderr)
        sys.exit(1)

    bars = result["data"]["ohlcv"]
    print(f"Retrieved {len(bars)} candles successfully.")

    if not args.out:
        safe_sym = sym_clean.replace("!", "").replace(":", "_")
        filename = f"{safe_sym}_{args.timeframe}_websocket.csv"
        if os.path.isdir("export"):
            out_path = os.path.join("export", filename)
        else:
            out_path = filename
    else:
        out_path = args.out
        if os.path.dirname(out_path):
            os.makedirs(os.path.dirname(out_path), exist_ok=True)

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "timestamp",
            "datetime_utc",
            "datetime_local",
            "open",
            "high",
            "low",
            "close",
            "volume",
        ])
        for bar in bars:
            ts = int(bar["timestamp"])
            dt_utc = datetime.fromtimestamp(ts, tz=timezone.utc)
            dt_local = dt_utc.astimezone()
            writer.writerow([
                ts,
                dt_utc.strftime("%Y-%m-%d %H:%M:%S"),
                dt_local.strftime("%Y-%m-%d %H:%M:%S"),
                bar["open"],
                bar["high"],
                bar["low"],
                bar["close"],
                bar.get("volume", 0),
            ])

    print(f"Saved to: {os.path.abspath(out_path)}")
    print(f"Sample price: Open={bars[-1]['open']} Close={bars[-1]['close']}")

if __name__ == "__main__":
    main()
