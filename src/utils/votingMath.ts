import { VotingSession, Voter, VoteStatistics, SessionOutcome } from '../types';

/** Le collège explicitement vide reste vide ; seuls les membres actifs votent. */
export function sessionVoters(session: VotingSession, voters: Voter[]): Voter[] {
  const ids = session.selectedAttendeeIds ?? voters.map(v => v.id);
  return voters.filter(v => v.isActive && ids.includes(v.id));
}

/** Même interprétation de l'émargement pour les compteurs et les documents. */
export function effectiveState(session: VotingSession, voterId: string, voters: Voter[]) {
  const state = session.voterStates[voterId] ?? { voterId, presence: 'present' as const, vote: 'pending' as const };
  if (state.presence !== 'proxy') return state;
  const recipient = sessionVoters(session, voters).find(v => v.id === state.proxyToId && v.id !== voterId);
  const target = recipient && session.voterStates[recipient.id];
  if (!recipient || (target?.presence ?? 'present') !== 'present') {
    return { ...state, presence: 'absent' as const, vote: 'pending' as const, proxyToId: null };
  }
  return state;
}

/**
 * Règles de scrutin retenues pour cet organisme (arbitrées le 31/08/2026) :
 *  - D1 : les abstentions ENTRENT dans les suffrages exprimés. En majorité absolue
 *         et aux deux tiers, une abstention pèse donc comme une voix contre.
 *  - D2 : le quorum vaut 0 par défaut (réputé atteint), et reste réglable par séance.
 *  - D5 : un membre présent qui n'a pas voté est assimilé à une abstention — mais
 *         seulement à la CLÔTURE, pas pendant que le scrutin est ouvert.
 *
 * `finaliser` distingue les deux temps : pendant le scrutin on affiche une tendance
 * et les non-votants restent visibles comme tels ; à la clôture ils basculent en
 * abstention et le résultat devient définitif. Le serveur est seul à finaliser.
 */
export function calculateVoteStatistics(
  session: VotingSession | null,
  voters: Voter[],
  options?: { finaliser?: boolean }
): VoteStatistics {
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
      votesSecrets: 0,
      abstentionsAssimilees: 0,
      resultatFinalise: false,
    };
  }

  // Filter voters exclusively to the meeting's selected list attendees
  const activeVoters = sessionVoters(session, voters);
  const totalEligible = activeVoters.length;

  let presentCount = 0;
  let absentCount = 0;
  let proxyCount = 0;
  let excusedCount = 0;

  let votesFor = 0;
  let votesAgainst = 0;
  let votesAbstain = 0;
  let votesPending = 0;
  let votesSecrets = 0;

  activeVoters.forEach(voter => {
    const state = effectiveState(session, voter.id, voters);
    
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
      const weight = voter.weight ?? 1;
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
        case 'secret':
          // Bulletin déposé mais masqué : il a été exprimé, son sens n'est pas connu ici.
          votesSecrets += weight;
          break;
        default:
          votesPending += weight;
          break;
      }
    }
  });

  // Règle D5 : à la clôture, les présents n'ayant pas voté deviennent des abstentions.
  const finaliser = options?.finaliser ?? session.status === 'closed';
  const abstentionsAssimilees = finaliser ? votesPending : 0;
  if (finaliser) {
    votesAbstain += votesPending;
    votesPending = 0;
  }

  const totalEffectivePresent = presentCount + proxyCount;
  const quorumPct = session.quorumPct ?? 0;
  const quorumNeeded = quorumPct > 0 ? Math.ceil((totalEligible * quorumPct) / 100) : 0;
  const quorumReached = quorumPct === 0 ? true : totalEffectivePresent >= quorumNeeded;

  // Règle D1 : les abstentions sont comprises dans les suffrages exprimés.
  const totalExpressed = votesFor + votesAgainst + votesAbstain;

  const forPercentage = totalExpressed > 0 ? Math.round((votesFor / totalExpressed) * 100) : 0;
  const againstPercentage = totalExpressed > 0 ? Math.round((votesAgainst / totalExpressed) * 100) : 0;
  const abstainPercentage = totalExpressed > 0 ? Math.round((votesAbstain / totalExpressed) * 100) : 0;

  let outcome: SessionOutcome = 'pending';

  if (session.status === 'closed') {
    outcome = session.outcome;
  } else if (!quorumReached) {
    outcome = 'quorum_not_reached';
  } else if (votesSecrets === 0 && (finaliser || votesPending === 0) && totalExpressed > 0) {
    // Scrutin complet, ou clôture demandée : le sens du vote est déterminé
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
    const s = effectiveState(session, v.id, voters);
    const canVote = s?.presence === 'present' || s?.presence === 'proxy';
    return canVote && (s?.vote === 'for' || s?.vote === 'against' || s?.vote === 'abstain' || s?.vote === 'secret');
  }).length;

  const notVotedCount = activeVoters.filter(v => {
    const s = effectiveState(session, v.id, voters);
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
    votesSecrets,
    abstentionsAssimilees,
    resultatFinalise: finaliser,
  };
}

export function getMajorityLabel(type: string): string {
  switch (type) {
    case 'simple': return 'Majorité simple (Pour > Contre)';
    case 'absolute': return 'Majorité absolue (> 50 % des exprimés, abstentions comprises)';
    case 'two_thirds': return 'Majorité qualifiée (2/3 des exprimés, abstentions comprises)';
    case 'unanimous': return 'Unanimité (aucun contre ni abstention)';
    default: return type;
  }
}
