# Crypto AI Trading Agents Architecture

This document explains the roles, responsibilities, and data states of the various AI agents that power the automated trading system.

The system is built as a **Multi-Agent System (MAS)** using a directed graph architecture. Each agent acts as a specialized "node" in this graph, performing its specific analysis and passing its findings back to a central state (`MASState`) before the next agent takes over.

---

## 🧠 The `MASState` (Multi-Agent System State)

The `MASState` is the single source of truth passed between every agent during a trading cycle. Think of it as a shared clipboard where agents read inputs and write their outputs. 

Here is the exact structure of the `MASState` that flows through the system:

```python
class MASState(TypedDict):
    # --- Identification ---
    user_id: str           # The UUID of the user running the cycle
    cycle_id: str          # A unique UUID for this specific trading decision loop

    # --- Market Parameters ---
    asset: str             # The trading pair (e.g. "BNB/USDT")
    timeframe: str         # The chart timeframe being analyzed (e.g. "1h", "1d")

    # --- Agent Outputs (Signals) ---
    technical: Optional[AgentSignal]     # Written by: Technical Analyst
    sentiment: Optional[AgentSignal]     # Written by: Sentiment Analyst
    trend: Optional[AgentSignal]         # Written by: Trend Agent
    signal_model: Optional[AgentSignal]  # Written by: Signal Agent (ML Model)
    volatility: Optional[dict]           # Written by: Volatility Agent (ATR/BB data)

    # --- Risk & Execution ---
    risk: Optional[dict]                 # Written by: Risk Manager (SL, TP, Leverage)
    
    # --- Debate & Consensus ---
    messages: List[BaseMessage]          # The conversation history between agents
    debate_round: int                    # How many times they have debated
    consensus_reached: bool              # Whether they agreed on a trade direction

    # --- Final Decisions ---
    recommendation: Optional[str]        # Written by: Coordinator (Final action)
    devils_argument: Optional[str]       # Written by: Devil's Advocate
    approved: Optional[bool]             # Whether the trade passed final checks

    # --- Execution Results ---
    order_id: Optional[str]              # Written by: Executor (Binance Order ID)
    
    # --- Monitor Results (Background) ---
    close_reason: Optional[str]          # Written by: Trade Monitor (e.g. 'stop_loss')
    pnl: Optional[float]                 # Written by: Trade Monitor (Profit/Loss)
    error: Optional[str]                 # System errors
```

*An `AgentSignal` always contains a `signal` (LONG/SHORT/NEUTRAL), a `confidence` score (0.0 - 1.0), and a text `reasoning`.*

---

## 🤖 The AI Agents

Below is a breakdown of every agent in the system, what tools they use, and exactly how they mutate the `MASState`.

### 1. 📈 Technical Analyst (`technical_analyst.py`)
- **Role:** Analyzes raw market data to identify immediate price action opportunities.
- **Tools/Models:** 
  - Uses `ccxt` to fetch live OHLCV (candlestick) data from Binance.
  - Uses `ta` (Technical Analysis library) to calculate RSI, MACD, Bollinger Bands, and EMAs.
  - Uses **Groq (Llama-3)** to interpret these indicators and generate human-readable reasoning.
- **State Mutation:** Writes to `state["technical"]` with a LONG/SHORT/NEUTRAL signal and confidence.

### 2. 📊 Trend Agent (`trend_agent.py`)
- **Role:** Looks at the bigger picture to ensure trades align with the macro market direction.
- **Tools/Models:** 
  - Fetches multi-timeframe OHLCV data (e.g., 4h, 1d) via `ccxt`.
  - Calculates ADX (Average Directional Index) and moving average slopes.
  - Uses **Groq (Llama-3)** to assess trend strength and direction.
- **State Mutation:** Writes to `state["trend"]` with a signal confirming or rejecting the macro trend.

### 3. 📰 Sentiment Analyst (`sentiment_analyst.py`)
- **Role:** Measures market fear and greed using external data sources.
- **Tools/Models:** 
  - Fetches the global **Crypto Fear & Greed Index** via an external API.
  - Uses **Groq (Llama-3)** to translate the index score into actionable trading context (e.g., "Extreme Fear = Potential Buying Opportunity").
  - **RAG Enabled:** Queries `pgvector` database via `news_embedder.py` to inject the top 5 most relevant crypto news headlines (embedded using `sentence-transformers`) for the traded asset to give pinpoint context.
