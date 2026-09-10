# MediVote

Système de vote en séance : émargement, procurations, scrutin en direct sur table
ovale, clôture et procès-verbal PDF, archivage SQLite.

## Séances et résolutions

Deux niveaux, et un seul principe pour les distinguer : **la séance est la
réunion, la résolution est le vote.**

| | Séance | Résolution |
| --- | --- | --- |
| Ce qu'elle porte | date, heure, lieu, collège convoqué, **émargement et procurations** | intitulé, texte soumis au vote, majorité requise, quorum, scrutin secret |
| Combien | une réunion à la fois sur la table | **autant que de points à l'ordre du jour** |
| Ce qui la clôt | « Clore la séance » : elle est scellée et les liens de vote tombent | « Clôturer le scrutin » : le résultat est arrêté et le PV archivé |

Une séance porte donc **plusieurs votes**, et on lui en ajoute **à tout moment,
y compris en pleine séance** — c'est le bouton « Ajouter un vote », présent sur
la table comme dans l'administration. La nouvelle résolution reprend telle quelle
la présence constatée, naît **fermée au vote**, et s'affiche aussitôt sur la table.

Corriger un vote — son texte, ses règles, sa convocation — se répercute
**partout du même coup** : l'ordre du jour de l'administration, la table, les
compteurs de suffrages. Retirer un membre de la convocation d'un vote le retire
aussi de son **émargement** ; un pouvoir qui lui avait été donné redevient une
absence. Un scrutin clôturé, lui, n'est jamais retouché : son émargement est
celui de la clôture, et c'est lui qui figure au procès-verbal.

On émarge **une fois pour la séance** : marquer un membre absent, excusé ou
mandant vaut pour tous les points encore ouvrables. Les résolutions déjà
clôturées gardent, elles, l'émargement constaté au moment de leur clôture — c'est
lui qui figure à leur procès-verbal, et il ne bouge plus.

Après la clôture d'un scrutin, la table **reste sur la résolution qu'on vient de
voter** et en affiche le résultat : passer au point suivant est un geste distinct.

En **plein écran**, le parcours de l'ordre du jour est piloté depuis la barre du
haut — deux flèches, ou les touches **←** et **→**, ce qui marche aussi avec une
télécommande de présentation. Le parcours couvre tous les points, ceux déjà votés
comme les autres : on doit pouvoir revenir montrer un résultat acquis. Le nombre
de **votes restants** y est écrit assez gros pour se lire du fond de la salle, et
des repères numérotés disent d'un coup d'œil ce qui est adopté, rejeté ou encore
à soumettre. Le panneau n'empiète jamais sur la table : les sièges occupent tout
le pourtour de l'ovale.
Une résolution jamais soumise au vote est classée **sans suite** à la clôture de
la séance.

Les bases antérieures, où une « séance » valait un vote, sont converties au
démarrage : chaque ligne existante devient une séance d'une résolution, et les
lignes partageant la même racine de référence et la même date (`CA-2026-09/R1` et
`CA-2026-09/R2` du même jour) sont regroupées sous une seule séance. Aucun
suffrage, aucune archive n'est touché.

## L'écran d'administration

Quatre onglets, et rien d'autre — un sujet par onglet, nommé comme on en parle
en séance :

| Onglet | Ce qu'on y fait |
| --- | --- |
| **Séances et votes** | la liste des séances, puis l'ordre du jour de celle qui est sur la table |
| **Émargement** | présents, absents, pouvoirs — une fois pour toute la séance |
| **Membres** | le répertoire des personnes, et les collèges (CA, CC, Bureau) qui les regroupent |
| **Procès-verbaux** | les résultats scellés ; la recherche et l'export sont sur l'écran Archives |

Un bandeau de situation, sous le titre, répond en permanence aux trois questions
qui se mélangeaient : **quelle séance** est affichée, **combien de votes** elle
porte et combien restent à trancher, **quel vote** est en ce moment sur la table
et où en est son scrutin. Le vocabulaire y est fixé une fois pour toutes : une
*séance* est une réunion, elle porte des *votes*, la *table* est l'écran projeté
en salle. L'écran ne dit plus « résolution », « motion » ni « réunion » là où il
veut dire *vote* ou *séance* — le mot « résolution » ne subsiste qu'à sa place
juridique, sur le texte soumis au vote et dans les procès-verbaux.

