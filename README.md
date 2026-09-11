# 🛡️ Cyber360 : External Attack Surface Management & CTI Platform

![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Celery](https://img.shields.io/badge/Celery-37814A?style=for-the-badge&logo=celery&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white)

## 📖 Introduction : Que fait ce projet ?
**Cyber360** est une plateforme avancée de cybersécurité conçue pour résoudre les problèmes du **Shadow IT** et de **l'Alert Fatigue**. 

La plateforme fusionne trois domaines de la cybersécurité :
1. **EASM (External Attack Surface Management) :** Elle découvre et cartographie automatiquement tous les actifs numériques exposés d'une entreprise sur Internet (sous-domaines, serveurs web, bases de données).
2. **CTI (Cyber Threat Intelligence) :** Elle ne se contente pas de lister des vulnérabilités. Le *Risk Engine* croise les failles techniques de l'entreprise avec une base de données de groupes cybercriminels (APT) ciblant sa région, pour élever les alertes en fonction de la menace réelle.
3. **Intelligence Artificielle (AI Copilot) :** Elle intègre le LLM Google Gemini pour générer des synthèses exécutives et fournir du code de remédiation aux ingénieurs, de manière strictement encadrée et sans hallucinations.

---

## ✨ Fonctionnalités Principales

*   **🔍 Découverte Asynchrone :** Utilisation de `Celery` et `Redis` pour scanner l'infrastructure de manière distribuée et asynchrone sans bloquer l'API.
*   **🧠 Moteur de Scénarios (Kill Chain) :** Modélisation des chemins d'attaques latéraux et projection déterministe sur le standard mondial **MITRE ATT&CK**.
*   **🎯 Protection de la Marque (Typosquatting) :** Module de *fuzzing* DNS (`dnstwist`) couplé à un algorithme mathématique de similarité visuelle HTML (Ratcliff/Obershelp) pour détecter et bloquer les campagnes de Phishing.
*   **⚖️ Dashboard de Conformité :** Traduction en temps réel des failles techniques en scores de conformité réglementaire locale (ex: Loi 05-20, **DNSSI**, **CNDP** au Maroc).
*   **⚡ Corrélation Haute Performance :** Croisement algorithmique de millions de TTPs en temps réel (Complexité asymptotique de $\mathcal{O}(N)$ grâce à l'indexation Hash SQL).

---

## 🏗️ Architecture et Stack Technique

Le projet repose sur une architecture moderne, asynchrone et modulaire :
*   **Backend :** Python, FastAPI, SQLAlchemy (Async), Alembic.
*   **Frontend :** React.js, TypeScript, TailwindCSS.
*   **Bases de données & Queue :** PostgreSQL (Données métier & Graphes), Redis (Message Broker).
*   **Task Orchestration :** Celery Workers.
*   **AI Integration :** Google GenAI SDK (Gemini Flash).

---

## 🚀 Guide de Démarrage Rapide (Quick Start)

Le projet est entièrement conteneurisé pour faciliter son déploiement. Voici les étapes exactes pour lancer la plateforme sur une nouvelle machine :

### 1. Préparation de l'environnement
*   Assurez-vous d'avoir **Docker** et **Docker Compose** installés sur votre machine.
*   Extrayez l'archive ZIP du projet et ouvrez un terminal dans le dossier racine `cyber360`.

### 2. Configuration des clés API
Dans le dossier `backend`, créez un fichier nommé `.env` (s'il n'existe pas déjà) et ajoutez-y votre clé API Gemini (nécessaire pour le module Copilote IA) :
```env
GEMINI_API_KEY=votre_cle_api_ici
```

### 3. Lancement de l'infrastructure
Allumez tous les moteurs (PostgreSQL, Redis, API FastAPI, React, Celery) en exécutant cette commande à la racine :
```bash
docker-compose up -d --build
```
*(Le premier lancement peut prendre 2 à 3 minutes le temps de télécharger les images).*

### 4. Peupler la base de données (Seeding CTI)
Pour que le moteur de *Threat Intelligence* fonctionne, il a besoin de connaître les groupes de hackers (APT) et les techniques MITRE. Exécutez le script d'initialisation intégré au backend :
```bash
docker exec -it cyber360-backend python scripts/run_sync_and_seed.py
```
*(Vous pouvez aussi utiliser `seed_attack_demo.py` pour générer de fausses vulnérabilités de test).*

### 5. Utiliser la plateforme
Félicitations, la plateforme tourne ! Accédez aux interfaces via votre navigateur :
*   🖥️ **Interface Utilisateur (Frontend React) :** [http://localhost:3000](http://localhost:3000)
*   ⚙️ **Documentation API Backend (Swagger) :** [http://localhost:8000/docs](http://localhost:8000/docs)

**Par quoi commencer sur l'interface ?**
1. Connectez-vous et allez sur la page des Domaines pour **Ajouter un Domaine Racine** (ex: `azunix.ma`).
2. L'EASM va démarrer. Allez sur la vue **Graphe Topologique** pour voir les sous-domaines apparaître en temps réel.
3. Allez dans l'onglet **Threat Landscape** pour voir l'algorithme croiser vos failles avec les profils d'attaquants, et générer le briefing avec l'IA !

---

## ⚠️ Cadre Déontologique et Légal (Rules of Engagement)

> **Avertissement :** Ce projet a été développé dans le cadre académique d'un Projet de Fin d'Études (PFE) en Ingénierie de Cybersécurité.
Les modules d'Active Recon (Scans de ports, énumération) ne doivent **JAMAIS** être exécutés sur des infrastructures tierces sans autorisation écrite explicite. La plateforme intègre conceptuellement un mécanisme de *Proof of Ownership* exigeant une vérification DNS (TXT) avant tout scan destructif. Toute utilisation à des fins malveillantes est strictement interdite.
