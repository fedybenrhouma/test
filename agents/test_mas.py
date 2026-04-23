import asyncio
import os
import uuid
import sys
import io
from dotenv import load_dotenv

# Force UTF-8 encoding for Windows console to support emojis/special chars
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Load environment variables from .env
load_dotenv()

from graph.graph import graph
from graph.state import MASState

async def run_test():
    """
    Runs a test cycle of the Crypto Multi-Agent System.
    """
    print("🚀 Starting Crypto MAS Test Cycle...")

    # Get inputs from environment variables or use defaults
    asset = os.getenv("ASSET", "BTC/USDT")
    timeframe = os.getenv("TIMEFRAME", "1h")
    user_id = os.getenv("USER_ID", "00000000-0000-0000-0000-000000000000")
    
    # 1. Define initial state
    initial_state: MASState = {
        "user_id": user_id,  
        "cycle_id": f"test_{uuid.uuid4().hex[:8]}",
        "asset": asset,
        "timeframe": timeframe,
        "messages": [],
        "debate_round": 0,
        "consensus_reached": False,
        "technical": None,
        "sentiment": None,
        "trend": None,
        "signal_model": None,
        "volatility": None,
        "risk": None,
        "recommendation": None,
        "devils_argument": None,
        "approved": None,
        "order_id": None,
        "close_reason": None,
        "pnl": None,
        "error": None
    }

    try:
        # 2. Invoke the graph
        print(f"📈 Analyzing {initial_state['asset']} on {initial_state['timeframe']}...")
        
        final_state = await graph.ainvoke(initial_state)

        # 3. Print Results
        print("\n" + "="*50)
        print("🏁 TEST CYCLE COMPLETE")
        print("="*50)
        
        if final_state.get("error"):
            print(f"❌ Error: {final_state['error']}")
        
        print(f"Asset: {final_state['asset']}")
        print(f"Recommendation: {final_state.get('recommendation', 'N/A')}")
        print(f"Approved: {final_state.get('approved', 'N/A')}")
        print(f"Order ID: {final_state.get('order_id', 'N/A')}")
        
        print("\n--- Agent Reports ---")
        for msg in final_state["messages"]:
            name = getattr(msg, 'name', 'system')
            print(f"\n[{name.upper()}]")
            print(msg.content)

    except Exception as e:
        print(f"💥 Critical Error during test: {e}")

if __name__ == "__main__":
    # Fix for Windows: Psycopg3 requires SelectorEventLoop instead of ProactorEventLoop
    if os.name == 'nt':
        import asyncio
        try:
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        except:
            pass
    
    asyncio.run(run_test())
