import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
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

  it('garde le lien vivant d’une résolution à la suivante', () => {
    // Le lien vaut pour la séance : clôturer un point de l'ordre du jour ne doit
    // pas obliger les membres à rescanner leur QR code pour le point suivant.
    const lien = db.jetonVotePour(sessionId, membres[0].id);
    db.definirOuvertureScrutin(sessionId, true);
    db.voterAvecJeton(lien.jeton, 'for');
    db.archiveAndCloseSession(sessionId);

    expect(db.lireJetonVote(lien.jeton)).not.toBeNull();

    const seanceId = db.seanceDeResolution(sessionId)!;
    const suivante = db.ajouterResolution(seanceId, {
      title: 'Deuxième résolution',
      motionText: 'Suite de l’ordre du jour.',
    });
    db.definirOuvertureScrutin(suivante.id, true);

    expect(() => db.voterAvecJeton(lien.jeton, 'against')).not.toThrow();
    expect(db.getSessionById(suivante.id)!.voterStates[membres[0].id].vote).toBe('against');
  });

  it('révoque tous les liens à la clôture de la séance', () => {
    db.definirOuvertureScrutin(sessionId, true);
    const lien = db.jetonVotePour(sessionId, membres[0].id);
    db.archiveAndCloseSession(sessionId);
    db.cloturerSeance(db.seanceDeResolution(sessionId)!);
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

  it('suit un bulletin mobile sans modifier le vote', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const debut = Date.now();
      const lien = db.jetonVotePour(sessionId, membres[0].id);
      const etat = () => db.etatsJetonsVote(sessionId).find(e => e.voterId === membres[0].id)!;
      expect(etat().etatBulletin).toBe('attente');

      db.marquerActiviteJetonVote(lien.jeton);
      expect(etat().etatBulletin).toBe('actif');
      expect(db.getSessionById(sessionId)!.voterStates[membres[0].id].vote).toBe('pending');

      vi.setSystemTime(debut + 500);
      db.marquerErreurJetonVote(lien.jeton, 'Bulletin refusé');
      expect(etat()).toMatchObject({
        etatBulletin: 'erreur',
        erreurBulletin: 'Bulletin refusé',
      });

      vi.setSystemTime(debut + 1000);
      db.marquerActiviteJetonVote(lien.jeton);
      expect(etat().etatBulletin).toBe('erreur');

      vi.setSystemTime(debut + (db.SECONDES_AFFICHAGE_ERREUR_BULLETIN + 2) * 1000);
      db.marquerActiviteJetonVote(lien.jeton);
      expect(etat().etatBulletin).toBe('actif');

      vi.setSystemTime(
        debut + (db.SECONDES_AFFICHAGE_ERREUR_BULLETIN + db.SECONDES_ACTIVITE_BULLETIN + 4) * 1000
      );
      expect(etat().etatBulletin).toBe('attente');
    } finally { vi.useRealTimers(); }
  });
});


describe('QR et changement de pouvoirs pendant une séance', () => {
  it('conserve tous les liens après attribution et retrait d’un pouvoir', () => {
    const links = membres.map(m => db.jetonVotePour(sessionId, m.id));
    db.definirOuvertureScrutin(sessionId, true);
    db.voterAvecJeton(links[0].jeton, 'for');
    db.updateVoterPresence(sessionId, membres[1].id, 'proxy', membres[0].id);
    expect(db.getSessionById(sessionId)!.voterStates[membres[1].id].vote).toBe('for');
    expect(db.contexteVotant(links[0].jeton)!.pouvoirs).toHaveLength(1);
    db.updateVoterPresence(sessionId, membres[1].id, 'present');
    for (let i=0; i<links.length; i++) {
      expect(db.jetonVotePour(sessionId, membres[i].id).jeton).toBe(links[i].jeton);
      expect(db.contexteVotant(links[i].jeton)).not.toBeNull();
    }
  });

  it('prolonge le même QR tant que l’écran de séance le distribue', () => {
    vi.useFakeTimers({toFake:['Date']});
    try {
      const now=Date.now();
      const first=db.jetonVotePour(sessionId,membres[0].id);
      vi.setSystemTime(now+23*3600*1000);
      const kept=db.jetonVotePour(sessionId,membres[0].id);
      expect(kept.jeton).toBe(first.jeton);
      expect(new Date(kept.expireLe).getTime()).toBeGreaterThan(new Date(first.expireLe).getTime());
      vi.setSystemTime(now+25*3600*1000);
      expect(db.contexteVotant(first.jeton)).not.toBeNull();
    } finally { vi.useRealTimers(); }
  });

  it('renouvelle les liens expirés sans modifier les pouvoirs ni les votes déjà déposés', () => {
    vi.useFakeTimers({toFake:['Date']});
    try {
      const now=Date.now();
      const links=membres.map(m=>db.jetonVotePour(sessionId,m.id));
      db.updateVoterPresence(sessionId,membres[1].id,'proxy',membres[0].id);
      db.definirOuvertureScrutin(sessionId,true);
      db.voterAvecJeton(links[0].jeton,'for');
      const before=db.getSessionById(sessionId);
      vi.setSystemTime(now+25*3600*1000);
      for(let i=0;i<links.length;i++) {
        expect(db.contexteVotant(links[i].jeton)).toBeNull();
        const renewed=db.jetonVotePour(sessionId,membres[i].id);
        expect(renewed.jeton).not.toBe(links[i].jeton);
        expect(db.contexteVotant(renewed.jeton)).not.toBeNull();
        if(i===0) expect(()=>db.voterAvecJeton(renewed.jeton,'against')).toThrow(/une fois/);
      }
      expect(db.getSessionById(sessionId)).toEqual(before);
    } finally { vi.useRealTimers(); }
  });
});

