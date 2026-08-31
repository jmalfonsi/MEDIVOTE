import { 
  VotingSession, 
  Voter, 
  SessionHistoryItem, 
  VoteChoice, 
  PresenceStatus, 
  MeetingItem, 
  RealtimeNotification,
  VoterList 
} from '../types';

export const api = {
  async getActiveSession(): Promise<{ session: VotingSession | null; voters: Voter[]; meetings?: MeetingItem[] }> {
    const res = await fetch('/api/session/active');
    if (!res.ok) throw new Error('Erreur lors du chargement de la session');
    return res.json();
  },

  async saveSession(session: Partial<VotingSession> & { attendeeIds?: string[] }): Promise<{ session: VotingSession; voters: Voter[]; meetings: MeetingItem[] }> {
    const res = await fetch('/api/session/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    });
    if (!res.ok) throw new Error('Erreur lors de la sauvegarde de la session');
    return res.json();
  },

  async castVote(sessionId: string, voterId: string, vote: VoteChoice): Promise<{ session: VotingSession; voters: Voter[] }> {
    const res = await fetch('/api/session/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, voterId, vote }),
    });
    if (!res.ok) throw new Error('Erreur lors de l\'enregistrement du vote');
    return res.json();
  },

  async setPresence(sessionId: string, voterId: string, presence: PresenceStatus, proxyToId?: string | null): Promise<{ session: VotingSession; voters: Voter[] }> {
    const res = await fetch('/api/session/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, voterId, presence, proxyToId }),
    });
    if (!res.ok) throw new Error('Erreur lors du changement de présence');
    return res.json();
  },

  async resetVotes(sessionId: string): Promise<{ session: VotingSession; voters: Voter[] }> {
    const res = await fetch('/api/session/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    if (!res.ok) throw new Error('Erreur lors de la réinitialisation');
    return res.json();
  },

  async closeSession(sessionId: string, stats: any): Promise<{ session: VotingSession; history: SessionHistoryItem[]; voters: Voter[]; meetings: MeetingItem[] }> {
    const res = await fetch('/api/session/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, stats }),
    });
    if (!res.ok) throw new Error('Erreur lors de la clôture du vote');
    return res.json();
  },

  // Meetings CRUD
  async getMeetings(): Promise<{ meetings: MeetingItem[] }> {
    const res = await fetch('/api/meetings');
    if (!res.ok) throw new Error('Erreur lors du chargement des réunions');
    return res.json();
  },

  async createMeeting(meetingData: Partial<VotingSession> & { attendeeIds?: string[] }): Promise<{ session: VotingSession; voters: Voter[]; meetings: MeetingItem[] }> {
    const res = await fetch('/api/meetings/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meetingData),
    });
    if (!res.ok) throw new Error('Erreur lors de la création de la réunion');
    return res.json();
  },

  async switchMeeting(meetingId: string): Promise<{ session: VotingSession; voters: Voter[]; meetings: MeetingItem[] }> {
    const res = await fetch('/api/meetings/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId }),
    });
    if (!res.ok) throw new Error('Erreur lors du changement de réunion');
    return res.json();
  },

  async deleteMeeting(id: string): Promise<{ success: boolean; session: VotingSession; voters: Voter[]; meetings: MeetingItem[] }> {
    const res = await fetch(`/api/meetings/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur lors de la suppression de la réunion');
    return res.json();
  },

  async duplicateMeeting(id: string): Promise<{ session: VotingSession; voters: Voter[]; meetings: MeetingItem[] }> {
    const res = await fetch(`/api/meetings/${id}/duplicate`, { method: 'POST' });
    if (!res.ok) throw new Error('Erreur lors de la duplication de la réunion');
    return res.json();
  },

  // Voters directory
  async getVoters(): Promise<{ voters: Voter[] }> {
    const res = await fetch('/api/voters');
    if (!res.ok) throw new Error('Erreur lors du chargement des votants');
    return res.json();
  },

  async saveVoter(voter: Partial<Voter> & { name: string }): Promise<{ voter: Voter; voters: Voter[]; session: VotingSession }> {
    const res = await fetch('/api/voters/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(voter),
    });
    if (!res.ok) throw new Error('Erreur lors de la sauvegarde du votant');
    return res.json();
  },

  async deleteVoter(id: string): Promise<{ voters: Voter[]; session: VotingSession }> {
    const res = await fetch(`/api/voters/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur lors de la suppression');
    return res.json();
  },

  // History
  async getHistory(): Promise<{ history: SessionHistoryItem[] }> {
    const res = await fetch('/api/history');
    if (!res.ok) throw new Error('Erreur lors du chargement de l\'historique');
    return res.json();
  },

  async deleteHistory(id: string): Promise<{ history: SessionHistoryItem[] }> {
    const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur lors de la suppression de l\'archive');
    return res.json();
  },

  // Notifications
  async getNotifications(): Promise<{ notifications: RealtimeNotification[] }> {
    const res = await fetch('/api/notifications');
    if (!res.ok) throw new Error('Erreur lors du chargement des notifications');
    return res.json();
  },

  async clearNotifications(): Promise<{ success: boolean }> {
    const res = await fetch('/api/notifications/clear', { method: 'POST' });
    if (!res.ok) throw new Error('Erreur lors de la suppression des notifications');
    return res.json();
  },

  // Voter lists & bulk import
  async getLists(): Promise<{ lists: VoterList[] }> {
    const res = await fetch('/api/lists');
    if (!res.ok) throw new Error('Erreur lors du chargement des listes');
    return res.json();
  },

  async saveList(listData: Partial<VoterList> & { name: string; voterIds: string[] }): Promise<{ list: VoterList; lists: VoterList[] }> {
    const res = await fetch('/api/lists/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(listData),
    });
    if (!res.ok) throw new Error('Erreur lors de la sauvegarde de la liste');
    return res.json();
  },

  async deleteList(id: string): Promise<{ success: boolean; lists: VoterList[] }> {
    const res = await fetch(`/api/lists/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur lors de la suppression de la liste');
    return res.json();
  },

  async applyList(sessionId: string, listId: string): Promise<{ session: VotingSession; voters: Voter[]; meetings: MeetingItem[] }> {
    const res = await fetch('/api/lists/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, listId }),
    });
    if (!res.ok) throw new Error('Erreur lors de l\'application de la liste');
    return res.json();
  },

  async importVoters(text: string, listCode?: string): Promise<{ count: number; voters: Voter[]; lists: VoterList[]; session: VotingSession }> {
    const res = await fetch('/api/voters/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, listCode }),
    });
    if (!res.ok) throw new Error('Erreur lors de l\'importation des votants');
    return res.json();
  },

  // Reset
  async resetDemo(): Promise<{ session: VotingSession; voters: Voter[]; history: SessionHistoryItem[]; meetings: MeetingItem[] }> {
    const res = await fetch('/api/reset-demo', { method: 'POST' });
    if (!res.ok) throw new Error('Erreur lors de la réinitialisation');
    return res.json();
  },
};
