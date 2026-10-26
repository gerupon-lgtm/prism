// Q15 draw 8. Native audio worklet measures the attack even while main JS stalls.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chooseChallenge,dragConnection}=require('./browser_wait.cjs');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),root=path.resolve('dist'),out=path.resolve(arg('--out')||'設計検証/鐘の出だし-20261026/chromium');fs.mkdirSync(out,{recursive:true});
const report={version:JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version,passed:false,cases:[],boundary:'Actual Chromium audio graph, real Q15 draw 8 UI; injected node-allocation stalls are controlled fixtures, not the identified physical-device cause.'};
const server=http.createServer((req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===root)file=path.join(root,'index.html');assert(file.startsWith(root+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
let browser;
(async()=>{try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await pw.chromium.launch({headless:true});
 for(const name of (arg('--cases')||'normal,delay-body,delay-hit').split(',')){
  report.step=name;const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{Math.random=()=>.99;});
  await p.goto(arg('--url')||`http://127.0.0.1:${server.address().port}/`);assert.equal(await p.locator('meta[name="prism-version"]').getAttribute('content'),report.version);
  await p.evaluate(async name=>{
   const base=document.querySelector('script[type=module]').src,{Chime}=await import(new URL('./audio.js',base)),{Session}=await import(new URL('../app/session.js',base));
   window.attackProbe={rings:[],blocks:[],allocations:[],faultInjected:false};
   for(const method of ['tap','wire']){const original=Chime.prototype[method];Chime.prototype[method]=function(...args){window.attackChime=this;return original.apply(this,args);};}
   const ring=Chime.prototype.ring;Chime.prototype.ring=function(...args){const state=window.attackProbe,before=new Set(this.voices),ctx=this.context,create=ctx.createOscillator;let count=0;
    ctx.createOscillator=function(...params){const node=create.apply(this,params);count++;if(state.rings.length===1&&name!=='normal'&&count===(name==='delay-body'?1:3)){state.faultInjected=true;const until=performance.now()+200;while(performance.now()<until){/* Controlled node allocation delay. */}}
     state.allocations.push({ring:state.rings.length+1,node:count,at:ctx.currentTime});return node;};
    try{const result=ring.apply(this,args);for(const v of this.voices)if(!before.has(v)&&v.frequencyHz!==undefined)state.rings.push({time:v.time,endTime:v.endTime,frequency:v.frequencyHz,createdAt:ctx.currentTime});return result;}finally{ctx.createOscillator=create;}
   };
   const start=Session.prototype.start;Session.prototype.start=function(...args){window.attackSession=this;return start.apply(this,args);};
  },name);
  await p.locator('#title-challenges').click();await chooseChallenge(p,'Q11',{pagerTimeout:5000});assert((await p.locator('#condition').textContent()).includes('出題8'));
  for(const [a,b] of [['S','A'],['A','B'],['B','G'],['B','C'],['C','D'],['D','G']])await dragConnection(p,a,b);
  await p.waitForFunction(()=>window.attackChime?.context?.state==='running');
  await p.evaluate(async()=>{
   const c=window.attackChime,ctx=c.context;
   const source=`class AttackMeter extends AudioWorkletProcessor{constructor(){super();this.rows=[];}process(inputs){const values=inputs.map(channels=>{const a=channels[0];if(!a)return{rms:0,peak:0};let sum=0,peak=0;for(const v of a){sum+=v*v;peak=Math.max(peak,Math.abs(v));}return{rms:Math.sqrt(sum/a.length),peak};});this.rows.push({time:currentTime,raw:values[0],out:values[1]});if(this.rows.length>=16){this.port.postMessage(this.rows);this.rows=[];}return true;}}registerProcessor('attack-meter',AttackMeter);`;
   const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));await ctx.audioWorklet.addModule(url);URL.revokeObjectURL(url);
   const meter=new AudioWorkletNode(ctx,'attack-meter',{numberOfInputs:2,numberOfOutputs:1,outputChannelCount:[1]}),silent=ctx.createGain();silent.gain.value=0;meter.connect(silent);silent.connect(ctx.destination);meter.port.onmessage=e=>window.attackProbe.blocks.push(...e.data);
   const compressed=c.bellOutput,raw=ctx.createGain();raw.gain.value=1;raw.connect(compressed);raw.connect(meter,0,0);compressed.connect(meter,0,1);c.bellOutput=raw;
  });
  await p.locator('#play').click();await p.waitForFunction(()=>window.attackSession?.run?.arrivals('G').length===2&&document.getElementById('play').dataset.state==='stopped',null,{timeout:16000});
  const result=await p.evaluate(()=>({probe:window.attackProbe,arrivals:window.attackSession.run.arrivals('G'),priority:window.attackChime.inspectPlayback().bellPriority,result:window.attackSession.exportResult()}));assert.deepEqual(result.arrivals.map(e=>e.time),['2.6','5.9']);assert.equal(result.probe.rings.length,2);
  result.attacks=result.probe.rings.map(r=>{const rows=result.probe.blocks.filter(b=>b.time>=r.time&&b.time<r.time+.12);return {rawPeak:Math.max(0,...rows.map(b=>b.raw.peak)),outPeak:Math.max(0,...rows.map(b=>b.out.peak))};});result.ratio=result.attacks[1].rawPeak/result.attacks[0].rawPeak;result.outputRatio=result.attacks[1].outPeak/result.attacks[0].outPeak;
  result.probe.blocks=result.probe.blocks.filter(b=>result.probe.rings.some(r=>b.time>=r.time-.02&&b.time<r.time+.35));
  report.cases.push({name,...result});assert(result.ratio>.9,'Second bell retains its attack: '+result.ratio);assert(result.outputRatio>.9,'Second bell output is not reduced: '+result.outputRatio);
  if(name!=='normal')assert(result.probe.faultInjected);assert.deepEqual(errors,[]);await p.screenshot({path:path.join(out,name+'.png')});console.log(name+' passed; raw/output ratio '+result.ratio.toFixed(3)+'/'+result.outputRatio.toFixed(3));await context.close();
 }report.passed=true;
}catch(error){report.error=error.stack;console.error(report.step,error.stack);process.exitCode=1;}finally{await browser?.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}})();
