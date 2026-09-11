Fonctionnalité n°4 — Découverte automatique

C'est un pipeline en plusieurs étapes qui se déclenche dès qu'un client ajoute un domaine.

Étape 1 : Énumération de sous-domaines

Deux approches à combiner, jamais une seule :

Wordlist ciblée (ce que le document liste : mail., vpn., owa., portal., support., api., www., admin., git., dev., test.) : pour chaque préfixe, on tente une résolution DNS (mail.azunix.ma → a-t-il un enregistrement A ou CNAME ?). C'est rapide et couvre les cas les plus fréquents.
Sources passives (pas de brute-force massif intrusif) : interroger des bases publiques qui indexent déjà les sous-domaines connus d'un domaine — Certificate Transparency logs (crt.sh), et éventuellement des APIs comme SecurityTrails ou VirusTotal si vous avez un budget. L'intérêt : ça remonte des sous-domaines que le client ne connaît même pas, sans envoyer une seule requête vers son infra.

Techniquement, des outils open source existent déjà et évitent de tout réécrire : Amass ou Subfinder (Go) savent déjà combiner wordlist + sources passives + Certificate Transparency. Vous pouvez les appeler en sous-processus depuis votre backend plutôt que de recoder un moteur d'énumération DNS from scratch — ça vous fait gagner facilement 2-3 semaines de dev.

Étape 2 : Résolution et enrichissement

Pour chaque sous-domaine trouvé :

résoudre l'IP (A/AAAA)
récupérer les enregistrements MX, NS, TXT du domaine parent
récupérer le certificat TLS présenté (si port 443 ouvert) → on en extrait l'émetteur, la date d'expiration, les SAN (Subject Alternative Names, qui révèlent parfois d'autres sous-domaines)

Étape 3 : Pipeline asynchrone

C'est le point d'architecture le plus important. Une découverte peut prendre plusieurs minutes (dizaines de sous-domaines × plusieurs requêtes chacun). Ne jamais faire ça dans la requête HTTP du client.

Client ajoute domaine → API crée un job → queue (Redis)
                                              ↓
                                    Worker (Celery/BullMQ) exécute :
                                    Amass/Subfinder → résolution DNS → certificats
                                              ↓
                                    Résultats écrits en base au fur et à mesure
                                              ↓
                        Frontend poll ou websocket → "12 actifs découverts..."

Étape 4 : Déduplication

Un même actif peut être découvert deux fois (via wordlist ET via certificat). On déduplique sur le couple (nom d'hôte, IP) avant de créer un enregistrement asset.

Point d'attention concret : prévoir un rate-limiting et un cache. Si un client réanalyse son domaine tous les jours, inutile de re-taper les mêmes APIs externes à chaque fois — cacher les résultats de Certificate Transparency 24h par exemple.

Fonctionnalité n°5 — Inventaire

C'est presque entièrement de la restitution de ce que Discovery a produit, plus un peu de classification.

Modèle de données (table assets) :

Champ	Exemple	Origine
nom	mail.azunix.ma	Discovery
type	sous-domaine / IP / certificat	déduit automatiquement
adresse	41.x.x.x	résolution DNS
statut	actif / inactif / expiré	recalculé à chaque contrôle (fonctionnalité 6)
technologie	Nginx, Exchange, WordPress...	détection HTTP (voir ci-dessous)
criticité	haute/moyenne/basse	règle métier ou saisie manuelle

Détection de technologie — pas besoin d'IA, des heuristiques simples suffisent pour un MVP :

Analyse des headers HTTP de réponse (Server: nginx/1.18, X-Powered-By: PHP)
Hash du favicon (technique utilisée par Shodan : certains logiciels ont un favicon par défaut identifiable, ex. les interfaces d'admin Fortinet, Citrix, etc. — très utile pour repérer un VPN/pare-feu exposé)
Détection de patterns dans le HTML (ex. /wp-content/ → WordPress)

Criticité — au MVP, une règle simple suffit : un actif contenant "admin", "vpn", "portal" dans son nom, ou exposant un port sensible (3389, 22 en admin), est classé automatiquement en criticité haute. Le client peut la modifier manuellement ensuite.

Côté UI, l'inventaire est un tableau filtrable/triable (par type, statut, criticité) — techniquement, rien de spécial, une pagination côté serveur suffit si le nombre d'actifs reste raisonnable (quelques centaines par client au MVP).

Fonctionnalité n°6 — Contrôles automatiques

C'est le module le plus "cybersécurité pure". Chaque contrôle est un job indépendant, exécuté périodiquement (quotidien ou hebdo selon la criticité de l'actif), toujours en lecture seule et non intrusif.

Contrôles DNS/Email (rapides, juste des requêtes DNS TXT) :

SPF : lire l'enregistrement TXT commençant par v=spf1, vérifier qu'il existe et qu'il ne se termine pas par +all (politique laxiste)
DKIM : chercher l'enregistrement selector._domainkey.domaine — problème : le sélecteur n'est pas standardisé, donc on teste une liste de sélecteurs courants (google, default, selector1, selector2, k1...)
DMARC : lire _dmarc.domaine, vérifier la politique (p=none = faible, p=reject = fort)
DNSSEC : vérifier la présence de signatures RRSIG sur la zone

Ce sont des vérifications rapides, quelques dizaines de millisecondes par domaine, parfaitement scriptables avec des bibliothèques DNS standards (dnspython en Python, dns en Node).

Contrôles Web/TLS — pour chaque actif ayant un port 443 ouvert :

Ouvrir une connexion TLS et récupérer le certificat (bibliothèque ssl standard) : émetteur, date d'expiration, algorithme
Vérifier la version TLS supportée (rejeter TLS 1.0/1.1 = risque)
Faire une requête HTTP et analyser les headers de sécurité : Strict-Transport-Security (HSTS), Content-Security-Policy, X-Frame-Options
Vérifier les redirections HTTP→HTTPS (un site accessible en clair sur le port 80 sans redirection est un risque)

Contrôles de ports — ici "non intrusif" est la contrainte clé du document. Concrètement ça veut dire :

Un simple TCP connect scan (tenter d'ouvrir une connexion, voir si elle réussit) sur une liste fermée de ports (443, 80, 22, 3389, 25, 587) — jamais de scan de vulnérabilité, jamais d'envoi de payload, jamais de brute-force de credentials.
Uniquement sur les actifs que le client a explicitement déclarés (son domaine et ce qui en découle), jamais sur une plage IP au hasard — c'est autant une question légale qu'éthique.

Orchestration :

Scheduler (Celery Beat / cron) 
   → toutes les 24h, pour chaque actif actif
   → lance en parallèle : check_dns(), check_tls(), check_ports(), check_headers()
   → chaque check écrit son résultat dans la table `checks` (actif_id, type, résultat, timestamp)
   → un changement de résultat par rapport au dernier check déclenche l'historique (fonctionnalité 12) et potentiellement une alerte (fonctionnalité 11)

Point d'architecture important : chaque type de contrôle doit être un job séparé et idempotent, pas un gros script monolithique "vérifie tout". Ça permet de paralléliser (des centaines d'actifs à vérifier chaque nuit), de relancer un seul contrôle qui a échoué sans tout refaire, et plus tard d'ajuster la fréquence par type (TLS peut être vérifié une fois par semaine, expiration de certificat une fois par jour).

Si tu veux, je peux te détailler ensuite le Risk Engine (comment transformer ces résultats de contrôles en risques scorés) — c'est la suite logique, ou bien te proposer un schéma de base de données complet (tables et relations) pour ces trois modules.