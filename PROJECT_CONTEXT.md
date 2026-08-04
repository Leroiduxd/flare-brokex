# 📌 PROJECT CONTEXT & DEPLOYMENT INSTRUCTIONS

Ce document sert de guide et de contexte permanent pour les prochains agents AI et développeurs travaillant sur la codebase **Brokex X Flare**.

---

## 🚨 RÈGLES ET CONSIGNES DE SÉCURITÉ CRITIQUES

1. **PROTÉGER LA BASE DE DONNÉES ET LES GRAPHIQUES** :
   - La base de données SQLite locale (`database.sqlite`) et le dossier de cache de graphiques (`Backend/data/`) contiennent l'historique de l'application et les données en direct.
   - **NE JAMAIS** exécuter des commandes destructives telles que `git clean -fd`, `git reset --hard` sans vérifier les fichiers non suivis, ou effacer `database.sqlite`.
   - Les fichiers `.gitignore` dans la racine et dans `Backend/` doivent **TOUJOURS** ignorer `*.sqlite`, `database.sqlite`, `Backend/data/` et `.env`.

2. **DÉPLOIEMENT SUR LE VPS** :
   - **Adresse VPS SSH** : `ubuntu@51.178.43.25`
   - **Dossier de l'application sur le VPS** : `/home/ubuntu/apps/flare-brokex`
   - **Service Backend PM2** : ID `2` (Nom : `brokex-backend`, Port : `1234`)
   - **Dépôt GitHub Remote** : `https://github.com/Leroiduxd/flare-brokex.git` (Branche `main`)
   - Procédure de mise à jour sur le VPS :
     ```bash
     ssh ubuntu@51.178.43.25 "cd /home/ubuntu/apps/flare-brokex && git pull origin main && pm2 restart 2"
     ```

---

## 🛠️ DERNIÈRES MODIFICATIONS RÉALISÉES

### 1. Calcul du volume par actif (`volumeService.js`)
- Le fichier `Backend/service/volumeService.js` a été mis à jour pour lire la colonne `assetHash` de la table SQL `trades`.
- Les volumes (Long, Short, Total) sont calculés de manière globale ET ventilés individuellement par actif :
  - **Or / GOLD** (Hash : `GOLD_ASSET_HASH` / `0x5656b836...`)
  - **XRP** (Hash : `XRP_ASSET_HASH` / `0xfe136bfb...`)
  - Clé dynamique **`byAsset`** pour l'extensibilité.
- Les fonctions `getProtocolVolumes()` et `getTraderVolumes()` renvoient la structure suivante pour chaque période (`v24h`, `v7d`, `allTime`) :
  ```json
  {
    "longVolume": "17952",
    "shortVolume": "18738",
    "totalVolume": "36690",
    "GOLD": {
      "longVolume": "10000",
      "shortVolume": "12000",
      "totalVolume": "22000"
    },
    "XRP": {
      "longVolume": "7952",
      "shortVolume": "6738",
      "totalVolume": "14690"
    },
    "byAsset": {
      "GOLD": { "longVolume": "10000", "shortVolume": "12000", "totalVolume": "22000" },
      "XRP": { "longVolume": "7952", "shortVolume": "6738", "totalVolume": "14690" }
    }
  }
  ```

### 2. Mise à jour de la documentation API
- `Backend/api_endpoints_doc.md` inclut désormais la structure mise à jour pour les endpoints `/api/volume`, `/api/protocol/volume` et `/api/volume/trader/:traderAddress`.

### 3. Fichiers `.gitignore`
- Des fichiers `.gitignore` ont été créés à la racine et dans `Backend/` pour empêcher tout commit ou suppression accidentelle de `database.sqlite`, des fichiers `.env` et des historiques de chandeliers / graphiques.

---

## 📂 STRUCTURE DES FICHIERS CLÉS (BACKEND)

- `Backend/index.js` : Point d'entrée principal des endpoints REST & SSE.
- `Backend/db.js` : Connexion et initialisation de la base SQLite (`trades`, `vault_metrics`, `faucet_claims`).
- `Backend/service/volumeService.js` : Service de calcul des métriques de volume globales et par actif, ainsi que des Borrow Fees.
- `Backend/service/executionEngine.js` : Moteur d'exécution automatique des trades et interaction avec le TEE.
- `Backend/service/wss.js` : Service WebSocket & FTSO v2 Price feeds.
- `Backend/api_endpoints_doc.md` : Documentation officielle des endpoints API.

---

## 🚀 COMMANDES UTILES POUR LES FUTURS AGENTS

- **Vérifier l'état du git local** : `git status`
- **Pousser des changements** :
  ```bash
  git add <fichiers_spécifiques>
  git commit -m "description des changements"
  git push origin main
  ```
- **Déployer sur le VPS & Redémarrer PM2** :
  ```bash
  ssh ubuntu@51.178.43.25 "cd /home/ubuntu/apps/flare-brokex && git pull origin main && pm2 restart 2"
  ```
- **Consulter les logs sur le VPS** :
  ```bash
  ssh ubuntu@51.178.43.25 "pm2 logs 2 --lines 50"
  ```
