import React from 'react';
import { 
  Lock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  X, 
  ShieldCheck, 
  Users, 
  FileText,
  Calendar,
  Clock
} from 'lucide-react';
import { VotingSession, Voter, VoteStatistics } from '../types';
import { getMajorityLabel } from '../utils/votingMath';

interface CloseSessionModalProps {
  session: VotingSession;
  voters: Voter[];
  stats: VoteStatistics;
  isOpen: boolean;
  onClose: () => void;
  onConfirmClose: () => void;
}

export const CloseSessionModal: React.FC<CloseSessionModalProps> = ({
  session,
  voters,
  stats,
  isOpen,
  onClose,
  onConfirmClose,
}) => {
  if (!isOpen) return null;

  const isAdopted = stats.outcome === 'adopted';
  const isRejected = stats.outcome === 'rejected';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-xl space-y-5">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Clôture & Archivage SQLite</h3>
              <p className="text-xs text-slate-500">Validation définitive du procès-verbal de vote</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Resolution details */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between text-xs text-emerald-800 font-mono">
            <span className="font-semibold">{session.referenceCode}</span>
            <span className="text-slate-500">{session.scheduledDate} • {session.scheduledTime}</span>
          </div>
          <h4 className="text-sm font-bold text-slate-900 leading-snug">
            {session.title}
          </h4>
        </div>

        {/* Quorum and Outcome Preview */}
        <div className="space-y-3">
          <div className={`p-4 rounded-2xl border text-center space-y-1 ${
            isAdopted
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : isRejected
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <div className="flex items-center justify-center gap-1.5 text-base font-bold">
              {isAdopted && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
              {isRejected && <XCircle className="w-5 h-5 text-rose-600" />}
              {!isAdopted && !isRejected && <AlertCircle className="w-5 h-5 text-amber-600" />}
              <span>
                {isAdopted ? 'RÉSOLUTION ADOPTÉE' : isRejected ? 'RÉSOLUTION REJETÉE' : 'QUORUM NON ATTEINT'}
              </span>
            </div>
            <p className="text-xs opacity-80">
              Selon la règle : {getMajorityLabel(session.majorityRequired)}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-emerald-700 font-bold text-base block">{stats.votesFor}</span>
              <span className="text-slate-500">Pour ({stats.forPercentage}%)</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-rose-700 font-bold text-base block">{stats.votesAgainst}</span>
              <span className="text-slate-500">Contre ({stats.againstPercentage}%)</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-700 font-bold text-base block">{stats.votesAbstain}</span>
              <span className="text-slate-500">Abstention</span>
            </div>
          </div>
        </div>

        {/* Warning info */}
        <p className="text-xs text-slate-500 leading-relaxed">
          En confirmant la clôture, le résultat sera verrouillé, les votes individuels horodatés et un enregistrement officiel sera créé dans la table <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">sessions_history</code> de votre base SQLite.
        </p>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
          >
            Annuler
          </button>

          <button
            onClick={onConfirmClose}
            className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
          >
            <Lock className="w-4 h-4" />
            <span>Confirmer la Clôture & Archiver</span>
          </button>
        </div>

      </div>
    </div>
  );
};
