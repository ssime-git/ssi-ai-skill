# Contexte, Audit, Sync et reprise

Appliquer les gardes et le plafond de mode déjà fixés par `SKILL.md`. Cette référence ne confère aucun droit supplémentaire. En `status`, aucune écriture. En `plan` ou `review`, écrire au plus dans `.ssi/`, jamais dans un fichier versionné. Audit et Sync n'autorisent que les écritures locales permises par le routeur; Git, index, branche, commit et écriture distante restent soumis à leur mandat explicite.

## Inspection ciblée

Avant de choisir ou reprendre un parcours, lire les instructions applicables à la racine et dans la zone visée, puis établir seulement les faits nécessaires : racine et workspace, worktree/branche/opération Git en cours, base configurée ou cible du travail, modifications indexées, non indexées et non suivies pertinentes, contexte existant, commandes et preuves disponibles.

Ne pas supposer `main` ou `master`, ni faire pull, rebase, stash, reset ou init Git. Sans Git, comparer une sélection de fichiers et annoncer cette limite. Une modification concurrente dans la zone touchée suspend son écriture : relire avant d'écrire, préserver le texte humain et signaler le conflit au lieu de choisir silencieusement un gagnant.

## Notes locales et destinations

Avant la première note, dans tout mode qui autorise `.ssi/` : inspecter le chemin et les liens symboliques. Si `.ssi/.gitignore` manque, créer ce seul fichier avec exactement `*` et un saut de ligne, sans toucher au `.gitignore` racine ni aux métadonnées Git. S'il existe, contrôler que ses règles protègent effectivement les notes sans écraser des règles ou exceptions humaines. Vérifier aussi que les notes ne sont ni suivies ni indexées; une règle ignore ne protège pas un fichier déjà suivi. Une protection insuffisante ou une note suivie/indexée bloque sa publication et est signalée sans suppression, réécriture d'historique ni `git add -f`.

Un nettoyage tel que `git clean -fdX` peut effacer ces notes ignorées : l’exclusion n’est pas une sauvegarde. Ne pas nettoyer sans mandat spécifique et examen des cibles. Sans Git, préparer l’exclusion interne et vérifier son efficacité à la première initialisation autorisée ; ne pas init Git pour les notes.

Les explorations, hypothèses et rapports vont dans `.ssi/`; l’état canonique de reprise est `.ssi/state.md`. Les faits durables utiles aux agents vont uniquement dans le fichier de contexte déjà applicable : `AGENTS.md` s'il est la source existante; sinon `CLAUDE.md` quand il est seul. Ne pas créer `AGENTS.md` concurrent ni migrer un `CLAUDE.md` seul. Si les deux existent, respecter leurs pointeurs et responsabilités; signaler une contradiction sans dupliquer ni migrer. Créer `AGENTS.md` seulement si aucun contexte applicable n'existe, ou après migration explicitement autorisée. Les docs produit existantes suivent leur convention et ne sont pas des notes SSI.

## Audit ciblé

Déclencher un Audit pour une zone inconnue, un manque matériel de contexte, l'adoption d'un dépôt ou une transformation structurelle. Ce n'est ni une certification sécurité ni une revue de simplicité. Définir la zone avant de lire : élargir seulement pour une dépendance transversale démontrée ou une demande explicite.

Établir depuis le dépôt les commandes, stack, conventions, points d'entrée, frontières et limites réellement utiles. Préserver les décisions et prose humaines; ajouter ou corriger des faits descriptifs étayés, ne pas inventer de conventions. Créer un contexte imbriqué seulement si la zone a réellement ses propres règles. En plan/review/status, rapporter les propositions au lieu de modifier un contexte versionné.

## Sync différentiel

Déclencher un Sync seulement quand un changement identifié affecte un fait durable : commande, convention, dépendance structurante, configuration, CI, manifeste, contrat, décision ou état de travail. Il ne réécrit pas la documentation pour chaque ligne, ni une spec humaine devenue discutable.

1. Fixer et annoncer le repère : base du travail ou dernière révision réellement inspectée, état courant et zone concernée.
2. Comparer les commits pertinents depuis ce repère, puis séparément index, working tree et fichiers non suivis pertinents. Inclure configuration, CI, manifestes et docs contractuelles quand ils modifient un fait durable; ne pas limiter la recherche aux sources applicatives.
3. Si la base manque, est ambiguë ou que l'historique a été réécrit, ne jamais conclure « à jour » depuis un diff vide. Inspecter la zone et fixer un nouveau repère explicite, avec la limite.
4. Mettre à jour seulement les faits descriptifs établis dans la bonne destination. Signaler une spec contradictoire ou périmée pour décision; ne pas la réécrire pour valider le code. Le code présent ne transforme pas un critère en preuve vérifiée.
5. Après une écriture autorisée, relire la cible et ne pas écraser une édition concurrente.

Sur une branche principale propre après merge, les commits depuis le repère restent donc examinés : `HEAD` et un working tree propre ne suffisent pas. Une nouvelle modification invalide les preuves des surfaces touchées et impose une revalidation ciblée.

## Reprise

Conserver dans `.ssi/state.md` seulement si le mode le permet : objectif et source canonique, mode explicite, dépôt/workspace/branche, base inspectée, état local pertinent, références et fraîcheur distantes, preuves, prochaine action et écarts. Le mode enregistré plafonne toute reprise. Un `/ssi` nu, « continue », ou une consultation `status` ne l'élargit pas; mode absent, illisible ou contradictoire signifie lecture et clarification.

Utiliser deux champs, jamais un statut de phase concurrent :

- `état_travail` : `actif`, `bloqué` ou `terminé`, selon le livrable du mode et ses preuves.
- `livraison` : `non_demandée`, `en_attente_autorisation`, `prête`, `committée`, `poussée`, `PR_ouverte`, `mergée`, `déployée`, `bloquée` ou `non_applicable`.

Un travail peut être terminé localement alors que la livraison n'est pas demandée ou attend une autorisation. Une permission retrouvée dans cet état ne devient jamais un nouveau mandat. À la reprise, faire un contrôle léger : état et preuves encore valides, Sync ciblé si écart borné, Audit ciblé seulement si le contexte manque ou si la structure a changé.
