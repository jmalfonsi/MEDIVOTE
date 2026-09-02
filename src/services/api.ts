import { 
  VotingSession, 
  Voter, 
  SessionHistoryItem, 
  VoteChoice, 
  PresenceStatus, 
  MeetingItem, 
  RealtimeNotification,
  VoterList,
  MotionTemplate
} from '../types';

/**
 * Toutes les requêtes portent le cookie de session administrateur. Une réponse 401
 * signifie que la session a expiré : l'application le signale pour redemander le code
 * plutôt que d'échouer silencieusement en pleine séance.
 */
export class SessionExpiree extends Error {
  constructor() {
    super('Session administrateur expirée. Saisissez à nouveau le code.');
    this.name = 'SessionExpiree';
  }
}

async function verifier(res: Response, messageErreur: string): Promise<any> {
  if (res.status === 401) throw new SessionExpiree();
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error || messageErreur);
  }
  return res.json();
}

export const auth = {
  /** Échange le code administrateur contre une session serveur. */
  async connexionAdmin(pin: string): Promise<void> {
    const res = await fetch('/api/auth/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      throw new Error(detail?.error || 'Code administrateur incorrect.');
    }
  },

  /** Indique si une session administrateur est encore ouverte sur ce poste. */
  async estConnecte(): Promise<boolean> {
    const res = await fetch('/api/auth/moi');
    return res.ok;
  },

  async deconnexion(): Promise<void> {
    await fetch('/api/auth/deconnexion', { method: 'POST' });
  },
};

