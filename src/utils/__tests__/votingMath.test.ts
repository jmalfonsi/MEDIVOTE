import { describe, it, expect } from 'vitest';
import { calculateVoteStatistics } from '../votingMath';
import { VotingSession, Voter, VoteChoice, PresenceStatus, MajorityType } from '../../types';

/**
 * Ces tests fixent les règles de scrutin arbitrées pour l'organisme :
 * D1 abstentions comprises dans les exprimés, D2 quorum 0 par défaut,
 * D5 non-votant présent assimilé à une abstention à la clôture.
 * Ce sont elles qui déterminent la validité d'une délibération : toute
 * modification du calcul doit d'abord faire échouer un test ici.
 */

function membre(id: string, poids = 1): Voter {
  return {
    id, name: id, title: 'M.', specialty: '', department: '',
    weight: poids, avatarColor: '#000', isActive: true, seatNumber: 1,
  };
}

function seance(
  bulletins: Array<[string, PresenceStatus, VoteChoice]>,
  options: { majorite?: MajorityType; quorumPct?: number; statut?: 'open' | 'closed' } = {}
): { session: VotingSession; voters: Voter[] } {
  const voters = bulletins.map(([id]) => membre(id));
  const voterStates: VotingSession['voterStates'] = {};
  bulletins.forEach(([id, presence, vote]) => {
    voterStates[id] = { voterId: id, presence, vote };
  });
  return {
    voters,
    session: {
      id: 's1', referenceCode: 'CA-TEST', title: 'Test', motionText: '',
      scheduledDate: '2026-09-01', scheduledTime: '14:30', location: 'Moulins',
      status: options.statut ?? 'open',
      majorityRequired: options.majorite ?? 'simple',
      quorumPct: options.quorumPct ?? 0,
      isSecret: false, outcome: 'pending', createdAt: '', voterStates,
      selectedAttendeeIds: voters.map(v => v.id),
    },
  };
}

describe('quorum (D2)', () => {
  it('est réputé atteint lorsque aucun quorum n\'est fixé', () => {
    const { session, voters } = seance([['a', 'absent', 'pending']]);
    const s = calculateVoteStatistics(session, voters);
    expect(s.quorumReached).toBe(true);
    expect(s.quorumNeeded).toBe(0);
  });

  it('compte les procurations parmi les présents', () => {
    const { session, voters } = seance(
      [['a', 'present', 'for'], ['b', 'proxy', 'for'], ['c', 'absent', 'pending'], ['d', 'absent', 'pending']],
      { quorumPct: 50 }
    );
    const s = calculateVoteStatistics(session, voters);
    expect(s.quorumNeeded).toBe(2);
    expect(s.quorumReached).toBe(true);
  });

  it('bloque le résultat quand le quorum manque d\'une voix', () => {
    const { session, voters } = seance(
      [['a', 'present', 'for'], ['b', 'absent', 'pending'], ['c', 'absent', 'pending'], ['d', 'absent', 'pending']],
      { quorumPct: 50 }
    );
    const s = calculateVoteStatistics(session, voters, { finaliser: true });
    expect(s.quorumNeeded).toBe(2);
    expect(s.outcome).toBe('quorum_not_reached');
  });
});

