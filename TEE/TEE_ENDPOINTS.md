# 🛡️ Brokex TEE — Liste des Endpoints API (`tee.brokex.trade`)

Ce fichier récapitule tous les endpoints disponibles publiquement sur le sous-domaine **`https://tee.brokex.trade`**.

---

## 1. `GET /risk-proofs`
- **URL complète :** `https://tee.brokex.trade/risk-proofs`
- **Description :** Renvoie les dernières preuves de risque **signées cryptographiquement (ECDSA)** par la clé du nœud TEE pour les différents assets (`GOLD`, `XRP`, etc.).
- **Utilisation :** Utilisé par le Frontend / Smart Contracts pour vérifier la validité des limites de risque lors de la prise de position.
- **Exemple de réponse JSON :**
```json
{
  "GOLD": {
    "assetHash": [56, 86, 184, 54, 100, 151, 58, 155, 78, 44, 24, 212, 91, 117, 120, 230, 116, 110, 228, 165, 101, 218, 98, 227, 172, 87, 159, 185, 224, 90, 204, 85],
    "maxOILong": 37500000000,
    "maxOIShort": 37500000000,
    "spreadLong": 1000,
    "spreadShort": 1000,
    "timestamp": 1785856145,
    "signature": "XxLaCCYsMVFUbpMju0F/2/NFmmStby58tX5CIaOl7PlxsgtGmUdPK4PCcZ71lm455uq2+yjiAQeuV6Z2cOBWJxs="
  },
  "XRP": {
    "assetHash": [10, 163, 80, 39, 79, 202, 35, 227, 136, 75, 225, 157, 233, 128, 25, 139, 19, 242, 234, 41, 62, 162, 105, 33, 5, 90, 182, 162, 7, 110, 199, 242],
    "maxOILong": 37500000000,
    "maxOIShort": 37500000000,
    "spreadLong": 1000,
    "spreadShort": 1000,
    "timestamp": 1785856146,
    "signature": "4Y8rFVT8qsvqf2Yn6ZHMOHXZhG0FCOJ9bou9lNbUtJVj3hPl8+U1bdMPLfy71J72Io9ONaUykmIXm5TsJXunxBs="
  }
}
```

---

## 2. `GET /risk-params`
- **URL complète :** `https://tee.brokex.trade/risk-params`
- **Description :** Renvoie les paramètres bruts de risque calculés par le Risk Engine TEE (volatilité Pyth, spreads en bps, etc.) sans la signature.
- **Exemple de réponse JSON :**
```json
{
  "GOLD": {
    "assetHash": "0x5656b83664973a9b4e2c18d45b7578e6746ee4a565da62e3ac579fb9e05acc55",
    "maxOILong": 37500000000,
    "maxOIShort": 37500000000,
    "spreadLongBps": 30,
    "spreadShortBps": 30,
    "riskActivation": 0,
    "pnlStressRatio": 0,
    "volatility": 0.075,
    "timestamp": 1785856145
  }
}
```

---

## 3. `GET /info`
- **URL complète :** `https://tee.brokex.trade/info`
- **Description :** Renvoie l'attestation Flare TEE Enclave et les métriques de la machine (Clé publique Secp256k1, Extension ID, Chain ID: 114, Attestation `magic_pass`).
- **Exemple de réponse JSON :**
```json
{
  "teeInfo": {
    "publicKey": { "x": "0x9c6f2865...", "y": "0x9a2751fc..." },
    "chainId": 114,
    "lastSigningPolicyId": 5899
  },
  "machineData": {
    "extensionId": "0x0000000000000000000000000000000000000000000000000000000000010157",
    "initialOwner": "0xca30cd2760e48af1be32c8420e71803da6735142",
    "attestation": "magic_pass"
  }
}
```

---

## 4. `GET /state`
- **URL complète :** `https://tee.brokex.trade/state`
- **Description :** Renvoie le compteur de preuves générées et la version de l'état du TEE.
