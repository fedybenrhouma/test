import os
import ccxt
import pandas as pd
import psycopg2
import logging
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from binascii import unhexlify
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("CryptoUtils")

def get_db_connection():
    url = os.getenv("POSTGRES_URL")
    if not url:
        DB_HOST = os.getenv("DB_HOST", "localhost")
        DB_NAME = os.getenv("DB_NAME", "postgres")
        DB_USER = os.getenv("DB_USER", "postgres")
        DB_PASS = os.getenv("DB_PASS", "postgres")
        url = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}/{DB_NAME}"
    
    if "cryptoAI" not in url and "account_system" in url:
        url = url.replace("account_system", "cryptoAI")
    return psycopg2.connect(url)

def fetch_ohlcv_hybrid(asset: str, timeframe: str, limit: int = 2000) -> pd.DataFrame:
    """Fetch OHLCV candles from Database + CCXT fallback (Production Ready)."""
    df_db = pd.DataFrame()
    
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            query = """
                SELECT open_time as timestamp, open, high, low, close, volume 
                FROM coin_price_history 
                WHERE asset = %s AND timeframe = %s 
                ORDER BY open_time ASC
            """
            cur.execute(query, (asset, timeframe))
            rows = cur.fetchall()
            if rows:
                df_db = pd.DataFrame(rows, columns=["timestamp", "open", "high", "low", "close", "volume"])
                for col in ["open", "high", "low", "close", "volume"]:
                    df_db[col] = df_db[col].astype(float)
        conn.close()
        if not df_db.empty:
            df_db['timestamp'] = pd.to_datetime(df_db['timestamp'])
    except Exception as e:
        logger.warning(f"Database fetch failed: {e}")

    try:
        exchange = ccxt.binance()
        ohlcv = exchange.fetch_ohlcv(asset, timeframe, limit=500)
        df_ccxt = pd.DataFrame(ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"])
        df_ccxt["timestamp"] = pd.to_datetime(df_ccxt["timestamp"], unit="ms")
        
        if df_db.empty:
            return df_ccxt
        
        df_combined = pd.concat([df_db, df_ccxt]).drop_duplicates(subset=['timestamp']).sort_values('timestamp')
        return df_combined.tail(limit)
    except Exception as e:
        logger.error(f"CCXT fetch failed: {e}")
        return df_db

def decrypt_key(stored_text: str) -> str:
    """
    Decrypts a key from the format: iv:authTag:encrypted
    Matching the AES-256-GCM logic in backend/utils/crypto.js
    """
    if not stored_text:
        return ""
        
    try:
        parts = stored_text.split(':')
        if len(parts) != 3:
            return ""
            
        iv_hex, auth_tag_hex, encrypted_hex = parts
        
        # Convert hex to bytes
        iv = unhexlify(iv_hex)
        auth_tag = unhexlify(auth_tag_hex)
        encrypted = unhexlify(encrypted_hex)
        
        # Get encryption key from env (hex string)
        encryption_key_hex = os.getenv("ENCRYPTION_KEY")
        if not encryption_key_hex:
            raise ValueError("ENCRYPTION_KEY not found in environment variables.")
            
        key = unhexlify(encryption_key_hex)
        
        # AES-256-GCM in cryptography library expects (ciphertext + auth_tag)
        aesgcm = AESGCM(key)
        decrypted_bytes = aesgcm.decrypt(iv, encrypted + auth_tag, None)
        
        return decrypted_bytes.decode('utf-8')
        
    except Exception as e:
        print(f"Decryption error: {e}")
        return ""
