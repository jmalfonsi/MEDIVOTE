import React, { useState } from 'react';
import { auth } from '../services/api';
import { 
  UserCheck, 
  ShieldCheck, 
  Lock, 
  Search, 
  ArrowRight, 
  Vote, 
  CheckCircle2, 
  AlertCircle,
  KeyRound,
  Sparkles
} from 'lucide-react';
import { Voter, VotingSession, VoterList } from '../types';

interface ModeSelectionModalProps {
  isOpen: boolean;
  voters: Voter[];
  session: VotingSession | null;
  lists?: VoterList[];
  onSelectVoter: (voterId: string) => void;
  onSelectAdmin: () => void;
}

export const ModeSelectionModal: React.FC<ModeSelectionModalProps> = ({
  isOpen,
  voters,
  session,
  lists = [],
  onSelectVoter,
  onSelectAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<'voter' | 'admin'>('voter');
  const [selectedListFilter, setSelectedListFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [verification, setVerification] = useState(false);

  if (!isOpen) return null;

  const activeVoters = voters.filter(v => v.isActive && (session?.selectedAttendeeIds ?? voters.map(v => v.id)).includes(v.id));

  // Filter by selected list if any
  const currentList = lists.find(l => l.id === selectedListFilter);
  const listVoterIds = currentList ? currentList.voterIds : null;

  const filteredVoters = activeVoters.filter(v => {
    if (listVoterIds && !listVoterIds.includes(v.id)) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      v.name.toLowerCase().includes(term) ||
      (v.specialty && v.specialty.toLowerCase().includes(term)) ||
      (v.department && v.department.toLowerCase().includes(term)) ||
      (v.email && v.email.toLowerCase().includes(term)) ||
      v.seatNumber.toString().includes(term)
    );
  });

  // Le code n'est jamais comparé dans le navigateur : seul le serveur le connaît.
  const soumettreCode = async (code: string) => {
    if (verification) return;
    setVerification(true);
    try {
      await auth.connexionAdmin(code);
      setPin('');
      setPinError(null);
      onSelectAdmin();
    } catch (err: any) {
      setPin('');
      setPinError(err?.message || 'Code administrateur incorrect.');
    } finally {
      setVerification(false);
    }
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (verification) return;
    const nextPin = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(nextPin);
    setPinError(null);
    if (nextPin.length === 6) void soumettreCode(nextPin);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <Vote className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Medivote Pro</h2>
                <span className="text-[0.625rem] px-2 py-0.5 rounded-full bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 font-mono">
                  Sécurisé
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Sélectionnez votre mode d'accès pour la séance en cours
              </p>
            </div>
          </div>

          {session && (
            <div className="hidden sm:block text-right">
              <span className="text-[0.6875rem] font-mono text-emerald-400 font-bold block">{session.referenceCode}</span>
              <span className="text-[0.6875rem] text-slate-300 truncate max-w-[180px] block">{session.title}</span>
            </div>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-2 bg-slate-100 border-b border-slate-200">
          <button
            onClick={() => {
              setActiveTab('voter');
              setPinError(false);
            }}
            className={`py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 ${
              activeTab === 'voter'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 text-emerald-700'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>Mode Votant (Individuel)</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('admin');
              setPinError(false);
            }}
            className={`py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 ${
              activeTab === 'admin'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 text-emerald-700'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock className="w-4 h-4 text-slate-700" />
            <span>Mode Admin / Table Ovale</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          {activeTab === 'voter' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Choisissez votre identité parmi les membres du collège :
                </label>

                {/* List Filter Chips */}
                {lists.length > 0 && (
                  <div className="flex items-center gap-1.5 mb-2.5 overflow-x-auto pb-1">
                    <button
                      onClick={() => setSelectedListFilter('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                        selectedListFilter === 'all'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Tous ({activeVoters.length})
                    </button>

                    {lists.map(list => (
                      <button
                        key={list.id}
                        onClick={() => setSelectedListFilter(list.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                          selectedListFilter === list.id
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {list.name} ({list.voterIds.length})
                      </button>
                    ))}
                  </div>
                )}

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Rechercher par nom, email, spécialité ou N° de siège..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                    >
                      Effacer
                    </button>
                  )}
                </div>
              </div>

              {/* Voter list */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[340px] overflow-y-auto p-1">
                {filteredVoters.length === 0 ? (
                  <div className="col-span-2 py-8 text-center text-slate-400 text-xs">
                    Aucun votant trouvé pour "{searchTerm}"
                  </div>
                ) : (
                  filteredVoters.map((voter) => {
                    const voterState = session?.voterStates[voter.id];
                    const hasVoted = voterState && voterState.vote !== 'pending';

                    return (
                      <button
                        key={voter.id}
                        onClick={() => onSelectVoter(voter.id)}
                        className="p-3 rounded-2xl border border-slate-200 bg-white hover:bg-emerald-50/50 hover:border-emerald-300 text-left transition flex items-center justify-between group shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-2xs flex-shrink-0"
                            style={{ backgroundColor: voter.avatarColor || '#059669' }}
                          >
                            {voter.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate group-hover:text-emerald-900">
                              {voter.title} {voter.name}
                            </div>
                            <div className="text-[0.6875rem] text-slate-500 truncate">
                              {voter.specialty} • Siège {voter.seatNumber}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          {hasVoted && (
                            <span className="text-[0.625rem] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              A voté
                            </span>
                          )}
                          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition" />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-sm mx-auto space-y-6 text-center py-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 mx-auto">
                <KeyRound className="w-6 h-6 text-emerald-700" />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">Accès Administrateur</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Tapez le code administrateur au clavier pour déverrouiller la table et l'administration.
                </p>
              </div>

              {/* Saisie exclusivement au clavier, sans affichage des chiffres. */}
              <label className="relative flex items-center justify-center gap-2 rounded-2xl focus-within:ring-2 focus-within:ring-emerald-500/30">
                <span className="sr-only">Code administrateur à six chiffres</span>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoComplete="off"
                  autoFocus
                  value={pin}
                  onChange={handlePinChange}
                  onPaste={e => e.preventDefault()}
                  onDrop={e => e.preventDefault()}
                  disabled={verification}
                  aria-label="Code administrateur à six chiffres"
                  className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
                />
                {[0, 1, 2, 3, 4, 5].map((idx) => {
                  const isFilled = pin.length > idx;
                  return (
                    <span
                      key={idx}
                      aria-hidden="true"
                      className={`w-9 h-11 rounded-xl border flex items-center justify-center text-base font-bold font-mono transition-all ${
                        isFilled
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-slate-50 text-slate-400'
                      } ${pinError ? 'border-rose-400 bg-rose-50 text-rose-800 animate-shake' : ''}`}
                    >
                      {isFilled ? '•' : ''}
                    </span>
                  );
                })}
              </label>

              {pinError && (
                <div className="text-xs font-semibold text-rose-600 flex items-center justify-center gap-1.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4" />
                  {pinError}
                </div>
              )}

              <p className="text-xs font-semibold text-slate-500">
                {verification ? 'Vérification…' : 'Validation automatique après 6 chiffres · collage désactivé'}
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
