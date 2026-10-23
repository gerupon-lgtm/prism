// Real wall-clock playback. Never substitutes Session.advance or next-event clicks.
// Usage: node 設計検証/check_play_pacing.cjs --playwright-path <playwright-core>
//   [--engine chromium|webkit] [--url https://...] [--stages 9,12,25-30]
//   [--channel chrome|msedge] [--self-check]
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chooseChallenge,dragConnection,waitForAsync}=require('./browser_wait.cjs');
const arg=name=>{const index=process.argv.indexOf(name);return index<0?null:process.argv[index+1];};
const defaults='9,12,15,17,18,20,21,22,24,25-30,32,36,40,42';
function stageNumbers(text){return [...new Set(text.split(',').flatMap(part=>{const match=/^(\d+)(?:-(\d+))?$/.exec(part.trim());assert(match,'Invalid --stages item '+part);const first=Number(match[1]),last=Number(match[2]??first);assert(first>=1&&last<=42&&last>=first,'Invalid stage range '+part);return Array.from({length:last-first+1},(_,i)=>first+i);} ))];}
const stages=stageNumbers(arg('--stages')||defaults),engine=arg('--engine')||'chromium',channel=arg('--channel');
const draw=Number(arg('--draw')||1);assert(Number.isInteger(draw)&&draw>=1&&draw<=8,'--draw must be 1-8');
const layout=arg('--layout')||'phone';assert(['phone','desktop'].includes(layout));
const root=path.resolve('dist'),proofFiles=['ランダム課題/generation.json','星への帰還/proof.json','月鏡の静殿/proof.json','星刻の開廊/proof.json'];
const proofRows=()=>proofFiles.flatMap(file=>JSON.parse(fs.readFileSync(path.join(__dirname,file),'utf8')).stages);
const source=file=>fs.readFileSync(path.resolve(file),'utf8');
function selfCheck(){
  const html=source('index.html'),board=source('src/ui/board.js'),app=source('src/ui/app.js');
  for(const id of ['app','play','result','board','clear-toast','failure-toast','sound','menu'])assert(html.includes(`id="${id}"`),id+' DOM contract');
  for(const token of ['light-particle','data-arrival-key','data-arrival-node','arrivalCount'])assert(board.includes(token),'Board contract '+token);
  for(const token of ["dataset.state=",'inspectPerformance','inspectAudioPlayback','実行結果を書き出す'])assert(app.includes(token),'App contract '+token);
  assert(app.includes('new MotionPreference(storage,document.documentElement,'),'Motion setting is on the html root');
  const proofs=proofRows();assert(proofs.length);assert.equal(new Set(stages).size,stages.length);
  console.log(JSON.stringify({passed:true,mode:'static DOM/source/proof shape only; browser not started',stages,proofRows:proofs.length}));
}
if(process.argv.includes('--self-check')){selfCheck();return;}