describe('abstentions comprises dans les exprimés (D1)', () => {
  it('rejette en majorité absolue quand les abstentions privent le texte de 50 %', () => {
    const { session, voters } = seance(
      [['a', 'present', 'for'], ['b', 'present', 'for'], ['c', 'present', 'against'], ['d', 'present', 'abstain']],
      { majorite: 'absolute' }
    );
    const s = calculateVoteStatistics(session, voters);
    expect(s.totalExpressed).toBe(4);
    expect(s.outcome).toBe('rejected');
  });

  it('adopte en majorité simple sur le même scrutin, Pour l\'emportant sur Contre', () => {
    const { session, voters } = seance(
      [['a', 'present', 'for'], ['b', 'present', 'for'], ['c', 'present', 'against'], ['d', 'present', 'abstain']],
      { majorite: 'simple' }
    );
    expect(calculateVoteStatistics(session, voters).outcome).toBe('adopted');
  });

  it('exige les deux tiers des exprimés, abstentions incluses', () => {
    const deuxTiers = seance(
      [['a', 'present', 'for'], ['b', 'present', 'for'], ['c', 'present', 'abstain']],
      { majorite: 'two_thirds' }
    );
    expect(calculateVoteStatistics(deuxTiers.session, deuxTiers.voters).outcome).toBe('adopted');

    const justeEnDessous = seance(
      [['a', 'present', 'for'], ['b', 'present', 'for'], ['c', 'present', 'abstain'], ['d', 'present', 'abstain']],
      { majorite: 'two_thirds' }
    );
    expect(calculateVoteStatistics(justeEnDessous.session, justeEnDessous.voters).outcome).toBe('rejected');
  });

  it('rompt l\'unanimité sur une seule abstention', () => {
    const { session, voters } = seance(
      [['a', 'present', 'for'], ['b', 'present', 'for'], ['c', 'present', 'abstain']],
      { majorite: 'unanimous' }
    );
    expect(calculateVoteStatistics(session, voters).outcome).toBe('rejected');
  });
});

describe('non-votant présent (D5)', () => {
  const scrutin = () => seance(
    [['a', 'present', 'for'], ['b', 'present', 'for'], ['c', 'present', 'against'], ['d', 'present', 'pending']],
    { majorite: 'absolute' }
  );

  it('reste une tendance sans résultat tant que le scrutin est ouvert', () => {
    const { session, voters } = scrutin();
    const s = calculateVoteStatistics(session, voters);
    expect(s.votesPending).toBe(1);
    expect(s.notVotedCount).toBe(1);
    expect(s.outcome).toBe('pending');
    expect(s.resultatFinalise).toBe(false);
  });

  it('bascule en abstention à la clôture et fait tomber la majorité absolue', () => {
    const { session, voters } = scrutin();
    const s = calculateVoteStatistics(session, voters, { finaliser: true });
    expect(s.abstentionsAssimilees).toBe(1);
    expect(s.votesAbstain).toBe(1);
    expect(s.votesPending).toBe(0);
    expect(s.totalExpressed).toBe(4);
    expect(s.outcome).toBe('rejected'); // 2 pour sur 4 exprimés : pas plus de la moitié
    expect(s.resultatFinalise).toBe(true);
  });

  it('n\'assimile pas les absents ni les excusés, qui ne sont pas des votants', () => {
    const { session, voters } = seance([
      ['a', 'present', 'for'], ['b', 'absent', 'pending'], ['c', 'excused', 'pending'],
    ]);
    const s = calculateVoteStatistics(session, voters, { finaliser: true });
    expect(s.abstentionsAssimilees).toBe(0);
    expect(s.votesAbstain).toBe(0);
    expect(s.totalExpressed).toBe(1);
    expect(s.outcome).toBe('adopted');
  });
});

describe('pondération et périmètre du collège', () => {
  it('applique le poids de voix de chaque membre', () => {
    const { session, voters } = seance([['a', 'present', 'for'], ['b', 'present', 'against']]);
    voters[0].weight = 3;
    const s = calculateVoteStatistics(session, voters);
    expect(s.votesFor).toBe(3);
    expect(s.outcome).toBe('adopted');
  });

  it('ignore les membres hors de la liste convoquée', () => {
    const { session, voters } = seance([['a', 'present', 'for'], ['b', 'present', 'against']]);
    session.selectedAttendeeIds = ['a'];
    const s = calculateVoteStatistics(session, voters);
    expect(s.totalEligible).toBe(1);
    expect(s.votesAgainst).toBe(0);
  });

  it('compte un bulletin masqué comme exprimé, jamais comme non-votant', () => {
    const { session, voters } = seance([['a', 'present', 'secret'], ['b', 'present', 'pending']]);
    const s = calculateVoteStatistics(session, voters);
    expect(s.votesSecrets).toBe(1);
    expect(s.votedCount).toBe(1);
    expect(s.notVotedCount).toBe(1);
  });
});
