# MEDIVOTE — audit fonctionnel du 10 septembre 2026

**Avis : le fonctionnement nominal est opérationnel, mais les résultats et procès-verbaux ne sont pas suffisamment fiables pour valider l’ensemble de l’application.** Plusieurs parcours produisent un document incorrect, acceptent un pouvoir invalide ou contredisent le scellement annoncé.

L’audit porte sur le code présent dans `/home/ubuntu/MEDIVOTE`, au commit de référence `85c20e9b6df9aaadca9b83d8146272f7cb386501`, **avec les modifications locales déjà présentes au début de l’intervention**. Les fichiers applicatifs et les données de `data/` n’ont pas été modifiés par cet audit. Les écritures de test ont utilisé des bases temporaires et une instance dédiée sur `127.0.0.1:3187`. Les preuves jointes utilisent des identités fictives.

## Résultats des vérifications

- **68 tests existants : réussis.**
- **TypeScript : réussi.**
- **Compilation client et serveur : réussie**, dans un dossier temporaire, sans remplacer `dist/`. Avertissement Vite sur la taille du paquet principal.
- **64 contrôles complémentaires : 36 réussis, 28 en échec.** Plusieurs échecs concernent une même anomalie vérifiée à différents niveaux ; il ne s’agit pas de 28 bugs indépendants.
- Le contrôle des majorités couvre **496 répartitions non vides**, réparties entre les quatre règles proposées.
- Contrôles Chromium à 1440 × 1000 et vote mobile à 390 × 844 ; extraction du texte des PDF et examen visuel des pages.

Un contrôle « téléchargement réussi » signifie que le fichier a été produit. Il ne valide pas sa justesse : les défauts de contenu et de mise en page sont détaillés ci-dessous.

Résultats bruts : [moteur et base](results.json), [API et navigateur](browser-results.json), [options complémentaires](secondary-results.json).

## Couverture des options

