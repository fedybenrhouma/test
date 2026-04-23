from typing import TypedDict, Optional, Annotated, List
from langgraph.graph.message import add_messages


class AgentSignal(TypedDict):
    signal: str        # "long", "short", or "neutral"
    confidence: float  # 0.0 to 1.0
    reasoning: str


class MASState(TypedDict):
    # --- Who is running this cycle ---
    user_id: str
    cycle_id: str

    # --- What to trade ---
    asset: str         # e.g. "BTC/USDT"
    timeframe: str     # e.g. "1h"

    # --- Agent signals (filled in as agents run) ---
    technical: Optional[AgentSignal]
    sentiment: Optional[AgentSignal]
    trend: Optional[AgentSignal]
    signal_model: Optional[AgentSignal]
    volatility: Optional[dict]

    # --- Risk calculation (filled by Risk Manager) ---
    risk: Optional[dict]

    # --- Debate messages ---
    messages: Annotated[List, add_messages]
    debate_round: int
    consensus_reached: bool

    # --- Final decision ---
    recommendation: Optional[str]
    devils_argument: Optional[str]
    approved: Optional[bool]

    # --- Execution result ---
    order_id: Optional[str]

    # --- Monitor result ---
    close_reason: Optional[str]
    pnl: Optional[float]

    # --- Error handling ---
    error: Optional[str]