/** Compléments d'audit, exclusivement sur l'instance temporaire 127.0.0.1:3187. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || '/home/ubuntu/.npm/_npx/f0a362733743bae2/node_modules/playwright/index.mjs');
const out=path.resolve('audit/2026-09-10/corrections');const base='http://127.0.0.1:3187';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:1000}});context.setDefaultTimeout(8000);
const page=await context.newPage();const results=[];let seq=0;
const ids=['http_a','http_b','http_c','http_d'];
async function api(route,data,method=data===undefined?'GET':'POST'){const r=await context.request.fetch(base+route,{method,data});const body=await r.json();assert.equal(r.status(),200,`${route}: ${body.error || r.status()}`);return body;}
async function check(id,label,f){if(process.env.AUDIT_ONLY && process.env.AUDIT_ONLY!==id)return;try{const detail=await f();results.push({id,label,status:'OK',detail});}catch(e){results.push({id,label,status:'ECHEC',detail:e.message});}console.log(results.at(-1));}
async function create(extra={}){return (await api('/api/meetings/create',{id:'secondary_'+Date.now()+'_'+ ++seq,title:'Contrôle complémentaire',referenceCode:'COMPLEMENT/R1',motionText:'Motion de vérification.',scheduledDate:'2026-09-10',scheduledTime:'14:30',attendeeIds:ids,majorityRequired:'simple',quorumPct:50,...extra})).session;}
try{
  await api('/api/auth/admin',{pin:'739162'});
  await check('OPT-01','Duplication : nouvelle séance, aucun bulletin, scrutin fermé',async()=>{
    const s=await create();await api('/api/session/ouverture',{sessionId:s.id,ouvert:true});await api('/api/session/vote',{sessionId:s.id,voterId:ids[0],vote:'for'});
    const r=await api(`/api/meetings/${s.id}/duplicate`,{});assert.notEqual(r.session.id,s.id);assert.notEqual(r.session.seanceId,s.seanceId);assert.equal(r.session.status,'draft');assert(Object.values(r.session.voterStates).every(s=>s.vote==='pending'));
  });
  await check('OPT-02','Clôture de séance : scrutin ouvert refusé, puis scellement et point sans suite',async()=>{
    const s=await create();const r2=(await api(`/api/seances/${s.seanceId}/resolutions`,{title:'Non soumis'})).resolution;
    await api('/api/resolutions/switch',{resolutionId:s.id});await api('/api/session/ouverture',{sessionId:s.id,ouvert:true});await api('/api/session/vote',{sessionId:s.id,voterId:ids[0],vote:'for'});
    const premature=await context.request.post(base+'/api/seances/close',{data:{seanceId:s.seanceId}});assert.equal(premature.status(),409);
    await api('/api/session/close',{sessionId:s.id});
    const r=await api('/api/seances/close',{seanceId:s.seanceId});assert(r.seanceClose.closedAt);assert(r.history.some(h=>h.sessionId===s.id));assert.equal(r.seanceClose.resolutions.find(r=>r.id===r2.id).outcome,'pending');
  });
  await check('OPT-03','Suppression d’un collège sans supprimer ses membres',async()=>{
    const l=(await api('/api/lists/save',{name:'À supprimer',code:'SUP',voterIds:ids})).list;
    await api('/api/lists/'+l.id,undefined,'DELETE');assert.equal((await api('/api/voters')).voters.length,4);
  });
  await check('OPT-04','Kiosque : le bouton de changement de membre ouvre le sélecteur',async()=>{
    await create();await page.goto(base);await page.locator('#nav-tab-kiosk').click();
    const btn=page.getByRole('button',{name:/Changer de votant|Changer de membre|Changer/i}).first();
    await btn.click();await page.getByText("Sélectionnez votre mode d'accès pour la séance en cours",{exact:true}).waitFor();
    await page.getByRole('button',{name:'Mode Votant (Individuel)'}).click();
    await page.getByRole('button',{name:/Mme Membre fictif B/}).click();
    await page.getByText('Votre Siège N°2',{exact:true}).waitFor();
  });
  await check('OPT-05','Scrutin secret : bulletin masqué dans l’API et la notification pendant le vote',async()=>{
    const s=await create({isSecret:true});await api('/api/session/ouverture',{sessionId:s.id,ouvert:true});
    const r=await api('/api/session/vote',{sessionId:s.id,voterId:ids[0],vote:'for'});assert.equal(r.session.voterStates[ids[0]].vote,'secret');
    const event=(await api('/api/notifications')).notifications.find(n=>n.sessionId===s.id&&n.type==='vote_cast');assert(!event.voterName);assert(!event.voteChoice);
    const close=await api('/api/session/close',{sessionId:s.id});assert.equal(close.stats.votesFor,1);
    return 'Masqué pendant le scrutin ; le bulletin nominatif devient lisible dans l’archive après clôture (comportement actuel).';
  });
  await check('OPT-06','Un QR déjà remis ne permet plus de voter après désactivation du membre',async()=>{
    const s=await create();const l=(await api('/api/liens-vote?sessionId='+s.id)).liens.find(l=>l.voterId===ids[0]);
    const v=(await api('/api/voters')).voters.find(v=>v.id===ids[0]);await api('/api/voters/save',{...v,isActive:false});await api('/api/session/ouverture',{sessionId:s.id,ouvert:true});
    const token=new URL(l.url).pathname.split('/').pop();const r=await context.request.post(base+'/api/scrutin/'+token+'/bulletin',{data:{vote:'for'}});
    await api('/api/voters/save',{...v,isActive:true});assert(r.status()>=400,`Bulletin accepté : HTTP ${r.status()}`);
  });
  await check('OPT-07','CSV : une référence contenant # conserve le fichier entier',async()=>{
    const s=await create({referenceCode:'AUDIT#CSV/R1',title:'Contrôle CSV'});await api('/api/session/ouverture',{sessionId:s.id,ouvert:true});await api('/api/session/close',{sessionId:s.id});
    await page.reload();await page.locator('#nav-tab-history').click();
    const [d]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Export CSV'}).click()]);
    const file=path.join(out,'export.csv');await d.saveAs(file);const csv=fs.readFileSync(file,'utf8');assert(csv.includes('AUDIT#CSV/R1'),`CSV tronqué : ${csv.slice(-130)}`);
  });
  await check('OPT-08','Impression : génération de la vue imprimable de l’archive',async()=>{
    await page.getByRole('button',{name:'Voir PV',exact:true}).first().click();await page.getByRole('button',{name:'Imprimer',exact:true}).waitFor();
    await page.pdf({path:path.join(out,'impression-navigateur.pdf'),format:'A4',printBackground:true});
    return 'PDF du moteur d’impression généré ; pas de test d’imprimante physique.';
  });
  await check('OPT-09','PDF avec votes pondérés, absents et quorum non atteint',async()=>{
    const f=JSON.parse(fs.readFileSync(path.join(out,'pdf-fixtures.json'),'utf8'))[0];
    f.session.referenceCode='AUDIT-POIDS';f.session.quorumPct=100;f.session.outcome='quorum_not_reached';delete f.stats;
    f.voters.find(v=>v.id==='audit_a').weight=3;
    const [d]=await Promise.all([page.waitForEvent('download'),page.evaluate(async f=>{const pdf=await import('/src/utils/pdfExport.ts');pdf.generateSessionPdfReport(f.session,f.voters);},f)]);await d.saveAs(path.join(out,'pdf-poids.pdf'));
  });
  await check('OPT-10','Pagination de la feuille d’émargement pour 80 membres',async()=>{
    const f=JSON.parse(fs.readFileSync(path.join(out,'pdf-fixtures.json'),'utf8'))[0];
    f.session.referenceCode='AUDIT-80-MEMBRES';delete f.stats;
    f.voters=Array.from({length:80},(_,i)=>({...f.voters[0],id:'large_'+i,name:'Membre fictif numéro '+i,seatNumber:i+1,weight:1}));
    f.session.selectedAttendeeIds=f.voters.map(v=>v.id);f.session.voterStates=Object.fromEntries(f.voters.map(v=>[v.id,{voterId:v.id,presence:'present',vote:'for'}]));
    const [d]=await Promise.all([page.waitForEvent('download'),page.evaluate(async f=>{const pdf=await import('/src/utils/pdfExport.ts');pdf.generateSessionPdfReport(f.session,f.voters);},f)]);await d.saveAs(path.join(out,'pdf-80-membres.pdf'));
  });

  await check('OPT-11','Notifications : ouverture, filtres et interrupteur sonore',async()=>{
    await page.goto(base);await page.getByTitle('Notifications en direct du scrutin').click();
    const sound=page.getByTitle(/les signaux sonores/);const before=await sound.getAttribute('title');await sound.click();assert.notEqual(await sound.getAttribute('title'),before);
    await page.getByRole('button',{name:'Suffrages',exact:true}).click();await page.getByRole('button',{name:'Séances',exact:true}).click();
    return 'Interrupteur et filtres testés ; restitution sonore physique non évaluée.';
  });
}finally{
  const previous=process.env.AUDIT_ONLY?JSON.parse(fs.readFileSync(path.join(out,'secondary-results.json'),'utf8')):[];
  const merged=[...previous.filter(r=>!results.some(n=>n.id===r.id)),...results];
  fs.writeFileSync(path.join(out,'secondary-results.json'),JSON.stringify(merged,null,2)+'\n');await browser.close();
}