- **State Mutation:** Writes to `state["sentiment"]` with a signal based on market psychology.

### 4. 🧠 Signal Agent (Machine Learning) (`signal_agent.py`)
- **Role:** Uses predictive historical modeling rather than traditional rule-based logic.
- **Tools/Models:** 
  - Uses a pre-trained **XGBoost Machine Learning Model** (`signal_model.json`).
  - Feeds current market indicators (RSI, MACD, EMAs) into the XGBoost model to predict the probability of price movement.
- **State Mutation:** Writes to `state["signal_model"]` with its ML-driven prediction.

### 5. 🌊 Volatility Agent (`volatility_agent.py`)
- **Role:** Measures market turbulence to help size positions and set stops safely.
- **Tools/Models:**
  - Calculates **ATR (Average True Range)** to determine the average size of recent price swings.
  - Does *not* use an LLM; relies purely on math.
- **State Mutation:** Writes to `state["volatility"]` (specifically the ATR value). It does not provide a trade direction signal.

### 6. 🛡️ Risk Manager (`risk_manager.py`)
- **Role:** The mathematical backbone of the system. It takes the agreed-upon trade direction and calculates exact entry and exit parameters to protect capital.
- **Tools/Models:** 
  - Reads the user's portfolio balance from PostgreSQL.
  - Uses the ATR from the Volatility Agent to dynamically calculate safe **Stop Loss (SL)** and **Take Profit (TP)** levels based on current market chop.
  - Calculates strict **Position Sizing** based on the user's defined risk percentage per trade.
- **State Mutation:** Writes to `state["risk"]`, containing exact dollar amounts for entry, SL, TP, position size, and leverage.

### 7. ⚖️ Coordinator (`coordinator.py`)
- **Role:** The "Judge" of the system. It reviews all signals from the Analyst agents and decides if a consensus has been reached.
- **Tools/Models:**
  - Uses **Groq (Llama-3)** to weigh the differing opinions of the Technical, Trend, Sentiment, and Signal agents.
  - **RAG Enabled:** Queries `pgvector` database via `trade_memory.py` to retrieve the 5 most similar past trades (both wins and losses) as context to inform its final decision based on historical performance of similar setups.
- **State Mutation:** Writes to `state["recommendation"]` (the final verdict) and sets `state["consensus_reached"]`.

### 8. 😈 Devil's Advocate (`devils_advocate.py`)
- **Role:** The final sanity check. Before any trade is executed, this agent is tasked with aggressively finding reasons why the trade is a *bad* idea.
- **Tools/Models:**
  - Uses **Groq (Llama-3)**. It is fed the Coordinator's recommendation and told to "tear it apart."
  - **RAG Enabled:** Queries `pgvector` database via `trade_memory.py` to retrieve the 5 most similar past *losing* trades. It uses these historical failures to strengthen its veto arguments and prevent groupthink.
  - If it finds critical flaws, it can veto the trade.
- **State Mutation:** Writes to `state["devils_argument"]` and sets `state["approved"]` (True/False).

### 9. 🚀 Executor (`executor.py`)
- **Role:** Places the actual orders on the exchange.
- **Tools/Models:**
  - Connects to the **Binance API** (via `ccxt`) using the user's decrypted API keys stored in PostgreSQL.
  - Supports "Dry Run" and "Testnet" modes for safe simulation.
  - Places the Market Order, Stop Loss Order, and Take Profit Order on Binance.
- **State Mutation:** Writes to `state["order_id"]` upon successful execution.

---

## ⚡ Background Daemons (Node.js)

Outside of the Graph execution loop, the Node.js backend runs continuous background services:

### 10. ⏱️ Instant Trade Monitor (`tradeMonitor.js`)
- **Role:** Protects open positions by closing them the exact millisecond they hit SL or TP.
- **Tools/Models:** 
  - Uses **node-binance-api WebSockets**.
  - Maintains an in-memory array of `state["status"] == 'open'` trades.
  - Listens to Binance's live `miniTicker` stream.
