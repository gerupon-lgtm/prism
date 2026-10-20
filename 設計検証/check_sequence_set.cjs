// Actual UI gestures and native audio. Phone geometry is emulated, not device acceptance.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chooseChallenge,selectChallenge,dragConnection,startAndPause}=require('./browser_wait.cjs');
const arg=n=>{const at=process.argv.indexOf(n);return at<0?null:process.argv[at+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),root=path.resolve(__dirname,'../dist'),engine=arg('--engine')||'chromium',channel=arg('--channel'),version=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version;
const offline=process.argv.includes('--offline');
const out=path.join(__dirname,'鐘の順番',version,arg('--url')?new URL(arg('--url')).hostname:offline?'offline':'local',channel||engine);fs.mkdirSync(out,{recursive:true});
const reportFile=path.join(out,'report.json');if(fs.existsSync(reportFile)&&JSON.parse(fs.readFileSync(reportFile)).passed===false)fs.copyFileSync(reportFile,path.join(out,'failed-'+Date.now()+'.json'));
const report={version,passed:false,checks:[],pending:['Physical phones, speaker listening and difficulty playtesting.']},check=(label,data={})=>{report.checks.push({label,passed:true,...data});console.log(label);};
const proof=JSON.parse(fs.readFileSync(path.join(__dirname,'ランダム課題/generation.json')));
const server=http.createServer((req,res)=>{try{let f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(f===root)f=path.join(root,'index.html');if(!f.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.ttf':'font/ttf'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
async function settle(p){await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#board image')].map(async e=>{const i=new Image();i.src=e.getAttribute('href');await i.decode();}));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});}
async function enterApp(p){await p.locator('#title-challenges').click();await chooseChallenge(p,'Q1');}
async function readableSequence(p,label){
 const r=await p.evaluate(()=>{const e=document.getElementById('challenge-goal'),box=e.getBoundingClientRect();return {condition:e.textContent,w:e.clientWidth,sw:e.scrollWidth,h:e.clientHeight,sh:e.scrollHeight,box:{x:box.x,y:box.y,right:box.right,bottom:box.bottom},missing:[...document.querySelectorAll('#board [data-edge]')].filter(e=>!e.querySelector('.edge-direction')).map(e=>e.dataset.edge)};});
 assert(r.sw<=r.w+1&&r.sh<=r.h+1,label+' whole condition visible');assert(!/G\d/.test(r.condition),label+' player-facing bell names');assert(!r.condition.includes('約'),label+' exact timing wording');assert.deepEqual(r.missing,[],label+' each candidate direction visible');check(label,r);
}
async function finishTrial(p){await startAndPause(p);await p.evaluate(async()=>{for(let i=0;i<512&&!document.getElementById('next').disabled;i++){document.getElementById('next').click();await new Promise(requestAnimationFrame);}});}
async function findRuleText(p,pattern){
 for(let i=0;i<30;i++){await settle(p);if(pattern.test(await p.locator('#dialog-body').innerText())){check('Enlarged conditions retain first-arrival rule via paging');return;}const next=p.locator('#dialog-body .pager button').last();assert(!await next.isDisabled(),'Rule missing from condition pages');await next.click();}
 throw Error('Rule text not found');
}
async function fitted(p,label){const r=await p.evaluate(()=>{const stage=document.getElementById('stage').getBoundingClientRect();return{w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,parts:[...document.querySelectorAll('#board .node-hit')].map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};}),stage:{x:stage.x,y:stage.y,right:stage.right,bottom:stage.bottom}};});assert(r.sw<=r.w+1&&r.sh<=r.h+1,label+' no page scroll');for(const n of r.parts){assert(n.x>=r.stage.x-1&&n.y>=r.stage.y-1&&n.right<=r.stage.right+1&&n.bottom<=r.stage.bottom+1,label+' part hit area in stage '+JSON.stringify({n,stage:r.stage}));}check(label,r);}
async function exported(p){await p.locator('#menu').click();const pending=p.waitForEvent('download');await p.getByRole('button',{name:'実行結果を書き出す',exact:true}).click();const stream=await(await pending).createReadStream(),chunks=[];for await(const c of stream)chunks.push(c);await p.locator('#dialog-close').click();return JSON.parse(Buffer.concat(chunks).toString());}
async function nativeSound(p){
 const audition=path.join(__dirname,'鐘の音程試作-20261018'),samples=[];
 for(const [revision,ids] of [['v0.2.0',['D2']],['v0.3.0',['H3a','H3b','H4a']]]){
  const rows=JSON.parse(fs.readFileSync(path.join(audition,revision,'verification.json'))).samples;
  for(const row of rows.filter(r=>ids.includes(r.id)))samples.push({...row,wav:fs.readFileSync(path.join(audition,revision,row.file)).toString('base64')});
 }
 const result=await p.evaluate(async samples=>{
  if(!window.OfflineAudioContext)return{unavailable:true};
  const {bellVoice}=await import(new URL('./voices.js',document.querySelector('script[type=module]').src)),rows=[];
  for(const sample of samples){
   const buffer=Uint8Array.from(atob(sample.wav),c=>c.charCodeAt(0)),view=new DataView(buffer.buffer),length=(buffer.length-44)/2,ctx=new OfflineAudioContext(1,length,48000),compressor=ctx.createDynamicsCompressor(),master=ctx.createGain();master.gain.value=.7;compressor.connect(master);master.connect(ctx.destination);
   for(const note of sample.notes)bellVoice(ctx,compressor,{time:.2+note.at,frequencyHz:note.frequencyHz});
   const pcm=(await ctx.startRendering()).getChannelData(0);let maxIntegerDifference=0,peak=0,tailPeak=0;
   for(let i=0;i<pcm.length;i++){peak=Math.max(peak,Math.abs(pcm[i]));maxIntegerDifference=Math.max(maxIntegerDifference,Math.abs(Math.round(pcm[i]*32767)-view.getInt16(44+i*2,true)));if(i>=pcm.length-4800)tailPeak=Math.max(tailPeak,Math.abs(pcm[i]));}
   rows.push({id:sample.id,maxIntegerDifference,peak,tailPeak});
  }
  return{rows};
 },samples);
 if(result.unavailable){report.pending.push('OfflineAudioContext not available in '+(channel||engine));return;}
 for(const row of result.rows){assert(row.maxIntegerDifference<=1,'Adopted audition PCM parity '+JSON.stringify(row));assert(row.peak>.01&&row.peak<.98&&row.tailPeak===0);check('native bell synthesis matches adopted '+row.id+' within one 16-bit step',row);}
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await pw[engine].launch({headless:true,...(channel?{channel}:{})});report.browser={engine,channel,version:browser.version()};
 for(const scenario of [{name:'phone',width:390,height:844,mobile:true},...(!offline?[{name:'desktop',width:1600,height:1000}]:[])]){
  const context=await browser.newContext({viewport:{width:scenario.width,height:scenario.height},isMobile:!!scenario.mobile,hasTouch:!!scenario.mobile});
  try{
   await context.addInitScript(()=>{Math.random=()=>0;window.__direction={type:'portrait-primary',angle:0};const o=new EventTarget();Object.defineProperties(o,{type:{get:()=>__direction.type},angle:{get:()=>__direction.angle}});Object.defineProperty(screen,'orientation',{get:()=>o});});let p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
   const url=arg('--url')||`http://127.0.0.1:${server.address().port}/`;
   await p.goto(url);await enterApp(p);await settle(p);
   if(offline){
    const {waitForAsync}=require('./browser_wait.cjs');await waitForAsync(p,async()=>{if(!navigator.serviceWorker.controller)return false;const cache=await caches.open('prism-notes:/:'+document.querySelector('meta[name=prism-version]').content),r=await cache.match(new URL('build-info.json',location.href));if(!r)return false;const info=await r.json();return(await Promise.all(info.assets.map(a=>cache.match(new URL(a,location.href))))).every(Boolean);},{},{timeout:30000});
    await new Promise(r=>server.close(r));await p.close();const cached=await context.newPage();p=cached;p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await enterApp(p);await settle(p);check('Fresh tab starts with origin stopped and all prepared assets cached');
   }
   if(scenario.mobile)await nativeSound(p);
   await p.evaluate(async()=>{const {Chime}=await import(new URL('./audio.js',document.querySelector('script[type=module]').src)),strike=Chime.prototype.strike;window.__strikes=[];Chime.prototype.strike=function(options){window.__strikes.push(options?.frequencyHz??440);return strike.call(this,options);};});
   const catalogue=await p.evaluate(async()=>{const {challenges}=await import(new URL('../content/challenges.js',document.querySelector('script[type=module]').src));return challenges;});assert.equal(catalogue.length,24);
   for(const c of catalogue){await selectChallenge(p,c.id);await settle(p);assert((await p.locator('#title').textContent()).startsWith('Q'+c.number+' '));await fitted(p,scenario.name+' Q'+c.number+' layout');if(c.number>6)assert.equal(await p.locator('.scene').getAttribute('data-scene'),c.world);if(c.number>=19){await readableSequence(p,scenario.name+' Q'+c.number+' conditions and arrows');await p.screenshot({path:path.join(out,scenario.name+'-Q'+c.number+'.png')});}}
   if(scenario.mobile){for(const angle of [90,270,0]){await p.setViewportSize(angle?{width:844,height:390}:{width:390,height:844});await p.evaluate(angle=>{__direction.angle=angle;__direction.type=angle?'landscape-primary':'portrait-primary';screen.orientation.dispatchEvent(new Event('change'));window.dispatchEvent(new Event('orientationchange'));},angle);await settle(p);await fitted(p,'Q24 rotation '+angle);await p.screenshot({path:path.join(out,'phone-Q24-'+angle+'.png')});}await p.evaluate(()=>document.documentElement.style.fontSize='28px');await settle(p);await fitted(p,'Q24 enlarged text');await p.locator('#challenge-info').click();await findRuleText(p,/最初の1回/);await p.locator('#dialog-close').click();await p.evaluate(()=>document.documentElement.style.fontSize='');await settle(p);}
   // Every practical graph is wired by real pointer gestures, never a session mutation.
   if(scenario.mobile)for(const {id} of catalogue.slice(offline?18:6)){
    await selectChallenge(p,id);const c=catalogue.find(c=>c.id===id),draw=await p.locator('#app').getAttribute('data-problem-id'),solution=proof.stages.find(row=>row.id===draw);assert(solution);
    for(const edgeId of solution.winner){const edge=c.candidates.find(e=>e.id===edgeId);await dragConnection(p,edge.from,edge.to);}
    assert.equal(await p.locator('.edge:not(.candidate)').count(),solution.winner.length);
    await p.evaluate(()=>window.__strikes=[]);await finishTrial(p);
    await p.locator('#clear-toast').waitFor({state:'visible',timeout:6000});assert((await p.locator('#clear-score').textContent()).includes('100.00'));
    if(await p.locator('#stop').isEnabled())await p.locator('#stop').click();const file=await exported(p);assert.equal(file.challenge.id,id);assert.equal(file.challenge.number,c.number);assert.equal(file.evaluation.evaluatedTime,solution.baseline);assert.equal(file.challenge.draw.id,draw);if(c.type==='bell-sequence'&&c.intervals)assert.deepEqual(file.evaluation.gaps,c.intervals,'Every full-score interval is exact');
    const audio=await p.evaluate(async file=>{const entry=document.querySelector('script[type=module]').src,{arrivalFrequencies}=await import(new URL('../content/bell-pitches.js',entry)),{TimeScale}=await import(new URL('../core/time.js',entry)),rows=file.records.filter(r=>r.type==='goal'),scale=new TimeScale(file.records.map(r=>r.time)),plan=arrivalFrequencies(file.challenge,rows,scale);return{actual:window.__strikes,expected:rows.map(r=>plan.get(r))};},file);assert.deepEqual(audio.actual,audio.expected,'Actual goal hooks use the run pitch plan');
    await p.locator('#clear-again').click();assert.equal(await p.locator('#app').getAttribute('data-problem-id'),draw);await p.locator('#clear-wires').click();assert.equal(await p.locator('.edge:not(.candidate)').count(),0);check('Q'+c.number+' pointer wiring, 100 points, actual pitch dispatch, export, retry and clear preserve draw',{id,draw,audio});
    if(c.number>=19){
     for(const edgeId of solution.partial.edges){const edge=c.candidates.find(e=>e.id===edgeId);await dragConnection(p,edge.from,edge.to);}
     await finishTrial(p);await p.locator('#clear-toast').waitFor({state:'visible',timeout:6000});assert(!(await p.locator('#clear-score').textContent()).includes('100.00'));if(await p.locator('#stop').isEnabled())await p.locator('#stop').click();const partial=await exported(p);assert.equal(partial.evaluation.state,'achieved');assert.equal(partial.evaluation.evaluatedTime,solution.partial.time);assert.equal(partial.evaluation.goals.length,c.goals.length);assert.equal(partial.evaluation.gaps.length,c.goals.length-1);if(c.intervals)assert.deepEqual(partial.evaluation.gaps,c.intervals,'Every partial-score interval is exact too');await p.locator('#clear-again').click();await p.locator('#clear-wires').click();check('Q'+c.number+' partial score and per-bell timing survive export',{times:partial.evaluation.goals,gaps:partial.evaluation.gaps});
    }
   }
   if(scenario.mobile){await selectChallenge(p,'Q10');await p.locator('#stage-next').click();await p.waitForFunction(()=>document.getElementById('title').textContent.startsWith('Q19 '));await selectChallenge(p,'Q28');assert(await p.locator('#stage-next').isDisabled());await p.locator('#stage-previous').click();await p.waitForFunction(()=>document.getElementById('title').textContent.startsWith('Q23 '));await p.locator('#condition-info').click();await p.waitForFunction(()=>document.activeElement?.dataset.challenge==='Q27');assert.equal(await p.locator('[aria-current="step"]').getAttribute('data-challenge'),'Q27');await p.locator('#dialog-close').click();check('18 to 19, final24 and selected-play current-row focus');
    await selectChallenge(p,'Q23');for(const [a,b]of [['S','A'],['A','B'],['B','G1']])await dragConnection(p,a,b);await finishTrial(p);await p.locator('#failure-toast').waitFor({state:'visible',timeout:6000});assert.match(await p.locator('#failure-toast').innerText(),/到達なし/);assert.match(await p.locator('#failure-toast').innerText(),/鐘2/);check('Missing bell has non-achieved notice with per-bell arrival results');
   }
   assert.deepEqual(errors,[]);check(scenario.name+' no JavaScript errors');
  }finally{await context.close();}
 }
 report.passed=true;
}catch(error){report.failure=error.stack;console.error(error.stack);process.exitCode=1;}finally{await browser?.close();fs.writeFileSync(reportFile,JSON.stringify(report,null,2));if(server.listening)await new Promise(r=>server.close(r));}
})();
