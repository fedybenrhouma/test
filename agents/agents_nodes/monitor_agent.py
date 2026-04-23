import sys
import io

# Force UTF-8 encoding for Windows console to support emojis/special chars
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

import os
import uuid
import ccxt
import psycopg
import pandas as pd
from graph.state import MASState
from agents_nodes.technical_analyst import calculate_indicators, fetch_ohlcv

async def fetch_open_trades() -> list:
    """Fetch all open trades from PostgreSQL."""
    postgres_url = os.getenv("POSTGRES_URL")
    try:
        async with await psycopg.AsyncConnection.connect(postgres_url) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "SELECT id, user_id, asset, direction, entry_price, stop_loss, take_profit, position_size, order_id FROM trades WHERE status = 'open'"
                )
                rows = await cur.fetchall()
                return [
                    {
                        "id": r[0], "user_id": r[1], "asset": r[2], "direction": r[3],
                        "entry_price": r[4], "stop_loss": r[5], "take_profit": r[6],
                        "position_size": r[7], "order_id": r[8]
                    } for r in rows
                ]
    except Exception as e:
        print(f"Monitor error fetching trades: {e}")
    return []

async def close_trade(trade: dict, reason: str, current_price: float):
    """Close trade in DB, create an alert, and potentially on Exchange."""
    postgres_url = os.getenv("POSTGRES_URL")
    
    # Calculate PNL
    if trade["direction"] == "long":
        pnl = (current_price - float(trade["entry_price"])) * float(trade["position_size"])
    else:
        pnl = (float(trade["entry_price"]) - current_price) * float(trade["position_size"])

    try:
        async with await psycopg.AsyncConnection.connect(postgres_url) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    UPDATE trades 
                    SET status = 'closed', close_reason = %s, close_price = %s, pnl = %s, updated_at = NOW()
                    WHERE id = %s
                    """,
                    (reason, current_price, pnl, trade["id"])
                )
                
                # Create a trade closed alert
                alert_id = str(uuid.uuid4())
                symbol_clean = trade["asset"].split("/")[0]
                coin_id = symbol_clean.lower()
                message = f"Closed {trade['direction'].upper()} position at ${current_price:,.2f}. Reason: {reason.replace('_', ' ').title()}. PNL: {'+' if pnl >= 0 else '-'}${abs(pnl):,.2f}"
                
                await cur.execute(
                    """
                    INSERT INTO "Alerts" (id, "userId", "coinId", symbol, "targetPrice", condition, "isTriggered", "triggeredAt", "isRead", "createdAt", "updatedAt", type, message)
                    VALUES (%s, %s, %s, %s, %s, 'above', true, NOW(), false, NOW(), NOW(), 'trade', %s)
                    """,
                    (alert_id, trade["user_id"], coin_id, symbol_clean, current_price, message)
                )
        print(f"Closed trade {trade['id']} for {trade['asset']}: {reason} | PNL: {pnl}")
    except Exception as e:
        print(f"Error closing trade in DB: {e}")

async def monitor_trades():
    """
    Main loop for the Monitor Agent.
    Checks open trades against live price and technical indicators.
    """
    trades = await fetch_open_trades()
    if not trades:
        return

    for trade in trades:
        try:
            asset = trade["asset"]
            # 1. Fetch live price
            df = fetch_ohlcv(asset, "1m", limit=50) # Use 1m for fast monitoring
            current_price = float(df["close"].iloc[-1])

            # 2. Check Stop Loss / Take Profit
            if trade["direction"] == "long":
                if current_price <= float(trade["stop_loss"]):
                    await close_trade(trade, "stop_loss", current_price)
                    continue
                if current_price >= float(trade["take_profit"]):
                    await close_trade(trade, "take_profit", current_price)
                    continue
            else:
                if current_price >= float(trade["stop_loss"]):
                    await close_trade(trade, "stop_loss", current_price)
                    continue
                if current_price <= float(trade["take_profit"]):
                    await close_trade(trade, "take_profit", current_price)
                    continue

            # 3. Check for technical exit signals (early exit)
            indicators = calculate_indicators(df)
            if trade["direction"] == "long" and indicators["rsi"] > 80:
                await close_trade(trade, "rsi_overbought", current_price)
            elif trade["direction"] == "short" and indicators["rsi"] < 20:
                await close_trade(trade, "rsi_oversold", current_price)

        except Exception as e:
            print(f"Error monitoring trade {trade['id']}: {e}")

async def run_continuous_monitor(interval_seconds=60):
    print("🚀 Starting Monitor Agent continuous loop...")
    while True:
        try:
            print("🔍 Monitor Agent checking open trades...")
            await monitor_trades()
        except Exception as e:
            print(f"Monitor loop error: {e}")
        await asyncio.sleep(interval_seconds)

if __name__ == "__main__":
    import asyncio
    if os.name == 'nt':
        try:
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        except:
            pass
    from dotenv import load_dotenv
    load_dotenv()
    asyncio.run(run_continuous_monitor())
