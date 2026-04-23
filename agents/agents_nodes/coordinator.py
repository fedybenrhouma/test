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

        # 3. Build the final synthesis prompt
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

## Your Task
Summarize the consensus (or lack thereof) among the agents. 
Provide a final verdict for the user.
If Risk Manager says REJECT, your recommendation MUST be to WAIT.
If Risk Manager says ACCEPT, your recommendation should be to EXECUTE the trade.

Respond in this exact format:
SUMMARY: <1-2 sentences summarizing the overall agent consensus>
VERDICT: <EXECUTE | WAIT>
REASONING: <Final explanation for the user>"""

        # 4. Ask LLM for final summary
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
