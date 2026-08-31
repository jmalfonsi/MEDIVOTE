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
} from './server/db';
import {
  authentifierAdmin,
  exigerAdmin,
  lireJeton,
  revoquerJeton,
  verifierConfiguration,
  poserCookie,
  effacerCookie,
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
    res.json({ success: true });
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
    res.write(`data: ${JSON.stringify({ type: 'info', title: 'Connecté', message: 'Système temps réel connecté', timestamp: new Date().toISOString() })}\n\n`);

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
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/notifications/clear', (req, res) => {
    try {
      clearEvents();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Meetings CRUD (Advanced Meeting Management)
  app.get('/api/meetings', (req, res) => {
    try {
      const meetings = getAllMeetings();
      res.json({ meetings });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/meetings/create', (req, res) => {
    try {
      const created = createOrUpdateSession(req.body);
      const voters = getAllVoters();
      const meetings = getAllMeetings();

      const notif = logEvent({
        type: 'meeting_created',
        title: 'Nouvelle Réunion Créée',
        message: `La délibération "${created.title}" (${created.referenceCode}) a été planifiée pour le ${created.scheduledDate} à ${created.scheduledTime}.`,
        sessionId: created.id,
        timestamp: new Date().toISOString()
      });
      broadcastSSE(notif);

      res.json({ session: created, voters, meetings });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/meetings/switch', (req, res) => {
    try {
      const { meetingId } = req.body;
      if (!meetingId) return res.status(400).json({ error: 'ID de réunion manquant' });

      const activeSession = switchActiveMeeting(meetingId);
      const voters = getAllVoters();
      const meetings = getAllMeetings();

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

      res.json({ session: activeSession, voters, meetings });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/meetings/:id', (req, res) => {
    try {
      deleteMeeting(req.params.id);
      const session = getActiveSession();
      const voters = getAllVoters();
      const meetings = getAllMeetings();
      res.json({ success: true, session, voters, meetings });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/meetings/:id/duplicate', (req, res) => {
    try {
      const session = duplicateMeeting(req.params.id);
      const voters = getAllVoters();
      const meetings = getAllMeetings();

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

      res.json({ session, voters, meetings });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Session routes
  app.get('/api/session/active', (req, res) => {
    try {
      const session = getActiveSession();
      const voters = getAllVoters();
      const meetings = getAllMeetings();
      res.json({ session, voters, meetings });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/session/save', (req, res) => {
    try {
      const saved = createOrUpdateSession(req.body);
      const voters = getAllVoters();
      const meetings = getAllMeetings();

      const notif = logEvent({
        type: 'vote_started',
        title: 'Ordre du Jour & Scrutin Mis à Jour',
        message: `Texte de vote : "${saved.title}" (${saved.referenceCode}) - Statut : ${saved.status === 'open' ? 'Ouvert au vote' : saved.status}`,
        sessionId: saved.id,
        timestamp: new Date().toISOString()
      });
      broadcastSSE(notif);

      res.json({ session: saved, voters, meetings });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/session/vote', (req, res) => {
    try {
      const { sessionId, voterId, vote } = req.body;
      if (!sessionId || !voterId || !vote) {
        return res.status(400).json({ error: 'Paramètres invalides' });
      }
      const session = updateVoterVote(sessionId, voterId, vote);
      const voters = getAllVoters();
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

      res.json({ session, voters });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/session/presence', (req, res) => {
    try {
      const { sessionId, voterId, presence, proxyToId } = req.body;
      if (!sessionId || !voterId || !presence) {
        return res.status(400).json({ error: 'Paramètres invalides' });
      }
      const session = updateVoterPresence(sessionId, voterId, presence, proxyToId);
      const voters = getAllVoters();
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

      res.json({ session, voters });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/session/reset', (req, res) => {
    try {
      const { sessionId } = req.body;
      const session = resetSessionVotes(sessionId);
      const voters = getAllVoters();

      const notif = logEvent({
        type: 'vote_reset',
        title: 'Scrutin Réinitialisé',
        message: `Les suffrages de la séance ont été remis à zéro par l'administrateur.`,
        sessionId,
        timestamp: new Date().toISOString()
      });
      broadcastSSE(notif);

      res.json({ session, voters });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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

      const voters = getAllVoters();
      const history = getHistory();
      const meetings = getAllMeetings();

      const outcomeLabel = stats.outcome === 'adopted' 
        ? 'RÉSOLUTION ADOPTÉE' 
        : stats.outcome === 'rejected' 
          ? 'RÉSOLUTION REJETÉE' 
          : 'QUORUM NON ATTEINT';

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

      res.json({ ...archive, stats, voters, history, meetings });
    } catch (err: any) {
      // Séance introuvable ou déjà clôturée : c'est une erreur de manipulation,
      // pas une panne du serveur — l'écran doit le dire tel quel.
      const conflit = /déjà clôturée|introuvable/.test(err.message || '');
      res.status(conflit ? 409 : 500).json({ error: err.message });
    }
  });

  // Voters directory routes
  app.get('/api/voters', (req, res) => {
    try {
      const voters = getAllVoters();
      res.json({ voters });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/voters/save', (req, res) => {
    try {
      const voter = saveVoter(req.body);
      const voters = getAllVoters();
      const session = getActiveSession();
      res.json({ voter, voters, session });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/voters/:id', (req, res) => {
    try {
      deleteVoter(req.params.id);
      const voters = getAllVoters();
      const session = getActiveSession();
      res.json({ success: true, voters, session });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/voters/import', (req, res) => {
    try {
      const { text, listCode } = req.body;
      if (!text) return res.status(400).json({ error: 'Texte d\'importation manquant' });
      const result = importVotersFromText(text, listCode);
      const lists = getAllVoterLists();
      const session = getActiveSession();
      
      const notif = logEvent({
        type: 'info',
        title: 'Import de Votants Réussi',
        message: `${result.count} votants ont été importés / mis à jour dans l'annuaire.`,
        timestamp: new Date().toISOString()
      });
      broadcastSSE(notif);

      res.json({ ...result, lists, session });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Voter Lists Management Routes
  app.get('/api/lists', (req, res) => {
    try {
      const lists = getAllVoterLists();
      res.json({ lists });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/lists/save', (req, res) => {
    try {
      const list = saveVoterList(req.body);
      const lists = getAllVoterLists();
      res.json({ list, lists });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/lists/:id', (req, res) => {
    try {
      deleteVoterList(req.params.id);
      const lists = getAllVoterLists();
      res.json({ success: true, lists });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/lists/apply', (req, res) => {
    try {
      const { sessionId, listId } = req.body;
      if (!sessionId || !listId) return res.status(400).json({ error: 'Paramètres manquants' });
      const session = applyVoterListToSession(sessionId, listId);
      const voters = getAllVoters();
      const meetings = getAllMeetings();

      const notif = logEvent({
        type: 'list_applied',
        title: 'Liste de Votants Appliquée',
        message: `La liste "${listId}" a été chargée pour la séance en cours.`,
        sessionId,
        timestamp: new Date().toISOString()
      });
      broadcastSSE(notif);

      res.json({ session, voters, meetings });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // History SQLite archives
  app.get('/api/history', (req, res) => {
    try {
      const history = getHistory();
      res.json({ history });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/history/:id', (req, res) => {
    try {
      deleteHistoryItem(req.params.id);
      const history = getHistory();
      res.json({ success: true, history });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Reset demo
  app.post('/api/reset-demo', async (req, res) => {
    try {
      await resetToDemoData();
      const session = getActiveSession();
      const voters = getAllVoters();
      const history = getHistory();
      const meetings = getAllMeetings();
      res.json({ session, voters, history, meetings });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
