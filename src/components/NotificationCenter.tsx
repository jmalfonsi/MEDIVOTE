import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  CheckCircle2, 
  XCircle, 
  Vote, 
  RotateCcw, 
  UserCheck, 
  Calendar, 
  X, 
  Volume2, 
  VolumeX, 
  Trash2, 
  Sparkles,
  AlertCircle,
  Radio
} from 'lucide-react';
import { RealtimeNotification, VoteChoice, SessionOutcome } from '../types';

interface NotificationCenterProps {
  notifications: RealtimeNotification[];
  soundEnabled: boolean;
  onToggleSound: () => void;
  onClearNotifications: () => void;
  onRefreshData?: () => void;
}

// Pleasant medical/chime synth audio generator using Web Audio API
function playChime(type: 'vote' | 'start' | 'end' | 'bell') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'vote') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'start') {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(440, ctx.currentTime); // A4
      osc1.frequency.setValueAtTime(554.37, ctx.currentTime + 0.12); // C#5
      osc1.frequency.setValueAtTime(659.25, ctx.currentTime + 0.24); // E5
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.24); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.6);
      osc2.stop(ctx.currentTime + 0.6);
    } else if (type === 'end') {
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C Major arpeggio
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0.1, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.4);
      });
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(784, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (_) {}
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  soundEnabled,
  onToggleSound,
  onClearNotifications,
  onRefreshData,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'votes' | 'sessions'>('all');
  const [activeToast, setActiveToast] = useState<RealtimeNotification | null>(null);
  const [liveConnected, setLiveConnected] = useState(true);

  // Play audio when sound is enabled and a new notification arrives
  const lastNotifIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (notifications.length > 0) {
      const newest = notifications[0];
      if (newest && newest.id !== lastNotifIdRef.current) {
        lastNotifIdRef.current = newest.id;
        setActiveToast(newest);

        // Auto-dismiss toast after 4.5s
        const timer = setTimeout(() => {
          setActiveToast(null);
        }, 4500);

        if (soundEnabled) {
          if (newest.type === 'vote_started' || newest.type === 'meeting_created') {
            playChime('start');
          } else if (newest.type === 'vote_ended') {
            playChime('end');
          } else if (newest.type === 'vote_cast') {
            playChime('vote');
          } else {
            playChime('bell');
          }
        }

        return () => clearTimeout(timer);
      }
    }
  }, [notifications, soundEnabled]);

  const filteredNotifs = notifications.filter(n => {
    if (filter === 'votes') return n.type === 'vote_cast' || n.type === 'vote_reset';
    if (filter === 'sessions') return n.type === 'vote_started' || n.type === 'vote_ended' || n.type === 'meeting_created' || n.type === 'meeting_switched';
    return true;
  });

  const getIconForType = (type: string, voteChoice?: VoteChoice, outcome?: SessionOutcome) => {
    switch (type) {
      case 'vote_started':
      case 'meeting_created':
      case 'meeting_switched':
        return <Calendar className="w-4 h-4 text-emerald-600" />;
      case 'vote_ended':
        return outcome === 'adopted' 
          ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          : <XCircle className="w-4 h-4 text-rose-600" />;
      case 'vote_cast':
        if (voteChoice === 'for') return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
        if (voteChoice === 'against') return <XCircle className="w-4 h-4 text-rose-600" />;
        return <Vote className="w-4 h-4 text-amber-600" />;
      case 'vote_reset':
        return <RotateCcw className="w-4 h-4 text-slate-500" />;
      case 'presence_changed':
        return <UserCheck className="w-4 h-4 text-teal-600" />;
      default:
        return <Bell className="w-4 h-4 text-emerald-600" />;
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (_) {
      return '';
    }
  };

  return (
    <div className="relative inline-block">
      
      {/* Floating Live Toast at Top-Right */}
      {activeToast && (
        <div 
          className="fixed top-20 right-4 z-50 max-w-sm w-full bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-emerald-200 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100 flex-shrink-0">
              {getIconForType(activeToast.type, activeToast.voteChoice, activeToast.outcome)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <h4 className="text-xs font-bold text-slate-900 truncate">
                  {activeToast.title}
                </h4>
                <span className="text-[0.625rem] font-mono text-slate-400">
                  {formatTime(activeToast.timestamp)}
                </span>
              </div>
              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                {activeToast.message}
              </p>
            </div>

            <button
              onClick={() => setActiveToast(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-emerald-700 transition shadow-xs flex items-center gap-1.5"
        title="Notifications en direct du scrutin"
      >
        <Bell className="w-4 h-4 text-emerald-700" />
        
        {/* Live Pulse Dot */}
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>

        {notifications.length > 0 && (
          <span className="text-[0.6875rem] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded-full border border-emerald-200">
            {notifications.length}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />

          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                    Flux d'Événements en Direct
                  </h3>
                </div>
                <p className="text-[0.6875rem] text-slate-500 mt-0.5">
                  Mises à jour temps réel des votes et délibérations
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={onToggleSound}
                  className={`p-1.5 rounded-lg border text-xs transition ${
                    soundEnabled
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-slate-100 border-slate-200 text-slate-400'
                  }`}
                  title={soundEnabled ? 'Désactiver les signaux sonores' : 'Activer les signaux sonores'}
                >
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={onClearNotifications}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 transition"
                  title="Vider l'historique des notifications"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-2 bg-slate-100/70 border-b border-slate-200 text-[0.6875rem] font-medium">
              <button
                onClick={() => setFilter('all')}
                className={`flex-1 py-1 rounded-lg transition ${
                  filter === 'all' ? 'bg-white font-bold text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tous ({notifications.length})
              </button>
              <button
                onClick={() => setFilter('votes')}
                className={`flex-1 py-1 rounded-lg transition ${
                  filter === 'votes' ? 'bg-white font-bold text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Suffrages
              </button>
              <button
                onClick={() => setFilter('sessions')}
                className={`flex-1 py-1 rounded-lg transition ${
                  filter === 'sessions' ? 'bg-white font-bold text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Séances
              </button>
            </div>

            {/* Notification List */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
              {filteredNotifs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <Bell className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-medium">Aucun événement récent</p>
                  <p className="text-[0.6875rem] text-slate-400">
                    Les actions de vote, début et clôture s'afficheront ici en direct.
                  </p>
                </div>
              ) : (
                filteredNotifs.map(notif => (
                  <div 
                    key={notif.id} 
                    className="p-3.5 hover:bg-slate-50 transition flex items-start gap-3"
                  >
                    <div className="p-1.5 rounded-xl bg-slate-100 border border-slate-200 flex-shrink-0 mt-0.5">
                      {getIconForType(notif.type, notif.voteChoice, notif.outcome)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h4 className="text-xs font-bold text-slate-900 truncate">
                          {notif.title}
                        </h4>
                        <span className="text-[0.625rem] font-mono text-slate-400">
                          {formatTime(notif.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center text-[0.6875rem] text-slate-500 font-mono">
              Serveur SSE actif • Synchro temps réel
            </div>

          </div>
        </>
      )}

    </div>
  );
};
