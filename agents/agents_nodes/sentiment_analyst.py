import os
import httpx
from langchain_core.messages import HumanMessage
from agents_nodes.llm import llm
from graph.state import MASState


# --- API endpoints ---
FEAR_GREED_URL = "https://api.alternative.me/fng/?limit=1"
CRYPTOPANIC_URL = "https://cryptopanic.com/api/v1/posts/"
CRYPTOPANIC_API_KEY = os.getenv("CRYPTOPANIC_API_KEY", "")


async def fetch_fear_and_greed() -> dict:
    """Fetch the current Fear & Greed index from alternative.me (free, no key needed)."""
    async with httpx.AsyncClient() as client:
        response = await client.get(FEAR_GREED_URL, timeout=10)
        data = response.json()
        latest = data["data"][0]
        return {
            "value": int(latest["value"]),
            "classification": latest["value_classification"],
            # e.g. "Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"
        }


async def fetch_crypto_news(asset: str) -> list[str]:
    """
    Fetch latest crypto news headlines.
    Uses CryptoPanic if API key is set, otherwise falls back to free endpoint.
    """
    # Extract coin symbol from asset e.g. "BTC/USDT" → "BTC"
    coin = asset.split("/")[0].upper()

    headlines = []

    if CRYPTOPANIC_API_KEY:
        try:
            async with httpx.AsyncClient() as client:
                params = {
                    "auth_token": CRYPTOPANIC_API_KEY,
                    "currencies": coin,
                    "kind": "news",
                    "filter": "hot",
                    "limit": 10
                }
                response = await client.get(CRYPTOPANIC_URL, params=params, timeout=10)
                data = response.json()
                headlines = [post["title"] for post in data.get("results", [])]
        except Exception:
            headlines = []

    # Fallback — use free CryptoPanic endpoint (no key, limited)
    if not headlines:
        try:
            async with httpx.AsyncClient() as client:
                params = {
                    "auth_token": "anonymous",
                    "currencies": coin,
                    "kind": "news",
                    "limit": 10
                }
                response = await client.get(CRYPTOPANIC_URL, params=params, timeout=10)
                data = response.json()
                headlines = [post["title"] for post in data.get("results", [])]
        except Exception:
            headlines = [f"Could not fetch news for {coin}"]

    return headlines[:10]  # max 10 headlines


def classify_fear_greed(value: int) -> str:
    """Convert numeric F&G value to trading bias."""
    if value <= 25:
        return "EXTREME FEAR — contrarian buy signal, market may be oversold"
    elif value <= 45:
        return "FEAR — cautious, market is nervous"
    elif value <= 55:
        return "NEUTRAL — no strong sentiment signal"
    elif value <= 75:
        return "GREED — market is optimistic, watch for overextension"
    else:
        return "EXTREME GREED — contrarian sell signal, market may be overbought"


def build_prompt(asset: str, fear_greed: dict, headlines: list[str]) -> str:
    """Build the prompt to send to Groq."""
    headlines_text = "\n".join([f"- {h}" for h in headlines]) if headlines else "- No headlines available"

    return f"""You are a professional crypto sentiment analyst. Analyze the following market sentiment data for {asset} and provide a trading signal.

## Fear & Greed Index
- Current Value: {fear_greed['value']} / 100
- Classification: {fear_greed['classification']}
- Trading Implication: {classify_fear_greed(fear_greed['value'])}

## Latest News Headlines
{headlines_text}

## How to Interpret Sentiment
- Extreme Fear (0-25): Often a contrarian BUY signal — market is overly pessimistic
- Fear (26-45): Bearish sentiment, approach with caution
- Neutral (46-55): No strong sentiment bias
- Greed (56-75): Bullish sentiment, but watch for overextension
- Extreme Greed (76-100): Often a contrarian SELL signal — market is overly optimistic

## Your Task
Analyze BOTH the Fear & Greed index AND the news headlines together.
Look for:
- Are headlines confirming or contradicting the F&G reading?
- Any major news events (ETF approvals, hacks, regulations, whale moves)?
- Overall market mood

Provide:
1. Signal: LONG, SHORT, or NEUTRAL
2. Confidence: a number between 0.0 and 1.0
3. Reasoning: 2-3 sentences explaining your sentiment analysis

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


async def sentiment_analyst_node(state: MASState) -> dict:
    """
    Sentiment Analyst Agent.
    Fetches Fear & Greed index + latest crypto news headlines,
    sends to Groq for interpretation, returns a sentiment signal.
    """
    try:
        asset = state["asset"]

        # 1. Fetch Fear & Greed index (free, no key needed)
        fear_greed = await fetch_fear_and_greed()

        # 2. Fetch latest news headlines
        headlines = await fetch_crypto_news(asset)

        # 3. Build prompt and ask Groq
        prompt = build_prompt(asset, fear_greed, headlines)
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        response_text = response.content

        # 4. Parse response
        signal = parse_response(response_text)

        # 5. Build message for debate log
        fg_emoji = (
            "😱" if fear_greed["value"] <= 25 else
            "😨" if fear_greed["value"] <= 45 else
            "😐" if fear_greed["value"] <= 55 else
            "😊" if fear_greed["value"] <= 75 else
            "🤑"
        )

        message_content = (
            f"📰 Sentiment Analyst Report\n"
            f"Asset: {asset}\n"
            f"Fear & Greed: {fg_emoji} {fear_greed['value']}/100 — {fear_greed['classification']}\n"
            f"Headlines analyzed: {len(headlines)}\n"
            f"Signal: {signal['signal'].upper()} (confidence: {signal['confidence']})\n"
            f"Reasoning: {signal['reasoning']}"
        )

        return {
            "sentiment": {
                "signal": signal["signal"],
                "confidence": signal["confidence"],
                "reasoning": signal["reasoning"]
            },
            "messages": [HumanMessage(content=message_content, name="sentiment_analyst")]
        }

    except Exception as e:
        error_msg = f"Sentiment Analyst error: {str(e)}"
        return {
            "sentiment": {
                "signal": "neutral",
                "confidence": 0.0,
                "reasoning": f"Error occurred: {str(e)}"
            },
            "messages": [HumanMessage(content=error_msg, name="sentiment_analyst")],
            "error": error_msg
        }