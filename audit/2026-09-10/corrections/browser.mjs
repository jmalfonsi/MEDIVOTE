/** Exécuter seulement contre l'instance temporaire d'audit sur 127.0.0.1:3187.
 * PLAYWRIGHT_MODULE=/chemin/playwright/index.mjs node audit/2026-09-10/browser.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || '/home/ubuntu/.npm/_npx/f0a362733743bae2/node_modules/playwright/index.mjs');
const out=path.resolve('audit/2026-09-10/corrections');
const base='http://127.0.0.1:3187';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
page.setDefaultTimeout(7000);
context.setDefaultTimeout(10000);
const results=[];
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('dialog',d=>d.accept());
async function check(id,label,f){try{const detail=await f();results.push({id,label,status:'OK',detail});}catch(e){results.push({id,label,status:'ECHEC',detail:e.message});} console.log(results.at(-1));}
async function raw(route,data,method=data===undefined?'GET':'POST') { const r=await context.request.fetch(base+route,{method,data});return {status:r.status(),body:await r.json()}; }
async function api(route,data,method) {const r=await raw(route,data,method);assert.equal(r.status,200,`${route}: ${r.status} ${r.body.error || ''}`);return r.body;}
const members=['http_a','http_b','http_c','http_d'];
let session;
try {

  await check('HTTP-01','API de pilotage refusée sans authentification',async()=>assert.equal((await raw('/api/voters')).status,401));
  await check('UI-01','Connexion administrateur par le clavier visuel',async()=>{
    await page.goto(base);await page.getByText('Accès administrateur',{exact:true}).waitFor();
    for(const n of '739162')await page.getByRole('button',{name:n,exact:true}).click();
    await page.locator('#nav-tab-admin').waitFor();
  });
  // Nettoyage EXCLUSIF des exemples de l'instance temporaire, pour des captures fictives.
  for(const s of (await api('/api/seances')).seances)await api('/api/seances/'+s.id,undefined,'DELETE');
  for(const v of (await api('/api/voters')).voters)await api('/api/voters/'+v.id,undefined,'DELETE');
  await check('HTTP-02','Création et édition des membres',async()=>{
    for(const [i,id] of members.entries())await api('/api/voters/save',{id,name:`Membre fictif ${'ABCD'[i]}`,title:'Mme',specialty:'Collège audit',weight:1,isActive:true,seatNumber:i+1});
    const v=await api('/api/voters/save',{id:members[0],name:'Alice AUDIT',title:'Mme',weight:1,isActive:true,seatNumber:1});assert.equal(v.voter.name,'Alice AUDIT');
  });
  let listId;
  await check('HTTP-03','Création, édition et application d’un collège',async()=>{
    let l=await api('/api/lists/save',{name:'Collège fictif',code:'AUDIT',voterIds:members});listId=l.list.id;
    l=await api('/api/lists/save',{...l.list,name:'Collège de vérification'});assert.equal(l.list.name,'Collège de vérification');
    session=(await api('/api/meetings/create',{id:'http_r1',referenceCode:'AUDIT-HTTP/R1',title:'Budget de contrôle',motionText:'Le conseil approuve le budget.',scheduledDate:'2026-09-10',scheduledTime:'14:30',location:'Salle du conseil',majorityRequired:'absolute',quorumPct:50,attendeeIds:members})).session;
    const a=await api('/api/lists/apply',{sessionId:session.id,listId});assert.deepEqual(a.session.selectedAttendeeIds,members);
  });
  await check('HTTP-04','Ajout, réorganisation et navigation entre résolutions',async()=>{
    const {resolution:r2}=await api(`/api/seances/${session.seanceId}/resolutions`,{title:'Point suivant',motionText:'Texte suivant'});
    let s=await api('/api/resolutions/reorder',{seanceId:session.seanceId,ordreIds:[r2.id,session.id]});assert.equal(s.seance.resolutions[0].id,r2.id);
    s=await api('/api/resolutions/switch',{resolutionId:session.id});assert.equal(s.session.id,session.id);assert.equal(s.session.status,'draft');
  });
  await check('HTTP-05','Création, lecture et suppression d’un modèle',async()=>{
    const {template}=await api('/api/templates/save',{name:'Modèle audit',title:'Texte modèle',motionText:'Motion modèle',majorityRequired:'two_thirds',quorumPct:66});
    assert((await api('/api/templates')).templates.some(t=>t.id===template.id));
    assert(!(await api('/api/templates/'+template.id,undefined,'DELETE')).templates.some(t=>t.id===template.id));
  });
  await check('HTTP-06','Import de deux membres fictifs puis suppression',async()=>{
    const r=await api('/api/voters/import',{text:'"Exemple Un" <un@example.invalid>; "Exemple Deux" <deux@example.invalid>'});assert.equal(r.count,2);
    const voters=(await api('/api/voters')).voters.filter(v=>!members.includes(v.id));assert.equal(voters.length,2);
    for(const v of voters)await api('/api/voters/'+v.id,undefined,'DELETE');
  });
  await check('HTTP-07','Vote refusé avant ouverture, accepté après ouverture, refusé pendant suspension',async()=>{
    const payload={sessionId:session.id,voterId:members[0],vote:'for'};
    assert.equal((await raw('/api/session/vote',payload)).status,409);
    await api('/api/session/ouverture',{sessionId:session.id,ouvert:true});await api('/api/session/vote',payload);
    await api('/api/session/ouverture',{sessionId:session.id,ouvert:false});assert.equal((await raw('/api/session/vote',payload)).status,409);
    await api('/api/session/reset',{sessionId:session.id});
  });
  let mobileUrl;
  await check('HTTP-08','Liens et QR codes générés pour les quatre membres',async()=>{
    const r=await api('/api/liens-vote?sessionId='+session.id);assert.equal(r.liens.length,4);assert(r.liens.every(l=>l.qr.startsWith('data:image/svg+xml')));mobileUrl=r.liens.find(l=>l.voterId===members[0]).url;
  });
  await check('UI-02','Les quatre vues principales s’affichent',async()=>{
    await page.reload();await page.locator('#nav-tab-admin').waitFor();
    for(const id of ['admin','table','kiosk','history']){await page.locator('#nav-tab-'+id).click();assert(await page.locator('main').first().innerText());}
  });
  await check('UI-03','Les quatre onglets administratifs s’affichent',async()=>{
    await page.locator('#nav-tab-admin').click();
    for(const name of ['Émargement','Membres','Procès-verbaux','Séances et votes']){await page.getByRole('button',{name:new RegExp('^'+name)}).click();}
  });
  await check('UI-04','Vue simplifiée conservée après rechargement',async()=>{
    await page.getByRole('button',{name:'Vue simplifiée',exact:true}).click();assert.equal(await page.locator('html').getAttribute('data-affichage'),'simplifie');
    await page.reload();await page.locator('#nav-tab-admin').waitFor();assert.equal(await page.locator('html').getAttribute('data-affichage'),'simplifie');await page.getByRole('button',{name:'Vue complète',exact:true}).click();
  });
  await check('UI-05','Plein écran et navigation par flèches',async()=>{
    await page.locator('#nav-tab-table').click();await page.getByTitle('Afficher la table en plein écran').first().click();
    await page.getByTitle('Quitter le plein écran').first().waitFor();await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);assert.notEqual((await api('/api/session/active')).session.id,session.id);
    await page.keyboard.press('ArrowRight');await page.waitForTimeout(300);assert.equal((await api('/api/session/active')).session.id,session.id);
    await page.getByTitle('Quitter le plein écran').first().click();
  });
  await api('/api/session/ouverture',{sessionId:session.id,ouvert:true});
  await check('UI-06','Vote mobile et confirmation sur écran étroit',async()=>{
    const mobile=await context.newPage({viewport:{width:390,height:844}});await mobile.setViewportSize({width:390,height:844});
    await mobile.goto(mobileUrl);console.log('MOBILE BUTTONS',await mobile.getByRole('button').allTextContents());
    await mobile.getByRole('button',{name:/^POUR/}).click();console.log('CONFIRM BUTTONS',await mobile.getByRole('button').allTextContents());
    await mobile.getByRole('button',{name:/Confirmer/}).click();await mobile.getByText(/enregistré/i).first().waitFor();
    await mobile.screenshot({path:path.join(out,'mobile-vote.png'),fullPage:true});await mobile.close();
    assert.equal((await api('/api/session/active')).session.voterStates[members[0]].vote,'for');
  });
  await check('HTTP-09','Le lien mobile refuse un second bulletin',async()=>{
    const token=new URL(mobileUrl).pathname.split('/').pop();assert.equal((await raw(`/api/scrutin/${token}/bulletin`,{vote:'against'})).status,409);
  });
  await check('UI-07','Aperçu de clôture cohérent avec les abstentions finales',async()=>{
    await page.reload();await page.locator('#nav-tab-table').click();
    console.log('TABLE BUTTONS',await page.getByRole('button').allTextContents());
    await page.getByRole('button',{name:/Clôturer/}).first().click();
    await page.getByText('Validation définitive du procès-verbal de vote',{exact:true}).waitFor();
    await page.screenshot({path:path.join(out,'apercu-cloture.png'),fullPage:true});
    const text=await page.locator('body').innerText();assert(!text.includes('QUORUM NON ATTEINT'),'Le quorum est atteint (4/4), mais l’aperçu annonce QUORUM NON ATTEINT');
  });
  await check('HTTP-10','Clôture recalculée par le serveur malgré des statistiques client falsifiées',async()=>{
    const r=await api('/api/session/close',{sessionId:session.id,stats:{votesFor:999,outcome:'adopted'}});assert.equal(r.stats.votesFor,1);assert.equal(r.stats.votesAbstain,3);assert.equal(r.stats.outcome,'rejected');
  });
  await page.reload();await page.locator('#nav-tab-admin').waitFor();
  await check('UI-08','Téléchargement PDF du raccourci de l’ordre du jour',async()=>{
    await page.locator('#nav-tab-admin').click();console.log('PDF TITLES',await page.locator('button[title]').evaluateAll(a=>a.map(b=>b.title)));
    const button=page.getByTitle('Télécharger le PV de ce vote');const [d]=await Promise.all([page.waitForEvent('download'),button.click()]);await d.saveAs(path.join(out,'ui-raccourci.pdf'));
  });
  await check('UI-09','Archives : recherche, aperçu et téléchargement PDF',async()=>{
    await page.locator('#nav-tab-history').click();
    const search=page.locator('input').first();await search.fill('introuvable_audit');assert.equal(await page.getByRole('button',{name:'Rapport PDF'}).count(),0);await search.fill('Budget de contrôle');
    const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Rapport PDF'}).first().click()]);await download.saveAs(path.join(out,'ui-archive.pdf'));
    await page.getByRole('button',{name:'Voir PV',exact:true}).first().click();await page.screenshot({path:path.join(out,'apercu-archive.png'),fullPage:true});
  });
  await check('UI-10','Génération des PDF témoins avec le générateur de production',async()=>{
    const fixtures=JSON.parse(fs.readFileSync(path.join(out,'pdf-fixtures.json'),'utf8'));
    for(const fixture of fixtures){const [d]=await Promise.all([page.waitForEvent('download'),page.evaluate(async fixture=>{const pdf=await import('/src/utils/pdfExport.ts');await pdf.prechargerLogo();pdf.generateSessionPdfReport(fixture.session,fixture.voters,fixture.stats);},fixture)]);await d.saveAs(path.join(out,d.suggestedFilename()));}
  });
  await check('HTTP-11','Notification de vote et suppression du journal',async()=>{
    assert((await api('/api/notifications')).notifications.some(n=>n.type==='vote_ended'));await api('/api/notifications/clear',{});assert.equal((await api('/api/notifications')).notifications.length,0);
  });
  await check('HTTP-12','Un scrutin clos ne peut pas être réinitialisé par HTTP',async()=>{
    const r=await raw('/api/session/reset',{sessionId:session.id});assert(r.status>=400,`HTTP ${r.status}, statut obtenu ${r.body.session?.status}`);
  });
  await check('HTTP-13','Une archive scellée ne peut pas être supprimée par HTTP',async()=>{
    const h=(await api('/api/history')).history.find(h=>h.sessionId===session.id);const r=await raw('/api/history/'+h.id,undefined,'DELETE');assert(r.status>=400,`HTTP ${r.status}, archive supprimée`);
  });
  await check('HTTP-14','Le partage d’IP de plusieurs téléphones ne bloque pas le scrutin',async()=>{
    const token=new URL(mobileUrl).pathname.split('/').pop();let blocked=0;for(let i=0;i<61;i++)if((await raw('/api/scrutin/'+token)).status===429)blocked++;
    assert.equal(blocked,0,`${blocked} réponses 429 sur 61 lectures : limite partagée par IP`);
  });
  await check('HTTP-15','Déconnexion puis refus de l’accès administrateur',async()=>{
    await api('/api/auth/deconnexion',{});assert.equal((await raw('/api/voters')).status,401);
  });

} finally {fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({results,errors},null,2)+'\n');await browser.close();if(results.some(r=>r.status==='ECHEC'))process.exitCode=1;}