- **Action:** If a price crosses a trade's SL or TP, it instantly marks the trade as closed in the database and generates a user alert. (No state mutation as this runs outside the LangGraph cycle).

### 11. 🗄️ Data Collector (`collect_data.py`)
- **Role:** Historical data pipeline for future machine learning training.
- **Tools/Models:** 
  - Pulls historical OHLCV data periodically and saves it to the database so the `signal_agent.py` XGBoost model can be retrained on fresh market data.

---

## 📚 Retrieval-Augmented Generation (RAG) Pipeline Integration

To enhance the decision-making capabilities of our agents, we have integrated a Retrieval-Augmented Generation (RAG) pipeline using **PostgreSQL pgvector** and **HuggingFace Sentence Transformers (`all-MiniLM-L6-v2`)**.

Below is the full implementation of the newly added RAG components and the updated agents.

### 12. 📰 News Collector (`news_collector.py`)
**Role:** A standalone script running via cron (e.g., every 15 minutes) to scrape and embed the latest crypto news from top free RSS feeds (CoinTelegraph, NewsBTC, etc.), providing clean, full-text context for the LLM.
```python
import os
import asyncio
import httpx
import hashlib
import psycopg2
import feedparser
import re
from bs4 import BeautifulSoup
from psycopg2.extras import execute_values
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

# Load environment variables from the correct .env file
load_dotenv('backend/.env')
if not os.getenv("POSTGRES_URL"):
    load_dotenv('agents/.env')

POSTGRES_URL = os.getenv("POSTGRES_URL")

# Top free crypto RSS feeds that provide full/partial articles
RSS_FEEDS = [
    "https://cointelegraph.com/rss",
    "https://www.newsbtc.com/feed/",
    "https://cryptopotato.com/feed/",
    "https://beincrypto.com/feed/"
]

# Keywords to map articles to our tracked assets
ASSET_KEYWORDS = {
    "BTC": ["BTC", "Bitcoin"],
    "ETH": ["ETH", "Ethereum"],
    "BNB": ["BNB", "Binance Coin", "Binance"],
    "SOL": ["SOL", "Solana"]
}

# Load model once at startup
print("Loading sentence-transformer model...")
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

def get_db_connection():
    return psycopg2.connect(POSTGRES_URL)

def clean_html(raw_html):
    """Strip HTML tags to provide clean text for the LLM."""
    soup = BeautifulSoup(raw_html, "html.parser")
    return soup.get_text(separator=" ", strip=True)

async def fetch_feed(client, url):
    try:
        # Headers help prevent being blocked by basic bot-protection
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        response = await client.get(url, headers=headers, timeout=15.0)
        response.raise_for_status()
        return url, response.text
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return url, None

def process_and_insert(feed_results):
    articles_to_process = []
    
    for url, xml_content in feed_results:
        if not xml_content:
            continue
            
        feed = feedparser.parse(xml_content)
        source = feed.feed.get("title", "Crypto News")
        
        for entry in feed.entries:
            title = entry.get("title", "")
            link = entry.get("link", "")
            
            # Prefer 'content' if it exists for full text, fallback to 'description'
            content_html = ""
            if "content" in entry and len(entry.content) > 0:
                content_html = entry.content[0].value
            else:
                content_html = entry.get("description", "")
                
            content = clean_html(content_html)
            search_text = f"{title} {content}"
            
            # Map article to assets based on keyword occurrences
            matched_assets = []
            for asset, keywords in ASSET_KEYWORDS.items():
                for kw in keywords:
                    # Use regex boundaries \b so we don't accidentally match 'sold' to 'SOL'
                    if re.search(rf"\b{re.escape(kw)}\b", search_text, re.IGNORECASE):
                        if asset not in matched_assets:
                            matched_assets.append(asset)
            
            for asset in matched_assets:
                # SHA256 for deduplication
                raw_string = f"{title}{source}{asset}"
                content_hash = hashlib.sha256(raw_string.encode('utf-8')).hexdigest()
                
                articles_to_process.append({
                    "title": title, "content": content, "source": source,
                    "asset": asset, "url": link, "content_hash": content_hash
                })

    if not articles_to_process:
        return 0, 0

    print(f"Embedding {len(articles_to_process)} articles...")
    texts_to_embed = [f"{a['title']} - {a['content']}" for a in articles_to_process]
    embeddings = model.encode(texts_to_embed)

    insert_data = [
        (a["title"], a["content"], a["source"], a["asset"], a["url"], a["content_hash"], emb.tolist())
        for a, emb in zip(articles_to_process, embeddings)
    ]

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            query = """
                INSERT INTO crypto_news_embeddings 
                (title, content, source, asset, url, content_hash, embedding)
                VALUES %s
                ON CONFLICT (content_hash) DO NOTHING
            """
            execute_values(cur, query, insert_data)
            conn.commit()
            
            inserted = cur.rowcount
            skipped = len(insert_data) - inserted
    except Exception as e:
        print(f"Database error: {e}")
        conn.rollback()
        inserted, skipped = 0, len(insert_data)
    finally:
        conn.close()
        
    return inserted, skipped

async def main():
    if not POSTGRES_URL:
        print("Error: POSTGRES_URL is not set. Please set it in your .env file.")
        return

    print(f"Starting news collection from RSS feeds...")
    async with httpx.AsyncClient() as client:
        tasks = [fetch_feed(client, url) for url in RSS_FEEDS]
        results = await asyncio.gather(*tasks)
    
    # Run sync DB & CPU heavy operations in a separate thread
    inserted, skipped = await asyncio.to_thread(process_and_insert, results)
    print(f"Summary: {inserted} inserted, {skipped} skipped (already in DB).")

if __name__ == "__main__":
    asyncio.run(main())
```

