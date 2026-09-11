Je veux construire Cyber360, une plateforme SaaS de gestion de surface d'attaque
externe (External Attack Surface Management). Le contexte produit complet et la
roadmap de développement sont dans mvp.txt, et le détail technique des modules
Discovery / Inventaire / Contrôles automatiques est dans mvp_technique.txt.
Lis ces deux fichiers en entier avant de commencer.

OBJECTIF DE CETTE SESSION
Je ne veux pas coder tout le MVP d'un coup. On démarre par la Phase 0 (cadrage
technique) puis la Phase 1 (module Accounts) de la roadmap, avec le squelette
du module Discovery en place mais pas encore fonctionnel. Ne code rien au-delà
de ce périmètre sans me le proposer d'abord.

STACK IMPOSÉE
- Backend : Python + FastAPI
- Frontend : React + Tailwind CSS
- Base de données : PostgreSQL
- Queue asynchrone : Redis + Celery (même si les jobs Discovery ne sont pas
  codés cette session, la structure doit être prête à les recevoir)
- ORM : SQLAlchemy + Alembic pour les migrations
- Auth : JWT
- Le tout en Docker Compose pour que je puisse lancer l'environnement de dev
  en une commande

ÉTAPE 1 — Structure du projet
Crée un monorepo avec cette organisation :
- /backend (FastAPI, structuré par module : accounts, discovery, monitoring,
  risk_engine, reporting — un dossier par module même si certains sont vides
  pour l'instant, avec un README.md expliquant leur rôle futur)
- /frontend (React + Tailwind, structure par feature)
- /infra (docker-compose.yml : postgres, redis, backend, frontend)
- README.md à la racine expliquant comment lancer le projet en local

ÉTAPE 2 — Modèle de données
Avant d'écrire le moindre modèle SQLAlchemy, propose-moi le schéma complet des
tables couvrant TOUS les modules de la roadmap (organizations, users, domains,
assets, checks, risks, scores, reports, alerts), avec leurs relations, même si
on n'implémente que Accounts cette session. Je veux valider le schéma avant que
tu génères les migrations Alembic, pour éviter d'avoir à tout refaire plus tard
quand on attaquera Discovery.

ÉTAPE 3 — Module Accounts (Phase 1 de la roadmap, sprints 1 et 2)
Implémente complètement :
- Inscription / connexion (email + mot de passe, hash bcrypt, JWT)
- Création d'organisation (nom, secteur d'activité, taille, pays, contact
  principal) rattachée à l'utilisateur qui la crée en tant qu'Administrateur
- Modèle multi-tenant strict : toute requête API doit être scopée à
  l'organisation de l'utilisateur connecté, aucune fuite de données possible
  entre organisations
- Trois rôles : Administrateur, Analyste, Lecture seule — avec un middleware
  ou dependency FastAPI qui vérifie les permissions par endpoint
- Invitation d'un utilisateur par email dans une organisation existante
  (email d'invitation peut être simulé/loggé en dev, pas besoin d'un vrai
  service d'envoi pour l'instant)
- Écran frontend : inscription, connexion, création d'organisation, liste des
  membres avec leurs rôles, formulaire d'invitation

ÉTAPE 4 — Squelette du module Discovery
Ne code pas encore la logique d'énumération de sous-domaines décrite dans
mvp_technique.txt. Prépare uniquement :
- Le endpoint POST /domains qui permet d'ajouter un domaine à une organisation
  (validation de format uniquement, pas de vérification de propriété pour
  l'instant)
- Le modèle de données `domains` et `assets` déjà présents en base (issus de
  l'étape 2)
- Un stub de tâche Celery `discover_domain(domain_id)` qui pour l'instant se
  contente de logger "discovery lancée pour {domain_id}" et de marquer le
  domaine comme "en cours d'analyse" — la vraie logique viendra dans une
  session ultérieure dédiée à la Phase 2 de la roadmap
- Un écran frontend simple pour ajouter un domaine et voir son statut

CONTRAINTES DE QUALITÉ
- Écris des tests pour le module Accounts (auth, création d'organisation,
  permissions par rôle, isolation multi-tenant) — l'isolation multi-tenant en
  particulier doit être testée explicitement, c'est le point de sécurité le
  plus critique de tout le produit
- Documente les endpoints (FastAPI génère déjà OpenAPI, assure-toi que les
  schémas Pydantic ont des descriptions claires)
- Pas de secrets en dur : utilise des variables d'environnement (.env.example
  à fournir)

DÉROULEMENT
Avant de coder, donne-moi :
1. Le schéma de base de données complet (étape 2) pour validation
2. Un plan des endpoints API du module Accounts
Une fois que j'ai validé ces deux points, code l'étape 1, 3 et 4 dans cet ordre.