import { describe, it, expect } from 'vitest';
import { buildSessionPdfReport } from '../pdfExport';
import { archivedReport } from '../historySnapshot';
import { calculateVoteStatistics } from '../votingMath';
import { historyCsv } from '../csvExport';
import type { Voter, VotingSession, SessionHistoryItem } from '../../types';

const voters: Voter[] = ['A','B','C','D'].map((id,i)=>({id,name:`Membre ${id}`,title:'Mme',specialty:'Collège',department:'',weight:i===0?3:1,isActive:true,seatNumber:i+1,avatarColor:'#059669'}));
const session: VotingSession = {id:'s',seanceId:'seance',ordre:1,referenceCode:'AUDIT#1/R1',title:'Vote de contrôle',motionText:'Motion.',scheduledDate:'2026-09-10',scheduledTime:'14:30',location:'Salle',status:'closed',closedAt:'2026-09-10T13:00:00Z',majorityRequired:'simple',quorumPct:50,isSecret:false,outcome:'adopted',createdAt:'',selectedAttendeeIds:['A','B','C','D'],voterStates:Object.fromEntries(voters.map((v,i)=>[v.id,{voterId:v.id,presence:i===3?'absent':'present',vote:i<2?'for':i===2?'against':'pending'}]))};
const stats=calculateVoteStatistics(session,voters);
const item={id:'h',sessionId:'s',quorumPct:2,outcome:'adopted',closedAt:session.closedAt,detailedSnapshot:{session,voters,stats,voterStates:Object.values(session.voterStates)}} as SessionHistoryItem;

describe('documents archivés',()=>{
  it('prend le quorum et les suffrages du snapshot, même avec une ancienne colonne de quorum erronée',()=>{
    const report=archivedReport(item);expect(report.session.quorumPct).toBe(50);expect(report.stats?.votesFor).toBe(4);
    expect(report.session.voterStates.D.presence).toBe('absent');expect(report.voters).toHaveLength(4);
  });
  it('refuse un document officiel sans snapshot',()=>expect(()=>archivedReport({...item,detailedSnapshot:{} as any})).toThrow(/indisponible/));
  it('préserve une liste archivée vide',()=>expect(archivedReport({...item,detailedSnapshot:{...item.detailedSnapshot,session:{...session,selectedAttendeeIds:[]}}}).voters).toHaveLength(0));
  it('affiche le poids réel, le quorum, les absents et la date de clôture',()=>{
    const pdf=buildSessionPdfReport(session,voters,stats).output();
    expect(pdf).toContain('3 voix');expect(pdf).toContain('50 %');expect(pdf).toContain('Non votant');expect(pdf).toContain('10/09/2026');expect(pdf).not.toContain('SQLite');
  });
  it('conserve tous les paragraphes d’une motion longue et leur résultat après pagination',()=>{
    const motionText=Array.from({length:120},(_,i)=>`PARAGRAPHE_${i.toString().padStart(3,'0')} : `+'Texte long à conserver dans le document. '.repeat(5)).join('\n');
    const pdf=buildSessionPdfReport({...session,title:'Un titre très long '.repeat(25),motionText},voters,stats);
    expect(pdf.getNumberOfPages()).toBeGreaterThan(3);
    const text=pdf.output();for(let i=0;i<120;i++) expect(text).toContain(`PARAGRAPHE_${i.toString().padStart(3,'0')}`);
    expect(text).toContain('SYNTH');expect(text).toContain('Membre D');
  });
  it('annonce un document provisoire et masque les choix en cours de scrutin secret',()=>{
    const open={...session,status:'open' as const,isSecret:true};const text=buildSessionPdfReport(open,voters).output();
    expect(text).toContain('DOCUMENT PROVISOIRE');expect(text).toContain('A vot');expect(text).not.toContain('(POUR)');
  });
  it('conserve #, guillemets et retours à la ligne dans le CSV',()=>{
    const csv=historyCsv([{...item,referenceCode:'AUDIT#CSV/R1',title:'Titre "cité"\nsuite'}]);
    expect(csv).toContain('"AUDIT#CSV/R1"');expect(csv).toContain('"Titre ""cité""\nsuite"');expect(csv.charCodeAt(0)).toBe(0xfeff);
  });
});