Le bouton **Vue simplifiée** de la barre du haut retire les explications, les
mentions techniques et les outils de démonstration : c'est l'affichage à prendre
pour présider.

### « Sur la table » n'est pas « ouverte »

Une séance a deux états indépendants, et les confondre est ce qui rendait la
page illisible :

- **sur la table** — c'est elle que l'écran de la salle présente. Une seule à la
  fois, **et parfois aucune** : entre deux réunions, la table est vide et la page
  l'écrit, au lieu d'afficher la dernière séance créée comme si elle siégeait ;
- **close** — la séance est scellée, ses liens de vote révoqués. Clore une
  séance la **retire de la table** ; elle n'y revient pas, et ses résultats se
  relisent dans les procès-verbaux. Si une autre séance reste à tenir, elle
  prend la table aussitôt.

Les cartes de séance portent donc l'un des trois états — **sur la table**,
**à tenir**, **close** — et le filtre ne propose que le partage qui a un sens :
celles qui restent à tenir, celles qui sont closes.

## Retirer un membre du répertoire

La suppression d'un membre ne se limite pas à sa fiche : elle le retire aussi des
collèges, des convocations de chaque séance et de chacun de ses votes, des
émargements, et **révoque son lien de vote nominatif**. Un membre qui lui avait
donné pouvoir redevient simplement absent. Les **procès-verbaux déjà archivés ne
bougent pas** : chacun porte sa propre copie des votants et des suffrages, et
c'est lui qui fait foi.

## Règles de scrutin retenues

Arbitrées le 31/08/2026, elles sont implémentées dans `src/utils/votingMath.ts` et
couvertes par les tests de `src/utils/__tests__/votingMath.test.ts` :

| Règle | Décision |
| --- | --- |
| Abstentions | **Comprises** dans les suffrages exprimés. En majorité absolue ou aux deux tiers, une abstention pèse comme une voix contre. |
| Quorum | **0 par défaut** (réputé atteint), réglable séance par séance. |
| Membre présent n'ayant pas voté | Assimilé à une **abstention**, mais seulement à la clôture. Pendant le scrutin il reste affiché comme non-votant. |
| Absents et excusés | Ne sont jamais assimilés : ils ne sont pas des votants. |

Le résultat officiel est **recalculé par le serveur** à la clôture, à partir des
bulletins en base. Ce que le navigateur envoie n'entre pas dans le procès-verbal.

## Ouverture du scrutin

Un scrutin **ne s'ouvre jamais tout seul**. L'heure programmée est un repère
affiché, pas un déclencheur : seule une ouverture explicite depuis la table rend
les bulletins recevables, et le président peut ouvrir avant l'heure annoncée s'il
le décide.

« Résolution affichée sur la table » et « scrutin ouvert » sont donc deux états
distincts. Au niveau des données, `createOrUpdateSession` et `ajouterResolution`
**ignorent** le statut qu'on leur transmet : une résolution naît fermée au vote,
et seule `definirOuvertureScrutin` l'ouvre ou la suspend. Aucun autre chemin —
création, ajout d'un point en séance, correction de l'ordre du jour, duplication,
changement de séance ou de résolution affichée, remise à zéro des suffrages — ne
peut ouvrir un scrutin par effet de bord. `server/__tests__/ouvertureScrutin.test.ts`
et `server/__tests__/seancesResolutions.test.ts` le vérifient chemin par chemin.

Corollaire : une remise à zéro referme le scrutin. Elle efface les suffrages,
elle ne décide pas d'un nouveau tour.

## Configuration

Copier `.env.example` en `.env` et renseigner au minimum `MEDIVOTE_ADMIN_PIN` :
le serveur refuse de démarrer en production sans lui. Le code administrateur
n'existe pas dans le code envoyé au navigateur ; il est vérifié côté serveur, en
temps constant, avec verrouillage du poste après 5 essais.

