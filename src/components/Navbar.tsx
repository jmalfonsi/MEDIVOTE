import React, { useState } from 'react';
import { 
  Vote, 
  Settings, 
  History, 
  Users, 
  RotateCcw, 
  CheckCircle2, 
  Volume2, 
  VolumeX, 
  ShieldCheck, 
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  FileText,
  ChevronDown,
  Plus,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ListOrdered,
  CircleDot,
  ChevronLeft,
  ChevronRight,
  XCircle
} from 'lucide-react';
import { VotingSession, VoteStatistics, MeetingItem, RealtimeNotification, Seance } from '../types';
import { NotificationCenter } from './NotificationCenter';

interface NavbarProps {
  currentTab: 'table' | 'kiosk' | 'admin' | 'history';
  onTabChange: (tab: 'table' | 'kiosk' | 'admin' | 'history') => void;
  session: VotingSession | null;
  /** Séance affichée, avec son ordre du jour. */
  seance?: Seance | null;
  seances?: Seance[];
  onSwitchSeance?: (seanceId: string) => void;
  onSwitchResolution?: (resolutionId: string) => void;
  /** Avance (+1) ou recule (-1) d'un point dans l'ordre du jour. */
  onDeplacerResolution?: (pas: number) => void;
  onAjouterResolution?: () => void;
  meetings: MeetingItem[];
  stats: VoteStatistics;
  notifications: RealtimeNotification[];
  soundEnabled: boolean;
  isFullscreenTable?: boolean;
  onToggleFullscreenTable?: () => void;
  /** Commandes du scrutin, remontées ici quand la table occupe tout l'écran. */
  onDefinirOuverture?: (ouvert: boolean) => void;
  onCloseSession?: () => void;
  onToggleSound: () => void;
  onClearNotifications: () => void;
  onSwitchMeeting: (meetingId: string) => Promise<void>;
  onResetVotes: () => void;
  onQuickVoteAllFor: () => void;
  onSimulateRandomVotes: () => void;
  onOpenModeModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  session,
  seance = null,
  seances = [],
  onSwitchSeance,
  onSwitchResolution,
  onDeplacerResolution,
  onAjouterResolution,
  meetings,
  stats,
  notifications,
  soundEnabled,
  isFullscreenTable = false,
  onToggleFullscreenTable,
  onDefinirOuverture,
  onCloseSession,
  onToggleSound,
  onClearNotifications,
  onSwitchMeeting,
  onResetVotes,
  onQuickVoteAllFor,
  onSimulateRandomVotes,
  onOpenModeModal,
  affichageSimplifie = false,
  onToggleAffichageSimplifie,
}) => {
  const [isMeetingDropdownOpen, setIsMeetingDropdownOpen] = useState(false);

  /*
   * Position dans l'ordre du jour, et ce qu'il reste à voter. Le parcours couvre
   * TOUS les points, clôturés compris : on doit pouvoir revenir montrer un
   * résultat déjà acquis.
   */
  const points = seance?.resolutions ?? [];
  const rang = session ? points.findIndex(r => r.id === session.id) : -1;
  const precedente = rang > 0 ? points[rang - 1] : null;
  const suivante = rang >= 0 && rang < points.length - 1 ? points[rang + 1] : null;
  /** Points dont le scrutin n'est pas encore clôturé. */
  const votesRestants = points.filter(r => r.status !== 'closed').length;

  /*
   * En plein écran, le parcours de l'ordre du jour prend la place laissée par le
   * bandeau de la table. Les onglets se réduisent alors à leurs icônes : on ne
   * change pas d'écran pendant qu'on préside, et les libellés déborderaient.
   */
  const ongletsCompacts = isFullscreenTable && currentTab === 'table' && points.length > 0;

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-3 sm:px-5 py-1.5 transition-all shadow-2xs">
      <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Medical Brand & Active Meeting Switcher */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <img
              src="/logo-ssti03.png"
              alt="SSTI 03 — Allier Prévention Santé Entreprises"
              className="h-9 w-auto object-contain"
            />
            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-slate-900 leading-none">
                  Medivote V1.0
                </span>
              </div>
            </div>
          </div>

          {/* Sélecteur de séance, puis de point à l'ordre du jour. Une séance en
              porte plusieurs : le premier niveau choisit la réunion, le second
              la résolution qu'on présente sur la table. */}
          {(seances.length > 0 || meetings.length > 0) && (
            <div className="relative">
              <button
                onClick={() => setIsMeetingDropdownOpen(!isMeetingDropdownOpen)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition"
                title={seance ? `${seance.title} — point n° ${session?.ordre || 1} sur ${seance.resolutions.length}` : 'Séances'}
              >
                <Calendar className="w-3 h-3 text-emerald-600" />
                <span className="max-w-[120px] sm:max-w-[150px] truncate">{session?.referenceCode || seance?.referenceCode || 'Séances'}</span>
                {seance && seance.resolutions.length > 1 && (
                  <span className="px-1 rounded bg-emerald-100 text-emerald-800 font-mono text-[0.5625rem]">
                    {session?.ordre || 1}/{seance.resolutions.length}
                  </span>
                )}
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isMeetingDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsMeetingDropdownOpen(false)} />
                  <div className="absolute left-0 mt-1.5 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 p-2 space-y-2 animate-in fade-in zoom-in-95">

                    {seance && (
                      <div className="space-y-1">
                        <div className="px-2 py-1 text-[0.625rem] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <ListOrdered className="w-3 h-3 text-emerald-600" />
                          Ordre du jour — {seance.title}
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {seance.resolutions.map(r => (
                            <button
                              key={r.id}
                              onClick={() => {
                                setIsMeetingDropdownOpen(false);
                                if (r.id !== session?.id) onSwitchResolution?.(r.id);
                              }}
                              className={`w-full p-2 rounded-xl text-left text-xs transition flex items-start justify-between gap-2 ${
                                r.id === session?.id
                                  ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200'
                                  : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <div className="truncate">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-[0.625rem] text-slate-400">n° {r.ordre}</span>
                                  <span className="font-mono text-[0.625rem] text-emerald-700">{r.referenceCode}</span>
                                  {r.status === 'closed' && (
                                    <span className="text-[0.5625rem] px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 font-semibold">
                                      {r.outcome === 'adopted' ? 'Adoptée' : r.outcome === 'rejected' ? 'Rejetée' : 'Close'}
                                    </span>
                                  )}
                                </div>
                                <span className="truncate block font-semibold">{r.title}</span>
                              </div>
                              {r.status === 'open' && <CircleDot className="w-3 h-3 text-emerald-600 mt-1 shrink-0 animate-pulse" />}
                            </button>
                          ))}
                        </div>
                        {!seance.closedAt && onAjouterResolution && (
                          <button
                            onClick={() => {
                              setIsMeetingDropdownOpen(false);
                              onAjouterResolution();
                            }}
                            className="w-full py-1.5 px-2 rounded-lg text-center text-xs font-semibold text-emerald-700 hover:bg-emerald-50 border border-dashed border-emerald-300 transition flex items-center justify-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Ajouter un vote à cette séance
                          </button>
                        )}
                      </div>
                    )}

                    {seances.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-slate-100">
                        <div className="px-2 py-1 text-[0.625rem] font-bold text-slate-400 uppercase tracking-wider">
                          Séances enregistrées ({seances.length})
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {seances.map(se => (
                            <button
                              key={se.id}
                              onClick={() => {
                                setIsMeetingDropdownOpen(false);
                                if (se.closedAt) onTabChange('history');
                                else if (!se.surLaTable) onSwitchSeance?.(se.id);
                              }}
                              className={`w-full p-2 rounded-xl text-left text-xs transition flex items-start justify-between gap-2 ${
                                se.surLaTable
                                  ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200'
                                  : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <div className="truncate">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-[0.625rem] text-emerald-700">{se.referenceCode}</span>
                                  {se.closedAt && (
                                    <span className="text-[0.5625rem] px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 font-semibold">
                                      Close
                                    </span>
                                  )}
                                </div>
                                <span className="truncate block font-semibold">{se.title}</span>
                                <span className="text-[0.625rem] text-slate-500">
                                  {se.scheduledDate} • {se.resolutions.length} résolution{se.resolutions.length > 1 ? 's' : ''}
                                </span>
                              </div>
                              {se.surLaTable && <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-1 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setIsMeetingDropdownOpen(false);
                          onTabChange('admin');
                        }}
                        className="w-full py-1.5 px-2 rounded-lg text-center text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition flex items-center justify-center gap-1"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        Gérer les séances (Admin)
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* PARCOURS DE L'ORDRE DU JOUR EN PLEIN ÉCRAN
            En plein écran, le bandeau des résolutions de la table disparaît, et
            le pourtour de l'ovale est occupé par les sièges : c'est ici, dans la
            seule bande libre de l'écran, que le président passe d'un vote à
            l'autre — flèches, ou touches ← et →. */}
        {isFullscreenTable && currentTab === 'table' && seance && seance.resolutions.length > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onDeplacerResolution?.(-1)}
              disabled={!precedente}
              aria-label="Point précédent de l'ordre du jour"
              title={precedente ? `Point précédent : ${precedente.title}  (touche ←)` : "Premier point de l'ordre du jour"}
              className={`flex items-center justify-center rounded-lg border h-8 w-8 transition ${
                precedente
                  ? 'bg-white border-slate-200 text-slate-700 hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-800 shadow-2xs'
                  : 'bg-slate-50 border-slate-100 text-slate-200 cursor-not-allowed'
              }`}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-1 shadow-2xs">
              <div className="leading-tight">
                <div className="text-[0.5625rem] font-bold uppercase tracking-wider text-slate-400">
                  Ordre du jour
                </div>
                <div className="text-xs font-bold text-slate-900 tabular-nums whitespace-nowrap">
                  Point {session?.ordre ?? 1} <span className="font-normal text-slate-400">sur</span> {seance.resolutions.length}
                </div>
              </div>

              <div className="h-7 w-px bg-slate-200" />

              {/* Le chiffre qui doit se lire du fond de la salle. */}
              {votesRestants > 0 ? (
                <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                  <span className="text-2xl font-black leading-none text-amber-600 tabular-nums">
                    {votesRestants}
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    vote{votesRestants > 1 ? 's' : ''} restant{votesRestants > 1 ? 's' : ''}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 whitespace-nowrap text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-xs font-bold">Tous les votes sont clôturés</span>
                </div>
              )}

              {/* Repères : ce qui est voté, ce qui reste. Cliquables. */}
              <div className="hidden lg:flex items-center gap-1 pl-1 border-l border-slate-200">
                {seance.resolutions.map(r => {
                  const courante = r.id === session?.id;
                  const close = r.status === 'closed';
                  return (
                    <button
                      key={r.id}
                      onClick={() => { if (!courante) onSwitchResolution?.(r.id); }}
                      title={`${r.ordre}. ${r.title} — ${close ? 'scrutin clôturé' : r.status === 'open' ? 'scrutin ouvert' : 'scrutin non ouvert'}`}
                      className={`flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[0.6875rem] font-bold transition ${
                        courante
                          ? 'bg-emerald-600 text-white'
                          : close
                            ? 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      <span className="tabular-nums">{r.ordre}</span>
                      {close && r.outcome === 'adopted' && <CheckCircle2 className={`w-3 h-3 ${courante ? 'text-white' : 'text-emerald-600'}`} />}
                      {close && (r.outcome === 'rejected' || r.outcome === 'quorum_not_reached') && <XCircle className={`w-3 h-3 ${courante ? 'text-white' : 'text-rose-500'}`} />}
                      {close && r.outcome === 'pending' && <Lock className={`w-3 h-3 ${courante ? 'text-white' : 'text-slate-400'}`} />}
                      {r.status === 'open' && <CircleDot className={`w-3 h-3 ${courante ? 'text-white' : 'text-emerald-600'} animate-pulse`} />}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => onDeplacerResolution?.(1)}
              disabled={!suivante}
              aria-label="Point suivant de l'ordre du jour"
              title={suivante ? `Point suivant : ${suivante.title}  (touche →)` : "Dernier point de l'ordre du jour"}
              className={`flex items-center justify-center rounded-lg border h-8 w-8 transition ${
                suivante
                  ? 'bg-white border-slate-200 text-slate-700 hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-800 shadow-2xs'
                  : 'bg-slate-50 border-slate-100 text-slate-200 cursor-not-allowed'
              }`}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <nav className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200 text-xs font-medium overflow-x-auto">
          <button
            id="nav-tab-admin"
            onClick={() => onTabChange('admin')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg transition-all ${
              currentTab === 'admin'
                ? 'bg-emerald-600 text-white shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            {!ongletsCompacts && <span className="hidden sm:inline">Administration</span>}
            {!ongletsCompacts && <span className="sm:hidden">Admin</span>}
          </button>

          <button
            id="nav-tab-table"
            onClick={() => onTabChange('table')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg transition-all ${
              currentTab === 'table'
                ? 'bg-emerald-600 text-white shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <Vote className="w-3.5 h-3.5" />
            {!ongletsCompacts && <span className="hidden sm:inline">Table</span>}
            {!ongletsCompacts && <span className="sm:hidden">Table</span>}
          </button>

          <button
            id="nav-tab-kiosk"
            onClick={() => onTabChange('kiosk')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg transition-all ${
              currentTab === 'kiosk'
                ? 'bg-emerald-600 text-white shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            {!ongletsCompacts && <span className="hidden sm:inline">Kiosque</span>}
            {!ongletsCompacts && <span className="sm:hidden">Kiosque</span>}
          </button>

          <button
            id="nav-tab-history"
            onClick={() => onTabChange('history')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg transition-all ${
              currentTab === 'history'
                ? 'bg-emerald-600 text-white shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            {!ongletsCompacts && <span className="hidden sm:inline">Archives</span>}
            {!ongletsCompacts && <span className="sm:hidden">Archives</span>}
          </button>
        </nav>

        {/* Real-time Notification Center & Fullscreen / Action Controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          
          {/* En plein écran, le bandeau d'état n'existe plus : les commandes du
              scrutin doivent rester atteignables sans quitter l'affichage. */}
          {isFullscreenTable && currentTab === 'table' && session && session.status !== 'closed' && (
            <div className="flex items-center gap-1.5">
              {session.status === 'open' ? (
                <>
                  <button
                    onClick={() => onDefinirOuverture?.(false)}
                    title="Suspendre le scrutin : les suffrages déjà exprimés sont conservés"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold transition shadow-2xs"
                  >
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    <span className="hidden lg:inline">Suspendre</span>
                  </button>
                  <button
                    onClick={onCloseSession}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-2xs"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">Clôturer le vote</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => onDefinirOuverture?.(true)}
                  title={`Ouvrir le scrutin maintenant (séance annoncée à ${session.scheduledTime})`}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-2xs"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Ouvrir le scrutin</span>
                </button>
              )}
            </div>
          )}

          {/* TABLE PLEIN ÉCRAN BUTTON */}
          {onToggleFullscreenTable && (
            <button
              onClick={onToggleFullscreenTable}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold transition shadow-2xs ${
                isFullscreenTable && currentTab === 'table'
                  ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              }`}
              title={isFullscreenTable ? 'Quitter le plein écran' : 'Afficher la table en plein écran'}
            >
              {isFullscreenTable && currentTab === 'table' ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span className="hidden md:inline">
                {isFullscreenTable && currentTab === 'table' ? 'Quitter le plein écran' : 'Plein écran'}
              </span>
            </button>
          )}

          {/* REAL-TIME EVENT STREAM NOTIFICATION BELL */}
          <NotificationCenter
            notifications={notifications}
            soundEnabled={soundEnabled}
            onToggleSound={onToggleSound}
            onClearNotifications={onClearNotifications}
          />

          {/* Mode Switcher Button */}
          {onOpenModeModal && (
            <button
              onClick={onOpenModeModal}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shadow-2xs"
              title="Changer de mode (Votant / Admin)"
            >
              <Users className="w-3 h-3 text-emerald-400" />
              <span className="hidden lg:inline">Mode</span>
            </button>
          )}

          {/* Bascule d'affichage : à portée de main, elle sert en pleine séance. */}
          {onToggleAffichageSimplifie && (
            <button
              onClick={onToggleAffichageSimplifie}
              aria-pressed={affichageSimplifie}
              title={
                affichageSimplifie
                  ? "Revenir à l'affichage complet (mentions techniques et outils de démonstration)"
                  : "Affichage simplifié : ne garder que l'essentiel de la séance"
              }
              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium transition shadow-2xs ${
                affichageSimplifie
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              {affichageSimplifie ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-slate-400" />}
              <span className="hidden lg:inline">{affichageSimplifie ? 'Vue complète' : 'Vue simplifiée'}</span>
            </button>
          )}

          {/* Raccourcis de démonstration */}
          <div className="mv-demo hidden sm:flex items-center gap-1">
            <button
              onClick={onSimulateRandomVotes}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium transition shadow-2xs"
              title="Simuler des votes pour la démonstration"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span className="hidden xl:inline">Simuler</span>
            </button>

            <button
              onClick={onResetVotes}
              disabled={session?.status === 'closed'}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-rose-50 hover:border-rose-300 border border-slate-200 text-slate-700 hover:text-rose-700 text-xs font-medium transition shadow-2xs"
              title="Réinitialiser tous les votes"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span className="hidden xl:inline">Vider</span>
            </button>
          </div>
        </div>

      </div>
    </header>
  );
};
