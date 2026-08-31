import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { VotingSession, Voter, VoteStatistics } from '../types';
import { getMajorityLabel, calculateVoteStatistics } from './votingMath';

/**
 * Le logo de l'organisme est chargé une fois puis conservé : le procès-verbal est
 * un document officiel, il doit porter l'identité du SSTI 03. Si le chargement
 * échoue, le PV est produit sans logo plutôt que pas produit du tout.
 */
let logoDataUrl: string | null = null;

export async function prechargerLogo(): Promise<void> {
  if (logoDataUrl) return;
  try {
    const reponse = await fetch('/logo-ssti03.png');
    if (!reponse.ok) return;
    const blob = await reponse.blob();
    logoDataUrl = await new Promise<string>((resoudre, rejeter) => {
      const lecteur = new FileReader();
      lecteur.onloadend = () => resoudre(String(lecteur.result));
      lecteur.onerror = rejeter;
      lecteur.readAsDataURL(blob);
    });
  } catch (_) {
    logoDataUrl = null;
  }
}

export function generateSessionPdfReport(
  session: VotingSession,
  voters: Voter[],
  customStats?: VoteStatistics
) {
  const stats = customStats || calculateVoteStatistics(session, voters);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Primary Theme Colors (Medical Emerald & Slate)
  const emeraldPrimary = [5, 150, 105]; // #059669
  const darkSlate = [15, 23, 42]; // #0f172a
  const lightBg = [248, 250, 252]; // #f8fafc

  // Header Banner
  doc.setFillColor(5, 150, 105);
  doc.rect(0, 0, pageWidth, 24, 'F');

  // Title in Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('PROCÈS-VERBAL OFFICIEL DE DÉLIBÉRATION & DE VOTE', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(209, 250, 229);
  doc.text('SSTI 03 — Allier Prévention Santé Entreprises', 14, 18);

  // Logo de l'organisme, sur pastille blanche pour rester lisible sur le bandeau.
  if (logoDataUrl) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(pageWidth - 32, 3, 18, 18, 2, 2, 'F');
      doc.addImage(logoDataUrl, 'PNG', pageWidth - 31, 4, 16, 16);
    } catch (_) {
      // Un logo illisible ne doit pas empêcher l'édition du procès-verbal.
    }
  }

  // Date of export
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }) + ' à ' + now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  doc.text(`Édité le ${dateStr}`, pageWidth - 36, 18, { align: 'right' });

  let y = 32;

  // Reference and Title Box
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, y, pageWidth - 28, 22, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, y, pageWidth - 28, 22, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(5, 150, 105);
  doc.text(`RÉFÉRENCE : ${session.referenceCode}`, 18, y + 7);

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  const splitTitle = doc.splitTextToSize(session.title, pageWidth - 36);
  doc.text(splitTitle, 18, y + 14);

  y += 28;

  // Key Metadata Table / Grid
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  const col1 = 14;
  const col2 = 80;
  const col3 = 145;

  doc.text(`Date & Heure : `, col1, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${session.scheduledDate} à ${session.scheduledTime}`, col1 + 24, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Lieu : `, col2, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${session.location || 'Saint-Victor'}`, col2 + 12, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Statut : `, col3, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(session.status === 'closed' ? 190 : 5, session.status === 'closed' ? 18 : 150, session.status === 'closed' ? 60 : 105);
  doc.text(session.status === 'closed' ? 'Séance Clôturée' : 'Séance Active', col3 + 14, y);

  y += 7;

  // La règle de majorité occupe sa propre ligne : son libellé est trop long pour
  // tenir en colonne sans recouvrir les mentions voisines.
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Règle de majorité :', col1, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(getMajorityLabel(session.majorityRequired), col1 + 32, y);

  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Quorum requis :', col1, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const quorumText = session.quorumPct === 0
    ? 'Aucun quorum minimum'
    : `${session.quorumPct} % (${stats.quorumNeeded} voix)`;
  doc.text(quorumText, col1 + 32, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Contrôle du quorum :', col3 - 20, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(stats.quorumReached ? 5 : 220, stats.quorumReached ? 150 : 38, stats.quorumReached ? 105 : 38);
  doc.text(stats.quorumReached ? 'Quorum atteint' : 'Quorum NON atteint', col3 + 15, y);

  y += 10;

  // Text of Motion Soumise au vote
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('TEXTE DE LA MOTION SOUMISE AU VOTE :', 14, y);
  y += 4;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  const motionLines = doc.splitTextToSize(session.motionText, pageWidth - 36);
  const motionHeight = Math.max(14, motionLines.length * 4.5 + 6);
  doc.roundedRect(14, y, pageWidth - 28, motionHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(motionLines, 18, y + 6);

  y += motionHeight + 8;

  // Synthèse des Suffrages & Résultat Card
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('SYNTHÈSE DES SUFFRAGES & RÉSULTAT DU SCRUTIN :', 14, y);
  y += 4;

  const resultBoxHeight = 22;
  const isAdopted = stats.outcome === 'adopted';
  const isRejected = stats.outcome === 'rejected';

  doc.setFillColor(isAdopted ? 236 : isRejected ? 254 : 248, isAdopted ? 253 : isRejected ? 242 : 250, isAdopted ? 245 : isRejected ? 242 : 252);
  doc.setDrawColor(isAdopted ? 167 : isRejected ? 254 : 226, isAdopted ? 243 : isRejected ? 202 : 232, isAdopted ? 208 : isRejected ? 202 : 240);
  doc.roundedRect(14, y, pageWidth - 28, resultBoxHeight, 2, 2, 'FD');

  // Stats Breakdown Columns
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  const block1 = 18;
  const block2 = 55;
  const block3 = 90;
  const block4 = 125;
  const blockResult = 160;

  doc.text('Collège / Inscrits :', block1, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${stats.totalEligible} membres`, block1, y + 11);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Présents & Pouvoirs :', block1, y + 16);
  doc.setFont('helvetica', 'bold');
  doc.text(`${stats.presentCount} prés. + ${stats.proxyCount} pouv.`, block1, y + 20);

  // Votes POUR
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(5, 150, 105);
  doc.text('Suffrages POUR :', block2, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`${stats.votesFor} (${stats.forPercentage}%)`, block2, y + 13);

  // Votes CONTRE
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(225, 29, 72);
  doc.text('Suffrages CONTRE :', block3, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`${stats.votesAgainst} (${stats.againstPercentage}%)`, block3, y + 13);

  // ABSTENTION
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Abstentions :', block4, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`${stats.votesAbstain} (${stats.abstainPercentage}%)`, block4, y + 13);

  // Big Final Outcome Stamp
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  if (isAdopted) {
    doc.setTextColor(5, 150, 105);
    doc.text('MOTION ADOPTÉE', blockResult, y + 12);
  } else if (isRejected) {
    doc.setTextColor(225, 29, 72);
    doc.text('MOTION REJETÉE', blockResult, y + 12);
  } else if (stats.outcome === 'quorum_not_reached') {
    doc.setTextColor(217, 119, 6);
    doc.text('QUORUM NON ATTEINT', blockResult, y + 12);
  } else {
    doc.setTextColor(100, 116, 139);
    doc.text('• EN COURS DE VOTE', blockResult, y + 12);
  }

  y += resultBoxHeight + 8;

  // Filter voters for this specific meeting
  const meetingAttendeeIds = session.selectedAttendeeIds && session.selectedAttendeeIds.length > 0
    ? session.selectedAttendeeIds
    : voters.map(v => v.id);

  const sessionVoters = voters.filter(v => meetingAttendeeIds.includes(v.id));

  // Table of Attendees / Votes Details using autoTable
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`FEUILLE D'ÉMARGEMENT & DÉTAIL DES VOTES (${sessionVoters.length} MEMBRES) :`, 14, y);
  y += 3;

  const tableData = sessionVoters.map((v, index) => {
    const st = session.voterStates[v.id] || { presence: 'present', vote: 'pending' };
    
    // Presence label
    let presenceLabel = 'Présent';
    if (st.presence === 'proxy') {
      const recipient = voters.find(rec => rec.id === st.proxyToId);
      presenceLabel = recipient ? `Pouvoir à ${recipient.name}` : 'Pouvoir (délégué)';
    } else if (st.presence === 'absent') {
      presenceLabel = 'Absent';
    } else if (st.presence === 'excused') {
      presenceLabel = 'Excusé';
    }

    // Held proxies count
    const heldProxies = sessionVoters.filter(av => {
      const vs = session.voterStates[av.id];
      return vs?.presence === 'proxy' && vs?.proxyToId === v.id;
    });

    let weightLabel = '1 voix';
    if (st.presence === 'present' && heldProxies.length > 0) {
      weightLabel = `${1 + heldProxies.length} voix (+${heldProxies.length} pouv.)`;
    } else if (st.presence === 'proxy') {
      weightLabel = '↳ Transmis';
    } else if (st.presence === 'absent' || st.presence === 'excused') {
      weightLabel = '0 voix';
    }

    // Vote choice label
    let voteLabel = 'En attente';
    if (session.isSecret && session.status !== 'closed') {
      voteLabel = st.vote !== 'pending' ? 'A voté (secret)' : 'En attente';
    } else {
      if (st.vote === 'for') voteLabel = 'POUR';
      else if (st.vote === 'against') voteLabel = 'CONTRE';
      else if (st.vote === 'abstain') voteLabel = 'ABSTENTION';
    }

    return [
      `N°${v.seatNumber || index + 1}`,
      `${v.title} ${v.name}`,
      v.specialty || v.department || 'Membre',
      presenceLabel,
      weightLabel,
      voteLabel
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Siège', 'Identité du Votant', 'Collège / Spécialité', 'Émargement & Mandat', 'Poids', 'Suffrage']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      font: 'helvetica',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [5, 150, 105],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 44, fontStyle: 'bold' },
      2: { cellWidth: 40 },
      3: { cellWidth: 34 },
      4: { cellWidth: 20, halign: 'center' },
      // Assez large pour « ABSTENTION » : le mot ne doit pas se couper en deux.
      5: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
    },
    didDrawPage: (data) => {
      // Footer on all pages
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `MediVote Pro • Séance ${session.referenceCode} • Registre de délibération certifié SQLite • Page ${data.pageNumber}`,
        14,
        pageHeight - 6
      );
      doc.text('Signature & Visa du Président de Séance :', pageWidth - 80, pageHeight - 6);
    },
  });

  // Save the generated PDF
  const filename = `Proces_Verbal_${session.referenceCode.replace(/[/\\?%*:|"<>]/g, '_')}_${session.scheduledDate}.pdf`;
  doc.save(filename);
}
