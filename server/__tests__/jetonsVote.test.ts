import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

/*
 * Règles du vote par QR code. Ce sont elles qui décident si un bulletin déposé
 * depuis un téléphone entre ou non dans le décompte du procès-verbal : elles
 * méritent d'être vérifiées, pas seulement relues.
 *
 * La base est reconstruite dans un répertoire temporaire à chaque exécution, de
 * sorte que les tests ne touchent jamais les données d'une séance réelle.
 */
const DOSSIER = fs.mkdtempSync(path.join(os.tmpdir(), 'medivote-test-'));
process.env.MEDIVOTE_DATA_DIR = DOSSIER;

const db = await import('../db');

let sessionId: string;
let membres: { id: string; name: string }[];

const SEANCE = {
  referenceCode: 'TEST-QR/1',
  title: 'Résolution de contrôle',
  motionText: 'Texte soumis au vote.',
  scheduledDate: '2026-09-02',
  scheduledTime: '15:00',
  location: 'Salle du conseil',
  majorityRequired: 'simple' as const,
  quorumPct: 0,
};

beforeEach(async () => {
  // Base neuve pour chaque scénario : le fichier est effacé puis recréé.
  await db.initDatabase();
  await db.resetToDemoData();

  membres = db.getAllVoters().slice(0, 4).map(v => ({ id: v.id, name: v.name }));
  const seance = db.createOrUpdateSession({
    ...SEANCE,
    isSecret: false,
    attendeeIds: membres.map(m => m.id),
  });
  sessionId = seance.id;
  membres.forEach(m => db.updateVoterPresence(sessionId, m.id, 'present'));
});

afterAll(() => {
  fs.rmSync(DOSSIER, { recursive: true, force: true });
});