| Option / parcours | Vérification | Conclusion |
| --- | --- | --- |
| Connexion administrateur, déconnexion, API protégée | Clavier visuel + HTTP | OK ; l’API refuse l’accès anonyme et après déconnexion. |
| Poste mémorisé | Rechargements dans le navigateur + lecture du code | Rechargement OK ; l’expiration réelle à sept jours n’a pas été attendue. |
| Administration, Table, Kiosque, Archives | Navigation Chromium | Les quatre vues s’affichent. |
| Quatre onglets d’administration | Navigation Chromium | Séances et votes, Émargement, Membres, Procès-verbaux accessibles. |
| Vue simplifiée | Bascule et rechargement | Préférence conservée. |
| Plein écran, flèches de l’ordre du jour | Clics + clavier | Passage au point précédent/suivant confirmé côté serveur. |
| Création et édition des membres | HTTP | Fonctionnement nominal OK ; contrôles d’éligibilité insuffisants après désactivation. |
| Suppression d’un membre | HTTP + tests existants | Retrait et préservation des snapshots couverts par les tests existants. |
| Import de membres | Deux identités fictives | Import nominal OK ; tous les formats d’entrée possibles ne sont pas validés. |
| Collèges : création, modification, application, suppression | HTTP | Parcours nominal OK ; cas de convocation vide et propagation de présence défectueux. |
| Création de séance et première résolution | HTTP + tests existants | OK. |
| Ajout d’un vote en cours de séance | HTTP + tests existants | Nouvelle résolution créée fermée et affichée sur la table. |
| Modification de l’ordre du jour | Tests existants + lecture du formulaire | Mise à jour nominale couverte ; modification directe d’un scrutin clos acceptée à tort au regard du scellement annoncé. |
| Réorganisation, changement de séance/résolution | HTTP + clavier + tests existants | Parcours nominal OK, pas d’ouverture automatique. |
| Duplication | HTTP + tests existants | Nouvelle séance, aucun suffrage repris, scrutin fermé. |
| Modèles | Création, lecture et suppression HTTP | OK ; application au formulaire examinée dans le code. |
| Majorités simple, absolue, deux tiers, unanimité | 496 répartitions | Calcul conforme aux règles du README pour des poids entiers valides. |
| Quorum nul et seuil de présence | Tests existants + cas aux seuils | Calcul nominal OK ; pouvoirs invalides et archive du pourcentage faussent certains parcours. |
| Présent, absent, excusé | Base + clôture | Exclusion des absents/excusés du décompte OK ; validation et propagation incomplètes. |
| Pouvoirs | Cas normaux et limites | Limite de deux et auto-procuration contrôlées ; autres anomalies importantes, voir F03–F04. |
| Ouverture, suspension, remise à zéro | HTTP + tests existants | Ouverture explicite correcte ; remise à zéro referme le scrutin. Elle peut aussi modifier un scrutin clos. |
| Vote depuis la table / administration | Base + HTTP | Enregistrement et propagation nominale OK ; validation du membre et du choix insuffisante. |
| Vote nominatif par QR | Génération des quatre QR + navigateur mobile | Bulletin, confirmation et refus d’un second vote OK. Limites de cadence et désactivation défectueuses. |
| Mode votant / changement d’identité | Kiosque → sélecteur → membre B | Sélection et siège affiché corrects. |
| Vote secret | API et notifications pendant le vote | Choix masqué pendant le vote ; le détail nominatif est révélé après clôture, conformément au libellé actuel. |
| Clôture d’un vote | HTTP, statistiques client volontairement fausses | Serveur souverain : il recalcule bien le résultat et les abstentions assimilées. Aperçu préalable incorrect. |
| Clôture d’une séance | HTTP + tests existants | Refuse un scrutin encore ouvert ; après sa clôture, scelle la séance et classe les points non soumis sans suite. |
| Archives : recherche et aperçu | Chromium | Recherche fonctionnelle ; quorum affiché incorrect et aperçu susceptible d’inclure l’annuaire entier. |
| Exports PDF : table, ordre du jour, archives | Code + fichiers téléchargés | Défauts de source des données, de poids et de pagination ; voir F01, F02, F10. |
| Impression depuis « Voir PV » | PDF produit par le moteur Chromium | Superposition du PV et de la page d’archives. |
| Export CSV | Téléchargement avec référence contenant `#` | Fichier tronqué. |
| Notifications, filtres, interrupteur sonore | HTTP + Chromium | Fonctionnement des commandes vérifié ; écoute physique des sons non réalisée. |
| « Tous Pour » / simulation aléatoire | Lecture des boucles de traitement | Les boucles parcourent tout l’annuaire actif et traitent aussi les mandants ; correction à prévoir, pas de validation complète de simulation. |
| Réinitialisation de démonstration | Utilisée par les tests existants sur bases temporaires | Fonctionnement couvert par ces tests ; bouton non déclenché sur l’instance habituelle. |

## Anomalies à corriger en priorité

### F01 — Critique : le PDF de l’ordre du jour invente le détail des suffrages

**Reproduction :** 4 membres convoqués, 2 pour, 1 contre, 1 absent ; clôturer puis utiliser le bouton PDF du vote dans l’ordre du jour.

**Obtenu :** 0 pour, 0 contre, 4 abstentions, 4 présents. Le résultat peut pourtant rester marqué « adopté », puisqu’il est repris séparément. Le même défaut est confirmé par un clic réel avec le scénario 1 pour / 3 abstentions : le raccourci donne 0 pour / 4 abstentions.

**Cause :** [AdminPanel.tsx:996](/home/ubuntu/MEDIVOTE/src/components/AdminPanel.tsx:996) fabrique une session avec `voterStates: {}` et des propriétés de la résolution actuellement affichée. Le calcul interprète les états absents comme des présents non votants et les assimile à des abstentions puisque le statut est clos.

**Correction proposée :** tous les boutons PDF d’un scrutin clôturé doivent charger le même `detailedSnapshot` et ses statistiques archivées, par identifiant de résolution. Ne jamais reconstruire un PV depuis l’annuaire courant ou un état vide.

