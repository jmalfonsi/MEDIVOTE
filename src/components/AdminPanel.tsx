import React, { useState, useEffect } from 'react';
import { 
  Save, 
  Plus, 
  Trash2, 
  Edit3, 
  Users, 
  Calendar, 
  Clock, 
  FileText, 
  Check, 
  RotateCcw, 
  Sparkles, 
  MapPin, 
  Database, 
  ArrowRight, 
  Copy, 
  Play, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Lock, 
  Unlock, 
  History as HistoryIcon,
  Search,
  Filter,
  CheckSquare,
  Square,
  ListFilter,
  UploadCloud,
  Layers,
  Share2,
  Mail,
  UserCheck,
  FileDown,
  Printer,
  Hourglass,
  ExternalLink,
  Monitor
} from 'lucide-react';
import { VotingSession, Voter, MajorityType, SessionStatus, MeetingItem, SessionHistoryItem, VoterList, PresenceStatus, VoteChoice, MotionTemplate } from '../types';
import { getMajorityLabel } from '../utils/votingMath';
import { api } from '../services/api';
import { generateSessionPdfReport } from '../utils/pdfExport';
import { PREDEFINED_LOCATIONS } from '../constants/locations';

interface AdminPanelProps {
  session: VotingSession | null;
  voters: Voter[];
  meetings: MeetingItem[];
  history: SessionHistoryItem[];
  lists: VoterList[];
  onSetPresence?: (voterId: string, presence: PresenceStatus, proxyToId?: string | null) => Promise<void> | void;
  onVote?: (voterId: string, vote: VoteChoice) => Promise<void> | void;
  onSaveSession: (sessionData: Partial<VotingSession> & { attendeeIds?: string[] }) => Promise<void>;
  onCreateMeeting: (meetingData: Partial<VotingSession> & { attendeeIds?: string[] }) => Promise<void>;
  onSwitchMeeting: (meetingId: string) => Promise<void>;
  onDeleteMeeting: (meetingId: string) => Promise<void>;
  onDuplicateMeeting: (meetingId: string) => Promise<void>;
  onSaveVoter: (voterData: Partial<Voter> & { name: string }) => Promise<void>;
  onDeleteVoter: (id: string) => Promise<void>;
  onDeleteHistoryItem: (id: string) => Promise<void>;
  onApplyList: (listId: string) => Promise<void>;
  onSaveList: (listData: Partial<VoterList> & { name: string; voterIds: string[] }) => Promise<void>;
  onDeleteList: (id: string) => Promise<void>;
  onImportVoters: (text: string, listCode?: string) => Promise<void>;
  onResetDemo: () => Promise<void>;
  onNavigateToTable: () => void;
}


