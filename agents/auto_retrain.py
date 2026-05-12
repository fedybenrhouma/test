import os
import time
import asyncio
import psycopg2
import sys
import io
from agents_nodes.signal_agent import train_and_save_model, MODEL_PATH
from dotenv import load_dotenv

# Force UTF-8 encoding for Windows console to support emojis/special chars
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        # Fallback for older python versions if reconfigure is not available
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', line_buffering=True)

load_dotenv()

# List of assets to keep trained
ASSETS_TO_TRAIN = [
    "BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT"
]

RETRAIN_INTERVAL_DAYS = 7 # Retrain every week

def get_db_connection():
    url = os.getenv("POSTGRES_URL")
    if not url:
        DB_HOST = os.getenv("DB_HOST", "localhost")
        DB_NAME = os.getenv("DB_NAME", "postgres")
        DB_USER = os.getenv("DB_USER", "postgres")
        DB_PASS = os.getenv("DB_PASS", "postgres")
        url = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}/{DB_NAME}"
        
    if url and "cryptoAI" not in url and "account_system" in url:
        url = url.replace("account_system", "cryptoAI")
    return psycopg2.connect(url)

def setup_retrain_log():
    """Create a table to track model versions and performance."""
    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS model_training_logs (
                id SERIAL PRIMARY KEY,
                asset VARCHAR(20),
                timeframe VARCHAR(10),
                accuracy NUMERIC,
                f1_score NUMERIC,
                precision_score NUMERIC,
                recall_score NUMERIC,
                trained_at TIMESTAMP DEFAULT NOW()
            );
        """)
        conn.commit()
    conn.close()

def log_training(asset, metrics):
    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO model_training_logs 
            (asset, timeframe, accuracy, f1_score, precision_score, recall_score)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            asset, "1h", 
            metrics['accuracy'], metrics['f1'], 
            metrics['precision'], metrics['recall']
        ))
        conn.commit()
    conn.close()

def run_retraining_cycle():
    print("🔄 Starting Automated ML Retraining Cycle...")
    
    for asset in ASSETS_TO_TRAIN:
        try:
            # 1. Train model with GridSearchCV
            metrics = train_and_save_model(asset=asset, timeframe="1h", use_grid_search=True)
            
            if metrics:
                # 2. Log performance to DB
                log_training(asset, metrics)
                print(f"✅ Retraining complete for {asset}. F1-Score: {metrics['f1']:.2%}")
            
            # Sleep between assets to avoid CPU spikes
            time.sleep(5)
            
        except Exception as e:
            print(f"❌ Error retraining {asset}: {e}")

if __name__ == "__main__":
    setup_retrain_log()
    
    while True:
        run_retraining_cycle()
        
        print(f"⏳ Next retraining cycle in {RETRAIN_INTERVAL_DAYS} days...")
        # Sleep for the interval
        time.sleep(RETRAIN_INTERVAL_DAYS * 24 * 3600)