Preuves : [PDF avec snapshot](Proces_Verbal_AUDIT-ARCHIVE_2026-09-10.pdf), [PDF du raccourci](Proces_Verbal_AUDIT-RACCOURCI_2026-09-10.pdf), [clic réel — archive](ui-archive.pdf), [clic réel — raccourci](ui-raccourci.pdf). Contrôles `PDF-01`, `UI-08`, `UI-09`.

### F02 — Haute : le quorum archivé change d’unité

Avec 4 inscrits et un quorum de **50 %**, le serveur calcule correctement **2 membres requis**. Mais [db.ts:1916](/home/ubuntu/MEDIVOTE/server/db.ts:1916) enregistre `stats.quorumNeeded` dans la colonne `quorum_pct`. À la relecture, `getHistory()` le présente comme un pourcentage.

Le PDF téléchargé depuis Archives porte ainsi **« 2 % (2 voix) »** au lieu de « 50 % (2 membres) ». La réponse immédiate de clôture contient encore 50 %, ce qui explique la divergence après relecture.

**Correction :** enregistrer `session.quorumPct` ; reprendre le pourcentage des archives existantes depuis `detailedSnapshot.session.quorumPct` lorsqu’il est disponible, sans modifier les suffrages. Contrôle `ARCH-01`, preuve [ui-archive.pdf](ui-archive.pdf).

### F03 — Haute : des pouvoirs invalides sont comptés comme représentation

Sont acceptés : pouvoir sans destinataire, pouvoir vers un absent, pouvoir vers un non-convoqué, cycle A → B → A. Le départ d’un mandataire laisse ses mandants en état `proxy`.

La limite de deux pouvoirs et l’interdiction de se donner pouvoir à soi-même fonctionnent. Mais [updateVoterPresence](/home/ubuntu/MEDIVOTE/server/db.ts:1775) ne vérifie pas les autres conditions. [calculateVoteStatistics](/home/ubuntu/MEDIVOTE/src/utils/votingMath.ts:90) compte ensuite toute présence `proxy` dans le quorum et dans les suffrages pouvant être assimilés.

**Conséquence :** un quorum peut être annoncé atteint avec des personnes qui ne sont pas effectivement représentées.

**Correction :** contrôler l’existence, l’activité, la convocation et la présence du mandataire, interdire les cycles et réévaluer ses mandants lorsqu’il quitte la séance. Contrôles `POU-03` à `POU-07`.

### F04 — Haute : un changement de pouvoir ne resynchronise pas le bulletin

Si A a déjà voté pour puis B donne pouvoir à A, le bulletin de B reste `pending`. À la clôture, il devient une abstention au lieu de reprendre le choix de A. Les modifications de présence ne réinitialisent ni ne recalculent le bulletin déjà porté par un mandant.

**Correction :** définir et appliquer atomiquement le traitement du vote lors d’une attribution, d’un retrait ou d’un changement de pouvoir. Le cas normal « pouvoir avant vote » propage correctement le choix et les poids. Contrôles `POU-02`, `POU-08` ; [db.ts:1814](/home/ubuntu/MEDIVOTE/server/db.ts:1814).

### F05 — Haute : le scellement annoncé n’est pas garanti

Les opérations de modification de résolution, émargement, remise à zéro et suppression acceptent un scrutin déjà clôturé. La suppression d’une archive fonctionne également via l’API : HTTP 200, archive disparue, malgré la mention visible « inaltérable et non supprimable ».

Il existe même un bouton explicite **« Rouvrir (remise à zéro) »** dans la table. Il faut donc résoudre une contradiction de conception, et pas seulement cacher une route. Les snapshots restent indépendants des modifications ordinaires du répertoire, ce qui est positif ; cela ne protège pas leur suppression.

**Correction :** garantir le statut clos au niveau métier, conserver les archives et créer une nouvelle résolution/un nouveau tour pour recommencer un vote. Si la réouverture administrative est souhaitée, la distinguer et la tracer clairement sans réécrire l’état qui fonde le PV.

