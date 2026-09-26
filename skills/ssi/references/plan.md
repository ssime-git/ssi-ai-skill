# Cadrage, décisions et découpage

Charger cette référence seulement quand l’objectif exige de cadrer, décider, rechercher, prototyper ou découper. Le routeur conserve la responsabilité du mode et des autorisations.

## Garde de mode

- `status` : répondre en chat, sans écriture.
- `plan` ou `review` : analyser et, si utile, écrire seulement dans `.ssi/` déjà protégée. Ne modifier ni code, ni tests, ni configuration, ni contexte versionné ; ne publier aucun objet GitHub.
- `audit` ou `sync` : appliquer leur plafond ; un cadrage interne ne les transforme pas en construction.
- Construction : le cadrage peut produire un contrat bref local et les modifications locales autorisées. Branche, index, commit et écriture distante gardent leurs autorisations distinctes.

Une demande naturelle d’explication ou de planification conserve le plafond lecture/planification. Si le mode est ambigu et que cela change les droits d’écriture, rester en lecture et demander la seule clarification bloquante.

## Cadrage proportionné

Lire d’abord l’objectif, les instructions applicables, le flux concerné de bout en bout, ses appelants et les références déjà disponibles. Ne pas lancer un audit global ni une interview rituelle.

Pour un changement local déjà décidé, consigner seulement :

- problème et comportement attendu ;
- inclusions, exclusions et contrainte pertinente ;
- critère(s) observable(s) et preuve prévue ;
- hypothèse réversible, si elle existe.

Pour un changement structurant, compléter aussi : origine et cycle de vie des données, règles de calcul, états, erreurs, frontières de confiance et autorisations, interfaces impactées, alternatives pertinentes, tranches, dépendances, migration/retour arrière et inconnues.

Chaque valeur importante a une source : demande, comportement observé, convention, décision explicite ou hypothèse datée. Ne présenter ni convention inventée ni hypothèse comme un fait. Distinguer explicitement code observé, comportement demandé et preuve disponible.

## Décisions et interfaces

Suspendre seulement la partie dépendante d’une décision manquante. Proposer une option minimale avec ses conséquences ; poser une question uniquement si la décision est importante et non déléguée. Les hypothèses sur accès, paiement, confidentialité ou données ne sont pas validables unilatéralement.

Concevoir des modules à interface petite mais complète : invariants, erreurs, ordre, configuration et contraintes de performance font partie de l’interface. Choisir un seam où appelants et tests observent le même comportement. Une abstraction à une seule implémentation n’est justifiée que par une intégration, une sécurité ou un besoin de test réel ; sinon préférer une frontière plus directe.

Réutiliser le vocabulaire existant. Si un terme est ambigu, proposer un terme précis et vérifier les cas limites utiles. Une décision durable ne rejoint le contexte versionné ou GitHub que dans un mode et avec une autorisation qui le permettent ; sinon elle reste une proposition locale.

## Recherche et prototype

Rechercher ou prototyper seulement une inconnue précise qu’une lecture ne tranche pas. Énoncer : question, méthode sûre, résultat attendu, critère de décision et limite. Isoler le prototype, ne lui confier ni données réelles ni effet externe non autorisé, puis supprimer ou marquer ce qui ne devient pas produit. Un prototype ne devient jamais une implémentation par défaut.

## Découpage

Découper en petites tranches verticales vérifiables, chacune avec comportement livré, critère, preuve et dépendances réelles. Une tranche doit être réalisable dans un contexte frais et ne pas exiger de reconstruire les couches futures.

Pour un changement transversal à fort rayon d’action, appliquer expand-contract :

1. ajouter la forme compatible sans casser l’ancienne ;
2. migrer les appelants par lots vérifiables, en conservant les contrôles verts lorsque possible ;
3. retirer l’ancienne forme seulement après migration et vérification de tous les appelants.

Ne créer des tickets que si l’effort est structurant, multisession ou que le suivi existant les demande. Réutiliser Issue, relations et Project existants ; sans autorisation distante, garder le détail dans `.ssi/` et demander une publication groupée seulement si elle devient nécessaire. Ne créer ni nouvelle commande publique ni chaîne de slashs pour ces étapes.

## Sortie de planification

Le livrable indique la branche à reprendre, les prérequis satisfaits ou bloqués, les décisions/hypothèses, les tranches et la preuve attendue par critère. Un plan terminé signifie que ce livrable est achevé, pas que le produit est construit, testé ou livré. À la reprise, son mode reste un plafond jusqu’à une demande explicite d’élargissement.