process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
assert(arg('--playwright-path'),'--playwright-path is required');
const pw=require(arg('--playwright-path')),info=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'),'utf8'));
const output=path.resolve(arg('--out')||path.join('設計検証/終了到達演出-20261024/playback',info.version,arg('--url')?new URL(arg('--url')).hostname:'local',channel||engine));
fs.mkdirSync(output,{recursive:true});
const reportFile=path.join(output,'report.json');
if(fs.existsSync(reportFile))fs.copyFileSync(reportFile,path.join(output,`previous-${Date.now()}.json`));
const report={version:info.version,passed:false,method:'Real play click and animation-frame clock; read-only DOM observers; actual UI result export',cases:[],pending:['Physical phones, actual sound quality, subjective difficulty']};
const server=http.createServer((req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===root)file=path.join(root,'index.html');if(!file.startsWith(root+path.sep))throw Error('Outside dist');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.ttf':'font/ttf','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
const settle=p=>p.evaluate(async()=>{await document.fonts.ready;for(let i=0;i<3;i++)await new Promise(requestAnimationFrame);});
async function enter(p,id){await p.locator('#title-challenges').click();await chooseChallenge(p,id,{pagerTimeout:5000});if(await p.locator('#mirror-intro-start').isVisible())await p.locator('#mirror-intro-start').click();await settle(p);}
async function goodPhase(p,c,proof){
  const node=c.nodes.find(n=>n.gate);if(!node)return;
  const period=Number(node.gate.period),delta=Number(proof.delta??0),steps=Math.round(period*10);
  const optimal=new Set(proof.optimalPhases.map(s=>Math.round(((Number(s)-delta+period)%period)*10)%steps));
  const safe=[...optimal].filter(t=>[-2,-1,1,2].every(d=>optimal.has((t+d+steps)%steps)));assert(safe.length,'No safe perfect-start window');
  await waitForAsync(p,({node,safe,period})=>{const el=document.querySelector(`[data-node="${node.id}"]`),match=el?.querySelector('.gate-status')?.textContent.match(/([\d.]+)秒/);if(!match)return false;const phase=(el.classList.contains('gate-open')?Number(node.gate.open):period)-Number(match[1]),offset=Math.round(((phase-Number(node.gate.phase)+period)%period)*10)%Math.round(period*10);return safe.includes(offset);},{node,safe,period},{timeout:20000});
}

// This observer only reads rendered state. Experiment timestamps are later taken
// from the app's normal result download, never inferred from rounded DOM clocks.
async function observePlayback({goalIds,required}){
  const visible=el=>Boolean(el&&!el.hidden&&!el.closest('[hidden]')&&el.getClientRects().length);
  const clock=()=>{const match=document.getElementById('result').textContent.match(/｜([\d.]+)秒/);return match?match[1]:null;};
  const measure=()=>({wall:performance.now(),experimentDisplay:clock()});
  const probe=window.__playPacing={click:null,firstMoving:null,lastRequired:null,completed:null,fireworksStarted:null,fireworksEnded:null,fireworkBursts:0,fireworkAnimationBoundMs:0,fireworkAnimationEnds:{},toastOverFireworks:false,toast:null,editing:null,arrivals:[],pictures:{},counts:{},states:[],missing:[],audioStops:[],audioCalls:[],audioCapabilities:{standard:Boolean(window.AudioContext),webkit:Boolean(window.webkitAudioContext),userAgent:navigator.userAgent},maxPaintGapMs:null};
  const animationEnd=event=>{if(event.target.closest('.perfect-fireworks'))probe.fireworkAnimationEnds[event.animationName]=(probe.fireworkAnimationEnds[event.animationName]??0)+1;};document.body.addEventListener('animationend',animationEnd,true);
  const {Chime}=await import(new URL('./audio.js',document.querySelector('script[type=module]').src)),stop=Chime.prototype.stop;
  const audioState=chime=>({voices:chime.voices.size,muted:chime.muted,hasOutput:Boolean(chime.output),context:chime.context?{state:chime.context.state,currentTime:chime.context.currentTime,sampleRate:chime.context.sampleRate,baseLatency:chime.context.baseLatency??null,outputLatency:chime.context.outputLatency??null}:null});
  Chime.prototype.stop=function(reason,options){const entry={...measure(),reason,options,before:this.voices.size,contextBefore:audioState(this)};const result=stop.call(this,reason,options);entry.after=this.voices.size;entry.contextAfter=audioState(this);probe.audioStops.push(entry);return result;};
  for(const name of ['unlock','strike','perfect','clear','failure']){
    const original=Chime.prototype[name];
    Chime.prototype[name]=function(...args){
      const entry={...measure(),name,before:audioState(this)};probe.audioCalls.push(entry);
      const completed=value=>{entry.after=audioState(this);return value;},failed=error=>{entry.error=String(error?.stack??error);entry.after=audioState(this);throw error;};
      try{const result=original.apply(this,args);return result?.then?result.then(completed,failed):completed(result);}catch(error){return failed(error);}
    };
  }
  let screenshotFrame=null,lastState=null;const pendingShots=new Set();
  const shot=kind=>{pendingShots.add(kind);if(screenshotFrame!==null)return;screenshotFrame=requestAnimationFrame(()=>{screenshotFrame=null;const kinds=[...pendingShots];pendingShots.clear();for(const name of kinds)window.__pacingScreenshot({kind:name,wall:performance.now()});});};
  const read=()=>{
    if(!probe.click)return;
    const play=document.getElementById('play'),state=play.dataset.state;
    if(state!==lastState){probe.states.push({...measure(),state,text:play.textContent,disabled:play.disabled});lastState=state;}
    if(!probe.completed&&play.disabled&&play.textContent==='終了')probe.completed=measure();
    const fireworks=visible(document.querySelector('.perfect-fireworks'));
    if(fireworks)probe.fireworkBursts=Math.max(probe.fireworkBursts,document.querySelectorAll('.perfect-fireworks .firework').length);
    if(fireworks&&!probe.fireworksStarted){probe.fireworksStarted=measure();for(const animation of document.querySelector('.perfect-fireworks').getAnimations({subtree:true}))probe.fireworkAnimationBoundMs=Math.max(probe.fireworkAnimationBoundMs,animation.effect.getComputedTiming().endTime);}
    if(!fireworks&&probe.fireworksStarted&&!probe.fireworksEnded)probe.fireworksEnded=measure();
    if(!probe.firstMoving&&visible(document.querySelector('#board .light-particle.moving')))probe.firstMoving=measure();
    let changed=false;
    for(const id of goalIds){const el=document.querySelector(`[data-node="${CSS.escape(id)}"]`);if(!el){probe.missing.push('goal '+id);continue;}const value=el.getAttribute('data-arrival-count');if(value===null){if(probe.firstMoving)probe.missing.push('arrival-count '+id);continue;}const count=Number(value),previous=probe.counts[id]??0;if(count>previous){probe.arrivals.push({...measure(),goal:id,count,delta:count-previous});changed=true;}probe.counts[id]=count;}
    if(!probe.lastRequired&&goalIds.every(id=>(probe.counts[id]??0)>=required)){probe.lastRequired=measure();shot('last-required');}
    const present=new Set();
    for(const el of document.querySelectorAll('#board [data-arrival-key][data-arrival-node]')){
      if(!goalIds.includes(el.dataset.arrivalNode)||!visible(el))continue;
      const key=el.dataset.arrivalKey;present.add(key);
      if(!probe.pictures[key])probe.pictures[key]={...measure(),goal:el.dataset.arrivalNode,visible:true,removed:null};
    }
    for(const [key,picture] of Object.entries(probe.pictures))if(!present.has(key)&&picture.removed===null)picture.removed=performance.now();
    if(changed)shot('last-bell');
    const clear=document.getElementById('clear-toast'),failure=document.getElementById('failure-toast');
    if(!probe.toast&&(visible(clear)||visible(failure))){probe.toast={...measure(),kind:visible(clear)?'achieved':'failed',text:(visible(clear)?clear:failure).textContent};shot('result');}
    if(fireworks&&(visible(clear)||visible(failure)))probe.toastOverFireworks=true;
    if(!probe.editing&&state==='stopped'&&!play.disabled&&play.textContent==='鐘を鳴らす')probe.editing={...measure(),result:document.getElementById('result').textContent};
  };
  const observer=new MutationObserver(read);observer.observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});
  let previousPaint=null,paintFrame=null;
  const paint=now=>{if(probe.click){if(previousPaint!==null)probe.maxPaintGapMs=Math.max(probe.maxPaintGapMs??0,now-previousPaint);previousPaint=now;}paintFrame=requestAnimationFrame(paint);};paintFrame=requestAnimationFrame(paint);
  document.getElementById('play').addEventListener('click',()=>{if(!probe.click)probe.click=measure();read();},{capture:true});
  probe.disconnect=()=>{observer.disconnect();cancelAnimationFrame(paintFrame);document.body.removeEventListener('animationend',animationEnd,true);};
}

