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
- **State Mutation:** Writes to `state["recommendation"]` (the final verdict) and sets `state["consensus_reached"]`.

### 8. 😈 Devil's Advocate (`devils_advocate.py`)
- **Role:** The final sanity check. Before any trade is executed, this agent is tasked with aggressively finding reasons why the trade is a *bad* idea.
- **Tools/Models:**
  - Uses **Groq (Llama-3)**. It is fed the Coordinator's recommendation and told to "tear it apart."
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