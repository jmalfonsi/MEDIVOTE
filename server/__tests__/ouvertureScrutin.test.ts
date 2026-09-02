import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

/*
 * Un scrutin ne s'ouvre jamais tout seul.
 *
 * L'heure programmée d'une séance est un repère affiché, pas un déclencheur :
 * seule une ouverture explicite par l'administrateur rend les bulletins
 * recevables. Ces tests interdisent à tous les autres chemins — création,
 * modification de l'ordre du jour, duplication, changement de séance active,
 * remise à zéro — d'ouvrir un scrutin par effet de bord.
 */
const DOSSIER = fs.mkdtempSync(path.join(os.tmpdir(), 'medivote-ouverture-'));
process.env.MEDIVOTE_DATA_DIR = DOSSIER;

const db = await import('../db');

const SEANCE = {
  referenceCode: 'TEST-OUV/1',
  title: 'Résolution de contrôle',
  motionText: 'Texte soumis au vote.',
  scheduledDate: '2020-01-01', // heure largement dépassée
  scheduledTime: '08:00',
  location: 'Salle du conseil',
  majorityRequired: 'simple' as const,
  quorumPct: 0,
};

let membres: string[];

beforeEach(async () => {
  await db.initDatabase();
  await db.resetToDemoData();
  membres = db.getAllVoters().slice(0, 3).map(v => v.id);
});

afterAll(() => {
  fs.rmSync(DOSSIER, { recursive: true, force: true });
});

function creer(extra: Record<string, unknown> = {}) {
  return db.createOrUpdateSession({ ...SEANCE, attendeeIds: membres, ...extra } as any);
}

describe('ouverture du scrutin', () => {
  it('crée toute séance avec un scrutin fermé', () => {
    expect(creer().status).toBe('draft');
  });

  it('ignore un statut « ouvert » transmis à la création', () => {
    expect(creer({ status: 'open' }).status).toBe('draft');
  });

  it('n’ouvre pas une séance dont l’heure est passée', () => {
    // La séance était prévue le 01/01/2020 à 08:00 : largement dépassée.
    const seance = creer();
    expect(seance.status).toBe('draft');
    expect(() => db.updateVoterVote(seance.id, membres[0], 'for')).toThrow(/pas ouvert/i);
  });

  it('n’ouvre le scrutin que sur geste explicite', () => {
    const seance = creer();
    expect(db.definirOuvertureScrutin(seance.id, true)!.status).toBe('open');
    expect(db.getSessionById(seance.id)!.voterStates[membres[0]].vote).toBe('pending');
  });

  it('ne referme pas un scrutin ouvert quand on corrige l’ordre du jour', () => {
    const seance = creer();
    db.definirOuvertureScrutin(seance.id, true);
    const modifiee = db.createOrUpdateSession({
      ...SEANCE,
      id: seance.id,
      title: 'Intitulé corrigé en séance',
      attendeeIds: membres,
    } as any);
    expect(modifiee.status).toBe('open');
    expect(modifiee.title).toBe('Intitulé corrigé en séance');
  });

  it('n’ouvre pas un scrutin fermé quand on enregistre l’ordre du jour', () => {
    const seance = creer();
    db.createOrUpdateSession({ ...SEANCE, id: seance.id, status: 'open', attendeeIds: membres } as any);
    expect(db.getSessionById(seance.id)!.status).toBe('draft');
  });

  it('crée une copie de séance avec un scrutin fermé', () => {
    const seance = creer();
    db.definirOuvertureScrutin(seance.id, true);
    expect(db.duplicateMeeting(seance.id).status).toBe('draft');
  });

  it('n’ouvre pas le scrutin en rendant une séance active', () => {
    const premiere = creer();
    const seconde = creer({ referenceCode: 'TEST-OUV/2' });
    db.switchActiveMeeting(premiere.id);
    expect(db.getSessionById(premiere.id)!.status).toBe('draft');
    expect(db.getSessionById(seconde.id)!.status).toBe('draft');
  });

  it('referme le scrutin après une remise à zéro des suffrages', () => {
    const seance = creer();
    db.definirOuvertureScrutin(seance.id, true);
    db.updateVoterVote(seance.id, membres[0], 'for');

    db.resetSessionVotes(seance.id);

    const apres = db.getSessionById(seance.id)!;
    expect(apres.status).toBe('draft');
    expect(apres.voterStates[membres[0]].vote).toBe('pending');
    expect(() => db.updateVoterVote(seance.id, membres[0], 'for')).toThrow(/pas ouvert/i);
  });

  it('refuse de rouvrir une séance clôturée', () => {
    const seance = creer();
    db.definirOuvertureScrutin(seance.id, true);
    db.archiveAndCloseSession(seance.id);
    expect(() => db.definirOuvertureScrutin(seance.id, true)).toThrow(/clôturée/i);
  });

  it('suspend le scrutin sans effacer les suffrages déjà exprimés', () => {
    const seance = creer();
    db.definirOuvertureScrutin(seance.id, true);
    db.updateVoterVote(seance.id, membres[0], 'for');

    const suspendue = db.definirOuvertureScrutin(seance.id, false)!;
    expect(suspendue.status).toBe('draft');
    expect(suspendue.voterStates[membres[0]].vote).toBe('for');
    expect(() => db.updateVoterVote(seance.id, membres[1], 'against')).toThrow(/pas ouvert/i);
  });
});

describe('suppression de séance', () => {
  it('supprime une séance même s’il ne reste que des séances clôturées', () => {
    const close = creer({ referenceCode: 'TEST-OUV/CLOSE' });
    db.definirOuvertureScrutin(close.id, true);
    db.archiveAndCloseSession(close.id);

    const aSupprimer = creer({ referenceCode: 'TEST-OUV/JETABLE' });

    // Avant correction, la désignation d'une remplaçante tentait de réactiver la
    // séance clôturée, échouait, et laissait la suppression non enregistrée.
    expect(() => db.deleteMeeting(aSupprimer.id)).not.toThrow();
    expect(db.getSessionById(aSupprimer.id)).toBeNull();
    expect(db.getAllMeetings().map(m => m.referenceCode)).not.toContain('TEST-OUV/JETABLE');
  });

  it('désigne une séance encore ouvrable comme séance affichée', () => {
    const close = creer({ referenceCode: 'TEST-OUV/CLOSE2' });
    db.definirOuvertureScrutin(close.id, true);
    db.archiveAndCloseSession(close.id);

    const survivante = creer({ referenceCode: 'TEST-OUV/SUITE' });
    const active = creer({ referenceCode: 'TEST-OUV/ACTIVE' });
    db.switchActiveMeeting(active.id);
    db.deleteMeeting(active.id);

    expect(db.getActiveSession()!.referenceCode).toBe('TEST-OUV/SUITE');
    expect(db.getSessionById(survivante.id)!.status).toBe('draft');
  });

  it('efface les liens de vote de la séance supprimée', () => {
    const seance = creer({ referenceCode: 'TEST-OUV/LIENS' });
    const lien = db.jetonVotePour(seance.id, membres[0]);
    db.deleteMeeting(seance.id);
    expect(db.lireJetonVote(lien.jeton)).toBeNull();
  });
});
