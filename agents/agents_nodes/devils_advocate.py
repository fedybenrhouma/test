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

        # 2. Build the "Critical Challenge" prompt
        prompt = f"""You are the Devil's Advocate for a crypto trading team. Your job is to be the "Skeptic." 
Even if the team is bullish, you must find the bearish risks. If they are bearish, you must find the bullish reversal signs.

## Current Agent Reports
{full_context}

## Your Task
1. Identify the current consensus (Are most agents LONG or SHORT?).
2. Provide a "Counter-Argument": Why might this consensus fail? 
3. Look for "Hidden Risks" (e.g., hidden bearish divergence, liquidity traps, upcoming macro news).
4. Signal: Provide a "CHALLENGE" signal if you see major risks, or "CONCUR" if the consensus is extremely solid.

Respond in this exact format:
CHALLENGE_SIGNAL: <CHALLENGE | CONCUR>
COUNTER_ARGUMENT: <2-3 sentences explaining the risk to the current consensus>
CONFIDENCE: <0.0-1.0>"""

        # 3. Ask LLM for the challenge
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