Contrôles `CLOSE-01` à `CLOSE-05`, `HTTP-12`, `HTTP-13`. Code : [remise à zéro](/home/ubuntu/MEDIVOTE/server/db.ts:1825), [suppression d’archive](/home/ubuntu/MEDIVOTE/server/db.ts:1994), [bouton de réouverture](/home/ubuntu/MEDIVOTE/src/components/OvalTable.tsx:351).

### F06 — Haute : recevabilité différente entre vote administratif et mobile

Le vote administratif accepte un absent, un mandant, un non-convoqué et une valeur de choix inconnue. Un bulletin enregistré pour un absent n’est pas immédiatement compté, mais peut réapparaître si sa présence change. Un mandant peut porter un choix distinct de celui du mandataire.

Le vote mobile est mieux contrôlé, mais un lien déjà remis reste utilisable après désactivation du membre : **bulletin accepté HTTP 200**, alors que le moteur de statistiques exclut les membres inactifs.

**Correction :** partager une validation métier entre les deux chemins, en conservant explicitement la possibilité administrative de corriger un suffrage si elle est voulue. Recontrôler l’activité et la convocation lors de chaque dépôt.

Contrôles `VOTE-01` à `VOTE-04`, `OPT-06`. Code : [vote administratif](/home/ubuntu/MEDIVOTE/server/db.ts:1745), [vote mobile](/home/ubuntu/MEDIVOTE/server/db.ts:2331).

### F07 — Haute : une convocation vide devient l’annuaire entier

`selectedAttendeeIds: []` est interprété comme « tous les votants » dans le calcul et plusieurs écrans, au lieu de zéro inscrit. Le contrôle obtient 34 inscrits dans sa base de test alors que la liste passée est vide.

L’émargement propagé à toutes les résolutions peut aussi ajouter une ligne pour un membre non convoqué à une résolution particulière. Les compteurs de l’ordre du jour utilisent ces lignes et peuvent diverger du calcul filtré de la table.

**Correction :** distinguer liste absente (compatibilité historique éventuelle) et liste explicitement vide ; limiter toute propagation aux convoqués de la résolution cible. Contrôles `CALC-04`, `PRES-02`. Code : [votingMath.ts:58](/home/ubuntu/MEDIVOTE/src/utils/votingMath.ts:58), [db.ts:1804](/home/ubuntu/MEDIVOTE/server/db.ts:1804).

### F08 — Haute : l’aperçu de clôture ne présente pas le résultat qui sera archivé

Avec 4 présents, quorum atteint, 1 pour et 3 non-votants, la fenêtre annonce **« QUORUM NON ATTEINT »**. Le serveur clôture pourtant correctement avec 1 pour, 3 abstentions et un rejet en majorité absolue.

La fenêtre reçoit les statistiques en cours ; tout résultat autre qu’adopté/rejeté est présenté comme un échec de quorum. Elle ne prévisualise pas l’assimilation des non-votants.

**Correction :** fournir un aperçu finalisé cohérent avec le serveur et distinguer quorum non atteint, scrutin incomplet, résultat final et absence de suffrage. Contrôle `UI-07`, [capture](apercu-cloture.png), [CloseSessionModal.tsx:89](/home/ubuntu/MEDIVOTE/src/components/CloseSessionModal.tsx:89).

### F09 — Haute en salle : la cadence mobile est limitée globalement par IP

La page mobile interroge le serveur toutes les 5 secondes. La limite actuelle est de 60 requêtes par minute et par `req.ip`, partagée entre les lectures et les bulletins. **Six téléphones suffisent théoriquement à produire 72 lectures/minute**, hors dépôts et chargements initiaux, s’ils partagent l’IP observée par le serveur.

Le test de 61 lectures, après quelques opérations mobiles, a reçu **5 réponses HTTP 429**. C’est un problème particulièrement plausible derrière un réseau partagé ou un reverse proxy ; le comportement du réseau réel n’a pas été mesuré.

**Correction :** séparer lecture et dépôt, répartir la limitation par lien de vote, conserver une protection globale proportionnée et vérifier la configuration du proxy. Contrôle `HTTP-14`, [server.ts:246](/home/ubuntu/MEDIVOTE/server.ts:246), [polling mobile](/home/ubuntu/MEDIVOTE/src/components/PageVoteMobile.tsx:105).