### 13. 🧩 News Embedder (`agents/agents_nodes/news_embedder.py`)
**Role:** Reusable async module that fetches semantic news matches based on the asset and recent timestamps using `pgvector`'s cosine distance operator.
```python
import asyncio
from sentence_transformers import SentenceTransformer

# Load HF model once at module level
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

async def retrieve_relevant_news(conn, query, asset, limit=5, hours_back=24) -> list[tuple]:
    # CPU heavy task run in thread
    query_embedding = await asyncio.to_thread(model.encode, query)
    embedding_list = query_embedding.tolist()

    def fetch_from_db():
        with conn.cursor() as cur:
            # <=> is the pgvector operator for cosine distance. 1 - distance = similarity.
            sql = """
                SELECT title, content, source, created_at, 
                       1 - (embedding <=> %s::vector) AS similarity_score
                FROM crypto_news_embeddings
                WHERE asset = %s 
                  AND created_at >= NOW() - INTERVAL '%s hours'
                ORDER BY embedding <=> %s::vector
                LIMIT %s
            """
            cur.execute(sql, (embedding_list, asset, hours_back, embedding_list, limit))
            return cur.fetchall()

    return await asyncio.to_thread(fetch_from_db)
```

### 14. 🧠 Trade Memory (`agents/agents_nodes/trade_memory.py`)
**Role:** Module that handles embedding and retrieval of historical trades, allowing agents to query context from past wins and losses.
```python
import asyncio
from sentence_transformers import SentenceTransformer

# Load HF model once at module level
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

async def embed_and_store_trade(conn, trade: dict):
    asset = trade.get('asset', 'UNKNOWN')
    direction = trade.get('direction', 'UNKNOWN')
    timeframe = trade.get('timeframe', 'UNKNOWN')
    outcome = trade.get('outcome', 'UNKNOWN')
    pnl = trade.get('pnl', 0.0)
    
    # E.g.: "BNB LONG on 1h | Result: WIN +2.3%"
    summary = f"{asset} {direction} on {timeframe} | Result: {outcome} {pnl:+.2f}%"
    
    embedding = await asyncio.to_thread(model.encode, summary)
    embedding_list = embedding.tolist()

    def insert_db():
        with conn.cursor() as cur:
            sql = """
                INSERT INTO trade_memory 
                (summary, asset, direction, timeframe, outcome, pnl, embedding)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            cur.execute(sql, (summary, asset, direction, timeframe, outcome, pnl, embedding_list))
            conn.commit()

    await asyncio.to_thread(insert_db)


async def retrieve_similar_trades(conn, query, asset, outcome=None, limit=5) -> list[tuple]:
    query_embedding = await asyncio.to_thread(model.encode, query)
    embedding_list = query_embedding.tolist()

    def fetch_db():
        with conn.cursor() as cur:
            if outcome:
                sql = """
                    SELECT summary, asset, direction, timeframe, outcome, pnl,
                           1 - (embedding <=> %s::vector) AS similarity_score
                    FROM trade_memory
                    WHERE asset = %s AND outcome = %s
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s
                """
                cur.execute(sql, (embedding_list, asset, outcome, embedding_list, limit))
            else:
                sql = """
                    SELECT summary, asset, direction, timeframe, outcome, pnl,
                           1 - (embedding <=> %s::vector) AS similarity_score
                    FROM trade_memory
                    WHERE asset = %s
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s
                """
                cur.execute(sql, (embedding_list, asset, embedding_list, limit))
            return cur.fetchall()

    return await asyncio.to_thread(fetch_db)
```

