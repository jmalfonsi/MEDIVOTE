# MediVote

Système de vote en séance : émargement, procurations, scrutin en direct sur table
ovale, clôture et procès-verbal PDF, archivage SQLite.

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

## Exploitation

```bash
npm install
npm test                 # règles de quorum, majorités, procurations
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
- Liens de vote nominatifs par QR code, si les membres doivent voter eux-mêmes.
