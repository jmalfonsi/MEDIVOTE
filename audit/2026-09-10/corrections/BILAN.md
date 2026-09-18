# MEDIVOTE — corrections de l’audit du 10 septembre 2026

Les anomalies F01 à F13 de l’[audit initial](../RAPPORT.md) sont corrigées dans le code du projet. Les essais de régression, les parcours Chromium/API et les contrôles de contenu des PDF passent. Les preuves antérieures sont conservées dans le dossier parent pour comparaison.

## Incident QR du 10 septembre 2026

Les liens de la séance en cours avaient tous dépassé leur échéance de 24 heures et avaient été purgés au redémarrage ; la modification des pouvoirs ne les avait pas révoqués. Après sauvegarde de la base de production, 12 liens ont été régénérés et contrôlés via l’application et nginx HTTPS. Le scrutin est resté ouvert et ses présences, pouvoirs et votes sont inchangés.

L’écran de salle actualise désormais les liens cinq minutes avant leur échéance. Le serveur conserve le même jeton et repousse son échéance tant que la table reste active. Une commande « Actualiser les QR codes » est disponible, et la page mobile récupère seule après une erreur réseau temporaire ou propose « Réessayer ». Trois parcours navigateur et trois tests de base couvrent expiration, renouvellement glissant et modifications des pouvoirs. Preuves : [avant](../incident-qr/avant.json) et [après](../incident-qr/apres.json).

## Suivi des bulletins mobiles

Chaque page mobile valide envoie un battement lors de son contrôle toutes les cinq secondes. La carte du membre affiche un fond vert et « BULLETIN ACTIF » tant que ce battement reste récent, un fond rouge et « ERREUR BULLETIN » pendant trente secondes après un refus, et son fond habituel avant la première ouverture ou après vingt secondes sans activité. Un bulletin finalement accepté efface immédiatement l’erreur. Ce suivi est séparé des suffrages et n’entre jamais dans leur calcul.

Le test de production a contrôlé la succession actif → erreur HTTP 409 → erreur encore visible après la relecture automatique du téléphone, pendant que le scrutin restait fermé : zéro suffrage avant et après. Le retour automatique au vert après trente secondes est couvert par le test à horloge contrôlée. Un parcours Chromium a également vérifié la classe visuelle du fond vert. Capture : [suivi des bulletins en production](../incident-qr/suivi-bulletins-production.png).

## Verrouillage sur le premier téléphone

Le premier navigateur qui ouvre un QR revendique désormais le bulletin pour toute la séance. Le serveur ne conserve que l'empreinte SHA-256 d'une clé aléatoire stockée localement par le navigateur. Le même téléphone peut relire le lien et suivre toutes les résolutions ; un autre téléphone reçoit une réponse 423, et un même appareil ne peut pas récupérer deux bulletins de la séance.

L'administrateur dispose de « Libérer », qui conserve le QR mais retire son téléphone détenteur, et de « Nouveau QR », qui révoque immédiatement l'ancien lien puis génère un nouveau jeton. La clôture de la séance continue de supprimer tous ses liens. Sur une base isolée, le scénario HTTP a vérifié 14 résultats : absence d'identifiant refusée, premier et second accès du même téléphone acceptés, autre téléphone et second bulletin refusés, déblocage, transfert, révocation, ancien lien en 410, nouveau lien accepté et zéro suffrage modifié.

Après déploiement, un contrôle réversible sur la base de travail a confirmé premier téléphone 200, même téléphone 200, autre téléphone 423, verrouillage visible puis déblocage, avec 13 liens et zéro vote avant comme après. Chromium a contrôlé la vraie page mobile, le fond rouge et les commandes « Libérer » et « Nouveau QR » ; le lien témoin a été libéré en fin de scénario. Captures : [base isolée](../incident-qr/verrouillage-bulletin.png) et [production](../incident-qr/verrouillage-bulletin-production.png).

## Vérifications finales

