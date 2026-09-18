import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || '/home/ubuntu/.npm/_npx/f0a362733743bae2/node_modules/playwright/index.mjs');
const out=path.resolve('audit/2026-09-10/corrections');const base='http://127.0.0.1:3187';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const ctx=await browser.newContext({viewport:{width:1440,height:1000}});ctx.setDefaultTimeout(10000);
const page=await ctx.newPage();page.on('dialog',d=>d.accept());const results=[];
async function api(route,data){const r=await ctx.request.fetch(base+route,{method:data===undefined?'GET':'POST',data});assert.equal(r.status(),200,route);return r.json();}
async function check(id,f){try{await f();results.push({id,status:'OK'});}catch(e){results.push({id,status:'ECHEC',detail:e.message});}console.log(results.at(-1));}
try{
 await api('/api/auth/admin',{pin:'739162'});await page.goto(base);await page.locator('#nav-tab-admin').waitFor();
 const history=(await api('/api/history')).history;const original=history.find(h=>h.sessionId==='http_r1');
 await check('PDF depuis la table figé malgré une modification du répertoire',async()=>{
   const voter=(await api('/api/voters')).voters.find(v=>v.id==='http_a');
   await api('/api/voters/save',{...voter,name:'Nom changé après la clôture',weight:9});
   await api('/api/resolutions/switch',{resolutionId:'http_r1'});await page.reload();await page.locator('#nav-tab-table').click();
   assert(!(await page.locator('body').innerText()).includes('Nom changé après la clôture'));
   const [d]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Rapport PDF',exact:true}).click()]);await d.saveAs(path.join(out,'ui-table-figee.pdf'));
   await page.locator('#nav-tab-admin').click();await page.getByRole('button',{name:'Émargement',exact:true}).click();
   assert(!(await page.locator('body').innerText()).includes('Nom changé après la clôture'));
   await api('/api/voters/save',voter);
 });
 await check('Édition du point non affiché conserve ses seuls convoqués',async()=>{
   const first=(await api('/api/meetings/create',{title:'Point réduit audit',attendeeIds:['http_a','http_b']})).session;
   await api(`/api/seances/${first.seanceId}/resolutions`,{title:'Point courant audit',attendeeIds:['http_c','http_d']});
   await page.reload();await page.locator('#nav-tab-admin').waitFor();
   const buttons=page.getByTitle('Modifier ce vote');await buttons.first().click();
   const text=await page.locator('body').innerText();assert(text.includes('(2/4)'), 'Le formulaire devrait conserver deux convoqués sur quatre');
   await page.reload();
 });
 await check('Simulation : un mandant suit son mandataire et les non-convoqués restent exclus',async()=>{
   const s=(await api('/api/meetings/create',{title:'Simulation audit',attendeeIds:['http_a','http_b','http_c']})).session;
   await api('/api/session/presence',{sessionId:s.id,voterId:'http_b',presence:'proxy',proxyToId:'http_a'});
   await api('/api/session/ouverture',{sessionId:s.id,ouvert:true});await page.reload();await page.locator('#nav-tab-table').click();
   await page.getByRole('button',{name:'Simuler votes',exact:true}).click();
   await page.waitForFunction(async()=>{const r=await fetch('/api/session/active').then(r=>r.json());return r.session.voterStates.http_c.vote!=='pending';});
   const state=(await api('/api/session/active')).session.voterStates;assert.equal(state.http_a.vote,state.http_b.vote);assert.equal(state.http_d,undefined);
 });
 await check('Téléphone : poids personnel et mandat affichent quatre voix',async()=>{
   const voter=(await api('/api/voters')).voters.find(v=>v.id==='http_a');
   const phone=await ctx.newPage();await phone.setViewportSize({width:390,height:844});
   try {
     await api('/api/voters/save',{...voter,weight:3});
     const s=(await api('/api/meetings/create',{title:'Vote pondéré mobile',attendeeIds:['http_a','http_b']})).session;
     await api('/api/session/presence',{sessionId:s.id,voterId:'http_b',presence:'proxy',proxyToId:'http_a'});
     await api('/api/session/ouverture',{sessionId:s.id,ouvert:true});
     const link=(await api('/api/liens-vote?sessionId='+s.id)).liens.find(l=>l.voterId==='http_a');
     await phone.goto(link.url);await phone.getByText(/4 voix/).first().waitFor();
     await phone.screenshot({path:path.join(out,'mobile-poids.png'),fullPage:true});
   } finally {await phone.close();await api('/api/voters/save',voter);}
 });
 await check('PDF final : tous les témoins sont régénérés avec la pagination corrigée',async()=>{
   const fixtures=JSON.parse(fs.readFileSync(path.join(out,'pdf-fixtures.json'),'utf8')).filter(f=>!f.session.referenceCode.includes('RACCOURCI'));
   fixtures.push({session:original.detailedSnapshot.session,voters:original.detailedSnapshot.voters,stats:original.detailedSnapshot.stats,filename:'pv-corrige.pdf'});
   for(const f of fixtures){const [d]=await Promise.all([page.waitForEvent('download'),page.evaluate(async f=>{const pdf=await import('/src/utils/pdfExport.ts');await pdf.prechargerLogo();pdf.generateSessionPdfReport(f.session,f.voters,f.stats);},f)]);await d.saveAs(path.join(out,f.filename||d.suggestedFilename()));}
 });
 await check('Impression isolée même lorsqu’une notification est visible',async()=>{
   await page.reload();await page.locator('#nav-tab-history').click();await page.getByRole('button',{name:'Voir PV',exact:true}).first().click();
   await page.getByRole('button',{name:'Imprimer',exact:true}).waitFor();
   await page.evaluate(()=>{const toast=document.createElement('div');toast.dataset.audit='toast';toast.textContent='NOTIFICATION_TEMOIN_A_EXCLURE';document.body.append(toast);});
   await page.pdf({path:path.join(out,'impression-finale.pdf'),format:'A4',printBackground:true});
 });
}finally{fs.writeFileSync(path.join(out,'final-results.json'),JSON.stringify(results,null,2));await browser.close();if(results.some(r=>r.status==='ECHEC'))process.exitCode=1;}