### 15. 📰 Sentiment Analyst Update (`agents/agents_nodes/sentiment_analyst.py`)
**Role:** Pulls the top 5 similar news articles from the last 24 hours to contextualize its Fear & Greed index reading.
```python
import os
import httpx
from langchain_core.messages import HumanMessage
from agents_nodes.llm import llm
from graph.state import MASState
from news_embedder import retrieve_relevant_news
import psycopg2


# --- API endpoints ---
FEAR_GREED_URL = "https://api.alternative.me/fng/?limit=1"
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASS", "postgres")

def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST, database=DB_NAME, user=DB_USER, password=DB_PASS
    )

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
```

### 16. ⚖️ Coordinator Update (`agents/agents_nodes/coordinator.py`)
**Role:** Retrieves the 5 most similar past trades (both wins and losses) from the RAG pipeline to inform its final verdict.
```python
import os
import psycopg
from langchain_core.messages import HumanMessage
from graph.state import MASState
from agents_nodes.llm import llm

async def persist_to_db(state: MASState, recommendation: str, approved: bool, reasoning: str):
    """Save debate cycle and all agent messages to PostgreSQL cryptoAI database."""
    postgres_url = os.getenv("POSTGRES_URL")
    if "cryptoAI" not in postgres_url and "account_system" in postgres_url:
        postgres_url = postgres_url.replace("account_system", "cryptoAI")

    try:
        async with await psycopg.AsyncConnection.connect(postgres_url) as conn:
            async with conn.cursor() as cur:
                # 1. Save debate_cycle
                await cur.execute(
                    """
                    INSERT INTO debate_cycles (cycle_id, user_id, asset, timeframe, recommendation, approved, status, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, 'completed', NOW())
                    ON CONFLICT (cycle_id) DO UPDATE SET recommendation = EXCLUDED.recommendation, approved = EXCLUDED.approved
                    """,
                    (
                        state["cycle_id"],
                        state["user_id"],
                        state["asset"],
                        state["timeframe"],
                        recommendation,
                        approved
                    )
                )

                # 2. Save all messages
                for msg in state["messages"]:
                    if isinstance(msg, HumanMessage):
                        # Extract signal and confidence if available from agent-specific state keys
                        agent_name = msg.name or "unknown"
                        signal = "neutral"
                        confidence = 0.5
                        
                        agent_data = state.get(agent_name.replace("_agent", ""))
                        if agent_data and isinstance(agent_data, dict):
                            signal = agent_data.get("signal", "neutral")
                            confidence = agent_data.get("confidence", 0.5)

                        await cur.execute(
                            """
                            INSERT INTO debate_messages (cycle_id, agent_name, signal, confidence, content, created_at)
                            VALUES (%s, %s, %s, %s, %s, NOW())
                            """,
                            (state["cycle_id"], agent_name, signal, confidence, msg.content)
                        )
    except Exception as e:
        print(f"Error persisting to cryptoAI: {e}")

async def coordinator_node(state: MASState) -> dict:
    """
    Coordinator Agent — The final decision maker.
    Synthesizes reports from all analysts and the risk manager
    to produce a final "APPROVED" or "REJECTED" trade recommendation.
    """
    try:
        # 1. Gather all reports from messages
        reports = [msg.content for msg in state["messages"] if isinstance(msg, HumanMessage)]
        full_context = "\n\n---\n\n".join(reports)

        # 2. Check Risk Manager's verdict
        risk_data = state.get("risk", {})
        risk_acceptable = risk_data.get("acceptable", False)
        direction = risk_data.get("direction", "neutral")
        asset = state["asset"]

        # 3. Retrieve similar past trades (wins + losses) for context
        import psycopg2
        from trade_memory import retrieve_similar_trades
        DB_HOST = os.getenv("DB_HOST", "localhost")
        DB_NAME = os.getenv("DB_NAME", "postgres")
        DB_USER = os.getenv("DB_USER", "postgres")
        DB_PASS = os.getenv("DB_PASS", "postgres")
        
        conn = psycopg2.connect(host=DB_HOST, database=DB_NAME, user=DB_USER, password=DB_PASS)
        try:
            # Query the database for similar trades
            trade_results = await retrieve_similar_trades(
                conn, 
                query=f"{asset} {direction} consensus", 
                asset=asset, 
                outcome=None, 
                limit=5
            )
        finally:
            conn.close()

        if trade_results:
            trade_text_list = []
            for i, (t_summary, t_asset, t_dir, t_tf, t_outcome, pnl, similarity) in enumerate(trade_results):
                trade_text_list.append(f"- [Sim: {similarity:.2f}] {t_summary}")
            past_trades_context = "\n".join(trade_text_list)
        else:
            past_trades_context = "No similar past trades found."

        # 4. Build the final synthesis prompt
        prompt = f"""You are the Multi-Agent System Coordinator. You have received reports from multiple specialized trading agents and a final risk assessment.

## Agent Reports
{full_context}

## Risk Manager Verdict
- Acceptable: {risk_acceptable}
- Direction: {direction.upper()}
- Entry: ${risk_data.get('entry_price', 0):,}
- Stop Loss: ${risk_data.get('stop_loss', 0):,}
- Take Profit: ${risk_data.get('take_profit', 0):,}
- Leverage: {risk_data.get('leverage', 1)}x

## Similar Past Trades Context (Wins & Losses)
{past_trades_context}

## Your Task
Summarize the consensus (or lack thereof) among the agents. 
Review the similar past trades to see if this setup has historically succeeded or failed.
Provide a final verdict for the user.
If Risk Manager says REJECT, your recommendation MUST be to WAIT.
If Risk Manager says ACCEPT, your recommendation should be to EXECUTE the trade.

Respond in this exact format:
SUMMARY: <1-2 sentences summarizing the overall agent consensus and past trade relevance>
VERDICT: <EXECUTE | WAIT>
REASONING: <Final explanation for the user>"""

        # 5. Ask LLM for final summary
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        response_text = response.content

        # 5. Parse summary and verdict
        summary = ""
        verdict = "WAIT"
        reasoning = response_text

        for line in response_text.strip().split("\n"):
            if line.startswith("SUMMARY:"):
                summary = line.replace("SUMMARY:", "").strip()
            elif line.startswith("VERDICT:"):
                verdict = line.replace("VERDICT:", "").strip().upper()
            elif line.startswith("REASONING:"):
                reasoning = line.replace("REASONING:", "").strip()

        # 6. Persistence
        approved = risk_acceptable and verdict == "EXECUTE"
        final_recommendation = f"{verdict}: {summary}"
        await persist_to_db(state, final_recommendation, approved, reasoning)

        # 7. Final state update
        return {
            "recommendation": final_recommendation,
            "approved": approved,
            "messages": [HumanMessage(
                content=f"🏁 Final Coordinator Decision: {verdict}\n{reasoning}",
                name="coordinator"
            )]
        }

    except Exception as e:
        error_msg = f"Coordinator error: {str(e)}"
        print(error_msg)
        return {
            "recommendation": "WAIT: Error in coordination",
            "approved": False,
            "messages": [HumanMessage(content=error_msg, name="coordinator")],
            "error": error_msg
        }
```

