import os
import ccxt
import numpy as np
import pandas as pd
import ta
import psycopg2
import sys
import io
from langchain_core.messages import HumanMessage
from graph.state import MASState
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, classification_report
from xgboost import XGBClassifier
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

# --- Database Config ---
POSTGRES_URL = os.getenv("POSTGRES_URL")

def get_db_connection():
    url = POSTGRES_URL
    if not url:
        # Fallback for local dev if URL is not in env
        DB_HOST = os.getenv("DB_HOST", "localhost")
        DB_NAME = os.getenv("DB_NAME", "postgres")
        DB_USER = os.getenv("DB_USER", "postgres")
        DB_PASS = os.getenv("DB_PASS", "postgres")
        url = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}/{DB_NAME}"
    
    if "cryptoAI" not in url and "account_system" in url:
        url = url.replace("account_system", "cryptoAI")
    return psycopg2.connect(url)

# --- Model path ---
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "signal_model.json")


def fetch_ohlcv_hybrid(asset: str, timeframe: str, limit: int = 2000) -> pd.DataFrame:
    """Fetch OHLCV candles from Database + CCXT fallback."""
    df_db = pd.DataFrame()
    
    # 1. Try to fetch from local database first
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
        conn.close()
        if not df_db.empty:
            df_db['timestamp'] = pd.to_datetime(df_db['timestamp'])
            print(f"📦 Loaded {len(df_db)} candles from database for {asset}.")
    except Exception as e:
        print(f"⚠️ Database fetch failed: {e}")

    # 2. Fetch latest from CCXT to ensure we have the most recent data
    try:
        exchange = ccxt.binance()
        ohlcv = exchange.fetch_ohlcv(asset, timeframe, limit=500)
        df_ccxt = pd.DataFrame(ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"])
        df_ccxt["timestamp"] = pd.to_datetime(df_ccxt["timestamp"], unit="ms")
        
        if df_db.empty:
            return df_ccxt
        
        # Combine and deduplicate
        df_combined = pd.concat([df_db, df_ccxt]).drop_duplicates(subset=['timestamp']).sort_values('timestamp')
        return df_combined.tail(limit)
    except Exception as e:
        print(f"⚠️ CCXT fetch failed: {e}")
        return df_db


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build all features the XGBoost model will use.
    These MUST match exactly what was used during training.
    """
    df = df.copy()
    
    # Ensure data is sorted
    df = df.sort_values("timestamp")

    # --- Momentum ---
    df["rsi"] = ta.momentum.RSIIndicator(close=df["close"], window=14).rsi()
    df["roc"] = ta.momentum.ROCIndicator(close=df["close"], window=10).roc()
    stoch = ta.momentum.StochasticOscillator(
        high=df["high"], low=df["low"], close=df["close"], window=14
    )
    df["stoch_k"] = stoch.stoch()
    df["stoch_d"] = stoch.stoch_signal()

    # --- Trend ---
    macd = ta.trend.MACD(close=df["close"])
    df["macd"]        = macd.macd()
    df["macd_signal"] = macd.macd_signal()
    df["macd_diff"]   = macd.macd_diff()
    df["ema_20"]      = ta.trend.EMAIndicator(close=df["close"], window=20).ema_indicator()
    df["ema_50"]      = ta.trend.EMAIndicator(close=df["close"], window=50).ema_indicator()
    df["ema_ratio"]   = df["ema_20"] / df["ema_50"]  # > 1 = bullish

    # --- Volatility ---
    bb = ta.volatility.BollingerBands(close=df["close"], window=20, window_dev=2)
    df["bb_width"]    = (bb.bollinger_hband() - bb.bollinger_lband()) / bb.bollinger_mavg()
    df["bb_position"] = (df["close"] - bb.bollinger_lband()) / (
        bb.bollinger_hband() - bb.bollinger_lband()
    )  # 0 = at lower band, 1 = at upper band
    atr = ta.volatility.AverageTrueRange(
        high=df["high"], low=df["low"], close=df["close"], window=14
    )
    df["atr_pct"] = atr.average_true_range() / df["close"]

    # --- Volume ---
    df["volume_sma"]   = df["volume"].rolling(window=20).mean()
    df["volume_ratio"] = df["volume"] / df["volume_sma"]  # > 1 = above average volume

    # --- Price action ---
    df["candle_body"]  = abs(df["close"] - df["open"]) / df["open"]
    df["price_change"] = df["close"].pct_change()
    df["high_low_pct"] = (df["high"] - df["low"]) / df["close"]

    return df


# --- Feature column names (must match training) ---
FEATURE_COLS = [
    "rsi", "roc", "stoch_k", "stoch_d",
    "macd", "macd_signal", "macd_diff", "ema_ratio",
    "bb_width", "bb_position", "atr_pct",
    "volume_ratio", "candle_body", "price_change", "high_low_pct"
]


def train_and_save_model(asset: str = "BTC/USDT", timeframe: str = "1h", use_grid_search: bool = True):
    """
    Train XGBoost model on historical data and save it.
    """
    print(f"🚀 Starting model training for {asset} {timeframe}...")
    df = fetch_ohlcv_hybrid(asset, timeframe, limit=5000)
    
    if len(df) < 100:
        print("❌ Not enough data to train.")
        return None

    df = build_features(df)

    # --- Label: did price go up by at least 0.5% in the next 3 candles? ---
    df["future_return"] = df["close"].shift(-3) / df["close"] - 1
    df["target"] = (df["future_return"] > 0.005).astype(int)

    # Drop NaN rows (from indicators + future label)
    df = df.dropna()

    X = df[FEATURE_COLS]
    y = df["target"]

    # Train/test split (no shuffle for time series)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, shuffle=False
    )

    if use_grid_search:
        print("🔍 Running GridSearchCV for hyperparameter optimization...")
        param_grid = {
            'max_depth': [3, 4, 5, 6],
            'learning_rate': [0.01, 0.05, 0.1],
            'n_estimators': [100, 200, 300],
            'subsample': [0.7, 0.8, 0.9],
            'colsample_bytree': [0.7, 0.8, 0.9]
        }
        xgb = XGBClassifier(eval_metric="logloss", random_state=42)
        grid_search = GridSearchCV(xgb, param_grid, cv=3, scoring='f1', n_jobs=-1)
        grid_search.fit(X_train, y_train)
        model = grid_search.best_estimator_
        print(f"✅ Best parameters: {grid_search.best_params_}")
    else:
        model = XGBClassifier(n_estimators=200, max_depth=4, learning_rate=0.05, eval_metric="logloss", random_state=42)
        model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    metrics = {
        "accuracy": accuracy_score(y_test, y_pred),
        "f1": f1_score(y_test, y_pred),
        "precision": precision_score(y_test, y_pred),
        "recall": recall_score(y_test, y_pred)
    }
    
    print("\n📊 Model Evaluation:")
    print(f"Accuracy:  {metrics['accuracy']:.2%}")
    print(f"F1-Score:  {metrics['f1']:.2%}")
    print(f"Precision: {metrics['precision']:.2%}")
    print(f"Recall:    {metrics['recall']:.2%}")
    print("\nClassification Report:\n", classification_report(y_test, y_pred))

    # Save model
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    model.save_model(MODEL_PATH)
    print(f"💾 Model saved to {MODEL_PATH}")
    return metrics


def load_model():
    """Load the trained XGBoost model."""
    model = XGBClassifier()
    model.load_model(MODEL_PATH)
    return model


async def signal_agent_node(state: MASState) -> dict:
    """
    Signal Agent — ML-based trading signal using XGBoost.
    """
    try:
        asset = state["asset"]
        timeframe = state["timeframe"]

        if not os.path.exists(MODEL_PATH):
            return {
                "signal_model": {
                    "signal": "neutral",
                    "confidence": 0.0,
                    "reasoning": "Model not trained yet."
                },
                "messages": [HumanMessage(content="⚠️ Signal Agent: Model not trained.", name="signal_agent")]
            }

        # Fetch latest candles (hybrid)
        df = fetch_ohlcv_hybrid(asset, timeframe, limit=200)
        df = build_features(df)
        df = df.dropna()

        if df.empty:
            raise ValueError("No valid features generated from latest data.")

        latest_features = df[FEATURE_COLS].iloc[-1:]

        # Load model and predict
        model = load_model()
        prediction = model.predict(latest_features)[0]
        probability = model.predict_proba(latest_features)[0]

        if prediction == 1:
            signal = "long"
            confidence = round(float(probability[1]), 3)
        else:
            signal = "short"
            confidence = round(float(probability[0]), 3)

        if confidence < 0.6:
            signal = "neutral"

        reasoning = (
            f"XGBoost model predicts {'upward' if prediction == 1 else 'downward'} movement. "
            f"Prob: {probability[1]:.1%} long / {probability[0]:.1%} short. "
            f"Indicators: RSI={df['rsi'].iloc[-1]:.1f}, BB Pos={df['bb_position'].iloc[-1]:.2f}"
        )

        message_content = (
            f"🤖 Signal Agent (XGBoost)\n"
            f"Prediction: {'📈 LONG' if prediction == 1 else '📉 SHORT'}\n"
            f"Confidence: {confidence:.1%}\n"
            f"Signal: {signal.upper()}"
        )

        return {
            "signal_model": {"signal": signal, "confidence": confidence, "reasoning": reasoning},
            "messages": [HumanMessage(content=message_content, name="signal_agent")]
        }

    except Exception as e:
        return {
            "signal_model": {"signal": "neutral", "confidence": 0.0, "reasoning": f"Error: {str(e)}"},
            "messages": [HumanMessage(content=f"Signal Agent Error: {str(e)}", name="signal_agent")]
        }