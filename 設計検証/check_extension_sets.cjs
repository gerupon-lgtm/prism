// Real UI gestures against the built or public app. Geometry/audio calls on PC
// are not physical-phone touch, listening or difficulty acceptance.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chooseChallenge,selectChallenge,dragConnection,startAndPause,waitForAsync}=require('./browser_wait.cjs');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const offline=process.argv.includes('--offline');
const pw=require(arg('--playwright-path')),engine=arg('--engine')||'chromium',channel=arg('--channel'),root=path.resolve('dist'),version=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version;
const output=path.resolve('設計検証/三つのテーマ',version,arg('--url')?new URL(arg('--url')).hostname:offline?'offline':'local',channel||engine);fs.mkdirSync(output,{recursive:true});
const reportFile=path.join(output,'report.json');if(fs.existsSync(reportFile)){const previous=JSON.parse(fs.readFileSync(reportFile));if(!previous.passed)fs.copyFileSync(reportFile,path.join(output,`failed-${Date.now()}.json`));}
const proofs=['星への帰還','月鏡の静殿','星刻の開廊'].flatMap(dir=>JSON.parse(fs.readFileSync(path.join(__dirname,dir,'proof.json'))).stages);
const report={version,passed:false,checks:[],pending:['Physical phones, actual listening and subjective difficulty']};
const check=(label,data={})=>{report.checks.push({label,passed:true,...data});console.log(label);};
const server=http.createServer((req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===root)file=path.join(root,'index.html');if(!file.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.ttf':'font/ttf'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
const settle=p=>p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#board image')].map(async e=>{const image=new Image();image.src=e.getAttribute('href');await image.decode();}));for(let i=0;i<3;i++)await new Promise(requestAnimationFrame);});
async function layout(p,label){
 if(await p.locator('#mirror-intro-start').isVisible())await p.locator('#mirror-intro-start').click();
 const r=await p.evaluate(()=>{const c=document.getElementById('challenge-info'),g=document.getElementById('challenge-goal'),b=document.getElementById('stage').getBoundingClientRect();return{width:innerWidth,height:innerHeight,scrollW:document.documentElement.scrollWidth,scrollH:document.documentElement.scrollHeight,card:c.getBoundingClientRect().height,condition:g.textContent,goalH:g.clientHeight,goalScrollH:g.scrollHeight,goalW:g.clientWidth,goalScrollW:g.scrollWidth,parts:[...document.querySelectorAll('.node-hit')].map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};}),stage:{x:b.x,y:b.y,right:b.right,bottom:b.bottom}};});
 assert(r.scrollW<=r.width+1&&r.scrollH<=r.height+1,label+' no page scroll');assert(r.goalScrollW<=r.goalW+1&&r.goalScrollH<=r.goalH+1,label+' full condition');
 for(const part of r.parts)assert(part.x>=r.stage.x-1&&part.right<=r.stage.right+1&&part.y>=r.stage.y-1&&part.bottom<=r.stage.bottom+1,label+' part touch region inside stage');
 check(label,r);return r;
}
async function enter(p){await p.locator('#title-challenges').click();await chooseChallenge(p,'Q1');await settle(p);}
async function finish(p){await startAndPause(p);await p.evaluate(async()=>{for(let n=0;n<512&&!document.getElementById('next').disabled;n++){document.getElementById('next').click();await new Promise(requestAnimationFrame);}});}
async function goodPhase(p,c,proof){
 if(!c.nodes.some(n=>n.gate))return;
 const node=c.nodes.find(n=>n.gate),period=Number(node.gate.period),delta=Number(proof.delta),optimal=new Set(proof.optimalPhases.map(s=>Math.round(((Number(s)-delta+period)%period)*10)%Math.round(period*10)));
 const safe=[...optimal].filter(t=>[-2,-1,1,2].every(d=>optimal.has((t+d+period*10)%(period*10))));assert(safe.length,'generous phase window');
 await waitForAsync(p,({node,safe,period})=>{const e=document.querySelector(`[data-node="${node.id}"]`),label=e?.querySelector('.gate-status')?.textContent,match=label?.match(/([\d.]+)秒/);if(!match)return false;const phase=(e.classList.contains('gate-open')?Number(node.gate.open):period)-Number(match[1]),offset=Math.round(((phase-Number(node.gate.phase)+period)%period)*10)%(period*10);return safe.includes(offset);},{node,safe,period},{timeout:20000});
}
let browser,activePage;
(async()=>{try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=arg('--url')||`http://127.0.0.1:${server.address().port}/`;
 browser=await pw[engine].launch({headless:true,...(channel?{channel}:{})});report.browser={engine,channel,version:browser.version()};
 for(const scenario of [{name:'phone',width:390,height:844,mobile:true},...(!offline?[{name:'desktop',width:1600,height:1000}]:[])]){
  const context=await browser.newContext({viewport:{width:scenario.width,height:scenario.height},isMobile:!!scenario.mobile,hasTouch:!!scenario.mobile});const p=await context.newPage(),errors=[];activePage=p;
  p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{Math.random=()=>0;const orientation=new EventTarget();window.__direction={angle:0,type:'portrait-primary'};Object.defineProperties(orientation,{angle:{get:()=>__direction.angle},type:{get:()=>__direction.type}});Object.defineProperty(screen,'orientation',{get:()=>orientation});});
  await p.goto(url);await enter(p);
  if(offline){await waitForAsync(p,async()=>{if(!navigator.serviceWorker.controller)return false;const info=await(await fetch('build-info.json')).json(),cache=await caches.open('prism-notes:'+new URL(document.baseURI).pathname+':'+info.version);return(await Promise.all(info.assets.map(a=>cache.match(new URL(a,document.baseURI))))).every(Boolean);},null,{timeout:30000});if(engine==='webkit'&&!arg('--url'))await new Promise(r=>server.close(r));else await context.setOffline(true);await p.reload();await enter(p);check('Prepared app restarts without network');}
  const catalogue=await p.evaluate(async()=>{const {challenges}=await import(new URL('../content/challenges.js',document.querySelector('script[type=module]').src));return challenges;});assert.equal(catalogue.length,42);
  const heights=[];
  if(!arg('--from-stage')){for(const c of catalogue){report.step=scenario.name+' layout Q'+c.number;if(c.number>1)await p.locator('#stage-next').click();await settle(p);assert.match(await p.locator('#title').textContent(),new RegExp('^Q'+c.number+' '));const r=await layout(p,scenario.name+' Q'+c.number+' full condition and fit');heights.push(r.card);if(c.number>24){assert.equal(await p.locator('.scene').getAttribute('data-scene'),c.world);if([25,28,31,36,37,42].includes(c.number))await p.screenshot({path:path.join(output,scenario.name+'-Q'+c.number+'.png')});}}
  assert(Math.max(...heights)-Math.min(...heights)<.6,'all42 same condition height');check(scenario.name+' all42 fixed condition cards');}
  if(scenario.mobile){
   let previousPlayed=0;
   for(const c of catalogue.slice(Math.max(24,Number(arg('--from-stage')||25)-1)).filter(c=>!arg('--stages')||arg('--stages').split(',').map(Number).includes(c.number))){
    report.step='select Q'+c.number;
    if(c.number===previousPlayed+1)await p.locator('#stage-next').click();else await selectChallenge(p,c.id);previousPlayed=c.number;await settle(p);const id=await p.locator('#app').getAttribute('data-problem-id'),proof=proofs.find(row=>row.id===id);assert(proof);
    for(const edgeId of proof.winner){report.step='Q'+c.number+' drag '+edgeId;const edge=c.candidates.find(e=>e.id===edgeId);await dragConnection(p,edge.from,edge.to);}
    assert.equal(await p.locator('.edge:not(.candidate)').count(),proof.winner.length,c.id+' real gesture wires');
    report.step='Q'+c.number+' start and full score';await goodPhase(p,c,proof);await finish(p);assert.match(await p.locator('#result').textContent(),/達成 100\.00点/);check('Q'+c.number+' wired, exact full-score and result via UI');
    if(c.type==='return-pattern')assert.match(await p.locator('#clear-time-label').textContent(),/指定回数/);
    if(await p.locator('#stop').isEnabled())await p.locator('#stop').click();
   }
   await selectChallenge(p,'Q35');const c=catalogue.find(c=>c.id==='Q35');for(const id of ['SA','AM','MC','CG']){const e=c.candidates.find(e=>e.id===id);await dragConnection(p,e.from,e.to);}
   assert.equal(await p.locator('.edge:not(.candidate)').count(),4);await dragConnection(p,'M','D');assert.equal(await p.locator('.edge:not(.candidate)').count(),4);assert.equal(await p.locator('[data-edge="MC"]').getAttribute('class').then(s=>s.includes('candidate')),true);check('Mirror output replaced directly at full budget');
   await dragConnection(p,'M','C');assert.equal(await p.locator('[data-edge="MC"]').getAttribute('class').then(s=>s.includes('candidate')),false);assert.equal(await p.locator('dialog[open]').count(),0);check('Mirror rotation and SE API accept selection without a settings dialog');
   await selectChallenge(p,'Q38');await p.locator('[data-node="N"]').press('Enter');assert.equal(await p.locator('#mirror-aim-rainbow').getAttribute('gradientUnits'),'userSpaceOnUse');assert(await p.locator('.mirror-reflection').count());await p.screenshot({path:path.join(output,'vertical-mirror-preview.png')});await p.locator('#mirror-done').click();check('Vertical mirror preview uses a nondegenerate rainbow gradient');
   await selectChallenge(p,'Q46');for(const angle of [90,270,0]){await p.setViewportSize(angle?{width:844,height:390}:{width:390,height:844});await p.evaluate(angle=>{__direction.angle=angle;__direction.type=angle?'landscape-primary':'portrait-primary';screen.orientation.dispatchEvent(new Event('change'));window.dispatchEvent(new Event('orientationchange'));},angle);await settle(p);await layout(p,'Q42 rotation '+angle);}
   await p.evaluate(()=>document.documentElement.style.fontSize='28px');await settle(p);await layout(p,'Q42 enlarged text');
   await p.evaluate(()=>document.documentElement.style.fontSize='');await p.locator('#home').click();await p.getByRole('button',{name:'自由へ',exact:true}).click();
   const free={format:'prism-notes-circuit',version:1,name:'反射先の再選択',circuit:{mode:'spread',target:'G',nodes:[{id:'S',kind:'source',x:.5,y:.1,process:'0.5'},{id:'M',kind:'mirror',x:.5,y:.45,process:'0.5',reflectTo:'A'},{id:'A',kind:'prism',x:.2,y:.7,process:'0.5'},{id:'G',kind:'goal',x:.8,y:.9,process:'0'}],edges:[{id:'SM',from:'S',to:'M',time:'1'},{id:'MA',from:'M',to:'A',time:'1'},{id:'GM',from:'G',to:'M',time:'1',bidirectional:true}]}};
   report.step='free mirror direction regression';await p.locator('#import').setInputFiles({name:'mirror.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(free))});await p.getByText('反射先の再選択',{exact:true}).waitFor();
   for(const target of ['G','A']){await dragConnection(p,'M',target);assert(await p.locator('.mirror-reflection').count());assert.equal(await p.locator('.mirror-optics').getAttribute('data-target'),target);}
   check('Imported free mirror keeps all direction choices, unwired previews and bidirectional reuse');
  }
  assert.deepEqual(errors,[],'no page exceptions');check(scenario.name+' no page errors');await context.close();
 }
 report.passed=true;
}catch(error){report.error=error.stack;console.error(report.step,error.stack);if(activePage&&!activePage.isClosed()){await activePage.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});report.failureState=await activePage.evaluate(()=>({title:document.getElementById('challenge-title')?.textContent,play:document.getElementById('play')?.outerHTML,hint:document.getElementById('hint')?.textContent,edges:[...document.querySelectorAll('.edge:not(.candidate)')].map(e=>e.dataset.edge)})).catch(()=>null);}process.exitCode=1;}finally{fs.writeFileSync(reportFile,JSON.stringify(report,null,2));await browser?.close();server.close();}})();
