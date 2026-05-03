import os
import sys
import io
import time
import ccxt
import psycopg
from datetime import datetime
from dotenv import load_dotenv

# Force UTF-8 encoding for Windows console to support emojis/special chars
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

load_dotenv()

# Database connection URL
POSTGRES_URL = os.getenv("POSTGRES_URL")

def get_db_connection():
    # Handle the cryptoAI vs account_system naming as seen in coordinator.py
    url = POSTGRES_URL
    if url and "cryptoAI" not in url and "account_system" in url:
        url = url.replace("account_system", "cryptoAI")
    return psycopg.connect(url)

def setup_database():
    """Create the coin_price_history table with UNIQUE constraint."""
    print("🗄️ Setting up database table...")
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS coin_price_history (
                        id SERIAL PRIMARY KEY,
                        asset VARCHAR(20),
                        timeframe VARCHAR(10),
                        open_time TIMESTAMP,
                        open NUMERIC,
                        high NUMERIC,
                        low NUMERIC,
                        close NUMERIC,
                        volume NUMERIC,
                        UNIQUE(asset, timeframe, open_time)
                    );
                """)
                conn.commit()
        print("✅ Database ready.")
    except Exception as e:
        print(f"❌ Error setting up database: {e}")

def collect_data(asset='BTC/USDT', timeframe='1h', limit=1000):
    """Fetch and store OHLCV data."""
    exchange = ccxt.binance()
    print(f"📥 Fetching {limit} {timeframe} candles for {asset}...")
    
    try:
        ohlcv = exchange.fetch_ohlcv(asset, timeframe, limit=limit)
        
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                inserted_count = 0
                for candle in ohlcv:
                    # Convert timestamp to datetime
                    open_time = datetime.fromtimestamp(candle[0] / 1000.0)
                    
                    cur.execute("""
                        INSERT INTO coin_price_history 
                        (asset, timeframe, open_time, open, high, low, close, volume)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (asset, timeframe, open_time) DO NOTHING
                    """, (
                        asset, timeframe, open_time, 
                        candle[1], candle[2], candle[3], candle[4], candle[5]
                    ))
                    if cur.rowcount > 0:
                        inserted_count += 1
                conn.commit()
                print(f"✅ Stored {inserted_count} new candles for {asset}.")
    except Exception as e:
        print(f"❌ Error fetching/storing data: {e}")

POPULAR_COINS = [
    'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
    'ADA/USDT', 'DOGE/USDT', 'AVAX/USDT', 'DOT/USDT', 'LINK/USDT',
    'MATIC/USDT', 'SHIB/USDT', 'LTC/USDT', 'UNI/USDT', 'NEAR/USDT'
]

if __name__ == "__main__":
    setup_database()
    
    print("🚀 Starting initial backfill for popular coins...")
    for coin in POPULAR_COINS:
        collect_data(asset=coin, limit=1000)
        time.sleep(2) # Prevent rate limiting from Binance
    
    # Repeat every hour
    print("⏳ Entering hourly update loop...")
    while True:
        # Sleep for 1 hour
        time.sleep(3600)
        print("🔄 Fetching hourly updates...")
        for coin in POPULAR_COINS:
            collect_data(asset=coin, limit=10) # Fetch last few candles to ensure no gaps
            time.sleep(2)
