# Roadmap de développement — Cyber360 MVP

**Objectif produit :** répondre à "Comment savoir si mon entreprise est exposée sur Internet aujourd'hui ?"
**Durée totale :** 24 semaines (~6 mois)
**Équipe cible :** 2-3 devs full-stack, 1 PM/designer (mi-temps), 1 dev backend spécialisé "discovery" si possible

---

## Vue d'ensemble des 5 modules

```
Accounts → Discovery → Monitoring → Risk Engine → Reporting
```

Ordre de développement volontairement séquentiel : chaque module dépend des données produites par le précédent. Impossible de calculer un score (Risk Engine) sans avoir découvert des actifs (Discovery) et vérifié leur état (Monitoring).

---

## Phase 0 — Cadrage technique (Semaines 1-2)

**Ne pas coder tout de suite.** Cette phase évite de refaire l'architecture au sprint 5.

- Choix de la stack technique (voir section Stack recommandée)
- Modélisation de la base de données : `organizations`, `users`, `domains`, `assets`, `checks`, `risks`, `scores`, `reports`, `alerts`
- Choix des outils de découverte externe (voir section Outils)
- Setup infra : repo, CI/CD basique, environnement de dev, environnement de staging
- Maquettes UI basse fidélité des écrans clés (dashboard, inventaire, fiche risque)

**Livrable :** schéma de base de données validé + squelette d'app déployable (page de login vide mais fonctionnelle)

---

## Phase 1 — Fondations : Accounts (Semaines 3-6)

Correspond aux fonctionnalités **n°1 et n°2** du document.

### Sprint 1 (S3-4)
- Authentification (email/mot de passe, sessions/JWT)
- Création d'organisation (nom, secteur, taille, pays, contact principal)
- Modèle multi-tenant (chaque client voit uniquement ses données)

### Sprint 2 (S5-6)
- Gestion des rôles : Administrateur / Analyste / Lecture seule
- Invitation d'utilisateurs par email
- Écran de paramètres d'organisation

**Livrable :** un client peut créer son compte, son organisation, inviter des collègues avec des rôles différents. **C'est la base commerciale minimale** — sans ça, rien n'est vendable même en démo.

---

## Phase 2 — Discovery (Semaines 7-11)

Correspond aux fonctionnalités **n°3 et n°4**. C'est le cœur technique du produit et la partie la plus risquée à estimer — à prévoir large.

