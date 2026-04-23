import os
import ccxt
import psycopg
from graph.state import MASState
from utils.crypto_utils import decrypt_key

async def fetch_user_keys(user_id: int) -> dict:
    """Fetch and decrypt Binance API keys from the users table in cryptoAI database."""
    # Ensure we use cryptoAI if not specified in env
    postgres_url = os.getenv("POSTGRES_URL")
    if "cryptoAI" not in postgres_url and "account_system" in postgres_url:
        postgres_url = postgres_url.replace("account_system", "cryptoAI")
    
    try:
        async with await psycopg.AsyncConnection.connect(postgres_url) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "SELECT \"binanceApiKey\", \"binanceApiSecret\" FROM \"Users\" WHERE id = %s",
                    (user_id,)
                )
                row = await cur.fetchone()
                if row and row[0] and row[1]:
                    return {
                        "apiKey": decrypt_key(row[0]),
                        "secret": decrypt_key(row[1])
                    }
    except Exception as e:
        print(f"Error fetching user keys from cryptoAI: {e}")
    return {}

async def save_trade_to_db(state: MASState, order_id: str):
    """Save trade record to PostgreSQL cryptoAI database."""
    risk = state["risk"]
    postgres_url = os.getenv("POSTGRES_URL")
    if "cryptoAI" not in postgres_url and "account_system" in postgres_url:
        postgres_url = postgres_url.replace("account_system", "cryptoAI")

    try:
        async with await psycopg.AsyncConnection.connect(postgres_url) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    INSERT INTO trades (
                        user_id, cycle_id, asset, direction, entry_price, 
                        stop_loss, take_profit, position_size, leverage, order_id, status, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'open', NOW())
                    """,
                    (
                        state["user_id"],
                        state["cycle_id"],
                        state["asset"],
                        risk["direction"],
                        risk["entry_price"],
                        risk["stop_loss"],
                        risk["take_profit"],
                        risk["position_size"],
                        risk["leverage"],
                        order_id
                    )
                )
    except Exception as e:
        print(f"Error saving trade to cryptoAI: {e}")

async def executor_node(state: MASState) -> dict:
    """
    Executor Agent — Places orders on Binance.
    Supports Testnet and Dry Run modes for safe testing.
    """
    if not state.get("approved"):
        return {"order_id": None}

    try:
        user_id = state["user_id"]
        asset = state["asset"]
        risk = state["risk"]
        
        # Check for Testnet or Dry Run flags
        use_testnet = os.getenv("USE_TESTNET", "false").lower() == "true"
        dry_run = os.getenv("DRY_RUN", "false").lower() == "true"

        # 1. Fetch keys
        keys = await fetch_user_keys(user_id)
        
        # If no keys and not dry run, we can't proceed
        if not keys.get("apiKey") and not dry_run:
            return {"error": "No API keys found and DRY_RUN is false"}

        # 2. Handle Dry Run (Simulation)
        if dry_run:
            order_id = f"dry_run_{state['cycle_id']}"
            print(f"🛠️ DRY RUN: Simulating {risk['direction'].upper()} on {asset}")
            await save_trade_to_db(state, order_id)
            return {"order_id": order_id}

        # 3. Init Real/Testnet Exchange
        exchange = ccxt.binance({
            'apiKey': keys['apiKey'],
            'secret': keys['secret'],
            'options': {'defaultType': 'future'}
        })
        
        if use_testnet:
            exchange.set_sandbox_mode(True)
            print(f"🧪 TESTNET: Placing test order for {asset}")

        # 4. Place Order
        side = 'buy' if risk["direction"] == 'long' else 'sell'
        
        # Simulation for mock keys
        if keys['apiKey'].startswith("mock"):
            order_id = f"mock_order_{state['cycle_id']}"
        else:
            # Real or Testnet Order
            order = await exchange.create_market_order(asset, side, risk["position_size"])
            order_id = order['id']
            
            # Place SL and TP
            sl_side = 'sell' if side == 'buy' else 'buy'
            try:
                await exchange.create_order(
                    asset, 'STOP_MARKET', sl_side, risk["position_size"], 
                    params={'stopPrice': risk["stop_loss"]}
                )
                await exchange.create_order(
                    asset, 'TAKE_PROFIT_MARKET', sl_side, risk["position_size"], 
                    params={'stopPrice': risk["take_profit"]}
                )
            except Exception as e:
                print(f"SL/TP Order Error: {e}")

        # 5. Save to DB
        await save_trade_to_db(state, order_id)

        return {"order_id": order_id}

    except Exception as e:
        error_msg = f"Executor error: {str(e)}"
        print(error_msg)
        return {"error": error_msg}
