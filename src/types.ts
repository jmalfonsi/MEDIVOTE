export type PresenceStatus = 'present' | 'absent' | 'excused' | 'proxy';
export type VoteChoice = 'for' | 'against' | 'abstain' | 'pending';
export type MajorityType = 'simple' | 'absolute' | 'two_thirds' | 'unanimous';
export type SessionStatus = 'draft' | 'open' | 'closed';
export type SessionOutcome = 'pending' | 'adopted' | 'rejected' | 'quorum_not_reached';

export type NotificationType = 
  | 'vote_started' 
  | 'vote_ended' 
  | 'vote_cast' 
  | 'vote_reset' 
  | 'meeting_created' 
  | 'meeting_switched'
  | 'presence_changed' 
  | 'list_applied'
  | 'info';

export interface RealtimeNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  voterName?: string;
  voteChoice?: VoteChoice;
  sessionId?: string;
  outcome?: SessionOutcome;
  read?: boolean;
}

export interface Voter {
  id: string;
  name: string;
  title: string; // e.g. "M.", "Mme", "Dr.", "Pr."
  specialty: string; // e.g. "Administrateur CA & Bureau", "Membre CC"
  department: string; // e.g. "Goodyear", "SSTI 03", "Accore Groupe"
  email?: string;
  weight: number;
  avatarColor: string;
  isActive: boolean;
  seatNumber: number;
  groups?: string[]; // e.g. ['CA', 'BUREAU']
}

export interface VoterList {
  id: string;
  name: string;
  code: string; // 'CA' | 'CC' | 'BUREAU' | custom
  description?: string;
  voterIds: string[];
  createdAt: string;
}

export interface VoterSessionState {
  voterId: string;
  presence: PresenceStatus;
  proxyToId?: string | null;
  vote: VoteChoice;
  votedAt?: string | null;
  note?: string;
}

export interface VotingSession {
  id: string;
  referenceCode: string; // e.g. "CA-2026-08/R1"
  title: string;
  motionText: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:MM
  location: string;
  status: SessionStatus;
  majorityRequired: MajorityType;
  quorumPct: number; // 0 for "Pas de quorum minimum", or 50, 66, etc.
  isSecret: boolean;
  outcome: SessionOutcome;
  createdAt: string;
  closedAt?: string | null;
  voterStates: Record<string, VoterSessionState>; // voterId -> state
  selectedAttendeeIds?: string[]; // IDs of voters selected for this meeting
  activeListCode?: string; // 'CA' | 'CC' | 'BUREAU' | custom
}

export interface MeetingItem {
  id: string;
  referenceCode: string;
  title: string;
  motionText: string;
  scheduledDate: string;
  scheduledTime: string;
  location: string;
  status: SessionStatus;
  majorityRequired: MajorityType;
  quorumPct: number;
  isSecret: boolean;
  outcome: SessionOutcome;
  createdAt: string;
  closedAt?: string | null;
  attendeesCount: number;
  votesCastCount: number;
  isActiveMeeting: boolean;
  activeListCode?: string;
}

export interface MotionTemplate {
  id: string;
  name: string;
  title: string;
  motionText: string;
  majorityRequired: MajorityType;
  quorumPct: number;
  createdAt: string;
}

export interface SessionHistoryItem {
  id: string;
  sessionId: string;
  referenceCode: string;
  title: string;
  motionText: string;
  scheduledDate: string;
  scheduledTime: string;
  location: string;
  totalEligible: number;
  totalPresent: number;
  quorumReached: boolean;
  quorumPct: number;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  totalCast: number;
  majorityRequired: MajorityType;
  outcome: SessionOutcome;
  closedAt: string;
  detailedSnapshot: {
    session: VotingSession;
    voters: Voter[];
    voterStates: VoterSessionState[];
  };
}

export interface VoteStatistics {
  totalEligible: number;
  presentCount: number;
  absentCount: number;
  proxyCount: number;
  excusedCount: number;
  quorumNeeded: number;
  quorumReached: boolean;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  votesPending: number;
  totalExpressed: number;
  forPercentage: number;
  againstPercentage: number;
  abstainPercentage: number;
  majorityRequired: MajorityType;
  outcome: SessionOutcome;
  votedCount: number;
  notVotedCount: number;
}
