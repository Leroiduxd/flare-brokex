# 🛡️ BROKEX PROTOCOL — INSTRUCTIONS ULTRA-DETAILLED DE DÉPLOIEMENT TEE SUR VPS (FLARE COSTON2)

Ce guide contient **chaque commande exacte à copier-coller** pour transférer, installer, compiler, faire tourner et mettre à jour le nœud TEE Brokex sur votre serveur VPS Ubuntu 22.04 LTS (`51.178.43.25`).

---

## 📋 INFORMATIONS REPERES & ADRESSES

- **IP VPS** : `51.178.43.25`
- **Utilisateur SSH** : `ubuntu`
- **Port du Proxy TEE** : `6674`
- **Réseau** : Flare Coston2 Testnet (Chain ID: `114`)
- **RPC URL** : `https://coston2-api.flare.network/ext/C/rpc`
- **BrokexCore Contract** : `0x5620dA2B418577b94a74B121eD61B5B84962AC93`
- **BrokexVault Contract** : `0xC73dab4Db123cC6e206d65f8DE6590dd0531a1D3`
- **BrokexLens Contract** : `0x9565CCDaEF44430c2B099455ff028712F94E8859`
- **Clé Privée Nœud TEE** : `0xe12f9b03327a875c2d5bf9b40a75cd2effeed46ea508ee595c6bc708c386da8c`
- **Adresse Nœud TEE** : `0xEDa28D031678F21153924510fC66F665471c4c7f`
- **Extension ID** : `65879` (`0x0000000000000000000000000000000000000000000000000000000000010157`)

---

## 📁 1. ENVOYER LE DOSSIER TEE DEPUIS VOTRE MAC VERS LE VPS

Ouvrez un terminal sur votre Mac et exécutez la commande suivante pour envoyer le dossier `TEE` sur votre VPS :

```bash
scp -r "/Users/khalil/Desktop/Brokex X Flare/TEE" ubuntu@51.178.43.25:/home/ubuntu/fce-extension-scaffold
```

---

## 🖥️ 2. SE CONNECTER AU VPS EN SSH

```bash
ssh ubuntu@51.178.43.25
```

---

## ⚙️ 3. INSTALLATION DES DÉPENDANCES SUR LE VPS (DOCKER + GIT)

Copiez-collez ce bloc sur votre VPS pour installer Docker, Docker Compose et Foundry (`cast`) :

```bash
# Mise à jour des paquets système
sudo apt-get update && sudo apt-get upgrade -y

# Installation de Docker et outils de base
sudo apt-get install -y docker.io docker-compose-plugin git curl jq

# Activation du service Docker
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu

# Installation de Foundry (Cast) pour interagir avec Flare Coston2
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc || source ~/.zshrc
foundryup
```

---

## 📄 4. CREER LE FICHIER DE CONFIGURATION (`config/extension.env`)

Sur votre VPS, placez-vous dans le dossier et créez la configuration :

```bash
cd /home/ubuntu/fce-extension-scaffold
mkdir -p config
```

Créez le fichier `config/extension.env` :

```bash
cat << 'EOF' > config/extension.env
# Clé privée du Nœud TEE
PRIVATE_KEY=0xe12f9b03327a875c2d5bf9b40a75cd2effeed46ea508ee595c6bc708c386da8c

# Adresse du contrat BrokexCore sur Coston2
INSTRUCTION_SENDER=0x5620dA2B418577b94a74B121eD61B5B84962AC93
BROKEX_CORE_ADDRESS=0x5620dA2B418577b94a74B121eD61B5B84962AC93
BROKEX_VAULT_ADDRESS=0xC73dab4Db123cC6e206d65f8DE6590dd0531a1D3
BROKEX_LENS_ADDRESS=0x9565CCDaEF44430c2B099455ff028712F94E8859

# Extension ID lié à BrokexCore
EXTENSION_ID=0x0000000000000000000000000000000000000000000000000000000000010157

# Configuration réseau Flare Coston2
CHAIN_ID=114
RPC_URL=https://coston2-api.flare.network/ext/C/rpc
FLARE_TEE_MANAGER=0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE
EOF
```

---

## 🐳 5. COMPILER ET LANCER LE CONTENEUR DOCKER TEE

Lancez la compilation et le démarrage du conteneur en tâche de fond :

```bash
cd /home/ubuntu/fce-extension-scaffold

# Arrêt du conteneur s'il tournait déjà
docker compose -f docker-compose.coston2.yaml down

# Lancement de la compilation et démarrage
docker compose -f docker-compose.coston2.yaml up --build -d
```

---

## 📊 6. VERIFIER QUE LE TEE TOURNE ET INSPECTER LES LOGS

Pour vérifier l'état du conteneur :
```bash
docker ps
```
*(Vous devez voir le conteneur `fce-extension-scaffold-extension-tee-1` en état `Up`)*.

