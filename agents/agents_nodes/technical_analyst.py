import os
import ccxt
import pandas as pd
import ta
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage
from graph.state import MASState
from dotenv import load_dotenv

load_dotenv()


# --- Claude setup ---


llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    api_key=os.getenv("GROQ_API_KEY"),
    max_tokens=1000
)


def fetch_ohlcv(asset: str, timeframe: str, limit: int = 100) -> pd.DataFrame:
    """Fetch OHLCV candles from Binance."""
    exchange = ccxt.binance()
    ohlcv = exchange.fetch_ohlcv(asset, timeframe, limit=limit)
    df = pd.DataFrame(ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"])
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
    return df


def calculate_indicators(df: pd.DataFrame) -> dict:
    """Calculate all technical indicators."""

    # --- RSI ---
    rsi = ta.momentum.RSIIndicator(close=df["close"], window=14)
    df["rsi"] = rsi.rsi()

    # --- MACD ---
    macd = ta.trend.MACD(close=df["close"])
    df["macd"] = macd.macd()
    df["macd_signal"] = macd.macd_signal()
    df["macd_diff"] = macd.macd_diff()

    # --- Bollinger Bands ---
    bb = ta.volatility.BollingerBands(close=df["close"], window=20, window_dev=2)
    df["bb_upper"] = bb.bollinger_hband()
    df["bb_lower"] = bb.bollinger_lband()
    df["bb_mid"] = bb.bollinger_mavg()

    # --- EMA ---
    df["ema_20"] = ta.trend.EMAIndicator(close=df["close"], window=20).ema_indicator()
    df["ema_50"] = ta.trend.EMAIndicator(close=df["close"], window=50).ema_indicator()

    # --- Get latest values ---
    latest = df.iloc[-1]
    prev = df.iloc[-2]

    return {
        "current_price": round(float(latest["close"]), 2),
        "rsi": round(float(latest["rsi"]), 2),
        "macd": round(float(latest["macd"]), 4),
        "macd_signal": round(float(latest["macd_signal"]), 4),
        "macd_diff": round(float(latest["macd_diff"]), 4),
        "macd_crossover": float(prev["macd_diff"]) < 0 and float(latest["macd_diff"]) > 0,
        "macd_crossunder": float(prev["macd_diff"]) > 0 and float(latest["macd_diff"]) < 0,
        "bb_upper": round(float(latest["bb_upper"]), 2),
        "bb_lower": round(float(latest["bb_lower"]), 2),
        "bb_mid": round(float(latest["bb_mid"]), 2),
        "price_above_bb_upper": float(latest["close"]) > float(latest["bb_upper"]),
        "price_below_bb_lower": float(latest["close"]) < float(latest["bb_lower"]),
        "ema_20": round(float(latest["ema_20"]), 2),
        "ema_50": round(float(latest["ema_50"]), 2),
        "ema_bullish_cross": float(latest["ema_20"]) > float(latest["ema_50"]),
    }


def build_prompt(asset: str, timeframe: str, indicators: dict) -> str:
    """Build the prompt to send to Claude."""
    return f"""You are a professional crypto technical analyst. Analyze the following indicators for {asset} on the {timeframe} timeframe and give a trading signal.

## Current Market Data
- Price: ${indicators['current_price']:,}
- Timeframe: {timeframe}

## Indicators
**RSI (14):** {indicators['rsi']}
- Below 30 = oversold (bullish), Above 70 = overbought (bearish)

**MACD:**
- MACD Line: {indicators['macd']}
- Signal Line: {indicators['macd_signal']}
- Histogram: {indicators['macd_diff']}
- Bullish Crossover just happened: {indicators['macd_crossover']}
- Bearish Crossunder just happened: {indicators['macd_crossunder']}

**Bollinger Bands:**
- Upper: ${indicators['bb_upper']:,}
- Mid: ${indicators['bb_mid']:,}
- Lower: ${indicators['bb_lower']:,}
- Price above upper band: {indicators['price_above_bb_upper']}
- Price below lower band: {indicators['price_below_bb_lower']}

**EMA:**
- EMA 20: ${indicators['ema_20']:,}
- EMA 50: ${indicators['ema_50']:,}
- EMA 20 above EMA 50 (bullish): {indicators['ema_bullish_cross']}

## Your Task
Based on ALL indicators above, provide:
1. Signal: LONG, SHORT, or NEUTRAL
2. Confidence: a number between 0.0 and 1.0
3. Reasoning: 2-3 sentences explaining your decision

Respond in this exact format:
SIGNAL: <LONG|SHORT|NEUTRAL>
CONFIDENCE: <0.0-1.0>
REASONING: <your reasoning here>"""


def parse_claude_response(response_text: str) -> dict:
    """Parse Claude's response into structured signal."""
    lines = response_text.strip().split("\n")
    result = {"signal": "neutral", "confidence": 0.5, "reasoning": response_text}

    for line in lines:
        if line.startswith("SIGNAL:"):
            raw = line.replace("SIGNAL:", "").strip().lower()
            if raw in ["long", "short", "neutral"]:
                result["signal"] = raw
        elif line.startswith("CONFIDENCE:"):
            try:
                result["confidence"] = float(line.replace("CONFIDENCE:", "").strip())
            except ValueError:
                result["confidence"] = 0.5
        elif line.startswith("REASONING:"):
            result["reasoning"] = line.replace("REASONING:", "").strip()

    return result


async def technical_analyst_node(state: MASState) -> dict:
    """
    Technical Analyst Agent.
    Fetches live candles from Binance, calculates indicators,
    sends to Claude for interpretation, returns a trading signal.
    """
    try:
        asset = state["asset"]
        timeframe = state["timeframe"]

        # 1. Fetch candles
        df = fetch_ohlcv(asset, timeframe)

        # 2. Calculate indicators
        indicators = calculate_indicators(df)

        # 3. Build prompt and ask Claude
        prompt = build_prompt(asset, timeframe, indicators)
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        response_text = response.content

        # 4. Parse Claude's response
        signal = parse_claude_response(response_text)

        # 5. Build message for debate log
        message_content = (
            f"📈 Technical Analyst Report\n"
            f"Asset: {asset} | Timeframe: {timeframe}\n"
            f"Price: ${indicators['current_price']:,}\n"
            f"RSI: {indicators['rsi']} | MACD Crossover: {indicators['macd_crossover']}\n"
            f"Signal: {signal['signal'].upper()} (confidence: {signal['confidence']})\n"
            f"Reasoning: {signal['reasoning']}"
        )

        return {
            "technical": {
                "signal": signal["signal"],
                "confidence": signal["confidence"],
                "reasoning": signal["reasoning"]
            },
            "messages": [HumanMessage(content=message_content, name="technical_analyst")]
        }

    except Exception as e:
        error_msg = f"Technical Analyst error: {str(e)}"
        return {
            "technical": {
                "signal": "neutral",
                "confidence": 0.0,
                "reasoning": f"Error occurred: {str(e)}"
            },
            "messages": [HumanMessage(content=error_msg, name="technical_analyst")],
            "error": error_msg
        }