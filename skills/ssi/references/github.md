# GitHub : suivi partagé et livraison

Charger cette référence seulement lorsqu'un dépôt GitHub, une Issue, une PR ou un Project est pertinent. Appliquer le plafond du routeur : ce module ne rend jamais une écriture distante autorisée. En `status`, aucune persistance; en `plan` ou `review`, aucune publication. Toute écriture distante exige un mandat de session explicite et ciblé, plus audience, compte, droits et objet vérifiés.

## Sources canoniques

- Issue : objectif, périmètre, critères et décisions d'un travail structurant, multisession ou imposé par convention.
- PR : changement effectivement livré, liens, preuves, limites et validation/retour arrière applicables.
- Project : priorité, responsable, jalon et état de pilotage selon ses champs existants.
- `.ssi/` : brouillons, plan détaillé, cache, hypothèses et point de reprise, non partagés.
- Contexte existant : commandes et conventions applicables aux agents, selon `context.md`.

Une petite modification isolée n'exige ni Issue ni inspection de Project. Une PR ne devient pas une seconde spec, un Project ne reçoit pas une copie du plan, et les notes brutes ne sont jamais publiées par défaut.

## Découverte paresseuse

Quand une lecture distante devient utile, résoudre le dépôt et confirmer le compte et les capacités réelles avec les outils disponibles, sans installation. Rechercher d'abord les objets déjà liés au travail : Issue si indiquée ou nécessaire, PR si livraison pertinente, Project seulement s'il est réellement utilisé. Charger uniquement les labels, relations, champs, options et automatisations utiles. Ne pas coder en dur noms ou identifiants; si plusieurs Projects conviennent, demander le choix au moment où il devient nécessaire.

Conserver les observations en mémoire de session; hors `status`, des liens ou IDs peuvent être mis dans `.ssi/` après sa protection. Ils enregistrent une observation et sa fraîcheur, pas une permission ni une seconde source de vérité.

## Permissions et confidentialité

Avant toute publication, vérifier cible, audience, compte, droit d'écriture et mandat applicable. Ne jamais publier secrets, données client, transcriptions, traces brutes ou notes confidentielles. Une permission de rédiger un brouillon, de mettre à jour une Issue, de pousser, d'ouvrir une PR, de fermer une Issue, de merger ou de déployer est distincte. Une permission durable doit être explicite, datée, bornée et encore valide; un cache `.ssi/` ne l'accorde pas.

Préparer localement ce qui est permis puis demander une validation groupée en nommant les objets et opérations exacts. Respecter aussi les confirmations de l'environnement. Une demande de livraison peut être partiellement satisfaite : ne pas déclarer la demande globale terminée tant que l'étape distante demandée manque.

## Réconciliation et absence de doublons

Avant création ou modification, relire l'objet cible et rechercher les références déjà liées. Réutiliser l'Issue, la PR, l'item Project et les relations existantes. Après chaque écriture, vérifier l'état accepté par GitHub. En cas de succès partiel, enregistrer les références réussies et reprendre uniquement les opérations manquantes, jamais recréer les objets.

Relire avant une écriture si une autre session ou personne peut avoir édité l'objet. Comparer le brouillon local avec l'Issue/PR actuelle, conserver les éditions humaines et signaler une divergence. Ne pas appliquer « dernier écrivain gagne ». Ne fermer une Issue, ne placer un item en Done, ne merger et ne déclencher un déploiement que si cette conséquence est explicitement voulue et autorisée. `état_travail=terminé` n'est ni Project Done ni Issue fermée.

Le Sync GitHub complète, sans les confondre, le Sync de contexte local : réconcilier critères et décisions de l'Issue, preuves de livraison de la PR et champs de pilotage du Project seulement pour les faits affectés et objets autorisés. Échec distant ou réseau absent : conserver le travail local, indiquer « dernière observation » et « suivi distant non mis à jour », puis relire les objets ciblés au retour. Aucun rejeu aveugle d'une file ancienne.

## Repli explicite

Sans GitHub, sans accès, sans droit, sans Project accessible ou sans mandat, poursuivre seulement le travail local autorisé et indiquer la cause exacte : suivi non partagé, accès indisponible, ou mise à jour distante en attente. Ne pas confondre erreur d'accès et absence d'Issue. Sans Project, Issues et PR peuvent rester utilisables si elles sont accessibles; ne créer ni Project, ni champ, ni schéma de remplacement par défaut. Mapper les options de statut réellement présentes.

Lorsqu'une Issue est requise mais non créable, garder un contrat bref local et demander l'autorisation de création sans bloquer les parties locales indépendantes. Sur un autre poste sans `.ssi/`, reprendre depuis les références publiées si elles existent; sinon annoncer que le travail local n'était pas partagé et demander une transmission, sans inventer son contenu.
