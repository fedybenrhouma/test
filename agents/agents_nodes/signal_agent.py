import os
import ccxt
import numpy as np
import pandas as pd
import ta
from langchain_core.messages import HumanMessage
from graph.state import MASState


# --- Model path ---
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "signal_model.json")


def fetch_ohlcv(asset: str, timeframe: str, limit: int = 200) -> pd.DataFrame:
    """Fetch OHLCV candles from Binance."""
    exchange = ccxt.binance()
    ohlcv = exchange.fetch_ohlcv(asset, timeframe, limit=limit)
    df = pd.DataFrame(ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"])
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
    return df


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build all features the XGBoost model will use.
    These MUST match exactly what was used during training.
    """

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


def train_and_save_model(asset: str = "BTC/USDT", timeframe: str = "1h"):
    """
    Train XGBoost model on historical Binance data and save it.
    Run this ONCE before using the signal agent.
    Call: python -c "from agents_nodes.signal_agent import train_and_save_model; train_and_save_model()"
    """
    from xgboost import XGBClassifier
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import accuracy_score

    print(f"Fetching training data for {asset} {timeframe}...")
    df = fetch_ohlcv(asset, timeframe, limit=1000)
    df = build_features(df)

    # --- Label: did price go up by at least 0.5% in the next 3 candles? ---
    df["future_return"] = df["close"].shift(-3) / df["close"] - 1
    df["target"] = (df["future_return"] > 0.005).astype(int)
    # 1 = long signal (price went up 0.5%+)
    # 0 = short/neutral signal

    # Drop NaN rows (from indicators + future label)
    df = df.dropna()

    X = df[FEATURE_COLS]
    y = df["target"]

    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, shuffle=False  # no shuffle — time series data
    )

    print(f"Training on {len(X_train)} samples, testing on {len(X_test)} samples...")

    # Train XGBoost
    model = XGBClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric="logloss",
        random_state=42
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False
    )

    # Evaluate
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    print(f"Model accuracy: {accuracy:.2%}")

    # Save model
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    model.save_model(MODEL_PATH)
    print(f"Model saved to {MODEL_PATH}")
    return accuracy


def load_model():
    """Load the trained XGBoost model."""
    from xgboost import XGBClassifier
    model = XGBClassifier()
    model.load_model(MODEL_PATH)
    return model


async def signal_agent_node(state: MASState) -> dict:
    """
    Signal Agent — ML-based trading signal using XGBoost.
    Uses a trained model to predict price direction
    based on technical features.
    """
    try:
        asset = state["asset"]
        timeframe = state["timeframe"]

        # 1. Check if model exists
        if not os.path.exists(MODEL_PATH):
            return {
                "signal_model": {
                    "signal": "neutral",
                    "confidence": 0.0,
                    "reasoning": "Model not trained yet. Run train_and_save_model() first."
                },
                "messages": [HumanMessage(
                    content="⚠️ Signal Agent: Model not trained yet. Returning neutral.",
                    name="signal_agent"
                )]
            }

        # 2. Fetch latest candles
        df = fetch_ohlcv(asset, timeframe, limit=200)

        # 3. Build features
        df = build_features(df)
        df = df.dropna()

        # 4. Get latest row of features
        latest_features = df[FEATURE_COLS].iloc[-1:]

        # 5. Load model and predict
        model = load_model()
        prediction = model.predict(latest_features)[0]           # 0 or 1
        probability = model.predict_proba(latest_features)[0]    # [prob_0, prob_1]

        # 6. Convert to signal
        if prediction == 1:
            signal = "long"
            confidence = round(float(probability[1]), 3)
        else:
            signal = "short"
            confidence = round(float(probability[0]), 3)

        # Downgrade to neutral if model is not confident
        if confidence < 0.6:
            signal = "neutral"

        reasoning = (
            f"XGBoost model predicts {'upward' if prediction == 1 else 'downward'} price movement. "
            f"Probability: {probability[1]:.1%} long / {probability[0]:.1%} short. "
            f"Key features: RSI={df['rsi'].iloc[-1]:.1f}, "
            f"BB position={df['bb_position'].iloc[-1]:.2f}, "
            f"Volume ratio={df['volume_ratio'].iloc[-1]:.2f}x"
        )

        # 7. Build message for debate log
        message_content = (
            f"🤖 Signal Agent Report (XGBoost ML Model)\n"
            f"Asset: {asset} | Timeframe: {timeframe}\n"
            f"Prediction: {'📈 LONG' if prediction == 1 else '📉 SHORT'}\n"
            f"Confidence: {confidence:.1%}\n"
            f"Long probability:  {probability[1]:.1%}\n"
            f"Short probability: {probability[0]:.1%}\n"
            f"Signal: {signal.upper()}\n"
            f"Reasoning: {reasoning}"
        )

        return {
            "signal_model": {
                "signal": signal,
                "confidence": confidence,
                "reasoning": reasoning
            },
            "messages": [HumanMessage(content=message_content, name="signal_agent")]
        }

    except Exception as e:
        error_msg = f"Signal Agent error: {str(e)}"
        return {
            "signal_model": {
                "signal": "neutral",
                "confidence": 0.0,
                "reasoning": f"Error occurred: {str(e)}"
            },
            "messages": [HumanMessage(content=error_msg, name="signal_agent")],
            "error": error_msg
        }