### 17. 😈 Devil's Advocate Update (`agents/agents_nodes/devils_advocate.py`)
**Role:** Retrieves the 5 most similar past *LOSING* trades from the RAG pipeline to strengthen its veto arguments and challenge the consensus.
```python
from langchain_core.messages import HumanMessage
from graph.state import MASState
from agents_nodes.llm import llm

async def devils_advocate_node(state: MASState) -> dict:
    """
    Devil's Advocate Agent.
    Purpose: To challenge the consensus and prevent groupthink.
    It looks at all current agent signals and finds reasons why the majority might be wrong.
    """
    try:
        # 1. Gather existing signals
        reports = [msg.content for msg in state["messages"] if isinstance(msg, HumanMessage)]
        full_context = "\n\n---\n\n".join(reports)

        asset = state.get("asset", "UNKNOWN")
        risk_data = state.get("risk", {})
        direction = risk_data.get("direction", "neutral")

        # 2. Retrieve similar past LOSING trades for context
        import os
        import psycopg2
        from trade_memory import retrieve_similar_trades
        DB_HOST = os.getenv("DB_HOST", "localhost")
        DB_NAME = os.getenv("DB_NAME", "postgres")
        DB_USER = os.getenv("DB_USER", "postgres")
        DB_PASS = os.getenv("DB_PASS", "postgres")

        conn = psycopg2.connect(host=DB_HOST, database=DB_NAME, user=DB_USER, password=DB_PASS)
        try:
            # Query the database for similar LOSING trades
            trade_results = await retrieve_similar_trades(
                conn, 
                query=f"{asset} {direction} consensus failure", 
                asset=asset, 
                outcome="LOSS", 
                limit=5
            )
        finally:
            conn.close()

        if trade_results:
            trade_text_list = []
            for i, (t_summary, t_asset, t_dir, t_tf, t_outcome, pnl, similarity) in enumerate(trade_results):
                trade_text_list.append(f"- [Sim: {similarity:.2f}] {t_summary}")
            past_losses_context = "\n".join(trade_text_list)
        else:
            past_losses_context = "No similar past losing trades found."

        # 3. Build the "Critical Challenge" prompt
        prompt = f"""You are the Devil's Advocate for a crypto trading team. Your job is to be the "Skeptic."
        Even if the team is bullish, you must find the bearish risks. If they are bearish, you must find the bullish reversal signs.

        ## Current Agent Reports
        {full_context}

        ## Past Failures (Similar LOSING Trades Context)
        Review these past failures to see how similar setups have previously failed:
        {past_losses_context}

        ## Your Task
        1. Identify the current consensus (Are most agents LONG or SHORT?).
        2. Provide a "Counter-Argument": Why might this consensus fail? Draw specific parallels to the "Past Failures" if any exist.
        3. Look for "Hidden Risks" (e.g., hidden bearish divergence, liquidity traps, upcoming macro news).
        4. Signal: Provide a "CHALLENGE" signal if you see major risks, or "CONCUR" if the consensus is extremely solid.

        Respond in this exact format:
        CHALLENGE_SIGNAL: <CHALLENGE | CONCUR>
        COUNTER_ARGUMENT: <2-3 sentences explaining the risk to the current consensus>
        CONFIDENCE: <0.0-1.0>"""

        # 4. Ask LLM for the challenge
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        response_text = response.content

        # 4. Parse response
        challenge_signal = "CONCUR"
        counter_argument = response_text
        for line in response_text.strip().split("\n"):
            if line.startswith("CHALLENGE_SIGNAL:"):
                challenge_signal = line.replace("CHALLENGE_SIGNAL:", "").strip().upper()
            elif line.startswith("COUNTER_ARGUMENT:"):
                counter_argument = line.replace("COUNTER_ARGUMENT:", "").strip()

        # 5. Build message for debate log
        message_content = (
            f"😈 Devil's Advocate Challenge\n"
            f"Verdict: {challenge_signal}\n"
            f"Counter-Argument: {counter_argument}"
        )

        return {
            "devils_argument": counter_argument,
            "messages": [HumanMessage(content=message_content, name="devils_advocate")]
        }

    except Exception as e:
        return {
            "devils_argument": f"Error in Devil's Advocate: {str(e)}",
            "messages": [HumanMessage(content=f"Devil's Advocate error: {str(e)}", name="devils_advocate")]
        }
```