// Screenshot Q14 draw 3, real UI and real Web Audio. Optional faults are fixtures.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chooseChallenge,dragConnection}=require('./browser_wait.cjs');
const arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),engine=arg('--engine')||'chromium',root=path.resolve('dist'),out=path.resolve(arg('--out')||`設計検証/鐘の優先-20261026/${engine}`);fs.mkdirSync(out,{recursive:true});
const version=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version,report={version,passed:false,cases:[],boundary:'Real PC browser; phone viewport and touch are emulated. Controlled cleanup failure and audio suspension are fixtures, not identified causes on the reported physical device. No physical-device listening acceptance.'};
const server=http.createServer((req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===root)file=path.join(root,'index.html');assert(file.startsWith(root+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.ttf':'font/ttf','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
let browser;
(async()=>{try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await pw[engine].launch({headless:true});
 for(const name of (arg('--cases')||'normal,cleanup-failure,resume,load-pause').split(',')){
  assert(['normal','cleanup-failure','resume','load-pause'].includes(name));report.step=name;
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{Math.random=()=>.3;localStorage.setItem('prism-notes.motion.v1',JSON.stringify({version:1,value:'full'}));});
  await p.goto(arg('--url')||`http://127.0.0.1:${server.address().port}/`);await p.locator('#board [data-node="S"]').waitFor({state:'attached'});assert.equal(await p.locator('meta[name="prism-version"]').getAttribute('content'),version);
  await p.evaluate(async name=>{
   const base=document.querySelector('script[type=module]').src,{Chime}=await import(new URL('./audio.js',base)),{Session}=await import(new URL('../app/session.js',base));
   const state=window.bellProbe={calls:[],rings:[],samples:[],capable:Boolean(window.AudioContext||window.webkitAudioContext),faultInjected:false,suspended:false};
   let currentBatch=[];
   const attach=chime=>{
    window.priorityChime=chime;if(state.analyser||chime.context?.state!=='running')return;
    const ctx=chime.context,analyser=ctx.createAnalyser(),silent=ctx.createGain();silent.gain.value=0;analyser.fftSize=1024;(chime.bellOutput??chime.output).connect(analyser);analyser.connect(silent);silent.connect(ctx.destination);state.analyser=true;
    const data=new Float32Array(1024);function sample(){analyser.getFloatTimeDomainData(data);const rms=Math.sqrt(data.reduce((n,v)=>n+v*v,0)/data.length);state.samples.push({at:ctx.currentTime,rms,state:ctx.state});if(!state.done)requestAnimationFrame(sample);}requestAnimationFrame(sample);
   };
   const recordRing=(chime,options,operation)=>{const before=new Set(chime.voices);const result=operation();for(const voice of chime.voices)if(!before.has(voice)&&voice.frequencyHz!==undefined)state.rings.push({time:voice.time,endTime:voice.endTime,frequency:voice.frequencyHz});return result;};
   const hasRing=typeof Chime.prototype.ring==='function';if(hasRing){const ring=Chime.prototype.ring;Chime.prototype.ring=function(...args){
    const ctx=this.context,create=ctx.createOscillator;
    if(name==='load-pause'&&!state.faultInjected){state.faultInjected=true;let delayed=false;ctx.createOscillator=function(...params){const node=create.apply(this,params);if(!delayed){delayed=true;const until=performance.now()+140;while(performance.now()<until){/* Controlled slow audio-node allocation. */}}return node;};}
    try{return recordRing(this,args,()=>ring.apply(this,args));}finally{ctx.createOscillator=create;}
   };}
   for(const method of ['strike','relay','tap','wire','perfect','clear','failure','stop']){
    const original=Chime.prototype[method];Chime.prototype[method]=function(...args){attach(this);const call={method,at:this.context?.currentTime??null,state:this.context?.state??null,batch:currentBatch,reason:method==='stop'?args[0]:undefined};state.calls.push(call);
     if(method==='strike'&&name==='cleanup-failure'&&!state.faultInjected&&state.capable){state.faultInjected=true;this.relayVoices.add({stop(){throw new Error('Synthetic stale prism cleanup failure');}});}
     return method==='strike'&&!hasRing?recordRing(this,args,()=>original.apply(this,args)):original.apply(this,args);
    };
   }
   const start=Session.prototype.start;Session.prototype.start=function(...args){window.prioritySession=this;return start.apply(this,args);};
   const advance=Session.prototype.advance;Session.prototype.advance=function(seconds,...args){
    if(name==='resume'&&state.capable&&!state.suspended&&Number(seconds)>=2.2&&window.priorityChime?.context?.state==='running'){state.suspended=true;window.priorityChime.context.suspend();}
    const entries=advance.call(this,seconds,...args);currentBatch=entries.map(({type,node,time})=>({type,node,time}));return entries;
   };
  },name);
  await p.locator('#title-challenges').click();await chooseChallenge(p,'Q14',{pagerTimeout:5000});
  const draw=await p.evaluate(()=>document.getElementById('condition').textContent);assert(draw.includes('出題3'),draw);
  for(const [a,b]of [['S','A'],['A','B'],['B','G'],['A','C'],['C','G'],['A','D'],['D','G']])await dragConnection(p,a,b);
  await p.locator('#play').click();
  if(name==='load-pause'){
   await p.waitForFunction(()=>window.prioritySession?.run?.pauseReason==='load',null,{timeout:7000});
   await p.waitForFunction(()=>window.priorityChime.context.currentTime>=window.bellProbe.rings[0].time+.3,null,{timeout:2000});
   const ringing=await p.evaluate(()=>({active:[...window.priorityChime.voices].filter(v=>v.frequencyHz===440&&v.time===window.bellProbe.rings[0].time).length,tailPeak:Math.max(0,...window.bellProbe.samples.filter(s=>s.at>=window.bellProbe.rings[0].time+.18&&s.at<=window.bellProbe.rings[0].time+.3).map(s=>s.rms))}));
   report.loadPause=ringing;assert.equal(ringing.active,1,'Automatic load pause must not cut the bell that just arrived');assert(ringing.tailPeak>.001,'The paused picture still lets the actual bell sound finish');
   await p.locator('#play').click();
  }
  try{await p.waitForFunction(()=>window.prioritySession?.run?.arrivals('G').length===3&&document.getElementById('play').dataset.state==='stopped',null,{timeout:14000});}
  catch(error){report.partial=await p.evaluate(()=>({probe:window.bellProbe,result:window.prioritySession?.result,pause:window.prioritySession?.run?.pauseReason,message:document.getElementById('result').textContent}));throw error;}
  const result=await p.evaluate(()=>{window.bellProbe.done=true;const chime=window.priorityChime;return {probe:window.bellProbe,result:window.prioritySession.exportResult(),arrivals:window.prioritySession.run.arrivals('G'),priority:chime?.inspectPlayback().bellPriority,independentBellBus:Boolean(chime?.bellOutput&&chime.bellOutput!==chime.output)};});
  assert.deepEqual(result.arrivals.map(e=>e.time),['2.4','3.4','4.4']);
  const requests=result.probe.calls.filter(c=>c.method==='strike');assert.equal(requests.length,3,'Every goal requests one bell');
  assert.equal(result.probe.calls.filter(c=>c.method==='relay'&&c.batch.some(e=>e.type==='goal')).length,0,'A goal batch must never request a prism cue');
  if(result.probe.capable){
   assert(result.independentBellBus,'Bells have an independent compression path');assert.equal(result.probe.rings.length,3,'Every bell actually creates its adopted FM voice');
   result.peaks=result.probe.rings.map(r=>Math.max(0,...result.probe.samples.filter(s=>s.at>=r.time+.015&&s.at<=r.time+.2).map(s=>s.rms)));assert(result.peaks.every(v=>v>.001),'All three bells produce a measurable attack in the actual audio graph: '+result.peaks);
   if(name==='cleanup-failure'){assert(result.probe.faultInjected);assert(result.priority.cleanupFailures>=1);}
   if(name==='resume'){assert(result.probe.suspended);assert.equal(result.priority.resumedBells,1);assert.equal(result.priority.expiredBells,0);}
  }else{assert.equal(name,'normal','Controlled audio cases require a real audio API');result.audioLimitation='This WebKit build has no audio API; actual playback is not verified here.';}
  assert.deepEqual(errors,[]);await p.screenshot({path:path.join(out,name+'.png')});report.cases.push({name,passed:true,...result});console.log(name+' passed');await context.close();
 }report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(report.step,error.stack);}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}})();
