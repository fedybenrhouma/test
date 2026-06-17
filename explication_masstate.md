# Explication du Flux de Données et du MASState (LangGraph)

Dans l'architecture de votre Système Multi-Agents (MAS) gérée par **LangGraph**, les agents ne communiquent pas en s'envoyant des messages directement de l'un à l'autre. Ils utilisent tous un "tableau blanc commun" appelé le **MASState**.

## 1. Qu'est-ce que le MASState ?
Le `MASState` est un objet (un dictionnaire en Python) qui représente l'état global et partagé de l'analyse en cours. Au début du cycle, il contient uniquement les paramètres de départ (l'actif, le TimeFrame). Au fur et à mesure que les agents s'exécutent, ils **ajoutent** ou **mettent à jour** leurs conclusions dans ce dictionnaire.

Voici à quoi ressemble la structure du `MASState` :
```python
class MASState(TypedDict):
    asset: str                 # Ex: "BTC/USDT"
    timeframe: str             # Ex: "1h"
    technical_model: dict      # Rempli par l'Agent Technique
    sentiment_model: dict      # Rempli par l'Agent Sentiment
    trend_model: dict          # Rempli par l'Agent Tendance
    signal_model: dict         # Rempli par l'Agent ML (XGBoost)
    volatility_model: dict     # Rempli par l'Agent Volatilité
    risk_model: dict           # Rempli par le Risk Manager
    devils_argument: str       # Rempli par l'Avocat du Diable
    coordinator_verdict: str   # Rempli par le Coordinateur
    messages: Annotated[list, add_messages] # Historique des logs du débat
```

---

## 2. Le Flux de Données (Qui envoie quoi à qui ?)

L'exécution se déroule en plusieurs phases. Voici comment le `MASState` se remplit :

### Phase 1 : Exécution Parallèle (Les Analystes)
Tous ces agents démarrent en même temps. Ils lisent `asset` et `timeframe` depuis le MASState, font leurs calculs, et écrivent leur résultat dans leur case respective.
*   **L'Agent Technique** écrit dans `technical_model` : `{ "signal": "long", "confidence": 0.8 }`
*   **L'Agent Sentiment** écrit dans `sentiment_model` : `{ "signal": "neutral", "confidence": 0.5, "reason": "Marché indécis selon les news" }`
*   **L'Agent ML** écrit dans `signal_model` : `{ "signal": "short", "confidence": 0.6 }`
*   **L'Agent Volatilité** écrit dans `volatility_model` : `{ "atr": 1500, "is_turbulent": False }`

### Phase 2 : Le Filtre de Sécurité (Le Risk Manager)
Une fois que **tous** les analystes ont terminé, LangGraph passe le `MASState` rempli au **Risk Manager**.
*   **Ce qu'il lit :** Le prix actuel, l'ATR (donné par l'Agent Volatilité), et les signaux des autres agents.
*   **Ce qu'il écrit :** Dans `risk_model`, il ajoute les limites de protection : `{ "stop_loss": 62000, "take_profit": 65000, "recommended_size": "0.5 BTC" }`. Il peut aussi écrire un veto ("TRADE_BLOCKED") si le risque est trop grand.

### Phase 3 : La Contradiction (L'Avocat du Diable)
Le `MASState` passe ensuite à l'**Avocat du Diable**.
*   **Ce qu'il lit :** Absolument tout ce qui a été écrit avant lui (Signaux techniques, sentiment, risque).
*   **Ce qu'il écrit :** Dans `devils_argument`, il génère un texte critique : *"Vous voulez tous acheter (Long), mais le volume est faible et la news X est ignorée. Risque de faux signal."*

### Phase 4 : Le Consensus (Le Coordinateur)
C'est le juge final. Le `MASState` complet lui est remis.
*   **Ce qu'il lit :** Les signaux des analystes, les limites du Risk Manager, et la critique de l'Avocat du Diable.
*   **Ce qu'il écrit :** Dans `coordinator_verdict`, il rédige la décision finale finale justifiée : *"Malgré la critique de l'Avocat, l'ATR est bas et le signal ML est fort. Verdict : LONG."*

### Phase 5 : L'Action (L'Executor)
*   **Ce qu'il lit :** Le `coordinator_verdict` et le `risk_model` (pour avoir le SL et TP).
*   **Ce qu'il fait :** Il n'écrit plus dans l'état, il utilise ces données finales pour envoyer l'ordre réel à l'API Binance (CCXT).

---
**En résumé :** Il n'y a pas de communication directe de type "Agent A parle à Agent B". C'est un processus d'**enrichissement progressif**. Le `MASState` agit comme un dossier médical qui passe de spécialiste en spécialiste, jusqu'à ce que le chirurgien en chef (le Coordinateur) décide de l'opération finale.
