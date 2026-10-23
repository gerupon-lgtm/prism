// Targeted real UI ending checks. Synthetic bounds are test fixtures only;
// shipped stage definitions, the animation clock and sound scheduling stay real.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chooseChallenge,dragConnection,startAndPause}=require('./browser_wait.cjs');
const arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),engine=arg('--engine')||'chromium',root=path.resolve('dist');
const out=path.resolve(arg('--out')||`設計検証/終了到達演出-20261024/edges/${engine}`);fs.mkdirSync(out,{recursive:true});
const report={version:JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version,passed:false,cases:[],boundary:'Desktop browser emulation; physical phones and listening remain unverified'};
const server=http.createServer((req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===root)file=path.join(root,'index.html');assert(file.startsWith(root+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.ttf':'font/ttf','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
const scenarios=[
  {name:'timeout-at-arrival',id:'Q29',edges:['SA','SB','BD','DS','AG'],limit:'1.1',kind:'timeout'},
  {name:'timeout-before-arrival',id:'Q1',edges:['SA','AG'],limit:'1.1',kind:'timeout',lateGoal:true,naturalAudio:true},
  {name:'timeout-prism-arrival',id:'Q1',edges:['SA','AG'],limit:'0.5',kind:'timeout',latePrism:true},
  {name:'timeout-arrival-effect-error',id:'Q1',edges:['SA','AG'],limit:'1.1',kind:'timeout',throwLate:true},
  {name:'timeout-muted-bell',id:'Q1',edges:['SA','AG'],limit:'1.1',kind:'timeout',lateGoal:true,mute:true},
  {name:'timeout-manual-stop',id:'Q1',edges:['SA','AG'],limit:'1.1',kind:'timeout',manual:true},
  {name:'no-arrival',id:'Q1',edges:['SA'],kind:'failed'},
  {name:'next-event-completion',id:'Q1',edges:['SA','AG'],kind:'clear',next:true},
  {name:'manual-stop-ending',id:'Q1',edges:['SA','AG'],kind:'clear',manual:true},
  {name:'desktop-fireworks',id:'Q29',edges:['SA','SB','BD','DS','AG'],kind:'clear',desktop:true},
  {name:'reduced-motion-ending',id:'Q1',edges:['SA','AG'],kind:'clear',reduced:true},
];
function observe(){
  const state=window.endingProbe={completed:null,toast:null,editing:null,fireworks:null,fireworkRemoved:null,fireworkBursts:0,fireworkAnimationEnds:{},fireworkAnimationBoundMs:0,goals:0,covered:false,earlyToast:false,timeoutSamples:[],pictures:{},maxPaintGapMs:0};
  const shown=id=>{const e=document.querySelector(id);return Boolean(e&&!e.hidden&&!e.closest('[hidden]')&&e.getClientRects().length);};
  document.body.addEventListener('animationend',event=>{if(event.target.closest('.perfect-fireworks'))state.fireworkAnimationEnds[event.animationName]=(state.fireworkAnimationEnds[event.animationName]??0)+1;},true);
  const read=()=>{const now=performance.now(),p=document.getElementById('play');
    if(p.disabled&&p.textContent==='終了'&&!state.completed)state.completed=now;
    const toast=shown('#clear-toast')||shown('#failure-toast'),fireworks=shown('.perfect-fireworks');
    if(fireworks)state.fireworkBursts=Math.max(state.fireworkBursts,document.querySelectorAll('.perfect-fireworks .firework').length);
    if(fireworks&&!state.fireworks){state.fireworks=now;for(const animation of document.querySelector('.perfect-fireworks').getAnimations({subtree:true}))state.fireworkAnimationBoundMs=Math.max(state.fireworkAnimationBoundMs,animation.effect.getComputedTiming().endTime);}
    if(!fireworks&&state.fireworks&&!state.fireworkRemoved)state.fireworkRemoved=now;
    if(toast&&!state.toast){state.toast=now;state.toastText=(shown('#clear-toast')?document.getElementById('clear-toast'):document.getElementById('failure-toast')).textContent;}
    if(toast&&!state.completed&&p.dataset.state!=='stopped')state.earlyToast=true;
    if(toast&&fireworks)state.covered=true;
    if(p.dataset.state==='stopped'&&!p.disabled&&p.textContent==='鐘を鳴らす')state.editing??=now;
    state.goals=[...document.querySelectorAll('[data-arrival-count]')].reduce((n,e)=>n+Number(e.dataset.arrivalCount),0);
    const keys=new Set();
    for(const el of document.querySelectorAll('#board [data-arrival-key][data-arrival-node]')){const key=el.dataset.arrivalKey;keys.add(key);state.pictures[key]??={node:el.dataset.arrivalNode,wall:now,removed:null};}
    for(const [key,picture] of Object.entries(state.pictures))if(!keys.has(key)&&picture.removed===null)picture.removed=now;
  };
  new MutationObserver(read).observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});
  let previousPaint=null;
  const sample=now=>{
    if(previousPaint!==null)state.maxPaintGapMs=Math.max(state.maxPaintGapMs,now-previousPaint);previousPaint=now;
    if(state.completed&&!state.toast&&window.endingSession?.runContext?.timeLimitReached){
      const session=window.endingSession;
      const core=JSON.stringify({clock:session.run.clock,pauseReason:session.run.pauseReason,records:session.run.records,result:session.result},(_key,value)=>typeof value==='bigint'?value.toString():value);
      const markers=JSON.stringify([...document.querySelectorAll('[data-arrival-count]')].map(el=>({node:el.dataset.node,count:el.dataset.arrivalCount,last:el.classList.contains('last-arrival')})));
      const moving=[...document.querySelectorAll('#board .light-particle.moving')].map(el=>el.getAttribute('transform'));
      state.timeoutSamples.push({wall:performance.now(),core,markers,moving,audioArrivals:window.endingAudio.filter(e=>['strike','relay'].includes(e.name)).length});
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
    await p.evaluate(async ({limit,throwLate})=>{
      const base=document.querySelector('script[type=module]').src;
      const {Chime}=await import(new URL('./audio.js',base));window.endingAudio=[];window.endingCues=[];
      window.endingAudioCapabilities={standard:Boolean(window.AudioContext),webkit:Boolean(window.webkitAudioContext),userAgent:navigator.userAgent};
      const audioState=chime=>({voices:chime.voices.size,muted:chime.muted,contextTime:chime.context?.currentTime??null,contextState:chime.context?.state??null,bellUntil:chime.bellUntil});
      let cueSource=null;
      const cue=Chime.prototype.cue;Chime.prototype.cue=function(sound,delay,...args){window.endingCues.push({source:cueSource,wall:performance.now(),delay,before:audioState(this)});return cue.call(this,sound,delay,...args);};
      for(const name of ['strike','relay','perfect','clear','failure','stop']){const original=Chime.prototype[name];Chime.prototype[name]=function(...args){window.endingChime=this;const entry={name,wall:performance.now(),reason:args[0],options:args[1],before:audioState(this)};window.endingAudio.push(entry);const previous=cueSource;cueSource=name;try{return original.apply(this,args);}finally{entry.after=audioState(this);cueSource=previous;}};}
      const {Session}=await import(new URL('../app/session.js',base)),start=Session.prototype.start;
      Session.prototype.start=function(...args){window.endingSession=this;if(limit)this.challenge={...this.challenge,maxDuration:limit};return start.apply(this,args);};
      window.endingArtErrors=[];window.endingLateArtCalls=[];
      if(throwLate){const {Board}=await import(new URL('./board.js',base)),arrivals=Board.prototype.arrivals;let injected=false;Board.prototype.arrivals=function(entries){const run=this.session.run,late=entries.filter(entry=>entry.type==='goal'&&run.circuit.time.ticks(entry.time)>run.clock);if(late.length){window.endingLateArtCalls.push({wall:performance.now(),entries:late.map(({node,time,particle})=>({node,time,particle}))});if(!injected){injected=true;window.endingArtErrors.push({wall:performance.now(),clock:run.circuit.time.format(run.clock)});throw new Error('Synthetic late arrival artwork failure');}}return arrivals.call(this,entries);};}
    },{limit:c.limit??null,throwLate:Boolean(c.throwLate)});
    await p.locator('#title-challenges').click();await chooseChallenge(p,c.id,{pagerTimeout:5000});
    assert.equal(await p.locator('html').getAttribute('data-motion'),c.reduced?'reduce':'full');
    const content=await p.evaluate(async id=>{const {challenges}=await import(new URL('../content/challenges.js',document.querySelector('script[type=module]').src));return challenges.find(c=>c.id===id);},c.id);
    for(const id of c.edges){const e=content.candidates.find(e=>e.id===id);assert(e,c.name+' edge '+id);await dragConnection(p,e.from,e.to);}
    await p.evaluate(observe);
    if(c.next){await startAndPause(p);for(let n=0;n<20&&!await p.evaluate(()=>Boolean(window.endingProbe.completed));n++)await p.locator('#next').click();}
    else await p.locator('#play').click();
    await p.waitForFunction(()=>window.endingProbe.completed!==null,null,{timeout:15000});
    if(c.mute){await p.locator('#sound').click();assert.equal(await p.locator('#sound').getAttribute('aria-pressed'),'false');await p.evaluate(()=>{window.endingProbe.muted=performance.now();});}
    if(c.manual)await p.locator('#stop').click();
    if(c.desktop){await p.waitForFunction(()=>window.endingProbe.fireworks!==null);await p.waitForTimeout(900);assert.equal(await p.locator('#clear-toast').isVisible(),false);await p.screenshot({path:path.join(out,c.name+'-effect.png')});}
    await p.waitForFunction(()=>window.endingProbe.toast!==null&&window.endingProbe.editing!==null,null,{timeout:8000});
    await p.waitForFunction(()=>Object.values(window.endingProbe.pictures).every(picture=>picture.removed!==null),null,{timeout:3000});
    const result=await p.evaluate(()=>({probe:window.endingProbe,audio:window.endingAudio,cues:window.endingCues,audioCapabilities:window.endingAudioCapabilities,artErrors:window.endingArtErrors,lateArtCalls:window.endingLateArtCalls})),wait=result.probe.toast-result.probe.completed;
    assert.deepEqual(errors,[]);assert(!result.probe.covered);assert(!result.probe.earlyToast);
    if(c.manual)assert(wait<1000,'Manual stop skips waiting');else {assert(wait>=1500-80,c.name+' common 1.5 second ending wait');assert(wait<=1500+Math.max(250,result.probe.maxPaintGapMs*2),c.name+' result does not retain the previous longer wait');}
    const completionStops=result.audio.filter(e=>e.name==='stop'&&e.reason==='completed');assert.equal(completionStops.length,1,c.name+' one completed stop');
    assert.equal(completionStops[0].options?.preserveTail,!c.manual,c.name+' natural tails reserved for automatic completion');
    const sound=c.kind==='clear'?'perfect':'failure',expectedSound=c.mute||(c.manual&&c.kind==='timeout')?0:1;assert.equal(result.audio.filter(e=>e.name===sound).length,expectedSound,c.name+' one result sound per enabled automatic outcome');
    const goalIds=content.goals??[content.goal],goalPictures=Object.values(result.probe.pictures).filter(picture=>goalIds.includes(picture.node));
    if(c.name==='timeout-at-arrival'){
      assert.equal(result.probe.goals,1,'Only the cutoff arrival is an official arrival');
      assert.equal(result.audio.filter(e=>e.name==='strike').length,goalPictures.length,'One bell response per unique official or continued arrival');
      assert.equal(result.audio.filter(e=>e.name==='strike'&&e.wall<=result.probe.completed+40).length,1,'The cutoff frame bell is not replayed by continuation');
      assert.match(result.probe.toastText,/時間切れ/);
    }
    if(c.kind==='timeout')assert.match(result.probe.toastText,/時間切れ/);
    if(c.kind==='timeout'&&!c.manual){
      const samples=result.probe.timeoutSamples;assert(samples.length>=2,'Timeout display sampled on multiple animation frames');
      assert.equal(new Set(samples.map(s=>s.core)).size,1,'Scoring, records and experiment clock remain fixed at the cutoff');
      assert.equal(new Set(samples.map(s=>s.markers)).size,1,'Official arrival counts and final-arrival marker remain fixed at the cutoff');
      const moving=samples.filter(s=>s.moving.length);assert(moving.length>=2,'Light remains visible after the cutoff');
      assert(new Set(moving.map(s=>JSON.stringify(s.moving))).size>=2,'Light moves after the cutoff until the result display');
      assert(samples.at(-1).wall>result.probe.completed+1300,'Continuation is still observed near the common 1.5 second result wait');
      assert.equal(await p.locator('#board .light-particle').count(),0,'Result display ends the remaining light motion');
    }
    if(c.lateGoal){
      const strikes=result.audio.filter(e=>e.name==='strike'),late=goalPictures.filter(picture=>picture.wall>result.probe.completed);
      assert.equal(strikes.length,1,'The continued bell is sounded once');assert.equal(late.length,1,'The continued bell receives one new arrival picture');assert.equal(result.probe.goals,0,'The continued bell is excluded from the official marker');
      assert(strikes[0].wall>result.probe.completed&&strikes[0].wall<result.probe.toast,'The continued bell sounds before the result card');
      assert(result.probe.timeoutSamples.at(-1).audioArrivals>result.probe.timeoutSamples[0].audioArrivals,'Continuation produces a new response while the official core stays fixed');
      const picture=late[0];picture.visibleDurationMs=picture.removed-picture.wall;picture.minimumVisibleMs=1800-result.probe.maxPaintGapMs-8;
      assert(picture.visibleDurationMs>=picture.minimumVisibleMs,'The continued bell picture completes its 1.8 second life after automatic editing return');
      if(c.mute){assert(strikes[0].wall>result.probe.muted,'Muted test reaches the bell after mute');assert(strikes[0].before.muted&&strikes[0].after.muted);assert.equal(strikes[0].after.voices,0,'Muted continuation adds no audio voice');assert(result.audio.filter(e=>e.wall>result.probe.muted).every(e=>e.after.voices===0),'Mute keeps every later continuation and outcome voice silent');}
    }
    if(c.latePrism){
      assert.equal(Object.values(result.probe.pictures).filter(picture=>picture.node==='A'&&picture.wall>result.probe.completed).length,1,'Continued prism receives its arrival picture');
      assert.equal(result.audio.filter(e=>e.name==='relay'&&e.wall>result.probe.completed).length,1,'Continued prism receives one relay response');
      assert.equal(result.audio.filter(e=>e.name==='strike').length,0,'Bell beyond the continuation bound is not sounded');
    }
    if(c.throwLate){
      assert.equal(result.artErrors.length,1,'The late goal artwork failure was injected once');assert.equal(result.lateArtCalls.length,1,'The failed late arrival is not retried on later animation frames');
      assert.equal(result.audio.filter(e=>e.name==='strike').length,1,'The late bell response is not duplicated when artwork fails');assert.equal(goalPictures.length,0,'The synthetic artwork error happened before its goal picture was created');assert.equal(result.probe.goals,0,'Artwork failure does not change the official cutoff marker');
      assert.equal(result.audio.filter(e=>e.name==='stop'&&e.reason==='ending-error').length,1,'The failed optional continuation stops its sound once');
    }
    if(c.manual&&c.kind==='timeout'){
      assert.equal(goalPictures.length,0,'Manual stop prevents the continued bell picture');
      assert.equal(result.audio.filter(e=>['strike','relay'].includes(e.name)&&e.wall>completionStops[0].wall).length,0,'Manual stop prevents all later arrival responses');
    }
    if(c.kind==='timeout'&&!c.manual&&!c.mute){
      const failure=result.audio.find(e=>e.name==='failure'),cue=result.cues.find(e=>e.source==='failure'),strike=result.audio.filter(e=>e.name==='strike').at(-1);
      assert(failure&&cue,'Failure cue was scheduled exactly once');assert(Math.abs(failure.wall-completionStops[0].wall)<80,'Failure is scheduled at the automatic ending after continued arrivals');
      if(strike&&!c.throwLate&&cue.before.contextState==='running'&&!cue.before.muted)assert(cue.before.contextTime+cue.delay>=strike.before.contextTime+1.5-.002,'Failure cue starts at least 1.5 seconds after the latest bell');
    }
    if(c.kind==='failed')assert.equal(result.cues.filter(e=>e.source==='failure').length,1,'Ordinary failure schedules its existing outcome cue once');
    if(c.naturalAudio){
      const stop=completionStops[0];result.audioEvidence={capabilities:result.audioCapabilities,automaticStop:stop,actualListening:'Not verified by this browser test'};
      if(stop.before.voices>0){
        assert.equal(stop.after.voices,stop.before.voices,'Automatic return preserves active bell and scheduled failure voices');
        await p.waitForFunction(()=>window.endingChime.voices.size===0,null,{timeout:10000});
        result.audioEvidence.naturalEnd=await p.evaluate(()=>({wall:performance.now(),voices:window.endingChime.voices.size,stopCalls:window.endingAudio.filter(e=>e.name==='stop').length}));
        assert.equal(result.audioEvidence.naturalEnd.stopCalls,result.audio.filter(e=>e.name==='stop').length,'The voices finish without any additional stop call');result.audioEvidence.tail='Active voices retained at automatic return and later ended naturally';
      }else{
        assert.notEqual(engine,'chromium','Chromium must exercise live bell and failure voices');
        assert(result.audio.filter(e=>['strike','failure'].includes(e.name)).every(e=>e.before.contextState!=='running'),'Empty voice evidence requires a non-running audio context');
        result.audioEvidence.tail='Not observable: this browser has no running audio context';result.audioEvidence.unverified='Active sound and natural ending are not verified here; visual playback, scheduling calls and stop preservation are checked';
      }
    }
    if(c.desktop){assert(result.probe.fireworks&&result.probe.fireworkRemoved);assert.equal(result.probe.fireworkBursts,5);assert(result.probe.fireworkAnimationBoundMs>1400&&result.probe.fireworkAnimationBoundMs<=1419,'Every firework animation finishes by 1.419 seconds');assert.deepEqual(result.probe.fireworkAnimationEnds,{'firework-rise':5,'firework-ray':120,'firework-star':120},'All five rockets, 120 rays and 120 stars completed naturally');assert(result.probe.toast>=result.probe.fireworkRemoved);}
    await p.screenshot({path:path.join(out,c.name+'-result.png')});
    // A geometry refresh must not replay either the sound or the fireworks.
    const before=result.audio.filter(e=>e.name===sound).length;await p.setViewportSize(c.desktop?{width:1366,height:900}:{width:412,height:892});await p.waitForTimeout(150);
    assert.equal(await p.evaluate(name=>window.endingAudio.filter(e=>e.name===name).length,sound),before);
    assert.equal(await p.locator('.perfect-fireworks').count(),0);
    if(c.naturalAudio){await p.locator('#failure-details').click();await p.locator('#dialog-close').click();assert.equal(await p.evaluate(()=>window.endingAudio.filter(e=>e.name==='failure').length),before,'Opening the same result again does not replay its failure cue');result.resultReopenPassed=true;}
    if(c.next){await p.locator('#clear-next').click();assert.match(await p.locator('#title').textContent(),/^Q2 /);assert.equal(await p.locator('.edge:not(.candidate)').count(),0);result.nextChoicePassed=true;}
    if(c.desktop){const before=await p.locator('.edge:not(.candidate)').evaluateAll(els=>els.map(e=>e.dataset.edge));await p.locator('#clear-again').click();assert.equal(await p.locator('#clear-toast').isVisible(),false);assert.deepEqual(await p.locator('.edge:not(.candidate)').evaluateAll(els=>els.map(e=>e.dataset.edge)),before);assert.equal(await p.locator('#play').isEnabled(),true);result.retryChoicePassed=true;}
    report.cases.push({...c,...result,waitMs:wait,passed:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(c.name+' passed');await context.close();
  }
  report.passed=true;
}catch(e){report.error=e.stack;process.exitCode=1;console.error(report.step,e.stack);}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}})();