export const api = {
  async getActiveSession(): Promise<{ session: VotingSession | null; voters: Voter[]; meetings?: MeetingItem[] }> {
    const res = await fetch('/api/session/active');
    return verifier(res, 'Erreur lors du chargement de la session');
  },

  async saveSession(session: Partial<VotingSession> & { attendeeIds?: string[] }): Promise<{ session: VotingSession; voters: Voter[]; meetings: MeetingItem[] }> {
    const res = await fetch('/api/session/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    });
    return verifier(res, 'Erreur lors de la sauvegarde de la session');
  },

  async castVote(sessionId: string, voterId: string, vote: VoteChoice): Promise<{ session: VotingSession; voters: Voter[] }> {
    const res = await fetch('/api/session/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, voterId, vote }),
    });
    return verifier(res, 'Erreur lors de l\'enregistrement du vote');
  },

  async setPresence(sessionId: string, voterId: string, presence: PresenceStatus, proxyToId?: string | null): Promise<{ session: VotingSession; voters: Voter[] }> {
    const res = await fetch('/api/session/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, voterId, presence, proxyToId }),
    });
    return verifier(res, 'Erreur lors du changement de présence');
  },

  /** Ouvre ou suspend le scrutin. Le président peut ouvrir avant l'heure annoncée. */
  async definirOuvertureScrutin(sessionId: string, ouvert: boolean): Promise<{ session: VotingSession; voters: Voter[]; meetings: MeetingItem[] }> {
    const res = await fetch('/api/session/ouverture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, ouvert }),
    });
    return verifier(res, "Impossible de changer l'ouverture du scrutin");
  },

  async getTemplates(): Promise<{ templates: MotionTemplate[] }> {
    const res = await fetch('/api/templates');
    return verifier(res, 'Erreur lors du chargement des modèles');
  },

  async saveTemplate(tpl: Partial<MotionTemplate> & { name: string; title: string }): Promise<{ template: MotionTemplate; templates: MotionTemplate[] }> {
    const res = await fetch('/api/templates/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tpl),
    });
    return verifier(res, "Erreur lors de l'enregistrement du modèle");
  },

  async deleteTemplate(id: string): Promise<{ templates: MotionTemplate[] }> {
    const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    return verifier(res, 'Erreur lors de la suppression du modèle');
  },

  async resetVotes(sessionId: string): Promise<{ session: VotingSession; voters: Voter[] }> {
    const res = await fetch('/api/session/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    return verifier(res, 'Erreur lors de la réinitialisation');
  },

  async closeSession(sessionId: string, stats: any): Promise<{ session: VotingSession; history: SessionHistoryItem[]; voters: Voter[]; meetings: MeetingItem[] }> {
    const res = await fetch('/api/session/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, stats }),
    });
    return verifier(res, 'Erreur lors de la clôture du vote');
  },

  // Meetings CRUD
  async getMeetings(): Promise<{ meetings: MeetingItem[] }> {
    const res = await fetch('/api/meetings');
    return verifier(res, 'Erreur lors du chargement des réunions');
  },

  async createMeeting(meetingData: Partial<VotingSession> & { attendeeIds?: string[] }): Promise<{ session: VotingSession; voters: Voter[]; meetings: MeetingItem[] }> {
    const res = await fetch('/api/meetings/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meetingData),
    });
    return verifier(res, 'Erreur lors de la création de la réunion');
  },

  async switchMeeting(meetingId: string): Promise<{ session: VotingSession; voters: Voter[]; meetings: MeetingItem[] }> {
    const res = await fetch('/api/meetings/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId }),
    });
    return verifier(res, 'Erreur lors du changement de réunion');
  },

  async deleteMeeting(id: string): Promise<{ success: boolean; session: VotingSession; voters: Voter[]; meetings: MeetingItem[] }> {
    const res = await fetch(`/api/meetings/${id}`, { method: 'DELETE' });
    return verifier(res, 'Erreur lors de la suppression de la réunion');
  },

  async duplicateMeeting(id: string): Promise<{ session: VotingSession; voters: Voter[]; meetings: MeetingItem[] }> {
    const res = await fetch(`/api/meetings/${id}/duplicate`, { method: 'POST' });
    return verifier(res, 'Erreur lors de la duplication de la réunion');
  },

  // Voters directory
  async getVoters(): Promise<{ voters: Voter[] }> {
    const res = await fetch('/api/voters');
    return verifier(res, 'Erreur lors du chargement des votants');
  },

  async saveVoter(voter: Partial<Voter> & { name: string }): Promise<{ voter: Voter; voters: Voter[]; session: VotingSession }> {
    const res = await fetch('/api/voters/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(voter),
    });
    return verifier(res, 'Erreur lors de la sauvegarde du votant');
  },

  async deleteVoter(id: string): Promise<{ voters: Voter[]; session: VotingSession }> {
    const res = await fetch(`/api/voters/${id}`, { method: 'DELETE' });
    return verifier(res, 'Erreur lors de la suppression');
  },

  // History
  async getHistory(): Promise<{ history: SessionHistoryItem[] }> {
    const res = await fetch('/api/history');
    return verifier(res, 'Erreur lors du chargement de l\'historique');
  },

  async deleteHistory(id: string): Promise<{ history: SessionHistoryItem[] }> {
    const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
    return verifier(res, 'Erreur lors de la suppression de l\'archive');
  },

  // Notifications
  async getNotifications(): Promise<{ notifications: RealtimeNotification[] }> {
    const res = await fetch('/api/notifications');
    return verifier(res, 'Erreur lors du chargement des notifications');
  },

  async clearNotifications(): Promise<{ success: boolean }> {
    const res = await fetch('/api/notifications/clear', { method: 'POST' });
    return verifier(res, 'Erreur lors de la suppression des notifications');
  },

  // Voter lists & bulk import
  async getLists(): Promise<{ lists: VoterList[] }> {
    const res = await fetch('/api/lists');
    return verifier(res, 'Erreur lors du chargement des listes');
  },

  async saveList(listData: Partial<VoterList> & { name: string; voterIds: string[] }): Promise<{ list: VoterList; lists: VoterList[] }> {
    const res = await fetch('/api/lists/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(listData),
    });
    return verifier(res, 'Erreur lors de la sauvegarde de la liste');
  },

  async deleteList(id: string): Promise<{ success: boolean; lists: VoterList[] }> {
    const res = await fetch(`/api/lists/${id}`, { method: 'DELETE' });
    return verifier(res, 'Erreur lors de la suppression de la liste');
  },

  async applyList(sessionId: string, listId: string): Promise<{ session: VotingSession; voters: Voter[]; meetings: MeetingItem[] }> {
    const res = await fetch('/api/lists/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, listId }),
    });
    return verifier(res, 'Erreur lors de l\'application de la liste');
  },

  async importVoters(text: string, listCode?: string): Promise<{ count: number; voters: Voter[]; lists: VoterList[]; session: VotingSession }> {
    const res = await fetch('/api/voters/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, listCode }),
    });
    return verifier(res, 'Erreur lors de l\'importation des votants');
  },

  // Reset
  async resetDemo(): Promise<{ session: VotingSession; voters: Voter[]; history: SessionHistoryItem[]; meetings: MeetingItem[] }> {
    const res = await fetch('/api/reset-demo', { method: 'POST' });
    return verifier(res, 'Erreur lors de la réinitialisation');
  },
};
