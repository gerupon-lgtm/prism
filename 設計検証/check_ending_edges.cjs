// Targeted real UI ending checks. Synthetic bounds are test fixtures only;
// shipped stage definitions, the animation clock and sound scheduling stay real.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chooseChallenge,dragConnection,startAndPause}=require('./browser_wait.cjs');
const arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),engine=arg('--engine')||'chromium',root=path.resolve('dist');
const out=path.resolve(arg('--out')||`設計検証/終了短縮-20261024/edges/${engine}`);fs.mkdirSync(out,{recursive:true});
const report={version:JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version,passed:false,cases:[],boundary:'Desktop browser emulation; physical phones and listening remain unverified'};
const server=http.createServer((req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===root)file=path.join(root,'index.html');assert(file.startsWith(root+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.ttf':'font/ttf','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
const scenarios=[
  {name:'timeout-at-arrival',id:'Q29',edges:['SA','SB','BD','DS','AG'],limit:'1.1',kind:'timeout'},
  {name:'timeout-before-arrival',id:'Q1',edges:['SA','AG'],limit:'1',kind:'timeout'},
  {name:'no-arrival',id:'Q1',edges:['SA'],kind:'failed'},
  {name:'next-event-completion',id:'Q1',edges:['SA','AG'],kind:'clear',next:true},
  {name:'manual-stop-ending',id:'Q1',edges:['SA','AG'],kind:'clear',manual:true},
  {name:'desktop-fireworks',id:'Q29',edges:['SA','SB','BD','DS','AG'],kind:'clear',desktop:true},
  {name:'reduced-motion-ending',id:'Q1',edges:['SA','AG'],kind:'clear',reduced:true},
];
function observe(){
  const state=window.endingProbe={completed:null,toast:null,editing:null,fireworks:null,fireworkRemoved:null,fireworkBursts:0,goals:0,covered:false,earlyToast:false,timeoutSamples:[]};
  const shown=id=>{const e=document.querySelector(id);return Boolean(e&&!e.hidden&&!e.closest('[hidden]')&&e.getClientRects().length);};
  const read=()=>{const now=performance.now(),p=document.getElementById('play');
    if(p.disabled&&p.textContent==='終了'&&!state.completed)state.completed=now;
    const toast=shown('#clear-toast')||shown('#failure-toast'),fireworks=shown('.perfect-fireworks');
    if(fireworks)state.fireworkBursts=Math.max(state.fireworkBursts,document.querySelectorAll('.perfect-fireworks .firework').length);
    if(fireworks&&!state.fireworks)state.fireworks=now;
    if(!fireworks&&state.fireworks&&!state.fireworkRemoved)state.fireworkRemoved=now;
    if(toast&&!state.toast){state.toast=now;state.toastText=(shown('#clear-toast')?document.getElementById('clear-toast'):document.getElementById('failure-toast')).textContent;}
    if(toast&&!state.completed&&p.dataset.state!=='stopped')state.earlyToast=true;
    if(toast&&fireworks)state.covered=true;
    if(p.dataset.state==='stopped'&&!p.disabled&&p.textContent==='鐘を鳴らす')state.editing??=now;
    state.goals=[...document.querySelectorAll('[data-arrival-count]')].reduce((n,e)=>n+Number(e.dataset.arrivalCount),0);
  };
  new MutationObserver(read).observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});
  const sample=()=>{
    if(state.completed&&!state.toast&&window.endingSession?.runContext?.timeLimitReached){
      const session=window.endingSession;
      const core=JSON.stringify({clock:session.run.clock,records:session.run.records,result:session.result},(_key,value)=>typeof value==='bigint'?value.toString():value);
      const moving=[...document.querySelectorAll('#board .light-particle.moving')].map(el=>el.getAttribute('transform'));
      state.timeoutSamples.push({wall:performance.now(),core,moving,audioArrivals:window.endingAudio.filter(e=>['strike','relay'].includes(e.name)).length});
    }
    if(!state.toast)requestAnimationFrame(sample);
  };requestAnimationFrame(sample);
}
let browser;
(async()=>{try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await pw[engine].launch({headless:true});
  for(const c of scenarios){
    report.step=c.name;
    const context=await browser.newContext({viewport:c.desktop?{width:1440,height:960}:{width:390,height:844},isMobile:!c.desktop,hasTouch:!c.desktop,reducedMotion:c.reduced?'reduce':'no-preference'}),p=await context.newPage(),errors=[];
    p.on('pageerror',e=>errors.push(e.message));
    await p.addInitScript(reduced=>{Math.random=()=>.5;localStorage.setItem('prism-notes.motion.v1',JSON.stringify({version:1,value:reduced?'reduce':'full'}));},Boolean(c.reduced));
    await p.goto(`http://127.0.0.1:${server.address().port}/`);await p.locator('#board [data-node="S"]').waitFor();
    await p.evaluate(async limit=>{
      const base=document.querySelector('script[type=module]').src;
      const {Chime}=await import(new URL('./audio.js',base));window.endingAudio=[];
      for(const name of ['strike','relay','perfect','clear','failure','stop']){const original=Chime.prototype[name];Chime.prototype[name]=function(...args){window.endingAudio.push({name,wall:performance.now(),reason:args[0],options:args[1]});return original.apply(this,args);};}
      const {Session}=await import(new URL('../app/session.js',base)),start=Session.prototype.start;
      Session.prototype.start=function(...args){window.endingSession=this;if(limit)this.challenge={...this.challenge,maxDuration:limit};return start.apply(this,args);};
    },c.limit??null);
    await p.locator('#title-challenges').click();await chooseChallenge(p,c.id,{pagerTimeout:5000});
    assert.equal(await p.locator('html').getAttribute('data-motion'),c.reduced?'reduce':'full');
    const content=await p.evaluate(async id=>{const {challenges}=await import(new URL('../content/challenges.js',document.querySelector('script[type=module]').src));return challenges.find(c=>c.id===id);},c.id);
    for(const id of c.edges){const e=content.candidates.find(e=>e.id===id);assert(e,c.name+' edge '+id);await dragConnection(p,e.from,e.to);}
    await p.evaluate(observe);
    if(c.next){await startAndPause(p);for(let n=0;n<20&&!await p.evaluate(()=>Boolean(window.endingProbe.completed));n++)await p.locator('#next').click();}
    else await p.locator('#play').click();
    await p.waitForFunction(()=>window.endingProbe.completed!==null,null,{timeout:15000});
    if(c.manual)await p.locator('#stop').click();
    if(c.desktop){await p.waitForFunction(()=>window.endingProbe.fireworks!==null);await p.waitForTimeout(900);assert.equal(await p.locator('#clear-toast').isVisible(),false);await p.screenshot({path:path.join(out,c.name+'-effect.png')});}
    await p.waitForFunction(()=>window.endingProbe.toast!==null&&window.endingProbe.editing!==null,null,{timeout:8000});
    const result=await p.evaluate(()=>({probe:window.endingProbe,audio:window.endingAudio})),wait=result.probe.toast-result.probe.completed;
    assert.deepEqual(errors,[]);assert(!result.probe.covered);assert(!result.probe.earlyToast);
    if(c.manual)assert(wait<1000,'Manual stop skips waiting');else {const duration=c.kind==='clear'?1700:2000;assert(wait>=duration-80,c.name+' shortened ending wait');assert(wait<duration+750,c.name+' result no longer retains the previous extra second');}
    const completionStops=result.audio.filter(e=>e.name==='stop'&&e.reason==='completed');assert.equal(completionStops.length,1,c.name+' one completed stop');
    assert.equal(completionStops[0].options?.preserveTail,!c.manual,c.name+' natural tails reserved for automatic completion');
    const sound=c.kind==='clear'?'perfect':'failure';assert.equal(result.audio.filter(e=>e.name===sound).length,1,c.name+' one result sound');
    if(c.name==='timeout-at-arrival'){assert.equal(result.probe.goals,1);assert.equal(result.audio.filter(e=>e.name==='strike').length,1);assert.match(result.probe.toastText,/時間切れ/);}
    if(c.kind==='timeout')assert.match(result.probe.toastText,/時間切れ/);
    if(c.name==='timeout-before-arrival'){
      const samples=result.probe.timeoutSamples;assert(samples.length>=2,'Timeout display sampled on multiple animation frames');
      assert.equal(new Set(samples.map(s=>s.core)).size,1,'Scoring, records and experiment clock remain fixed at the cutoff');
      assert.equal(new Set(samples.map(s=>s.audioArrivals)).size,1,'Display-only motion creates no extra bell or prism sound');
      const moving=samples.filter(s=>s.moving.length);assert(moving.length>=2,'Light remains visible after the cutoff');
      assert(new Set(moving.map(s=>JSON.stringify(s.moving))).size>=2,'Light moves after the cutoff until the result display');
      assert(samples.at(-1).wall>result.probe.completed+1800,'Display-only motion continues through the shortened ending wait');
      assert.equal(await p.locator('#board .light-particle').count(),0,'Result display ends the remaining light motion');
    }
    if(c.desktop){assert(result.probe.fireworks&&result.probe.fireworkRemoved);assert.equal(result.probe.fireworkBursts,5);assert(result.probe.toast>=result.probe.fireworkRemoved);}
    await p.screenshot({path:path.join(out,c.name+'-result.png')});
    // A geometry refresh must not replay either the sound or the fireworks.
    const before=result.audio.filter(e=>e.name===sound).length;await p.setViewportSize(c.desktop?{width:1366,height:900}:{width:412,height:892});await p.waitForTimeout(150);
    assert.equal(await p.evaluate(name=>window.endingAudio.filter(e=>e.name===name).length,sound),before);
    assert.equal(await p.locator('.perfect-fireworks').count(),0);
    if(c.next){await p.locator('#clear-next').click();assert.match(await p.locator('#title').textContent(),/^Q2 /);assert.equal(await p.locator('.edge:not(.candidate)').count(),0);result.nextChoicePassed=true;}
    if(c.desktop){const before=await p.locator('.edge:not(.candidate)').evaluateAll(els=>els.map(e=>e.dataset.edge));await p.locator('#clear-again').click();assert.equal(await p.locator('#clear-toast').isVisible(),false);assert.deepEqual(await p.locator('.edge:not(.candidate)').evaluateAll(els=>els.map(e=>e.dataset.edge)),before);assert.equal(await p.locator('#play').isEnabled(),true);result.retryChoicePassed=true;}
    report.cases.push({...c,...result,waitMs:wait,passed:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(c.name+' passed');await context.close();
  }
  report.passed=true;
}catch(e){report.error=e.stack;process.exitCode=1;console.error(report.step,e.stack);}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}})();