Pour suivre les logs de calcul du TEE en temps réel :
```bash
docker logs -f fce-extension-scaffold-extension-tee-1
```
*(Pour quitter l'affichage des logs, faites `CTRL + C`)*.

---

## 🔄 7. COMMENT METTRE À JOUR VOTRE CODE TEE DU MAC VERS LE VPS (PROCÉDURE SIMPLE)

Lorsque vous modifiez du code Go dans votre dossier local `TEE` sur votre Mac :

### Option A : Mettre à jour uniquement les fichiers de code Go (Recommandé & Rapide ⚡)
Depuis le terminal de votre Mac :
```bash
scp -r "/Users/khalil/Desktop/Brokex X Flare/TEE/internal" ubuntu@51.178.43.25:/home/ubuntu/fce-extension-scaffold/
```

Puis sur le VPS, re-compilez et redémarrez le conteneur Docker en **2 secondes** :
```bash
cd /home/ubuntu/fce-extension-scaffold
docker compose -f docker-compose.coston2.yaml up --build -d
```

---

## 🔗 8. ENREGISTRER LE NŒUD TEE SUR LA BLOCKCHAIN COSTON2

Sur votre VPS ou depuis votre Mac, enregistrez votre nœud TEE auprès du registre Flare `FlareTeeManager` :

```bash
cast send --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --private-key 0xe12f9b03327a875c2d5bf9b40a75cd2effeed46ea508ee595c6bc708c386da8c \
  --chain 114 \
  0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE \
  "registerTeeMachine(uint256,address)" 65879 0xEDa28D031678F21153924510fC66F665471c4c7f
```

---

## 🧪 9. TESTER LA RÉPONSE DU TEE DEPUIS LA BLOCKCHAIN

Envoyez une instruction de calcul depuis le contrat `BrokexCore` :

```bash
cast send --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --private-key 0xe12f9b03327a875c2d5bf9b40a75cd2effeed46ea508ee595c6bc708c386da8c \
  --chain 114 \
  0xE9B049FDb273195D6078A58247bA9f05cd8258C0 \
  "sendTeeInstruction(bytes)" 0x014254432f55534400000000000000000000000000 \
  --value 1000000
```

Dans les logs de Docker (`docker logs -f fce-extension-scaffold-extension-tee-1`), vous verrez le TEE intercepter l'évènement on-chain, calculer les spreads et renvoyer la preuve de risque `RiskProof` signée ECDSA ! 🛡️⚡

---

## 📜 10. HISTORIQUE & DÉTAIL DES ACTIONS RÉALISÉES SUR LE VPS (`51.178.43.25`)

Voici le récapitulatif complet de toutes les étapes de configuration et de déploiement exécutées sur le VPS Ubuntu 22.04 LTS :

### 🛠️ 1. Connexion SSH & Environnement Système
- **Vérification de l'accès SSH** : Validation des accès utilisateur `ubuntu` avec privilèges `sudo`.
- **Analyse des Ressources** : Vérification du système (Ubuntu 22.04 LTS, 7.6 Go RAM, 46 Go d'espace disque disponible, Uptime ~7 jours).

### 📁 2. Transfert & Synchronisation du Code
- **Copie des fichiers locaux vers le VPS** : Transfert par SCP de l'ensemble du projet Go local `/Users/khalil/Desktop/Brokex X Flare/TEE` vers le dossier `/home/ubuntu/fce-extension-scaffold/` du VPS (fichiers Go, `pkg/types`, `internal/risk`, `internal/extension`, etc.).

### 🐳 3. Recompilation & Gestion des Conteneurs Docker
- **Nettoyage des conteneurs isolés** : Suppression des conteneurs en conflit/arrêtés.
- **Recompilation Multi-stage Docker** : Exécution de `docker compose -f docker-compose.yaml -f docker-compose.coston2.yaml up -d --build`.
- **Démarrage des 3 Services** :
  1. `fce-extension-scaffold-extension-tee-1` (Binaire Go TEE compiled avec le Risk Engine).
  2. `fce-extension-scaffold-ext-proxy-1` (Proxy Flare TEE en écoute sur les ports `6673` et `6674`).
  3. `fce-extension-scaffold-redis-1` (Base Redis locale).

### 🔑 4. Ré-initialisation de la Policy TEE & Signature Cryptographique
- **Vérification des logs** : Confirmation du lancement du routeur TEE (`docker logs fce-extension-scaffold-extension-tee-1`).
- **Initialisation de la Policy** : Ré-initialisation réussie de la `SIGNING_POLICY` et attribution du `lastSigningPolicyId` pour autoriser la signature ECDSA des preuves de risque.

### 🌐 5. Exposition Publique & Configuration NGINX / SSL
- **Reverse Proxy NGINX** : Le port interne `6674` du Proxy TEE est redirigé via NGINX sur la machine.
- **Certificat SSL Certbot (HTTPS)** : Configuration du sous-domaine `tee.brokex.trade`.
- **Validation HTTP 200 OK** : Vérification de l'endpoint **https://tee.brokex.trade/info** renvoyant la clé publique TEE (`publicKey`), l'Attestation, le `chainId: 114` et l'`extensionId: 0x...10155`.