### F10 — Haute : défauts de contenu et de pagination des PDF

- **Texte long :** le titre déborde de son cadre et recouvre les métadonnées. La motion est dessinée sans pagination ; **53 occurrences sur 120** du début de la phrase témoin sont retrouvées dans le texte extrait après normalisation des espaces. La synthèse des suffrages est également absente du texte extrait. La première page déborde et la seconde ne reprend pas la motion manquante. [PDF](Proces_Verbal_AUDIT-TEXTE-LONG_2026-09-10.pdf), [image](pdf-long.png).
- **Poids :** un membre de poids 3 est affiché à **1 voix** dans le détail, alors que la synthèse compte correctement ses 3 voix. Les poids des pouvoirs sont aussi présentés par un nombre de personnes plutôt que par la somme de leurs poids. [PDF](pdf-poids.pdf).
- **Résultat trop large :** la mention adoptée sort du cadre de résultat ; « QUORUM NON ATTEINT » arrive presque au bord de page. Les blocs utilisent des positions et dimensions fixes.
- **Émargement :** les absents sont indiqués « En attente » même après clôture ; l’intitulé prête à confusion. Le filtre des lignes du PDF ne reprend pas celui des membres actifs du calcul.
- **Traçabilité :** le PDF affiche la date d’édition, mais pas explicitement l’heure de clôture. La mention « certifié SQLite » ne démontre aucune certification ou signature cryptographique dans le code examiné. La zone de signature est une simple légende en pied de page.

**Point positif :** la table d’émargement de 80 membres se répartit correctement sur trois pages, jusqu’au dernier membre ; c’est le contenu hors tableau qui n’est pas paginé correctement. [PDF 80 membres](pdf-80-membres.pdf).

**Correction :** construire un document à blocs de hauteur calculée, avec sauts de page pour titre/motion/synthèse, afficher les poids effectifs, l’heure de clôture et une zone de signature exploitable. Code : [pdfExport.ts:175](/home/ubuntu/MEDIVOTE/src/utils/pdfExport.ts:175), [poids](/home/ubuntu/MEDIVOTE/src/utils/pdfExport.ts:301).

### F11 — Moyenne : l’impression superpose deux écrans

« Imprimer » appelle `window.print()` sans mise en page dédiée. Le PDF du moteur d’impression montre à la fois la liste d’archives et la fenêtre de détail, avec textes et commandes superposés.

**Correction :** imprimer le PDF officiel ou prévoir un style d’impression isolant le PV, sans navigation ni boutons. [Preuve](impression-navigateur.pdf), [HistoryPanel.tsx:52](/home/ubuntu/MEDIVOTE/src/components/HistoryPanel.tsx:52).

### F12 — Moyenne : le CSV est tronqué par une référence contenant `#`

Pour `AUDIT#CSV/R1`, le fichier s’arrête à `hist_…,\"AUDIT`. Le `#` devient un fragment de l’URL `data:` construite avec `encodeURI`.

**Correction :** télécharger un `Blob` CSV correctement échappé. Le code doit également préciser si l’export concerne toutes les archives ou le filtre visible : il parcourt actuellement `history`, pas `filteredHistory`. Contrôle `OPT-07`, [fichier témoin](export.csv), [HistoryPanel.tsx:119](/home/ubuntu/MEDIVOTE/src/components/HistoryPanel.tsx:119).

### F13 — Moyenne : cas limites non représentés correctement

