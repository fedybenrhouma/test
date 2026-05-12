# 📊 Spécifications UML Globales - PFE

> **Projet :** Plateforme de Trading Crypto Multi-Agents  
> **Objectif :** Architecture de haut niveau pour l'analyse et l'exécution de trades automatisés.

---

## 🎯 1. Diagramme de Cas d'Utilisation
Ce diagramme illustre les interactions stratégiques entre les acteurs externes et les fonctionnalités clés du système.

```mermaid
graph LR
    %% Styles
    classDef actor fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#01579b;
    classDef system fill:#fff3e0,stroke:#e65100,stroke-width:2px;
    classDef agent fill:#f3e5f5,stroke:#4a148c,stroke-width:2px;
    classDef external fill:#eceff1,stroke:#263238,stroke-width:2px,stroke-dasharray: 5 5;

    subgraph Acteurs_Externes [Acteurs]
        U[👤 Utilisateur]:::actor
        A[🔑 Administrateur]:::actor
    end

    subgraph Plateforme_PFE [Interface & Services]
        subgraph Marche_Watchlist [Marchés & Favoris]
            UC_M((Consulter Marchés)):::system
            UC_W((Gérer Watchlist)):::system
            UC_G((Visualiser Graphiques)):::system
        end
        
        subgraph Gestion_Compte [Compte & Accès]
            UC1((S'authentifier)):::system
            UC2((Connecter API Binance)):::system
            UC_S((S'abonner / Gérer Pro)):::system
        end

        subgraph Analyse_Action [Analyse & Trading]
            UC4((Lancer Cycle de Débat)):::system
            UC_T((Gérer ses Trades)):::system
            UC_CB((Chatbot dédié au Trade)):::system
        end

        UC7((Gérer Utilisateurs)):::system
    end

    subgraph SMA [Intelligence Multi-Agents]
        UC9((Analyse Technique/Sentiment)):::agent
        UC10((Négociation Consensus)):::agent
        UC11((Gestion des Risques)):::agent
        UC12((Exécution d'Ordres)):::agent
        UC_QA((Support IA / Chatbot)):::agent
    end

    B[🏦 API Binance]:::external
    TV[📈 Widget TradingView]:::external
    S[💳 Stripe API]:::external

    %% Relations
    U --- UC_M
    U --- UC_W
    U --- UC_G
    U --- UC1
    U --- UC2
    U --- UC_S
    U --- UC4
    U --- UC_T
    U --- UC_CB
    
    A --- UC7
    
    UC_G --- TV
    UC_S --- S
    
    UC4 -.-> UC9
    UC_CB --- UC_QA
    
    UC9 --- UC10
    UC10 --- UC11
    UC11 --- UC12
    
    UC12 --- B
    UC9 --- B
```

---

## 🏗️ 2. Diagramme de Classes (Architecture de Données)
Vue structurelle des entités backend et de leurs inter-relations.

```mermaid
classDiagram
    direction BT
    
    class Utilisateur {
        <<Entity>>
        +UUID id
        +String email
        +Enum role
        +Boolean isPro
        +Date proExpiry
        +String stripeCustomerId
    }

    class Watchlist {
        <<Entity>>
        +List assets
        +add(asset)
        +remove(asset)
    }

    class Alerte {
        <<ValueObject>>
        +String asset
        +Decimal targetPrice
        +String status
    }

    class CycleDebat {
        <<AggregateRoot>>
        +String cycle_id
        +String asset
        +String timeframe
        +String recommendation
        +Status status
    }

    class Trade {
        <<Entity>>
        +Decimal entry_price
        +Decimal stop_loss
        +Decimal take_profit
        +Decimal pnl
        +String status
    }

    class MessageDebat {
        <<Entity>>
        +String agent_name
        +Text content
        +DateTime timestamp
    }

    class ChatTrade {
        <<Entity>>
        +String trade_id
        +List messages
    }

    %% Associations
    Utilisateur "1" *-- "1" Watchlist : possède
    Utilisateur "1" *-- "many" Alerte : surveille
    Utilisateur "1" -- "many" CycleDebat : demande
    Utilisateur "1" -- "many" Trade : exécute
    
    CycleDebat "1" *-- "many" MessageDebat : contient
    CycleDebat "1" --> "0..1" Trade : génère
    
    Trade "1" -- "1" ChatTrade : possède un chatbot dédié
```

---

## 🔄 3. Diagramme de Séquence (Analyse -> Trade -> Chatbot)
Cinématique incluant l'interaction avec le chatbot après l'ouverture d'un trade.

```mermaid
sequenceDiagram
    autonumber
    
    participant U as 👤 Utilisateur
    participant F as 💻 Frontend
    participant B as ⚙️ Backend
    participant SMA as 🧠 Multi-Agents
    participant EX as 🏦 Binance/Stripe

    Note over U, EX: Phase d'Analyse et de Trading
    
    U->>F: Consulte Marché & Graphique
    F->>F: Load TradingView Widget
    U->>F: Ajoute BTC à la Watchlist
    F->>B: POST /api/watchlist
    
    U->>F: Lance Analyse (BTC/USDT)
    F->>B: Start Debate Cycle
    B->>SMA: Run Agents (Technical, Sentiment...)
    SMA-->>B: Consensus & Recommendation
    B-->>F: Display Debate Results
    
    U->>F: Approuver & Exécuter
    F->>B: POST /api/trades/execute
    B->>SMA: Execution Order
    SMA->>EX: Binance API Order
    EX-->>SMA: Order Confirmed
    
    Note over U, SMA: Interaction Post-Trade
    
    U->>F: "Pourquoi mon trade est en perte ?" (Chatbot)
    F->>B: Send Question
    B->>SMA: Agent Monitor / QA
    SMA->>B: "Le marché est volatil, SL sécurisé à..."
    B-->>F: Affiche réponse Chatbot
```

---

### 🎨 Guide des Couleurs
| Composant | Couleur | Description |
| :--- | :--- | :--- |
| **Acteurs** | 🔵 Bleu | Entités humaines externes. |
| **Système** | 🟠 Orange | Fonctionnalités de base du Backend/Frontend. |
| **Agents** | 🟣 Violet | Logique métier intelligente (SMA). |
| **Externe** | ⚪ Gris | Services tiers (Binance). |
