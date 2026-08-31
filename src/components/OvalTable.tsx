import React, { useState, useEffect, useRef } from 'react';
import { 
  Check, 
  X, 
  Clock, 
  Users, 
  Sparkles, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Lock, 
  Unlock, 
  Calendar, 
  Share2, 
  RefreshCw,
  Maximize2,
  Minimize2,
  Radio,
  UserCheck,
  UserX,
  FileDown,
  Printer,
  Vote as VoteIcon
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { VotingSession, Voter, VoteStatistics, VoteChoice, PresenceStatus } from '../types';
import { getMajorityLabel } from '../utils/votingMath';
import { generateSessionPdfReport } from '../utils/pdfExport';

interface OvalTableProps {
  session: VotingSession | null;
  voters: Voter[];
  stats: VoteStatistics;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onVote: (voterId: string, vote: VoteChoice) => void;
  onSetPresence: (voterId: string, presence: PresenceStatus, proxyToId?: string | null) => void;
  onResetVotes: () => void;
  onCloseSession: () => void;
  onOpenAdmin: () => void;
  onQuickVoteAllFor: () => void;
  onSimulateRandomVotes: () => void;
}

export const OvalTable: React.FC<OvalTableProps> = ({
  session,
  voters,
  stats,
  isFullscreen = false,
  onToggleFullscreen,
  onVote,
  onSetPresence,
  onResetVotes,
  onCloseSession,
  onOpenAdmin,
  onQuickVoteAllFor,
  onSimulateRandomVotes,
}) => {
  const [selectedVoterId, setSelectedVoterId] = useState<string | null>(null);
  const [isTextExpanded, setIsTextExpanded] = useState<boolean>(false);
  const [filterVoterStatus, setFilterVoterStatus] = useState<'all' | 'voted' | 'pending'>('all');
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState<boolean>(false);
  
  // Strictly filter voters to the meeting's single active list
  const meetingAttendeeIds = session?.selectedAttendeeIds && session.selectedAttendeeIds.length > 0
    ? session.selectedAttendeeIds
    : voters.map(v => v.id);

  const activeVoters = voters.filter(v => v.isActive && meetingAttendeeIds.includes(v.id));
  const totalCount = activeVoters.length;

  // Fire celebratory confetti when unanimous or majority adopted with all votes cast
  const prevOutcomeRef = useRef(session?.outcome);
  useEffect(() => {
    if (session?.outcome === 'adopted' && prevOutcomeRef.current !== 'adopted') {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#0ea5e9', '#14b8a6', '#10b981', '#38bdf8']
      });
    }
    prevOutcomeRef.current = session?.outcome;
  }, [session?.outcome]);

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] text-center p-8">
        <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">Aucune séance active sélectionnée</h2>
        <p className="text-sm text-slate-600 max-w-md mb-6">
          Veuillez configurer ou activer une réunion depuis le panneau d'administration.
        </p>
        <button
          onClick={onOpenAdmin}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition shadow-sm"
        >
          Accéder à l'administration
        </button>
      </div>
    );
  }

  // Optimized parametric ellipse radius (ensures all 25+ tiles are 100% visible and unclipped in fullscreen)
  const isLargeAssembly = totalCount > 18;
  const radiusX = isFullscreen ? (isLargeAssembly ? 42 : 39.5) : (isLargeAssembly ? 42.5 : 40); 
  const radiusY = isFullscreen ? (isLargeAssembly ? 34 : 32) : (isLargeAssembly ? 35 : 33);

  const selectedVoter = voters.find(v => v.id === selectedVoterId);
  const selectedState = selectedVoter ? (session.voterStates[selectedVoter.id] || { presence: 'present', vote: 'pending' }) : null;

  return (
    <div className={`relative w-full ${isFullscreen ? 'max-w-none px-2 sm:px-4 py-1' : 'max-w-7xl mx-auto px-2 sm:px-4 py-3'} select-none transition-all`}>
      
      {/* TOP COMPACT STATUS & CONTROL MONITOR BAR */}
      <div className="bg-white rounded-2xl p-2.5 sm:p-3.5 border border-slate-200 shadow-xs mb-2.5 space-y-2">
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2.5">
          
          {/* Reference & Title */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-mono font-bold text-xs border border-emerald-200 flex-shrink-0">
              {session.referenceCode}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate max-w-xl">
                  {session.title}
                </h1>
                {session.status === 'closed' ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
                    Scrutin Clôturé
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Scrutin Ouvert
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-emerald-600" /> {session.scheduledDate} {session.scheduledTime}</span>
                <span>•</span>
                <span>Lieu : <strong className="text-slate-700">{session.location || 'Saint-Victor'}</strong></span>
                <span>•</span>
                <span>Règle : <strong className="text-slate-700">{getMajorityLabel(session.majorityRequired)}</strong></span>
              </p>
            </div>
          </div>

          {/* Quick Metrics, Fullscreen Toggle & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-between lg:justify-end flex-shrink-0">
            
            {/* Live outcome badge */}
            <div className={`px-2.5 py-1 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
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

            {/* Quorum Pill */}
            <div className={`px-2.5 py-1 rounded-xl text-xs border font-medium flex items-center gap-1.5 ${
              stats.quorumReached
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              <Users className="w-3 h-3 text-slate-500" />
              <span>Présents : <strong className="text-slate-800">{stats.presentCount + stats.proxyCount}</strong>/{stats.totalEligible} {session.quorumPct === 0 ? '(0%)' : `(Min. ${stats.quorumNeeded})`}</span>
            </div>

            {/* FULLSCREEN TABLE BUTTON */}
            {onToggleFullscreen && (
              <button
                onClick={onToggleFullscreen}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 shadow-2xs ${
                  isFullscreen
                    ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
                    : 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                }`}
                title={isFullscreen ? 'Quitter le mode plein écran' : 'Afficher la table en plein écran'}
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span>{isFullscreen ? 'Quitter Plein Écran' : 'Table Plein Écran'}</span>
              </button>
            )}

            {/* PDF Report Export Button - Grisé tant que la séance n'est pas clôturée */}
            <button
              onClick={() => {
                if (session.status === 'closed') {
                  generateSessionPdfReport(session, voters, stats);
                }
              }}
              disabled={session.status !== 'closed'}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shadow-2xs transition flex items-center gap-1.5 ${
                session.status === 'closed'
                  ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-75'
              }`}
              title={
                session.status === 'closed'
                  ? 'Télécharger le Procès-Verbal officiel en PDF'
                  : 'Le rapport PDF officiel sera disponible une fois la séance clôturée'
              }
            >
              <FileDown className={`w-3.5 h-3.5 ${session.status === 'closed' ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">Rapport PDF</span>
            </button>

            {/* Close/Reopen Voting Action Buttons */}
            {session.status === 'open' ? (
              <button
                onClick={onCloseSession}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-2xs transition flex items-center gap-1"
              >
                <Lock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clôturer le vote</span>
              </button>
            ) : (
              <button
                onClick={onResetVotes}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition flex items-center gap-1"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Rouvrir</span>
              </button>
            )}

          </div>
        </div>

        {/* PROMINENT VOTER PARTICIPATION & STATUS FILTER BAR */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">
              Votants :
            </span>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                onClick={() => setFilterVoterStatus('all')}
                className={`px-2 py-0.5 rounded-lg font-semibold transition ${
                  filterVoterStatus === 'all' 
                    ? 'bg-white text-slate-900 shadow-2xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tous ({stats.totalEligible})
              </button>

              <button
                onClick={() => setFilterVoterStatus('voted')}
                className={`px-2 py-0.5 rounded-lg font-semibold transition flex items-center gap-1 ${
                  filterVoterStatus === 'voted' 
                    ? 'bg-emerald-600 text-white shadow-2xs' 
                    : 'text-emerald-700 hover:bg-white/60'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                A voté ({stats.votedCount})
              </button>

              <button
                onClick={() => setFilterVoterStatus('pending')}
                className={`px-2 py-0.5 rounded-lg font-semibold transition flex items-center gap-1 ${
                  filterVoterStatus === 'pending' 
                    ? 'bg-amber-600 text-white shadow-2xs' 
                    : 'text-amber-700 hover:bg-white/60'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                En attente ({stats.notVotedCount})
              </button>
            </div>
          </div>

          <div className="text-slate-600 flex items-center gap-2">
            <span>Participation :</span>
            <div className="w-20 h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div 
                className="h-full bg-emerald-600 transition-all duration-300"
                style={{ width: `${stats.totalEligible > 0 ? (stats.votedCount / stats.totalEligible) * 100 : 0}%` }}
              />
            </div>
            <strong className="text-slate-800">
              {stats.totalEligible > 0 ? Math.round((stats.votedCount / stats.totalEligible) * 100) : 0}%
            </strong>
          </div>

        </div>

      </div>

      {/* Main Oval Boardroom Arena */}
      <div className={`relative w-full ${
        isFullscreen 
          ? 'h-[calc(100vh-130px)] min-h-[600px] max-h-[880px] p-4 sm:p-8 md:p-10' 
          : 'min-h-[660px] lg:min-h-[720px] p-3 sm:p-6 md:p-8'
      } rounded-3xl bg-[#F4F7F5] border border-slate-200 shadow-sm flex items-center justify-center`}>
        
        {/* Subtle decorative medical cross grid overlay */}
        <div className="absolute inset-0 bg-medical-grid opacity-70 pointer-events-none rounded-3xl"></div>

        {/* Ambient table glow */}
        <div className="absolute w-[80%] h-[75%] rounded-[100%] bg-emerald-500/5 blur-3xl pointer-events-none"></div>

        {/* THE OVAL TABLE PHYSICAL BODY */}
        <div className="relative w-[78%] sm:w-[74%] md:w-[70%] lg:w-[66%] h-[350px] sm:h-[400px] lg:h-[440px] rounded-[160px] sm:rounded-[200px] md:rounded-[240px] bg-white border-[10px] sm:border-[14px] border-[#E2E8F0] shadow-[0_15px_40px_rgba(0,0,0,0.04)] flex items-center justify-center p-3 sm:p-6 transition-all">
          
          {/* Inner Inlaid Wood/Steel Rim */}
          <div className="absolute inset-2.5 sm:inset-3 rounded-[145px] sm:rounded-[185px] md:rounded-[225px] border border-emerald-600/10 pointer-events-none"></div>
          <div className="absolute inset-6 sm:inset-8 rounded-[130px] sm:rounded-[165px] md:rounded-[205px] border border-slate-200/60 pointer-events-none"></div>

          {/* TABLE CENTER: DIGITAL RESOLUTION & VOTING SCREEN */}
          <div className="relative z-10 w-full max-w-lg bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-slate-200 shadow-md p-3.5 sm:p-5 text-center text-slate-800 transition-all">
            
            {/* Header chip inside center screen */}
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-semibold uppercase tracking-wider bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                <span>Texte Soumis au Vote</span>
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                {session.scheduledDate} • {session.scheduledTime}
              </div>
            </div>

            {/* Motion Title */}
            <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug mb-2 tracking-tight">
              {session.title}
            </h2>

            {/* Motion Full Text to Vote - Clear & Prominent */}
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

            {/* Real-time Voting Gauge Bar */}
            <div className="mt-4 space-y-2">
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
                  title={`Pour: ${stats.votesFor}`}
                />
                <div
                  className="h-full bg-rose-600 transition-all duration-500"
                  style={{ width: `${stats.againstPercentage}%` }}
                  title={`Contre: ${stats.votesAgainst}`}
                />
                <div
                  className="h-full bg-slate-400 rounded-r-full transition-all duration-500"
                  style={{ width: `${stats.abstainPercentage}%` }}
                  title={`Abstention: ${stats.votesAbstain}`}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <span>Votants ayant voté : <strong className="text-slate-800">{stats.votedCount}</strong>/{stats.totalEligible}</span>
                <span>En attente : <strong className="text-amber-700 font-semibold">{stats.notVotedCount}</strong></span>
              </div>
            </div>

            {/* Quick action buttons on table center */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setIsAttendanceModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                title="Gérer les présences et les procurations de la liste"
              >
                <Users className="w-3.5 h-3.5" />
                Émargement & Pouvoirs
              </button>

              <button
                onClick={onQuickVoteAllFor}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition flex items-center gap-1"
                title="Tous les votants présents votent Pour"
              >
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Tous Pour
              </button>

              <button
                onClick={onSimulateRandomVotes}
                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition flex items-center gap-1 shadow-xs"
                title="Simuler des votes pour démonstration"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Simuler votes
              </button>

              <button
                onClick={onResetVotes}
                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-xs font-medium transition flex items-center gap-1 shadow-xs"
                title="Remettre les votes à zéro"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                Remise à zéro
              </button>

              <button
                onClick={onOpenAdmin}
                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-emerald-50 text-emerald-800 border border-slate-200 hover:border-emerald-300 text-xs font-medium transition flex items-center gap-1 shadow-xs"
                title="Modifier le texte ou les votants"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                Paramètres Séance
              </button>
            </div>

          </div>

        </div>

        {/* SEATS AROUND THE OVAL TABLE */}
        {activeVoters.map((voter, index) => {
          // Angle in radians: distribute evenly around 360 degrees
          const angle = (2 * Math.PI * index) / totalCount - Math.PI / 2;
          
          // Calculate parametric position
          const leftPercent = 50 + radiusX * Math.cos(angle);
          const topPercent = 50 + radiusY * Math.sin(angle);

          const state = session.voterStates[voter.id] || { presence: 'present', vote: 'pending' };
          const isSelected = selectedVoterId === voter.id;

          const isPresent = state.presence === 'present';
          const isProxy = state.presence === 'proxy';
          const isAbsent = state.presence === 'absent';
          const isExcused = state.presence === 'excused';

          const hasVotedFor = state.vote === 'for';
          const hasVotedAgainst = state.vote === 'against';
          const hasVotedAbstain = state.vote === 'abstain';
          const hasVoted = hasVotedFor || hasVotedAgainst || hasVotedAbstain;
          const isPending = !hasVoted && (isPresent || isProxy);

          // Filtering match
          const matchesFilter = 
            filterVoterStatus === 'all' || 
            (filterVoterStatus === 'voted' && hasVoted) ||
            (filterVoterStatus === 'pending' && isPending);

          const proxyRecipient = isProxy && state.proxyToId 
            ? voters.find(v => v.id === state.proxyToId) 
            : null;

          // Proxies held by this voter
          const heldProxies = activeVoters.filter(v => {
            const vs = session.voterStates[v.id];
            return vs?.presence === 'proxy' && vs?.proxyToId === voter.id;
          });

          return (
            <div
              key={voter.id}
              style={{
                left: `${leftPercent}%`,
                top: `${topPercent}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className={`absolute z-20 group transition-all duration-300 ${
                !matchesFilter ? 'opacity-25 scale-90' : 'opacity-100'
              }`}
            >
              {/* Voter Seat Card */}
              <div
                onClick={() => setSelectedVoterId(isSelected ? null : voter.id)}
                className={`cursor-pointer ${
                  isLargeAssembly ? 'w-24 sm:w-26 md:w-28 lg:w-32 xl:w-34 p-1.5 sm:p-2' : 'w-28 sm:w-34 md:w-36 lg:w-40 p-2 sm:p-2.5'
                } rounded-2xl transition-all duration-200 text-left border shadow-xs ${
                  isSelected
                    ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-white scale-105 bg-white border-emerald-500 shadow-lg z-30'
                    : hasVotedFor
                    ? 'bg-white border-emerald-300 shadow-2xs hover:border-emerald-500'
                    : hasVotedAgainst
                    ? 'bg-white border-rose-300 shadow-2xs hover:border-rose-500'
                    : hasVotedAbstain
                    ? 'bg-white border-slate-300 shadow-2xs hover:border-slate-400'
                    : isAbsent || isExcused
                    ? 'bg-slate-50 border-slate-200 opacity-60 hover:opacity-100'
                    : 'bg-white border-amber-300/80 hover:border-amber-400 shadow-2xs'
                }`}
              >
                {/* Seat Micro & Status Dot */}
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1">
                    <span 
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: voter.avatarColor || '#059669' }}
                    />
                    <span className="text-[9px] font-mono text-slate-400 font-medium">
                      N°{voter.seatNumber || index + 1}
                    </span>
                  </div>

                  {/* Presence indicator badge */}
                  <div className="flex items-center">
                    {isPresent && (
                      <span className="flex items-center gap-1 text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span className="hidden sm:inline">Présent</span>
                      </span>
                    )}
                    {isProxy && (
                      <span className="flex items-center gap-1 text-[9px] font-semibold text-amber-800 bg-amber-50 px-1 py-0.2 rounded border border-amber-200" title={`Procuration donnée à ${proxyRecipient?.name || 'un confrère'}`}>
                        <Share2 className="w-2.5 h-2.5 text-amber-600" />
                        <span className="hidden sm:inline">Pouvoir</span>
                      </span>
                    )}
                    {isAbsent && (
                      <span className="flex items-center gap-1 text-[9px] font-semibold text-rose-700 bg-rose-50 px-1 py-0.2 rounded border border-rose-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        <span className="hidden sm:inline">Absent</span>
                      </span>
                    )}
                    {isExcused && (
                      <span className="text-[9px] font-semibold text-slate-600 bg-slate-100 px-1 py-0.2 rounded border border-slate-200">
                        Excusé
                      </span>
                    )}
                  </div>
                </div>

                {/* Voter Name & Specialty */}
                <div className="truncate">
                  <h4 className="text-[11px] font-bold text-slate-800 truncate flex items-center gap-1">
                    <span className="text-emerald-700 font-semibold text-[10px]">{voter.title}</span>
                    <span className="truncate">{voter.name}</span>
                  </h4>
                  <p className="text-[9px] text-slate-500 truncate leading-tight mt-0.5">
                    {voter.specialty || voter.department}
                  </p>
                </div>

                {/* Proxy details if given or received */}
                {isProxy && proxyRecipient && (
                  <div className="mt-0.5 text-[8.5px] font-semibold text-amber-800 bg-amber-50/80 px-1 py-0.5 rounded border border-amber-200/60 truncate">
                    ↳ Pouvoir : {proxyRecipient.name}
                  </div>
                )}

                {heldProxies.length > 0 && (
                  <div className="mt-0.5 text-[8.5px] font-bold text-sky-800 bg-sky-50 px-1 py-0.5 rounded border border-sky-200 flex items-center gap-1">
                    <span>🛡️ {heldProxies.length} pouvoir{heldProxies.length > 1 ? 's' : ''}</span>
                  </div>
                )}

                {/* PROMINENT VOTER STATUS BADGE (VOTED / NOT VOTED) */}
                <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between">
                  {hasVotedFor && (
                    <div className="w-full flex items-center justify-center gap-1 py-0.5 px-1.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold animate-in fade-in">
                      <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                      <span>POUR</span>
                    </div>
                  )}

                  {hasVotedAgainst && (
                    <div className="w-full flex items-center justify-center gap-1 py-0.5 px-1.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-[10px] font-bold animate-in fade-in">
                      <X className="w-3 h-3 text-rose-600 stroke-[3]" />
                      <span>CONTRE</span>
                    </div>
                  )}

                  {hasVotedAbstain && (
                    <div className="w-full flex items-center justify-center gap-1 py-0.5 px-1.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold animate-in fade-in">
                      <span>ABSTENTION</span>
                    </div>
                  )}

                  {isPending && (
                    <div className="w-full flex items-center justify-center gap-1 py-0.5 px-1.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[9.5px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                      <span>EN ATTENTE</span>
                    </div>
                  )}

                  {(isAbsent || isExcused) && (
                    <div className="w-full text-center py-0.5 px-1 rounded-md bg-slate-100 text-slate-400 text-[9px] font-medium">
                      NON VOTANT
                    </div>
                  )}
                </div>

              </div>

            </div>
          );
        })}

      </div>

      {/* ALWAYS CENTERED & FULLY VISIBLE VOTING POPUP MODAL */}
      {selectedVoterId && (() => {
        const selVoter = voters.find(v => v.id === selectedVoterId);
        if (!selVoter) return null;
        const selState = session.voterStates[selVoter.id] || { presence: 'present', vote: 'pending' };

        // Proxies given to selVoter
        const myHeldProxies = activeVoters.filter(v => {
          const vs = session.voterStates[v.id];
          return vs?.presence === 'proxy' && vs?.proxyToId === selVoter.id;
        });

        // Other active voters who can receive a proxy
        const potentialMandataires = activeVoters.filter(v => v.id !== selVoter.id);

        return (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setSelectedVoterId(null)}
          >
            <div 
              className="w-full max-w-md bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 text-slate-800 space-y-4 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm text-white shadow-xs"
                    style={{ backgroundColor: selVoter.avatarColor || '#0284c7' }}
                  >
                    {selVoter.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-emerald-800 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 font-bold">
                        Siège N°{selVoter.seatNumber}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium truncate max-w-[150px]">{selVoter.department || selVoter.specialty}</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mt-0.5">
                      {selVoter.title} {selVoter.name}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedVoterId(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center text-xs font-bold transition"
                  title="Fermer"
                >
                  ✕
                </button>
              </div>

              {/* Mandataire Status info if holding proxies */}
              {myHeldProxies.length > 0 && (
                <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900 flex items-start gap-2">
                  <span className="text-base">🛡️</span>
                  <div>
                    <div className="font-bold">Mandataire ({myHeldProxies.length}/2 pouvoirs reçus) :</div>
                    <div className="text-[11px] text-sky-800 mt-0.5">
                      Ce membre vote pour lui-même et pour : <strong>{myHeldProxies.map(p => p.name).join(', ')}</strong>.
                    </div>
                  </div>
                </div>
              )}

              {/* Presence Selector */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Statut de Présence / Émargement :
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                  <button
                    onClick={() => onSetPresence(selVoter.id, 'present')}
                    className={`py-2 px-3 rounded-xl border text-center transition flex items-center justify-center gap-1.5 ${
                      selState.presence === 'present'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    Présent
                  </button>
                  <button
                    onClick={() => {
                      // Find first available mandataire who has < 2 proxies
                      const defaultCandidate = potentialMandataires.find(cand => {
                        const candCount = activeVoters.filter(v => session.voterStates[v.id]?.presence === 'proxy' && session.voterStates[v.id]?.proxyToId === cand.id && v.id !== selVoter.id).length;
                        return candCount < 2;
                      });
                      onSetPresence(selVoter.id, 'proxy', defaultCandidate?.id || null);
                    }}
                    className={`py-2 px-3 rounded-xl border text-center transition flex items-center justify-center gap-1.5 ${
                      selState.presence === 'proxy'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Procuration
                  </button>
                  <button
                    onClick={() => onSetPresence(selVoter.id, 'absent')}
                    className={`py-2 px-3 rounded-xl border text-center transition flex items-center justify-center gap-1.5 ${
                      selState.presence === 'absent'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                    Absent
                  </button>
                  <button
                    onClick={() => onSetPresence(selVoter.id, 'excused')}
                    className={`py-2 px-3 rounded-xl border text-center transition flex items-center justify-center gap-1.5 ${
                      selState.presence === 'excused'
                        ? 'bg-slate-600 text-white border-slate-600 shadow-xs font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Excusé
                  </button>
                </div>
              </div>

              {/* If Proxy, assign proxy recipient with strict 2 max rule */}
              {selState.presence === 'proxy' && (
                <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-900 block">
                      Mandataire désigné (2 pouvoirs max) :
                    </label>
                    <span className="text-[10px] font-mono text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-bold">
                      Limite : 2 max
                    </span>
                  </div>

                  <select
                    value={selState.proxyToId || ''}
                    onChange={(e) => onSetPresence(selVoter.id, 'proxy', e.target.value || null)}
                    className="w-full p-2.5 rounded-xl border border-amber-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value="">-- Choisir un membre mandataire --</option>
                    {potentialMandataires.map(cand => {
                      const count = activeVoters.filter(v => {
                        const vs = session.voterStates[v.id];
                        return vs?.presence === 'proxy' && vs?.proxyToId === cand.id && v.id !== selVoter.id;
                      }).length;

                      const isFull = count >= 2;
                      const isCurrentlySelected = selState.proxyToId === cand.id;

                      return (
                        <option
                          key={cand.id}
                          value={cand.id}
                          disabled={isFull && !isCurrentlySelected}
                        >
                          {cand.name} ({cand.department || 'Membre'}) — {count}/2 pouvoir{count > 1 ? 's' : ''} {isFull && !isCurrentlySelected ? '(COMPLET - Max 2)' : ''}
                        </option>
                      );
                    })}
                  </select>
                  <p className="text-[10px] text-amber-700 leading-tight">
                    Règle stricte : Un votant ne peut recevoir plus de 2 pouvoirs pour la séance.
                  </p>
                </div>
              )}

              {/* Vote Action Buttons */}
              {(selState.presence === 'present' || selState.presence === 'proxy') && (
                <div className="pt-3 border-t border-slate-100">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                    Exprimer le Suffrage :
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        onVote(selVoter.id, 'for');
                        setSelectedVoterId(null);
                      }}
                      className={`py-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 ${
                        selState.vote === 'for'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-400/40'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      <span>POUR</span>
                    </button>

                    <button
                      onClick={() => {
                        onVote(selVoter.id, 'against');
                        setSelectedVoterId(null);
                      }}
                      className={`py-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 ${
                        selState.vote === 'against'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-sm ring-2 ring-rose-400/40'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
                      }`}
                    >
                      <X className="w-4 h-4" />
                      <span>CONTRE</span>
                    </button>

                    <button
                      onClick={() => {
                        onVote(selVoter.id, 'abstain');
                        setSelectedVoterId(null);
                      }}
                      className={`py-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 ${
                        selState.vote === 'abstain'
                          ? 'bg-slate-700 text-white border-slate-700 shadow-sm ring-2 ring-slate-400/40'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span className="text-xs">ABS.</span>
                      <span className="text-[10px] opacity-80">Abstention</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100">
                <span className="truncate max-w-[200px]">{selVoter.email}</span>
                <button
                  onClick={() => setSelectedVoterId(null)}
                  className="text-slate-600 hover:text-slate-900 font-semibold"
                >
                  Fermer
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* FULL ATTENDANCE & PROXY MANAGEMENT MODAL */}
      {isAttendanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Émargement & Gestion des Pouvoirs (2 max)</h3>
                  <p className="text-xs text-slate-300">
                    Collège électoral actif ({activeVoters.length} membres) — {session.title}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsAttendanceModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-bold transition"
              >
                ✕
              </button>
            </div>

            {/* Attendance Summary Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Collège</span>
                <span className="text-base font-bold text-slate-800">{activeVoters.length}</span>
              </div>
              <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">Présents</span>
                <span className="text-base font-bold text-emerald-800">{stats.presentCount}</span>
              </div>
              <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                <span className="text-[10px] uppercase font-bold text-amber-700 block">Pouvoirs</span>
                <span className="text-base font-bold text-amber-800">{stats.proxyCount}</span>
              </div>
              <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                <span className="text-[10px] uppercase font-bold text-rose-700 block">Absents / Excusés</span>
                <span className="text-base font-bold text-rose-800">{stats.absentCount + stats.excusedCount}</span>
              </div>
              <div className="bg-slate-900 p-2.5 rounded-xl text-white col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block">Total Votant</span>
                <span className="text-base font-bold text-white">{stats.presentCount + stats.proxyCount}</span>
              </div>
            </div>

            {/* Attendance Table */}
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="divide-y divide-slate-100">
                {activeVoters.map((voter) => {
                  const state = session.voterStates[voter.id] || { presence: 'present', vote: 'pending' };
                  const isProxy = state.presence === 'proxy';
                  
                  const heldCount = activeVoters.filter(v => {
                    const vs = session.voterStates[v.id];
                    return vs?.presence === 'proxy' && vs?.proxyToId === voter.id;
                  }).length;

                  const potentialMandataires = activeVoters.filter(v => v.id !== voter.id);

                  return (
                    <div key={voter.id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-xl transition">
                      <div className="flex items-center gap-3 min-w-[200px]">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: voter.avatarColor || '#0284c7' }}
                        >
                          {voter.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{voter.title} {voter.name}</span>
                            {heldCount > 0 && (
                              <span className="text-[10px] bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-bold border border-sky-200">
                                🛡️ {heldCount}/2 pouvoir{heldCount > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {voter.department || voter.specialty} • Siège {voter.seatNumber}
                          </div>
                        </div>
                      </div>

                      {/* Presence Radios / Buttons */}
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          onClick={() => onSetPresence(voter.id, 'present')}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                            state.presence === 'present'
                              ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Présent
                        </button>

                        <button
                          onClick={() => {
                            const defaultCandidate = potentialMandataires.find(cand => {
                              const c = activeVoters.filter(v => session.voterStates[v.id]?.presence === 'proxy' && session.voterStates[v.id]?.proxyToId === cand.id && v.id !== voter.id).length;
                              return c < 2;
                            });
                            onSetPresence(voter.id, 'proxy', defaultCandidate?.id || null);
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                            isProxy
                              ? 'bg-amber-600 text-white shadow-2xs font-bold'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          <Share2 className="w-3 h-3" />
                          Pouvoir
                        </button>

                        <button
                          onClick={() => onSetPresence(voter.id, 'absent')}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                            state.presence === 'absent'
                              ? 'bg-rose-600 text-white shadow-2xs font-bold'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Absent
                        </button>

                        <button
                          onClick={() => onSetPresence(voter.id, 'excused')}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                            state.presence === 'excused'
                              ? 'bg-slate-600 text-white shadow-2xs font-bold'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Excusé
                        </button>
                      </div>

                      {/* Mandataire Selector if Proxy */}
                      {isProxy && (
                        <div className="w-full sm:w-60 flex-shrink-0">
                          <select
                            value={state.proxyToId || ''}
                            onChange={(e) => onSetPresence(voter.id, 'proxy', e.target.value || null)}
                            className="w-full p-1.5 rounded-lg border border-amber-300 bg-white text-xs font-medium text-slate-800"
                          >
                            <option value="">-- Mandataire (2 max) --</option>
                            {potentialMandataires.map(cand => {
                              const count = activeVoters.filter(v => {
                                const vs = session.voterStates[v.id];
                                return vs?.presence === 'proxy' && vs?.proxyToId === cand.id && v.id !== voter.id;
                              }).length;

                              const isFull = count >= 2;
                              const isCur = state.proxyToId === cand.id;

                              return (
                                <option
                                  key={cand.id}
                                  value={cand.id}
                                  disabled={isFull && !isCur}
                                >
                                  ↳ {cand.name} ({count}/2) {isFull && !isCur ? '— MAX' : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Les présences et procurations sont enregistrées et synchronisées en temps réel.
              </span>
              <button
                onClick={() => setIsAttendanceModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs"
              >
                Terminer l'émargement
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
