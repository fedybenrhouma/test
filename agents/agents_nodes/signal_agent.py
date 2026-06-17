import os
import logging
import numpy as np
import pandas as pd
import ta
import sys
import io
import json
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from langchain_core.messages import HumanMessage
from graph.state import MASState
from sklearn.model_selection import GridSearchCV, TimeSeriesSplit
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score, 
    recall_score, classification_report, 
    balanced_accuracy_score, average_precision_score
)
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline
from xgboost import XGBClassifier
from dotenv import load_dotenv

# Import production-grade utils
from utils.crypto_utils import fetch_ohlcv_hybrid

# --- Production Logging Setup ---
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("signal_agent.log", encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("SignalAgent")

load_dotenv()

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "signal_model.json")

class SignalModel:
    """Production-grade XGBoost Signal Model for Cryptocurrency Trading."""
    
    def __init__(self, model_path: str = None):
        self.model_path = model_path or MODEL_PATH
        self.metadata_path = self.model_path.replace(".json", "_metadata.json")
        self.model = XGBClassifier()
        self.is_trained = False
        self.feature_cols = [
            "rsi", "rsi_lag1", "rsi_lag2",
            "macd_diff", "macd_diff_lag1", "macd_diff_lag2",
            "regime", "dist_ema200",
            "bb_position", "bb_position_lag1",
            "volume_ratio", "volume_ratio_lag1",
            "price_change", "volatility_24h"
        ]
        self._load_if_exists()

    def _load_if_exists(self):
        if os.path.exists(self.model_path):
            try:
                self.model.load_model(self.model_path)
                self.is_trained = True
                logger.info(f"✅ Production Model loaded from {self.model_path}")
            except Exception as e:
                logger.error(f"❌ Failed to load production model: {e}")

    def build_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Production feature engineering pipeline with robust error handling."""
        try:
            if df.empty or len(df) < 200:
                return pd.DataFrame()
                
            df = df.copy().sort_values("timestamp")
            
            # 1. Momentum 
            df["rsi"] = ta.momentum.RSIIndicator(close=df["close"], window=14).rsi()
            df["roc"] = ta.momentum.ROCIndicator(close=df["close"], window=10).roc()
            stoch = ta.momentum.StochasticOscillator(high=df["high"], low=df["low"], close=df["close"], window=14)
            df["stoch_k"] = stoch.stoch()
            
            # 2. Trend & Regime
            macd = ta.trend.MACD(close=df["close"])
            df["macd_diff"] = macd.macd_diff()
            df["ema_200"] = ta.trend.EMAIndicator(close=df["close"], window=200).ema_indicator()
            df["regime"] = (df["close"] > df["ema_200"]).astype(int)
            df["dist_ema200"] = (df["close"] - df["ema_200"]) / df["ema_200"]

            # 3. Volatility
            bb = ta.volatility.BollingerBands(close=df["close"], window=20)
            df["bb_position"] = (df["close"] - bb.bollinger_lband()) / (bb.bollinger_hband() - bb.bollinger_lband())
            
            # 4. Volume Profile
            df["volume_ratio"] = df["volume"] / df["volume"].rolling(window=20).mean()

            # 5. Lags (Capturing Velocity)
            for col in ["rsi", "macd_diff", "volume_ratio", "bb_position"]:
                df[f"{col}_lag1"] = df[col].shift(1)
                df[f"{col}_lag2"] = df[col].shift(2)

            # 6. Price Action
            df["price_change"] = df["close"].pct_change()
            df["volatility_24h"] = df["close"].pct_change().rolling(window=24).std()

            return df.dropna()
        except Exception as e:
            logger.error(f"Feature engineering failed: {e}")
            return pd.DataFrame()

    def train(self, df: pd.DataFrame, use_grid_search: bool = True) -> Dict:
        """Industry-standard training with Walk-Forward Cross-Validation."""
        logger.info("🚀 Initiating elite training cycle...")
        
        df = self.build_features(df)
        if df.empty:
            raise ValueError("Insufficient data after feature engineering.")
            
        df["future_return"] = df["close"].shift(-3) / df["close"] - 1
        df["target"] = (df["future_return"] > 0.005).astype(int)
        df = df.dropna()

        X = df[self.feature_cols]
        y = df["target"]

        # Walk-forward validation (TimeSeriesSplit) to prevent look-ahead bias
        tscv = TimeSeriesSplit(n_splits=5)
        
        num_neg, num_pos = np.sum(y == 0), np.sum(y == 1)
        scale_weight = num_neg / num_pos if num_pos > 0 else 1.0

        pipeline = ImbPipeline([
            ('smote', SMOTE(random_state=42, sampling_strategy=0.3)),
            ('xgb', XGBClassifier(eval_metric="logloss", random_state=42))
        ])

        param_grid = {
            'xgb__max_depth': [3, 4, 5],
            'xgb__learning_rate': [0.03, 0.05],
            'xgb__n_estimators': [200, 400],
            'xgb__scale_pos_weight': [scale_weight * 0.5, scale_weight]
        }

        logger.info(f"GridSearch Optimization (CV={tscv.n_splits})...")
        grid = GridSearchCV(pipeline, param_grid, cv=tscv, scoring='average_precision', n_jobs=-1)
        grid.fit(X, y)
        self.model = grid.best_estimator_.named_steps['xgb']
        
        # Performance Evaluation & Thresholding
        y_probs = self.model.predict_proba(X)[:, 1]
        best_f1, best_thresh = 0, 0.5
        for thresh in np.arange(0.1, 0.9, 0.05):
            f1 = f1_score(y, (y_probs >= thresh).astype(int), zero_division=0)
            if f1 > best_f1:
                best_f1, best_thresh = f1, thresh

        y_pred = (y_probs >= best_thresh).astype(int)
        metrics = {
            "balanced_acc": float(balanced_accuracy_score(y, y_pred)),
            "accuracy": float(accuracy_score(y, y_pred)),
            "f1": float(f1_score(y, y_pred, zero_division=0)),
            "precision": float(precision_score(y, y_pred, zero_division=0)),
            "recall": float(recall_score(y, y_pred, zero_division=0)),
            "auprc": float(average_precision_score(y, y_probs)),
            "best_threshold": float(best_thresh),
            "trained_at": datetime.now().isoformat(),
            "best_params": {k: str(v) for k, v in grid.best_params_.items()}
        }
        
        self._save(metrics)
        self.is_trained = True
        logger.info(f"🏆 Elite training complete. AUPRC: {metrics['auprc']:.2%}")
        return metrics

    def _save(self, metadata: Dict):
        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
        self.model.save_model(self.model_path)
        with open(self.metadata_path, 'w') as f:
            json.dump(metadata, f, indent=4)

    def predict(self, latest_df: pd.DataFrame) -> Tuple[str, float, str]:
        """High-performance thread-safe inference."""
        if not self.is_trained:
            return "neutral", 0.0, "Model offline."

        try:
            df = self.build_features(latest_df)
            if df.empty:
                return "neutral", 0.0, "Data gap detected."

            latest_features = df[self.feature_cols].tail(1)
            prob = self.model.predict_proba(latest_features)[0]
            
            with open(self.metadata_path, 'r') as f:
                meta = json.load(f)
            threshold = meta.get("best_threshold", 0.5)

            if prob[1] >= threshold:
                return "long", float(prob[1]), f"High-conviction bullish (Confidence: {prob[1]:.1%})"
            return "neutral", float(prob[0]), f"Market noise / Low conviction (Prob: {prob[1]:.1%})"
        except Exception as e:
            logger.error(f"Inference crash: {e}")
            return "neutral", 0.0, f"Critical: {str(e)}"

# Singleton Instance
signal_model = SignalModel()

async def signal_agent_node(state: MASState) -> dict:
    """Production MAS Integration Node."""
    asset = state.get("asset", "BTC/USDT")
    timeframe = state.get("timeframe", "1h")
    
    logger.info(f"Production analysis started: {asset}")
    
    try:
        df = fetch_ohlcv_hybrid(asset, timeframe, limit=500)
        direction, confidence, reasoning = signal_model.predict(df)
        
        status_emoji = "📈" if direction == "long" else "⚪"
        message = (
            f"⚡ **SIGNAL AGENT V2 (PRO)**\n"
            f"Asset: `{asset}` | Time: `{datetime.now().strftime('%H:%M:%S')}`\n"
            f"Verdict: **{direction.upper()}** {status_emoji}\n"
            f"Confidence: `{confidence:.1%}`\n"
            f"Reasoning: {reasoning}"
        )

        return {
            "signal_model": {
                "signal": direction,
                "confidence": confidence,
                "reasoning": reasoning,
                "node_status": "healthy"
            },
            "messages": [HumanMessage(content=message, name="signal_agent")]
        }
    except Exception as e:
        logger.error(f"Node failure: {e}")
        return {
            "signal_model": {"signal": "neutral", "confidence": 0.0, "reasoning": f"Node Error: {e}"},
            "messages": [HumanMessage(content=f"❌ Signal Agent critical failure: {e}", name="signal_agent")]
        }

def train_and_save_model(asset="BTC/USDT", timeframe="1h", use_grid_search=True):
    """External CLI entry point for retraining."""
    df = fetch_ohlcv_hybrid(asset, timeframe, limit=5000)
    return signal_model.train(df, use_grid_search=use_grid_search)
