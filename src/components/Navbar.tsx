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
  Minimize2
} from 'lucide-react';
import { VotingSession, VoteStatistics, MeetingItem, RealtimeNotification } from '../types';
import { NotificationCenter } from './NotificationCenter';

interface NavbarProps {
  currentTab: 'table' | 'kiosk' | 'admin' | 'history';
  onTabChange: (tab: 'table' | 'kiosk' | 'admin' | 'history') => void;
  session: VotingSession | null;
  meetings: MeetingItem[];
  stats: VoteStatistics;
  notifications: RealtimeNotification[];
  soundEnabled: boolean;
  isFullscreenTable?: boolean;
  onToggleFullscreenTable?: () => void;
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
  meetings,
  stats,
  notifications,
  soundEnabled,
  isFullscreenTable = false,
  onToggleFullscreenTable,
  onToggleSound,
  onClearNotifications,
  onSwitchMeeting,
  onResetVotes,
  onQuickVoteAllFor,
  onSimulateRandomVotes,
  onOpenModeModal,
}) => {
  const [isMeetingDropdownOpen, setIsMeetingDropdownOpen] = useState(false);

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-3 sm:px-5 py-1.5 transition-all shadow-2xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        
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
                  Medivote
                </span>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  SQLite
                </span>
              </div>
            </div>
          </div>

          {/* Quick Meeting Selector Dropdown in Navbar */}
          {meetings.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setIsMeetingDropdownOpen(!isMeetingDropdownOpen)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition"
              >
                <Calendar className="w-3 h-3 text-emerald-600" />
                <span className="max-w-[120px] sm:max-w-[150px] truncate">{session?.referenceCode || 'Séances'}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isMeetingDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsMeetingDropdownOpen(false)} />
                  <div className="absolute left-0 mt-1.5 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 p-2 space-y-1 animate-in fade-in zoom-in-95">
                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Séances enregistrées ({meetings.length})
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {meetings.map(m => (
                        <button
                          key={m.id}
                          onClick={() => {
                            setIsMeetingDropdownOpen(false);
                            if (m.status === 'closed') {
                              onTabChange('history');
                            } else {
                              onSwitchMeeting(m.id);
                            }
                          }}
                          className={`w-full p-2 rounded-xl text-left text-xs transition flex items-start justify-between gap-2 ${
                            m.isActiveMeeting
                              ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="truncate">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[10px] text-emerald-700 block">{m.referenceCode}</span>
                              {m.status === 'closed' && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 font-semibold">
                                  Archive
                                </span>
                              )}
                            </div>
                            <span className="truncate block font-semibold">{m.title}</span>
                          </div>
                          {m.isActiveMeeting && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="pt-1 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setIsMeetingDropdownOpen(false);
                          onTabChange('admin');
                        }}
                        className="w-full py-1.5 px-2 rounded-lg text-center text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Gérer les séances (Admin)
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

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
            <span className="hidden sm:inline">Admin & Votants</span>
            <span className="sm:hidden">Admin</span>
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
            <span className="hidden sm:inline">Table Ovale</span>
            <span className="sm:hidden">Table</span>
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
            <span className="hidden sm:inline">Kiosque Votant</span>
            <span className="sm:hidden">Kiosque</span>
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
            <span className="hidden sm:inline">Archives</span>
            <span className="sm:hidden">Archives</span>
          </button>
        </nav>

        {/* Real-time Notification Center & Fullscreen / Action Controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          
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
                {isFullscreenTable && currentTab === 'table' ? 'Quitter Plein Écran' : 'Table Plein Écran'}
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

          {/* Quick simulation helper buttons */}
          <div className="hidden sm:flex items-center gap-1">
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
