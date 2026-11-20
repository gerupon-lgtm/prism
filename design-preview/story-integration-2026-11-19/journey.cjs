// One real continuous play. Uses proof wiring through pointer gestures and the
// normal Play button; never advances Session or substitutes the official clock.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {dragConnection,waitForAsync}=require('../../設計検証/browser_wait.cjs');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require('C:/Users/user/Documents/あとキュー/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];},engine=arg('--engine')||'chrome',url=arg('--url')||'http://127.0.0.1:4173/';
const out=path.join(__dirname,'evidence',arg('--out')||'journey-'+engine+'-local');fs.mkdirSync(out,{recursive:true});
if(fs.existsSync(path.join(out,'report.json')))fs.copyFileSync(path.join(out,'report.json'),path.join(out,'previous-'+Date.now()+'.json'));
const report={url,engine,method:'Actual pointer wiring and real wall-clock Play. First problem draw, normal motion; saved result-card wait set to 0 seconds to exercise natural-tail waits. No clock substitution.',stages:[],blocks:[],loadPauses:[],errors:[]};
const proofs=['ランダム課題/generation.json','星への帰還/proof.json','月鏡の静殿/proof.json','星刻の開廊/proof.json'].flatMap(name=>JSON.parse(fs.readFileSync(path.join(__dirname,'../../設計検証',name),'utf8')).stages);
const read=p=>p.evaluate(async()=>{const m=await import(document.querySelector('script[type=module]').src);return {story:m.inspectStory(),performance:m.inspectPerformance()};});
const ready=p=>waitForAsync(p,async()=>{const m=await import(document.querySelector('script[type=module]').src);return m.inspectStory().active&&!m.inspectStory().loading;});
async function skipStory(p,block){await ready(p);const state=(await read(p)).story;assert.equal(state.block,block);assert.equal(state.mode,'journey');report.blocks.push({block,index:state.index});await p.locator('#story-chapters').click();const expected={P:7,M1:1,M2:1,B1:2,B2:2,B3:2,B4:2,B5:2,B6:2,E:6}[block];assert.equal(await p.locator('#story-scene-list button').count(),expected);await p.locator('#story-skip').click();assert.equal((await read(p)).story.active,false);}
async function goodPhase(p,c,proof){
 const node=c.nodes.find(n=>n.gate);if(!node)return;
 const period=Number(node.gate.period),delta=Number(proof.delta??0),steps=Math.round(period*10),optimal=new Set(proof.optimalPhases.map(s=>Math.round(((Number(s)-delta+period)%period)*10)%steps));
 const safe=[...optimal].filter(t=>[-2,-1,1,2].every(d=>optimal.has((t+d+steps)%steps)));assert(safe.length);
 await waitForAsync(p,({node,safe,period})=>{const el=document.querySelector(`[data-node="${node.id}"]`),match=el?.querySelector('.gate-status')?.textContent.match(/([\d.]+)秒/);if(!match)return false;const phase=(el.classList.contains('gate-open')?Number(node.gate.open):period)-Number(match[1]),offset=Math.round(((phase-Number(node.gate.phase)+period)%period)*10)%Math.round(period*10);return safe.includes(offset);},{node,safe,period},{timeout:20000});
}
(async()=>{const browser=engine==='webkit'?await pw.webkit.launch({headless:true}):await pw.chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});let p;try{
 p=await browser.newPage({viewport:{width:410,height:844},reducedMotion:'no-preference',acceptDownloads:true});report.browser=browser.version();p.on('pageerror',e=>report.errors.push(e.message));
 await p.addInitScript(()=>{if(location.protocol.startsWith('http')){Math.random=()=>0;localStorage.setItem('prism-notes.motion.v1',JSON.stringify({version:1,value:'full'}));localStorage.setItem('prism-notes.result-timing.v1',JSON.stringify({version:1,clearMs:0,failureMs:1600}));}});
 await p.goto(url);const catalogue=await p.evaluate(async()=>{const m=await import(new URL('../content/challenges.js',document.querySelector('script[type=module]').src));return m.challenges;});assert.equal(catalogue.length,42);
 if(await p.locator('meta[name=prism-offline]').count())await p.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await p.locator('#title-start').click();await skipStory(p,'P');
 const boundaries={4:'M1',6:'M2',7:'B1',13:'B2',19:'B3',25:'B4',31:'B5',37:'B6'};
 for(let i=0;i<42;i++){
  const c=catalogue[i];report.step=i+1;
  if(await p.locator('#mirror-intro-start').isVisible())await p.locator('#mirror-intro-start').click();
  assert.match(await p.locator('#title').textContent(),new RegExp('^Q'+(i+1)+'\\b'));assert.equal((await read(p)).story.journey.stage,i+1);
  const problem=await p.locator('#app').getAttribute('data-problem-id'),proof=proofs.find(row=>row.id===problem)??(i<6?{winner:require('../../設計検証/challenge_fixtures.cjs')[c.id]}:null);assert(proof,'proof for '+c.id+' '+problem);
  for(const id of proof.winner){const edge=c.candidates.find(e=>e.id===id);assert(edge,'edge '+id);await dragConnection(p,edge.from,edge.to);}
  if(await p.locator('#mirror-controls').isVisible())await p.locator('#mirror-done').click();assert.deepEqual((await p.locator('.edge:not(.candidate)').evaluateAll(es=>es.map(e=>e.dataset.edge))).sort(),[...proof.winner].sort());
  await goodPhase(p,c,proof);const start=Date.now();await p.locator('#play').click();
  while(!await p.locator('#clear-toast').isVisible()){
   assert(Date.now()-start<60000,'stage did not clear '+(i+1)+' '+await p.locator('#result').textContent());
   const state=await read(p);if(state.performance.run?.status==='paused'&&state.performance.run.pauseReason==='load'){report.loadPauses.push({stage:i+1,state:state.performance});assert(report.loadPauses.length<5,'repeated host load pauses');await p.locator('#play').click();}
   await p.waitForTimeout(100);
  }
  const state=await read(p),time=await p.locator('#clear-time').textContent(),score=await p.locator('#clear-score').textContent();assert.equal(parseFloat(score),100);
  const row={stage:i+1,id:c.id,problem,time,score,wallMs:Date.now()-start,clock:state.performance.run.clock};report.stages.push(row);
  await p.locator('#clear-next').click();
  if(i===2&&state.story.sound&&state.story.audioState==='running'){
   assert((await read(p)).story.transitionPending,'natural game tail is still playing at the story boundary');assert.equal(await p.locator('#stop').isEnabled(),true);await p.locator('#stop').click();await p.waitForTimeout(3600);const cancelled=await read(p);assert.equal(cancelled.story.active,false);assert.equal(cancelled.story.journey.stage,3);assert.equal(cancelled.performance.run.clock,row.clock);assert.equal(await p.locator('#clear-time').textContent(),time);row.cancelledBoundaryWait=true;await p.locator('#clear-next').click();
  }
  if(i===41){
   await ready(p);assert.equal((await read(p)).story.block,'E');report.blocks.push({block:'E',index:(await read(p)).story.index});assert.equal(await p.locator('#story-next').textContent(),'つづき');
   if(engine==='chrome'){await p.waitForTimeout(600);const ending=(await read(p)).story;assert.equal(ending.bells.length,1);assert(Math.abs(ending.bells[0].hz-1046.502261)<.001);if(ending.sound)await p.locator('#story-sound').click();await ready(p);}
   for(let j=0;j<6;j++){await ready(p);assert.equal((await read(p)).story.index,21+j);if(j===1){assert(await p.locator('#story-music-slot').isVisible());assert.equal((await read(p)).story.voices,0);}await p.locator('#story-next').click();}
   assert.equal((await read(p)).story.active,false);assert.equal((await read(p)).story.journey.cleared,42);assert.equal((await read(p)).story.journey.ended,true);assert(await p.locator('#title-start').isVisible());await p.screenshot({path:path.join(out,'complete.png')});
  }else{
   const block=boundaries[i+2];if(block)await skipStory(p,block);else await waitForAsync(p,async expected=>{const m=await import(document.querySelector('script[type=module]').src);return m.inspectStory().journey.stage===expected&&!m.inspectStory().active;},i+2);
  }
  console.log('Continuous stage '+(i+1)+' cleared: '+time+' / '+score);fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify(report,null,2));
 }
 assert.deepEqual(report.blocks.map(b=>b.block),['P','M1','M2','B1','B2','B3','B4','B5','B6','E']);assert.deepEqual(report.errors,[]);report.passed=true;console.log(JSON.stringify({stages:report.stages.length,blocks:report.blocks.length,loadPauses:report.loadPauses.length,errors:report.errors}));
 }catch(error){report.error=error.stack;if(p){report.failureState=await read(p).catch(()=>null);report.failureUi=await p.evaluate(()=>({next:{disabled:document.querySelector('#clear-next').disabled,hidden:document.querySelector('#clear-toast').hidden},result:document.querySelector('#result').textContent,stop:document.querySelector('#stop').disabled})).catch(()=>null);await p.screenshot({path:path.join(out,'failure.png'),timeout:5000}).catch(()=>{});}throw error;}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