### Sprint 3 (S7-8)
- Ajout manuel de domaines par le client (validation de format, vérification de propriété basique)
- Job asynchrone de découverte : brute-force des sous-domaines connus (mail., vpn., owa., portal., support., api., www., admin., git., dev., test.)
- Queue de traitement (les scans ne doivent jamais bloquer l'UI)

### Sprint 4 (S9-10)
- Résolution DNS complète (A, AAAA, MX, TXT, NS, CNAME)
- Récupération de certificats TLS via Certificate Transparency logs (ex. crt.sh)
- Découverte de sous-domaines connus additionnels via sources passives (pas de brute-force intrusif)

### Sprint 5 (S11)
- Association domaine → IP → certificat → statut
- Déduplication des actifs découverts
- Tableau brut "actifs découverts" (sans UI finale, juste fonctionnel)

**Livrable :** un client ajoute un domaine, revient 10 minutes plus tard, voit une liste de sous-domaines et IPs découverts automatiquement. **C'est le moment "wahou"** qui justifie le prix — à tester avec de vrais domaines clients dès que possible.

**Point d'attention :** évaluer dès la Phase 0 les APIs/sources externes (Certificate Transparency, résolveurs DNS, bases de sous-domaines passives) pour éviter les mauvaises surprises de rate-limit ou de coût en sprint 3.

---

## Phase 3 — Inventaire + Monitoring (Semaines 12-16)

Correspond aux fonctionnalités **n°5 et n°6**.

### Sprint 6 (S12-13)
- Écran Inventaire final : nom, type, adresse, statut, technologie, criticité
- Détection de technologie basique (headers HTTP, favicon hash, etc.)
- Filtres et recherche dans l'inventaire

### Sprint 7 (S14-16)
- Contrôles automatiques par actif :
  - Email : SPF, DKIM, DMARC, DNSSEC
  - Web : HTTPS, certificat/expiration, TLS, headers de sécurité, HSTS, redirections
  - Ports exposés (443, 80, 22, 3389, 25, 587) — vérification non intrusive uniquement
- Planification récurrente des contrôles (quotidienne ou hebdomadaire selon criticité)

**Livrable :** chaque actif de l'inventaire a un statut de configuration vérifié automatiquement et rafraîchi périodiquement.

---

## Phase 4 — Risk Engine + Score (Semaines 17-19)

Correspond aux fonctionnalités **n°7 et n°8**.

### Sprint 8 (S17-18)
- Moteur de règles : transforme chaque résultat de contrôle en risque (Critique/Important/Moyen/Faible)
- Fiche risque : explication, impact, recommandation (contenu rédigé à l'avance pour chaque type de risque connu — pas d'IA générative nécessaire au MVP)

### Sprint 9 (S19)
- Calcul du Score Cyber360 global + sous-scores (DNS, TLS, Messagerie, Services, Configuration)
- Pondération configurable côté produit (pas besoin d'UI, juste en config)

**Livrable :** un client voit "84/100" avec le détail par catégorie, et chaque point perdu est expliqué. C'est l'élément qui parle aux dirigeants — soigner particulièrement la clarté du texte des recommandations.

---

## Phase 5 — Dashboard, Rapports, Alertes, Historique (Semaines 20-23)

Correspond aux fonctionnalités **n°9, n°10, n°11, n°12**.

### Sprint 10 (S20-21)
- Dashboard principal : nombre d'actifs, risques critiques, risques ouverts, évolution, derniers changements
- Historique horodaté (snapshots quotidiens/hebdomadaires du score et des risques)

### Sprint 11 (S22)
- Génération de rapport PDF (résumé, score, liste des risques, recommandations, historique)
- Design du template PDF (c'est un document que le client va montrer à sa direction — soigner la mise en page)

### Sprint 12 (S23)
- Système d'alertes email : expiration de certificat (J-15), nouveau sous-domaine détecté, service admin exposé détecté
- Préférences de notification par utilisateur

**Livrable :** le produit est utilisable en autonomie complète par un client, sans intervention manuelle de votre équipe.

---

## Phase 6 — Durcissement & Beta (Semaines 24)

- Tests de charge sur les jobs de découverte/monitoring (le goulot d'étranglement le plus probable)
- Audit de sécurité de l'application elle-même (ironique mais indispensable pour un produit cybersécurité)
- Onboarding guidé dans le produit (tooltips, premier domaine ajouté = tutoriel)
- Recrutement de 3-5 clients pilotes en beta fermée
- Boucle de feedback rapide sur les 2 dernières semaines avant lancement commercial

---

## Stack technique recommandée

| Composant | Suggestion | Raison |
|---|---|---|
| Backend | Python (FastAPI) ou Node (NestJS) | Écosystème riche pour DNS/TLS/scanning |
| Frontend | React + Tailwind | Rapide à itérer, bon pour dashboards |
| Base de données | PostgreSQL | Relationnel, gère bien multi-tenant + historique |
| Queue asynchrone | Redis + Celery/BullMQ | Les scans doivent être async, jamais bloquants |
| Génération PDF | WeasyPrint (Python) ou Puppeteer (Node) | HTML → PDF fiable |
| Hébergement | OVH/Scaleway (données marocaines/européennes) ou AWS | Vérifier contraintes de résidence des données pour clients marocains |

---

## Priorisation si le calendrier glisse

Si le temps manque, voici ce qui peut être coupé sans tuer la proposition de valeur, dans l'ordre :

1. Rapports PDF → remplacer par un export CSV temporaire
2. Historique/évolution → garder juste "aujourd'hui" au lancement
3. Alertes email → notifier manuellement les premiers clients pilotes
4. Rôle "Lecture seule" → garder Admin/Analyste seulement

**Ne jamais couper :** Discovery et Score. Ce sont les deux fonctionnalités qui justifient le prix.

---

## Ce qui reste hors MVP (rappel)

IA, Chatbot, OpenCTI/STIX/TAXII, Dark Web, Malware, SIEM, EDR, Pentest, Scanner interne, SOAR, IOC, Threat Hunting — tout ceci est pertinent pour la V2, une fois que des clients payants valident le socle Discovery + Risk Engine + Reporting.