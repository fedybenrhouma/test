import os
import httpx
from langchain_core.messages import HumanMessage
from agents_nodes.llm import llm
from graph.state import MASState
from agents_nodes.news_embedder import retrieve_relevant_news
import psycopg2


# --- API endpoints ---
FEAR_GREED_URL = "https://api.alternative.me/fng/?limit=1"
POSTGRES_URL = os.getenv("POSTGRES_URL")

def get_db_connection():
    return psycopg2.connect(POSTGRES_URL)

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

def build_prompt(asset: str, fear_greed: dict, news_results: list[tuple]) -> str:
    """Build the prompt to send to Groq using the new RAG instructions."""
    
    if news_results:
        # Expected tuple: (title, content, source, created_at, similarity_score)
        news_text_list = []
        for i, (title, content, source, created_at, similarity) in enumerate(news_results):
            # Format the created_at timestamp string
            date_str = created_at.strftime('%Y-%m-%d %H:%M') if hasattr(created_at, 'strftime') else str(created_at)
            news_text_list.append(
                f"[Article {i+1} | Source: {source} | Date: {date_str} | Similarity: {similarity:.2f}]\n"
                f"Title: {title}\n"
                f"Content: {content}\n"
            )
        news_context = "\n".join(news_text_list)
    else:
        news_context = "No relevant news found in the last 24 hours."

    return f"""You are a professional crypto sentiment analyst specializing in {asset}.

━━━ FEAR & GREED INDEX ━━━
Value: {fear_greed['value']}/100
Classification: {fear_greed['classification']}
Implication: {classify_fear_greed(fear_greed['value'])}

━━━ RELEVANT NEWS (semantically matched, last 24h) ━━━
{news_context}

━━━ ANALYSIS INSTRUCTIONS ━━━
- Does news confirm or contradict Fear & Greed?
- Are headlines about {asset} specifically or general crypto noise?
- Do multiple sources agree or contradict?
- Look for: ETF news, regulations, hacks, whale moves, exchange issues

━━━ RULES ━━━
- Never give LONG or SHORT with confidence below 0.55
- If news and Fear & Greed contradict, lower confidence and explain
- If fewer than 2 articles available, cap confidence at 0.60
- NEUTRAL is always valid

━━━ OUTPUT ━━━
Respond in this EXACT format:
SIGNAL: <LONG|SHORT|NEUTRAL>
CONFIDENCE: <0.0-1.0>
REASONING: <3-5 sentences>
WARNINGS: <contradictions or NONE>"""

def parse_response(response_text: str) -> dict:
    """Parse Groq response into structured signal matching the new format."""
    lines = response_text.strip().split("\n")
    result = {
        "signal": "neutral", 
        "confidence": 0.5, 
        "reasoning": response_text,
        "warnings": "NONE"
    }

    for line in lines:
        if line.startswith("SIGNAL:"):
            raw = line.replace("SIGNAL:", "").strip().lower()
            if raw in ["long", "short", "neutral"]:
                result["signal"] = raw
        elif line.startswith("CONFIDENCE:"):
            try:
                result["confidence"] = float(line.replace("CONFIDENCE:", "").strip())
            except ValueError:
                pass
        elif line.startswith("REASONING:"):
            result["reasoning"] = line.replace("REASONING:", "").strip()
        elif line.startswith("WARNINGS:"):
            result["warnings"] = line.replace("WARNINGS:", "").strip()

    return result

async def sentiment_analyst_node(state: MASState) -> dict:
    """
    Sentiment Analyst Agent (RAG Enabled).
    Fetches Fear & Greed index + similar news via pgvector embeddings,
    sends to Groq for interpretation, returns a sentiment signal.
    """
    try:
        asset = state["asset"]
        coin = asset.split("/")[0].upper()

        # 1. Fetch Fear & Greed index (free, no key needed)
        fear_greed = await fetch_fear_and_greed()

        # 2. Retrieve Relevant News (RAG Pipeline)
        conn = get_db_connection()
        try:
            # Query the database for the asset using the news_embedder
            news_results = await retrieve_relevant_news(
                conn, 
                query=f"{coin} news crypto", 
                asset=coin, 
                limit=5, 
                hours_back=24
            )
        finally:
            conn.close()

        # 3. Build prompt and ask Groq
        prompt = build_prompt(asset, fear_greed, news_results)
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
            f"RAG News Analyzed: {len(news_results)} articles\n"
            f"Signal: {signal['signal'].upper()} (confidence: {signal['confidence']})\n"
            f"Reasoning: {signal['reasoning']}\n"
            f"Warnings: {signal['warnings']}"
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