describe('liens de vote nominatifs', () => {
  it('rend le même lien tant qu’il est valable, pour ne pas périmer un QR déjà scanné', () => {
    const premier = db.jetonVotePour(sessionId, membres[0].id);
    const second = db.jetonVotePour(sessionId, membres[0].id);
    expect(second.jeton).toBe(premier.jeton);
  });

  it('donne à chaque membre un lien distinct', () => {
    const a = db.jetonVotePour(sessionId, membres[0].id);
    const b = db.jetonVotePour(sessionId, membres[1].id);
    expect(a.jeton).not.toBe(b.jeton);
  });

  it('refuse un bulletin tant que le scrutin n’est pas ouvert', () => {
    const lien = db.jetonVotePour(sessionId, membres[0].id);
    expect(() => db.voterAvecJeton(lien.jeton, 'for')).toThrow(/pas encore ouvert/i);
  });

  it('enregistre le suffrage une fois le scrutin ouvert', () => {
    db.definirOuvertureScrutin(sessionId, true);
    const lien = db.jetonVotePour(sessionId, membres[0].id);
    const { session } = db.voterAvecJeton(lien.jeton, 'for');
    expect(session.voterStates[membres[0].id].vote).toBe('for');
  });

  it('n’accepte qu’un seul bulletin par lien', () => {
    db.definirOuvertureScrutin(sessionId, true);
    const lien = db.jetonVotePour(sessionId, membres[0].id);
    db.voterAvecJeton(lien.jeton, 'for');
    expect(() => db.voterAvecJeton(lien.jeton, 'against')).toThrow(/une fois/i);
  });

  it('ne modifie pas le suffrage déjà exprimé lors d’une seconde tentative', () => {
    db.definirOuvertureScrutin(sessionId, true);
    const lien = db.jetonVotePour(sessionId, membres[0].id);
    db.voterAvecJeton(lien.jeton, 'for');
    try { db.voterAvecJeton(lien.jeton, 'against'); } catch (_) { /* attendu */ }
    expect(db.getSessionById(sessionId)!.voterStates[membres[0].id].vote).toBe('for');
  });

  it('propage le vote du mandataire aux pouvoirs qu’il détient', () => {
    db.updateVoterPresence(sessionId, membres[1].id, 'proxy', membres[0].id);
    db.updateVoterPresence(sessionId, membres[2].id, 'proxy', membres[0].id);
    db.definirOuvertureScrutin(sessionId, true);

    const lien = db.jetonVotePour(sessionId, membres[0].id);
    const { session, pouvoirs } = db.voterAvecJeton(lien.jeton, 'against');

    expect(pouvoirs).toBe(2);
    expect(session.voterStates[membres[1].id].vote).toBe('against');
    expect(session.voterStates[membres[2].id].vote).toBe('against');
  });

  it('refuse le bulletin d’un membre qui a donné pouvoir', () => {
    db.updateVoterPresence(sessionId, membres[1].id, 'proxy', membres[0].id);
    db.definirOuvertureScrutin(sessionId, true);
    const lien = db.jetonVotePour(sessionId, membres[1].id);
    expect(() => db.voterAvecJeton(lien.jeton, 'for')).toThrow(/pouvoir/i);
  });

  it('refuse le bulletin d’un membre non émargé présent', () => {
    db.updateVoterPresence(sessionId, membres[3].id, 'absent');
    db.definirOuvertureScrutin(sessionId, true);
    const lien = db.jetonVotePour(sessionId, membres[3].id);
    expect(() => db.voterAvecJeton(lien.jeton, 'for')).toThrow(/émargé/i);
  });

  it('rejette un jeton inventé', () => {
    db.definirOuvertureScrutin(sessionId, true);
    expect(() => db.voterAvecJeton('jeton-fabrique-de-toutes-pieces', 'for')).toThrow(/plus valable/i);
  });

  it('périme le lien passé son échéance', () => {
    db.definirOuvertureScrutin(sessionId, true);
    // Même code d'expiration que le lien d'un jour, avec une échéance déjà passée.
    const lien = db.jetonVotePour(sessionId, membres[0].id, -1);
    expect(db.lireJetonVote(lien.jeton)).toBeNull();
    expect(() => db.voterAvecJeton(lien.jeton, 'for')).toThrow(/plus valable/i);
  });

  it('révoque tous les liens à la clôture de la séance', () => {
    db.definirOuvertureScrutin(sessionId, true);
    const lien = db.jetonVotePour(sessionId, membres[0].id);
    db.archiveAndCloseSession(sessionId);
    expect(db.lireJetonVote(lien.jeton)).toBeNull();
  });

  it('rouvre les liens quand les suffrages sont remis à zéro', () => {
    db.definirOuvertureScrutin(sessionId, true);
    const lien = db.jetonVotePour(sessionId, membres[0].id);
    db.voterAvecJeton(lien.jeton, 'for');

    db.resetSessionVotes(sessionId);
    // La remise à zéro referme le scrutin : c'est l'administrateur qui décide
    // d'un nouveau tour, pas la remise à zéro elle-même.
    expect(() => db.voterAvecJeton(lien.jeton, 'against')).toThrow(/pas encore ouvert/i);

    db.definirOuvertureScrutin(sessionId, true);
    expect(() => db.voterAvecJeton(lien.jeton, 'against')).not.toThrow();
    expect(db.getSessionById(sessionId)!.voterStates[membres[0].id].vote).toBe('against');
  });

  it('ne livre au téléphone que ce qui concerne le membre', () => {
    db.updateVoterPresence(sessionId, membres[1].id, 'proxy', membres[0].id);
    const lien = db.jetonVotePour(sessionId, membres[0].id);
    const contexte = db.contexteVotant(lien.jeton)!;

    expect(contexte.votant.name).toBe(membres[0].name);
    expect(contexte.pouvoirs).toHaveLength(1);
    expect(contexte.seance.referenceCode).toBe('TEST-QR/1');
    expect(Object.keys(contexte)).not.toContain('voterStates');
  });

  it('masque le sens du bulletin en scrutin secret', () => {
    db.createOrUpdateSession({ ...SEANCE, id: sessionId, isSecret: true, attendeeIds: membres.map(m => m.id) });
    db.definirOuvertureScrutin(sessionId, true);
    const lien = db.jetonVotePour(sessionId, membres[0].id);
    db.voterAvecJeton(lien.jeton, 'for');

    const contexte = db.contexteVotant(lien.jeton)!;
    expect(contexte.aVote).toBe(true);
    expect(contexte.choix).toBeNull();
  });
});