| Variable | Rôle | Défaut |
| --- | --- | --- |
| `MEDIVOTE_ADMIN_PIN` | Code administrateur. Obligatoire en production. | *(aucun)* |
| `PORT` | Port d'écoute. | `3000` |
| `MEDIVOTE_HOST` | Interface d'écoute. | `0.0.0.0` |
| `MEDIVOTE_DATA_DIR` | Base de séance et sauvegardes. | `./data` |
| `MEDIVOTE_COOKIE_SECURE` | À passer à `true` dès que le service est en HTTPS. | `false` |
| `MEDIVOTE_URL_PUBLIQUE` | Adresse publique inscrite dans les QR codes de vote. Doit être joignable depuis les téléphones. | *(déduite des en-têtes du proxy)* |

## Vote nominatif par QR code

Chaque membre convoqué dispose d'un lien personnel, présenté sous forme de QR code
sur la tuile de son siège en vue table. L'administrateur l'agrandit d'un clic pour
qu'il soit scanné depuis l'écran de la salle ; le membre vote alors sur son
téléphone. Le mode administrateur reste disponible en parallèle : il n'est pas
remplacé, mais doublé.

| Garantie | Mise en œuvre |
| --- | --- |
| Un membre, un lien | Jeton de 24 octets tiré au hasard, lié à un couple (séance, membre). |
| Un seul bulletin **par résolution** | Le suffrage déjà exprimé sur la résolution en cours fait foi : toute nouvelle tentative est refusée sans le modifier. |
| Un scan pour toute la séance | Le lien vaut pour la séance entière. Le téléphone suit l'ordre du jour de lui-même : au point suivant, le membre a de nouveau son bulletin, sans rescanner. |
| Valable un jour | Échéance à 24 h, et révocation de tous les liens à la clôture de la **séance** — pas à celle d'une résolution. |
| Pouvoirs comptés | Le vote du mandataire est propagé à ses procurations, comme depuis la table. |
| Recevabilité | Le serveur vérifie l'ouverture du scrutin et l'émargement : un membre absent, excusé, ou ayant donné pouvoir ne peut pas déposer de bulletin. |
| Scrutin secret | Le téléphone n'affiche jamais le sens du bulletin déposé, et la notification de séance reste anonyme. |

Ces règles sont couvertes par `server/__tests__/jetonsVote.test.ts`.

Si les QR codes ne peuvent pas être préparés (serveur redémarré, session reprise),
l'écran de séance le **dit** et propose de réessayer, au lieu de les faire
disparaître des tuiles sans un mot. Le chargement est retenté seul jusqu'à trois
fois avant d'en arriver là.

**Le QR code n'est affiché que sur l'écran de la salle** : l'obtenir suppose d'y
être. C'est ce qui tient lieu de contrôle de présence, la page de vote étant par
construction accessible sans code administrateur.

## Exploitation

```bash
npm install
npm test                 # quorum, majorités, procurations, séances et liens de vote
npm run lint             # vérification des types
npm run dev              # développement (port 3000)

npm run build            # build de production
NODE_ENV=production MEDIVOTE_ADMIN_PIN=… node dist/server.cjs
```

## Données de séance

La base vit dans `MEDIVOTE_DATA_DIR` (`data/` par défaut) et **n'est pas versionnée** :
elle contient les coordonnées personnelles des membres. Elle est écrite de façon
atomique (fichier temporaire puis renommage), et une copie horodatée est prise dans
`data/sauvegardes/` à chaque clôture de scrutin.

## Reste à faire avant une séance publique

- Service systemd et terminaison HTTPS (le cookie de session circule en clair sans elle).
- Répétition générale sur le réseau réel de la salle.
- Vérifier que les téléphones des membres joignent bien `MEDIVOTE_URL_PUBLIQUE`
  depuis le réseau de la salle (le filtrage par adresse IP du reverse proxy
  s'applique aussi aux pages de vote).
