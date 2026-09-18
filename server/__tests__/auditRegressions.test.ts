import { it, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { calculateVoteStatistics } from '../../src/utils/votingMath';
import type { VotingSession } from '../../src/types';
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'medivote-regressions-'));
process.env.MEDIVOTE_DATA_DIR = temporary;
const db = await import('../db');
let counter = 0;
const ids = ['audit_a', 'audit_b', 'audit_c', 'audit_d', 'audit_e', 'audit_f'];
function create(extra: any = {}) {
  return db.createOrUpdateSession({ id: `audit_${++counter}`, title: 'Audit — Approbation du budget', referenceCode: `AUDIT-${counter}/R1`, motionText: 'Le conseil approuve le budget soumis au vote.', scheduledDate: '2026-09-10', scheduledTime: '14:30', location: 'Salle du conseil', attendeeIds: ids.slice(0, 4), majorityRequired: 'absolute', quorumPct: 50, ...extra });
}
function state(id: string) { return db.getSessionById(id)!; }
function open(extra: any = {}) { const s = create(extra); db.definirOuvertureScrutin(s.id, true); return state(s.id); }
function close() { const s = open(); db.updateVoterVote(s.id, ids[0], 'for'); db.archiveAndCloseSession(s.id); return state(s.id); }

beforeAll(async()=>{ await db.initDatabase(); ids.forEach((id,i)=>db.saveVoter({id,name:'Membre fictif '+i,title:'Mme',weight:1,isActive:true,seatNumber:i+1})); });
afterAll(()=>fs.rmSync(temporary,{recursive:true,force:true}));
  it('CALC-01 — Majorités : 4 règles × 125 répartitions, y compris égalités et abstentions', () => {
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
  it('CALC-02 — Quorum atteint exactement au seuil et refus en dessous',()=>{
    const s=create({quorumPct:75}); db.updateVoterPresence(s.id,ids[0],'absent');
    assert.equal(calculateVoteStatistics(state(s.id),db.getAllVoters()).quorumReached,true);
    db.updateVoterPresence(s.id,ids[1],'excused');
    assert.equal(calculateVoteStatistics(state(s.id),db.getAllVoters()).quorumReached,false);
  });
  it('CALC-03 — Clôture : abstentions assimilées et détail nominatif concordants',()=>{
    const s=open(); db.updateVoterPresence(s.id,ids[3],'absent'); db.updateVoterVote(s.id,ids[0],'for');
    const {stats,history}=db.archiveAndCloseSession(s.id);
    assert.equal(stats.votesAbstain,2); assert.equal(stats.abstentionsAssimilees,2); assert.equal(stats.outcome,'rejected');
    assert.equal(history.detailedSnapshot.session.voterStates[ids[1]].vote,'abstain');
    assert.equal(history.detailedSnapshot.session.voterStates[ids[3]].vote,'pending');
  });
  it('CALC-04 — Une convocation explicitement vide contient zéro inscrit',()=>{
    const s=create({attendeeIds:[]}); assert.equal(calculateVoteStatistics(s,db.getAllVoters()).totalEligible,0);
  });
  it('CALC-05 — Sans ligne d’émargement, compteurs des présents et non-votants cohérents',()=>{
    const s=create(); s.voterStates={}; const stats=calculateVoteStatistics(s,db.getAllVoters());
    assert.equal(stats.notVotedCount,stats.presentCount);
  });
  it('POU-01 — Deux pouvoirs maximum et auto-procuration refusée',()=>{
    const s=create(); db.updateVoterPresence(s.id,ids[1],'proxy',ids[0]); db.updateVoterPresence(s.id,ids[2],'proxy',ids[0]);
    assert.throws(()=>db.updateVoterPresence(s.id,ids[3],'proxy',ids[0])); assert.throws(()=>db.updateVoterPresence(s.id,ids[0],'proxy',ids[0]));
  });
  it('POU-02 — Propagation du vote du mandataire, avec poids propres des mandants',()=>{
    db.saveVoter({...db.getAllVoters().find(v=>v.id===ids[1])!,weight:3});
    const s=open(); db.updateVoterPresence(s.id,ids[1],'proxy',ids[0]); db.updateVoterVote(s.id,ids[0],'for');
    assert.equal(calculateVoteStatistics(state(s.id),db.getAllVoters()).votesFor,4);
    db.saveVoter({...db.getAllVoters().find(v=>v.id===ids[1])!,weight:1});
  });
  it('POU-03 — Pouvoir sans mandataire refusé',()=>{const s=create();assert.throws(()=>db.updateVoterPresence(s.id,ids[1],'proxy',null));});
  it('POU-04 — Pouvoir vers un absent refusé',()=>{const s=create();db.updateVoterPresence(s.id,ids[0],'absent');assert.throws(()=>db.updateVoterPresence(s.id,ids[1],'proxy',ids[0]));});
  it('POU-05 — Pouvoir vers un membre non convoqué refusé',()=>{const s=create();assert.throws(()=>db.updateVoterPresence(s.id,ids[1],'proxy',ids[5]));});
  it('POU-06 — Cycle de pouvoirs refusé',()=>{const s=create();db.updateVoterPresence(s.id,ids[1],'proxy',ids[0]);assert.throws(()=>db.updateVoterPresence(s.id,ids[0],'proxy',ids[1]));});
  it('POU-07 — Le départ du mandataire retire ses pouvoirs des représentés',()=>{
    const s=create();db.updateVoterPresence(s.id,ids[1],'proxy',ids[0]);db.updateVoterPresence(s.id,ids[0],'absent');
    assert.equal(calculateVoteStatistics(state(s.id),db.getAllVoters()).proxyCount,0);
  });
  it('POU-08 — Pouvoir attribué après le vote : bulletin aligné sur celui du mandataire',()=>{
    const s=open();db.updateVoterVote(s.id,ids[0],'for');db.updateVoterPresence(s.id,ids[1],'proxy',ids[0]);
    assert.equal(state(s.id).voterStates[ids[1]].vote,'for');
  });
  it('PRES-01 — Une valeur de présence inconnue est refusée',()=>{const s=create();assert.throws(()=>db.updateVoterPresence(s.id,ids[0],'invalide'));});
  it('PRES-02 — Émargement partagé sans introduire de non-convoqué dans une autre résolution',()=>{
    const s=create();const r=db.ajouterResolution(s.seanceId,{title:'Collège réduit',attendeeIds:[ids[0]]});
    db.updateVoterPresence(s.id,ids[1],'absent');assert.equal(state(r.id).voterStates[ids[1]],undefined);
  });
  it('VOTE-01 — Vote administratif d’un mandant refusé',()=>{const s=open();db.updateVoterPresence(s.id,ids[1],'proxy',ids[0]);assert.throws(()=>db.updateVoterVote(s.id,ids[1],'against'));});
  it('VOTE-02 — Vote administratif d’un absent refusé',()=>{const s=open();db.updateVoterPresence(s.id,ids[1],'absent');assert.throws(()=>db.updateVoterVote(s.id,ids[1],'for'));});
  it('VOTE-03 — Vote administratif d’un non-convoqué refusé',()=>{const s=open();assert.throws(()=>db.updateVoterVote(s.id,ids[5],'for'));});
  it('VOTE-04 — Valeur de bulletin invalide refusée',()=>{const s=open();assert.throws(()=>db.updateVoterVote(s.id,ids[0],'invalide'));});
  it('CLOSE-01 — Modification directe d’un scrutin clos refusée',()=>{const s=close();assert.throws(()=>db.createOrUpdateSession({...s,title:'Réécriture après clôture'}));});
  it('CLOSE-02 — Modification d’émargement sur scrutin clos refusée',()=>{const s=close();assert.throws(()=>db.updateVoterPresence(s.id,ids[0],'absent'));});
  it('CLOSE-03 — Remise à zéro d’un scrutin clos refusée',()=>{const s=close();assert.throws(()=>db.resetSessionVotes(s.id));});
  it('CLOSE-04 — Suppression d’un scrutin clos refusée',()=>{const s=close();assert.throws(()=>db.deleteMeeting(s.id));});
  it('CLOSE-05 — Le registre annoncé inaltérable refuse la suppression d’une archive',()=>{
    const s=close();const h=db.getHistory().find(h=>h.sessionId===s.id)!;assert.throws(()=>db.deleteHistoryItem(h.id));
  });
  it('CLOSE-06 — Un scrutin jamais ouvert ne produit pas un résultat voté',()=>{
    const s=create();assert.throws(()=>db.archiveAndCloseSession(s.id));
  });
  it('ARCH-01 — Le pourcentage de quorum reste identique après relecture de l’archive',()=>{
    const s=open({quorumPct:50});const {history}=db.archiveAndCloseSession(s.id);
    assert.equal(db.getHistory().find(h=>h.id===history.id)!.quorumPct,50);
  });
  it('ARCH-02 — Les archives gardent leurs membres et résultats après édition du répertoire',()=>{
    const s=close();const before=JSON.stringify(db.getHistory().find(h=>h.sessionId===s.id)!.detailedSnapshot);
    db.saveVoter({...db.getAllVoters().find(v=>v.id===ids[0])!,name:'Nom modifié pour audit'});
    assert.equal(JSON.stringify(db.getHistory().find(h=>h.sessionId===s.id)!.detailedSnapshot),before);
  });

it('préserve les convocations vides lors des changements de table et de séance',()=>{
  const s=create({attendeeIds:[]});db.basculerSeance(s.seanceId);db.switchActiveMeeting(s.id);
  assert.equal(Object.keys(state(s.id).voterStates).length,0);
});
it('la modification des coordonnées de séance nettoie les pouvoirs vers les membres retirés',()=>{
  const s=create();db.updateVoterPresence(s.id,ids[1],'proxy',ids[0]);
  db.creerOuMajSeance({...db.getSeanceById(s.seanceId)!,attendeeIds:ids.slice(1,4)});
  assert.equal(state(s.id).voterStates[ids[1]].presence,'absent');
  assert.equal(state(s.id).voterStates[ids[0]],undefined);
});
it('un scrutin suspendu peut être clôturé mais ne peut pas être classé sans suite',()=>{
  const s=open();db.definirOuvertureScrutin(s.id,false);assert.throws(()=>db.cloturerSeance(s.seanceId));
  assert.doesNotThrow(()=>db.archiveAndCloseSession(s.id));
});
it('les poids invalides et les règles hors limites sont refusés',()=>{
  for(const weight of [0,-1,.5,NaN,Infinity]) assert.throws(()=>db.saveVoter({id:ids[0],name:'Audit',weight}));
  assert.throws(()=>create({quorumPct:101}));assert.throws(()=>create({majorityRequired:'autre'}));
});
it('un membre désactivé ne peut plus déposer de bulletin avec un lien remis auparavant',()=>{
  const s=open();const token=db.jetonVotePour(s.seanceId,ids[0]);const voter=db.getAllVoters().find(v=>v.id===ids[0])!;
  db.saveVoter({...voter,isActive:false});assert.throws(()=>db.voterAvecJeton(token.jeton,'for'));db.saveVoter({...voter,isActive:true});
});
it('supprimer un membre ne modifie ni les données du scrutin clos ni son archive',()=>{
  const s=close();const frozen=JSON.stringify(state(s.id));db.deleteVoter(ids[3]);assert.equal(JSON.stringify(state(s.id)),frozen);
  db.saveVoter({id:ids[3],name:'Membre fictif D',weight:1,isActive:true});
});
it('une séance contenant un scrutin clos ne peut pas être supprimée',()=>{
  const s=close();assert.throws(()=>db.supprimerSeance(s.seanceId));assert(state(s.id));
});
it('éditer un autre point restitue sa propre convocation',()=>{
  const s=create({attendeeIds:[ids[0],ids[1]]});db.ajouterResolution(s.seanceId,{attendeeIds:[ids[2]],title:'Autre vote'});
  assert.deepEqual(db.getAllMeetings().find(r=>r.id===s.id)!.selectedAttendeeIds,[ids[0],ids[1]]);
});

it('répare les anciens pourcentages de quorum sans toucher aux bulletins archivés',async()=>{
  const s=close();const history=db.getHistory().find(h=>h.sessionId===s.id)!;
  const connection=await db.initDatabase();
  const snapshot=JSON.stringify(history.detailedSnapshot);
  connection.run('UPDATE sessions_history SET quorum_pct=2 WHERE id=?',[history.id]);
  assert.equal(db.reparerQuorumsArchives(),1);assert.equal(db.reparerQuorumsArchives(),0);
  const read=db.getHistory().find(h=>h.id===history.id)!;
  assert.equal(read.quorumPct,50);assert.equal(JSON.stringify(read.detailedSnapshot),snapshot);
});

it('le contexte mobile restitue les poids personnels du mandataire et de ses mandants',()=>{
  const original=db.getAllVoters().find(v=>v.id===ids[0])!;
  try {
    db.saveVoter({...original,weight:3});
    const s=open();db.updateVoterPresence(s.id,ids[1],'proxy',ids[0]);
    const token=db.jetonVotePour(s.seanceId,ids[0]);const context=db.contexteVotant(token.jeton)!;
    assert.equal(context.votant.weight,3);assert.deepEqual(context.pouvoirs.map(p=>p.weight),[1]);
    db.voterAvecJeton(token.jeton,'for');
    assert.equal(calculateVoteStatistics(state(s.id),db.getAllVoters()).votesFor,4);
  } finally {db.saveVoter(original);}
});
