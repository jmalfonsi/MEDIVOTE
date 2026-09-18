import type { SessionHistoryItem } from '../types';

export function historyCsv(history: SessionHistoryItem[]): string {
  const cell = (value: unknown) => {
    const text = String(value ?? '');
    // Éviter qu'un tableur interprète un texte importé comme une formule.
    const safe = /^[=+@\-\t\r]/.test(text) ? "'" + text : text;
    return '"' + safe.replace(/"/g, '""') + '"';
  };
  const rows: unknown[][] = [['ID','Reference','Titre','Date','Heure','Eligibles','Presents','Pour','Contre','Abstention','Resultat','Regle'],
    ...history.map(h=>[h.id,h.referenceCode,h.title,h.scheduledDate,h.scheduledTime,h.totalEligible,h.totalPresent,h.votesFor,h.votesAgainst,h.votesAbstain,h.outcome,h.majorityRequired])];
  return '\uFEFF' + rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
