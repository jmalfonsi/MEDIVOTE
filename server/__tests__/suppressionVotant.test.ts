import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

/*
 * Retirer un membre du répertoire.
 *
 * Supprimer quelqu'un ne se limite pas à sa ligne dans `voters` : il figure
 * aussi dans les collèges, dans les convocations de chaque séance et de chacun
 * de ses votes, dans les émargements, et il détient un lien de vote nominatif.
 * Tout cela doit tomber avec lui — sauf les procès-verbaux déjà archivés, qui
 * portent leur propre copie des votants et font foi.
 */
const DOSSIER = fs.mkdtempSync(path.join(os.tmpdir(), 'medivote-suppression-'));
process.env.MEDIVOTE_DATA_DIR = DOSSIER;

const db = await import('../db');

let membres: string[];
let seanceId: string;
let resolutionId: string;

beforeEach(async () => {
  await db.initDatabase();
  await db.resetToDemoData();
  membres = db.getAllVoters().slice(0, 4).map(v => v.id);

  const resolution = db.createOrUpdateSession({
    referenceCode: 'CA-TEST/R1',
    title: 'Approbation des comptes',
    motionText: 'Texte soumis au vote.',
    scheduledDate: '2026-09-09',
    scheduledTime: '14:30',
    location: 'Salle du conseil',
    majorityRequired: 'simple',
    quorumPct: 0,
    attendeeIds: membres,
  } as any);
  resolutionId = resolution.id;
  seanceId = db.seanceDeResolution(resolutionId)!;
  db.basculerSeance(seanceId);
});

afterAll(() => {
  fs.rmSync(DOSSIER, { recursive: true, force: true });
});

describe('suppression d\'un votant', () => {
  it('le retire du répertoire et des collèges', () => {
    const partant = membres[0];
    const college = db.saveVoterList({
      name: 'Collège de test',
      code: 'TEST',
      voterIds: membres,
    });

    db.deleteVoter(partant);

    expect(db.getAllVoters().find(v => v.id === partant)).toBeUndefined();
    const relu = db.getAllVoterLists().find(l => l.id === college.id)!;
    expect(relu.voterIds).not.toContain(partant);
    expect(relu.voterIds).toHaveLength(membres.length - 1);
  });

  it('le retire des convocations de la séance et de ses votes', () => {
    const partant = membres[0];

    db.deleteVoter(partant);

    expect(db.getSeanceById(seanceId)!.selectedAttendeeIds).not.toContain(partant);
    const resolution = db.getSessionById(resolutionId)!;
    expect(resolution.selectedAttendeeIds).not.toContain(partant);
    expect(resolution.voterStates[partant]).toBeUndefined();
  });

  it('révoque son lien de vote nominatif', () => {
    const partant = membres[0];
    const lien = db.jetonVotePour(seanceId, partant, 12);

    expect(db.lireJetonVote(lien.jeton)).not.toBeNull();
    db.deleteVoter(partant);
    expect(db.lireJetonVote(lien.jeton)).toBeNull();
  });

  it('rend absent le mandant qui lui avait donné pouvoir', () => {
    const [mandataire, mandant] = membres;
    db.updateVoterPresence(resolutionId, mandant, 'proxy', mandataire);
    expect(db.getSessionById(resolutionId)!.voterStates[mandant].proxyToId).toBe(mandataire);

    db.deleteVoter(mandataire);

    const etat = db.getSessionById(resolutionId)!.voterStates[mandant];
    expect(etat.proxyToId).toBeFalsy();
    expect(etat.presence).toBe('absent');
  });

  it('ne touche pas aux procès-verbaux déjà archivés', () => {
    const partant = membres[0];
    db.definirOuvertureScrutin(resolutionId, true);
    db.updateVoterVote(resolutionId, partant, 'for');
    const { history } = db.archiveAndCloseSession(resolutionId);

    db.deleteVoter(partant);

    const archive = db.getHistory().find(h => h.id === history.id)!;
    expect(archive.votesFor).toBe(history.votesFor);
    expect(JSON.stringify(archive)).toContain(partant);
  });
});
