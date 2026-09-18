import { createVoteRateLimiter } from './server/voteRateLimit';
import express, { Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  initDatabase,
  getAllVoters,
  saveVoter,
  deleteVoter,
  getAllVoterLists,
  saveVoterList,
  deleteVoterList,
  applyVoterListToSession,
  importVotersFromText,
  getActiveSession,
  createOrUpdateSession,
  updateVoterVote,
  updateVoterPresence,
  resetSessionVotes,
  archiveAndCloseSession,
  getHistory,
  deleteHistoryItem,
  getAllMeetings,
  switchActiveMeeting,
  deleteMeeting,
  duplicateMeeting,
  logEvent,
  getRecentEvents,
  clearEvents,
  resetToDemoData,
  getSessionById,
  sauvegarderBase,
  definirOuvertureScrutin,
  getAllTemplates,
  saveTemplate,
  deleteTemplate,
  enregistrerAppareil,
  verifierAppareil,
  oublierAppareil,
  purgerAppareilsExpires,
  jetonVotePour,
  contexteVotant,
  getAllSeances,
  getSeanceActive,
  getSeanceById,
  creerOuMajSeance,
  basculerSeance,
  cloturerSeance,
  supprimerSeance,
  ajouterResolution,
  basculerResolution,
  reordonnerResolutions,
  seanceDeResolution,
  voterAvecJeton,
  purgerJetonsVoteExpires,
  HEURES_VALIDITE_LIEN,
  etatsJetonsVote,
  marquerActiviteJetonVote,
  marquerErreurJetonVote,
  revendiquerJetonVote,
  deverrouillerJetonVote,
  renouvelerJetonVote,
} from './server/db';
import { lienDeVote, qrDataUri } from './server/qr';
import {
  authentifierAdmin,
  exigerAdmin,
  lireJeton,
  revoquerJeton,
  verifierConfiguration,
  poserCookie,
  effacerCookie,
  creerJeton,
  creerJetonAppareil,
  empreinteAppareil,
  JOURS_APPAREIL_CONFIANCE,
} from './server/auth';
import { RealtimeNotification } from './src/types';

const PORT = Number(process.env.PORT || process.env.MEDIVOTE_PORT || 3000);
const HOTE = process.env.MEDIVOTE_HOST || '0.0.0.0';

/**
 * Scrutin secret : le flux temps réel et le journal ne doivent jamais rapprocher un
 * nom d'un choix. On remplace donc la notification nominative par un accusé anonyme.
 */
function anonymiserSiSecret(
  notif: RealtimeNotification,
  estSecret: boolean
): RealtimeNotification {
  if (!estSecret) return notif;
  return {
    ...notif,
    title: 'Suffrage exprimé',
    message: 'Un suffrage a été exprimé (scrutin secret).',
    voterName: undefined,
    voteChoice: undefined,
  };
}

/**
 * L'état que tout écran de pilotage attend après un geste : la résolution
 * présentée sur la table, la séance qui la porte avec son ordre du jour, et le
 * reste du registre. On le renvoie d'un bloc pour qu'aucun écran ne travaille
 * sur une moitié d'état.
 */
function etatComplet() {
  return {
    session: getActiveSession(),
    seance: getSeanceActive(),
    seances: getAllSeances(),
    voters: getAllVoters(),
    meetings: getAllMeetings(),
  };
}

// Active SSE client connections pool
const sseClients: Array<{ id: string; res: Response }> = [];

function broadcastSSE(event: RealtimeNotification) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.res.write(payload);
    } catch (_) {
      // client disconnected
    }
  });
}

/**
 * Tant qu'un scrutin secret n'est pas clôturé, le serveur ne laisse pas sortir le
 * détail nominatif des bulletins : la présence reste visible (l'émargement est
 * public), le sens du vote de chacun ne l'est pas. Les décomptes globaux, eux,
 * continuent d'être calculés côté serveur à la clôture.
 */
function masquerBulletinsSiSecret(session: any): any {
  if (!session || !session.isSecret || session.status === 'closed') return session;
  const voterStates: Record<string, any> = {};
  Object.entries(session.voterStates || {}).forEach(([voterId, etat]: [string, any]) => {
    voterStates[voterId] = {
      ...etat,
      vote: etat.vote === 'pending' ? 'pending' : 'secret',
      votedAt: etat.votedAt ? 'secret' : etat.votedAt,
    };
  });
  return { ...session, voterStates };
}

