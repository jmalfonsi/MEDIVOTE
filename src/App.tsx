import React, { useState, useEffect, useCallback } from 'react';
import { 
  VotingSession, 
  Voter, 
  SessionHistoryItem, 
  VoteChoice, 
  PresenceStatus,
  MeetingItem,
  RealtimeNotification,
  VoterList
} from './types';
import { api, auth, SessionExpiree } from './services/api';
import { calculateVoteStatistics } from './utils/votingMath';
import { Navbar } from './components/Navbar';
import { OvalTable } from './components/OvalTable';
import { AdminPanel } from './components/AdminPanel';
import { KioskView } from './components/KioskView';
import { HistoryPanel } from './components/HistoryPanel';
import { CloseSessionModal } from './components/CloseSessionModal';
import { ModeSelectionModal } from './components/ModeSelectionModal';
import { AdminPinModal } from './components/AdminPinModal';
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
  const [voters, setVoters] = useState<Voter[]>([]);
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [history, setHistory] = useState<SessionHistoryItem[]>([]);
  const [lists, setLists] = useState<VoterList[]>([]);
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState<boolean>(false);
  // Tant que le serveur n'a pas reconnu une session administrateur, rien n'est chargé.
  const [sessionOuverte, setSessionOuverte] = useState<boolean>(false);

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
      const [sessionData, historyData, meetingsData, notifsData, listsData] = await Promise.all([
        api.getActiveSession(),
        api.getHistory(),
        api.getMeetings(),
        api.getNotifications(),
        api.getLists().catch(() => ({ lists: [] })),
      ]);
      setSession(sessionData.session);
      setVoters(sessionData.voters);
      setHistory(historyData.history);
      setMeetings(meetingsData.meetings);
      setNotifications(notifsData.notifications);
      setLists(listsData.lists || []);

      // Pre-select first voter if none chosen
      if (!selectedVoterId && sessionData.voters.length > 0) {
        const firstActive = sessionData.voters.find(v => v.isActive) || sessionData.voters[0];
        setSelectedVoterId(firstActive.id);
      }
    } catch (err: any) {
      if (err instanceof SessionExpiree) {
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
  }, [selectedVoterId, sessionOuverte]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
              api.getActiveSession().then(res => {
                setSession(res.session);
                setVoters(res.voters);
              }).catch(() => {});

              api.getMeetings().then(res => {
                setMeetings(res.meetings);
              }).catch(() => {});
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
  }, []);

  // Compute live statistics
  const stats = calculateVoteStatistics(session, voters);

  // Vote handler
  const handleVote = async (voterId: string, vote: VoteChoice) => {
    if (!session) return;
    try {
      const res = await api.castVote(session.id, voterId, vote);
      setSession(res.session);
      setVoters(res.voters);
    } catch (err: any) {
      console.error('Vote error:', err);
      alert('Erreur lors du vote: ' + err.message);
    }
  };

  // Presence handler
  const handleSetPresence = async (voterId: string, presence: PresenceStatus, proxyToId?: string | null) => {
    if (!session) return;
    try {
      const res = await api.setPresence(session.id, voterId, presence, proxyToId);
      setSession(res.session);
      setVoters(res.voters);
    } catch (err: any) {
      console.error('Presence error:', err);
      alert('Erreur lors de la mise à jour de présence: ' + err.message);
    }
  };

  // Reset votes
  const handleResetVotes = async () => {
    if (!session) return;
    if (!window.confirm('Voulez-vous réinitialiser tous les votes de cette séance ?')) return;
    try {
      const res = await api.resetVotes(session.id);
      setSession(res.session);
      setVoters(res.voters);
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
      const refreshed = await api.getActiveSession();
      setSession(refreshed.session);
      setVoters(refreshed.voters);
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
      const refreshed = await api.getActiveSession();
      setSession(refreshed.session);
      setVoters(refreshed.voters);
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    }
  };

  // Close session & archive to SQLite
  const handleConfirmClose = async () => {
    if (!session) return;
    try {
      const res = await api.closeSession(session.id, stats);
      setSession(res.session);
      setHistory(res.history);
      setVoters(res.voters);
      setIsCloseModalOpen(false);
      
      // Refresh meetings list to update statuses
      const mRes = await api.getMeetings();
      setMeetings(mRes.meetings);
    } catch (err: any) {
      alert('Erreur lors de la clôture: ' + err.message);
    }
  };

  // Save/Update session (from admin)
  const handleSaveSession = async (sessionData: Partial<VotingSession> & { attendeeIds?: string[] }) => {
    const res = await api.saveSession(sessionData);
    setSession(res.session);
    setVoters(res.voters);
    const mRes = await api.getMeetings();
    setMeetings(mRes.meetings);
  };

  // Create new meeting
  const handleCreateMeeting = async (meetingData: Partial<VotingSession> & { attendeeIds?: string[] }) => {
    const res = await api.createMeeting(meetingData);
    setSession(res.session);
    setVoters(res.voters);
    const mRes = await api.getMeetings();
    setMeetings(mRes.meetings);
  };

  // Switch active meeting
  const handleSwitchMeeting = async (meetingId: string) => {
    try {
      const res = await api.switchMeeting(meetingId);
      setSession(res.session);
      setVoters(res.voters);
      const mRes = await api.getMeetings();
      setMeetings(mRes.meetings);
    } catch (err: any) {
      alert('Erreur lors du changement de séance: ' + err.message);
    }
  };

  // Delete meeting
  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      const res = await api.deleteMeeting(meetingId);
      if (res.session) {
        setSession(res.session);
        setVoters(res.voters);
      }
      const mRes = await api.getMeetings();
      setMeetings(mRes.meetings);
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    }
  };

  // Duplicate meeting
  const handleDuplicateMeeting = async (meetingId: string) => {
    try {
      const res = await api.duplicateMeeting(meetingId);
      setSession(res.session);
      setVoters(res.voters);
      const mRes = await api.getMeetings();
      setMeetings(mRes.meetings);
    } catch (err: any) {
      alert('Erreur lors de la duplication: ' + err.message);
    }
  };

  // Save voter (from admin)
  const handleSaveVoter = async (voterData: Partial<Voter> & { name: string }) => {
    const res = await api.saveVoter(voterData);
    setVoters(res.voters);
    if (res.session) setSession(res.session);
  };

  // Delete voter (from admin)
  const handleDeleteVoter = async (id: string) => {
    if (!window.confirm('Supprimer ce membre du collège des votants ?')) return;
    const res = await api.deleteVoter(id);
    setVoters(res.voters);
    if (res.session) setSession(res.session);
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
      const res = await api.applyList(session.id, listId);
      setSession(res.session);
      setVoters(res.voters);
      if (res.meetings) setMeetings(res.meetings);
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
      setVoters(res.voters);
      setLists(res.lists);
      if (res.session) setSession(res.session);
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
      setSession(res.session);
      setVoters(res.voters);
      setHistory(res.history);
      const mRes = await api.getMeetings();
      setMeetings(mRes.meetings);
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
  if (!sessionOuverte) {
    return (
      <div className="min-h-screen bg-[#F4F7F5] flex flex-col items-center justify-center gap-6 p-4">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900 mt-3">MediVote — accès protégé</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">
            Cette séance est verrouillée. Saisissez le code administrateur pour ouvrir la table de vote.
          </p>
        </div>
        <AdminPinModal
          isOpen={true}
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
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 animate-spin shadow-xs">
          <RefreshCw className="w-6 h-6" />
        </div>
        <div className="text-center">
          <h2 className="text-base font-bold text-slate-900">Initialisation de Medivote Pro</h2>
          <p className="text-xs text-slate-500 mt-1 font-mono">Connexion à la base SQLite locale...</p>
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
        meetings={meetings}
        stats={stats}
        notifications={notifications}
        soundEnabled={soundEnabled}
        isFullscreenTable={isFullscreenTable}
        onToggleFullscreenTable={handleToggleFullscreen}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        onClearNotifications={handleClearNotifications}
        onSwitchMeeting={handleSwitchMeeting}
        onResetVotes={handleResetVotes}
        onQuickVoteAllFor={handleQuickVoteAllFor}
        onSimulateRandomVotes={handleSimulateRandomVotes}
        onOpenModeModal={() => setIsModeModalOpen(true)}
      />

      {/* Error notification */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
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
        <footer className="border-t border-slate-200/80 bg-white/80 backdrop-blur-sm px-4 py-2.5 text-center text-slate-500 text-xs flex flex-col sm:flex-row items-center justify-between max-w-7xl mx-auto w-full gap-2 mt-auto">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="font-medium text-slate-700">Système de Vote Médical Certifié • Medivote Pro</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500">
            <span>Persistance SQLite Active</span>
            <span>•</span>
            <span>SSE Synchro Directe</span>
            <span>•</span>
            <span>{voters.filter(v => v.isActive).length} Votants</span>
          </div>
        </footer>
      )}

    </div>
  );
}
