import os
import ccxt
import pandas as pd
import ta
from langchain_core.messages import HumanMessage
from graph.state import MASState


# --- Configuration ---
ATR_PERIOD = 14          # Standard ATR period
ATR_THRESHOLD = 0.02     # 2% of price = high volatility


def fetch_ohlcv(asset: str, timeframe: str, limit: int = 100) -> pd.DataFrame:
    """Fetch OHLCV candles from Binance."""
    exchange = ccxt.binance()
    ohlcv = exchange.fetch_ohlcv(asset, timeframe, limit=limit)
    df = pd.DataFrame(ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"])
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
    return df


def calculate_atr(df: pd.DataFrame) -> float:
    """Calculate the latest ATR value."""
    atr_indicator = ta.volatility.AverageTrueRange(
        high=df["high"],
        low=df["low"],
        close=df["close"],
        window=ATR_PERIOD
    )
    atr_series = atr_indicator.average_true_range()
    return float(atr_series.iloc[-1])


async def volatility_agent_node(state: MASState) -> dict:
    """
    Volatility Agent — pure rule-based, no Claude needed.
    Calculates ATR and flags if market is too volatile to trade safely.
    """
    try:
        asset = state["asset"]
        timeframe = state["timeframe"]

        # 1. Fetch candles
        df = fetch_ohlcv(asset, timeframe)

        # 2. Calculate ATR
        atr = calculate_atr(df)

        # 3. Get current price
        current_price = float(df["close"].iloc[-1])

        # 4. Calculate ATR as percentage of price
        atr_pct = atr / current_price

        # 5. Determine if volatility is high
        high_volatility = atr_pct > ATR_THRESHOLD

        # 6. Build result
        volatility_result = {
            "atr": round(atr, 4),
            "atr_pct": round(atr_pct * 100, 4),   # as percentage e.g. 1.85%
            "current_price": current_price,
            "high_volatility": high_volatility,
            "verdict": "HIGH VOLATILITY — trade with caution" if high_volatility else "NORMAL — safe to trade"
        }

        # 7. Log to debate messages
        message_content = (
            f"📊 Volatility Agent Report\n"
            f"Asset: {asset} | Timeframe: {timeframe}\n"
            f"Current Price: ${current_price:,.2f}\n"
            f"ATR: {atr:.4f} ({atr_pct*100:.2f}% of price)\n"
            f"Verdict: {volatility_result['verdict']}"
        )

        return {
            "volatility": volatility_result,
            "messages": [HumanMessage(content=message_content, name="volatility_agent")]
        }

    except Exception as e:
        error_msg = f"Volatility Agent error: {str(e)}"
        return {
            "volatility": {
                "atr": 0.0,
                "atr_pct": 0.0,
                "current_price": 0.0,
                "high_volatility": False,
                "verdict": f"ERROR: {str(e)}"
            },
            "messages": [HumanMessage(content=error_msg, name="volatility_agent")],
            "error": error_msg
        }