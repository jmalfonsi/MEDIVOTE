import React, { useState } from 'react';
import { 
  History, 
  Trash2, 
  Eye, 
  Download, 
  Printer, 
  FileText, 
  FileDown,
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Calendar, 
  Clock, 
  Users, 
  Database,
  ArrowRight,
  Search,
  Share2,
  Lock,
  X
} from 'lucide-react';
import { SessionHistoryItem, MajorityType, VotingSession, Voter } from '../types';
import { getMajorityLabel } from '../utils/votingMath';
import { generateSessionPdfReport } from '../utils/pdfExport';

interface HistoryPanelProps {
  history: SessionHistoryItem[];
  onDeleteHistory: (id: string) => Promise<void>;
  onNavigateToTable: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history,
  onDeleteHistory,
  onNavigateToTable,
}) => {
  const [selectedItem, setSelectedItem] = useState<SessionHistoryItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOutcome, setFilterOutcome] = useState<string>('all');

  const filteredHistory = history.filter(item => {
    const matchesSearch = 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.referenceCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.motionText.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filterOutcome === 'all' || item.outcome === filterOutcome;
    return matchesSearch && matchesFilter;
  });

  const handlePrintPV = () => {
    window.print();
  };

  const handleExportPDF = (item: SessionHistoryItem) => {
    // Construct session representation
    const sessionVoters: Voter[] = item.detailedSnapshot?.voters || [];
    const dummyStates: Record<string, { voterId: string; presence: any; vote: any; proxyToId?: string | null }> = {};
    
    if (item.detailedSnapshot?.voterStates) {
      item.detailedSnapshot.voterStates.forEach(vs => {
        dummyStates[vs.voterId] = {
          voterId: vs.voterId,
          presence: vs.presence as any,
          vote: vs.vote as any,
          proxyToId: vs.proxyToId
        };
      });
    }

    const sessionObj: VotingSession = {
      id: item.id,
      referenceCode: item.referenceCode,
      title: item.title,
      motionText: item.motionText,
      scheduledDate: item.scheduledDate,
      scheduledTime: item.scheduledTime,
      location: item.location || 'Conseil Médical',
      status: 'closed',
      majorityRequired: item.majorityRequired,
      quorumPct: item.quorumPct,
      isSecret: false,
      outcome: item.outcome as any,
      createdAt: item.closedAt,
      voterStates: dummyStates,
      selectedAttendeeIds: sessionVoters.map(v => v.id)
    };

    generateSessionPdfReport(sessionObj, sessionVoters);
  };

  const handleExportCSV = () => {
    if (!history.length) return;
    const headers = ['ID', 'Reference', 'Titre', 'Date', 'Heure', 'Eligibles', 'Presents', 'Pour', 'Contre', 'Abstention', 'Resultat', 'Regle'];
    const rows = history.map(h => [
      h.id,
      `"${h.referenceCode}"`,
      `"${h.title.replace(/"/g, '""')}"`,
      h.scheduledDate,
      h.scheduledTime,
      h.totalEligible,
      h.totalPresent,
      h.votesFor,
      h.votesAgainst,
      h.votesAbstain,
      h.outcome,
      h.majorityRequired
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `medivote_registre_sqlite_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 animate-in fade-in">
      
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              Registre SQLite Officiel
            </span>
            <span className="text-xs text-slate-500 font-mono">{history.length} scrutins archivés</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Historique des Délibérations & Procès-Verbaux
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Consultez les résultats certifiés des votes passés, les taux de participation, les quorums et imprimez les procès-verbaux de séance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={!history.length}
            className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 border border-slate-200 disabled:opacity-40"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onNavigateToTable}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
          >
            <span>Table Ovale</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par titre, référence, texte..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs focus:border-emerald-600 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setFilterOutcome('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterOutcome === 'all' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            Tous ({history.length})
          </button>
          <button
            onClick={() => setFilterOutcome('adopted')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterOutcome === 'adopted' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            Adoptées
          </button>
          <button
            onClick={() => setFilterOutcome('rejected')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterOutcome === 'rejected' ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            Rejetées
          </button>
        </div>
      </div>

      {/* History Items List */}
      {!filteredHistory.length ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <History className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">Aucun scrutin archivé correspondant</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Les délibérations clôturées depuis la table ovale sont enregistrées automatiquement ici dans la base SQLite.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((item) => {
            const isAdopted = item.outcome === 'adopted';
            const isRejected = item.outcome === 'rejected';

            return (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 transition shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
              >
                <div className="space-y-2 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-mono font-semibold text-xs border border-emerald-200">
                      {item.referenceCode}
                    </span>
                    
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border flex items-center gap-1 ${
                      isAdopted
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : isRejected
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>
                      {isAdopted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      {isRejected && <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                      <span>{isAdopted ? 'ADOPTÉE' : isRejected ? 'REJETÉE' : 'QUORUM NON ATTEINT'}</span>
                    </span>

                    <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {item.scheduledDate} • {item.scheduledTime}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {item.title}
                  </h3>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {item.motionText}
                  </p>
                </div>

                {/* Metrics Breakdown & Actions */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                  
                  <div className="flex items-center gap-3 text-xs">
                    <div className="text-center px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200">
                      <div className="text-emerald-800 font-bold text-sm">{item.votesFor}</div>
                      <div className="text-[10px] text-emerald-700">Pour</div>
                    </div>

                    <div className="text-center px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200">
                      <div className="text-rose-800 font-bold text-sm">{item.votesAgainst}</div>
                      <div className="text-[10px] text-rose-700">Contre</div>
                    </div>

                    <div className="text-center px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200">
                      <div className="text-slate-700 font-bold text-sm">{item.votesAbstain}</div>
                      <div className="text-[10px] text-slate-500">Abst.</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExportPDF(item)}
                      className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs transition flex items-center gap-1.5"
                      title="Télécharger le PV officiel en PDF"
                    >
                      <FileDown className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Rapport PDF</span>
                    </button>

                    <button
                      onClick={() => setSelectedItem(item)}
                      className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition flex items-center gap-1.5"
                    >
                      <Eye className="w-4 h-4 text-emerald-600" />
                      <span>Voir PV</span>
                    </button>

                    <div 
                      className="px-2.5 py-2 rounded-xl bg-slate-100 text-slate-500 border border-slate-200 text-xs font-medium flex items-center gap-1"
                      title="Séance archivée au registre officiel (inaltérable et non supprimable)"
                    >
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="hidden sm:inline">Scellée</span>
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAIL MODAL / PROCÈS-VERBAL OFFICIEL */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono font-bold text-emerald-700 uppercase tracking-wider">
                    Procès-Verbal de Délibération Médicale
                  </span>
                  <span className="text-xs text-slate-300">•</span>
                  <span className="text-xs font-mono text-slate-500">{selectedItem.referenceCode}</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">{selectedItem.title}</h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportPDF(selectedItem)}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs"
                >
                  <FileDown className="w-4 h-4 text-emerald-400" />
                  <span>Télécharger PDF</span>
                </button>
                <button
                  onClick={handlePrintPV}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 border border-slate-200"
                >
                  <Printer className="w-4 h-4 text-emerald-600" />
                  <span>Imprimer</span>
                </button>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Official Meeting Metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block">Date & Heure</span>
                <span className="font-semibold text-slate-800">{selectedItem.scheduledDate} à {selectedItem.scheduledTime}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Lieu de Séance</span>
                <span className="font-semibold text-slate-800">{selectedItem.location || 'Conseil Médical'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Quorum Constaté</span>
                <span className="font-semibold text-emerald-700">{selectedItem.totalPresent}/{selectedItem.totalEligible} ({selectedItem.quorumPct}%)</span>
              </div>
              <div>
                <span className="text-slate-500 block">Règle de Vote</span>
                <span className="font-semibold text-slate-800">{getMajorityLabel(selectedItem.majorityRequired)}</span>
              </div>
            </div>

            {/* Motion Full Text */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Texte de la Résolution Adoptée / Soumise :
              </h4>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 leading-relaxed">
                {selectedItem.motionText}
              </div>
            </div>

            {/* Voting Result Summary */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Dépouillement & Résultat Final
                </h4>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  selectedItem.outcome === 'adopted'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : selectedItem.outcome === 'rejected'
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  {selectedItem.outcome === 'adopted' ? 'RÉSOLUTION ADOPTÉE' : selectedItem.outcome === 'rejected' ? 'RÉSOLUTION REJETÉE' : 'QUORUM NON ATTEINT'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="text-lg font-bold text-emerald-800">{selectedItem.votesFor}</div>
                  <div className="text-xs text-emerald-700">Voix Pour</div>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                  <div className="text-lg font-bold text-rose-800">{selectedItem.votesAgainst}</div>
                  <div className="text-xs text-rose-700">Voix Contre</div>
                </div>
                <div className="p-3 rounded-xl bg-white border border-slate-200">
                  <div className="text-lg font-bold text-slate-800">{selectedItem.votesAbstain}</div>
                  <div className="text-xs text-slate-500">Abstentions</div>
                </div>
              </div>
            </div>

            {/* Individual Voters Roll Call Snapshot if available */}
            {selectedItem.detailedSnapshot?.voters && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Émargement des Délibérateurs Autour de la Table
                </h4>
                <div className="max-h-48 overflow-y-auto rounded-2xl bg-slate-50 border border-slate-200 p-2 divide-y divide-slate-200/60 text-xs">
                  {selectedItem.detailedSnapshot.voters.map((v) => {
                    const st = selectedItem.detailedSnapshot.voterStates?.find(s => s.voterId === v.id);
                    return (
                      <div key={v.id} className="py-2 px-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{v.title} {v.name}</span>
                          <span className="text-[11px] text-slate-500">({v.specialty})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            st?.presence === 'present' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                            st?.presence === 'proxy' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {st?.presence === 'present' ? 'Présent' : st?.presence === 'proxy' ? 'Procuration' : 'Absent'}
                          </span>

                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            st?.vote === 'for' ? 'bg-emerald-600 text-white' :
                            st?.vote === 'against' ? 'bg-rose-600 text-white' :
                            st?.vote === 'abstain' ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {st?.vote === 'for' ? 'POUR' : st?.vote === 'against' ? 'CONTRE' : st?.vote === 'abstain' ? 'ABSTENTION' : 'NON VOTANT'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <div className="text-[11px] text-slate-500 font-mono">
                Archivé le {new Date(selectedItem.closedAt).toLocaleString('fr-FR')} • Certifié SQLite
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