describe('verrouillage d’un bulletin sur le premier téléphone', () => {
  const TELEPHONE_A = 'appareil-a-123456789012345678901234';
  const TELEPHONE_B = 'appareil-b-123456789012345678901234';

  it('accepte le premier téléphone et refuse tous les autres', () => {
    const lien = db.jetonVotePour(sessionId, membres[0].id);

    expect(() => db.revendiquerJetonVote(lien.jeton, TELEPHONE_A)).not.toThrow();
    expect(() => db.revendiquerJetonVote(lien.jeton, TELEPHONE_A)).not.toThrow();
    expect(() => db.revendiquerJetonVote(lien.jeton, TELEPHONE_B)).toThrow(/récupéré sur un autre/i);
  });

  it('empêche un téléphone de récupérer deux bulletins de la même séance', () => {
    const premier = db.jetonVotePour(sessionId, membres[0].id);
    const second = db.jetonVotePour(sessionId, membres[1].id);

    db.revendiquerJetonVote(premier.jeton, TELEPHONE_A);

    expect(() => db.revendiquerJetonVote(second.jeton, TELEPHONE_A)).toThrow(/autre bulletin/i);
  });

  it('conserve le même téléphone pour toute la séance et ses résolutions', () => {
    const lien = db.jetonVotePour(sessionId, membres[0].id);
    db.revendiquerJetonVote(lien.jeton, TELEPHONE_A);
    const seanceId = db.seanceDeResolution(sessionId)!;
    const suivante = db.ajouterResolution(seanceId, {
      title: 'Résolution suivante',
      motionText: 'Le même bulletin continue.',
    });
    db.basculerResolution(suivante.id);

    expect(db.jetonVotePour(suivante.id, membres[0].id).jeton).toBe(lien.jeton);
    expect(() => db.revendiquerJetonVote(lien.jeton, TELEPHONE_A)).not.toThrow();
    expect(() => db.revendiquerJetonVote(lien.jeton, TELEPHONE_B)).toThrow(/récupéré sur un autre/i);
  });

  it('permet à l’administrateur de libérer le même lien pour un nouveau téléphone', () => {
    const lien = db.jetonVotePour(sessionId, membres[0].id);
    db.revendiquerJetonVote(lien.jeton, TELEPHONE_A);

    db.deverrouillerJetonVote(sessionId, membres[0].id);

    expect(() => db.revendiquerJetonVote(lien.jeton, TELEPHONE_B)).not.toThrow();
    expect(db.etatsJetonsVote(sessionId).find(e => e.voterId === membres[0].id)?.verrouille).toBe(true);
  });

  it('révoque l’ancien lien et génère un nouveau QR sans toucher aux suffrages', () => {
    const ancien = db.jetonVotePour(sessionId, membres[0].id);
    db.revendiquerJetonVote(ancien.jeton, TELEPHONE_A);
    const avant = db.getSessionById(sessionId);

    const nouveau = db.renouvelerJetonVote(sessionId, membres[0].id);

    expect(nouveau.jeton).not.toBe(ancien.jeton);
    expect(db.lireJetonVote(ancien.jeton)).toBeNull();
    expect(() => db.revendiquerJetonVote(nouveau.jeton, TELEPHONE_B)).not.toThrow();
    expect(db.getSessionById(sessionId)).toEqual(avant);
  });
});
