# Vérifier, relire et clôturer

## Contrat

La vérification établit une preuve, elle ne déduit pas un succès d’une lecture du code ou d’une suite verte. Pour chaque critère applicable, conserver une matrice :

| Critère | Comportement/surface | Méthode réelle | Preuve | Résultat |
|---|---|---|---|---|

Résultats autorisés : `réussi`, `échoué`, `non exécuté`, `bloqué`, `non applicable` avec raison. Sans preuve observée, le résultat n’est jamais `réussi`.

Respecter le plafond du mode : en `review`, analyser statiquement par défaut, sans lancer de test ni modifier le produit. `status` ne produit aucune écriture. `plan` et `review` peuvent au plus conserver une note sous `.ssi/` déjà protégée. Une vérification runtime, des tests ou une correction ne sont faits que dans un mode et avec des permissions qui les autorisent.

## Vérification comportementale

1. Partir de l’objectif, des critères d’acceptation, du diff et des surfaces promises. Un critère ou une route spécifiée mais absente reste visible : ne réduire ni le périmètre ni la preuve aux seuls fichiers modifiés.
2. Choisir le parcours réel adapté : navigateur pour une interface, requête pour une API, commande pour une CLI, déclenchement et observation pour un job. Utiliser des données de test et ne provoquer aucun effet externe non autorisé.
3. Déterminer la commande ou le démarrage depuis les conventions et outils du dépôt. Dans un monorepo, exécuter l’application ou le workspace touché, pas la racine par défaut.
4. Pour chaque observation, enregistrer les éléments utiles : URL et capture/rendu, requête reproductible et statut/corps pertinent, ou commande, code de sortie et extrait stdout/stderr. Expurger secrets, jetons, cookies, données personnelles et en-têtes d’authentification avant affichage ou stockage, même local ; référencer une variable d’environnement plutôt que sa valeur. Relever les erreurs utiles sans copier les traces brutes.
5. Comparer le résultat observé au contrat. Distinguer : surface non construite, code construit mais non appliqué/runtime en échec, et parcours bloqué par un prérequis manquant.

Les tests automatisés complètent cette preuve. Pour une logique modifiée, la preuve attendue comprend une assertion issue du contrat, son échec pertinent avant correction lorsque le travail le permet, puis sa réussite. Pour un bug, rejouer la reproduction d’origine et le test de régression. Pour une doc, une configuration ou un visuel, retenir une preuve adaptée et expliquer l’absence de test comportemental plutôt que d’inventer un test.

Une commande non exécutée demeure `non exécuté`; un environnement, accès ou donnée manquant rend le critère `bloqué`. Ne pas remplacer un runtime indisponible par « le code semble correct ». Si rien n’a été exercé réellement, aucun critère comportemental ne peut être déclaré réussi. Une revue statique ou un critère documentaire peut néanmoins être achevé par inspection, avec méthode et périmètre explicités ; ne pas l’étiqueter preuve runtime.

## Revue coordonnée, trois axes

La revue examine le diff depuis une référence explicite et les changements locaux pertinents. Elle produit des constats vérifiables, localisés et classés par gravité, sans confondre gravité et axe.

1. **Conformité au besoin** : critères, périmètre, surfaces promises, comportement manquant, comportement non demandé ou contradictoire.
2. **Correction, sécurité et conventions** : erreurs, cas limites, intégrité des données, frontières de confiance, régressions et règles documentées du dépôt.
3. **Simplicité** : complexité accidentelle, duplication, généralisation spéculative et coûts de maintenance. Cet axe ne peut jamais justifier la suppression d’une protection demandée.

Quand un reviewer réellement indépendant est disponible et autorisé, le privilégier pour un changement risqué. Un modèle différent ne compte comme indépendant que s’il est effectivement distinct de celui qui a produit le code et peut examiner le diff; sinon annoncer explicitement la limite. Ne pas qualifier une auto-relecture de revue indépendante, ni exiger un second modèle pour un petit diff sans risque.

Vérifier un constat avant d’éditer. Après toute correction, rejouer les tests, parcours réels et axes de revue affectés. Conserver le constat, la correction et le retest dans la matrice; ne pas masquer un échec antérieur par le seul dernier succès.

## Clôture locale et livraison

Pour une construction ou correction, `état_travail=terminé` seulement lorsque les obligations locales applicables sont satisfaites : comportement vérifié, contrôles requis passés, revue applicable achevée, limites visibles et contexte local pertinent synchronisé dans un mode qui l’autorise. Sinon l’état reste `actif` ou `bloqué` avec une prochaine action concrète.

La livraison est séparée : `non_demandée`, `en_attente_autorisation`, `prête`, `committée`, `poussée`, `PR_ouverte`, `mergée`, `déployée`, `bloquée` ou `non_applicable`. Une vérification locale peut donc se conclure par « terminé localement, livraison non demandée ». Ne jamais déduire commit, branche, index, push, PR, merge ou déploiement de cet état.

Si une livraison a été explicitement demandée mais manque d’autorisation ou d’exécution, annoncer la demande globale comme partielle ou bloquée, même si le travail local est terminé. Ne jamais annoncer « déployé » sur la base de contrôles locaux.

Mettre à jour la documentation seulement pour un fait durable réellement affecté et seulement dans la destination permise : contexte existant local dans un mode autorisé, ou Issue/PR/Project après mandat distant ciblé et confirmation de l’état accepté. En `plan`, `review` et `status`, rapporter les mises à jour nécessaires sans toucher un fichier versionné ni GitHub. Une erreur GitHub ne supprime pas le travail local et ne prouve pas une synchronisation distante.

## Rapport minimal

Rapporter : verdict global, matrice par critère, commandes/parcours réellement exécutés avec leurs preuves, contrôles non exécutés ou bloqués, constats de revue par axe et gravité, corrections et retests, puis `état_travail` et `livraison` distincts. Une preuve ancienne touchée par un nouveau diff doit être revalidée avant d’être présentée comme actuelle.
