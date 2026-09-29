# Remora Fil Pilote — Homey / SHS

Application native Homey Apps SDK 3, version 0.1.6, pour Remora V1.2 ESP8266. Jusqu’à **7 appareils distincts par boîtier**, un par sortie fil pilote. Fonctionnement HTTP direct sur le réseau local, sans service cloud, compte Remora ni dépendance réseau externe à l’exécution.

**Quatre commandes uniquement : Off, Eco, Confort, Hors gel.** Aucun thermostat virtuel ni température de consigne : le thermostat du radiateur reste responsable de la température.

## Installation depuis le Homey App Store

[Installer la version de test](https://homey.app/a/fr.remora.filpilote/test/). La version 0.1.6 est en cours de certification Athom au 29 septembre 2026 ; elle n’est pas encore approuvée.

[English quick start](README.en.md) · [Signaler un problème](https://github.com/ptiyannou/homey-remora-fil-pilote/issues)

## Installation sur SHS

Sur un ordinateur pouvant joindre le serveur Homey/SHS :

1. Installer **Node.js 24 ou plus récent**, nécessaire au CLI Homey 4.5.2 vérifié pour ce projet. L’application elle-même utilise les API Node.js 18+ fournies par Homey.
2. Décompresser l’archive et ouvrir un terminal dans le dossier `remora-fil-pilote` contenant `app.json`.
3. Exécuter :

```sh
npm install --global homey@4.5.2
homey login
homey select
npm test
homey app validate --level debug
homey app install
```

Dans `homey select`, choisir **le serveur SHS** cible. Le compte Homey utilisé pour installer et administrer SHS est distinct du fonctionnement de cette intégration : les lectures et commandes Remora restent locales.

Aucune dépendance npm applicative à installer. Le module `homey` est fourni par SHS ; ne pas l’ajouter aux dépendances de l’application. La compatibilité du manifeste est Homey >=12.0.0, plateforme `local`, SDK 3. SHS est une plateforme locale de version 2 selon la documentation Homey.

`homey app install` installe durablement l’app, qui continue après fermeture du terminal. Pour une session temporaire avec journaux :

```sh
homey app run --remote
```

L’arrêt de cette session de développement arrête l’app de test. Réinstaller avec `homey app install` pour la conserver. Éviter `--clean` si des appareils et Flows existent déjà.

Le conteneur SHS doit pouvoir atteindre la Remora en TCP/80. Une IP fonctionne sans résolution de noms ; un hostname demande une résolution DNS utilisable depuis SHS. Le port HTTP peut être indiqué, par exemple `remora.local:8080`.

## Appairage des sorties

1. Dans Homey, ajouter un appareil **Remora Fil Pilote → Radiateur Remora**.
2. Saisir l’IP ou le hostname ; par exemple `remora.local` si ce nom est résolu sur votre réseau.
3. La connexion lit `/system.json` et `/fp` : elle vérifie l’identifiant matériel, les versions et les sept états.
4. Sélectionner les sorties voulues, ou les sept, puis les ajouter.
5. Renommer les appareils selon les pièces et les placer dans les pièces Homey appropriées.

Les « zones Remora » sont des sorties physiques, numérotées 1 à 7, pas des pièces Homey créées automatiquement. Les sorties déjà appairées sont filtrées. L’identité d’un appareil repose sur le **Chip ID + numéro de sortie**, jamais sur l’IP. Plusieurs Remora sont possibles avec des identifiants matériels différents.

La validation se fait à l’adresse saisie. Cette version ne balaie pas le réseau et ne suppose pas de service mDNS spécifique au firmware.

Pour un changement d’IP : ouvrir **Maintenance → Réparer** sur un des radiateurs et saisir la nouvelle adresse. Elle est vérifiée contre le Chip ID d’origine et s’applique à tous les appareils de ce boîtier, sans modifier leurs identifiants ni les Flows. Une réservation DHCP est pratique pour garder l’adresse stable.

## Commandes et Flows

Chaque appareil expose un sélecteur **Fil pilote** avec les quatre modes et un indicateur **Délestage** en lecture seule.

Les cartes suivantes fonctionnent dans les Flows et Advanced Flows :

- Action **Changer le Mode** : un appareil, un mode.
- Action **Régler les 7 sorties de cette Remora** : choisir un appareil pour désigner son boîtier, puis un mode. **Toutes les sorties physiques de ce boîtier sont concernées, même celles non appairées à Homey.** Les autres boîtiers ne sont pas concernés.
- Condition **Le mode fil pilote est** : état connu lors de la dernière synchronisation ; l’indisponibilité provoque une erreur plutôt qu’un résultat fondé sur un état périmé.
- Déclencheur **Le mode fil pilote a changé** avec un jeton texte `Mode`. La première lecture après démarrage ne déclenche pas cette carte.

Exemples : le matin → salon sur Confort ; au départ → les sept sorties sur Hors gel ; le soir → chambre sur Eco.

## Synchronisation et délestage

Un cycle de lecture toutes les 30 secondes par boîtier alimente ses appareils. Les requêtes et commandes du boîtier passent dans une file commune, pour ne pas solliciter simultanément l’ESP8266. Délai HTTP maximal de 5 secondes, réponse limitée à 64 Kio, aucune redirection suivie.

Avant chaque écriture, le Chip ID est vérifié. Après l’écriture, `/fp` est relu et tous les appareils sont synchronisés avec les états renvoyés. Une réponse HTTP 200 seule ne suffit pas : l’accusé `response` et les états doivent confirmer la commande. Pas de nouvelle tentative automatique d’écriture après une erreur.

Le firmware peut renvoyer `D` pendant un délestage. Ce n’est **pas une cinquième commande** : la sortie est physiquement forcée en Hors gel. Homey affiche Hors gel et active l’indicateur et l’avertissement de délestage. La condition « Hors gel » est donc également vraie dans cette situation.

Le firmware peut mémoriser un ordre reçu pendant le délestage tout en retournant `-1`, puis l’appliquer au relestage. L’application signale cette situation comme commande non confirmée ; une erreur ne signifie pas forcément que rien n’a changé ou ne changera plus tard. La commande groupée peut être partiellement appliquée. Ne pas interpréter une erreur de Flow comme une annulation des sept sorties.

Après une coupure, les appareils deviennent indisponibles puis se resynchronisent automatiquement lorsque la Remora revient. L’app ne renvoie pas les anciennes consignes au redémarrage. La confirmation porte sur l’état déclaré par le firmware, pas sur une mesure électrique du fil pilote ou de la température.

## Vérification avant utilisation

Test de connexion sans modifier les radiateurs :

```sh
npm run probe -- remora.local
```

Sur le boîtier fourni, ce test a confirmé : firmware **1.4.0**, matériel **V1.2 avec MCP23017**, sept sorties en **Hors gel**.

Après installation sur SHS :

1. Appairer les sept sorties et comparer leurs états à l’interface Web Remora.
2. Sur un radiateur choisi pour l’essai, essayer successivement Off, Eco, Confort et Hors gel ; vérifier le numéro de sortie et l’état dans Remora, puis remettre le mode souhaité.
3. Modifier un mode dans la page Remora ; vérifier sa remontée Homey sous environ 30 secondes.
4. Tester une carte Flow individuelle, puis la carte groupée lorsque changer les sept sorties est voulu.
5. Tester une perte de connexion et son retour, puis le redémarrage de l’app. Les appareils doivent récupérer leurs états sans réécrire de consignes.
6. Au besoin, essayer la réparation avec le hostname du même boîtier. Une autre Remora doit être refusée.

Les tests automatiques utilisent un serveur HTTP local simulant les réponses du firmware et des interfaces Homey simulées. Ils couvrent les quatre commandes, les sept sorties, le délestage, les erreurs réseau, la sérialisation, l’identité, l’appairage, la réparation, les vues et les cartes Flow. **Application installée sur SHS 13.4.1 et sept appareils appairés.** Les commandes depuis un appareil et les cartes Flow individuelle/groupée ont été validées en renvoyant Hors gel, le mode déjà actif. La condition Flow retourne vrai. Les sept appareils sont disponibles après redémarrage de l’application. Les transitions vers les trois autres modes et leur effet électrique sur les radiateurs restent à vérifier.

## Fichiers

```text
app.json                         Manifeste, capacités, appareils, cartes Flow
app.js                           Enregistrement des cartes Flow
lib/remora-client.js             API HTTP et validation des réponses
lib/board.js                     File de commandes et synchronisation commune
drivers/radiator/driver.js       Appairage, identité, réparation
drivers/radiator/device.js       Capacités et états des radiateurs
drivers/radiator/pair/           Vue de connexion
drivers/radiator/repair/         Vue de connexion pour réparation
scripts/probe.js                 Diagnostic en lecture seule
test/integration.test.js         Tests sans matériel
docs/API-SOURCES.md              Sources et contrat HTTP vérifié
docs/VALIDATION.md               Résultats et limites de validation
```

## Logo et publication

Le logo vectoriel représente un radiateur surmonté d’ondes Wi-Fi. L’icône de l’application comporte les ondes Wi-Fi ; celle des appareils conserve le radiateur seul. Les deux sont monochromes, adaptées à la coloration Homey. La couleur de marque est le bleu pétrole `#23556B`.

Le niveau de validation `debug` est celui employé par `homey app install`. Les images de la fiche utilisent la photo du matériel fournie par son propriétaire. La version 0.1.6 passe la validation de publication Homey.

### Présentation alignée sur NodOn

La carte individuelle reprend le titre « Changer le Mode » et la sélection « Mode Fil Pilote » du NodOn SIN-4-FP-21 installé sur SHS. Elle conserve uniquement Off, Eco, Confort et Hors gel. Son identifiant interne reste inchangé afin de préserver les Flows existants. Les cartes Remora de commande groupée, condition et changement de mode restent disponibles. Les déclencheurs NodOn de puissance/énergie ne sont pas reproduits : Remora ne fournit pas de mesure par sortie.

## Projet Remora

Remora est un projet open source gratuit. Le logiciel du boîtier est disponible sur [hallard/remora_soft](https://github.com/hallard/remora_soft). Cette application Homey est une intégration communautaire indépendante qui communique avec son API HTTP locale. Merci aux auteurs et contributeurs du projet Remora.

Présentation du projet, matériel et logiciel : [tducret/programmateur-fil-pilote-wifi](https://github.com/tducret/programmateur-fil-pilote-wifi). Firmware utilisé pour cette intégration : [hallard/remora_soft](https://github.com/hallard/remora_soft).

[Discussion sur le forum Homey](https://community.homey.app/t/app-pro-shs-test-remora-fil-pilote/160170)
