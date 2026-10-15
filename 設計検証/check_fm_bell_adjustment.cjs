// Render only the comparison candidates. Original Koekit files are never written.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const arg=name=>{const at=process.argv.indexOf(name);return at<0?null:process.argv[at+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),root=path.resolve(__dirname,'..'),out=path.join(__dirname,'FM鐘'),channel=arg('--channel')??'chrome';
const reportFile=path.join(out,'report.json');if(fs.existsSync(reportFile)&&JSON.parse(fs.readFileSync(reportFile)).passed===false)fs.copyFileSync(reportFile,path.join(out,'failed-'+Date.now()+'.json'));
const report={checkedAt:new Date().toISOString(),evidence:'Actual Web Audio synthesis in a disposable PC browser. No physical-device or listening acceptance.',checks:[],pending:['Human listening and target-device playback; adoption remains unselected.']};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.wav':'audio/wav'};
const server=http.createServer((req,res)=>{try{let f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(fs.statSync(f).isDirectory())f=path.join(f,'index.html');res.setHeader('Content-Type',types[path.extname(f)]??'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
const check=(label,data)=>{report.checks.push({label,passed:true,...data});console.log(label);};
function wav(samples,rate){const b=Buffer.alloc(44+samples.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples.length*2,40);for(let i=0;i<samples.length;i++)b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+2*i);return b;}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await pw.chromium.launch({headless:true,channel});report.browser={channel,version:browser.version()};
  const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/設計検証/FM鐘/`);
  const data=await page.evaluate(async()=>{
   const {FM_BELL_PRESETS,FM_BELL_TRIAL_VERSION,scheduleFmBell}=await import('./fm-bells.js?v=2026.10.16-1');
   const {Chime,BELL_SOUND,DEFAULT_EFFECT_VOLUME}=await import('../../src/ui/audio.js');
   const rate=48000,rms=(pcm,a,b)=>{let n=0,sum=0;for(let i=Math.round(a*rate);i<Math.round(b*rate);i++){sum+=pcm[i]**2;n++;}return Math.sqrt(sum/n);};
   const render=async({id,reference=false,method=null,count=1,stopAt=null})=>{
    const ctx=new OfflineAudioContext(1,3*rate,rate);Object.defineProperty(ctx,'state',{get:()=> 'running'});
    const output=ctx.createDynamicsCompressor(),master=ctx.createGain();master.gain.value=DEFAULT_EFFECT_VOLUME;output.connect(master);master.connect(ctx.destination);
    const chime=new Chime();chime.context=ctx;chime.output=output;const calls=[];
    const create=ctx.createOscillator.bind(ctx);ctx.createOscillator=()=>{const osc=create(),row={};calls.push(row);const start=osc.start.bind(osc),stop=osc.stop.bind(osc);osc.start=t=>{row.start=t;return start(t);};osc.stop=t=>{row.stop=t;return stop(t);};return osc;};
    const owned=[];if(reference)chime.strike();else for(let i=0;i<count;i++)owned.push(scheduleFmBell(ctx,output,FM_BELL_PRESETS[id],0));
    const bellCalls=calls.length;
    if(method){chime.bellUntil=BELL_SOUND.durationSeconds;chime[method]();}
    if(stopAt!==null){const paused=ctx.suspend(stopAt);const rendering=ctx.startRendering();await paused;for(const voice of owned)voice.stop();await ctx.resume();const pcm=(await rendering).getChannelData(0);return {silent:rms(pcm,stopAt+.1,2.9),calls};}
    const pcm=(await ctx.startRendering()).getChannelData(0);let peak=0,last=0;for(let i=0;i<pcm.length;i++){peak=Math.max(peak,Math.abs(pcm[i]));if(Math.abs(pcm[i])>1e-6)last=i/rate;}
    return {pcm:method?undefined:Array.from(pcm),peak,last,calls,bellCalls,finite:pcm.every(Number.isFinite),attackRms:rms(pcm,.03,.2),lateRms:rms(pcm,1.25,1.35),nearEndRms:rms(pcm,2.45,2.53),silence:rms(pcm,2.7,2.9),failureRms:rms(pcm,1.54,1.67)};
   };
   const rows=[];for(const id of Object.keys(FM_BELL_PRESETS)){
    const solo=await render({id}),failure=await render({id,method:'failure'}),triple=await render({id,method:'failure',count:3}),stopped=await render({id,stopAt:.4});
    const successMixes=[];for(const method of ['clear','perfect'])successMixes.push({method,...await render({id,method})});
    rows.push({id,preset:FM_BELL_PRESETS[id],solo,failure,triple,stopped,successMixes});
   }
   const reference=await render({reference:true});return {version:FM_BELL_TRIAL_VERSION,rate,rows,reference,volume:DEFAULT_EFFECT_VOLUME};
  });
  report.version=data.version;report.volume=data.volume;
  report.measurements=data.rows.map(row=>({id:row.id,solo:{peak:row.solo.peak,last:row.solo.last},mixes:[row.failure,row.triple].map(mix=>({peak:mix.peak,quietRms:mix.lateRms,failureRms:mix.failureRms,ratio:mix.failureRms/mix.lateRms}))}));
  for(const row of data.rows){
   const {solo,failure,triple,stopped}=row;
   assert.equal(solo.bellCalls,2);assert(solo.finite&&solo.peak>0&&solo.peak<1);assert(solo.last<=2.62&&solo.silence===0);assert(solo.attackRms>solo.lateRms*10&&solo.lateRms>solo.nearEndRms*5);assert(solo.attackRms>data.reference.attackRms*.65&&solo.attackRms<data.reference.attackRms*1.45);
   assert(solo.calls.every(c=>c.start===0&&c.stop===2.62));check(row.id+' two-operator bell fades to silence within 2.62s at the existing master volume',{peak:solo.peak,last:solo.last,attackRms:solo.attackRms,lateRms:solo.lateRms});
   for(const [name,mix] of [['single',failure],['three simultaneous',triple]]){const notes=mix.calls.slice(mix.bellCalls);assert.equal(notes.length,2);assert.equal(notes[0].start,1.5);assert(notes.every(c=>c.stop<3));assert(mix.peak<1&&mix.failureRms>mix.lateRms*4,JSON.stringify({id:row.id,name,peak:mix.peak,quietRms:mix.lateRms,failureRms:mix.failureRms}));check(row.id+' '+name+' bell leaves room for both failure notes after 1.5s',{quietRms:mix.lateRms,failureRms:mix.failureRms,peak:mix.peak});}
   assert.equal(stopped.silent,0);check(row.id+' explicit stop cancels both oscillators before their natural end');
   for(const mix of row.successMixes){assert(mix.finite&&mix.peak<1&&mix.silence===0);const notes=mix.calls.slice(mix.bellCalls);assert.equal(notes.length,mix.method==='clear'?4:11);assert(notes.every(note=>note.stop<2.3));check(row.id+' '+mix.method+' mixes with the unchanged result melody without clipping or extending the wait',{peak:mix.peak,notes:notes.length});}
   const b=wav(solo.pcm,data.rate);fs.writeFileSync(path.join(out,row.id+'.wav'),b);row.wav={bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};delete solo.pcm;
  }
  delete data.reference.pcm;report.audio=data;
  for(const [width,height] of [[320,568],[390,844],[844,390]]){await page.setViewportSize({width,height});const box=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));assert(box.scroll<=box.w);check('comparison controls fit width '+width);}
  const media=await page.locator('audio').evaluateAll(async audios=>Promise.all(audios.map(async audio=>{audio.load();await new Promise((resolve,reject)=>{audio.onloadedmetadata=resolve;audio.onerror=reject;});return {duration:audio.duration};})));assert.equal(media.length,3);assert(media.every(row=>row.duration===3));check('all three generated WAVs are readable by the preview player',{media});
  await page.locator('h1').click();const playback=await page.evaluate(async()=>{const [a,b]=document.querySelectorAll('audio');await a.play();a.currentTime=.2;await b.play();const result={oldPaused:a.paused,oldTime:a.currentTime,newPlaying:!b.paused};b.pause();return result;});assert(playback.oldPaused&&playback.oldTime===0&&playback.newPlaying);check('playing another comparison stops and resets the previous sound',playback);
  assert.deepEqual(errors,[]);report.passed=true;console.log('FM bell adjustment checks passed: '+report.checks.length);
 }catch(error){report.passed=false;report.failure=error.stack;throw error;}
 finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser?.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
