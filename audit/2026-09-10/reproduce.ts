/** Audit reproductible, sans accès à data/ et sans modification du code applicatif.
 * Depuis la racine : npx tsx audit/2026-09-10/reproduce.ts
 * Les ECHEC sont les anomalies recherchées, pas des erreurs du script.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { calculateVoteStatistics } from '../../src/utils/votingMath';
import type { VotingSession } from '../../src/types';

const output = path.resolve('audit/2026-09-10');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'medivote-audit-db-'));
process.env.MEDIVOTE_DATA_DIR = temporary;
const db = await import('../../server/db');
const results: { id: string; label: string; status: string; detail?: string }[] = [];
let counter = 0;
const ids = ['audit_a', 'audit_b', 'audit_c', 'audit_d', 'audit_e', 'audit_f'];
function create(extra: any = {}) {
  return db.createOrUpdateSession({ id: `audit_${++counter}`, title: 'Audit — Approbation du budget', referenceCode: `AUDIT-${counter}/R1`, motionText: 'Le conseil approuve le budget soumis au vote.', scheduledDate: '2026-09-10', scheduledTime: '14:30', location: 'Salle du conseil', attendeeIds: ids.slice(0, 4), majorityRequired: 'absolute', quorumPct: 50, ...extra });
}
function check(id: string, label: string, f: () => void) {
  try { f(); results.push({ id, label, status: 'OK' }); }
  catch (e: any) { results.push({ id, label, status: 'ECHEC', detail: e.message }); }
  console.log(`${results.at(-1)!.status} ${id} ${label}`);
}
function state(id: string) { return db.getSessionById(id)!; }
function open(extra: any = {}) { const s = create(extra); db.definirOuvertureScrutin(s.id, true); return state(s.id); }
function close() { const s = open(); db.updateVoterVote(s.id, ids[0], 'for'); db.archiveAndCloseSession(s.id); return state(s.id); }

try {
  await db.initDatabase();
  ids.forEach((id, i) => db.saveVoter({ id, name: `Membre fictif ${String.fromCharCode(65+i)}`, title: 'Mme', specialty: 'Collège audit', department: 'Audit', weight: 1, isActive: true, seatNumber: i+1 }));
  check('CALC-01', 'Majorités : 4 règles × 125 répartitions, y compris égalités et abstentions', () => {
    for (const majorityRequired of ['simple', 'absolute', 'two_thirds', 'unanimous'] as const) {
      for (let a=0; a<5; a++) for(let b=0;b<5;b++) for(let c=0;c<5;c++) {
        if (!a&&!b&&!c) continue;
        const voters = Array.from({length:a+b+c}, (_,i)=>({ id: `x${i}`, isActive:true, weight:1 } as any));
        const voterStates = Object.fromEntries(voters.map((v,i)=>[v.id,{voterId:v.id,presence:'present',vote:i<a?'for':i<a+b?'against':'abstain'}]));
        const s = {status:'open',majorityRequired,quorumPct:0,voterStates,selectedAttendeeIds:voters.map(v=>v.id)} as VotingSession;
        const expected = majorityRequired==='simple' ? a>b : majorityRequired==='absolute' ? 2*a>a+b+c : majorityRequired==='two_thirds' ? 3*a>=2*(a+b+c) : b+c===0;
        assert.equal(calculateVoteStatistics(s,voters).outcome,expected?'adopted':'rejected');
      }
    }
  });
  check('CALC-02','Quorum atteint exactement au seuil et refus en dessous',()=>{
    const s=create({quorumPct:75}); db.updateVoterPresence(s.id,ids[0],'absent');
    assert.equal(calculateVoteStatistics(state(s.id),db.getAllVoters()).quorumReached,true);
    db.updateVoterPresence(s.id,ids[1],'excused');
    assert.equal(calculateVoteStatistics(state(s.id),db.getAllVoters()).quorumReached,false);
  });
  check('CALC-03','Clôture : abstentions assimilées et détail nominatif concordants',()=>{
    const s=open(); db.updateVoterPresence(s.id,ids[3],'absent'); db.updateVoterVote(s.id,ids[0],'for');
    const {stats,history}=db.archiveAndCloseSession(s.id);
    assert.equal(stats.votesAbstain,2); assert.equal(stats.abstentionsAssimilees,2); assert.equal(stats.outcome,'rejected');
    assert.equal(history.detailedSnapshot.session.voterStates[ids[1]].vote,'abstain');
    assert.equal(history.detailedSnapshot.session.voterStates[ids[3]].vote,'pending');
  });
  check('CALC-04','Une convocation explicitement vide contient zéro inscrit',()=>{
    const s=create({attendeeIds:[]}); assert.equal(calculateVoteStatistics(s,db.getAllVoters()).totalEligible,0);
  });
  check('CALC-05','Sans ligne d’émargement, compteurs des présents et non-votants cohérents',()=>{
    const s=create(); s.voterStates={}; const stats=calculateVoteStatistics(s,db.getAllVoters());
    assert.equal(stats.notVotedCount,stats.presentCount);
  });
  check('POU-01','Deux pouvoirs maximum et auto-procuration refusée',()=>{
    const s=create(); db.updateVoterPresence(s.id,ids[1],'proxy',ids[0]); db.updateVoterPresence(s.id,ids[2],'proxy',ids[0]);
    assert.throws(()=>db.updateVoterPresence(s.id,ids[3],'proxy',ids[0])); assert.throws(()=>db.updateVoterPresence(s.id,ids[0],'proxy',ids[0]));
  });
  check('POU-02','Propagation du vote du mandataire, avec poids propres des mandants',()=>{
    db.saveVoter({...db.getAllVoters().find(v=>v.id===ids[1])!,weight:3});
    const s=open(); db.updateVoterPresence(s.id,ids[1],'proxy',ids[0]); db.updateVoterVote(s.id,ids[0],'for');
    assert.equal(calculateVoteStatistics(state(s.id),db.getAllVoters()).votesFor,4);
    db.saveVoter({...db.getAllVoters().find(v=>v.id===ids[1])!,weight:1});
  });
  check('POU-03','Pouvoir sans mandataire refusé',()=>{const s=create();assert.throws(()=>db.updateVoterPresence(s.id,ids[1],'proxy',null));});
  check('POU-04','Pouvoir vers un absent refusé',()=>{const s=create();db.updateVoterPresence(s.id,ids[0],'absent');assert.throws(()=>db.updateVoterPresence(s.id,ids[1],'proxy',ids[0]));});
  check('POU-05','Pouvoir vers un membre non convoqué refusé',()=>{const s=create();assert.throws(()=>db.updateVoterPresence(s.id,ids[1],'proxy',ids[5]));});
  check('POU-06','Cycle de pouvoirs refusé',()=>{const s=create();db.updateVoterPresence(s.id,ids[1],'proxy',ids[0]);assert.throws(()=>db.updateVoterPresence(s.id,ids[0],'proxy',ids[1]));});
  check('POU-07','Le départ du mandataire retire ses pouvoirs des représentés',()=>{
    const s=create();db.updateVoterPresence(s.id,ids[1],'proxy',ids[0]);db.updateVoterPresence(s.id,ids[0],'absent');
    assert.equal(calculateVoteStatistics(state(s.id),db.getAllVoters()).proxyCount,0);
  });
  check('POU-08','Pouvoir attribué après le vote : bulletin aligné sur celui du mandataire',()=>{
    const s=open();db.updateVoterVote(s.id,ids[0],'for');db.updateVoterPresence(s.id,ids[1],'proxy',ids[0]);
    assert.equal(state(s.id).voterStates[ids[1]].vote,'for');
  });
  check('PRES-01','Une valeur de présence inconnue est refusée',()=>{const s=create();assert.throws(()=>db.updateVoterPresence(s.id,ids[0],'invalide'));});
  check('PRES-02','Émargement partagé sans introduire de non-convoqué dans une autre résolution',()=>{
    const s=create();const r=db.ajouterResolution(s.seanceId,{title:'Collège réduit',attendeeIds:[ids[0]]});
    db.updateVoterPresence(s.id,ids[1],'absent');assert.equal(state(r.id).voterStates[ids[1]],undefined);
  });
  check('VOTE-01','Vote administratif d’un mandant refusé',()=>{const s=open();db.updateVoterPresence(s.id,ids[1],'proxy',ids[0]);assert.throws(()=>db.updateVoterVote(s.id,ids[1],'against'));});
  check('VOTE-02','Vote administratif d’un absent refusé',()=>{const s=open();db.updateVoterPresence(s.id,ids[1],'absent');assert.throws(()=>db.updateVoterVote(s.id,ids[1],'for'));});
  check('VOTE-03','Vote administratif d’un non-convoqué refusé',()=>{const s=open();assert.throws(()=>db.updateVoterVote(s.id,ids[5],'for'));});
  check('VOTE-04','Valeur de bulletin invalide refusée',()=>{const s=open();assert.throws(()=>db.updateVoterVote(s.id,ids[0],'invalide'));});
  check('CLOSE-01','Modification directe d’un scrutin clos refusée',()=>{const s=close();assert.throws(()=>db.createOrUpdateSession({...s,title:'Réécriture après clôture'}));});
  check('CLOSE-02','Modification d’émargement sur scrutin clos refusée',()=>{const s=close();assert.throws(()=>db.updateVoterPresence(s.id,ids[0],'absent'));});
  check('CLOSE-03','Remise à zéro d’un scrutin clos refusée',()=>{const s=close();assert.throws(()=>db.resetSessionVotes(s.id));});
  check('CLOSE-04','Suppression d’un scrutin clos refusée',()=>{const s=close();assert.throws(()=>db.deleteMeeting(s.id));});
  check('CLOSE-05','Le registre annoncé inaltérable refuse la suppression d’une archive',()=>{
    const s=close();const h=db.getHistory().find(h=>h.sessionId===s.id)!;assert.throws(()=>db.deleteHistoryItem(h.id));
  });
  check('CLOSE-06','Un scrutin jamais ouvert ne produit pas un résultat voté',()=>{
    const s=create();assert.throws(()=>db.archiveAndCloseSession(s.id));
  });
  check('ARCH-01','Le pourcentage de quorum reste identique après relecture de l’archive',()=>{
    const s=open({quorumPct:50});const {history}=db.archiveAndCloseSession(s.id);
    assert.equal(db.getHistory().find(h=>h.id===history.id)!.quorumPct,50);
  });
  check('ARCH-02','Les archives gardent leurs membres et résultats après édition du répertoire',()=>{
    const s=close();const before=JSON.stringify(db.getHistory().find(h=>h.sessionId===s.id)!.detailedSnapshot);
    db.saveVoter({...db.getAllVoters().find(v=>v.id===ids[0])!,name:'Nom modifié pour audit'});
    assert.equal(JSON.stringify(db.getHistory().find(h=>h.sessionId===s.id)!.detailedSnapshot),before);
  });
  check('PDF-01','Le raccourci PV de l’ordre du jour conserve le décompte archivé',()=>{
    const s=open({majorityRequired:'simple'}); db.updateVoterPresence(s.id,ids[3],'absent');
    db.updateVoterVote(s.id,ids[0],'for');db.updateVoterVote(s.id,ids[1],'for');db.updateVoterVote(s.id,ids[2],'against');
    const {history,stats}=db.archiveAndCloseSession(s.id);
    const r=db.getAllMeetings().find(r=>r.id===s.id)!;
    // Expression exacte du bouton AdminPanel : état vide au lieu du snapshot.
    const shortcut={...state(s.id),...r,voterStates:{}} as VotingSession;
    const shortcutStats=calculateVoteStatistics(shortcut,db.getAllVoters());
    const fixtureVoters=history.detailedSnapshot.voters.filter(v=>ids.includes(v.id));
    const fixtures=[
      {session:{...history.detailedSnapshot.session,referenceCode:'AUDIT-ARCHIVE'},voters:fixtureVoters,stats},
      {session:{...shortcut,referenceCode:'AUDIT-RACCOURCI'},voters:fixtureVoters},
    ];
    const long={...history.detailedSnapshot.session,referenceCode:'AUDIT-TEXTE-LONG',title:'Intitulé long de délibération '.repeat(15),motionText:'Paragraphe de contrôle de pagination : cette phrase doit rester entièrement lisible dans le procès-verbal. '.repeat(120)};
    fixtures.push({session:long,voters:fixtureVoters,stats});
    fs.writeFileSync(path.join(output,'pdf-fixtures.json'),JSON.stringify(fixtures,null,2)+'\n');
    assert.equal(shortcutStats.votesFor,stats.votesFor,`Archive : ${stats.votesFor} pour / ${stats.votesAgainst} contre / ${stats.votesAbstain} abstention ; raccourci : ${shortcutStats.votesFor} / ${shortcutStats.votesAgainst} / ${shortcutStats.votesAbstain}`);
  });
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify({passed:results.filter(r=>r.status==='OK').length,failed:results.filter(r=>r.status==='ECHEC').length}));
} finally { fs.rmSync(temporary,{recursive:true,force:true}); }