| Vérification | Résultat |
| --- | --- |
| Tests Vitest | **123 / 123 réussis**, dans 8 fichiers ; 68 tests initiaux et 55 ajouts |
| Majorités | 496 répartitions non vides, sur les quatre règles du projet, dont égalités et abstentions |
| TypeScript (`npm run lint`) | Réussi |
| Compilation Vite et serveur esbuild | Réussie dans un répertoire temporaire ; `dist/` préservé |
| Parcours navigateur/API | **42 / 42 réussis** : 25 parcours principaux, 11 options complémentaires, 6 contrôles finaux |
| Contenu des PDF téléchargés | **13 / 13 réussis** après extraction avec `pdftotext` |
| Mise en page | Examen visuel du PV, de l’émargement, du texte long et de l’impression ; en-tête d’émargement solidaire des lignes, absence de superposition |

Résultats détaillés : [parcours principaux](browser-results.json), [options complémentaires](secondary-results.json), [contrôles finaux](final-results.json), [contenu PDF](pdf-results.json).

La compilation conserve l’avertissement Vite concernant un paquet principal supérieur à 500 ko. Ce point de taille ne bloque ni la compilation ni les parcours vérifiés.

## Corrections et preuves

| Audit | Correction appliquée | Vérification |
| --- | --- | --- |
| **F01 — Sources des PDF** | Archives, ordre du jour et table utilisent le même snapshot et ses statistiques. Un détail manquant provoque une erreur explicite. Les résultats et l’émargement clôturés restent figés malgré l’évolution du répertoire. | Les trois PDF ont le même contenu, hors heure d’édition ; nom et poids modifiés dans le répertoire exclus de l’ancien PV. |
| **F02 — Quorum archivé** | Stockage du pourcentage réel, distinct du nombre de membres requis. Réparation au démarrage des anciennes métadonnées depuis le pourcentage du snapshot, s’il est disponible. | 50 % reste 50 %, avec deux membres requis sur quatre. Réparation idempotente ; copie archivée inchangée. |
| **F03 — Validité des pouvoirs** | Mandataire obligatoire, distinct, actif, convoqué et présent ; refus des cycles et du troisième mandat. Son départ, son retrait ou sa désactivation invalident les pouvoirs reçus. Les calculs excluent aussi les pouvoirs invalides. | Cas invalides rejetés ; quorum et votes recalculés correctement après départ. |
| **F04 — Synchronisation des pouvoirs** | L’attribution d’un pouvoir reprend immédiatement le bulletin du mandataire, même après son vote. Un changement de présence retire le bulletin devenu invalide. Les modifications sont validées avant les écritures. | Attribution avant/après vote, départ et propagation testés. |
| **F05 — Clôture et conservation** | Serveur : refus de modifier, vider ou supprimer un scrutin clôturé, de supprimer son archive ou sa séance. Interface : commandes correspondantes désactivées ; nouveau vote proposé. Le répertoire peut évoluer sans réécrire les résultats clôturés. | Tests directs et HTTP, conservation des états et snapshots après suppression d’un membre. |
| **F06 — Recevabilité des votes** | Validation commune : scrutin ouvert, choix autorisé, membre actif, convoqué et présent, sans pouvoir donné. Désactivation : liens révoqués. Poids et règles de scrutin contrôlés. | Bulletins d’absents, mandants, non-convoqués et inactifs refusés ; second bulletin mobile refusé. |
| **F07 — Convocations et présence** | Une liste explicitement vide reste vide. L’émargement partagé ne crée pas de non-convoqués dans les autres points. Les changements de collège nettoient les états inéligibles. | Création, changement de séance et de point, collège restreint et modification des convocations. |
| **F08 — Aperçu de clôture** | Prévisualisation des abstentions assimilées à la clôture, distinction entre résultat en attente et quorum non atteint ; résultat définitif recalculé par le serveur. | Un pour et trois abstentions attendues ; données client falsifiées ignorées. |
| **F09 — Réseau partagé** | Quotas indépendants par lien et par type de requête ; lectures des téléphones séparées des dépôts. | 28 téléphones partageant une IP, limites et expiration des quotas. |
| **F10 — Qualité des PDF** | Pagination des textes et tableaux, poids personnels, mandats, absents, seuil du quorum en membres, heure de clôture en heure de Paris, résultat lisible et signatures. Mention de certification SQLite retirée. | 120 paragraphes sur 120, 80 membres sur 80, trois voix personnelles, quatre voix pour, quorum non atteint, scrutin secret provisoire. |
| **F11 — Impression** | Isolation du document, retrait des fonds et commandes de l’application, contenu défilant entièrement imprimable et notifications exclues. Heure de Paris explicitée. | PDF Chromium, avec notification témoin injectée hors document ; examen visuel. |
| **F12 — CSV** | Téléchargement via Blob UTF-8 avec BOM, échappement des cellules et conservation des caractères spéciaux et sauts de ligne. | Référence contenant `#`, titre avec guillemets et retour à la ligne ; export réel téléchargé. |
| **F13 — Cohérence des options** | États par défaut harmonisés ; ouverture mémorisée pour distinguer suspension et point jamais soumis ; formulaire d’un autre point alimenté par sa propre convocation ; simulations limitées aux présents convoqués ; mandants suivant le mandataire ; poids réels affichés sur les postes de vote. | Édition à 2 convoqués sur 4, simulation avec mandat, vote mobile à quatre voix, refus de classer un scrutin suspendu sans suite. |

