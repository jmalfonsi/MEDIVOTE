import React, { useState } from 'react';
import { VotingSession, Voter, VoteChoice, PresenceStatus } from '../types';
import { VoterFullPageView } from './VoterFullPageView';

interface KioskViewProps {
  session: VotingSession | null;
  voters: Voter[];
  onVote: (voterId: string, vote: VoteChoice) => void;
  onSetPresence: (voterId: string, presence: PresenceStatus, proxyToId?: string | null) => void;
  onNavigateToTable: () => void;
  onChangeVoter?: () => void;
}

export const KioskView: React.FC<KioskViewProps> = ({
  session,
  voters,
  onVote,
  onSetPresence,
  onNavigateToTable,
  onChangeVoter,
}) => {
  const [activeVoterId, setActiveVoterId] = useState<string>(voters[0]?.id || '');
  const [isVoterSelectorOpen, setIsVoterSelectorOpen] = useState(false);

  return (
    <VoterFullPageView
      session={session}
      voters={voters}
      activeVoterId={activeVoterId}
      onVote={onVote}
      onSetPresence={onSetPresence}
      onChangeVoter={() => {
        if (onChangeVoter) {
          onChangeVoter();
        } else {
          setIsVoterSelectorOpen(true);
        }
      }}
      onRequestAdmin={onNavigateToTable}
    />
  );
};
