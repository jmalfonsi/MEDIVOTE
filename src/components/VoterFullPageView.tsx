import React, { useState, useEffect, useRef } from 'react';
import { 
  Check, 
  X, 
  Minus, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Lock, 
  Maximize2, 
  Minimize2, 
  Users, 
  FileText, 
  Calendar, 
  Clock, 
  Share2, 
  Vote as VoteIcon, 
  RefreshCw, 
  ShieldCheck, 
  UserCheck, 
  ArrowLeftRight, 
  Radio
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { VotingSession, Voter, VoteChoice, PresenceStatus } from '../types';
import { calculateVoteStatistics, getMajorityLabel } from '../utils/votingMath';

interface VoterFullPageViewProps {
  session: VotingSession | null;
  voters: Voter[];
  activeVoterId: string;
  onVote: (voterId: string, vote: VoteChoice) => void;
  onSetPresence: (voterId: string, presence: PresenceStatus, proxyToId?: string | null) => void;
  onChangeVoter: () => void;
  onRequestAdmin: () => void;
}

export const VoterFullPageView: React.FC<VoterFullPageViewProps> = ({
  session,
  voters,
  activeVoterId,
  onVote,
  onSetPresence,
  onChangeVoter,
  onRequestAdmin,
}) => {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isTextExpanded, setIsTextExpanded] = useState<boolean>(false);
  const [selectedSeatVoterId, setSelectedSeatVoterId] = useState<string | null>(null);

  // Strictly filter voters to the meeting's single active list
  const meetingAttendeeIds = session?.selectedAttendeeIds && session.selectedAttendeeIds.length > 0
    ? session.selectedAttendeeIds
    : voters.map(v => v.id);

  const activeVoters = voters.filter(v => v.isActive && meetingAttendeeIds.includes(v.id));
  const totalCount = activeVoters.length;
  
  // Active logged-in voter
  const currentVoter = voters.find(v => v.id === activeVoterId) || activeVoters[0];
  const currentState = currentVoter && session ? session.voterStates[currentVoter.id] : null;

  // Proxies held by the logged-in voter
  const myHeldProxies = activeVoters.filter(v => {
    const vs = session?.voterStates[v.id];
    return vs?.presence === 'proxy' && vs?.proxyToId === currentVoter?.id;
  });

  // If current voter gave their proxy
  const myProxyRecipient = currentState?.presence === 'proxy' && currentState?.proxyToId
    ? voters.find(v => v.id === currentState.proxyToId)
    : null;

  // Compute live statistics for the session
  const stats = calculateVoteStatistics(session, voters);

  // Fullscreen controller
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Confetti when current voter casts a 'for' vote or motion is adopted
  const handleCastVote = (choice: VoteChoice) => {
    if (!session || !currentVoter || session.status === 'closed') return;
    onVote(currentVoter.id, choice);

    if (choice === 'for') {
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#10b981', '#34d399', '#059669']
      });
    }
  };

  if (!session || !currentVoter) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 space-y-4">
        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
        <p className="text-sm font-medium text-slate-300">Initialisation du terminal de vote...</p>
      </div>
    );
  }

  // Parametric ellipse radius for oval table
  const radiusX = 42;
  const radiusY = 38;

  const isPresent = currentState?.presence === 'present' || currentState?.presence === 'proxy';
  const hasVoted = currentState && currentState.vote !== 'pending';

  return (
    <div className="min-h-screen bg-[#F0F4F2] text-slate-800 flex flex-col justify-between selection:bg-emerald-500 selection:text-white pb-32">
      
      {/* 1. TOP HEADER (VOTER IDENTITY & QUICK CONTROLS) */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-3 sm:px-6 py-2.5 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Logo & Meeting Reference */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-700/20">
              M
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs sm:text-sm text-slate-900">Medivote Pro</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                  Mode Votant
                </span>
                <span className="hidden md:inline text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  {session.referenceCode}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block truncate max-w-[280px]">
                {session.title}
              </p>
            </div>
          </div>

          {/* Logged-in Voter Card (Highlighted) */}
          <div className="flex items-center gap-2 sm:gap-3 bg-emerald-50/80 border border-emerald-300 px-2.5 sm:px-3 py-1.5 rounded-2xl shadow-2xs">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-2xs flex-shrink-0"
              style={{ backgroundColor: currentVoter.avatarColor || '#059669' }}
            >
              {currentVoter.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-slate-900 truncate max-w-[130px] sm:max-w-[180px] flex items-center gap-1">
                <span>{currentVoter.title} {currentVoter.name}</span>
              </div>
              <div className="text-[10px] text-emerald-800 font-medium truncate">
                Votre Siège N°{currentVoter.seatNumber}
              </div>
            </div>
            <button
              onClick={onChangeVoter}
              className="ml-1 px-2 py-1 rounded-lg bg-white hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-[11px] font-semibold transition flex items-center gap-1"
              title="Changer de délibérateur / votant"
            >
              <ArrowLeftRight className="w-3 h-3" />
              <span className="hidden sm:inline">Changer</span>
            </button>
          </div>

          {/* Action buttons: Fullscreen & Admin Pin Unlock */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition shadow-2xs hidden sm:flex"
              title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onRequestAdmin}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs"
              title="Accès Administrateur avec code PIN (582103)"
            >
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Admin 🔒</span>
            </button>
          </div>

        </div>
      </header>

      {/* 2. STATS & MONITOR HEADER BAR */}
      <div className="max-w-7xl mx-auto w-full px-3 sm:px-6 pt-3">
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          
          {/* Quorum & Participation */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs">
            <div className={`px-2.5 py-1 rounded-xl text-xs border font-medium flex items-center gap-1.5 ${
              stats.quorumReached
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>Quorum : <strong>{stats.presentCount + stats.proxyCount}</strong>/{stats.totalEligible} {session.quorumPct === 0 ? '(Pas de quorum min.)' : `(Min. ${stats.quorumNeeded})`}</span>
            </div>

            <div className="flex items-center gap-2 text-slate-600">
              <span>Règle : <strong className="text-slate-800">{getMajorityLabel(session.majorityRequired)}</strong></span>
              <span>•</span>
              <span>Participation : <strong className="text-emerald-700">{stats.votedCount}</strong>/{stats.totalEligible} ({stats.totalEligible > 0 ? Math.round((stats.votedCount / stats.totalEligible) * 100) : 0}%)</span>
            </div>
          </div>

          {/* Outcome Status Badge */}
          <div className={`px-3 py-1 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
            stats.outcome === 'adopted'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : stats.outcome === 'rejected'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : stats.outcome === 'quorum_not_reached'
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-slate-100 text-slate-700 border-slate-200'
          }`}>
            {stats.outcome === 'adopted' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
            {stats.outcome === 'rejected' && <XCircle className="w-3.5 h-3.5 text-rose-600" />}
            {stats.outcome === 'quorum_not_reached' && <AlertCircle className="w-3.5 h-3.5 text-amber-600" />}
            {stats.outcome === 'pending' && <Clock className="w-3.5 h-3.5 text-slate-500 animate-spin" />}
            
            <span>
              {stats.outcome === 'adopted' && 'MOTION ADOPTÉE'}
              {stats.outcome === 'rejected' && 'MOTION REJETÉE'}
              {stats.outcome === 'quorum_not_reached' && 'QUORUM NON ATTEINT'}
              {stats.outcome === 'pending' && 'DÉLIBÉRATION EN COURS'}
            </span>
          </div>

        </div>
      </div>

      {/* 3. MAIN OVAL BOARDROOM TABLE ARENA (FULL PAGE) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-2 sm:px-4 py-4 flex items-center justify-center">
        
        <div className="relative w-full min-h-[640px] sm:min-h-[700px] lg:min-h-[740px] rounded-3xl bg-[#F4F7F5] border border-slate-200/90 shadow-sm overflow-hidden p-3 sm:p-6 flex items-center justify-center select-none">
          
          {/* Subtle medical grid background */}
          <div className="absolute inset-0 bg-medical-grid opacity-60 pointer-events-none"></div>

          {/* Ambient Glow */}
          <div className="absolute w-[80%] h-[75%] rounded-[100%] bg-emerald-500/5 blur-3xl pointer-events-none"></div>

          {/* THE PHYSICAL OVAL TABLE */}
          <div className="relative w-[86%] sm:w-[82%] md:w-[78%] lg:w-[74%] h-[420px] sm:h-[480px] lg:h-[520px] rounded-[180px] sm:rounded-[220px] md:rounded-[260px] bg-white border-[12px] sm:border-[16px] border-[#E2E8F0] shadow-[0_20px_50px_rgba(0,0,0,0.05)] flex items-center justify-center p-4 sm:p-8 transition-all">
            
            {/* Table Inlaid Rims */}
            <div className="absolute inset-3 sm:inset-4 rounded-[160px] sm:rounded-[200px] md:rounded-[240px] border border-emerald-600/10 pointer-events-none"></div>
            <div className="absolute inset-8 sm:inset-10 rounded-[140px] sm:rounded-[180px] md:rounded-[220px] border border-slate-200/60 pointer-events-none"></div>

            {/* CENTER DIGITAL SCREEN: RESOLUTION TEXT & LIVE RESULTS */}
            <div className="relative z-10 w-full max-w-xl bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-slate-200 shadow-lg p-4 sm:p-6 text-center text-slate-800 transition-all">
              
              {/* Header Chip */}
              <div className="flex items-center justify-between mb-2.5 border-b border-slate-100 pb-2">
                <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-semibold uppercase tracking-wider bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Résolution Soumise au Vote</span>
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  {session.scheduledDate} • {session.scheduledTime}
                </div>
              </div>

              {/* Title */}
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug mb-2 tracking-tight">
                {session.title}
              </h2>

              {/* Full Motion Text Box */}
              <div className="relative my-2 sm:my-3 bg-slate-50 rounded-xl p-3 sm:p-4 border border-slate-200 text-left">
                <p className={`text-xs sm:text-sm text-slate-700 leading-relaxed font-normal ${
                  !isTextExpanded && session.motionText.length > 220 ? 'line-clamp-3' : ''
                }`}>
                  {session.motionText}
                </p>
                {session.motionText.length > 220 && (
                  <button
                    onClick={() => setIsTextExpanded(!isTextExpanded)}
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 mt-1 flex items-center gap-0.5"
                  >
                    {isTextExpanded ? 'Réduire le texte' : 'Lire l\'intégralité de la résolution...'}
                  </button>
                )}
              </div>

              {/* Live Voting Progress Gauge Bar */}
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1 text-emerald-700">
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                    Pour : {stats.votesFor} ({stats.forPercentage}%)
                  </span>
                  <span className="flex items-center gap-1 text-rose-700">
                    <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                    Contre : {stats.votesAgainst} ({stats.againstPercentage}%)
                  </span>
                  <span className="flex items-center gap-1 text-slate-600">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    Abstention : {stats.votesAbstain} ({stats.abstainPercentage}%)
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex p-0.5 gap-0.5 border border-slate-200">
                  <div
                    className="h-full bg-emerald-600 rounded-l-full transition-all duration-500"
                    style={{ width: `${stats.forPercentage}%` }}
                  />
                  <div
                    className="h-full bg-rose-600 transition-all duration-500"
                    style={{ width: `${stats.againstPercentage}%` }}
                  />
                  <div
                    className="h-full bg-slate-400 rounded-r-full transition-all duration-500"
                    style={{ width: `${stats.abstainPercentage}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>Suffrages exprimés : <strong className="text-slate-800">{stats.votedCount}</strong>/{stats.totalEligible}</span>
                  <span>En attente : <strong className="text-amber-700 font-semibold">{stats.notVotedCount}</strong></span>
                </div>
              </div>

            </div>

          </div>

          {/* ALL VOTER SEATS AROUND THE OVAL TABLE */}
          {activeVoters.map((voter, index) => {
            // Angle in radians: distribute evenly around 360 degrees
            const angle = (2 * Math.PI * index) / totalCount - Math.PI / 2;
            
            // Calculate parametric position
            const leftPercent = 50 + radiusX * Math.cos(angle);
            const topPercent = 50 + radiusY * Math.sin(angle);

            const state = session.voterStates[voter.id] || { presence: 'present', vote: 'pending' };
            const isMe = voter.id === currentVoter.id;
            const isSeatSelected = selectedSeatVoterId === voter.id;

            const isSeatPresent = state.presence === 'present';
            const isSeatProxy = state.presence === 'proxy';
            const isSeatAbsent = state.presence === 'absent';
            const isSeatExcused = state.presence === 'excused';

            const hasVotedFor = state.vote === 'for';
            const hasVotedAgainst = state.vote === 'against';
            const hasVotedAbstain = state.vote === 'abstain';
            const hasSeatVoted = hasVotedFor || hasVotedAgainst || hasVotedAbstain;
            const isSeatPending = !hasSeatVoted && (isSeatPresent || isSeatProxy);

            return (
              <div
                key={voter.id}
                style={{
                  left: `${leftPercent}%`,
                  top: `${topPercent}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className={`absolute z-20 transition-all duration-300 ${
                  isMe ? 'z-30 scale-105' : 'opacity-90 hover:opacity-100'
                }`}
              >
                {/* Voter Seat Card */}
                <div
                  onClick={() => {
                    if (isMe) {
                      // Already active voter
                    } else {
                      setSelectedSeatVoterId(isSeatSelected ? null : voter.id);
                    }
                  }}
                  className={`w-28 sm:w-36 md:w-40 rounded-2xl p-2 sm:p-2.5 transition-all duration-200 text-left border shadow-md relative ${
                    isMe
                      ? 'ring-4 ring-emerald-500 ring-offset-2 ring-offset-white bg-emerald-50/90 border-emerald-500 shadow-xl'
                      : isSeatSelected
                      ? 'ring-2 ring-slate-400 bg-white border-slate-400 shadow-lg'
                      : hasVotedFor
                      ? 'bg-white border-emerald-300 shadow-xs'
                      : hasVotedAgainst
                      ? 'bg-white border-rose-300 shadow-xs'
                      : hasVotedAbstain
                      ? 'bg-white border-slate-300 shadow-xs'
                      : isSeatAbsent || isSeatExcused
                      ? 'bg-slate-50 border-slate-200 opacity-60'
                      : 'bg-white border-amber-300/80 shadow-xs'
                  }`}
                >
                  {/* Highlight pill for current user's seat */}
                  {isMe && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full shadow-md tracking-wider flex items-center gap-1 border border-emerald-400 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                      <span>Votre Siège</span>
                    </div>
                  )}

                  {/* Seat Number & Presence Status */}
                  <div className="flex items-center justify-between mb-1 mt-0.5">
                    <div className="flex items-center gap-1">
                      <span 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: voter.avatarColor || '#059669' }}
                      />
                      <span className="text-[10px] font-mono text-slate-400 font-medium">
                        N°{voter.seatNumber || index + 1}
                      </span>
                    </div>

                    <div className="flex items-center">
                      {isSeatPresent && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span className="hidden sm:inline">Présent</span>
                        </span>
                      )}
                      {isSeatProxy && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                          <Share2 className="w-2.5 h-2.5 text-amber-600" />
                          <span className="hidden sm:inline">Procuration</span>
                        </span>
                      )}
                      {isSeatAbsent && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          <span className="hidden sm:inline">Absent</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Voter Name & Specialty */}
                  <div className="truncate">
                    <h4 className="text-xs font-bold text-slate-800 truncate flex items-center gap-1">
                      <span className="text-emerald-700 font-semibold text-[11px]">{voter.title}</span>
                      <span className="truncate">{voter.name}</span>
                    </h4>
                    <p className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">
                      {voter.specialty || voter.department}
                    </p>
                  </div>

                  {/* PROMINENT VOTER STATUS BADGE */}
                  <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
                    {hasVotedFor && (
                      <div className="w-full flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold animate-in fade-in">
                        <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                        <span>A VOTÉ (POUR)</span>
                      </div>
                    )}

                    {hasVotedAgainst && (
                      <div className="w-full flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold animate-in fade-in">
                        <X className="w-3.5 h-3.5 text-rose-600 stroke-[3]" />
                        <span>A VOTÉ (CONTRE)</span>
                      </div>
                    )}

                    {hasVotedAbstain && (
                      <div className="w-full flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold animate-in fade-in">
                        <span>— ABSTENTION</span>
                      </div>
                    )}

                    {isSeatPending && (
                      <div className="w-full flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                        <span>EN ATTENTE</span>
                      </div>
                    )}

                    {(isSeatAbsent || isSeatExcused) && (
                      <div className="w-full text-center py-1 px-2 rounded-lg bg-slate-100 text-slate-400 text-[10px] font-medium">
                        NON VOTANT
                      </div>
                    )}
                  </div>

                </div>

              </div>
            );
          })}

        </div>

      </main>

      {/* 4. PINNED BOTTOM ERGONOMIC VOTING CONSOLE (FOR ACTIVE VOTER) */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl p-3 sm:p-4 animate-in slide-in-from-bottom duration-300">
        
        {/* Mandataire / Proxy Alert Banner */}
        {myHeldProxies.length > 0 && (
          <div className="max-w-4xl mx-auto mb-2.5 p-2 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">🛡️</span>
              <div>
                <strong>Mandataire ({myHeldProxies.length} pouvoir{myHeldProxies.length > 1 ? 's' : ''} détenu{myHeldProxies.length > 1 ? 's' : ''}) :</strong>{' '}
                <span>Vote également pour : <strong>{myHeldProxies.map(p => p.name).join(', ')}</strong></span>
              </div>
            </div>
            <span className="text-[11px] font-bold bg-sky-600 text-white px-2 py-0.5 rounded-lg whitespace-nowrap">
              Poids : {myHeldProxies.length + 1} voix
            </span>
          </div>
        )}

        {myProxyRecipient && (
          <div className="max-w-4xl mx-auto mb-2.5 p-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
            <Share2 className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <div>
              <strong>Procuration active :</strong> Vous avez donné pouvoir à <strong>{myProxyRecipient.title} {myProxyRecipient.name}</strong> qui votera pour vous.
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
          
          {/* Left: Voter Identity & Presence Selector */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-2.5">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-xs font-bold shadow-sm flex-shrink-0"
                style={{ backgroundColor: currentVoter.avatarColor || '#059669' }}
              >
                {currentVoter.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
              </div>
              <div className="text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                  Votre Délibération
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-900 block truncate max-w-[200px]">
                  {currentVoter.title} {currentVoter.name}
                </span>
              </div>
            </div>

            {/* Quick presence toggle */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs border border-slate-200">
              <button
                onClick={() => onSetPresence(currentVoter.id, 'present')}
                className={`px-2 py-1 rounded-lg font-semibold transition text-[11px] ${
                  currentState?.presence === 'present'
                    ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Présent
              </button>
              <button
                onClick={() => {
                  const defaultTarget = activeVoters.find(v => {
                    const c = activeVoters.filter(av => session?.voterStates[av.id]?.presence === 'proxy' && session?.voterStates[av.id]?.proxyToId === v.id && av.id !== currentVoter.id).length;
                    return v.id !== currentVoter.id && c < 2;
                  });
                  onSetPresence(currentVoter.id, 'proxy', defaultTarget?.id || null);
                }}
                className={`px-2 py-1 rounded-lg font-semibold transition text-[11px] ${
                  currentState?.presence === 'proxy'
                    ? 'bg-amber-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Procuration
              </button>
              <button
                onClick={() => onSetPresence(currentVoter.id, 'absent')}
                className={`px-2 py-1 rounded-lg font-semibold transition text-[11px] ${
                  currentState?.presence === 'absent'
                    ? 'bg-rose-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Absent
              </button>
            </div>
          </div>

          {/* Right: 3 Giant Tactile Voting Buttons */}
          {session.status === 'closed' ? (
            <div className="text-xs font-bold text-rose-700 bg-rose-50 px-4 py-2 rounded-xl border border-rose-200 flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-600" />
              <span>Scrutin Clôturé — Les votes sont enregistrés et archivés.</span>
            </div>
          ) : !isPresent ? (
            <div className="text-xs font-bold text-amber-800 bg-amber-50 px-4 py-2 rounded-xl border border-amber-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Membre noté absent : passez en "Présent" pour voter.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto">
              
              {/* POUR */}
              <button
                id="voter-btn-for"
                onClick={() => handleCastVote('for')}
                className={`flex-1 md:flex-initial py-2.5 sm:py-3 px-4 sm:px-6 rounded-2xl font-extrabold text-sm sm:text-base transition-all flex items-center justify-center gap-2 border shadow-sm active:scale-95 ${
                  currentState?.vote === 'for'
                    ? 'bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-500/40'
                    : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-900 hover:border-emerald-400'
                }`}
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>POUR</span>
                {currentState?.vote === 'for' && <span className="text-xs">✓</span>}
              </button>

              {/* CONTRE */}
              <button
                id="voter-btn-against"
                onClick={() => handleCastVote('against')}
                className={`flex-1 md:flex-initial py-2.5 sm:py-3 px-4 sm:px-6 rounded-2xl font-extrabold text-sm sm:text-base transition-all flex items-center justify-center gap-2 border shadow-sm active:scale-95 ${
                  currentState?.vote === 'against'
                    ? 'bg-rose-600 text-white border-rose-500 ring-2 ring-rose-500/40'
                    : 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-900 hover:border-rose-400'
                }`}
              >
                <X className="w-4 h-4 stroke-[3]" />
                <span>CONTRE</span>
                {currentState?.vote === 'against' && <span className="text-xs">✓</span>}
              </button>

              {/* ABSTENTION */}
              <button
                id="voter-btn-abstain"
                onClick={() => handleCastVote('abstain')}
                className={`flex-1 md:flex-initial py-2.5 sm:py-3 px-4 sm:px-5 rounded-2xl font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 border shadow-sm active:scale-95 ${
                  currentState?.vote === 'abstain'
                    ? 'bg-slate-700 text-white border-slate-600 ring-2 ring-slate-400/40'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <Minus className="w-4 h-4 stroke-[3]" />
                <span>ABSTENTION</span>
                {currentState?.vote === 'abstain' && <span className="text-xs">✓</span>}
              </button>

              {/* Reset/Cancel individual vote */}
              {hasVoted && (
                <button
                  onClick={() => handleCastVote('pending')}
                  className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 border border-slate-200 transition"
                  title="Annuler mon vote"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}

            </div>
          )}

        </div>
      </div>

      {/* CENTERED POPUP MODAL FOR INSPECTING ANY SEAT */}
      {selectedSeatVoterId && (() => {
        const selVoter = voters.find(v => v.id === selectedSeatVoterId);
        if (!selVoter) return null;
        const selState = session.voterStates[selVoter.id] || { presence: 'present', vote: 'pending' };

        return (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setSelectedSeatVoterId(null)}
          >
            <div 
              className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 text-slate-800 space-y-4 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white shadow-xs"
                    style={{ backgroundColor: selVoter.avatarColor || '#0284c7' }}
                  >
                    {selVoter.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-emerald-800 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 font-bold">
                        Siège N°{selVoter.seatNumber}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium truncate max-w-[140px]">{selVoter.department || selVoter.specialty}</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mt-0.5">
                      {selVoter.title} {selVoter.name}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSeatVoterId(null)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center text-xs font-bold transition"
                  title="Fermer"
                >
                  ✕
                </button>
              </div>

              {/* Status info */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Statut de Présence :</span>
                  <span className="font-semibold text-slate-800 capitalize">
                    {selState.presence === 'present' ? 'Présent' : selState.presence === 'proxy' ? 'Procuration' : selState.presence === 'absent' ? 'Absent' : 'Excusé'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Suffrage Exprimé :</span>
                  <span className={`font-bold ${
                    selState.vote === 'for' ? 'text-emerald-700' : selState.vote === 'against' ? 'text-rose-700' : selState.vote === 'abstain' ? 'text-slate-700' : 'text-amber-600'
                  }`}>
                    {selState.vote === 'for' ? 'POUR' : selState.vote === 'against' ? 'CONTRE' : selState.vote === 'abstain' ? 'ABSTENTION' : 'En attente'}
                  </span>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
                <span className="truncate max-w-[200px]">{selVoter.email}</span>
                <button
                  onClick={() => setSelectedSeatVoterId(null)}
                  className="text-slate-600 hover:text-slate-900 font-semibold px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
