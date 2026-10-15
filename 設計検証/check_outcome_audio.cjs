// Actual UI routing and Web Audio buffers; never physical-device listening proof.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {enterApp,selectChallenge,dragConnection,startAndPause}=require('./browser_wait.cjs');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),channel=arg('--channel'),root=path.resolve(__dirname,'../dist');
const out=path.join(__dirname,'結果のジングル',arg('--url')?'public':channel||'');fs.mkdirSync(out,{recursive:true});
const file=path.join(out,'report.json');if(fs.existsSync(file)&&JSON.parse(fs.readFileSync(file)).passed===false)fs.copyFileSync(file,path.join(out,'failed-'+Date.now()+'.json'));
const report={version:JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version,evidence:'Actual game UI, actual Web Audio scheduling and OfflineAudioContext where available. Disposable PC browsers, not speaker listening or physical phones.',checks:[],pending:[],browsers:[]};
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.ttf':'font/ttf','.json':'application/json'};
const server=http.createServer((req,res)=>{let f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(f===root)f=path.join(root,'index.html');if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
const check=(label,data={})=>{report.checks.push({label,passed:true,...data});console.log(label);};
async function wire(page,id,route){if(await page.locator('#stop').isEnabled())await page.locator('#stop').click();await selectChallenge(page,id);for(let i=1;i<route.length;i++)await dragConnection(page,route[i-1],route[i]);}
async function finish(page,kind){await page.locator('#play').click();await page.waitForFunction(()=>document.getElementById('play').dataset.state!=='preparing');await page.waitForFunction(kind=>__outcomes.some(c=>c.kind===kind),kind,{timeout:18000});assert(!(await page.locator('#result').textContent()).includes('負荷のため'));}
async function exported(page){await page.locator('#menu').click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'実行結果を書き出す',exact:true}).click();const chunks=[],stream=await(await pending).createReadStream();for await(const c of stream)chunks.push(c);await page.locator('#dialog-close').click();return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
async function offlineAudio(page,label){
 const buffers=await page.evaluate(async()=>{
  if(typeof OfflineAudioContext!=='function')return null;
  const {Chime}=await import(new URL('./audio.js',document.querySelector('script[type=module]').src));
  const results={};for(const method of ['clear','perfect','failure']){
   const context=new OfflineAudioContext(1,3*44100,44100),chime=new Chime(),output=context.createDynamicsCompressor(),master=context.createGain();master.gain.value=.7;output.connect(master);master.connect(context.destination);chime.context=context;chime.output=output;
   // Offline contexts report suspended until rendering starts; scheduling is
   // exercised through the same host API with its running state made explicit.
   chime.context={state:'running',currentTime:0,createOscillator:()=>context.createOscillator(),createGain:()=>context.createGain()};
   chime[method]();const data=(await context.startRendering()).getChannelData(0);let peak=0,early=0,tail=0,energy=0,signature=2166136261;
   for(let i=0;i<data.length;i++){const value=Math.abs(data[i]);peak=Math.max(peak,value);energy+=value;if(i<.4*44100)early=Math.max(early,value);if(i>2.8*44100)tail=Math.max(tail,value);signature=Math.imul(signature^Math.round(data[i]*1e6),16777619)>>>0;}
   results[method]={peak,early,tail,energy,signature};
  }return results;
 });
 if(!buffers){report.pending.push({label,reason:'OfflineAudioContext unavailable; actual target-device listening remains pending.'});return;}
 for(const [kind,b] of Object.entries(buffers)){assert(b.peak>0&&b.peak<.9,kind+' bounded nonzero signal');assert(b.early<.00001&&b.tail<.00001,kind+' no sound before attack delay or after end wait');}
 assert.equal(new Set(Object.values(buffers).map(b=>b.signature)).size,3,'Three distinct actual synthesized signals');assert(buffers.perfect.energy>buffers.clear.energy);assert(buffers.failure.energy<buffers.clear.energy);check(label,{buffers});
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{for(const engine of channel?['chromium']:['chromium','webkit']){
 const browser=await pw[engine].launch({headless:true,...(channel?{channel}:{})});report.browsers.push({engine,channel,version:browser.version()});try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(arg('--url')||`http://127.0.0.1:${server.address().port}/`);await enterApp(page);
 const audio=await page.evaluate(async()=>{window.__outcomes=[];const {Chime}=await import(new URL('./audio.js',document.querySelector('script[type=module]').src));for(const kind of ['clear','perfect','failure']){const original=Chime.prototype[kind];Chime.prototype[kind]=function(){window.__lastChime=this;const before=new Set(this.voices);original.call(this);__outcomes.push({kind,muted:this.muted,state:this.context?.state,added:[...this.voices].filter(v=>!before.has(v)).length});};}return typeof(window.AudioContext??window.webkitAudioContext)==='function';});
 if(!audio)report.pending.push({engine,label:'Real-time audio output',reason:'API unavailable in this Windows engine; Android/iPhone/macOS/iPad listening remains included and unconfirmed.'});
 for(const [id,route,kind,count] of [['Q1',['S','A','G'],'perfect',11],['Q2',['S','C','G'],'clear',4],['Q1',['S','A'],'failure',2]]){
  await wire(page,id,route);await page.evaluate(()=>__outcomes=[]);await finish(page,kind);
  const calls=await page.evaluate(()=>__outcomes);assert.equal(calls.length,1);assert.equal(calls[0].kind,kind);if(audio)assert.equal(calls[0].added,count);
  const before=await exported(page);assert.equal(before.evaluation.state,kind==='failure'?'failed':'achieved');if(kind==='perfect')assert.deepEqual(before.evaluation.score,{numerator:'100',denominator:'1'});if(kind==='clear')assert(Number(before.evaluation.score.numerator)/Number(before.evaluation.score.denominator)<100);
  await page.locator('#records').click();await page.locator('#close-records').click();await page.locator('#fit').click();const after=await exported(page);assert.deepEqual({...after,status:before.status},before);assert.equal(await page.evaluate(()=>__outcomes.length),1);
  check((channel||engine)+' '+kind+' actual result selects one sound, retains full records and never repeats on reopening',{calls});
 }
 await wire(page,'Q7',['S','A','B','D','G1']);await page.evaluate(()=>__outcomes=[]);await startAndPause(page);assert((await page.locator('#result').textContent()).includes('未達成'));assert.equal(await page.evaluate(()=>__outcomes.length),0);await page.locator('#play').click();await page.waitForFunction(()=>__outcomes.length===1,null,{timeout:16000});assert.equal(await page.evaluate(()=>__outcomes[0].kind),'failure');check((channel||engine)+' known failure waits until active light finishes');
 await wire(page,'Q1',['S','A','G']);await page.evaluate(()=>__outcomes=[]);await startAndPause(page);await page.locator('#stop').click();assert.equal(await page.evaluate(()=>__outcomes.length),0);check((channel||engine)+' stopping an unfinished trial does not play a result');
 for(const kind of ['clear','perfect','failure']){
  await page.evaluate(kind=>{const c=__lastChime;c[kind]();c.stop();},kind);assert.equal(await page.evaluate(()=>__lastChime.voices.size),0);
 }check((channel||engine)+' stop cancels every scheduled result voice');
 const muted=await page.evaluate(()=>{const c=__lastChime;c.mute();const before=c.voices.size;for(const k of ['clear','perfect','failure'])c[k]();return {before,after:c.voices.size};});assert.equal(muted.after,muted.before);check((channel||engine)+' muted result sounds schedule no voices');
 await wire(page,'Q1',['S','A','G']);await page.evaluate(()=>__outcomes=[]);await finish(page,'perfect');assert.equal(await page.evaluate(()=>__outcomes[0].added),0);await page.locator('#sound').click();assert.equal(await page.evaluate(()=>__outcomes.length),1);check((channel||engine)+' enabling sound after a muted clear does not replay the result');
 await offlineAudio(page,(channel||engine)+' three actual offline-rendered audio signals');assert.deepEqual(errors,[]);await page.close();
 }finally{await browser.close();}
 }report.passed=true;console.log('Outcome audio checks passed: '+report.checks.length);}catch(e){report.passed=false;report.failure=e.stack;console.error(e.stack);process.exitCode=1;}finally{fs.writeFileSync(file,JSON.stringify(report,null,2));await new Promise(r=>server.close(r));}})();
