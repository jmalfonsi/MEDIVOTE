import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  VotingSession, 
  Voter, 
  SessionHistoryItem, 
  VoteChoice, 
  PresenceStatus,
  MeetingItem,
  RealtimeNotification,
  VoterList,
  LienVote,
  Seance
} from './types';
import { api, auth, SessionExpiree, EtatSeance } from './services/api';
import { calculateVoteStatistics } from './utils/votingMath';
import { prechargerLogo } from './utils/pdfExport';
import { Navbar } from './components/Navbar';
import { OvalTable } from './components/OvalTable';
import { AdminPanel } from './components/AdminPanel';
import { KioskView } from './components/KioskView';
import { HistoryPanel } from './components/HistoryPanel';
import { CloseSessionModal } from './components/CloseSessionModal';
import { ModeSelectionModal } from './components/ModeSelectionModal';
import { AdminPinModal } from './components/AdminPinModal';
import { AjouterResolutionModal } from './components/AjouterResolutionModal';
import { VoterFullPageView } from './components/VoterFullPageView';
import { AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';

export default function App() {
  // Navigation & Mode Management: Default to Admin mode with PIN code
  const [appMode, setAppMode] = useState<'voter' | 'admin'>('admin');
  const [selectedVoterId, setSelectedVoterId] = useState<string | null>(null);
  const [isModeModalOpen, setIsModeModalOpen] = useState<boolean>(false);
  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState<boolean>(true);
  
  const [currentTab, setCurrentTab] = useState<'table' | 'kiosk' | 'admin' | 'history'>('admin');
  const [isFullscreenTable, setIsFullscreenTable] = useState<boolean>(false);
  const [session, setSession] = useState<VotingSession | null>(null);
  /* Séance en cours et son ordre du jour : la résolution affichée en est un point. */
  const [seance, setSeance] = useState<Seance | null>(null);
  const [seances, setSeances] = useState<Seance[]>([]);
  const [voters, setVoters] = useState<Voter[]>([]);
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [history, setHistory] = useState<SessionHistoryItem[]>([]);
  const [lists, setLists] = useState<VoterList[]>([]);
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState<boolean>(false);
  const [isAjoutResolutionOpen, setIsAjoutResolutionOpen] = useState<boolean>(false);
  /** Dernière résolution demandée, le temps que le serveur réponde. */
  const cibleResolutionEnVol = useRef<string | null>(null);
  // Tant que le serveur n'a pas reconnu une session administrateur, rien n'est chargé.
  const [sessionOuverte, setSessionOuverte] = useState<boolean>(false);

  /*
   * Liens de vote nominatifs (QR codes), indexés par membre. Ils ne dépendent que
   * de la composition de la séance : inutile de les redemander à chaque suffrage.
   */
  const [liensVote, setLiensVote] = useState<Record<string, LienVote>>({});

  /*
   * Affichage simplifié : ne laisse que l'essentiel à l'écran pendant la séance.
   * Le choix est propre au poste et survit à un rechargement — en séance, on ne
   * veut pas avoir à le refaire après un rafraîchissement malencontreux.
   */
  // Incrémenté pour relancer un chargement après une reprise de session.
  const [relance, setRelance] = useState<number>(0);

  /*
   * Le serveur renvoie l'état de pilotage d'un bloc après chaque geste. On
   * l'applique tel quel : jamais une moitié d'état, jamais une séance perdue
   * parce qu'une réponse ne portait pas le champ attendu.
   */
  const appliquerEtat = useCallback((etat: Partial<EtatSeance> | null | undefined) => {
    if (!etat) return;
    if ('session' in etat) setSession(etat.session ?? null);
    if ('seance' in etat) setSeance(etat.seance ?? null);
    if (etat.seances) setSeances(etat.seances);
    if (etat.voters) setVoters(etat.voters);
    if (etat.meetings) setMeetings(etat.meetings);
  }, []);

  const [affichageSimplifie, setAffichageSimplifie] = useState<boolean>(() => {
    try {
      return localStorage.getItem('medivote.affichage') === 'simplifie';
    } catch (_) {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-affichage',
      affichageSimplifie ? 'simplifie' : 'complet'
    );
    try {
      localStorage.setItem('medivote.affichage', affichageSimplifie ? 'simplifie' : 'complet');
    } catch (_) {
      // Navigateur qui refuse le stockage : le mode reste actif pour la session.
    }
  }, [affichageSimplifie]);

  // Toggle table full screen mode
  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreenTable(prev => {
      const next = !prev;
      if (next) {
        setCurrentTab('table');
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } else {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
      return next;
    });
  }, []);

  // Listen for escape or fullscreen change
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreenTable(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Load initial data from SQLite backend
  const loadData = useCallback(async () => {
    if (!sessionOuverte) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [sessionData, historyData, notifsData, listsData] = await Promise.all([
        api.getActiveSession(),
        api.getHistory(),
        api.getNotifications(),
        api.getLists().catch(() => ({ lists: [] })),
      ]);
      appliquerEtat(sessionData);
      setHistory(historyData.history);
      setNotifications(notifsData.notifications);
      setLists(listsData.lists || []);

      // Pre-select first voter if none chosen
      if (!selectedVoterId && sessionData.voters.length > 0) {
        const firstActive = sessionData.voters.find(v => v.isActive) || sessionData.voters[0];
        setSelectedVoterId(firstActive.id);
      }
    } catch (err: any) {
      if (err instanceof SessionExpiree) {
        // La session de la journée a expiré. Si le poste est reconnu, on la rouvre
        // sans rien demander : en séance, une invite de code est une interruption.
        const repris = await auth.estConnecte().catch(() => false);
        if (repris) {
          setLoading(false);
          setRelance(n => n + 1);
          return;
        }
        setSessionOuverte(false);
        setIsAdminPinModalOpen(true);
        setError(null);
      } else {
        console.error('Chargement des données MediVote impossible :', err);
        setError('Le serveur ne répond pas. Vérifiez qu\'il est démarré, puis réessayez.');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedVoterId, sessionOuverte, relance, appliquerEtat]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (session && cibleResolutionEnVol.current === session.id) cibleResolutionEnVol.current = null;
  }, [session?.id]);

  // Le logo est chargé dès l'ouverture pour que le procès-verbal puisse le porter
  // sans attendre, y compris lors d'une édition immédiate après la clôture.
  useEffect(() => { void prechargerLogo(); }, []);

  // Une session peut déjà être ouverte sur ce poste (rechargement de page en séance).
  useEffect(() => {
    let annule = false;
    auth.estConnecte().then(ouverte => {
      if (annule) return;
      setSessionOuverte(ouverte);
      setIsAdminPinModalOpen(!ouverte);
      if (!ouverte) setLoading(false);
    }).catch(() => {
      if (!annule) setLoading(false);
    });
    return () => { annule = true; };
  }, []);

  // Real-time Server-Sent Events (SSE) stream subscription
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: any = null;

    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/events');

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'connected') return;

            // Add to live notifications list (newest first, max 50)
            setNotifications((prev) => [data, ...prev.slice(0, 49)]);

            // If the event affects session state or meetings, refresh active session and meetings
            if (
              data.type === 'vote_cast' ||
              data.type === 'vote_reset' ||
              data.type === 'vote_started' ||
              data.type === 'vote_ended' ||
              data.type === 'presence_changed' ||
              data.type === 'meeting_created' ||
              data.type === 'meeting_switched'
            ) {
              api.getActiveSession().then(appliquerEtat).catch(() => {});
            }
          } catch (_) {}
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
          }
          // Reconnect after 3 seconds
          reconnectTimer = setTimeout(connectSSE, 3000);
        };
      } catch (_) {}
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [appliquerEtat]);

  // Compute live statistics
  const stats = calculateVoteStatistics(session, voters);

  // Vote handler
  const handleVote = async (voterId: string, vote: VoteChoice) => {
    if (!session) return;
    try {
      appliquerEtat(await api.castVote(session.id, voterId, vote));
    } catch (err: any) {
      console.error('Vote error:', err);
      alert('Erreur lors du vote: ' + err.message);
    }
  };

  // Presence handler
  const handleSetPresence = async (voterId: string, presence: PresenceStatus, proxyToId?: string | null) => {
    if (!session) return;
    try {
      appliquerEtat(await api.setPresence(session.id, voterId, presence, proxyToId));
    } catch (err: any) {
      console.error('Presence error:', err);
      alert('Erreur lors de la mise à jour de présence: ' + err.message);
    }
  };

  /*
   * Les QR codes sont fabriqués par le serveur, une fois par séance. On les
   * recharge quand la séance change ou quand sa composition change ; les jetons
   * encore valables sont réutilisés, si bien qu'un membre ayant déjà scanné
   * garde un lien vivant.
   */
  const empreinteConvoques = seance ? seance.selectedAttendeeIds.slice().sort().join(',') : '';
  /*
   * Un échec de chargement des QR codes ne doit pas être définitif. Avant, une
   * seule requête ratée — un serveur qui redémarre, une session reprise — les
   * faisait disparaître des tuiles jusqu'au prochain rechargement de page, sans
   * rien dire. On réessaie, et on garde trace de l'échec pour l'afficher.
   */
  const [liensIndisponibles, setLiensIndisponibles] = useState<boolean>(false);
  const [relanceLiens, setRelanceLiens] = useState<number>(0);
  const rechargerLiensVote = useCallback(() => setRelanceLiens(n => n + 1), []);

  useEffect(() => {
    if (!sessionOuverte || !seance || seance.closedAt) {
      setLiensVote({});
      setLiensIndisponibles(false);
      return;
    }

    let annule = false;
    let minuterie: ReturnType<typeof setTimeout> | null = null;

    const charger = async (essai: number): Promise<void> => {
      try {
        const res = await api.getLiensVote(seance.resolutionCouranteId || seance.id);
        if (annule) return;
        const parVotant: Record<string, LienVote> = {};
        (res.liens || []).forEach(lien => { parVotant[lien.voterId] = lien; });
        setLiensVote(parVotant);
        setLiensIndisponibles(false);
      } catch (err) {
        if (annule) return;
        if (err instanceof SessionExpiree) {
          // La session a pu être reprise entre-temps : on retente une fois.
          const repris = await auth.estConnecte().catch(() => false);
          if (!annule && repris && essai < 3) {
            minuterie = setTimeout(() => void charger(essai + 1), 500);
            return;
          }
        }
        if (essai < 3) {
          minuterie = setTimeout(() => void charger(essai + 1), 1500 * essai);
          return;
        }
        // Sans QR codes, la séance reste pilotable depuis la table : on ne bloque
        // rien, mais on cesse de faire croire qu'ils n'existent pas.
        setLiensVote({});
        setLiensIndisponibles(true);
      }
    };

    void charger(1);
    return () => {
      annule = true;
      if (minuterie) clearTimeout(minuterie);
    };
  }, [sessionOuverte, seance?.id, seance?.closedAt, seance?.resolutionCouranteId, empreinteConvoques, relance, relanceLiens]);

  // Reset votes
  // Ouvre ou suspend le scrutin. Sans effacer aucun suffrage : c'est le sens même
  // de la distinction entre séance active et scrutin ouvert.
  const handleDefinirOuverture = useCallback(async (ouvert: boolean) => {
    if (!session) return;
    try {
      appliquerEtat(await api.definirOuvertureScrutin(session.id, ouvert));
    } catch (err: any) {
      if (err instanceof SessionExpiree) {
        setSessionOuverte(false);
        setIsAdminPinModalOpen(true);
      } else {
        setError(err?.message || "Le scrutin n'a pas pu être ouvert.");
      }
    }
  }, [session]);

  const handleResetVotes = async () => {
    if (!session) return;
    if (!window.confirm(
      'Voulez-vous réinitialiser tous les suffrages de cette séance ?\n\n' +
      'Le scrutin sera refermé : il faudra le rouvrir pour un nouveau tour.'
    )) return;
    try {
      appliquerEtat(await api.resetVotes(session.id));
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    }
  };

  // Quick vote all "Pour"
  const handleQuickVoteAllFor = async () => {
    if (!session) return;
    try {
      const activeVoters = voters.filter(v => v.isActive);
      for (const v of activeVoters) {
        const curPresence = session.voterStates[v.id]?.presence || 'present';
        if (curPresence === 'present' || curPresence === 'proxy') {
          await api.castVote(session.id, v.id, 'for');
        }
      }
      appliquerEtat(await api.getActiveSession());
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    }
  };

  // Simulate realistic votes for boardroom test
  const handleSimulateRandomVotes = async () => {
    if (!session) return;
    try {
      const activeVoters = voters.filter(v => v.isActive);
      const choices: VoteChoice[] = ['for', 'for', 'for', 'for', 'against', 'abstain'];
      for (const v of activeVoters) {
        const curPresence = session.voterStates[v.id]?.presence || 'present';
        if (curPresence === 'present' || curPresence === 'proxy') {
          const randomChoice = choices[Math.floor(Math.random() * choices.length)];
          await api.castVote(session.id, v.id, randomChoice);
        }
      }
      appliquerEtat(await api.getActiveSession());
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    }
  };

  // Close session & archive to SQLite
  const handleConfirmClose = async () => {
    if (!session) return;
    try {
      const res = await api.closeSession(session.id, stats);
      appliquerEtat(res);
      setHistory(res.history);
      setIsCloseModalOpen(false);
    } catch (err: any) {
      alert('Erreur lors de la clôture: ' + err.message);
    }
  };

  /* --- Séance et ordre du jour --------------------------------------- */

  /** Ajoute un point à l'ordre du jour. Utilisable en pleine séance. */
  const handleAjouterResolution = async (
    donnees: Partial<VotingSession> & { attendeeIds?: string[] }
  ) => {
    const seanceCible = seance?.id || session?.seanceId;
    if (!seanceCible) throw new Error('Aucune séance en cours.');
    const res = await api.ajouterResolution(seanceCible, donnees);
    appliquerEtat(res);
  };

  /** Présente un autre point de l'ordre du jour, sans rien ouvrir ni fermer. */
  const handleSwitchResolution = useCallback(async (resolutionId: string) => {
    cibleResolutionEnVol.current = resolutionId;
    try {
      appliquerEtat(await api.switchResolution(resolutionId));
    } catch (err: any) {
      alert('Erreur lors du changement de résolution : ' + err.message);
    }
  }, [appliquerEtat]);

  /**
   * Avance ou recule d'un point dans l'ordre du jour, points déjà votés compris.
   *
   * Le changement fait un aller-retour par le serveur : deux appuis rapprochés
   * partiraient sinon du même point de départ et n'avanceraient que d'un. On
   * retient donc la dernière cible demandée tant que la séance n'a pas rattrapé.
   */
  const handleDeplacerResolution = useCallback((pas: number) => {
    const points = seance?.resolutions || [];
    if (points.length === 0) return;
    const depart = cibleResolutionEnVol.current || session?.id;
    const i = points.findIndex(r => r.id === depart);
    const cible = i === -1 ? undefined : points[i + pas];
    if (cible) void handleSwitchResolution(cible.id);
  }, [seance, session?.id, handleSwitchResolution]);

  /*
   * En plein écran, les touches ← et → font défiler l'ordre du jour. C'est ce
   * qui permet de piloter la séance avec une télécommande de présentation, sans
   * revenir au clavier ni sortir de l'affichage de la salle.
   */
  useEffect(() => {
    if (!isFullscreenTable || currentTab !== 'table') return;
    const auClavier = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null;
      if (cible && /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName)) return;
      if (isCloseModalOpen || isAjoutResolutionOpen || isModeModalOpen || isAdminPinModalOpen) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); handleDeplacerResolution(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); handleDeplacerResolution(1); }
    };
    window.addEventListener('keydown', auClavier);
    return () => window.removeEventListener('keydown', auClavier);
  }, [isFullscreenTable, currentTab, handleDeplacerResolution, isCloseModalOpen, isAjoutResolutionOpen, isModeModalOpen, isAdminPinModalOpen]);

  const handleSaveSeance = async (donnees: Partial<Seance> & { attendeeIds?: string[] }) => {
    const res = await api.saveSeance(donnees);
    appliquerEtat(res);
  };

  const handleSwitchSeance = async (seanceId: string) => {
    try {
      appliquerEtat(await api.switchSeance(seanceId));
    } catch (err: any) {
      alert('Erreur lors du changement de séance : ' + err.message);
    }
  };

  /** Clôt la séance entière : elle est scellée et les liens de vote tombent. */
  const handleCloseSeance = async (seanceId: string) => {
    const cible = seances.find(se => se.id === seanceId);
    const restantes = (cible?.resolutions || []).filter(r => r.status !== 'closed').length;
    if (!window.confirm(
      `Clore définitivement la séance « ${cible?.title || ''} » ?\n\n` +
      (restantes > 0
        ? `${restantes} résolution(s) n'ont pas été soumises au vote : elles seront classées sans suite.\n\n`
        : '') +
      'Les liens de vote des membres seront révoqués et la séance ne pourra plus être rouverte.'
    )) return;
    try {
      const res = await api.closeSeance(seanceId);
      appliquerEtat(res);
      setHistory(res.history);
    } catch (err: any) {
      alert('Erreur lors de la clôture de la séance : ' + err.message);
    }
  };

  const handleDeleteSeance = async (seanceId: string) => {
    const cible = seances.find(se => se.id === seanceId);
    if (!window.confirm(
      `Supprimer définitivement la séance « ${cible?.title || ''} » et ses ${cible?.resolutions.length || 0} résolution(s) ?\n\nCette action est irréversible.`
    )) return;
    try {
      appliquerEtat(await api.deleteSeance(seanceId));
    } catch (err: any) {
      alert('Erreur : ' + err.message);
    }
  };

  // Save/Update session (from admin)
  const handleSaveSession = async (sessionData: Partial<VotingSession> & { attendeeIds?: string[] }) => {
    appliquerEtat(await api.saveSession(sessionData));
  };

  // Create new meeting
  const handleCreateMeeting = async (meetingData: Partial<VotingSession> & { attendeeIds?: string[] }) => {
    appliquerEtat(await api.createMeeting(meetingData));
  };

  // Switch active meeting
  const handleSwitchMeeting = async (meetingId: string) => {
    try {
      appliquerEtat(await api.switchMeeting(meetingId));
    } catch (err: any) {
      alert('Erreur lors du changement de séance: ' + err.message);
    }
  };

  // Delete meeting
  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      appliquerEtat(await api.deleteMeeting(meetingId));
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    }
  };

  // Duplicate meeting
  const handleDuplicateMeeting = async (meetingId: string) => {
    try {
      appliquerEtat(await api.duplicateMeeting(meetingId));
    } catch (err: any) {
      alert('Erreur lors de la duplication: ' + err.message);
    }
  };

  // Save voter (from admin)
  const handleSaveVoter = async (voterData: Partial<Voter> & { name: string }) => {
    appliquerEtat(await api.saveVoter(voterData));
  };

  // Delete voter (from admin)
  const handleDeleteVoter = async (id: string) => {
    if (!window.confirm('Supprimer ce membre du collège des votants ?')) return;
    appliquerEtat(await api.deleteVoter(id));
  };

  // Delete history item
  const handleDeleteHistory = async (id: string) => {
    const res = await api.deleteHistory(id);
    setHistory(res.history);
  };

  // Clear notifications
  const handleClearNotifications = async () => {
    try {
      await api.clearNotifications();
      setNotifications([]);
    } catch (_) {
      setNotifications([]);
    }
  };

  // Apply voter list (e.g. CA, CC, Bureau) to active session
  const handleApplyList = async (listId: string) => {
    if (!session) return;
    try {
      setLoading(true);
      appliquerEtat(await api.applyList(session.id, listId));
    } catch (err: any) {
      alert('Erreur lors de l\'application de la liste: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Save / create voter list
  const handleSaveList = async (listData: Partial<VoterList> & { name: string; voterIds: string[] }) => {
    try {
      const res = await api.saveList(listData);
      setLists(res.lists);
    } catch (err: any) {
      alert('Erreur lors de l\'enregistrement de la liste: ' + err.message);
    }
  };

  // Delete voter list
  const handleDeleteList = async (id: string) => {
    if (!window.confirm('Supprimer cette liste de votants ?')) return;
    try {
      const res = await api.deleteList(id);
      setLists(res.lists);
    } catch (err: any) {
      alert('Erreur lors de la suppression de la liste: ' + err.message);
    }
  };

  // Import voters from text
  const handleImportVoters = async (text: string, listCode?: string) => {
    try {
      setLoading(true);
      const res = await api.importVoters(text, listCode);
      appliquerEtat(res);
      setLists(res.lists);
      alert(`${res.count} votants importés avec succès !`);
    } catch (err: any) {
      alert('Erreur lors de l\'importation: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reset to default demo data
  const handleResetDemo = async () => {
    if (!window.confirm('Réinitialiser l\'ensemble de la base SQLite aux données hospitalières de démonstration ?')) return;
    try {
      setLoading(true);
      const res = await api.resetDemo();
      appliquerEtat(res);
      setHistory(res.history);
      const lRes = await api.getLists().catch(() => ({ lists: [] }));
      setLists(lRes.lists);
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Mode Selection Callbacks
  const handleSelectVoter = (voterId: string) => {
    setSelectedVoterId(voterId);
    setAppMode('voter');
    setIsModeModalOpen(false);
  };

  const handleSelectAdmin = () => {
    setAppMode('admin');
    setIsModeModalOpen(false);
  };

  // Écran de garde : sans session administrateur ouverte côté serveur, rien ne s'affiche.
  // La fenêtre de saisie occupe tout l'écran, il n'y a donc rien à peindre derrière.
  if (!sessionOuverte) {
    return (
      <div className="min-h-screen bg-[#F4F7F5]">
        <AdminPinModal
          isOpen={true}
          fermable={false}
          onClose={() => {}}
          onSuccess={() => {
            setSessionOuverte(true);
            setIsAdminPinModalOpen(false);
            setAppMode('admin');
          }}
        />
      </div>
    );
  }

  if (loading && !session) {
    return (
      <div className="min-h-screen bg-[#F4F7F5] flex flex-col items-center justify-center text-slate-600 gap-4">
        <img
          src="/logo-ssti03.png"
          alt="SSTI 03 — Allier Prévention Santé Entreprises"
          className="w-16 h-16 object-contain"
        />
        <div className="text-center">
          <h2 className="text-base font-bold text-slate-900">Ouverture de la séance</h2>
          <p className="text-xs text-slate-500 mt-1 inline-flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Chargement du registre de vote…
          </p>
        </div>
      </div>
    );
  }

  // 1. FULL-PAGE SIMPLIFIED VOTER MODE
  if (appMode === 'voter') {
    return (
      <>
        <VoterFullPageView
          session={session}
          voters={voters}
          activeVoterId={selectedVoterId || voters[0]?.id || ''}
          onVote={handleVote}
          onSetPresence={handleSetPresence}
          onChangeVoter={() => setIsModeModalOpen(true)}
          onRequestAdmin={() => setIsAdminPinModalOpen(true)}
        />

        {/* Mode Selector Modal on Demand */}
        <ModeSelectionModal
          isOpen={isModeModalOpen}
          voters={voters}
          session={session}
          lists={lists}
          onSelectVoter={handleSelectVoter}
          onSelectAdmin={handleSelectAdmin}
        />

        {/* Vérification du code administrateur (le code est contrôlé par le serveur) */}
        <AdminPinModal
          isOpen={isAdminPinModalOpen}
          onClose={() => setIsAdminPinModalOpen(false)}
          onSuccess={() => {
            setSessionOuverte(true);
            setAppMode('admin');
            setIsAdminPinModalOpen(false);
          }}
        />
      </>
    );
  }

  // 2. ADMIN & BOARDROOM TABLE OVALE MODE
  return (
    <div className="min-h-screen bg-[#F4F7F5] text-slate-800 flex flex-col selection:bg-emerald-500 selection:text-white">
      
      {/* Top Navigation with Mode Selector Button */}
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        session={session}
        seance={seance}
        seances={seances}
        onSwitchSeance={handleSwitchSeance}
        onSwitchResolution={handleSwitchResolution}
        onDeplacerResolution={handleDeplacerResolution}
        onAjouterResolution={() => setIsAjoutResolutionOpen(true)}
        meetings={meetings}
        stats={stats}
        notifications={notifications}
        soundEnabled={soundEnabled}
        isFullscreenTable={isFullscreenTable}
        onToggleFullscreenTable={handleToggleFullscreen}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        affichageSimplifie={affichageSimplifie}
        onToggleAffichageSimplifie={() => setAffichageSimplifie(v => !v)}
        onDefinirOuverture={handleDefinirOuverture}
        onCloseSession={() => setIsCloseModalOpen(true)}
        onClearNotifications={handleClearNotifications}
        onSwitchMeeting={handleSwitchMeeting}
        onResetVotes={handleResetVotes}
        onQuickVoteAllFor={handleQuickVoteAllFor}
        onSimulateRandomVotes={handleSimulateRandomVotes}
        onOpenModeModal={() => setIsModeModalOpen(true)}
      />

      {/* Error notification */}
      {error && (
        <div className="max-w-[1800px] mx-auto px-6 mt-5">
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>{error}</span>
            </div>
            <button
              onClick={loadData}
              className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs"
            >
              Réessayer
            </button>
          </div>
        </div>
      )}

      {/* Main View Area */}
      <main className={`flex-1 ${isFullscreenTable && currentTab === 'table' ? 'pb-2' : 'pb-12'}`}>
        {currentTab === 'table' && (
          <OvalTable
            session={session}
            voters={voters}
            stats={stats}
            isFullscreen={isFullscreenTable}
            onToggleFullscreen={handleToggleFullscreen}
            onVote={handleVote}
            onSetPresence={handleSetPresence}
            onResetVotes={handleResetVotes}
            onDefinirOuverture={handleDefinirOuverture}
            liensVote={liensVote}
            liensIndisponibles={liensIndisponibles}
            onRechargerLiens={rechargerLiensVote}
            seance={seance}
            onSwitchResolution={handleSwitchResolution}
            onAjouterResolution={() => setIsAjoutResolutionOpen(true)}
            onCloseSession={() => setIsCloseModalOpen(true)}
            onOpenAdmin={() => setCurrentTab('admin')}
            onQuickVoteAllFor={handleQuickVoteAllFor}
            onSimulateRandomVotes={handleSimulateRandomVotes}
          />
        )}

        {currentTab === 'kiosk' && (
          <KioskView
            session={session}
            voters={voters}
            onVote={handleVote}
            onSetPresence={(voterId, presence) => handleSetPresence(voterId, presence)}
            onNavigateToTable={() => setCurrentTab('table')}
            onChangeVoter={() => setIsModeModalOpen(true)}
          />
        )}

        {currentTab === 'admin' && (
          <AdminPanel
            session={session}
            seance={seance}
            seances={seances}
            onSwitchSeance={handleSwitchSeance}
            onSaveSeance={handleSaveSeance}
            onCloseSeance={handleCloseSeance}
            onDeleteSeance={handleDeleteSeance}
            onSwitchResolution={handleSwitchResolution}
            onOuvrirAjoutResolution={() => setIsAjoutResolutionOpen(true)}
            voters={voters}
            meetings={meetings}
            history={history}
            lists={lists}
            onSetPresence={handleSetPresence}
            onVote={handleVote}
            onSaveSession={handleSaveSession}
            onCreateMeeting={handleCreateMeeting}
            onSwitchMeeting={handleSwitchMeeting}
            onDeleteMeeting={handleDeleteMeeting}
            onDuplicateMeeting={handleDuplicateMeeting}
            onSaveVoter={handleSaveVoter}
            onDeleteVoter={handleDeleteVoter}
            onDeleteHistoryItem={handleDeleteHistory}
            onApplyList={handleApplyList}
            onSaveList={handleSaveList}
            onDeleteList={handleDeleteList}
            onImportVoters={handleImportVoters}
            onResetDemo={handleResetDemo}
            onNavigateToTable={() => setCurrentTab('table')}
            onNavigateToArchives={() => setCurrentTab('history')}
          />
        )}

        {currentTab === 'history' && (
          <HistoryPanel
            history={history}
            onDeleteHistory={handleDeleteHistory}
            onNavigateToTable={() => setCurrentTab('table')}
          />
        )}
      </main>

      {/* Mode Selection Modal */}
      <ModeSelectionModal
        isOpen={isModeModalOpen}
        voters={voters}
        session={session}
        lists={lists}
        onSelectVoter={handleSelectVoter}
        onSelectAdmin={handleSelectAdmin}
      />

      {/* Ajout d'un point à l'ordre du jour, y compris en pleine séance */}
      <AjouterResolutionModal
        isOpen={isAjoutResolutionOpen}
        seance={seance}
        onClose={() => setIsAjoutResolutionOpen(false)}
        onAjouter={handleAjouterResolution}
      />

      {/* Close & Archive Modal */}
      {session && (
        <CloseSessionModal
          session={session}
          voters={voters}
          stats={stats}
          isOpen={isCloseModalOpen}
          onClose={() => setIsCloseModalOpen(false)}
          onConfirmClose={handleConfirmClose}
        />
      )}

      {/* Discreet Footer */}
      {!isFullscreenTable && (
        <footer className="border-t border-slate-200/80 bg-white/80 backdrop-blur-sm px-4 py-2.5 text-center text-slate-500 text-xs flex flex-col sm:flex-row items-center justify-between max-w-[1800px] mx-auto w-full gap-2 mt-auto">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="font-medium text-slate-700">MediVote — SSTI 03</span>
          </div>
          <div className="flex items-center gap-3 text-[0.6875rem] text-slate-500">
            <span className="mv-technique font-mono">Base locale · synchro directe</span>
            <span className="mv-technique">•</span>
            <span>{voters.filter(v => v.isActive).length} membres au répertoire</span>
          </div>
        </footer>
      )}

    </div>
  );
}