## Documents témoins

Tous utilisent des identités fictives.

- [PV corrigé](pv-corrige.pdf) : quorum de 50 %, un pour, trois abstentions, résultat rejeté et feuille d’émargement.
- [Export depuis la table après modification du répertoire](ui-table-figee.pdf), à comparer aux exports [Archives](ui-archive.pdf) et [ordre du jour](ui-raccourci.pdf).
- [Texte long intégral](Proces_Verbal_AUDIT-TEXTE-LONG_2026-09-10.pdf).
- [Émargement de 80 membres](pdf-80-membres.pdf).
- [Voix pondérées et quorum non atteint](pdf-poids.pdf).
- [Impression corrigée](impression-finale.pdf), [aperçu visuel](impression-corrigee.png).
- [Affichage mobile des quatre voix](mobile-poids.png).

La fixture volontairement mal construite « AUDIT-RACCOURCI » de l’ancien audit reste dans le dossier parent. Elle ne représente plus le parcours de production corrigé ; les comparaisons portent sur les fichiers réellement téléchargés par les boutons de l’application.

## Reproduction

Les tests Vitest créent leurs propres bases temporaires :

```bash
npm run lint
npm test
```

Pour les parcours HTTP, démarrer une instance dédiée avec une **nouvelle base temporaire**, sur le port 3187 et avec le code fictif 739162. Ne pas exécuter ces scripts contre une instance de travail : ils créent, modifient et suppriment leurs données de démonstration.

```bash
MEDIVOTE_DATA_DIR=$(mktemp -d /tmp/medivote-corrections-http-XXXXXX) \
MEDIVOTE_ADMIN_PIN=739162 MEDIVOTE_HOST=127.0.0.1 PORT=3187 npm run dev
```

Puis, depuis un autre terminal dans le projet :

```bash
node audit/2026-09-10/corrections/browser.mjs
node audit/2026-09-10/corrections/secondary.mjs
node audit/2026-09-10/corrections/final-browser.mjs
python3 audit/2026-09-10/corrections/check-pdfs.py
```

Playwright/Chromium et `pdftotext` doivent être disponibles. Les scripts acceptent `PLAYWRIGHT_MODULE` pour désigner le module Playwright de l’environnement. Les tests navigateur ont été réalisés à 1440 × 1000 et les parcours mobiles à 390 × 844.

## Portée et état de livraison

Les corrections sont présentes dans les sources locales et déployées par le service systemd `medivote`. La base de production a été sauvegardée avant le suivi des bulletins, puis avant le verrouillage des téléphones dans `/var/lib/medivote/sauvegardes/medivote_2026-09-11T02-57Z_avant-verrouillage-telephone.sqlite`.

Les règles de majorité, quorum et abstention sont celles documentées par le projet ; elles n’ont pas été remplacées par une interprétation juridique. Le mode actuellement nommé « secret » masque les choix jusqu’à la clôture, puis le détail nominatif devient lisible, comme indiqué par l’application.

Les contrôles ne remplacent pas une répétition sur le réseau réel de la salle : matériel des téléphones, scan optique des QR codes, imprimante et restitution sonore physique restent à vérifier sur place. L’expiration réelle d’une session administrateur après sept jours n’a pas été attendue. Aucune certification cryptographique des archives n’est revendiquée.
