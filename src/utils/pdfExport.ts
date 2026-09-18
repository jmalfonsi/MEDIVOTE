import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { VotingSession, Voter, VoteStatistics } from '../types';
import { getMajorityLabel, calculateVoteStatistics, sessionVoters, effectiveState } from './votingMath';

let logoDataUrl: string | null = null;
export async function prechargerLogo(): Promise<void> {
  if (logoDataUrl) return;
  try {
    const response = await fetch('/logo-ssti03.png');
    if (!response.ok) return;
    const blob = await response.blob();
    logoDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result)); reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch { logoDataUrl = null; }
}

function dateHeure(value?: string | null): string {
  return value ? new Date(value).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) + ' (heure de Paris)' : 'Non renseignée';
}

/** Document construit indépendamment du téléchargement, pour en vérifier le contenu. */
export function buildSessionPdfReport(session: VotingSession, voters: Voter[], customStats?: VoteStatistics): jsPDF {
  const stats = customStats ?? calculateVoteStatistics(session, voters);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const eligible = sessionVoters(session, voters);
  const secret = session.isSecret && session.status !== 'closed';
  const outcome = stats.outcome === 'adopted' ? 'RÉSOLUTION ADOPTÉE' : stats.outcome === 'rejected' ? 'RÉSOLUTION REJETÉE' :
    stats.outcome === 'quorum_not_reached' ? 'QUORUM NON ATTEINT' : session.status === 'closed' ? 'SANS SUITE / AUCUN SUFFRAGE EXPRIMÉ' : 'SCRUTIN EN COURS';
  let y = 32;
  // autoTable pagine aussi les textes libres : aucune hauteur de motion n'est fixée.
  const table = (body: any[][], options: any = {}) => {
    if (options.head && y > height - 24 - 32) { doc.addPage(); y = 32; }
    autoTable(doc, {
      startY: y, margin: { top: 32, bottom: 24, left: 14, right: 14 },
      theme: 'grid', styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.5, overflow: 'linebreak', textColor: [30,41,59], lineColor: [226,232,240], lineWidth: .2 },
      headStyles: { fillColor: [5,150,105], textColor: [255,255,255], fontStyle: 'bold' },
      body, ...options,
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  };
  if (session.status !== 'closed') table([['DOCUMENT PROVISOIRE — le résultat définitif est établi à la clôture.']], { styles: { fontSize: 10, fontStyle: 'bold', textColor: [146,64,14], cellPadding: 3 } });
  table([[`Référence : ${session.referenceCode}`], [session.title]], { styles: { fontSize: 12, fontStyle: 'bold', cellPadding: 3, fillColor: [241,245,249] } });
  table([
    ['Date et heure prévues', `${session.scheduledDate} à ${session.scheduledTime}`],
    ['Lieu', session.location || 'Non renseigné'],
    ['Statut du scrutin', session.status === 'closed' ? 'Clôturé' : session.status === 'open' ? 'Ouvert' : 'Non ouvert / suspendu'],
    ['Clôture effective', dateHeure(session.closedAt)],
    ['Règle de majorité', getMajorityLabel(session.majorityRequired)],
    ['Quorum requis', (session.quorumPct ?? 0) === 0 ? 'Aucun quorum minimum' : `${session.quorumPct} % (${stats.quorumNeeded} membres)`],
    ['Contrôle du quorum', `${stats.presentCount + stats.proxyCount} / ${stats.totalEligible} membres présents ou représentés — ${stats.quorumReached ? 'atteint' : 'non atteint'}`],
    ['Type de scrutin', session.isSecret ? 'Secret jusqu’à la clôture' : 'Public'],
  ], { columnStyles: { 0: { cellWidth: 44, fontStyle: 'bold' } } });
  table([[session.motionText || 'Aucun texte renseigné.']], { head: [['TEXTE DE LA RÉSOLUTION SOUMISE AU VOTE']] });
  table([
    ['Inscrits', String(stats.totalEligible)], ['Présents', String(stats.presentCount)], ['Représentés par pouvoir', String(stats.proxyCount)],
    ['Absents / excusés', `${stats.absentCount} / ${stats.excusedCount}`],
    ...(secret ? [['Bulletins déposés', `${stats.votedCount} — choix masqués avant clôture`]] : [
      ['Suffrages POUR', `${stats.votesFor} (${stats.forPercentage} %)`],
      ['Suffrages CONTRE', `${stats.votesAgainst} (${stats.againstPercentage} %)`],
      ['Abstentions', `${stats.votesAbstain} (${stats.abstainPercentage} %)`],
    ]),
    ['Résultat', secret ? 'Dépouillement à la clôture' : outcome],
  ], { head: [['SYNTHÈSE DES SUFFRAGES', 'RÉSULTAT DU SCRUTIN']], columnStyles: { 0: { cellWidth: 65, fontStyle: 'bold' } } });
  if (stats.abstentionsAssimilees > 0) table([[`${stats.abstentionsAssimilees} voix non exprimées par les membres présents ou représentés ont été assimilées à des abstentions à la clôture. Les abstentions sont comprises dans les suffrages exprimés.`]]);
  const body = eligible.map((v, index) => {
    const state = effectiveState(session, v.id, voters);
    const recipient = voters.find(r => r.id === state.proxyToId);
    const held = eligible.filter(r => { const s = effectiveState(session, r.id, voters); return s.presence === 'proxy' && s.proxyToId === v.id; }).length;
    const presence = state.presence === 'proxy' ? `Pouvoir à ${recipient?.name ?? 'mandataire non renseigné'}` :
      state.presence === 'absent' ? 'Absent' : state.presence === 'excused' ? 'Excusé' : `Présent${held ? ` (${held} pouvoir${held > 1 ? 's' : ''})` : ''}`;
    const canVote = ['present','proxy'].includes(state.presence);
    const vote = !canVote ? 'Non votant' : secret || state.vote === 'secret' ? state.vote === 'pending' ? 'En attente' : 'A voté (secret)' :
      state.vote === 'for' ? 'POUR' : state.vote === 'against' ? 'CONTRE' : state.vote === 'abstain' ? 'ABSTENTION' :
      stats.resultatFinalise && session.outcome !== 'pending' ? 'ABSTENTION (assimilée)' : session.status === 'closed' ? 'Non exprimé' : 'En attente';
    return [`N°${v.seatNumber || index+1}`, `${v.title} ${v.name}`, v.specialty || v.department || 'Membre', presence,
      canVote ? `${v.weight ?? 1} voix${state.presence === 'proxy' ? ' déléguée(s)' : ''}` : '0 voix', vote];
  });
  table(body, { head: [[{content: `FEUILLE D’ÉMARGEMENT (${eligible.length} MEMBRES)`, colSpan: 6}], ['Siège', 'Identité', 'Collège / spécialité', 'Émargement et mandat', 'Poids personnel', 'Suffrage']],
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    columnStyles: { 0: {cellWidth:14}, 1:{cellWidth:38}, 2:{cellWidth:31}, 3:{cellWidth:42}, 4:{cellWidth:23}, 5:{cellWidth:34} },
  });
  table([['Président de séance : nom et signature', 'Secrétaire de séance : nom et signature'], ['','']],
    { pageBreak: 'avoid', rowPageBreak: 'avoid', styles: { fontSize: 9, cellPadding: 3, minCellHeight: 20 } });
  const pages = doc.getNumberOfPages();
  for (let page=1; page<=pages; page++) {
    doc.setPage(page);
    doc.setFillColor(5,150,105); doc.rect(0,0,width,25,'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(13);
    doc.text(session.status === 'closed' ? 'PROCÈS-VERBAL DE DÉLIBÉRATION ET DE VOTE' : 'ÉTAT PROVISOIRE DU SCRUTIN',14,10);
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.text('SSTI 03 — Allier Prévention Santé Entreprises',14,18);
    if (logoDataUrl) { try { doc.setFillColor(255,255,255); doc.roundedRect(width-31,3,17,19,2,2,'F'); doc.addImage(logoDataUrl,'PNG',width-30,5,15,15); } catch {} }
    doc.setTextColor(100,116,139); doc.setFontSize(7);
    doc.text(`MediVote — Édité le ${dateHeure(new Date().toISOString())}`,14,height-12);
    doc.text(`Page ${page} / ${pages}`,width-14,height-12,{align:'right'});
    doc.text('Résultat archivé à la clôture ; signatures à apposer par les responsables de séance.',14,height-7);
  }
  return doc;
}

export function generateSessionPdfReport(session: VotingSession, voters: Voter[], customStats?: VoteStatistics) {
  const doc = buildSessionPdfReport(session,voters,customStats);
  const reference = session.referenceCode.replace(/[/\\?%*:|"<>]/g,'_');
  doc.save(`Proces_Verbal_${reference}_${session.scheduledDate}.pdf`);
}
