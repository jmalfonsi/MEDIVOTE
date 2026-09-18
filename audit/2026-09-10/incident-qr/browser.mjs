import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || '/home/ubuntu/.npm/_npx/f0a362733743bae2/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const ctx=await browser.newContext();const base='http://127.0.0.1:3187';const results=[];
async function api(route,data){const r=await ctx.request.fetch(base+route,{method:data===undefined?'GET':'POST',data});assert.equal(r.status(),200);return r.json();}
async function check(name,fn){try{await fn();results.push({name,status:'OK'});}catch(e){results.push({name,status:'ECHEC',error:e.message});}console.log(results.at(-1));}
try{
 await api('/api/auth/admin',{pin:'739162'});
 const voters=(await api('/api/voters')).voters.filter(v=>v.isActive).slice(0,3);
 const session=(await api('/api/meetings/create',{title:'Régression expiration QR',attendeeIds:voters.map(v=>v.id)})).session;
 const links=(await api('/api/liens-vote?sessionId='+session.id)).liens;
 await check('Le QR affiché se renouvelle à son échéance sans changer de point',async()=>{
  const page=await ctx.newPage();let calls=0;
  await page.route('**/api/liens-vote?*',async route=>{
   calls++;const response=await route.fetch();const body=await response.json();
   body.liens=body.liens.map(l=>({...l,expireLe:new Date(Date.now()+(calls===1?2000:86400000)).toISOString()}));
   await route.fulfill({response,json:body});
  });
  try{await page.goto(base);await page.locator('#nav-tab-table').click();await page.waitForTimeout(5000);assert(calls>=2,`Une seule lecture des liens : ${calls}`);}finally{await page.close();}
 });
 await check('Une erreur temporaire du réseau mobile ne bloque pas définitivement le lien',async()=>{
  const page=await ctx.newPage();let calls=0;
  await page.route('**/api/scrutin/*',async route=>{calls++;if(calls===1)await route.fulfill({status:503,json:{error:'Service momentanément indisponible'}});else await route.continue();});
  try{await page.goto(links[0].url);await page.waitForTimeout(6500);assert(calls>=2,`La surveillance reste arrêtée après ${calls} requête`);assert(!(await page.locator('body').innerText()).includes('Service momentanément indisponible'));}finally{await page.close();}
 });
 await check('Un lien expiré demande un nouveau scan et permet une nouvelle vérification',async()=>{
  const page=await ctx.newPage();
  try{await page.goto(base+'/vote/lien-expire-fictif');await page.getByText('Lien de vote inutilisable',{exact:true}).waitFor();await page.getByRole('button',{name:'Réessayer',exact:true}).waitFor({timeout:2000});}finally{await page.close();}
 });
}finally{
 fs.writeFileSync('audit/2026-09-10/incident-qr/'+(process.env.QR_REPORT||'browser-results.json'),JSON.stringify(results,null,2)+'\n');await browser.close();if(results.some(r=>r.status==='ECHEC'))process.exitCode=1;
}