- Sans ligne d’émargement, un membre est compté présent/non-votant dans une partie du calcul, mais absent du compteur `notVotedCount` : 4 présents et 0 non-votant dans le scénario `CALC-05`.
- Une clôture directe de résolution à l’état `draft` peut produire un résultat rejeté avec abstentions assimilées, alors que la clôture de la séance classe les points jamais soumis « sans suite » (`CLOSE-06`). Attention : `draft` sert aussi pour un scrutin suspendu ; il faut distinguer « jamais ouvert » de « suspendu » avant de corriger.
- L’aperçu d’archive parcourt l’intégralité de `detailedSnapshot.voters`, qui est l’annuaire au jour de clôture, alors que le PDF Archives filtre les convoqués. Observation de code : [HistoryPanel.tsx:427](/home/ubuntu/MEDIVOTE/src/components/HistoryPanel.tsx:427).
- Lors de l’édition d’une résolution autre que celle affichée, le formulaire initialise sa convocation avec tout l’annuaire : [AdminPanel.tsx:260](/home/ubuntu/MEDIVOTE/src/components/AdminPanel.tsx:260). À couvrir par un test spécifique avant correction.
- Les simulations parcourent les mandants séparément de leurs mandataires : une simulation aléatoire peut leur attribuer des choix différents. Observation de code : [App.tsx:391](/home/ubuntu/MEDIVOTE/src/App.tsx:391).

## Ordre de correction recommandé

1. Unifier tous les PDF clôturés autour du snapshot archivé et corriger le pourcentage de quorum enregistré.
2. Garantir les règles de présence, d’activité, de convocation et de pouvoir avant tout calcul ou dépôt de bulletin.
3. Résoudre la politique de réouverture/scellement ; protéger les archives au niveau serveur.
4. Corriger l’aperçu de clôture et la limitation partagée des téléphones.
5. Refaire la pagination, les poids et l’impression des documents ; corriger l’export CSV.
6. Transformer les scénarios reproduits en tests de non-régression dans les suites métier et navigateur.

## Portée et limites

Cet audit vérifie la cohérence avec les règles **déjà documentées dans le README** : abstentions incluses dans le dénominateur des majorités absolue/deux tiers, quorum par nombre de membres, présents non votants assimilés uniquement à la clôture. Il ne valide pas ces choix au regard des statuts de l’organisme.

Le « scrutin secret » actuel masque jusqu’à la clôture puis révèle le détail nominatif. Si un anonymat durable est attendu, le produit doit changer de conception ; le libellé actuel décrit bien la révélation après clôture.

Les principales options ont été examinées et les parcours indiqués ont été exécutés. Cela ne constitue pas une preuve exhaustive de toutes les combinaisons possibles : réseau réel, scan optique depuis la salle, impression physique, restitution sonore, expiration réelle des appareils, coupure électrique, concurrence de nombreux dépôts et très longues séances restent à éprouver. Aucun contrôle n’a utilisé la base habituelle pour des écritures.

Le serveur de développement temporaire a rencontré un conflit du port HMR 24678 avec une autre instance existante. Les erreurs `WebSocket closed without opened` relevées dans Chromium se rapportent à cet environnement de développement ; les appels HTTP et les tests ci-dessus ont continué à fonctionner. La compilation de production a réussi.

**Aucune correction du code applicatif n’est incluse : le livrable est un audit, des scénarios reproductibles et leurs preuves.**

## Reproduction

Scripts : [reproduce.ts](reproduce.ts), [browser.mjs](browser.mjs), [secondary.mjs](secondary.mjs). Le premier crée et détruit sa propre base temporaire. Les scripts navigateur sont destinés **uniquement** à une instance jetable sur `127.0.0.1:3187` : ils créent, modifient et suppriment leurs données de test.

Depuis la racine du projet :

```bash
npm test
npm run lint
npx tsx audit/2026-09-10/reproduce.ts
```

Pour les parcours navigateur, lancer un serveur séparé avec `MEDIVOTE_DATA_DIR` pointant vers un dossier créé par `mktemp -d`, `MEDIVOTE_HOST=127.0.0.1`, `PORT=3187`, `MEDIVOTE_ADMIN_PIN=739162` (code fictif de test), puis exécuter les deux scripts `.mjs`. `PLAYWRIGHT_MODULE` permet d’indiquer le chemin d’une installation existante de Playwright. Ne pas utiliser ces scripts contre un service réel.

Les résultats `ECHEC` sont les exigences non satisfaites par le produit actuel ; ils sont consignés dans les JSON, sans interrompre tout l’audit.