/** Applique le masquage à toute charge JSON portant une séance, sans exception oubliée. */
function protegerScrutinSecret(req: any, res: any, next: any): void {
  const jsonOriginal = res.json.bind(res);
  res.json = (corps: any) => {
    if (corps && typeof corps === 'object' && 'session' in corps) {
      return jsonOriginal({ ...corps, session: masquerBulletinsSiSecret(corps.session) });
    }
    return jsonOriginal(corps);
  };
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Initialize SQLite database
  verifierConfiguration();
  await initDatabase();
  purgerAppareilsExpires();
  purgerJetonsVoteExpires();
  console.log('Base SQLite MediVote initialisée.');

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Authentification administrateur
  app.post('/api/auth/admin', (req, res) => {
    try {
      const empreintePoste = req.ip || 'inconnu';
      const jeton = authentifierAdmin(req.body?.pin, empreintePoste);
      poserCookie(res, jeton);

      // Si le poste demande à être reconnu, on lui remet un jeton valable une
      // semaine. Le serveur n'en conserve que l'empreinte.
      let jetonAppareil: string | undefined;
      if (req.body?.memoriserAppareil) {
        const cree = creerJetonAppareil();
        enregistrerAppareil(
          cree.empreinte,
          String(req.body?.libelleAppareil || 'Poste de séance').slice(0, 80),
          JOURS_APPAREIL_CONFIANCE
        );
        jetonAppareil = cree.jeton;
      }

      res.json({
        role: jeton.role,
        expireA: jeton.expireA,
        jetonAppareil,
        joursValiditeAppareil: JOURS_APPAREIL_CONFIANCE,
      });
    } catch (err: any) {
      res.status(401).json({ error: err.message });
    }
  });

  /**
   * Ouvre une session à partir du jeton conservé sur le poste, sans ressaisir le
   * code. L'échéance glisse : sept jours à compter de la dernière utilisation.
   */
  app.post('/api/auth/appareil', (req, res) => {
    try {
      const jetonAppareil = String(req.body?.jetonAppareil || '');
      if (!jetonAppareil) return res.status(401).json({ error: 'Appareil non reconnu.' });

      if (!verifierAppareil(empreinteAppareil(jetonAppareil), JOURS_APPAREIL_CONFIANCE)) {
        return res.status(401).json({ error: 'Appareil non reconnu ou reconnaissance expirée.' });
      }

      const jeton = creerJeton('admin');
      poserCookie(res, jeton);
      res.json({ role: jeton.role, expireA: jeton.expireA });
    } catch (err: any) {
      res.status(401).json({ error: err.message });
    }
  });

  app.get('/api/auth/moi', (req, res) => {
    const jeton = lireJeton(req);
    if (!jeton) return res.status(401).json({ error: 'Session expirée.' });
    res.json({ role: jeton.role, voterId: jeton.voterId, expireA: jeton.expireA });
  });

  app.post('/api/auth/deconnexion', (req, res) => {
    revoquerJeton(req);
    effacerCookie(res);
    // Se déconnecter, c'est aussi demander que ce poste ne soit plus reconnu.
    const jetonAppareil = req.body?.jetonAppareil;
    if (jetonAppareil) oublierAppareil(empreinteAppareil(String(jetonAppareil)));
    res.json({ success: true });
  });

  /* ------------------------------------------------------------------
   * Vote nominatif par QR code — les seules routes ouvertes sans session
   * administrateur. L'autorisation tient entièrement au jeton du lien :
   * imprévisible, propre à un membre et à une séance, valable un jour, et
   * bon pour un seul bulletin. Le QR n'est montré que sur l'écran de la
   * salle, de sorte qu'il faut y être pour l'obtenir.
   * ------------------------------------------------------------------ */

  // Un lien de vote ne doit pas pouvoir être cherché à l'aveugle.
  const limiterCadence = createVoteRateLimiter();

  app.get('/api/scrutin/:jeton', limiterCadence, (req, res) => {
    const jeton = String(req.params.jeton);
    try {
      revendiquerJetonVote(jeton, String(req.get('X-Medivote-Appareil') || ''));
      const contexte = contexteVotant(jeton);
      if (!contexte) {
        marquerErreurJetonVote(jeton, "Ce lien de vote n'est plus valable.");
        return res.status(404).json({ error: "Ce lien de vote n'est plus valable." });
      }
      marquerActiviteJetonVote(jeton);
      res.json(contexte);
    } catch (err: any) {
      marquerErreurJetonVote(jeton, err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/scrutin/:jeton/bulletin', limiterCadence, (req, res) => {
    const jeton = String(req.params.jeton);
    try {
      revendiquerJetonVote(jeton, String(req.get('X-Medivote-Appareil') || ''));
      const vote = String(req.body?.vote || '');
      if (!['for', 'against', 'abstain'].includes(vote)) {
        return res.status(400).json({ error: 'Suffrage invalide.' });
      }

      const { session, voterId, pouvoirs } = voterAvecJeton(
        jeton,
        vote as 'for' | 'against' | 'abstain'
      );
      marquerActiviteJetonVote(jeton, true);

      const votant = getAllVoters().find(v => v.id === voterId);
      const nom = votant ? `${votant.title} ${votant.name}` : voterId;
      const libelle = vote === 'for' ? 'POUR (Adoption)' : vote === 'against' ? 'CONTRE (Rejet)' : 'ABSTENTION';
      const mentionPouvoirs = pouvoirs > 0 ? ` (avec ${pouvoirs} pouvoir${pouvoirs > 1 ? 's' : ''})` : '';

      const notif = logEvent(anonymiserSiSecret({
        type: 'vote_cast',
        title: 'Suffrage Exprimé',
        message: `${nom} a voté depuis son téléphone : ${libelle}${mentionPouvoirs}`,
        voterName: nom,
        voteChoice: vote as any,
        sessionId: session.id,
        timestamp: new Date().toISOString(),
      } as RealtimeNotification, Boolean(session.isSecret)));
      broadcastSSE(notif);

      res.json({ enregistre: true, pouvoirs, secret: Boolean(session.isSecret) });
    } catch (err: any) {
      marquerErreurJetonVote(jeton, err.message);
      const conflit = /valable|déjà|clôturé|ouvert|émargé|pouvoir|convoqués/i.test(err.message || '');
      res.status(err.status || (conflit ? 409 : 500)).json({ error: err.message });
    }
  });

  // À partir d'ici, toute l'API exige une session administrateur ouverte.
  app.use('/api', exigerAdmin);
  app.use('/api', protegerScrutinSecret);

  // Real-time SSE event stream
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    sseClients.push({ id: clientId, res });

    // Send initial connected ping
    res.write(`data: ${JSON.stringify({ type: 'connected', title: 'Connecté', message: 'Système temps réel connecté', timestamp: new Date().toISOString() })}\n\n`);

    // Keep alive heartbeat every 20 seconds
    const interval = setInterval(() => {
      res.write(': keep-alive\n\n');
    }, 20000);

    req.on('close', () => {
      clearInterval(interval);
      const idx = sseClients.findIndex(c => c.id === clientId);
      if (idx !== -1) sseClients.splice(idx, 1);
    });
  });

  // Notifications API
  app.get('/api/notifications', (req, res) => {
    try {
      const events = getRecentEvents(60);
      res.json({ notifications: events });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/notifications/clear', (req, res) => {
    try {
      clearEvents();
      res.json({ success: true });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // Meetings CRUD (Advanced Meeting Management)
  app.get('/api/meetings', (req, res) => {
    try {
      const meetings = getAllMeetings();
      res.json({ meetings });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/meetings/create', (req, res) => {
    try {
      const created = createOrUpdateSession(req.body);

      const notif = logEvent({
        type: 'meeting_created',
        title: 'Nouvelle Réunion Créée',
        message: `La délibération "${created.title}" (${created.referenceCode}) est planifiée pour le ${created.scheduledDate} à ${created.scheduledTime}. Son scrutin reste fermé tant qu'il n'est pas ouvert depuis la table.`,
        sessionId: created.id,
        timestamp: new Date().toISOString()
      });
      broadcastSSE(notif);

      res.json(etatComplet());
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/meetings/switch', (req, res) => {
    try {
      const { meetingId } = req.body;
      if (!meetingId) return res.status(400).json({ error: 'ID de réunion manquant' });

      const activeSession = switchActiveMeeting(meetingId);

      if (activeSession) {
        const notif = logEvent({
          type: 'meeting_switched',
          title: 'Séance Active Modifiée',
          message: `Séance en cours : "${activeSession.title}" (${activeSession.referenceCode})`,
          sessionId: activeSession.id,
          timestamp: new Date().toISOString()
        });
        broadcastSSE(notif);
      }

      res.json(etatComplet());
    } catch (err: any) {
      const conflit = /introuvable|clôturée|réactivée/.test(err.message || '');
      res.status(err.status || (conflit ? 409 : 500)).json({ error: err.message });
    }
  });

  app.delete('/api/meetings/:id', (req, res) => {
    try {
      deleteMeeting(req.params.id);
      res.json({ success: true, ...etatComplet() });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/meetings/:id/duplicate', (req, res) => {
    try {
      const session = duplicateMeeting(req.params.id);

      if (session) {
        const notif = logEvent({
          type: 'meeting_created',
          title: 'Séance Dupliquée',
          message: `Copie créée : "${session.title}"`,
          sessionId: session.id,
          timestamp: new Date().toISOString()
        });
        broadcastSSE(notif);
      }

      res.json(etatComplet());
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  /* ------------------------------------------------------------------
   * Séances et résolutions
   *
   * La séance est la réunion ; les résolutions sont les points de l'ordre du
   * jour qu'on y vote. On peut en ajouter à tout moment, y compris pendant la
   * séance : c'est la raison d'être de ces routes.
   * ------------------------------------------------------------------ */

  app.get('/api/seances', (req, res) => {
    try {
      res.json({ seances: getAllSeances(), seance: getSeanceActive() });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  /** Crée une séance, ou corrige ses coordonnées. Elle ne porte aucun suffrage. */
  app.post('/api/seances/save', (req, res) => {
    try {
      const seance = creerOuMajSeance(req.body || {});
      const creation = !req.body?.id;

      const notif = logEvent({
        type: creation ? 'meeting_created' : 'info',
        title: creation ? 'Nouvelle séance' : 'Séance mise à jour',
        message: `« ${seance.title} » (${seance.referenceCode}) — ${seance.scheduledDate} à ${seance.scheduledTime}, ${seance.location || 'lieu non précisé'}.`,
        sessionId: seance.resolutionCouranteId || undefined,
        timestamp: new Date().toISOString(),
      });
      broadcastSSE(notif);

      res.json({ ...etatComplet(), seanceEnregistree: seance });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/seances/switch', (req, res) => {
    try {
      const { seanceId } = req.body || {};
      if (!seanceId) return res.status(400).json({ error: 'Séance non précisée.' });
      const seance = basculerSeance(String(seanceId));

      const notif = logEvent({
        type: 'meeting_switched',
        title: 'Séance affichée',
        message: `Séance en cours : « ${seance?.title} » (${seance?.referenceCode}).`,
        sessionId: seance?.resolutionCouranteId || undefined,
        timestamp: new Date().toISOString(),
      });
      broadcastSSE(notif);

      res.json(etatComplet());
    } catch (err: any) {
      const conflit = /introuvable|clôturée/.test(err.message || '');
      res.status(err.status || (conflit ? 409 : 500)).json({ error: err.message });
    }
  });

  /** Clôt la séance : elle est scellée et les liens de vote tombent. */
  app.post('/api/seances/close', (req, res) => {
    try {
      const { seanceId } = req.body || {};
      if (!seanceId) return res.status(400).json({ error: 'Séance non précisée.' });
      const seance = cloturerSeance(String(seanceId));
      sauvegarderBase(`cloture_seance_${seanceId}`);

      const votees = seance.resolutions.filter(r => r.outcome !== 'pending').length;
      const notif = logEvent({
        type: 'vote_ended',
        title: 'Séance close',
        message: `La séance « ${seance.title} » est close : ${votees} résolution(s) votée(s) sur ${seance.resolutions.length}. Les liens de vote sont révoqués.`,
        sessionId: seance.resolutionCouranteId || undefined,
        timestamp: new Date().toISOString(),
      });
      broadcastSSE(notif);

      res.json({ ...etatComplet(), history: getHistory(), seanceClose: seance });
    } catch (err: any) {
      const conflit = /introuvable|déjà clôturée|encore ouverte/.test(err.message || '');
      res.status(err.status || (conflit ? 409 : 500)).json({ error: err.message });
    }
  });

  app.delete('/api/seances/:id', (req, res) => {
    try {
      supprimerSeance(req.params.id);
      res.json({ success: true, ...etatComplet() });
    } catch (err: any) {
      const conflit = /scellée|clôturée/.test(err.message || '');
      res.status(err.status || (conflit ? 409 : 500)).json({ error: err.message });
    }
  });

  /** Ajoute une résolution à une séance — avant, ou pendant. */
  app.post('/api/seances/:id/resolutions', (req, res) => {
    try {
      const resolution = ajouterResolution(req.params.id, req.body || {});

      const notif = logEvent({
        type: 'meeting_created',
        title: 'Résolution ajoutée',
        message: `Point n° ${resolution.ordre} de l'ordre du jour : « ${resolution.title} ». Son scrutin reste fermé tant qu'il n'est pas ouvert depuis la table.`,
        sessionId: resolution.id,
        timestamp: new Date().toISOString(),
      });
      broadcastSSE(notif);

      res.json({ ...etatComplet(), resolution });
    } catch (err: any) {
      const conflit = /introuvable|clôturée/.test(err.message || '');
      res.status(err.status || (conflit ? 409 : 500)).json({ error: err.message });
    }
  });

  /** Présente une autre résolution sur la table, sans rien ouvrir ni fermer. */
  app.post('/api/resolutions/switch', (req, res) => {
    try {
      const { resolutionId } = req.body || {};
      if (!resolutionId) return res.status(400).json({ error: 'Résolution non précisée.' });
      const resolution = basculerResolution(String(resolutionId));

      const notif = logEvent({
        type: 'meeting_switched',
        title: 'Point suivant de l\'ordre du jour',
        message: `La table présente désormais : « ${resolution?.title} » (point n° ${resolution?.ordre}).`,
        sessionId: resolution?.id,
        timestamp: new Date().toISOString(),
      });
      broadcastSSE(notif);

      res.json(etatComplet());
    } catch (err: any) {
      const conflit = /introuvable/.test(err.message || '');
      res.status(err.status || (conflit ? 409 : 500)).json({ error: err.message });
    }
  });

  app.post('/api/resolutions/reorder', (req, res) => {
    try {
      const { seanceId, ordreIds } = req.body || {};
      if (!seanceId || !Array.isArray(ordreIds)) {
        return res.status(400).json({ error: 'Séance ou ordre manquant.' });
      }
      reordonnerResolutions(String(seanceId), ordreIds.map(String));
      const notif = logEvent({
        type: 'meeting_switched',
        title: 'Ordre du jour réorganisé',
        message: "L'ordre des résolutions a été mis à jour.",
        sessionId: getSeanceById(String(seanceId))?.resolutionCouranteId || undefined,
        timestamp: new Date().toISOString(),
      });
      broadcastSSE(notif);
      res.json(etatComplet());
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // Session routes
  app.get('/api/session/active', (req, res) => {
    try {
      res.json(etatComplet());
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/session/save', (req, res) => {
    try {
      const saved = createOrUpdateSession(req.body);

      // Enregistrer l'ordre du jour ne change pas l'état du scrutin : le message
      // se contente de rappeler celui-ci, il n'annonce aucune ouverture.
      const etatScrutin = saved.status === 'open'
        ? 'scrutin ouvert'
        : saved.status === 'closed'
          ? 'séance clôturée'
          : 'scrutin non ouvert';
      const notif = logEvent({
        type: 'info',
        title: 'Ordre du Jour Mis à Jour',
        message: `Texte soumis au vote : "${saved.title}" (${saved.referenceCode}) — ${etatScrutin}.`,
        sessionId: saved.id,
        timestamp: new Date().toISOString()
      });
      broadcastSSE(notif);

      // L'état entier, jamais la seule résolution enregistrée : l'ordre du jour
      // de l'administration se lit sur `seance`, et renvoyer `session: saved`
      // remplaçait de surcroît le vote présenté par celui qu'on venait d'éditer.
      res.json(etatComplet());
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/session/vote', (req, res) => {
    try {
      const { sessionId, voterId, vote } = req.body;
      if (!sessionId || !voterId || !vote) {
        return res.status(400).json({ error: 'Paramètres invalides' });
      }
      updateVoterVote(sessionId, voterId, vote);
      const etat = etatComplet();
      const voters = etat.voters;
      const voter = voters.find(v => v.id === voterId);

      const voteLabel = vote === 'for' ? 'POUR (Adoption)' : vote === 'against' ? 'CONTRE (Rejet)' : vote === 'abstain' ? 'ABSTENTION' : 'En attente';
      const voterNameStr = voter ? `${voter.title} ${voter.name}` : voterId;

      // En scrutin secret, ni le nom ni le choix ne sont journalisés ni diffusés.
      const estSecret = Boolean(getSessionById(sessionId)?.isSecret);
      const notif = logEvent(anonymiserSiSecret({
        type: 'vote_cast',
        title: 'Suffrage Exprimé',
        message: `${voterNameStr} a voté : ${voteLabel}`,
        voterName: voterNameStr,
        voteChoice: vote,
        sessionId,
        timestamp: new Date().toISOString()
      } as RealtimeNotification, estSecret));
      broadcastSSE(notif);

      res.json(etat);
    } catch (err: any) {
      // Scrutin fermé ou séance inconnue : erreur de manipulation, pas panne serveur.
      const conflit = /scrutin|clôturée|introuvable/i.test(err.message || '');
      res.status(err.status || (conflit ? 409 : 500)).json({ error: err.message });
    }
  });

  app.post('/api/session/presence', (req, res) => {
    try {
      const { sessionId, voterId, presence, proxyToId } = req.body;
      if (!sessionId || !voterId || !presence) {
        return res.status(400).json({ error: 'Paramètres invalides' });
      }
      updateVoterPresence(sessionId, voterId, presence, proxyToId);
      const etat = etatComplet();
      const voters = etat.voters;
      const voter = voters.find(v => v.id === voterId);

      const presLabel = presence === 'present' ? 'Présent' : presence === 'proxy' ? 'Procuration' : presence === 'excused' ? 'Excusé' : 'Absent';
      const voterNameStr = voter ? `${voter.title} ${voter.name}` : voterId;

      const notif = logEvent({
        type: 'presence_changed',
        title: 'Émargement / Présence',
        message: `${voterNameStr} est désormais noté comme "${presLabel}".`,
        voterName: voterNameStr,
        sessionId,
        timestamp: new Date().toISOString()
      });
      broadcastSSE(notif);

      res.json(etat);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // Ouverture et suspension du scrutin. Distinct de la séance active : c'est ce
  // geste, et lui seul, qui rend les bulletins recevables.
  app.post('/api/session/ouverture', (req, res) => {
    try {
      const { sessionId, ouvert } = req.body;
      if (!sessionId || typeof ouvert !== 'boolean') {
        return res.status(400).json({ error: 'Séance ou état d\'ouverture manquant' });
      }
      const resolution = definirOuvertureScrutin(sessionId, ouvert);

      const notif = logEvent({
        type: ouvert ? 'vote_started' : 'info',
        title: ouvert ? 'Scrutin Ouvert' : 'Scrutin Suspendu',
        message: ouvert
          ? `Le scrutin est ouvert sur « ${resolution?.title || 'la résolution'} » : les suffrages sont désormais recevables.`
          : `Le scrutin est suspendu : plus aucun suffrage n'est accepté.`,
        sessionId,
        timestamp: new Date().toISOString()
      });
      broadcastSSE(notif);

      res.json(etatComplet());
    } catch (err: any) {
      const conflit = /clôturée|introuvable/.test(err.message || '');
      res.status(err.status || (conflit ? 409 : 500)).json({ error: err.message });
    }
  });

  /**
   * Liens de vote de la séance : un par membre convoqué, avec son QR code.
   * Les jetons déjà émis et encore valables sont réutilisés tels quels, pour
   * qu'un membre ayant déjà scanné ne se retrouve pas avec un lien mort.
   */
  app.get('/api/liens-vote', async (req, res) => {
    try {
      const sessionId = String(req.query.sessionId || '') || getActiveSession()?.id;
      if (!sessionId) return res.status(400).json({ error: 'Aucune séance à équiper de liens de vote.' });

      // Le lien vaut pour la séance entière : il reste valable d'une résolution
      // à la suivante, et ne tombe qu'à la clôture de la séance.
      const seanceId = seanceDeResolution(sessionId) || sessionId;
      const seance = getSeanceById(seanceId);
      if (!seance) return res.status(404).json({ error: 'Séance introuvable.' });
      if (seance.closedAt) return res.json({ sessionId, seanceId, liens: [] });

      const actifs = new Set(getAllVoters().filter(v => v.isActive).map(v => v.id));
      const convoques = seance.selectedAttendeeIds.filter(id => actifs.has(id));
      const liens = await Promise.all(convoques.map(async (voterId) => {
        const jeton = jetonVotePour(seanceId, voterId);
        const url = lienDeVote(req, jeton.jeton);
        return {
          voterId,
          url,
          qr: await qrDataUri(url),
          expireLe: jeton.expireLe,
          utilise: Boolean(jeton.utiliseLe),
          verrouille: Boolean(jeton.empreinteAppareil),
          verrouilleLe: jeton.verrouilleLe,
        };
      }));

      res.json({ sessionId, seanceId, liens, heuresValidite: HEURES_VALIDITE_LIEN });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  /** État de santé des pages mobiles, interrogé fréquemment sans recalculer les QR. */
  app.get('/api/liens-vote/etats', (req, res) => {
    try {
      const sessionId = String(req.query.sessionId || '') || getActiveSession()?.id;
      if (!sessionId) return res.status(400).json({ error: 'Aucune séance active.' });
      res.json({ etats: etatsJetonsVote(sessionId) });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  /** Libère le QR existant. L'ancien téléphone doit être fermé avant ce geste. */
  app.post('/api/liens-vote/:voterId/deverrouiller', (req, res) => {
    try {
      const sessionId = String(req.body?.sessionId || '') || getActiveSession()?.id;
      if (!sessionId) return res.status(400).json({ error: 'Aucune séance active.' });
      const seanceId = seanceDeResolution(sessionId) || sessionId;
      const seance = getSeanceById(seanceId);
      const voterId = String(req.params.voterId);
      if (!seance) return res.status(404).json({ error: 'Séance introuvable.' });
      if (seance.closedAt) return res.status(409).json({ error: 'Cette séance est clôturée.' });
      if (!seance.selectedAttendeeIds.includes(voterId)) {
        return res.status(409).json({ error: "Ce membre n'est pas convoqué à cette séance." });
      }
      const lien = deverrouillerJetonVote(seanceId, voterId);
      const notif = logEvent({
        type: 'ballot_link_changed',
        title: 'Bulletin libéré',
        message: 'Un bulletin a été libéré par l’administrateur.',
        sessionId,
        timestamp: new Date().toISOString(),
      });
      broadcastSSE(notif);
      res.json({
        voterId: lien.voterId,
        verrouille: false,
        verrouilleLe: null,
        etatBulletin: 'attente',
        dernierAccesLe: null,
        erreurBulletin: null,
      });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  /** Révoque l'ancien jeton et renvoie immédiatement un QR neuf. */
  app.post('/api/liens-vote/:voterId/renouveler', async (req, res) => {
    try {
      const sessionId = String(req.body?.sessionId || '') || getActiveSession()?.id;
      if (!sessionId) return res.status(400).json({ error: 'Aucune séance active.' });
      const seanceId = seanceDeResolution(sessionId) || sessionId;
      const seance = getSeanceById(seanceId);
      const voterId = String(req.params.voterId);
      if (!seance) return res.status(404).json({ error: 'Séance introuvable.' });
      if (seance.closedAt) return res.status(409).json({ error: 'Cette séance est clôturée.' });
      if (!seance.selectedAttendeeIds.includes(voterId)) {
        return res.status(409).json({ error: "Ce membre n'est pas convoqué à cette séance." });
      }
      const jeton = renouvelerJetonVote(seanceId, voterId);
      const url = lienDeVote(req, jeton.jeton);
      const notif = logEvent({
        type: 'ballot_link_changed',
        title: 'Nouveau bulletin',
        message: 'Un nouveau lien de bulletin a été généré par l’administrateur.',
        sessionId,
        timestamp: new Date().toISOString(),
      });
      broadcastSSE(notif);
      res.json({
        voterId: jeton.voterId,
        url,
        qr: await qrDataUri(url),
        expireLe: jeton.expireLe,
        utilise: Boolean(jeton.utiliseLe),
        verrouille: false,
        verrouilleLe: null,
        etatBulletin: 'attente',
        dernierAccesLe: null,
        erreurBulletin: null,
      });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // Modèles de résolution, enregistrés par l'utilisateur
  app.get('/api/templates', (req, res) => {
    try {
      res.json({ templates: getAllTemplates() });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/templates/save', (req, res) => {
    try {
      const { name, title, motionText, majorityRequired, quorumPct, id } = req.body;
      if (!name || !title) {
        return res.status(400).json({ error: 'Un modèle doit au moins porter un nom et un intitulé.' });
      }
      const template = saveTemplate({
        id,
        name,
        title,
        motionText: motionText || '',
        majorityRequired,
        quorumPct,
      });
      res.json({ template, templates: getAllTemplates() });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.delete('/api/templates/:id', (req, res) => {
    try {
      deleteTemplate(req.params.id);
      res.json({ success: true, templates: getAllTemplates() });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/session/reset', (req, res) => {
    try {
      const { sessionId } = req.body;
      resetSessionVotes(sessionId);

      const notif = logEvent({
        type: 'vote_reset',
        title: 'Scrutin Réinitialisé',
        message: `Les suffrages de la séance ont été remis à zéro par l'administrateur. Le scrutin est refermé : il devra être rouvert pour un nouveau tour.`,
        sessionId,
        timestamp: new Date().toISOString()
      });
      broadcastSSE(notif);

      res.json(etatComplet());
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/session/close', (req, res) => {
    try {
      const { sessionId } = req.body;
      if (!sessionId) return res.status(400).json({ error: 'Séance non précisée' });

      // Le décompte transmis par le navigateur est ignoré : le serveur recalcule le
      // résultat officiel à partir des bulletins en base, puis sauvegarde le registre.
      const { history: archive, stats } = archiveAndCloseSession(sessionId);
      sauvegarderBase(`cloture_${sessionId}`);

      const etat = etatComplet();
      const history = getHistory();

      const outcomeLabel = stats.outcome === 'adopted' 
        ? 'RÉSOLUTION ADOPTÉE' 
        : stats.outcome === 'rejected' 
          ? 'RÉSOLUTION REJETÉE' 
          : stats.outcome === 'quorum_not_reached' ? 'QUORUM NON ATTEINT' : 'AUCUN SUFFRAGE EXPRIMÉ';

      const mentionAssimilees = stats.abstentionsAssimilees > 0
        ? ` Dont ${stats.abstentionsAssimilees} non-votant(s) présent(s) assimilé(s) à une abstention.`
        : '';

      const notif = logEvent({
        type: 'vote_ended',
        title: `Scrutin Clôturé : ${outcomeLabel}`,
        message: `Résultat final : ${stats.votesFor} Pour, ${stats.votesAgainst} Contre, ${stats.votesAbstain} Abstention (${stats.forPercentage} % d'adhésion).${mentionAssimilees}`,
        outcome: stats.outcome,
        sessionId,
        timestamp: new Date().toISOString()
      });
      broadcastSSE(notif);

      /*
       * La réponse porte la résolution clôturée — la table continue de l'afficher,
       * résultat compris — en plus de l'archive et du reste du registre. Sans elle,
       * l'écran de séance se retrouvait sans séance du tout.
       */
      res.json({ ...etat, archive, stats, history });
    } catch (err: any) {
      // Séance introuvable ou déjà clôturée : c'est une erreur de manipulation,
      // pas une panne du serveur — l'écran doit le dire tel quel.
      const conflit = /déjà clôturée|introuvable/.test(err.message || '');
      res.status(err.status || (conflit ? 409 : 500)).json({ error: err.message });
    }
  });

  // Voters directory routes
  app.get('/api/voters', (req, res) => {
    try {
      const voters = getAllVoters();
      res.json({ voters });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/voters/save', (req, res) => {
    try {
      const voter = saveVoter(req.body);
      res.json({ voter, ...etatComplet() });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.delete('/api/voters/:id', (req, res) => {
    try {
      deleteVoter(req.params.id);
      res.json({ success: true, ...etatComplet() });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/voters/import', (req, res) => {
    try {
      const { text, listCode } = req.body;
      if (!text) return res.status(400).json({ error: 'Texte d\'importation manquant' });
      const result = importVotersFromText(text, listCode);
      const lists = getAllVoterLists();
      
      const notif = logEvent({
        type: 'info',
        title: 'Import de Votants Réussi',
        message: `${result.count} votants ont été importés / mis à jour dans l'annuaire.`,
        timestamp: new Date().toISOString()
      });
      broadcastSSE(notif);

      res.json({ ...result, lists, ...etatComplet() });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // Voter Lists Management Routes
  app.get('/api/lists', (req, res) => {
    try {
      const lists = getAllVoterLists();
      res.json({ lists });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/lists/save', (req, res) => {
    try {
      const list = saveVoterList(req.body);
      const lists = getAllVoterLists();
      res.json({ list, lists });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.delete('/api/lists/:id', (req, res) => {
    try {
      deleteVoterList(req.params.id);
      const lists = getAllVoterLists();
      res.json({ success: true, lists });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/lists/apply', (req, res) => {
    try {
      const { sessionId, listId } = req.body;
      if (!sessionId || !listId) return res.status(400).json({ error: 'Paramètres manquants' });
      applyVoterListToSession(sessionId, listId);

      const notif = logEvent({
        type: 'list_applied',
        title: 'Liste de Votants Appliquée',
        message: `La liste "${listId}" a été chargée pour la séance en cours.`,
        sessionId,
        timestamp: new Date().toISOString()
      });
      broadcastSSE(notif);

      res.json(etatComplet());
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // History SQLite archives
  app.get('/api/history', (req, res) => {
    try {
      const history = getHistory();
      res.json({ history });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.delete('/api/history/:id', (req, res) => {
    try {
      deleteHistoryItem(req.params.id);
      const history = getHistory();
      res.json({ success: true, history });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // Reset demo
  app.post('/api/reset-demo', async (req, res) => {
    try {
      await resetToDemoData();
      res.json({ ...etatComplet(), history: getHistory() });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Écoute sur l'interface configurée. En production le service reste sur la boucle
  // locale : seul le reverse proxy l'atteint, ce qui rend le filtrage par adresse
  // impossible à contourner en tapant le port directement.
  app.listen(PORT, HOTE, () => {
    console.log(`MediVote écoute sur http://${HOTE}:${PORT}`);
  });
}

startServer();
