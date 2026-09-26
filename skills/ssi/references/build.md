# Construction, TDD et diagnostic

Charger cette référence seulement pour une construction ou correction locale autorisée. Le routeur conserve les plafonds de mode : `status` n’écrit rien ; `plan` et `review` n’écrivent qu’éventuellement dans `.ssi/` protégée ; `audit` et `sync` ne modifient pas le produit. Ne pas convertir une reprise plafonnée en construction sans demande explicite.

## Avant de modifier

Lire le flux visé de bout en bout, les appelants pertinents, le contrat et les contrôles existants. Préserver les modifications humaines et suspendre les écritures conflictuelles. Identifier les commandes sûres : ne pas lancer un contrôle touchant services partagés, facturation ou données réelles sans mandat explicite.

Choisir la solution dans cet ordre : capacité non nécessaire, existant, bibliothèque standard, plateforme native, dépendance déjà installée, puis code minimal justifié. Le plus petit diff ne l’emporte jamais sur la sécurité, la correction, l’accessibilité, la conservation de données ou le comportement explicitement demandé. Ne pas ajouter abstraction, dépendance, configuration ou généralisation spéculative.

## Boucle comportementale

Pour chaque petite tranche de logique :

1. choisir le seam utile, à l’interface réellement utilisée par l’appelant ;
2. écrire une assertion comportementale issue d’un critère, d’un exemple travaillé ou d’une valeur connue indépendante ;
3. exécuter le contrôle et constater un échec pertinent ;
4. écrire le minimum pour réussir ;
5. réexécuter, puis passer à la tranche suivante.

Le test ne cible ni méthode privée ni détail interne et ne recalcule pas son résultat avec l’algorithme testé. Préférer un test au travers de l’interface réelle. Ne pas écrire une couche entière de tests avant l’implémentation, ni réécrire les suites existantes pour satisfaire une règle de minimalisme.

Utiliser l’outillage déjà présent. Doubler seulement une frontière système instable ou coûteuse, par exemple temps, hasard, réseau, stockage ou fournisseur externe ; injecter cette dépendance au seam et éviter les mocks des modules internes. Pour un changement documentaire, visuel ou de configuration, utiliser une preuve adaptée et déclarer pourquoi aucun test comportemental ne s’applique.

## Bugs

Avant toute hypothèse, construire et exécuter une reproduction qui détecte le symptôme exact. Pour une intermittence, mesurer une fréquence et augmenter la reproductibilité. Réduire le scénario sans perdre le défaut.

Si la cause n’est pas évidente, formuler un petit ensemble d’hypothèses classées et falsifiables : chacune prédit le résultat d’un changement précis. Tester une seule variable par essai, conserver le signal et retirer les essais réfutés sans toucher aux modifications de l’utilisateur. Une absence de reproduction exploitable est un diagnostic bloqué : demander la preuve, l’accès ou le scénario minimal manquant, sans inventer de cause.

Corriger la cause commune aux appelants concernés, pas un seul symptôme. Ajouter une régression au seam qui reproduit le vrai chemin, constater son échec avant la correction, puis rejouer la reproduction originale. Retirer instrumentation et prototypes temporaires ; consigner la cause établie et les limites seulement dans une destination autorisée.

## Refactoring et performance

Refactorer après une tranche verte ou en revue ciblée, seulement s’il simplifie réellement l’interface, la localité ou la maintenance sans diluer les protections. Rejouer les contrôles affectés. Une simplification délibérée avec plafond réel doit indiquer son seuil et le déclencheur de révision, sans bruit de commentaires pour les cas ordinaires.

Pour une exigence de performance, établir une mesure représentative avant le changement et comparer le même scénario après. Rapporter méthode, résultats et limites ; moins de lignes ne prouve ni vitesse ni coût réduit.

## Preuves et limites

Pour chaque critère, noter test ou preuve, commande/parcours, résultat : réussi, échoué, non exécuté, bloqué ou non applicable avec raison. Ne déclarer aucun contrôle passé s’il n’a pas été exécuté. Après une correction, rejouer les contrôles affectés et le parcours réel requis, sans effet externe non autorisé.

La construction peut finir « terminé localement » si les obligations locales applicables sont prouvées. Commit, push, PR, merge et déploiement restent des jalons distincts et interdits sans mandat ciblé.
