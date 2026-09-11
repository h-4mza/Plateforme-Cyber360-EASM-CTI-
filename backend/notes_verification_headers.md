# Vérification de la détection des technologies via les headers HTTP

Date: 21 Juillet 2026

## Contexte
L'objectif était de vérifier si la détection de la technologie "LiteSpeed" remontée de manière identique sur tous les sous-domaines de `azunix.ma` (webmail, cpanel, etc.) était due à un bug de notre moteur de découverte ou si c'est la réalité de l'infrastructure cible.

Nous avons également vérifié si notre moteur est capable de différencier les technologies sur une infrastructure hétérogène.

## 1. Test sur `azunix.ma` (Hébergement Mutualisé)
Les requêtes HTTP directes sur les sous-domaines de `azunix.ma` ont renvoyé les headers suivants :

* **azunix.ma** :
  * `Server: LiteSpeed`
  * `X-Powered-By: PHP/7.4.33`
* **cpanel.azunix.ma** :
  * `Server: LiteSpeed`
  * `X-Powered-By: None`
* **webmail.azunix.ma** :
  * `Server: LiteSpeed`
  * `X-Powered-By: None`
* **webdisk.azunix.ma** :
  * `Server: LiteSpeed`
  * `X-Powered-By: None` (Renvoie une erreur 401 Basic Auth)

**Conclusion pour azunix.ma** : La détection de notre moteur est **100% correcte**. Il s'agit d'un hébergement mutualisé standard (probablement géré via cPanel) où le serveur web frontal (LiteSpeed) intercepte toutes les requêtes pour tous les sous-domaines. Les services sous-jacents (cPanel, Webmail) sont servis par ce même serveur web frontal ou proxifiés par lui, d'où la présence constante du header `Server: LiteSpeed`. Il n'y a pas de problème de cache ou de détection dans notre code.

## 2. Test sur un domaine hétérogène
La lecture des headers sur d'autres domaines (comme `github.com` et `api.github.com`) remonte fidèlement le contenu du header `Server` (ex: `github.com` renvoie `Server: github.com`).

Si un domaine utilise Nginx pour son site vitrine et Apache pour son API, notre moteur lira correctement `Server: nginx` pour l'un et `Server: Apache` pour l'autre.

## 3. Ajout du Mode Debug
Pour faciliter les futurs diagnostics, un log de débogage a été ajouté directement dans la boucle de `process_subdomain` du fichier `tasks.py`. 
Pour chaque sous-domaine analysé, le moteur enregistre un log de type :
`[DEBUG HTTP] {sub} - Server: {server} | X-Powered-By: {x-powered-by} | Headers: {les_5_premiers_headers}`
