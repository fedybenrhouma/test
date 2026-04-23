from langgraph.graph import StateGraph, START, END
from graph.state import MASState

# --- Import Agents ---
from agents_nodes.technical_analyst import technical_analyst_node
from agents_nodes.sentiment_analyst import sentiment_analyst_node
from agents_nodes.trend_agent import trend_agent_node
from agents_nodes.signal_agent import signal_agent_node
from agents_nodes.volatility_agent import volatility_agent_node
from agents_nodes.risk_manager import risk_manager_node
from agents_nodes.devils_advocate import devils_advocate_node
from agents_nodes.coordinator import coordinator_node
from agents_nodes.executor import executor_node


def build_graph():
    """
    Builds the Crypto Multi-Agent System (MAS) graph.
    All analyst agents run in parallel, followed by the Risk Manager,
    the Devil's Advocate, the Coordinator, and finally the Executor.
    """
    builder = StateGraph(MASState)

    # 1. Add all nodes
    builder.add_node("technical", technical_analyst_node)
    builder.add_node("sentiment", sentiment_analyst_node)
    builder.add_node("trend", trend_agent_node)
    builder.add_node("signal_model", signal_agent_node)
    builder.add_node("volatility", volatility_agent_node)
    builder.add_node("risk_manager", risk_manager_node)
    builder.add_node("devils_advocate", devils_advocate_node)
    builder.add_node("coordinator", coordinator_node)
    builder.add_node("executor", executor_node)

    # 2. Parallel start: Run all analysis nodes at once
    builder.add_edge(START, "technical")
    builder.add_edge(START, "sentiment")
    builder.add_edge(START, "trend")
    builder.add_edge(START, "signal_model")
    builder.add_edge(START, "volatility")

    # 3. Join: All parallel nodes flow into the Risk Manager
    builder.add_edge("technical", "risk_manager")
    builder.add_edge("sentiment", "risk_manager")
    builder.add_edge("trend", "risk_manager")
    builder.add_edge("signal_model", "risk_manager")
    builder.add_edge("volatility", "risk_manager")

    # 4. Sequential Flow with the Skeptic Challenger
    builder.add_edge("risk_manager", "devils_advocate")
    builder.add_edge("devils_advocate", "coordinator")
    builder.add_edge("coordinator", "executor")
    builder.add_edge("executor", END)

    return builder.compile()


# Compile the graph
graph = build_graph()
