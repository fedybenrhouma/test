import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import ccxt
import pandas as pd
import ta
from langchain_core.messages import HumanMessage
from agents_nodes.llm import llm
from graph.state import MASState
from dotenv import load_dotenv

load_dotenv()


# --- Risk configuration ---
MAX_PORTFOLIO_RISK_PCT = 0.02    # Risk max 2% of portfolio per trade
DEFAULT_PORTFOLIO_SIZE = 1000.0  # USDT — update this to your real portfolio size
RISK_REWARD_RATIO = 2.0          # Take profit = 2x the stop loss distance
ATR_STOP_MULTIPLIER = 1.5        # Stop loss = 1.5x ATR below entry


def fetch_ohlcv(asset: str, timeframe: str, limit: int = 50) -> pd.DataFrame:
    """Fetch OHLCV candles from Binance."""
    exchange = ccxt.binance()
    ohlcv = exchange.fetch_ohlcv(asset, timeframe, limit=limit)
    df = pd.DataFrame(ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"])
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
    return df


def calculate_atr(df: pd.DataFrame, period: int = 14) -> float:
    """Calculate ATR for stop loss placement."""
    atr = ta.volatility.AverageTrueRange(
        high=df["high"],
        low=df["low"],
        close=df["close"],
        window=period
    )
    return float(atr.average_true_range().iloc[-1])


def calculate_position_size(
    portfolio_size: float,
    entry_price: float,
    stop_loss: float,
    risk_pct: float = MAX_PORTFOLIO_RISK_PCT
) -> float:
    """
    Calculate position size based on risk percentage.
    Formula: position_size = (portfolio * risk%) / (entry - stop_loss)
    """
    risk_amount = portfolio_size * risk_pct
    stop_distance = abs(entry_price - stop_loss)
    if stop_distance == 0:
        return 0.0
    position_size = risk_amount / stop_distance
    return round(position_size, 6)


async def fetch_open_positions(user_id: str) -> list:
    """
    Fetch open positions from PostgreSQL.
    Returns list of open trades for this user.
    """
    try:
        import psycopg
        postgres_url = os.getenv("POSTGRES_URL", "")

        async with await psycopg.AsyncConnection.connect(postgres_url) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    SELECT asset, direction, position_size, entry_price, stop_loss, take_profit
                    FROM trades
                    WHERE user_id = %s AND status = 'open'
                    """,
                    (user_id,)
                )
                rows = await cur.fetchall()
                return [
                    {
                        "asset": row[0],
                        "direction": row[1],
                        "position_size": row[2],
                        "entry_price": row[3],
                        "stop_loss": row[4],
                        "take_profit": row[5]
                    }
                    for row in rows
                ]
    except Exception as e:
        # If DB not set up yet return empty list
        print(f"DB fetch warning: {e}")
        return []


def build_prompt(
    asset: str,
    direction: str,
    entry_price: float,
    stop_loss: float,
    take_profit: float,
    position_size: float,
    atr: float,
    open_positions: list,
    agent_signals: dict
) -> str:
    """Build the prompt to send to Groq."""

    positions_text = (
        "\n".join([
            f"  - {p['asset']} {p['direction']} | size: {p['position_size']} | entry: ${p['entry_price']:,}"
            for p in open_positions
        ])
        if open_positions
        else "  None — portfolio is flat"
    )

    signals_text = (
        f"  Technical: {agent_signals.get('technical', 'N/A')}\n"
        f"  Sentiment: {agent_signals.get('sentiment', 'N/A')}\n"
        f"  Trend:     {agent_signals.get('trend', 'N/A')}\n"
        f"  ML Model:  {agent_signals.get('signal_model', 'N/A')}"
    )

    stop_pct = abs(entry_price - stop_loss) / entry_price * 100
    target_pct = abs(take_profit - entry_price) / entry_price * 100

    return f"""You are a professional crypto risk manager. Evaluate whether this trade is safe to take given the current portfolio state.

## Proposed Trade
- Asset: {asset}
- Direction: {direction.upper()}
- Entry Price: ${entry_price:,}
- Stop Loss: ${stop_loss:,} ({stop_pct:.2f}% risk)
- Take Profit: ${take_profit:,} ({target_pct:.2f}% reward)
- Risk/Reward Ratio: 1:{RISK_REWARD_RATIO}
- Position Size: {position_size} {asset.split('/')[0]}
- ATR (volatility): {atr:.4f}

## Current Open Positions
{positions_text}

## Agent Signals Consensus
{signals_text}

## Risk Rules to Evaluate
1. Is the stop loss placement logical given ATR of {atr:.4f}?
2. Is the risk/reward ratio of 1:{RISK_REWARD_RATIO} acceptable?
3. Are there too many open positions already?
4. Does this trade align with the majority of agent signals?
5. Is the position size reasonable?

## Your Task
Evaluate the risk of this trade and provide:
1. Decision: ACCEPT or REJECT
2. Confidence: 0.0 to 1.0
3. Reasoning: 2-3 sentences explaining your risk assessment
4. Suggested leverage: 1 to 5 (1 = no leverage, be conservative)

Respond in this exact format:
DECISION: <ACCEPT|REJECT>
CONFIDENCE: <0.0-1.0>
REASONING: <your reasoning>
LEVERAGE: <1-5>"""


def parse_response(response_text: str) -> dict:
    """Parse Groq response."""
    lines = response_text.strip().split("\n")
    result = {
        "decision": "REJECT",
        "confidence": 0.5,
        "reasoning": response_text,
        "leverage": 1
    }

    for line in lines:
        if line.startswith("DECISION:"):
            raw = line.replace("DECISION:", "").strip().upper()
            if raw in ["ACCEPT", "REJECT"]:
                result["decision"] = raw
        elif line.startswith("CONFIDENCE:"):
            try:
                result["confidence"] = float(line.replace("CONFIDENCE:", "").strip())
            except ValueError:
                pass
        elif line.startswith("REASONING:"):
            result["reasoning"] = line.replace("REASONING:", "").strip()
        elif line.startswith("LEVERAGE:"):
            try:
                result["leverage"] = int(line.replace("LEVERAGE:", "").strip())
            except ValueError:
                result["leverage"] = 1

    return result


async def risk_manager_node(state: MASState) -> dict:
    """
    Risk Manager Agent.
    Calculates entry, stop loss, take profit, and position size.
    Checks open positions and agent consensus.
    Asks Groq to evaluate overall risk.
    """
    try:
        asset = state["asset"]
        timeframe = state["timeframe"]
        user_id = state["user_id"]

        # 1. Determine direction from majority of agent signals
        signals = []
        long_conf = 0.0
        short_conf = 0.0
        
        for key in ["technical", "sentiment", "trend", "signal_model"]:
            agent = state.get(key)
            if agent and agent.get("signal") in ["long", "short"]:
                sig = agent["signal"]
                signals.append(sig)
                if sig == "long":
                    long_conf += float(agent.get("confidence", 0.0))
                else:
                    short_conf += float(agent.get("confidence", 0.0))

        long_votes  = signals.count("long")
        short_votes = signals.count("short")

        if long_votes > short_votes:
            direction = "long"
        elif short_votes > long_votes:
            direction = "short"
        elif long_votes == short_votes and long_votes > 0:
            # Tie-breaker using cumulative confidence
            if long_conf > short_conf:
                direction = "long"
            elif short_conf > long_conf:
                direction = "short"
            else:
                # Absolute tie
                return {
                    "risk": {
                        "acceptable": False,
                        "reasoning": "Agent signals and confidence are perfectly tied — no clear direction.",
                        "entry_price": 0.0,
                        "stop_loss": 0.0,
                        "take_profit": 0.0,
                        "position_size": 0.0,
                        "leverage": 1
                    },
                    "messages": [HumanMessage(
                        content="🛡️ Risk Manager: Agent signals and confidence tied — no trade.",
                        name="risk_manager"
                    )]
                }
        else:
            # No signals at all
            return {
                "risk": {
                    "acceptable": False,
                    "reasoning": "No valid agent signals found.",
                    "entry_price": 0.0,
                    "stop_loss": 0.0,
                    "take_profit": 0.0,
                    "position_size": 0.0,
                    "leverage": 1
                },
                "messages": [HumanMessage(
                    content="🛡️ Risk Manager: No valid agent signals — no trade.",
                    name="risk_manager"
                )]
            }

        # 2. Fetch candles for ATR calculation
        df = fetch_ohlcv(asset, timeframe)
        atr = calculate_atr(df)
        current_price = float(df["close"].iloc[-1])

        # 3. Calculate entry, stop loss, take profit
        entry_price = current_price

        if direction == "long":
            stop_loss   = round(entry_price - (atr * ATR_STOP_MULTIPLIER), 2)
            take_profit = round(entry_price + (atr * ATR_STOP_MULTIPLIER * RISK_REWARD_RATIO), 2)
        else:
            stop_loss   = round(entry_price + (atr * ATR_STOP_MULTIPLIER), 2)
            take_profit = round(entry_price - (atr * ATR_STOP_MULTIPLIER * RISK_REWARD_RATIO), 2)

        # 4. Calculate position size
        position_size = calculate_position_size(
            portfolio_size=DEFAULT_PORTFOLIO_SIZE,
            entry_price=entry_price,
            stop_loss=stop_loss
        )

        # 5. Fetch open positions from DB
        open_positions = await fetch_open_positions(user_id)

        # 6. Build agent signals summary
        agent_signals = {}
        for key in ["technical", "sentiment", "trend", "signal_model"]:
            agent = state.get(key)
            if agent:
                agent_signals[key] = f"{agent['signal'].upper()} ({agent['confidence']:.0%})"

        # 7. Ask Groq to evaluate risk
        prompt = build_prompt(
            asset, direction, entry_price, stop_loss, take_profit,
            position_size, atr, open_positions, agent_signals
        )
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        parsed = parse_response(response.content)

        acceptable = parsed["decision"] == "ACCEPT"

        # 8. Build message for debate log
        message_content = (
            f"🛡️ Risk Manager Report\n"
            f"Asset: {asset} | Direction: {direction.upper()}\n"
            f"Entry: ${entry_price:,} | SL: ${stop_loss:,} | TP: ${take_profit:,}\n"
            f"Position Size: {position_size} {asset.split('/')[0]}\n"
            f"Agent votes: {long_votes} LONG / {short_votes} SHORT\n"
            f"Open positions: {len(open_positions)}\n"
            f"Decision: {'✅ ACCEPT' if acceptable else '❌ REJECT'} "
            f"(confidence: {parsed['confidence']})\n"
            f"Leverage: {parsed['leverage']}x\n"
            f"Reasoning: {parsed['reasoning']}"
        )

        return {
            "risk": {
                "acceptable": acceptable,
                "direction": direction,
                "entry_price": entry_price,
                "stop_loss": stop_loss,
                "take_profit": take_profit,
                "position_size": position_size,
                "leverage": parsed["leverage"],
                "reasoning": parsed["reasoning"]
            },
            "messages": [HumanMessage(content=message_content, name="risk_manager")]
        }

    except Exception as e:
        error_msg = f"Risk Manager error: {str(e)}"
        return {
            "risk": {
                "acceptable": False,
                "reasoning": f"Error: {str(e)}",
                "entry_price": 0.0,
                "stop_loss": 0.0,
                "take_profit": 0.0,
                "position_size": 0.0,
                "leverage": 1
            },
            "messages": [HumanMessage(content=error_msg, name="risk_manager")],
            "error": error_msg
        }