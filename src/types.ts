export type PresenceStatus = 'present' | 'absent' | 'excused' | 'proxy';
/** 'secret' : le membre a voté, mais le sens de son bulletin est masqué jusqu'à la clôture. */
export type VoteChoice = 'for' | 'against' | 'abstain' | 'pending' | 'secret';
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

/**
 * Séance : la réunion elle-même — une date, un lieu, un collège convoqué, un
 * émargement. Elle porte une ou plusieurs résolutions, qu'on peut lui ajouter
 * avant comme pendant la séance. Ce sont les résolutions qui se votent ; la
 * séance, elle, ne se vote pas.
 */
export interface Seance {
  id: string;
  referenceCode: string; // e.g. "CA-2026-08"
  title: string;         // e.g. "Conseil d'Administration du 12 septembre"
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:MM
  location: string;
  createdAt: string;
  closedAt?: string | null;
  /**
   * Séance présentée sur la table, l'écran de la salle. Une seule à la fois,
   * et aucune quand toutes sont closes : clore une séance la retire de la
   * table. « Sur la table » et « encore ouvrable » sont deux choses ; la
   * seconde se lit sur `closedAt`.
   */
  surLaTable: boolean;
  selectedAttendeeIds: string[];
  activeListCode?: string;
  /** Résolution actuellement présentée sur la table (close ou non). */
  resolutionCouranteId?: string | null;
  /** Résolutions de la séance, dans l'ordre de l'ordre du jour. */
  resolutions: MeetingItem[];
}

export interface VotingSession {
  id: string;
  /** Séance à laquelle cette résolution appartient. */
  seanceId: string;
  /** Rang dans l'ordre du jour de la séance (1, 2, 3…). */
  ordre: number;
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
  seanceId: string;
  ordre: number;
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
  /** Résolution actuellement présentée sur la table. */
  isActiveMeeting: boolean;
  /** La séance de cette résolution est-elle celle affichée sur la table ? */
  seanceActive?: boolean;
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
    /** Décompte arrêté par le serveur à la clôture : c'est lui qui fait foi au PV. */
    stats?: VoteStatistics;
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
  /** Bulletins déposés dont le sens est masqué (scrutin secret en cours). */
  votesSecrets: number;
  /** Non-votants présents assimilés à des abstentions lors de la finalisation (règle D5). */
  abstentionsAssimilees: number;
  /** true lorsque le décompte est celui de la clôture, pas une tendance en cours de scrutin. */
  resultatFinalise: boolean;
}

/** Lien de vote nominatif d'un membre, avec son QR code prêt à afficher. */
export interface LienVote {
  voterId: string;
  url: string;
  /** QR code en data:URI SVG — net à toute taille, aucune bibliothèque côté navigateur. */
  qr: string;
  expireLe: string;
  utilise: boolean;
}
