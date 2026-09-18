import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

/*
 * Une séance porte plusieurs résolutions.
 *
 * La séance est la réunion : une date, un lieu, un collège convoqué, un
 * émargement. Les résolutions sont les points de l'ordre du jour qu'on y vote,
 * l'un après l'autre, et qu'on peut ajouter en cours de séance. Ces tests
 * fixent ce partage : ce qui appartient à la séance (présence, procurations,
 * liens de vote) et ce qui appartient à chaque résolution (bulletins, quorum
 * retenu, majorité requise, résultat, procès-verbal).
 */
const DOSSIER = fs.mkdtempSync(path.join(os.tmpdir(), 'medivote-seances-'));
process.env.MEDIVOTE_DATA_DIR = DOSSIER;

const db = await import('../db');

let membres: string[];
let seanceId: string;
let r1: string;

beforeEach(async () => {
  await db.initDatabase();
  await db.resetToDemoData();
  membres = db.getAllVoters().slice(0, 4).map(v => v.id);

  const premiere = db.createOrUpdateSession({
    referenceCode: 'CA-TEST/R1',
    title: 'Première résolution',
    motionText: 'Approbation des comptes.',
    scheduledDate: '2026-09-08',
    scheduledTime: '14:30',
    location: 'Salle du conseil',
    majorityRequired: 'simple',
    quorumPct: 0,
    attendeeIds: membres,
  } as any);
  r1 = premiere.id;
  seanceId = premiere.seanceId;
});

afterAll(() => {
  fs.rmSync(DOSSIER, { recursive: true, force: true });
});

