# Validation — 27 septembre 2026

Version du projet : 0.1.6. Environnement de préparation : Node.js 24.15.0, npm 11.12.1, Homey CLI 4.5.2.

## Résultats

- `npm test` : **14 tests réussis, 0 échec**. Serveur HTTP simulé, appels Homey simulés et exécution des scripts des vues dans un contexte simulé.
- `homey app validate --level debug` : **réussite**, sans avertissement après correction du manifeste. Ce niveau correspond à la validation effectuée par le CLI lors de l’installation locale.
- `npm run probe -- <adresse-remora>` : **réussite sur la Remora physique**, depuis l’ordinateur de préparation. `/system.json` et `/fp` uniquement.
- Réponse réelle : firmware 1.4.0, matériel V1.2 avec MCP23017 ; fp1 à fp7 = H.
- Préparation initiale en lecture seule. Après autorisation de déploiement : commandes Hors gel envoyées via SHS, sans changement de mode. Aucun redémarrage matériel, changement de configuration Remora ou accès à `/config.json`.

## Couverture automatique

1. Validation et normalisation des adresses.
2. Identification et lecture des sept sorties, interprétation du délestage.
3. Encodage exact des quatre commandes et de la commande groupée.
4. Erreurs HTTP, redirections, JSON invalide, limite de réponse et délai réseau.
5. Sérialisation des commandes simultanées et synchronisation des appareils.
6. Rejet d’une réussite HTTP sans application effective de l’ordre.
7. Délestage et réussite partielle d’une commande groupée.
8. Déconnexion, reprise et vérification du Chip ID avant écriture.
9. Appairage, sept identités stables et exclusion des doublons.
10. Réparation de l’adresse partagée et persistance.
11. Un seul minuteur de synchronisation par boîtier et arrêt propre.
12. Capacités, avertissement de délestage et déclencheur de changement.
13. Actions et condition Flow, refus des états indisponibles.
14. Navigation des vues d’appairage/réparation et affichage des erreurs.

## Limites

- Installation durable réussie sur SHS 13.4.1, app en état `running`, sans crash. Sept appareils appairés et disponibles. Commande de capacité, actions Flow individuelle/groupée et condition exécutées avec succès via l’API Homey. Redémarrage de l’app effectué, récupération des sept appareils confirmée. Le rendu visuel dans les clients Homey reste à vérifier.
- Commandes Hors gel uniquement sur le matériel, déjà dans ce mode. Les transitions vers Off/Eco/Confort, le câblage et le comportement électrique des radiateurs ne sont pas validés par ces essais.
- Le contrôle se base sur le retour logiciel de Remora ; il ne fournit pas une mesure indépendante de la sortie électrique.
- La validation App Store `publish` est réussie avec les images promotionnelles et le logo intégrés. La certification Athom est une étape distincte, encore en cours au 29 septembre 2026.
- Le code public est épinglé dans API-SOURCES.md ; il ne constitue pas une vérification de toutes les modifications locales ayant servi à compiler le firmware. Les réponses réelles de lecture correspondent au contrat attendu.

Version 0.1.3 : présentation de la carte de commande alignée sur le NodOn installé, identifiant et comportement inchangés. Validation Homey et installation SHS réussies.

28 septembre 2026 : version 0.1.4 validée au niveau publish, 14 tests réussis, build 1 envoyé et soumis à certification Athom. La version 0.1.4 n’a pas remplacé l’installation locale pendant cette soumission.
