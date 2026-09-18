import type { SessionHistoryItem, VotingSession } from '../types';
import { sessionVoters } from './votingMath';

/** Source unique de tous les documents et aperçus d'un résultat archivé. */
export function archivedReport(item: SessionHistoryItem) {
  const snapshot = item.detailedSnapshot;
  if (!snapshot?.session || !Array.isArray(snapshot.voters)) {
    throw new Error('Le détail archivé est indisponible : impossible de produire un procès-verbal fidèle.');
  }
  const session: VotingSession = {
    ...snapshot.session,
    status: 'closed', outcome: item.outcome, closedAt: item.closedAt,
    quorumPct: snapshot.session.quorumPct ?? item.quorumPct,
    voterStates: snapshot.session.voterStates ?? Object.fromEntries((snapshot.voterStates ?? []).map(s => [s.voterId, s])),
  };
  return { session, voters: sessionVoters(session, snapshot.voters), stats: snapshot.stats };
}