export const AdminPanel: React.FC<AdminPanelProps> = ({
  session,
  voters,
  meetings,
  history,
  lists,
  onSetPresence,
  onVote,
  onSaveSession,
  onCreateMeeting,
  onSwitchMeeting,
  onDeleteMeeting,
  onDuplicateMeeting,
  onSaveVoter,
  onDeleteVoter,
  onDeleteHistoryItem,
  onApplyList,
  onSaveList,
  onDeleteList,
  onImportVoters,
  onResetDemo,
  onNavigateToTable,
}) => {
  const [activeTab, setActiveTab] = useState<'meetings' | 'attendance' | 'lists' | 'voters' | 'history'>('meetings');
  const [meetingFilter, setMeetingFilter] = useState<'all' | 'active' | 'pending' | 'closed'>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedHistorySnapshot, setSelectedHistorySnapshot] = useState<SessionHistoryItem | null>(null);

  // New/Edit Meeting Modal/Form State
  const [isMeetingFormOpen, setIsMeetingFormOpen] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [referenceCode, setReferenceCode] = useState('CME-2026-08/R1');
  const [title, setTitle] = useState('');
  const [motionText, setMotionText] = useState('');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [scheduledTime, setScheduledTime] = useState('14:30');
  const [location, setLocation] = useState('Salle du Conseil Médical - Pavillon Pasteur');
  const [majorityRequired, setMajorityRequired] = useState<MajorityType>('simple');
  const [quorumPct, setQuorumPct] = useState<number>(0); // Default to 0 (No minimum quorum)
  const [isSecret, setIsSecret] = useState<boolean>(false);
  const [status, setStatus] = useState<SessionStatus>('open');
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<string[]>(voters.map(v => v.id));

  // Voter editing state
  const [editingVoterId, setEditingVoterId] = useState<string | null>(null);
  const [voterName, setVoterName] = useState('');
  const [voterTitle, setVoterTitle] = useState('Dr.');
  const [voterSpecialty, setVoterSpecialty] = useState('');
  const [voterDepartment, setVoterDepartment] = useState('');
  const [voterEmail, setVoterEmail] = useState('');
  const [voterWeight, setVoterWeight] = useState(1);
  const [voterColor, setVoterColor] = useState('#0ea5e9');
  const [voterIsActive, setVoterIsActive] = useState(true);
  const [voterSeatNumber, setVoterSeatNumber] = useState(1);
  const [voterSearch, setVoterSearch] = useState('');

  // Bulk Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Modèles de résolution propres à l'organisme, conservés en base.
  const [templates, setTemplates] = useState<MotionTemplate[]>([]);
  useEffect(() => {
    api.getTemplates()
      .then(r => setTemplates(r.templates || []))
      .catch(() => setTemplates([]));
  }, []);
  const [importText, setImportText] = useState('');
  const [importListCode, setImportListCode] = useState('CA');

  // List Management Form / Modal
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [listName, setListName] = useState('');
  const [listCode, setListCode] = useState('');
  const [listDescription, setListDescription] = useState('');
  const [listSelectedVoterIds, setListSelectedVoterIds] = useState<string[]>([]);
  const [selectedViewingList, setSelectedViewingList] = useState<VoterList | null>(null);

  // Initialize meeting form from active session if opening edit
  const handleOpenEditMeeting = (m?: MeetingItem) => {
    if (m) {
      if (m.status === 'closed') {
        alert('Cette séance est clôturée et archivée. Conformément aux règles de traçabilité, une archive est scellée et ne peut être ni modifiée ni supprimée.');
        return;
      }
      setEditingMeetingId(m.id);
      setReferenceCode(m.referenceCode);
      setTitle(m.title);
      setMotionText(m.motionText);
      setScheduledDate(m.scheduledDate);
      setScheduledTime(m.scheduledTime);
      setLocation(m.location);
      setMajorityRequired(m.majorityRequired);
      setQuorumPct(m.quorumPct ?? 0);
      setIsSecret(m.isSecret);
      setStatus(m.status);
      setSelectedAttendeeIds(session?.id === m.id && session.selectedAttendeeIds ? session.selectedAttendeeIds : voters.map(v => v.id));
    } else {
      // New meeting blank - Quorum defaults to 0%
      setEditingMeetingId(null);
      setReferenceCode(`CME-2026-${String(new Date().getMonth() + 1).padStart(2, '0')}/R${meetings.length + 1}`);
      setTitle('');
      setMotionText('');
      setScheduledDate(new Date().toISOString().split('T')[0]);
      setScheduledTime('14:30');
      setLocation('Saint-Victor');
      setMajorityRequired('simple');
      setQuorumPct(0); // Default: Pas de quorum minimum
      setIsSecret(false);
      setStatus('open');
      setSelectedAttendeeIds(voters.filter(v => v.isActive).map(v => v.id));
    }
    setIsMeetingFormOpen(true);
  };

  const handleApplyTemplate = (tpl: MotionTemplate) => {
    setTitle(tpl.title);
    setMotionText(tpl.motionText);
    setMajorityRequired(tpl.majorityRequired);
    setQuorumPct(tpl.quorumPct ?? 0);
  };

  // Enregistre la résolution en cours de saisie comme modèle réutilisable.
  const handleEnregistrerModele = async () => {
    const nom = window.prompt(
      'Sous quel nom enregistrer ce modèle ?',
      title.slice(0, 60) || 'Nouveau modèle'
    );
    if (!nom) return;
    try {
      const { templates: liste } = await api.saveTemplate({
        name: nom,
        title,
        motionText,
        majorityRequired,
        quorumPct,
      });
      setTemplates(liste);
    } catch (err: any) {
      window.alert(err?.message || "Le modèle n'a pas pu être enregistré.");
    }
  };

  const handleSupprimerModele = async (tpl: MotionTemplate) => {
    if (!window.confirm(`Supprimer définitivement le modèle « ${tpl.name} » ?`)) return;
    try {
      const { templates: liste } = await api.deleteTemplate(tpl.id);
      setTemplates(liste);
    } catch (err: any) {
      window.alert(err?.message || "Le modèle n'a pas pu être supprimé.");
    }
  };

  const handleToggleAttendee = (voterId: string) => {
    if (selectedAttendeeIds.includes(voterId)) {
      setSelectedAttendeeIds(selectedAttendeeIds.filter(id => id !== voterId));
    } else {
      setSelectedAttendeeIds([...selectedAttendeeIds, voterId]);
    }
  };

  const handleSelectAllAttendees = () => {
    setSelectedAttendeeIds(voters.map(v => v.id));
  };

  const handleDeselectAllAttendees = () => {
    setSelectedAttendeeIds([]);
  };

  const handleSelectAttendeesByList = (list: VoterList) => {
    setSelectedAttendeeIds(list.voterIds);
  };

  const handleSaveMeetingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !motionText.trim()) {
      alert('Veuillez renseigner le titre et le texte de la motion.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingMeetingId) {
        await onSaveSession({
          id: editingMeetingId,
          referenceCode,
          title,
          motionText,
          scheduledDate,
          scheduledTime,
          location,
          majorityRequired,
          quorumPct: Number(quorumPct),
          isSecret,
          status,
          attendeeIds: selectedAttendeeIds,
        });
        setSuccessMessage('Séance mise à jour avec succès dans SQLite !');
      } else {
        await onCreateMeeting({
          referenceCode,
          title,
          motionText,
          scheduledDate,
          scheduledTime,
          location,
          majorityRequired,
          quorumPct: Number(quorumPct),
          isSecret,
          status,
          attendeeIds: selectedAttendeeIds,
        });
        setSuccessMessage('Nouvelle séance créée et enregistrée dans SQLite !');
      }
      setIsMeetingFormOpen(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenEditVoter = (v: Voter) => {
    setEditingVoterId(v.id);
    setVoterName(v.name);
    setVoterTitle(v.title);
    setVoterSpecialty(v.specialty);
    setVoterDepartment(v.department);
    setVoterEmail(v.email || '');
    setVoterWeight(v.weight || 1);
    setVoterColor(v.avatarColor || '#0ea5e9');
    setVoterIsActive(v.isActive);
    setVoterSeatNumber(v.seatNumber || 1);
  };

  const handleResetVoterForm = () => {
    setEditingVoterId(null);
    setVoterName('');
    setVoterTitle('Dr.');
    setVoterSpecialty('');
    setVoterDepartment('');
    setVoterEmail('');
    setVoterWeight(1);
    setVoterColor('#0ea5e9');
    setVoterIsActive(true);
    setVoterSeatNumber(voters.length + 1);
  };

  const handleSaveVoterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voterName.trim()) return;
    setIsSaving(true);
    try {
      await onSaveVoter({
        id: editingVoterId || undefined,
        name: voterName,
        title: voterTitle,
        specialty: voterSpecialty,
        department: voterDepartment,
        email: voterEmail,
        weight: Number(voterWeight),
        avatarColor: voterColor,
        isActive: voterIsActive,
        seatNumber: Number(voterSeatNumber),
      });
      handleResetVoterForm();
      setSuccessMessage('Votant enregistré dans la base SQLite !');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Bulk Import Submit
  const handleBulkImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importText.trim()) return;
    setIsSaving(true);
    try {
      await onImportVoters(importText, importListCode);
      setIsImportModalOpen(false);
      setImportText('');
      setSuccessMessage('Importation en masse réussie dans SQLite !');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      alert('Erreur lors de l\'importation: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // List Form Submit
  const handleOpenEditList = (l?: VoterList) => {
    if (l) {
      setEditingListId(l.id);
      setListName(l.name);
      setListCode(l.code);
      setListDescription(l.description || '');
      setListSelectedVoterIds(l.voterIds);
    } else {
      setEditingListId(null);
      setListName('');
      setListCode('LISTE-' + (lists.length + 1));
      setListDescription('');
      setListSelectedVoterIds(voters.map(v => v.id));
    }
    setIsListModalOpen(true);
  };

  const handleSaveListSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listName.trim()) return;
    setIsSaving(true);
    try {
      await onSaveList({
        id: editingListId || undefined,
        name: listName,
        code: listCode,
        description: listDescription,
        voterIds: listSelectedVoterIds,
      });
      setIsListModalOpen(false);
      setSuccessMessage('Liste de votants enregistrée avec succès !');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredVoters = voters.filter(v => 
    v.name.toLowerCase().includes(voterSearch.toLowerCase()) ||
    (v.specialty && v.specialty.toLowerCase().includes(voterSearch.toLowerCase())) ||
    (v.department && v.department.toLowerCase().includes(voterSearch.toLowerCase())) ||
    (v.email && v.email.toLowerCase().includes(voterSearch.toLowerCase()))
  );

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-8 py-7 space-y-7 animate-in fade-in">
      
      {/* Top Admin Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
              Gestionnaire Médical Avancé
            </span>
            <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              SQLite Persistent
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Administration des Délibérations & Réunions de Vote
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Gérez les séances, les résolutions à voter, les listes de collèges (CA, CC, Bureau) et l'archivage SQLite certifié.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => handleOpenEditMeeting()}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Créer une nouvelle réunion</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 text-xs font-semibold border border-slate-200 transition flex items-center gap-1.5"
            title="Importer une liste de votants par copier-coller"
          >
            <UploadCloud className="w-4 h-4 text-emerald-600" />
            <span>Import Rapide</span>
          </button>

          <button
            onClick={onNavigateToTable}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition flex items-center gap-1.5"
          >
            <span>Table ovale</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('meetings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
            activeTab === 'meetings'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          1. Réunions & Ordres du Jour ({meetings.length})
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
            activeTab === 'attendance'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          2. Émargement & Pouvoirs (2 max)
        </button>

        <button
          onClick={() => setActiveTab('lists')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
            activeTab === 'lists'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          3. Collèges & Listes Enregistrées ({lists.length})
        </button>

        <button
          onClick={() => setActiveTab('voters')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
            activeTab === 'voters'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          4. Répertoire des Votants ({voters.length})
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
            activeTab === 'history'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <HistoryIcon className="w-4 h-4" />
          5. Historique & Archives SQLite ({history.length})
        </button>
      </div>

      {/* Notification banner */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-xs animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* TAB 1: MEETINGS & MOTIONS MANAGEMENT */}
      {activeTab === 'meetings' && (
        <div className="space-y-6">
          
          {/* Active Meeting Card */}
          {session && (
            <div className={`border-2 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
              session.status === 'closed'
                ? 'bg-slate-100/90 border-slate-300'
                : 'bg-emerald-50/70 border-emerald-300'
            }`}>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {session.status === 'closed' ? (
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-white font-mono text-xs font-bold flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-slate-300" />
                      SÉANCE ARCHIVÉE & SCELLÉE
                    </span>
                  ) : session.status === 'open' ? (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-mono text-xs font-bold">
                      SCRUTIN OUVERT — VOTE EN COURS
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-sky-600 text-white font-mono text-xs font-bold">
                      SÉANCE AFFICHÉE — SCRUTIN PAS ENCORE OUVERT
                    </span>
                  )}
                  <span className="text-xs text-slate-700 font-mono font-semibold">{session.referenceCode}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {session.title}
                </h3>
                <p className="text-xs text-slate-600 line-clamp-2">
                  {session.motionText}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-emerald-600" /> {session.scheduledDate}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-emerald-600" /> {session.scheduledTime}</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-emerald-600" /> {session.location}</span>
                  <span>• Quorum requis : {session.quorumPct === 0 ? 'Pas de quorum minimum' : `${session.quorumPct}%`}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                {/* PDF Export Button - Grisé tant que la séance n'est pas clôturée */}
                <button
                  onClick={() => {
                    if (session.status === 'closed') {
                      generateSessionPdfReport(session, voters);
                    }
                  }}
                  disabled={session.status !== 'closed'}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5 ${
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
                  <span>Rapport PDF (PV)</span>
                </button>

                {session.status !== 'closed' ? (
                  <button
                    onClick={() => handleOpenEditMeeting(meetings.find(m => m.id === session.id) || {
                      id: session.id,
                      referenceCode: session.referenceCode,
                      title: session.title,
                      motionText: session.motionText,
                      scheduledDate: session.scheduledDate,
                      scheduledTime: session.scheduledTime,
                      location: session.location,
                      status: session.status,
                      majorityRequired: session.majorityRequired,
                      quorumPct: session.quorumPct,
                      isSecret: session.isSecret,
                      outcome: session.outcome,
                      createdAt: session.createdAt,
                      attendeesCount: voters.length,
                      votesCastCount: 0,
                      isActiveMeeting: true
                    })}
                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Modifier cette séance
                  </button>
                ) : (
                  <span className="px-3 py-2 rounded-xl bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold flex items-center gap-1.5" title="Séance clôturée et archivée (inaltérable)">
                    <Lock className="w-3.5 h-3.5 text-slate-600" />
                    Archive scellée
                  </span>
                )}

                <button
                  onClick={onNavigateToTable}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
                >
                  <span>Afficher la table</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* List of All Meetings in SQLite */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-600" />
                  Toutes les Séances & Délibérations Enregistrées en Base
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Une seule séance peut être en cours à la fois. Cliquez sur la séance active pour afficher la Table Ovale.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleOpenEditMeeting()}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter une séance
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setMeetingFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                  meetingFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>Toutes les séances</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[0.625rem] ${meetingFilter === 'all' ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-700'}`}>
                  {meetings.length}
                </span>
              </button>

              <button
                onClick={() => setMeetingFilter('active')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                  meetingFilter === 'active'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Séance active</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[0.625rem] ${meetingFilter === 'active' ? 'bg-emerald-700 text-white' : 'bg-emerald-200 text-emerald-800'}`}>
                  {meetings.filter(m => m.isActiveMeeting && m.status !== 'closed').length}
                </span>
              </button>

              <button
                onClick={() => setMeetingFilter('pending')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                  meetingFilter === 'pending'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                <Hourglass className="w-3 h-3 text-amber-600" />
                <span>En attente</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[0.625rem] ${meetingFilter === 'pending' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-900'}`}>
                  {meetings.filter(m => !m.isActiveMeeting && m.status !== 'closed').length}
                </span>
              </button>

              <button
                onClick={() => setMeetingFilter('closed')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                  meetingFilter === 'closed'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                }`}
              >
                <Lock className="w-3 h-3 text-slate-500" />
                <span>Archivées & Scellées</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[0.625rem] ${meetingFilter === 'closed' ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-700'}`}>
                  {meetings.filter(m => m.status === 'closed').length}
                </span>
              </button>
            </div>

            {/* Meetings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              {meetings
                .filter(m => {
                  if (meetingFilter === 'active') return m.isActiveMeeting && m.status !== 'closed';
                  if (meetingFilter === 'pending') return !m.isActiveMeeting && m.status !== 'closed';
                  if (meetingFilter === 'closed') return m.status === 'closed';
                  return true;
                })
                .map((m) => {
                  const isClosed = m.status === 'closed';
                  // « Séance active » = celle qui s'affiche sur la table.
                  // « Scrutin ouvert » = celle qui accepte des bulletins.
                  // Une séance programmée à 15 h n'est pas en cours à 9 h : elle est
                  // seulement active, jusqu'à ce que le président ouvre le scrutin.
                  const isActive = m.isActiveMeeting && !isClosed;
                  const scrutinOuvert = m.status === 'open' && !isClosed;
                  const heureDepassee =
                    !isClosed &&
                    !scrutinOuvert &&
                    new Date(`${m.scheduledDate}T${m.scheduledTime || '00:00'}`).getTime() < Date.now();
                  const isPending = !isActive && !isClosed;

                  return (
                    <div
                      key={m.id}
                      onClick={() => {
                        // Action when clicking the active card: open table view immediately
                        if (isActive) {
                          onNavigateToTable();
                        }
                      }}
                      className={`rounded-2xl p-5 transition-all flex flex-col justify-between gap-4 relative group ${
                        isActive
                          ? 'bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50 border-2 border-emerald-500 ring-4 ring-emerald-500/10 shadow-md hover:shadow-lg hover:border-emerald-600 cursor-pointer'
                          : isPending
                          ? 'bg-white border-2 border-amber-200/90 hover:border-amber-300 shadow-xs'
                          : 'bg-slate-50/95 border border-slate-300 shadow-2xs'
                      }`}
                    >
                      {/* Active ribbon prompt */}
                      {isActive && (
                        <div className="absolute -top-3 left-4 right-4 flex items-center justify-between">
                          <span className={`px-2.5 py-0.5 rounded-full text-white text-[0.625rem] font-bold tracking-wide uppercase shadow-xs flex items-center gap-1.5 ${scrutinOuvert ? 'bg-emerald-600' : 'bg-sky-600'}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                            {scrutinOuvert ? 'Vote en cours' : 'Séance affichée sur la table'}
                          </span>
                          <span className="text-[0.625rem] text-emerald-800 font-semibold bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-300 group-hover:bg-emerald-600 group-hover:text-white transition">
                            Cliquer pour ouvrir la table ↗
                          </span>
                        </div>
                      )}

                      <div className={`space-y-2.5 ${isActive ? 'pt-1' : ''}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[0.6875rem] font-mono px-2 py-0.5 rounded font-bold border ${
                            isActive 
                              ? 'bg-emerald-100/80 text-emerald-900 border-emerald-300' 
                              : isPending
                              ? 'bg-amber-50 text-amber-900 border-amber-200'
                              : 'bg-slate-200/90 text-slate-800 border-slate-300'
                          }`}>
                            {m.referenceCode}
                          </span>

                          {isClosed ? (
                            <span className="text-[0.625rem] font-bold text-slate-800 bg-slate-200 px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-slate-300 shadow-2xs">
                              <Lock className="w-3 h-3 text-slate-600" />
                              ARCHIVÉE & SCELLÉE
                            </span>
                          ) : scrutinOuvert ? (
                            <span className="text-[0.625rem] font-bold text-emerald-900 bg-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-emerald-400 shadow-2xs">
                              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                              SCRUTIN OUVERT
                            </span>
                          ) : isActive ? (
                            <span className="text-[0.625rem] font-bold text-sky-900 bg-sky-100 px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-sky-300 shadow-2xs">
                              <Monitor className="w-3 h-3 text-sky-700" />
                              SÉANCE ACTIVE · SCRUTIN FERMÉ
                            </span>
                          ) : (
                            <span className="text-[0.625rem] font-bold text-amber-900 bg-amber-100/80 px-2.5 py-1 rounded-full flex items-center gap-1 border border-amber-300">
                              <Hourglass className="w-3 h-3 text-amber-700" />
                              PROGRAMMÉE
                            </span>
                          )}

                          {heureDepassee && isActive && (
                            <span className="text-[0.625rem] font-bold text-amber-900 bg-amber-50 px-2 py-1 rounded-full border border-amber-300">
                              heure passée
                            </span>
                          )}
                        </div>

                        <div>
                          <h4 className={`text-sm font-bold line-clamp-2 ${isActive ? 'text-emerald-950' : 'text-slate-900'}`}>
                            {m.title}
                          </h4>
                          <p className="text-xs text-slate-600 line-clamp-2 mt-1">
                            {m.motionText}
                          </p>
                        </div>

                        <div className={`space-y-1 text-[0.6875rem] pt-2 border-t ${
                          isActive ? 'border-emerald-200 text-emerald-900' : 'border-slate-200 text-slate-500'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <Calendar className={`w-3 h-3 ${isActive ? 'text-emerald-700' : 'text-slate-500'}`} />
                              {m.scheduledDate} à {m.scheduledTime}
                            </span>
                            <span className="font-medium">
                              {m.quorumPct === 0 ? 'Pas de quorum min.' : `Quorum ${m.quorumPct}%`}
                            </span>
                          </div>
                          <div className="flex items-center justify-between font-medium">
                            <span>{getMajorityLabel(m.majorityRequired)}</span>
                            <span>{m.attendeesCount} participants</span>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div 
                        className={`flex items-center justify-between gap-2 pt-3 border-t ${
                          isActive ? 'border-emerald-200' : 'border-slate-200/70'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1.5">
                          {/* PDF Report button - Available when session is closed */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isClosed) {
                                const dummySession: VotingSession = {
                                  id: m.id,
                                  referenceCode: m.referenceCode,
                                  title: m.title,
                                  motionText: m.motionText,
                                  scheduledDate: m.scheduledDate,
                                  scheduledTime: m.scheduledTime,
                                  location: m.location,
                                  status: m.status,
                                  majorityRequired: m.majorityRequired,
                                  quorumPct: m.quorumPct,
                                  isSecret: m.isSecret,
                                  outcome: m.outcome,
                                  createdAt: m.createdAt,
                                  voterStates: {},
                                  selectedAttendeeIds: m.attendeeIds || []
                                };
                                generateSessionPdfReport(dummySession, voters);
                              }
                            }}
                            disabled={!isClosed}
                            className={`p-1.5 rounded-lg border transition ${
                              isClosed
                                ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 cursor-pointer shadow-2xs'
                                : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-50'
                            }`}
                            title={
                              isClosed
                                ? 'Télécharger le PV officiel en PDF'
                                : 'Rapport PDF disponible uniquement une fois la séance clôturée'
                            }
                          >
                            <FileDown className={`w-3.5 h-3.5 ${isClosed ? 'text-emerald-700' : 'text-slate-300'}`} />
                          </button>

                          {/* Edit button - Locked if session is archived/closed */}
                          {!isClosed ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditMeeting(m);
                              }}
                              className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition shadow-2xs"
                              title="Modifier les détails de la séance"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span 
                              className="px-2 py-1 rounded-lg bg-slate-200 text-slate-600 text-[0.625rem] font-semibold flex items-center gap-1 border border-slate-300"
                              title="Cette séance est clôturée et archivée. Elle est scellée et ne peut être ni modifiée ni supprimée."
                            >
                              <Lock className="w-3 h-3 text-slate-500" />
                              <span>Scellée</span>
                            </span>
                          )}

                          {/* Duplicate button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDuplicateMeeting(m.id);
                            }}
                            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition shadow-2xs"
                            title="Dupliquer cette séance pour un nouveau scrutin"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete button - Allowed for pending/open sessions with explicit confirmation */}
                          {!isClosed && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Confirmer la suppression définitive de la séance en attente :\n« ${m.title} » (${m.referenceCode}) ?\n\nCette action est irréversible.`)) {
                                  onDeleteMeeting(m.id);
                                }
                              }}
                              className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition shadow-2xs"
                              title="Supprimer cette séance en attente (confirmation requise)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Right Action */}
                        {isActive ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToTable();
                            }}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                            title="Ouvrir la vue Table Ovale pour cette séance active"
                          >
                            <Monitor className="w-3.5 h-3.5 text-emerald-200" />
                            <span>Ouvrir la table</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        ) : isPending ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSwitchMeeting(m.id);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                            title="Définir cette séance comme l'unique séance active pour le vote en direct"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Activer</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: ATTENDANCE & PROXIES MANAGEMENT (2 PROXIES MAX) */}
      {activeTab === 'attendance' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Active Session Summary & Quorum Card */}
          {session ? (() => {
            const meetingAttendeeIds = session.selectedAttendeeIds && session.selectedAttendeeIds.length > 0
              ? session.selectedAttendeeIds
              : voters.map(v => v.id);

            const sessionVoters = voters.filter(v => meetingAttendeeIds.includes(v.id));
            const presentCount = sessionVoters.filter(v => session.voterStates[v.id]?.presence === 'present').length;
            const proxyCount = sessionVoters.filter(v => session.voterStates[v.id]?.presence === 'proxy').length;
            const absentCount = sessionVoters.filter(v => session.voterStates[v.id]?.presence === 'absent' || session.voterStates[v.id]?.presence === 'excused').length;
            const totalEffectiveVoters = presentCount + proxyCount;
            const quorumPct = session.quorumPct ?? 0;
            const quorumThreshold = Math.ceil((sessionVoters.length * quorumPct) / 100);
            const isQuorumReached = quorumPct === 0 || totalEffectiveVoters >= quorumThreshold;

            return (
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
                
                {/* Header & Quick Action Buttons */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold font-mono">
                        {session.referenceCode}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        Collège électoral actif ({sessionVoters.length} membres)
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 mt-1">
                      Émargement & Attribution des Pouvoirs (2 max par mandataire)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Gérez les présences physiques et délégations de vote. Chaque mandataire ne peut détenir que 2 pouvoirs maximum.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={async () => {
                        if (!onSetPresence) return;
                        for (const v of sessionVoters) {
                          await onSetPresence(v.id, 'present', null);
                        }
                        setSuccessMessage('Tous les membres ont été notés Présents.');
                        setTimeout(() => setSuccessMessage(null), 3000);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200 transition flex items-center gap-1.5"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Tous Présents</span>
                    </button>

                    <button
                      onClick={async () => {
                        if (!onSetPresence) return;
                        for (const v of sessionVoters) {
                          if (session.voterStates[v.id]?.presence === 'proxy') {
                            await onSetPresence(v.id, 'present', null);
                          }
                        }
                        setSuccessMessage('Toutes les procurations ont été réinitialisées.');
                        setTimeout(() => setSuccessMessage(null), 3000);
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Réinitialiser pouvoirs</span>
                    </button>
                  </div>
                </div>

                {/* Quorum & Presence Metrics Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wider block">Membres Collège</span>
                    <strong className="text-xl font-bold text-slate-900">{sessionVoters.length}</strong>
                    <span className="text-[0.6875rem] text-slate-400 block mt-0.5">1 seule liste exclusive</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                    <span className="text-[0.6875rem] font-bold text-emerald-800 uppercase tracking-wider block">Présents Physiques</span>
                    <strong className="text-xl font-bold text-emerald-900">{presentCount}</strong>
                    <span className="text-[0.6875rem] text-emerald-700 block mt-0.5">{sessionVoters.length ? Math.round((presentCount / sessionVoters.length) * 100) : 0}% du collège</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200">
                    <span className="text-[0.6875rem] font-bold text-amber-800 uppercase tracking-wider block">Procurations Valides</span>
                    <strong className="text-xl font-bold text-amber-900">{proxyCount}</strong>
                    <span className="text-[0.6875rem] text-amber-700 block mt-0.5">2 max par mandataire</span>
                  </div>

                  <div className={`p-3.5 rounded-2xl border ${isQuorumReached ? 'bg-emerald-50/70 border-emerald-300' : 'bg-rose-50/70 border-rose-300'}`}>
                    <span className="text-[0.6875rem] font-bold uppercase tracking-wider block text-slate-700">
                      Règle de Quorum
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <strong className={`text-xl font-bold ${isQuorumReached ? 'text-emerald-900' : 'text-rose-900'}`}>
                        {totalEffectiveVoters}
                      </strong>
                      <span className="text-xs text-slate-500 font-medium">
                        / {sessionVoters.length} voix ({quorumPct === 0 ? 'Sans Quorum' : `${quorumPct}% req.`})
                      </span>
                    </div>
                    <span className={`text-[0.6875rem] font-semibold block mt-0.5 ${isQuorumReached ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {quorumPct === 0 ? '✓ Aucun quorum minimum requis' : isQuorumReached ? '✓ Quorum atteint' : '⚠️ Quorum non atteint'}
                    </span>
                  </div>
                </div>

                {/* Table of Members */}
                <div className="space-y-3 pt-2">
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <th className="py-3 px-4">Siège / Votant</th>
                          <th className="py-3 px-3">Statut de Présence</th>
                          <th className="py-3 px-3">Délégation (Mandataire)</th>
                          <th className="py-3 px-3">Pouvoirs Détenus</th>
                          <th className="py-3 px-3 text-center">Poids de Vote</th>
                          <th className="py-3 px-3 text-right">Suffrage Direct</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sessionVoters.map((voter) => {
                          const state = session.voterStates[voter.id] || { presence: 'present', vote: 'pending' };
                          
                          // Count how many proxies this voter holds
                          const heldProxies = sessionVoters.filter(v => {
                            const vs = session.voterStates[v.id];
                            return vs?.presence === 'proxy' && vs?.proxyToId === voter.id;
                          });

                          // Who this voter delegated to (if presence === 'proxy')
                          const proxyRecipient = state.presence === 'proxy' && state.proxyToId
                            ? voters.find(v => v.id === state.proxyToId)
                            : null;

                          return (
                            <tr key={voter.id} className="hover:bg-slate-50/80 transition">
                              
                              {/* Voter Info */}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2.5">
                                  <div
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[0.6875rem] font-bold flex-shrink-0"
                                    style={{ backgroundColor: voter.avatarColor || '#0ea5e9' }}
                                  >
                                    {voter.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                      <span>{voter.title} {voter.name}</span>
                                      <span className="text-[0.625rem] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                        N°{voter.seatNumber}
                                      </span>
                                    </div>
                                    <div className="text-[0.6875rem] text-slate-500">
                                      {voter.email || voter.department || voter.specialty}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Presence Buttons */}
                              <td className="py-3 px-3">
                                <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                                  <button
                                    onClick={() => onSetPresence?.(voter.id, 'present', null)}
                                    className={`px-2 py-1 rounded-lg text-[0.6875rem] font-semibold transition ${
                                      state.presence === 'present'
                                        ? 'bg-emerald-600 text-white shadow-2xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                  >
                                    Présent
                                  </button>

                                  <button
                                    onClick={() => {
                                      // Find first eligible person with < 2 proxies
                                      const defaultTarget = sessionVoters.find(cand => {
                                        const c = sessionVoters.filter(v => session.voterStates[v.id]?.presence === 'proxy' && session.voterStates[v.id]?.proxyToId === cand.id && v.id !== voter.id).length;
                                        return cand.id !== voter.id && c < 2;
                                      });
                                      onSetPresence?.(voter.id, 'proxy', defaultTarget?.id || null);
                                    }}
                                    className={`px-2 py-1 rounded-lg text-[0.6875rem] font-semibold transition ${
                                      state.presence === 'proxy'
                                        ? 'bg-amber-600 text-white shadow-2xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                  >
                                    Procuration
                                  </button>

                                  <button
                                    onClick={() => onSetPresence?.(voter.id, 'absent', null)}
                                    className={`px-2 py-1 rounded-lg text-[0.6875rem] font-semibold transition ${
                                      state.presence === 'absent'
                                        ? 'bg-rose-600 text-white shadow-2xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                  >
                                    Absent
                                  </button>
                                </div>
                              </td>

                              {/* Proxy Mandataire Selector */}
                              <td className="py-3 px-3">
                                {state.presence === 'proxy' ? (
                                  <div className="flex items-center gap-1.5">
                                    <select
                                      value={state.proxyToId || ''}
                                      onChange={(e) => onSetPresence?.(voter.id, 'proxy', e.target.value || null)}
                                      className="px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 max-w-[200px]"
                                    >
                                      <option value="">-- Choisir le mandataire --</option>
                                      {sessionVoters
                                        .filter(candidate => candidate.id !== voter.id)
                                        .map(candidate => {
                                          const count = sessionVoters.filter(v => {
                                            const vs = session.voterStates[v.id];
                                            return vs?.presence === 'proxy' && vs?.proxyToId === candidate.id && v.id !== voter.id;
                                          }).length;
                                          const isFull = count >= 2;
                                          return (
                                            <option key={candidate.id} value={candidate.id} disabled={isFull}>
                                              {candidate.name} ({count}/2 pouvoir{count > 1 ? 's' : ''}{isFull ? ' - COMPLET' : ''})
                                            </option>
                                          );
                                        })}
                                    </select>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-xs italic">—</span>
                                )}
                              </td>

                              {/* Held Proxies by this voter */}
                              <td className="py-3 px-3">
                                {heldProxies.length > 0 ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1">
                                      <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-900 font-bold text-[0.6875rem] border border-sky-200">
                                        🛡️ {heldProxies.length}/2 pouvoir{heldProxies.length > 1 ? 's' : ''}
                                      </span>
                                    </div>
                                    <div className="text-[0.625rem] text-slate-500 truncate max-w-[180px]">
                                      De : {heldProxies.map(p => p.name).join(', ')}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-xs">0 pouvoir</span>
                                )}
                              </td>

                              {/* Total vote weight */}
                              <td className="py-3 px-3 text-center">
                                {state.presence === 'present' ? (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                    heldProxies.length > 0 
                                      ? 'bg-sky-600 text-white' 
                                      : 'bg-slate-100 text-slate-800'
                                  }`}>
                                    {1 + heldProxies.length} voix
                                  </span>
                                ) : state.presence === 'proxy' ? (
                                  <span className="text-[0.6875rem] text-amber-700 font-semibold">
                                    ↳ Transmis
                                  </span>
                                ) : (
                                  <span className="text-[0.6875rem] text-slate-400 font-medium">
                                    0 voix
                                  </span>
                                )}
                              </td>

                              {/* Live vote status */}
                              <td className="py-3 px-3 text-right">
                                <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                                  state.vote === 'for'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : state.vote === 'against'
                                    ? 'bg-rose-100 text-rose-800'
                                    : state.vote === 'abstain'
                                    ? 'bg-slate-200 text-slate-800'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  {state.vote === 'for' ? 'POUR' : state.vote === 'against' ? 'CONTRE' : state.vote === 'abstain' ? 'ABSTENTION' : 'En attente'}
                                </span>
                              </td>

                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            );
          })() : (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">Aucune réunion active</h3>
              <p className="text-xs text-slate-500">Veuillez sélectionner ou créer une réunion dans l'onglet 1.</p>
            </div>
          )}

        </div>
      )}

      {/* TAB 3: LISTS & COLLEGES MANAGEMENT (CA, CC, BUREAU, CUSTOM) */}
      {activeTab === 'lists' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  Listes Enregistrées & Collèges Électoraux
                </h2>
                <p className="text-xs text-slate-600">
                  Sélectionnez un collège pour voir ses membres, ou appliquez-le en un clic à la réunion active.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 text-xs font-semibold border border-slate-200 transition flex items-center gap-1.5"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Import Copier-Coller</span>
                </button>

                <button
                  onClick={() => handleOpenEditList()}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Créer une nouvelle liste</span>
                </button>
              </div>
            </div>

            {/* List Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {lists.map((list) => {
                const isSelected = selectedViewingList?.id === list.id;
                return (
                  <div
                    key={list.id}
                    className={`rounded-2xl border p-4 transition-all flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800">
                          {list.code}
                        </span>
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                          {list.voterIds.length} membres
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900">
                        {list.name}
                      </h4>

                      <p className="text-xs text-slate-500 line-clamp-2">
                        {list.description || 'Liste de membres certifiés pour le collège électoral.'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setSelectedViewingList(isSelected ? null : list)}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                      >
                        <span>{isSelected ? 'Masquer membres' : 'Voir les membres'}</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditList(list)}
                          className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition"
                          title="Modifier la liste"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            if (confirm(`Appliquer la liste "${list.name}" (${list.voterIds.length} votants) à la séance en direct ?`)) {
                              onApplyList(list.id);
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition flex items-center gap-1"
                          title="Appliquer à la séance active"
                        >
                          <Play className="w-3 h-3" />
                          <span>Appliquer</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected List Members Roster Display */}
            {selectedViewingList && (
              <div className="mt-4 p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">
                      Membres inscrits dans "{selectedViewingList.name}" ({selectedViewingList.voterIds.length})
                    </span>
                    <span className="text-xs font-mono text-slate-500">[{selectedViewingList.code}]</span>
                  </div>

                  <button
                    onClick={() => setSelectedViewingList(null)}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Fermer l'aperçu ✕
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto">
                  {voters
                    .filter(v => selectedViewingList.voterIds.includes(v.id))
                    .map((voter, idx) => (
                      <div
                        key={voter.id}
                        className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs shadow-2xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: voter.avatarColor || '#059669' }}
                          />
                          <div className="truncate">
                            <span className="font-bold text-slate-800 block truncate">
                              {voter.title} {voter.name}
                            </span>
                            <span className="text-[0.625rem] text-slate-400 truncate block">
                              {voter.email || voter.specialty}
                            </span>
                          </div>
                        </div>
                        <span className="text-[0.625rem] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded ml-1 flex-shrink-0">
                          N°{voter.seatNumber || idx + 1}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* TAB 3: VOTERS ROSTER & DIRECTORY */}
      {activeTab === 'voters' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* List of members */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  Répertoire Général des Membres Votants
                </h2>
                <p className="text-xs text-slate-600">
                  Configurez les noms, titres, spécialités, emails et numéros de sièges.
                </p>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={voterSearch}
                  onChange={(e) => setVoterSearch(e.target.value)}
                  placeholder="Rechercher par nom ou email..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:border-emerald-600 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[550px] overflow-y-auto pr-1">
              {filteredVoters.map((voter) => (
                <div
                  key={voter.id}
                  className={`p-3.5 rounded-2xl border transition flex items-start justify-between gap-2 ${
                    voter.isActive
                      ? 'bg-slate-50 border-slate-200 hover:border-emerald-400'
                      : 'bg-slate-100/60 border-slate-200 opacity-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span 
                      className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                      style={{ backgroundColor: voter.avatarColor || '#059669' }}
                    />

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800">
                          <span className="text-emerald-700">{voter.title}</span> {voter.name}
                        </span>
                      </div>
                      {voter.email && (
                        <p className="text-[0.6875rem] text-slate-500 font-mono mt-0.5 truncate max-w-[180px]">
                          {voter.email}
                        </p>
                      )}
                      <p className="text-[0.625rem] text-slate-400">
                        {voter.department || voter.specialty} • Siège N°{voter.seatNumber} • Poids: {voter.weight}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditVoter(voter)}
                      className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition"
                      title="Modifier"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Supprimer le votant ${voter.name} ?`)) {
                          onDeleteVoter(voter.id);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add / Edit Voter Form */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
              {editingVoterId ? <Edit3 className="w-4 h-4 text-amber-500" /> : <Plus className="w-4 h-4 text-emerald-600" />}
              {editingVoterId ? 'Modifier le Membre' : 'Ajouter un Nouveau Votant'}
            </h3>

            <form onSubmit={handleSaveVoterSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Titre</label>
                  <select
                    value={voterTitle}
                    onChange={(e) => setVoterTitle(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:border-emerald-600 focus:bg-white focus:outline-none"
                  >
                    <option value="Pr.">Pr.</option>
                    <option value="Dr.">Dr.</option>
                    <option value="M.">M.</option>
                    <option value="Mme">Mme</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Nom et Prénom</label>
                  <input
                    type="text"
                    value={voterName}
                    onChange={(e) => setVoterName(e.target.value)}
                    required
                    placeholder="Ex: Claire Martin"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:border-emerald-600 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Adresse Email</label>
                <input
                  type="email"
                  value={voterEmail}
                  onChange={(e) => setVoterEmail(e.target.value)}
                  placeholder="contact@exemple.fr"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:border-emerald-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Spécialité / Fonction</label>
                <input
                  type="text"
                  value={voterSpecialty}
                  onChange={(e) => setVoterSpecialty(e.target.value)}
                  placeholder="Ex: Cardiologie Interventionnelle"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:border-emerald-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pôle / Département</label>
                <input
                  type="text"
                  value={voterDepartment}
                  onChange={(e) => setVoterDepartment(e.target.value)}
                  placeholder="Ex: Pôle Cœur-Poumons"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:border-emerald-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">N° de Siège</label>
                  <input
                    type="number"
                    min="1"
                    value={voterSeatNumber}
                    onChange={(e) => setVoterSeatNumber(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:border-emerald-600 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Couleur</label>
                  <input
                    type="color"
                    value={voterColor}
                    onChange={(e) => setVoterColor(e.target.value)}
                    className="w-full h-9 rounded-xl border border-slate-200 cursor-pointer p-1 bg-slate-50"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                {editingVoterId && (
                  <button
                    type="button"
                    onClick={handleResetVoterForm}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Annuler
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isSaving}
                  className="ml-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSaving ? 'Enregistrement...' : editingVoterId ? 'Mettre à jour' : 'Ajouter le Votant'}
                </button>
              </div>
            </form>
          </div>

        </div>
      )}

      {/* TAB 4: HISTORY & ARCHIVES */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <HistoryIcon className="w-4 h-4 text-emerald-600" />
              Procès-Verbaux des Scrutins Clôturés (Archives SQLite)
            </h2>
            <p className="text-xs text-slate-600">
              Retrouvez l'historique complet et inaltérable des délibérations adoptées ou rejetées.
            </p>
          </div>

          {history.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-3">
              <Database className="w-10 h-10 mx-auto text-slate-300" />
              <h3 className="text-sm font-bold text-slate-700">Aucun historique de vote archivé</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Lorsque vous clôturez un vote depuis la table ovale, le résultat et le détail des suffrages sont automatiquement enregistrés ici en SQLite.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {history.map(item => (
                <div 
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-3 flex flex-col justify-between hover:border-emerald-300 transition"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-slate-700 px-2 py-0.5 rounded bg-white border border-slate-200">
                        {item.referenceCode}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        item.outcome === 'adopted' 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}>
                        {item.outcome === 'adopted' ? 'ADOPTÉE' : 'REJETÉE'}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900">
                      {item.title}
                    </h4>

                    <p className="text-xs text-slate-600 line-clamp-2">
                      {item.motionText}
                    </p>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 text-center py-2 bg-white rounded-xl border border-slate-200/80 text-xs">
                      <div>
                        <span className="text-emerald-700 font-bold block">{item.votesFor}</span>
                        <span className="text-[0.625rem] text-slate-500">Pour</span>
                      </div>
                      <div>
                        <span className="text-rose-700 font-bold block">{item.votesAgainst}</span>
                        <span className="text-[0.625rem] text-slate-500">Contre</span>
                      </div>
                      <div>
                        <span className="text-slate-700 font-bold block">{item.votesAbstain}</span>
                        <span className="text-[0.625rem] text-slate-500">Abstention</span>
                      </div>
                    </div>

                    <div className="text-[0.6875rem] text-slate-500 flex items-center justify-between pt-1">
                      <span>Clôturé le {new Date(item.closedAt).toLocaleDateString('fr-FR')}</span>
                      <span>Présents : {item.totalPresent}/{item.totalEligible}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                    <button
                      onClick={() => setSelectedHistorySnapshot(item)}
                      className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
                    >
                      <span>Voir détail du scrutin</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <span className="text-[0.6875rem] text-slate-400 font-medium flex items-center gap-1" title="Registre officiel inaltérable">
                      <Lock className="w-3 h-3 text-slate-400" />
                      <span>Archive scellée</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Detailed History Snapshot Modal */}
          {selectedHistorySnapshot && (
            <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-emerald-800 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                      {selectedHistorySnapshot.referenceCode}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-1">
                      Procès-Verbal de Délibération
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedHistorySnapshot(null)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <p className="font-bold text-sm text-slate-900">{selectedHistorySnapshot.title}</p>
                  <p className="text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
                    {selectedHistorySnapshot.motionText}
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                    <span className="text-lg font-bold text-emerald-800 block">{selectedHistorySnapshot.votesFor}</span>
                    <span className="text-[0.625rem] text-emerald-600 font-semibold">POUR</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                    <span className="text-lg font-bold text-rose-800 block">{selectedHistorySnapshot.votesAgainst}</span>
                    <span className="text-[0.625rem] text-rose-600 font-semibold">CONTRE</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200">
                    <span className="text-lg font-bold text-slate-800 block">{selectedHistorySnapshot.votesAbstain}</span>
                    <span className="text-[0.625rem] text-slate-600 font-semibold">ABSTENTION</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200">
                    <span className="text-lg font-bold text-teal-800 block">{selectedHistorySnapshot.totalCast}</span>
                    <span className="text-[0.625rem] text-teal-600 font-semibold">EXPRIMÉS</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => setSelectedHistorySnapshot(null)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* CREATE / EDIT MEETING MODAL */}
      {isMeetingFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8 space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold text-emerald-800 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 font-mono">
                  {editingMeetingId ? 'ÉDITION RÉUNION' : 'NOUVELLE RÉUNION'}
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-1">
                  {editingMeetingId ? 'Paramètres de la Délibération' : 'Créer une Nouvelle Réunion de Vote'}
                </h2>
              </div>

              <button
                onClick={() => setIsMeetingFormOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
              >
                ✕
              </button>
            </div>

            {/* Modèles de résolution enregistrés par l'organisme */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Vos modèles de résolution
                </span>
                <button
                  type="button"
                  onClick={handleEnregistrerModele}
                  disabled={!title.trim()}
                  title={title.trim() ? 'Enregistrer la saisie en cours comme modèle' : "Renseignez d'abord un intitulé"}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-xs font-semibold text-slate-700 hover:text-emerald-800 transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  Enregistrer comme modèle
                </button>
              </div>

              {templates.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Aucun modèle pour l'instant. Rédigez une résolution ci-dessous, puis enregistrez-la
                  comme modèle pour la réutiliser aux séances suivantes.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {templates.map(tpl => (
                    <div
                      key={tpl.id}
                      className="p-2 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 text-xs transition flex items-start justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => handleApplyTemplate(tpl)}
                        className="text-left min-w-0 flex-1"
                        title="Reprendre ce modèle"
                      >
                        <strong className="text-slate-800 block truncate">{tpl.name}</strong>
                        <span className="text-[0.625rem] text-slate-500 block truncate">{tpl.title}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSupprimerModele(tpl)}
                        aria-label={`Supprimer le modèle ${tpl.name}`}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleSaveMeetingSubmit} className="space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Code de Référence
                  </label>
                  <input
                    type="text"
                    value={referenceCode}
                    onChange={(e) => setReferenceCode(e.target.value)}
                    required
                    placeholder="Ex: CME-2026-08/R1"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-mono focus:border-emerald-600 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    Date de la Réunion
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs focus:border-emerald-600 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    Heure Prévue
                  </label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs focus:border-emerald-600 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Intitulé / Titre de la Délibération
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Ex: Acquisition d'un Robot Chirurgical Da Vinci Xi"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm font-semibold focus:border-emerald-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Texte Intégral à Voter (Affiché au Centre de la Table Ovale)</span>
                  <span className="text-[0.6875rem] text-slate-500">{motionText.length} caractères</span>
                </label>
                <textarea
                  value={motionText}
                  onChange={(e) => setMotionText(e.target.value)}
                  required
                  rows={4}
                  placeholder="Rédigez ici le texte officiel de la résolution..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm leading-relaxed focus:border-emerald-600 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Location selection */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    Lieu de Séance
                  </span>
                  <span className="text-[0.6875rem] text-slate-500 font-normal">
                    {PREDEFINED_LOCATIONS.includes(location as any) ? 'Lieu prédéfini' : 'Lieu personnalisé'}
                  </span>
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {PREDEFINED_LOCATIONS.map((loc) => {
                    const isSelected = location === loc;
                    return (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => setLocation(loc)}
                        className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition text-center truncate ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {loc}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      if (PREDEFINED_LOCATIONS.includes(location as any)) {
                        setLocation('Autre lieu');
                      }
                    }}
                    className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition text-center truncate ${
                      !PREDEFINED_LOCATIONS.includes(location as any)
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    autre : préciser
                  </button>
                </div>

                {!PREDEFINED_LOCATIONS.includes(location as any) && (
                  <div className="pt-1 animate-in fade-in">
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Préciser le lieu de la séance..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs focus:border-emerald-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Majorité Requise
                  </label>
                  <select
                    value={majorityRequired}
                    onChange={(e) => setMajorityRequired(e.target.value as MajorityType)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs focus:border-emerald-600 focus:bg-white focus:outline-none"
                  >
                    <option value="simple">Majorité Simple (Pour &gt; Contre)</option>
                    <option value="absolute">Majorité Absolue (&gt; 50% des exprimés)</option>
                    <option value="two_thirds">Majorité Qualifiée des 2/3 (66.7%)</option>
                    <option value="unanimous">Unanimité (100%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Quorum Minimum</span>
                    <strong className="text-emerald-700">
                      {quorumPct === 0 ? 'Pas de quorum minimum (0%)' : `${quorumPct}%`}
                    </strong>
                  </label>

                  {/* Quorum Presets */}
                  <div className="grid grid-cols-4 gap-1 mb-1.5">
                    <button
                      type="button"
                      onClick={() => setQuorumPct(0)}
                      className={`py-1 px-1 rounded-lg text-[0.6875rem] font-bold border transition ${
                        quorumPct === 0
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      Sans Quorum
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuorumPct(50)}
                      className={`py-1 px-1 rounded-lg text-[0.6875rem] font-bold border transition ${
                        quorumPct === 50
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuorumPct(66)}
                      className={`py-1 px-1 rounded-lg text-[0.6875rem] font-bold border transition ${
                        quorumPct === 66
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      66%
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuorumPct(75)}
                      className={`py-1 px-1 rounded-lg text-[0.6875rem] font-bold border transition ${
                        quorumPct === 75
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      75%
                    </button>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={quorumPct}
                    onChange={(e) => setQuorumPct(Number(e.target.value))}
                    className="w-full accent-emerald-600 mt-1"
                  />
                </div>
              </div>

              {/* Attendee Multi-Selection for this specific meeting */}
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    Votants Siégeant à cette Réunion ({selectedAttendeeIds.length}/{voters.length})
                  </label>

                  {/* Preset list buttons inside meeting form */}
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    {lists.map(l => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => handleSelectAttendeesByList(l)}
                        className="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[0.6875rem] font-semibold"
                      >
                        Liste {l.code} ({l.voterIds.length})
                      </button>
                    ))}

                    <span className="text-slate-300">|</span>

                    <button
                      type="button"
                      onClick={handleSelectAllAttendees}
                      className="text-emerald-700 hover:underline font-semibold text-[0.6875rem]"
                    >
                      Tout cocher
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllAttendees}
                      className="text-slate-500 hover:underline text-[0.6875rem]"
                    >
                      Tout décocher
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-200">
                  {voters.map(v => {
                    const isSelected = selectedAttendeeIds.includes(v.id);
                    return (
                      <div
                        key={v.id}
                        onClick={() => handleToggleAttendee(v.id)}
                        className={`p-2 rounded-xl border text-xs cursor-pointer transition flex items-center gap-2 ${
                          isSelected 
                            ? 'bg-white border-emerald-400 shadow-2xs' 
                            : 'bg-slate-100/50 border-slate-200 opacity-60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="accent-emerald-600 rounded"
                        />
                        <div className="truncate">
                          <span className="font-bold text-slate-800 block truncate">
                            {v.title} {v.name}
                          </span>
                          <span className="text-[0.625rem] text-slate-500 truncate block">
                            {v.specialty || v.department}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit / Cancel */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsMeetingFormOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Enregistrement SQLite...' : 'Enregistrer la Réunion'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* BULK IMPORT MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold text-emerald-800 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                  IMPORTATION EN MASSE
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  Importer ou Mettre à Jour les Listes de Votants
                </h3>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Copiez-collez simplement votre chaîne de destinataires ou liste de votants au format standard (ex: <code>"Nom Prénom" &lt;email@domaine.com&gt;; ...</code>).
            </p>

            <form onSubmit={handleBulkImportSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Affecter automatiquement à la liste / collège :
                </label>
                <select
                  value={importListCode}
                  onChange={(e) => setImportListCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:border-emerald-600 focus:bg-white focus:outline-none"
                >
                  <option value="CA">Conseil d'Administration (CA)</option>
                  <option value="CC">Commission Consultative (CC)</option>
                  <option value="BUREAU">Bureau Exécutif (BUREAU)</option>
                  <option value="CUSTOM">Nouvelle Liste Personnalisée</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Texte brut des votants & emails</span>
                  <span className="text-[0.625rem] text-slate-400">Séparateur ";" ou retours à la ligne</span>
                </label>
                <textarea
                  rows={6}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`Exemple :\n"Benoit Pie SCHLOSSER" <benoitpie_SCHLOSSER@goodyear.com>; "billcagnot" <billcagnot@gmail.com>; "Caroline LOT" <caroline.lot.03@gmail.com>; ...`}
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 focus:border-emerald-600 focus:bg-white focus:outline-none leading-relaxed"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !importText.trim()}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
                >
                  <UploadCloud className="w-4 h-4" />
                  {isSaving ? 'Importation...' : 'Valider & Importer dans SQLite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT LIST MODAL */}
      {isListModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold text-emerald-800 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                  {editingListId ? 'MODIFICATION LISTE' : 'NOUVELLE LISTE'}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  {editingListId ? 'Modifier la Liste de Votants' : 'Créer un Collège Électoral'}
                </h3>
              </div>
              <button
                onClick={() => setIsListModalOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveListSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Nom de la Liste</label>
                  <input
                    type="text"
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                    required
                    placeholder="Ex: Conseil d'Administration"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:border-emerald-600 focus:bg-white focus:outline-none font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Code / Sigle</label>
                  <input
                    type="text"
                    value={listCode}
                    onChange={(e) => setListCode(e.target.value)}
                    required
                    placeholder="Ex: CA"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono focus:border-emerald-600 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description (Facultatif)</label>
                <input
                  type="text"
                  value={listDescription}
                  onChange={(e) => setListDescription(e.target.value)}
                  placeholder="Ex: Membres titulaires du conseil d'administration..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:border-emerald-600 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Members check */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">
                    Sélection des membres ({listSelectedVoterIds.length}/{voters.length})
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setListSelectedVoterIds(voters.map(v => v.id))}
                      className="text-emerald-700 font-semibold hover:underline"
                    >
                      Tout cocher
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setListSelectedVoterIds([])}
                      className="text-slate-500 hover:underline"
                    >
                      Tout décocher
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-200">
                  {voters.map(v => {
                    const isChecked = listSelectedVoterIds.includes(v.id);
                    return (
                      <div
                        key={v.id}
                        onClick={() => {
                          if (isChecked) {
                            setListSelectedVoterIds(listSelectedVoterIds.filter(id => id !== v.id));
                          } else {
                            setListSelectedVoterIds([...listSelectedVoterIds, v.id]);
                          }
                        }}
                        className={`p-2 rounded-xl border cursor-pointer transition flex items-center gap-2 ${
                          isChecked ? 'bg-white border-emerald-400' : 'bg-slate-100/50 border-slate-200 opacity-60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="accent-emerald-600 rounded"
                        />
                        <span className="font-bold text-slate-800 truncate">{v.title} {v.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsListModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs transition flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSaving ? 'Enregistrement...' : 'Enregistrer la Liste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
