import ccxt
import pandas as pd
import ta
from langchain_core.messages import HumanMessage
from agents_nodes.llm import llm
from graph.state import MASState


def fetch_ohlcv(asset: str, timeframe: str, limit: int = 100) -> pd.DataFrame:
    """Fetch OHLCV candles from Binance."""
    exchange = ccxt.binance()
    ohlcv = exchange.fetch_ohlcv(asset, timeframe, limit=limit)
    df = pd.DataFrame(ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"])
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
    return df


def calculate_trend_indicators(df: pd.DataFrame) -> dict:
    """Calculate trend indicators on higher timeframe."""

    # --- EMA 20, 50, 200 ---
    df["ema_20"]  = ta.trend.EMAIndicator(close=df["close"], window=20).ema_indicator()
    df["ema_50"]  = ta.trend.EMAIndicator(close=df["close"], window=50).ema_indicator()
    df["ema_200"] = ta.trend.EMAIndicator(close=df["close"], window=200).ema_indicator()

    # --- ADX (trend strength) ---
    adx = ta.trend.ADXIndicator(high=df["high"], low=df["low"], close=df["close"], window=14)
    df["adx"] = adx.adx()

    # --- Price action ---
    df["higher_high"] = df["high"] > df["high"].shift(1)
    df["higher_low"]  = df["low"]  > df["low"].shift(1)
    df["lower_high"]  = df["high"] < df["high"].shift(1)
    df["lower_low"]   = df["low"]  < df["low"].shift(1)

    latest = df.iloc[-1]
    prev   = df.iloc[-2]

    # Count last 5 candles for HH/HL or LH/LL pattern
    last_5 = df.iloc[-5:]
    bullish_structure = (
        last_5["higher_high"].sum() >= 3 and
        last_5["higher_low"].sum() >= 3
    )
    bearish_structure = (
        last_5["lower_high"].sum() >= 3 and
        last_5["lower_low"].sum() >= 3
    )

    return {
        "current_price": round(float(latest["close"]), 2),
        "ema_20":  round(float(latest["ema_20"]), 2),
        "ema_50":  round(float(latest["ema_50"]), 2),
        "ema_200": round(float(latest["ema_200"]), 2),
        "adx":     round(float(latest["adx"]), 2),
        "trend_strong": float(latest["adx"]) > 25,   # ADX > 25 = strong trend
        "price_above_ema200": float(latest["close"]) > float(latest["ema_200"]),
        "price_above_ema50":  float(latest["close"]) > float(latest["ema_50"]),
        "price_above_ema20":  float(latest["close"]) > float(latest["ema_20"]),
        "ema_20_above_50":    float(latest["ema_20"]) > float(latest["ema_50"]),
        "ema_50_above_200":   float(latest["ema_50"]) > float(latest["ema_200"]),
        "bullish_structure":  bullish_structure,
        "bearish_structure":  bearish_structure,
    }


def build_prompt(asset: str, timeframe: str, indicators: dict) -> str:
    """Build the prompt to send to Groq."""
    return f"""You are a professional crypto trend analyst. Analyze the following macro trend data for {asset} on the {timeframe} timeframe and determine the overall market bias.

## Current Market Data
- Price: ${indicators['current_price']:,}
- Timeframe: {timeframe} (higher timeframe — macro bias)

## EMA Trend Structure
- EMA 20:  ${indicators['ema_20']:,}
- EMA 50:  ${indicators['ema_50']:,}
- EMA 200: ${indicators['ema_200']:,}
- Price above EMA 200: {indicators['price_above_ema200']} (long-term bullish if True)
- Price above EMA 50:  {indicators['price_above_ema50']}
- Price above EMA 20:  {indicators['price_above_ema20']}
- EMA 20 above EMA 50:   {indicators['ema_20_above_50']} (short-term bullish if True)
- EMA 50 above EMA 200:  {indicators['ema_50_above_200']} (medium-term bullish if True)

## ADX (Trend Strength)
- ADX: {indicators['adx']}
- Strong trend (ADX > 25): {indicators['trend_strong']}
- Note: ADX measures trend STRENGTH not direction. Below 25 = choppy/ranging market.

## Price Structure (last 5 candles)
- Bullish structure (Higher Highs + Higher Lows): {indicators['bullish_structure']}
- Bearish structure (Lower Highs + Lower Lows):  {indicators['bearish_structure']}

## Your Task
Based on the macro trend data above, provide:
1. Signal: LONG, SHORT, or NEUTRAL
   - LONG = macro trend is bullish, bias is to buy dips
   - SHORT = macro trend is bearish, bias is to sell rallies
   - NEUTRAL = ranging market, no clear trend
2. Confidence: a number between 0.0 and 1.0
3. Reasoning: 2-3 sentences explaining the macro bias

Respond in this exact format:
SIGNAL: <LONG|SHORT|NEUTRAL>
CONFIDENCE: <0.0-1.0>
REASONING: <your reasoning here>"""


def parse_response(response_text: str) -> dict:
    """Parse Groq response into structured signal."""
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


async def trend_agent_node(state: MASState) -> dict:
    """
    Trend Agent — analyzes macro trend on higher timeframes.
    Uses daily candles regardless of the trading timeframe
    to determine the overall market bias.
    """
    try:
        asset = state["asset"]

        # Always use daily candles for macro trend
        # regardless of what timeframe the trade is on
        higher_timeframe = "1d"

        # 1. Fetch daily candles
        df = fetch_ohlcv(asset, higher_timeframe, limit=200)

        # 2. Calculate trend indicators
        indicators = calculate_trend_indicators(df)

        # 3. Build prompt and ask Groq
        prompt = build_prompt(asset, higher_timeframe, indicators)
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        response_text = response.content

        # 4. Parse response
        signal = parse_response(response_text)

        # 5. Build message for debate log
        ema_stack = "🟢 Bullish" if (
            indicators["ema_20_above_50"] and indicators["ema_50_above_200"]
        ) else "🔴 Bearish" if (
            not indicators["ema_20_above_50"] and not indicators["ema_50_above_200"]
        ) else "🟡 Mixed"

        message_content = (
            f"📊 Trend Agent Report (Daily Timeframe)\n"
            f"Asset: {asset}\n"
            f"Price: ${indicators['current_price']:,}\n"
            f"EMA Stack: {ema_stack}\n"
            f"ADX: {indicators['adx']} ({'Strong trend' if indicators['trend_strong'] else 'Weak/Ranging'})\n"
            f"Price above EMA 200: {indicators['price_above_ema200']}\n"
            f"Signal: {signal['signal'].upper()} (confidence: {signal['confidence']})\n"
            f"Reasoning: {signal['reasoning']}"
        )

        return {
            "trend": {
                "signal": signal["signal"],
                "confidence": signal["confidence"],
                "reasoning": signal["reasoning"]
            },
            "messages": [HumanMessage(content=message_content, name="trend_agent")]
        }

    except Exception as e:
        error_msg = f"Trend Agent error: {str(e)}"
        return {
            "trend": {
                "signal": "neutral",
                "confidence": 0.0,
                "reasoning": f"Error occurred: {str(e)}"
            },
            "messages": [HumanMessage(content=error_msg, name="trend_agent")],
            "error": error_msg
        }