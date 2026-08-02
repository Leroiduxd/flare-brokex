# 🚀 Brokex Backend API Documentation

Cette documentation détaille l'ensemble des endpoints HTTP REST, Server-Sent Events (SSE) et WebSocket exposés par le serveur backend `Brokex X Flare`.

---

## 📌 Base URL
```text
http://localhost:3000
```

---

## 📊 1. Volumes & Statistiques du Protocole

### `GET /api/volume`
### `GET /api/protocol/volume`
Retourne les métriques de volume (24h, 7d, All-Time) ainsi que les statistiques globales du protocole.

* **Paramètres de requête :** Aucun
* **Exemple de réponse JSON :**
```json
{
  "v24h": {
    "longVolume": "17952",
    "shortVolume": "18738",
    "totalVolume": "36690"
  },
  "v7d": {
    "longVolume": "17952",
    "shortVolume": "18738",
    "totalVolume": "36690"
  },
  "allTime": {
    "longVolume": "17952",
    "shortVolume": "18738",
    "totalVolume": "36690"
  },
  "stats": {
    "totalTradesCount": 133,
    "totalUniqueTraders": 1,
    "activeTradesCount": 36,
    "pendingOrdersCount": 0,
    "avgLeverageLong": "10",
    "avgLeverageShort": "10",
    "totalBorrowFee": "620535"
  }
}
```

---

### `GET /api/volume/trader/:traderAddress`
### `GET /api/trader/volume/:traderAddress`
Retourne les volumes réalisés spécifiquement par un trader.

* **Paramètres d'URL :**
  - `traderAddress` *(string)* : Adresse Web3 du trader.
* **Exemple de réponse JSON :**
```json
{
  "trader": "0x1234567890abcdef...",
  "v24h": {
    "longVolume": "100000000",
    "shortVolume": "50000000",
    "totalVolume": "150000000"
  },
  "v7d": {
    "longVolume": "500000000",
    "shortVolume": "200000000",
    "totalVolume": "700000000"
  },
  "allTime": {
    "longVolume": "1200000000",
    "shortVolume": "800000000",
    "totalVolume": "2000000000"
  }
}
```

---

## 🏛️ 2. Snapshots des Actifs (Smart Contract BrokexLens)

### `GET /api/snapshot`
### `GET /api/asset/snapshot`
Retourne les snapshots en mémoire RAM de tous les actifs configurés dans le `.env` (ex: `GOLD_FEED_ID`, `GOLD_ASSET_HASH`).

* **Paramètres de requête :** Aucun
* **Exemple de réponse JSON :**
```json
{
  "updatedAt": 1785621980,
  "assets": {
    "GOLD": {
      "feedId": "0x01504158472f555344000000000000000000000000",
      "assetHash": "0x5656b83664973a9b4e2c18d45b7578e6746ee4a565da62e3ac579fb9e05acc55",
      "snapshot": {
        "assetHash": "0x5656b83664973a9b4e2c18d45b7578e6746ee4a565da62e3ac579fb9e05acc55",
        "openInterestLong": "8910000000",
        "openInterestShort": "8910000000",
        "totalOpenInterest": "17820000000",
        "avgEntryPriceLong": "4046505682",
        "avgEntryPriceShort": "4046424754",
        "config": {
          "ftsoFeedId": "0x01504158472f555344000000000000000000000000",
          "minLeverage": "1000000",
          "maxLeverage": "100000000",
          "minTradeSize": "10000000",
          "commissionBps": "10",
          "borrowRateHourly": "100",
          "profitCap": "100000",
          "executionTolerance": "50",
          "maxProofAge": "300",
          "maxTraderOI": "50000000000",
          "maxGlobalOI": "500000000000",
          "lockedCapitalBps": "1000",
          "liqThresholdBps": "8000",
          "listed": true,
          "frozen": false
        }
      }
    }
  }
}
```

---

## 📈 3. Graphiques & Intégration TradingView UDF

### `GET /api/chart/candles`
Retourne la liste des bougies OHLC sous forme d'un tableau d'objets JSON.

* **Paramètres de requête :**
  - `symbol` *(optionnel)* : Symbole (défaut `Crypto.XAU/USD`).
  - `resolution` *(optionnel)* : `1`, `5`, `15`, `30`, `60`, `240`, `1D` ou `1m`, `5m`, `15m`, `1h`, `4h`, `1d`.

---

### `GET /v1/shims/tradingview/history`
### `GET /api/chart/history`
Retourne les bougies historiques au format UDF attendu par le widget TradingView.