describe('séance et résolutions', () => {
  it('crée une séance en même temps que sa première résolution', () => {
    expect(seanceId).toBeTruthy();
    const seance = db.getSeanceById(seanceId)!;
    expect(seance.resolutions).toHaveLength(1);
    expect(seance.resolutions[0].id).toBe(r1);
    expect(seance.resolutionCouranteId).toBe(r1);
  });

  it('ajoute une résolution à une séance déjà commencée', () => {
    db.definirOuvertureScrutin(r1, true);
    db.updateVoterVote(r1, membres[0], 'for');

    const r2 = db.ajouterResolution(seanceId, {
      title: 'Deuxième résolution',
      motionText: 'Renouvellement du bureau.',
      majorityRequired: 'two_thirds',
    });

    expect(r2.seanceId).toBe(seanceId);
    expect(r2.ordre).toBe(2);
    // Une résolution naît toujours fermée au vote, même ajoutée en pleine séance.
    expect(r2.status).toBe('draft');
    expect(r2.majorityRequired).toBe('two_thirds');
    // Le suffrage déjà exprimé sur la première n'est pas touché.
    expect(db.getSessionById(r1)!.voterStates[membres[0]].vote).toBe('for');
    expect(db.getSeanceById(seanceId)!.resolutions).toHaveLength(2);
  });

  it('présente la résolution ajoutée sur la table', () => {
    const r2 = db.ajouterResolution(seanceId, { title: 'Deuxième résolution' });
    expect(db.getActiveSession()!.id).toBe(r2.id);
    db.basculerResolution(r1);
    expect(db.getActiveSession()!.id).toBe(r1);
  });

  it('reprend l’émargement de la séance sur une résolution ajoutée', () => {
    db.updateVoterPresence(r1, membres[1], 'absent');
    db.updateVoterPresence(r1, membres[2], 'proxy', membres[0]);

    const r2 = db.ajouterResolution(seanceId, { title: 'Deuxième résolution' });
    const etats = db.getSessionById(r2.id)!.voterStates;

    expect(etats[membres[1]].presence).toBe('absent');
    expect(etats[membres[2]].presence).toBe('proxy');
    expect(etats[membres[2]].proxyToId).toBe(membres[0]);
    // L'émargement se reprend, jamais les bulletins.
    expect(etats[membres[0]].vote).toBe('pending');
  });

  it('émarge une fois pour toute la séance', () => {
    const r2 = db.ajouterResolution(seanceId, { title: 'Deuxième résolution' });
    db.updateVoterPresence(r1, membres[3], 'excused');

    expect(db.getSessionById(r2.id)!.voterStates[membres[3]].presence).toBe('excused');
    expect(db.getSessionById(r1)!.voterStates[membres[3]].presence).toBe('excused');
  });

  it('n’étend pas un émargement tardif à une résolution déjà clôturée', () => {
    db.definirOuvertureScrutin(r1, true);
    db.archiveAndCloseSession(r1);
    const r2 = db.ajouterResolution(seanceId, { title: 'Deuxième résolution' });

    db.updateVoterPresence(r2.id, membres[1], 'absent');

    // Le PV de la première résolution garde la présence constatée à sa clôture.
    expect(db.getSessionById(r1)!.voterStates[membres[1]].presence).toBe('present');
    expect(db.getSessionById(r2.id)!.voterStates[membres[1]].presence).toBe('absent');
  });

  it('ouvre et clôture les résolutions une par une', () => {
    const r2 = db.ajouterResolution(seanceId, { title: 'Deuxième résolution' });

    db.definirOuvertureScrutin(r1, true);
    expect(db.getSessionById(r2.id)!.status).toBe('draft');
    expect(() => db.updateVoterVote(r2.id, membres[0], 'for')).toThrow(/pas ouvert/i);

    db.updateVoterVote(r1, membres[0], 'for');
    db.archiveAndCloseSession(r1);

    expect(db.getSessionById(r1)!.status).toBe('closed');
    expect(db.getSessionById(r2.id)!.status).toBe('draft');
    expect(db.getSeanceById(seanceId)!.closedAt).toBeNull();
  });

  it('reste sur la résolution clôturée pour en montrer le résultat', () => {
    db.ajouterResolution(seanceId, { title: 'Deuxième résolution' });
    db.basculerResolution(r1);
    db.definirOuvertureScrutin(r1, true);
    db.updateVoterVote(r1, membres[0], 'for');
    db.archiveAndCloseSession(r1);

    const affichee = db.getActiveSession()!;
    expect(affichee.id).toBe(r1);
    expect(affichee.status).toBe('closed');
  });

  it('archive un procès-verbal par résolution', () => {
    const r2 = db.ajouterResolution(seanceId, { title: 'Deuxième résolution' });
    db.definirOuvertureScrutin(r1, true);
    db.updateVoterVote(r1, membres[0], 'for');
    db.archiveAndCloseSession(r1);
    db.definirOuvertureScrutin(r2.id, true);
    db.updateVoterVote(r2.id, membres[0], 'against');
    db.archiveAndCloseSession(r2.id);

    const pv = db.getHistory().filter(h => [r1, r2.id].includes(h.sessionId));
    expect(pv).toHaveLength(2);
    expect(pv.map(h => h.title).sort()).toEqual(['Deuxième résolution', 'Première résolution']);
  });

  /*
   * « Sur la table » est un état à part : c'est la séance que l'écran de la
   * salle présente. Il ne se confond ni avec « ouverte », ni avec « la plus
   * récente ». Quand plus rien n'est ouvrable, la table est vide — la présenter
   * autrement ferait croire qu'une séance close siège encore.
   */
  it('laisse la table vide quand toutes les séances sont closes', () => {
    db.getAllSeances().filter(se => !se.closedAt).forEach(se => db.cloturerSeance(se.id));

    expect(db.getSeanceActive()).toBeNull();
    expect(db.getActiveSession()).toBeNull();
    expect(db.getAllSeances().some(se => se.surLaTable)).toBe(false);
    expect(db.getAllSeances().length).toBeGreaterThan(0);
  });

  it('passe la table à une séance encore ouvrable quand celle qui y siège se clôt', () => {
    db.getAllSeances().filter(se => !se.closedAt && se.id !== seanceId)
      .forEach(se => db.cloturerSeance(se.id));

    const suivante = db.createOrUpdateSession({
      referenceCode: 'CA-TEST-2/R1',
      title: 'Séance suivante',
      scheduledDate: '2026-09-15',
      scheduledTime: '09:00',
      location: 'Salle du conseil',
      majorityRequired: 'simple',
      quorumPct: 0,
      attendeeIds: membres,
    } as any);

    db.basculerSeance(seanceId);
    expect(db.getSeanceActive()!.id).toBe(seanceId);

    db.cloturerSeance(seanceId);
    expect(db.getSeanceActive()!.id).toBe(suivante.seanceId);
    expect(db.getSeanceById(seanceId)!.surLaTable).toBe(false);
  });

  it('refuse de remettre une séance close sur la table', () => {
    db.cloturerSeance(seanceId);
    expect(() => db.basculerSeance(seanceId)).toThrow(/clôturée/i);
  });

  /*
   * Corriger un vote — son texte, ses convoqués — doit se voir partout du même
   * coup. L'ordre du jour de l'administration lit `seance.resolutions` : tant
   * que l'émargement gardait les membres retirés de la convocation, il
   * annonçait l'ancien effectif pendant que la table comptait le nouveau.
   */
  it('répercute la correction d’un vote sur l’ordre du jour de la séance', () => {
    db.updateVoterPresence(r1, membres[2], 'proxy', membres[3]);

    db.createOrUpdateSession({
      id: r1,
      title: 'Première résolution corrigée',
      motionText: 'Texte révisé.',
      attendeeIds: membres.slice(0, 3),
    } as any);

    const vote = db.getSeanceById(seanceId)!.resolutions.find(r => r.id === r1)!;
    expect(vote.title).toBe('Première résolution corrigée');
    expect(vote.motionText).toBe('Texte révisé.');
    expect(vote.attendeesCount).toBe(3);

    const etats = db.getSessionById(r1)!.voterStates;
    expect(Object.keys(etats).sort()).toEqual(membres.slice(0, 3).sort());
    // Le pouvoir donné à un membre qui n'est plus convoqué n'a plus d'objet.
    expect(etats[membres[2]].presence).toBe('absent');
    expect(etats[membres[2]].proxyToId).toBeFalsy();
  });

  it('ne retouche jamais l’émargement d’un scrutin clôturé', () => {
    db.definirOuvertureScrutin(r1, true);
    db.updateVoterVote(r1, membres[0], 'for');
    db.archiveAndCloseSession(r1);

    expect(() => db.createOrUpdateSession({ id: r1, title: 'Première résolution', attendeeIds: [membres[0]] } as any)).toThrow(/scellée/);

    const etats = db.getSessionById(r1)!.voterStates;
    expect(Object.keys(etats)).toHaveLength(membres.length);
    expect(etats[membres[0]].vote).toBe('for');
  });

  it('refuse de clore une séance dont un scrutin est encore ouvert', () => {
    db.definirOuvertureScrutin(r1, true);
    expect(() => db.cloturerSeance(seanceId)).toThrow(/encore ouverte/i);
  });

  it('classe sans suite les résolutions jamais soumises au vote', () => {
    const r2 = db.ajouterResolution(seanceId, { title: 'Point retiré de l’ordre du jour' });
    db.cloturerSeance(seanceId);

    expect(db.getSeanceById(seanceId)!.closedAt).toBeTruthy();
    expect(db.getSessionById(r2.id)!.status).toBe('closed');
    expect(db.getSessionById(r2.id)!.outcome).toBe('pending');
  });

  it('refuse d’ajouter une résolution à une séance clôturée', () => {
    db.cloturerSeance(seanceId);
    expect(() => db.ajouterResolution(seanceId, { title: 'Trop tard' })).toThrow(/clôturée/i);
  });

  it('supprime la séance avec sa dernière résolution', () => {
    const r2 = db.ajouterResolution(seanceId, { title: 'Deuxième résolution' });
    db.deleteMeeting(r2.id);
    expect(db.getSeanceById(seanceId)!.resolutions).toHaveLength(1);
    db.deleteMeeting(r1);
    expect(db.getSeanceById(seanceId)).toBeNull();
  });

  it('donne un seul lien de vote par membre pour toute la séance', () => {
    const r2 = db.ajouterResolution(seanceId, { title: 'Deuxième résolution' });
    const surR1 = db.jetonVotePour(r1, membres[0]);
    const surR2 = db.jetonVotePour(r2.id, membres[0]);
    expect(surR2.jeton).toBe(surR1.jeton);
  });

  it('fait suivre au téléphone la résolution ouverte du moment', () => {
    const r2 = db.ajouterResolution(seanceId, { title: 'Deuxième résolution' });
    const lien = db.jetonVotePour(seanceId, membres[0]);

    db.definirOuvertureScrutin(r1, true);
    expect(db.contexteVotant(lien.jeton)!.resolution.id).toBe(r1);
    db.voterAvecJeton(lien.jeton, 'for');
    expect(db.contexteVotant(lien.jeton)!.aVote).toBe(true);

    db.definirOuvertureScrutin(r1, false);
    db.definirOuvertureScrutin(r2.id, true);

    const apres = db.contexteVotant(lien.jeton)!;
    expect(apres.resolution.id).toBe(r2.id);
    // Nouveau point de l'ordre du jour : le membre a de nouveau un bulletin à déposer.
    expect(apres.aVote).toBe(false);
  });
});
