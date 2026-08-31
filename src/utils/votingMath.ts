import { VotingSession, Voter, VoteStatistics, SessionOutcome } from '../types';

export function calculateVoteStatistics(session: VotingSession | null, voters: Voter[]): VoteStatistics {
  if (!session) {
    return {
      totalEligible: 0,
      presentCount: 0,
      absentCount: 0,
      proxyCount: 0,
      excusedCount: 0,
      quorumNeeded: 0,
      quorumReached: false,
      votesFor: 0,
      votesAgainst: 0,
      votesAbstain: 0,
      votesPending: 0,
      totalExpressed: 0,
      forPercentage: 0,
      againstPercentage: 0,
      abstainPercentage: 0,
      majorityRequired: 'simple',
      outcome: 'pending',
      votedCount: 0,
      notVotedCount: 0,
    };
  }

  // Filter voters exclusively to the meeting's selected list attendees
  const attendeeIds = session.selectedAttendeeIds && session.selectedAttendeeIds.length > 0
    ? session.selectedAttendeeIds
    : voters.map(v => v.id);

  const activeVoters = voters.filter(v => v.isActive && attendeeIds.includes(v.id));
  const totalEligible = activeVoters.length;

  let presentCount = 0;
  let absentCount = 0;
  let proxyCount = 0;
  let excusedCount = 0;

  let votesFor = 0;
  let votesAgainst = 0;
  let votesAbstain = 0;
  let votesPending = 0;

  activeVoters.forEach(voter => {
    const state = session.voterStates[voter.id] || { presence: 'present', vote: 'pending' };
    
    // Presence count
    switch (state.presence) {
      case 'present':
        presentCount++;
        break;
      case 'proxy':
        proxyCount++;
        break;
      case 'absent':
        absentCount++;
        break;
      case 'excused':
        excusedCount++;
        break;
    }

    // A voter can express a vote if present or has a valid proxy
    const canVote = state.presence === 'present' || state.presence === 'proxy';

    if (canVote) {
      const weight = voter.weight || 1;
      switch (state.vote) {
        case 'for':
          votesFor += weight;
          break;
        case 'against':
          votesAgainst += weight;
          break;
        case 'abstain':
          votesAbstain += weight;
          break;
        default:
          votesPending += weight;
          break;
      }
    }
  });

  const totalEffectivePresent = presentCount + proxyCount;
  const quorumPct = session.quorumPct ?? 0;
  const quorumNeeded = quorumPct > 0 ? Math.ceil((totalEligible * quorumPct) / 100) : 0;
  const quorumReached = quorumPct === 0 ? true : totalEffectivePresent >= quorumNeeded;

  const totalExpressed = votesFor + votesAgainst + votesAbstain;
  const totalDecisive = votesFor + votesAgainst; // excluding abstentions for standard French hospital board majority rules

  const forPercentage = totalExpressed > 0 ? Math.round((votesFor / totalExpressed) * 100) : 0;
  const againstPercentage = totalExpressed > 0 ? Math.round((votesAgainst / totalExpressed) * 100) : 0;
  const abstainPercentage = totalExpressed > 0 ? Math.round((votesAbstain / totalExpressed) * 100) : 0;

  let outcome: SessionOutcome = 'pending';

  if (session.status === 'closed') {
    outcome = session.outcome;
  } else if (!quorumReached) {
    outcome = 'quorum_not_reached';
  } else if (votesPending === 0 && totalExpressed > 0) {
    // All votes cast, determine live project outcome
    switch (session.majorityRequired) {
      case 'simple':
        // Plus de Pour que de Contre
        outcome = votesFor > votesAgainst ? 'adopted' : 'rejected';
        break;
      case 'absolute':
        // Majorité absolue des suffrages exprimés (> 50%)
        outcome = votesFor > totalExpressed / 2 ? 'adopted' : 'rejected';
        break;
      case 'two_thirds':
        // Deux tiers des suffrages exprimés (>= 66.67%)
        outcome = votesFor >= Math.ceil((totalExpressed * 2) / 3) ? 'adopted' : 'rejected';
        break;
      case 'unanimous':
        // Unanimité stricte (aucun contre, aucun abstention)
        outcome = votesFor === totalExpressed && votesAgainst === 0 ? 'adopted' : 'rejected';
        break;
    }
  }

  const votedCount = activeVoters.filter(v => {
    const s = session.voterStates[v.id];
    const canVote = s?.presence === 'present' || s?.presence === 'proxy';
    return canVote && (s?.vote === 'for' || s?.vote === 'against' || s?.vote === 'abstain');
  }).length;

  const notVotedCount = activeVoters.filter(v => {
    const s = session.voterStates[v.id];
    const canVote = s?.presence === 'present' || s?.presence === 'proxy';
    return canVote && (!s?.vote || s?.vote === 'pending');
  }).length;

  return {
    totalEligible,
    presentCount,
    absentCount,
    proxyCount,
    excusedCount,
    quorumNeeded,
    quorumReached,
    votesFor,
    votesAgainst,
    votesAbstain,
    votesPending,
    totalExpressed,
    forPercentage,
    againstPercentage,
    abstainPercentage,
    majorityRequired: session.majorityRequired,
    outcome,
    votedCount,
    notVotedCount,
  };
}

export function getMajorityLabel(type: string): string {
  switch (type) {
    case 'simple': return 'Majorité Simple (Pour > Contre)';
    case 'absolute': return 'Majorité Absolue (> 50% exprimés)';
    case 'two_thirds': return 'Majorité Qualifiée (2/3)';
    case 'unanimous': return 'Unanimité (100%)';
    default: return type;
  }
}