async function resultDownload(p,file){
  await p.locator('#menu').click();
  const pending=p.waitForEvent('download');await p.getByRole('button',{name:'実行結果を書き出す',exact:true}).click();
  const download=await pending;await download.saveAs(file);assert.equal(await download.failure(),null,'Result download completed');
  return JSON.parse(fs.readFileSync(file,'utf8'));
}
function boundFor(proof,kind){
  const value=kind==='failed'?proof.failedMaximum??proof.pacing?.maxFailedRun??proof.execution?.failed?.maxDuration??proof.maxDuration:proof.clearMaximum??proof.pacing?.maxClearRun??proof.execution?.[kind==='winner'?'perfect':'partial']?.maxDuration??proof.maxDuration;
  assert(value!==undefined&&Number.isFinite(Number(value)),'Proof lacks playback bound');return Number(value);
}
let browser,activePage;
(async()=>{try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=arg('--url')||`http://127.0.0.1:${server.address().port}/`;report.url=url;
  browser=await pw[engine].launch({headless:true,...(channel?{channel}:{})});report.browser={engine,channel,version:browser.version()};
  const proofs=proofRows();let catalogue;
  // A separate context keeps every measured case at its first fixed draw.
  const inventory=await browser.newContext();const inventoryPage=await inventory.newPage();await inventoryPage.goto(url);await inventoryPage.locator('#board [data-node="S"]').waitFor();
  catalogue=await inventoryPage.evaluate(async()=>{const {challenges}=await import(new URL('../content/challenges.js',document.querySelector('script[type=module]').src));return challenges;});await inventory.close();assert.equal(catalogue.length,42);
  const cases=stages.flatMap(number=>[{number,kind:'winner'},...(!process.argv.includes('--only-winner')&&[17,25,29,42].includes(number)?[{number,kind:'partial'}]:[]),...(!process.argv.includes('--only-winner')&&number===26?[{number,kind:'failed'}]:[])]);
  for(const scenario of cases){
    const c=catalogue.find(item=>item.number===scenario.number);assert(c,'Unknown stage');const label=`Q${c.number}-${scenario.kind}`;report.step=label;
    const context=await browser.newContext({viewport:layout==='desktop'?{width:1440,height:960}:{width:390,height:844},isMobile:layout==='phone',hasTouch:layout==='phone',reducedMotion:'no-preference',acceptDownloads:true});
    const p=activePage=await context.newPage(),errors=[],screenshots=[];let captureChain=Promise.resolve();
    p.on('pageerror',error=>errors.push(error.message));p.setDefaultTimeout(10000);p.setDefaultNavigationTimeout(30000);
    await p.addInitScript(draw=>{Math.random=()=>(draw-1)/8;localStorage.setItem('prism-notes.motion.v1',JSON.stringify({version:1,value:'full'}));},draw);
    await p.goto(url);await enter(p,c.id);assert.equal(await p.locator('html').getAttribute('data-motion'),'full','Normal motion enabled');assert.equal(await p.locator('#sound').getAttribute('aria-pressed'),'true','Default audio remains enabled');
    const problemId=await p.locator('#app').getAttribute('data-problem-id'),proof=proofs.find(row=>row.id===problemId)??(c.number<=6?{winner:require('./challenge_fixtures.cjs')[c.id],maxDuration:c.maxDuration}:null);assert(proof,label+' matching proof');
    const edges=scenario.kind==='winner'?proof.winner:scenario.kind==='partial'?proof.partial?.edges:proof.failedExample?.edges;assert(Array.isArray(edges)&&edges.length,label+' proof wiring');
    for(const id of edges){const edge=c.candidates.find(item=>item.id===id);assert(edge,label+' edge '+id);await dragConnection(p,edge.from,edge.to);}
    if(await p.locator('#mirror-controls').isVisible())await p.locator('#mirror-done').click();
    assert.deepEqual((await p.locator('.edge:not(.candidate)').evaluateAll(els=>els.map(el=>el.dataset.edge))).sort(),[...edges].sort(),label+' actual wires');
    const goalIds=c.goals??[c.goal],required=['interval','return-pattern'].includes(c.type)?c.count:1;
    await p.exposeFunction('__pacingScreenshot',data=>{captureChain=captureChain.then(async()=>{if(p.isClosed())return;const file=path.join(output,`${label}-${data.kind==='result'?'result':'last-bell'}.png`);await p.screenshot({path:file,animations:'allow'});screenshots.push({...data,file});}).catch(error=>errors.push('Screenshot: '+error.message));});
    await p.evaluate(observePlayback,{goalIds,required});await goodPhase(p,c,proof);
    await p.locator('#play').click();
    await p.waitForFunction(()=>window.__playPacing.editing!==null,null,{timeout:60000});
    // Editing now resumes at 1.5 s, while the last bell picture keeps its full
    // 1.8 s lifetime. Keep observing that natural ending before disconnecting.
    await p.waitForFunction(()=>Object.values(window.__playPacing.pictures).every(picture=>picture.removed!==null),null,{timeout:3000});await captureChain;
    const probe=await p.evaluate(()=>{const result=window.__playPacing;result.disconnect();const {disconnect,...copy}=result;return copy;});
    const exported=await resultDownload(p,path.join(output,label+'-result.json'));
    const run=exported.evaluation,goalRecords=exported.records.filter(row=>row.type==='goal'),bound=boundFor(proof,scenario.kind);
    assert(probe.click&&probe.firstMoving&&probe.toast&&probe.editing,label+' all required wall measurements present');
    if(scenario.kind!=='failed')assert(probe.lastRequired,label+' last required bell measured');
    assert.equal(probe.missing.length,0,label+' DOM observation fields');assert.deepEqual(errors,[],label+' no page errors');
    assert.equal(probe.toast.kind,scenario.kind==='failed'?'failed':'achieved');assert.equal(run.state,scenario.kind==='failed'?'failed':'achieved');
    if(scenario.kind==='winner')assert.equal(BigInt(run.score.numerator),100n*BigInt(run.score.denominator),label+' perfect');
    if(scenario.kind==='partial')assert(BigInt(run.score.numerator)<100n*BigInt(run.score.denominator),label+' partial');
    const lastRecordedExperimentTime=Math.max(...exported.records.map(row=>Number(row.time)));
    assert(lastRecordedExperimentTime<=bound,label+' all exact experiment events within complete proof bound');
    assert(probe.maxPaintGapMs!==null,label+' actual rendering interval measured');
    // The core's normal frame advance can leave clock slightly past its last
    // event; retain that raw value and allow only the measured frame interval.
    assert(Number(exported.elapsed)<=bound+probe.maxPaintGapMs/1000+.001,label+' clock ends within proof bound plus measured frame interval');assert(!run.timeLimitReached,label+' ends without safety cutoff');
    assert(probe.completed,label+' completion before editing');
    const endingWait=1500,observedWait=probe.toast.wall-probe.completed.wall;
    assert(observedWait>=endingWait-80,label+' common 1.5 second result wait retained');
    assert(observedWait<=endingWait+Math.max(250,probe.maxPaintGapMs*2),label+' result does not retain the previous longer wait');
    assert(!probe.toastOverFireworks,label+' result does not cover fireworks');
    if(scenario.kind==='winner'){
      assert(probe.fireworksStarted&&probe.fireworksEnded,label+' perfect celebration was actually rendered');
      assert.equal(probe.fireworkBursts,5,label+' all five compact firework bursts retained');
      assert(probe.fireworksEnded.wall-probe.fireworksStarted.wall>=1500-probe.maxPaintGapMs-20,label+' full compact firework lifetime');
      assert(probe.fireworkAnimationBoundMs>1400&&probe.fireworkAnimationBoundMs<=1419,label+' complete firework animation fits within 1.419 seconds');
      assert.deepEqual(probe.fireworkAnimationEnds,{'firework-rise':5,'firework-ray':120,'firework-star':120},label+' every rocket, ray and star finished before removal');
      assert(probe.toast.wall>=probe.fireworksEnded.wall,label+' result follows fireworks');
    }
    assert(goalRecords.length,label+' actual bell records');
    for(const id of goalIds){const count=goalRecords.filter(row=>row.node===id).length;assert.equal(probe.counts[id]??0,count,label+' rendered arrival count '+id);}
    for(const row of goalRecords){const key=`${row.particle}:${row.node}:${row.time}`;assert(probe.pictures[key],label+' actual arrival picture '+key);}
    const last=goalRecords.at(-1),lastPicture=probe.pictures[`${last.particle}:${last.node}:${last.time}`];
    const automaticStop=probe.audioStops.filter(entry=>entry.reason==='completed');
    assert.equal(automaticStop.length,1,label+' one automatic ending');
    assert.equal(automaticStop[0].options?.preserveTail,true,label+' natural bell and result sound tails survive automatic editing return');
    assert.equal(automaticStop[0].options?.preserveTap,true,label+' tap sound remains independent');
    assert.equal(automaticStop[0].after,automaticStop[0].before,label+' automatic editing return does not remove an existing voice');
    const audioEvidence={automaticStop:automaticStop[0],capabilities:probe.audioCapabilities,scheduling:probe.audioCalls.filter(call=>call.name!=='unlock'),unlockAttempts:probe.audioCalls.filter(call=>call.name==='unlock'),actualListening:'Not verified by this browser test'};
    if(automaticStop[0].before>0)audioEvidence.tail='Active scheduled voices remain after automatic editing return';
    else {
      assert.notEqual(engine,'chromium',label+' Chromium must exercise active audio voices');
      assert(audioEvidence.scheduling.length>0,label+' missing audio scheduling observations');
      assert(audioEvidence.scheduling.every(call=>call.before.context?.state!=='running'&&!call.error),label+' empty voices require a verified non-running audio context; otherwise investigate');
      audioEvidence.tail='Not observable: headless browser has no running audio context at any arrival or result-sound call';
      audioEvidence.unverified='Active sound and its natural ending are not verified in this browser run; visual playback and the automatic stop preserving existing voices are checked';
    }
    // Board.arrivals() starts the 1800 ms lifetime before building/rendering its
    // SVG. Our first visible DOM sample is later, after that frame's work. Keep
    // the implementation lifetime distinct from the observed visible duration:
    // allow one measured paint gap, plus 8 ms for observer/timer sampling only.
    lastPicture.visibleDurationMs=lastPicture.removed===null?null:lastPicture.removed-lastPicture.wall;
    lastPicture.implementationLifetimeMs=1800;
    lastPicture.minimumObservedVisibleMs=1800-probe.maxPaintGapMs-8;
    assert(lastPicture.visibleDurationMs!==null&&lastPicture.visibleDurationMs>=lastPicture.minimumObservedVisibleMs,label+' final arrival picture duration retained');
    assert(screenshots.some(item=>item.kind==='result')&&screenshots.some(item=>item.kind!=='result'),label+' result and last-bell screenshots');
    const entry={...scenario,challenge:c.id,draw:problemId,proofBoundSeconds:bound,audioEvidence,experiment:{elapsed:exported.elapsed,lastRecordedExperimentTime,clockPastProofSeconds:Math.max(0,Number(exported.elapsed)-bound),evaluation:run,arrivals:goalRecords.map(({time,node,particle})=>({time,node,particle})),sameTimestampGroups:Object.entries(Object.groupBy(goalRecords,row=>row.time)).map(([time,rows])=>({time,count:rows.length,goals:rows.map(row=>row.node)}))},wall:probe,screenshots,passed:true};
    report.cases.push(entry);fs.writeFileSync(reportFile,JSON.stringify(report,null,2));console.log(label+' real playback passed');await context.close();
  }
  report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(report.step,error.stack);if(activePage&&!activePage.isClosed()){await activePage.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});report.failure=await activePage.evaluate(()=>({probe:window.__playPacing,result:document.getElementById('result')?.textContent,play:document.getElementById('play')?.outerHTML})).catch(()=>null);}}
finally{fs.writeFileSync(reportFile,JSON.stringify(report,null,2));await browser?.close();await new Promise(resolve=>server.close(resolve));}})();
