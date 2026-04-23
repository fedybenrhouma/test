from typing import TypedDict, Optional, Annotated, List
from langgraph.graph.message import add_messages


class AgentSignal(TypedDict):
    signal: str        # "long", "short", or "neutral"
    confidence: float  # 0.0 to 1.0
    reasoning: str


