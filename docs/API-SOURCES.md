# API et sources vérifiées le 27 septembre 2026

## Remora

Lecture directe du code public, puis confirmation des lectures sur le boîtier réel. Pas de reprise de la bibliothèque Python dans les dépendances : le client JavaScript implémente uniquement le contrat HTTP utile.

- [remora_soft — webserver.cpp](https://github.com/hallard/remora_soft/blob/66aad03b3634ba5932d9999fb52ba46963e31d37/webserver.cpp) : `fpJSON`, `handleNotFound`, routes et accusé de réception.
- [remora_soft — pilotes.cpp](https://github.com/hallard/remora_soft/blob/66aad03b3634ba5932d9999fb52ba46963e31d37/pilotes.cpp) : `setfp`, `setfp_interne`, `fp`, délestage.
- [PyRemora — remora.py](https://github.com/FreeTHX/pyremora/blob/8e2b7e8b2b81964bf376e3c13cff17596ce59e55/remora/remora.py) : `getAllFilPilote`, `setFilPilote`, `setAllFilPilote`.
- [PyRemora 0.5 sur PyPI](https://pypi.org/project/pyremora/0.5/) : publication Python consultée ; le dépôt source ci-dessus est épinglé pour la traçabilité.

| Opération | Méthode / chemin | Réponse utilisée |
| --- | --- | --- |
| Identité et versions | `GET /system.json` | Tableau `{ "na": nom, "va": valeur }`, dont `Chip ID`, `Version Logiciel`, `Version Matériel` |
| Lecture des sept sorties | `GET /fp` | Objet avec `fp1` à `fp7` |
| Une sortie, exemple Confort sur 3 | `GET /?setfp=3C` | `{ "response": 0 }` en cas de réussite |
| Toutes les sorties sur Eco | `GET /?fp=EEEEEEE` | `{ "response": 0 }` si toutes les commandes réussissent |

Correspondance exacte : **Off → A**, **Eco → E**, **Confort → C**, **Hors gel → H**. Les sorties sont indexées à partir de 1. La commande collective contient exactement sept caractères. Aucune route `/api/...` inventée ; aucune écriture de configuration, du relais, de la téléinformation ou du firmware.

Le firmware accepte seulement `C`, `E`, `H`, `A` dans `setfp`. L’énumération PyRemora inclut davantage de valeurs, ce qui ne prouve pas qu’elles soient des commandes acceptées. Cette app n’expose ni `1`, ni `2`, ni `D` comme commande.

Dans le firmware, une zone délestée (`D`) mémorise l’ordre demandé mais ne l’exécute pas immédiatement ; `setfp` peut rester à `-1`. La commande collective poursuit les autres sorties même si l’une échoue. D’où la relecture systématique, le signalement explicite du délestage et l’absence de réussite optimiste.

L’API est sans authentification dans la configuration testée. L’adresse est saisie par l’utilisateur, les chemins de requête sont fixes, et le client ne suit pas les redirections. Le contrôle suppose l’accès au réseau local de la Remora.

## Homey / SHS

Documentation publique consultée et outils officiels utilisés :

- [Produits, plateforme et version](https://apps-sdk-v3.developer.homey.app/Homey.html) : SHS = `local`, platformVersion 2.
- [Manifeste](https://apps.developer.homey.app/the-basics/app/manifest) : SDK 3, runtime Node.js, plateforme locale.
- [Capacités](https://apps.developer.homey.app/the-basics/devices/capabilities) : capacité enum personnalisée, sélecteur et synchronisation.
- [Appairage et réparation](https://apps.developer.homey.app/the-basics/devices/pairing) : identité stable dans `data`, IP dans le stockage mutable, `onPair` et `onRepair`.
- [Liste d’appareils](https://apps.developer.homey.app/the-basics/devices/pairing/system-views/devices-list) : sélection multiple avec `singular: false`.
- [Vues personnalisées](https://apps.developer.homey.app/advanced/custom-views/custom-pairing-views) : événements de session et navigation.
- [Flow](https://apps.developer.homey.app/the-basics/flow) : actions, conditions et déclencheurs par appareil.
- [CLI officiel](https://github.com/athombv/node-homey) : version npm **4.5.2**, requiert Node.js >=24 ; `app install`, `app run --remote`, `app validate --level debug`.

Le manifeste est écrit directement dans `app.json` : Homey Compose est facultatif. Les images promotionnelles sont requises pour `publish`, pas pour la validation `debug` utilisée à l’installation locale. Le module `homey` est fourni par le serveur à l’exécution.
