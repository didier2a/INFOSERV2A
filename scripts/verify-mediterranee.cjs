const path = require('node:path');
process.chdir(path.resolve(__dirname, '..'));
let playwright;
try { playwright = require('playwright'); } catch {
  playwright = require(process.env.PLAYWRIGHT_MODULE || path.join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
}
const { chromium } = playwright;
const fs = require('node:fs');
const assert = require('node:assert/strict');
const BASE='http://127.0.0.1:8016';
const OUT='docs/validation-mediterranee';
fs.mkdirSync(OUT+'/captures',{recursive:true});
const routes=['index.html','maintenance-distance.html','reseaux-wifi.html','videosurveillance.html','creation-site-web.html','claire.html','a-propos.html','contact.html'];
const report={date:new Date().toISOString(),mode:'Local preview, simulated services; no external email or live voice/video',checks:[],captures:[],errors:[]};
async function check(name,fn) {try{const detail=await fn();report.checks.push({name,passed:true,detail});console.log('PASS '+name);}catch(e){report.checks.push({name,passed:false,error:e.message});console.log('FAIL '+name+': '+e.message);}}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function stable(page){await page.waitForFunction(()=>!!window.InfoServClaire?.companion?.siteAdapter);await page.evaluate(()=>window.InfoServClaire.companion.ensureProviderReady());await page.evaluate(()=>document.fonts.ready);await pause(650);}
async function capture(page,name,fullPage=true){await page.screenshot({path:OUT+'/captures/'+name,fullPage});report.captures.push(name);}
async function health(page){return page.evaluate(()=>{
  const main=document.querySelector('#contenu');
  const bad=[...main.querySelectorAll('*')].filter(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return s.display!=='none'&&r.width>0&&(r.right>innerWidth+2||r.left< -2)}).map(n=>n.tagName+'.'+n.className).slice(0,5);
  return {h1:main.querySelectorAll('h1').length,width:main.getBoundingClientRect().width,overflow:bad,images:[...document.querySelectorAll('#contenu img')].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src),nav:document.querySelectorAll('.site-nav>a').length};
});}
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  await context.addInitScript(()=>{
    window.__mediaRequests=0;
    navigator.mediaDevices.getUserMedia=async()=>{window.__mediaRequests++;throw new Error('QA: hardware microphone is not used');};
  });
  for(const [i,route] of routes.entries()) await check('PC route '+route,async()=>{
    const res=await page.goto(BASE+'/'+route,{waitUntil:'networkidle'});assert.equal(res.status(),200);await stable(page);
    const h=await health(page);assert.equal(h.h1,1);assert.equal(h.nav,8);assert.deepEqual(h.overflow,[]);assert.deepEqual(h.images,[]);
    assert.equal(await page.evaluate(()=>window.__mediaRequests),0);
    if(route==='index.html') await capture(page,'01-accueil-pc-manuel.png');
    await page.evaluate(()=>window.InfoServClaire.guided());await pause(650);
    const ratio=await page.evaluate(()=>({panel:document.querySelector('#claireCompanion').getBoundingClientRect().width,main:document.querySelector('#contenu').getBoundingClientRect().width,w:innerWidth}));
    assert.ok(Math.abs(ratio.panel-ratio.w/3)<2);assert.ok(Math.abs(ratio.main-ratio.w*2/3)<2);
    await capture(page,String(i+1).padStart(2,'0')+'-'+route.replace('.html','')+'-pc-claire.png',false);
    await page.evaluate(()=>window.InfoServClaire.manual());
    return {...h,ratio};
  });
  await check('Menu PC compact et fermeture clavier',async()=>{
    await page.setViewportSize({width:1100,height:900});await page.evaluate(()=>window.InfoServClaire.guided());await pause(700);
    const button=page.locator('.header-inner .nav-toggle');assert.ok(await button.isVisible());await button.click();
    assert.ok(await page.locator('.nav-panel.is-open').isVisible());await page.keyboard.press('Escape');assert.equal(await button.getAttribute('aria-expanded'),'false');
    await page.setViewportSize({width:1440,height:1000});
  });
  await check('Navigation PC avec instance et fournisseur de Claire conservés',async()=>{
    await page.goto(BASE+'/');await stable(page);await page.evaluate(async()=>{
      const c=window.InfoServClaire.companion;
      window.__qaCalls={connect:[],microphone:0,speak:[],pause:0};
      window.__qaCompanion=c;
      window.__qaProvider=c.provider={connected:true,streamReady:true,mediaAudible:true,listening:false,session:{id:'local-test-session'},
        connect:async function(o){window.__qaCalls.connect.push(o);if(o.microphone){this.listening=true;window.__qaCalls.microphone++;}},
        ensureMicrophone:async function(){this.listening=true;window.__qaCalls.microphone++;},
        pauseListening:async function(){this.listening=false;window.__qaCalls.pause++;return true;},
        speak:async(text)=>{window.__qaCalls.speak.push(text);return true;},interrupt(){this.listening=true;},primeAudio(){},resumeMedia(){},sendContext(){},sendBriefing(){},sendMemory(){},sendPrompt(){}};
      c.preflightMicrophone=async()=>true;
      window.InfoServClaire.guided();
    });
    for(const route of routes.slice(1)) {
      await page.locator('.site-nav>a[href="'+route+'"]').click();await page.waitForURL('**/'+route);await pause(650);
      assert.equal(await page.evaluate(()=>window.__qaCompanion===window.InfoServClaire.companion&&window.__qaProvider===window.InfoServClaire.companion.provider),true);
      assert.equal(await page.locator('#claireCompanion').count(),1);
    }
    await page.goBack();await page.waitForURL('**/a-propos.html');await pause(650);
    assert.equal(await page.evaluate(()=>window.InfoServClaire.companion.provider.session.id),'local-test-session');
    return {provider:'simulated',sessionPreserved:true};
  });
  await check('Claire : présentation sans microphone puis échange volontaire',async()=>{
    await page.locator('.site-nav>a[href="claire.html"]').click();await page.waitForURL('**/claire.html');await pause(650);
    await page.locator('[data-med-claire="presentation"]').first().click();await pause(400);
    let calls=await page.evaluate(()=>window.__qaCalls);assert.equal(calls.microphone,0);assert.equal(calls.speak.length,1);assert.ok(calls.speak[0].toLowerCase().includes("l'assistante virtuelle it d'infoserv2a"));assert.ok(calls.connect.every(x=>x.microphone===false));
    assert.equal(await page.evaluate(()=>window.InfoServClaire.companion.provider.listening),false);
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await pause(100);
    assert.equal(await page.evaluate(()=>window.__qaCalls.microphone),0);
    await page.locator('[data-med-claire="project"]').first().click();await pause(400);
    calls=await page.evaluate(()=>window.__qaCalls);assert.ok(calls.microphone>0);
    assert.equal(await page.evaluate(()=>window.InfoServClaire.companion.provider===window.__qaProvider),true);
    return {connectCalls:calls.connect,microphoneRequests:calls.microphone,presentationCount:calls.speak.length,presentationListening:false,visibilityDidNotRequestMicrophone:true,audio:'not generated or observed'};
  });
  await check('Claire : ranger puis rappeler sans remplacer la session',async()=>{
    await page.locator('.claire-experience__header [data-claire-manual]').click();await pause(650);assert.equal(await page.locator('#claireCompanion').getAttribute('data-state'),'manual');
    await page.locator('[data-claire-recall]').click();await pause(650);assert.equal(await page.locator('#claireCompanion').getAttribute('data-state'),'guided');
    assert.equal(await page.evaluate(()=>window.InfoServClaire.companion.provider===window.__qaProvider),true);
  });
  await check('Contact après navigation : validation, champs supplémentaires, simulation',async()=>{
    await page.locator('.site-nav>a[href="contact.html"]').click();await page.waitForURL('**/contact.html');await pause(650);
    await page.locator('#contact-form button[type=submit]').click();assert.ok((await page.locator('#contact-form .form-status').innerText()).includes('corriger'));
    await page.locator('#contact-name').fill('Essai local');await page.locator('#contact-email').fill('test@example.com');await page.locator('#contact-company').fill('Entreprise de test');await page.locator('#contact-city').fill('Porto-Vecchio');await page.locator('#contact-message').fill('Demande de vérification locale, sans envoi réel.');
    const req=page.waitForRequest(r=>r.url().endsWith('/api/send-email')&&r.method()==='POST');
    await page.locator('#contact-form button[type=submit]').click();const payload=(await req).postDataJSON();await page.waitForFunction(()=>document.querySelector('#contact-form .form-status').textContent.includes('Simulation locale réussie'));
    assert.ok(payload.message.includes('Entreprise de test'));assert.ok(payload.message.includes('Porto-Vecchio'));assert.ok(payload.message.includes('Professionnel'));
    await capture(page,'09-contact-simulation-pc.png',false);
    return {endpoint:'/api/send-email',simulated:true,fields:Object.keys(payload),profileAndCompanyIncluded:true};
  });
  await check('Contact : échec puis activation (réponses simulées)',async()=>{
    await page.route('**/api/send-email',r=>r.fulfill({status:503,contentType:'application/json',body:'{"sent":false,"error":"QA failure"}'}));
    await page.locator('#contact-form button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#contact-form .form-status').textContent.includes("n'a pas pu aboutir"));
    await page.unroute('**/api/send-email');
    await page.route('**/api/send-email',r=>r.fulfill({status:200,contentType:'application/json',body:'{"sent":false,"pendingActivation":true,"message":"Simulation : activation requise"}'}));
    await page.locator('#contact-form button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#contact-form .form-status').textContent.includes('activation requise'));await page.unroute('**/api/send-email');
  });
  await check('Devis : parcours, sélection Réseaux & Wi-Fi, simulation',async()=>{
    await page.locator('.header-cta').click();await page.waitForURL('**/devis.html');await pause(650);
    await page.locator('#devis-form button[type=submit]').click();assert.ok((await page.locator('#devis-form .form-status').innerText()).includes('corriger'));
    for(const [id,value] of Object.entries({'devis-name':'Essai local','devis-phone':'0600000000','devis-email':'test@example.com','devis-city':'Porto-Vecchio','devis-description':'Étudier un réseau pour un commerce. Essai sans envoi.'}))await page.locator('#'+id).fill(value);
    await page.locator('#devis-service').selectOption('reseaux-wifi');await page.locator('#devis-form button[type=submit]').click();
    await page.waitForFunction(()=>document.querySelector('#devis-form .form-status').textContent.includes('Simulation locale réussie'));
    return {realEmail:false,attachmentsSent:false};
  });
  const mobile=await browser.newContext({viewport:{width:360,height:780},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const phone=await mobile.newPage();phone.on('pageerror',e=>report.errors.push(e.message));
  for(const [i,route] of routes.entries())await check('S22 route '+route,async()=>{
    await phone.goto(BASE+'/'+route,{waitUntil:'networkidle'});await stable(phone);const h=await health(phone);assert.deepEqual(h.overflow,[]);assert.deepEqual(h.images,[]);
    await capture(phone,String(i+1).padStart(2,'0')+'-'+route.replace('.html','')+'-s22.png');return h;
  });
  await check('S22 : menu tactile, navigation et CTA',async()=>{
    await phone.locator('.header-inner .nav-toggle').click();assert.ok(await phone.locator('.nav-panel.is-open').isVisible());
    await phone.locator('.nav-panel nav a[href="reseaux-wifi.html"]').click();await phone.waitForURL('**/reseaux-wifi.html');await stable(phone);
    assert.equal(await phone.locator('.nav-panel').getAttribute('class').then(x=>x.includes('is-open')),false);
    assert.ok(await phone.locator('.med-dock a[href="devis.html"]').isVisible());assert.equal(await phone.locator('.med-dock a[href^="tel:"]').getAttribute('href'),'tel:+33745156076');
  });
  await check('S22 : saisie contact avec hauteur réduite simulant le clavier',async()=>{
    await phone.goto(BASE+'/contact.html');await stable(phone);await phone.locator('#contact-email').fill('mobile@example.com');await phone.setViewportSize({width:360,height:480});await phone.locator('#contact-message').fill('Essai clavier au format S22.');
    await phone.locator('#contact-message').evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));await pause(1200);assert.equal(await phone.locator('[data-claire-recall]').isVisible(),false);const box=await phone.locator('#contact-message').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=361);assert.ok(box.y>=0&&box.y+box.height<=480);
    await capture(phone,'10-contact-clavier-s22.png',false);await phone.setViewportSize({width:360,height:780});
    return {physicalKeyboard:false,viewport:'360x480',field:box,activeField:await phone.evaluate(()=>document.activeElement.id)};
  });
  await check('S22 : Claire, retour au site et rangement',async()=>{
    await phone.evaluate(()=>window.InfoServClaire.guided());await pause(650);
    await capture(phone,'11-claire-s22.png',false);
    await phone.evaluate(()=>window.InfoServClaire.companion.zapMobileScene());await pause(650);
    assert.ok(await phone.locator('.header-inner .nav-toggle').isVisible());
    await phone.evaluate(()=>window.InfoServClaire.manual());await pause(650);assert.ok(await phone.locator('[data-claire-recall]').isVisible());
  });
  await check('Aucune erreur JavaScript non gérée',async()=>assert.deepEqual(report.errors,[]));
  fs.writeFileSync(OUT+'/rapport-navigateur.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:report.checks.filter(x=>x.passed).length,failed:report.checks.filter(x=>!x.passed).length,captures:report.captures.length,errors:report.errors}));
  const code=report.checks.some(x=>!x.passed)?1:0;
  await Promise.race([browser.close(),pause(4000)]);
  process.exit(code);
})();
