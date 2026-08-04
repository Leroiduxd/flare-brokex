# 📌 PROJECT CONTEXT & DEPLOYMENT INSTRUCTIONS

Ce document sert de guide et de contexte permanent pour les prochains agents AI et développeurs travaillant sur la codebase **Brokex X Flare**.

---

## 🚨 RÈGLES ET CONSIGNES DE SÉCURITÉ CRITIQUES

1. **PROTÉGER LA BASE DE DONNÉES ET LES GRAPHIQUES** :
   - La base de données SQLite locale (`database.sqlite`) et le dossier de cache de graphiques (`Backend/data/`) contiennent l'historique de l'application et les données en direct.
   - **NE JAMAIS** exécuter des commandes destructives telles que `git clean -fd`, `git reset --hard` sans vérifier les fichiers non suivis, ou effacer `database.sqlite`.
   - Les fichiers `.gitignore` dans la racine et dans `Backend/` doivent **TOUJOURS** ignorer `*.sqlite`, `database.sqlite`, `Backend/data/` et `.env`.

2. **DOMAINE PUBLIC & REVERSE PROXY NGINX** :
   - **Domaine API officiel** : `https://apiflare.brokex.trade`
   - **Configuration Nginx VPS** : `/etc/nginx/sites-available/apiflare.brokex.trade`
   - Nginx redirige la totalité du trafic HTTPS de `apiflare.brokex.trade` vers le serveur local Node.js sur le port **1234** (`proxy_pass http://127.0.0.1:1234;`).

3. **GHOST & PROCESSUS PM2 SUR LE VPS (`ubuntu@51.178.43.25`)** :
   - **Service Backend PM2 Actif** : **ID `2`** (`brokex-backend`)
     - Emplacement : `/home/ubuntu/apps/flare-brokex/Backend/index.js`
     - Port configuré : **`PORT=1234`** (dans `.env` et variables PM2).
   - **Processus Inactif / Obsolète** : **ID `0`** (`brokex-keeper` -> `/home/ubuntu/brokex-backend-xau/...`)
     - Ancien script arrêté qui entrait en conflit sur le port 3000. **NE PAS LE RELANCER**.

4. **DÉPLOIEMENT SUR LE VPS** :
   - **Adresse VPS SSH** : `ubuntu@51.178.43.25`
   - **Dossier de l'application** : `/home/ubuntu/apps/flare-brokex`
   - **Dépôt GitHub Remote** : `https://github.com/Leroiduxd/flare-brokex.git` (Branche `main`)
   - Procédure de mise à jour sur le VPS :
     ```bash
     ssh ubuntu@51.178.43.25 "cd /home/ubuntu/apps/flare-brokex && git pull origin main && pm2 restart 2"
     ```

---

## 🛠️ DERNIÈRES MODIFICATIONS RÉALISÉES

### 1. Calcul du volume par actif (`volumeService.js`)
- Le fichier `Backend/service/volumeService.js` lit la colonne `assetHash` de la table SQL `trades`.
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

### 2. Port backend (1234) & Nginx Proxy
- Passage de `PORT=3000` à `PORT=1234` dans `Backend/.env` afin de supprimer tout conflit de port.
- Nginx reroute `apiflare.brokex.trade` directement sur `127.0.0.1:1234`.
- Tests d'endpoints réussis sur `https://apiflare.brokex.trade/v1/shims/tradingview/history` et `https://apiflare.brokex.trade/api/volume`.

### 3. Fichiers `.gitignore`
- Des fichiers `.gitignore` ont été créés à la racine et dans `Backend/` pour empêcher tout commit ou suppression accidentelle de `database.sqlite`, des fichiers `.env` et des historiques de chandeliers / graphiques.

---

## 📂 STRUCTURE DES FICHIERS CLÉS (BACKEND)

- `Backend/index.js` : Point d'entrée principal des endpoints REST & SSE (écoute sur le port 1234).
- `Backend/db.js` : Connexion et initialisation de la base SQLite (`trades`, `vault_metrics`, `faucet_claims`).
- `Backend/service/volumeService.js` : Service de calcul des métriques de volume globales et par actif, ainsi que des Borrow Fees.
- `Backend/service/executionEngine.js` : Moteur d'exécution automatique des trades et interaction avec le TEE.
- `Backend/service/wss.js` : Service WebSocket & FTSO v2 Price feeds.
- `Backend/api_endpoints_doc.md` : Documentation officielle des endpoints API.

---

## 🚀 COMMANDES UTILES POUR LES FUTURS AGENTS

- **Vérifier l'état du git local** : `git status`
- **Pousser des changements sur GitHub** :
  ```bash
  git add <fichiers_spécifiques>
  git commit -m "description des changements"
  git push origin main
  ```
- **Mettre à jour le VPS & Redémarrer PM2** :
  ```bash
  ssh ubuntu@51.178.43.25 "cd /home/ubuntu/apps/flare-brokex && git pull origin main && pm2 restart 2"
  ```
- **Consulter les logs du backend sur le VPS** :
  ```bash
  ssh ubuntu@51.178.43.25 "pm2 logs 2 --lines 50"
  ```