* **Paramètres de requête :**
  - `symbol` : `Crypto.XAU/USD`
  - `resolution` : `1`, `5`, `15`, `30`, `60`, `240`, `1D`
  - `from` *(optionnel)* : Timestamp Unix de début (secondes)
  - `to` *(optionnel)* : Timestamp Unix de fin (secondes)

## ⚡ 4. Real-Time Price Streaming (SSE & WebSocket)

### `GET /v1/shims/tradingview/streaming`
### `GET /api/price/stream`
### `GET /streaming`
Flux de données de prix en temps réel basé sur **Server-Sent Events (SSE)**, compatible avec le format Pyth TradingView.

* **URL de production (HTTPS) :** `https://apiflare.brokex.trade/v1/shims/tradingview/streaming`
* **Header HTTP :** `Content-Type: text/event-stream`
* **Exemple d'évènement reçu (JSON payload) :**
```text
data: {"id":"Crypto.XAU/USD","p":2038.5,"t":1700001200,"v":1,"symbol":"Crypto.XAU/USD","priceUSD":2038.5,"value":"2038500","decimals":3,"timestamp":1700001200}
```

#### 💡 Exemple d'intégration JavaScript (Navigateur / React) :
```javascript
const eventSource = new EventSource('https://apiflare.brokex.trade/v1/shims/tradingview/streaming');

eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Nouveau prix reçu :', data.priceUSD, 'à', new Date(data.t * 1000));
};

eventSource.onerror = (err) => {
    console.error('Erreur de connexion au flux SSE:', err);
};
```

---

## 📉 5. Variations de Prix Pyth Benchmarks (Sauvegardées sur Disque)

### `GET /api/price-differences`
### `GET /api/pyth/price-differences`
Lit et envoie directement le fichier JSON `data/pyth_price_differences.json` enregistré sur le disque.

* **Actifs inclus :** BTC, ETH, XRP, EURUSD, GBPUSD, JPYUSD, PETROLE, GOLD, SILVER, APPLE, TESLA, META, NVIDIA, GOOGLE, AMAZON, MICROSOFT, SOLANA.

---

## 💼 6. Trades & Utilisateurs

### `GET /api/trades/max-id`
### `GET /api/trades/highest-id`
Retourne le plus grand ID de trade enregistré dans la base de données SQLite.

---

### `GET /api/trades/range`
Retourne une liste complète de trades sur une plage d'IDs spécifiée.

* **Paramètres de requête :**
  - `from` *(ou `start`)* : ID de début (ex: `200`)
  - `to` *(ou `end`)* : ID de fin (ex: `300`)

---

### `GET /api/trades/trader/:traderAddress`
Retourne tous les trades associés à une adresse Web3 de trader avec la colonne `liquidationPrice` calculée.

* **Paramètre de requête optionnel :** `?state=1` (`0`: ORDER, `1`: OPEN, `2`: CLOSED, `3`: CANCELLED, `4`: LIQUIDATED)

---

### `GET /api/trades/:tradeId`
Retourne les détails d'un trade spécifique par son identifiant unique ID.

---

## 🚰 7. Faucet USDC (Testnet)

### `POST /api/faucet` ou `GET /api/faucet?address=0x...`
Envoie 1000 USDC Testnet au wallet indiqué. Chaque adresse ne peut réclamer les 1000 USDC qu'une seule fois.

* **Paramètre / Body :** `address` (adresse EVM du destinataire)
* **Exemple de réponse JSON :**
```json
{
  "success": true,
  "address": "0x1234567890123456789012345678901234567890",
  "amount": "1000",
  "txHash": "0xabc123...",
  "blockNumber": 123456
}
```

### `GET /api/faucet/status/:address`
Permet de vérifier si une adresse a déjà réclamé son Faucet.

---

## 🏦 8. Demandes de Retrait Vault LP (Queue Inspector)

### `GET /api/vault/withdrawals/user/:address`
Vérifie si une adresse de wallet donnée a des demandes de retrait LP en attente d'exécution dans la file d'attente on-chain.

* **Paramètre d'URL :** `address` (adresse Web3 du trader)
* **Exemple de réponse JSON :**
```json
{
  "address": "0x1234567890abcdef...",
  "hasPending": true,
  "count": 1,
  "requests": [
    {
      "id": 5,
      "user": "0x1234567890abcdef...",
      "lpAmountRemaining": "500000000",
      "isPending": true
    }
  ]
}
```

### `GET /api/vault/withdrawals/queue`
Inspecteur de la file d'attente complète de retrait (`queueHead`, `queueTail`, plus grande demande active et tableau des demandes).

* **Paramètre optionnel :** `?refresh=true` pour forcer une resynchronisation on-chain immédiate.



