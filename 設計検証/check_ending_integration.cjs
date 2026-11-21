const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {waitForAsync}=require('./browser_wait.cjs');
const arg=name=>{const at=process.argv.indexOf(name);return at<0?null:process.argv[at+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')||'C:/Users/user/Documents/あとキュー/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core');
const engine=arg('--engine')||'chrome',base=arg('--url')||'http://127.0.0.1:4190/';
const out=path.resolve(arg('--out')||path.join(__dirname,'エンディング組込',engine));fs.mkdirSync(out,{recursive:true});
const report={engine,base,physicalDevice:false,errors:[],checks:[]};
const inspect=p=>p.evaluate(()=>window.__prismInspect());
async function bind(p){await p.evaluate(async()=>{window.__prismInspect=(await import(document.querySelector('script[type=module]').src)).inspectStory;});}
async function ready(p){await p.waitForFunction(()=>window.__prismInspect().ending?.ready,null,{timeout:30000});}
async function choose(p,id){await p.locator('#ending-chapters').click();await p.locator(`#ending-scene-list button[data-scene="${id}"]`).click();await p.waitForFunction(id=>__prismInspect().ending.scene===id,id);await p.locator('#ending-scenery .world:last-child img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));}
(async()=>{const browser=engine==='webkit'?await pw.webkit.launch({headless:true}):await pw.chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--mute-audio']});let p;try{
 const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'no-preference'});
 await context.addInitScript(()=>{if(location.protocol.startsWith('http')){localStorage.setItem('prism-notes.audio-latency.v1',JSON.stringify({version:1,latencyHint:.07}));localStorage.setItem('prism-notes.motion.v1',JSON.stringify({version:1,value:'full'}));}});
 p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));report.browser=browser.version();
 await p.goto(base,{waitUntil:"domcontentloaded",timeout:60000});await bind(p);
 // Do not abort the initial worker-script request with an immediate second
 // navigation. WebKit reports that deliberate cancellation as a page error.
 if(await p.locator('meta[name=prism-offline]').count()){await p.evaluate(async()=>{await navigator.serviceWorker.ready;});await p.waitForFunction(()=>document.querySelector('#title-update').getAttribute('aria-busy')==='false',null,{timeout:120000});}
 const saved=await p.evaluate(()=>['circuits','scores','guides'].map(key=>localStorage.getItem('prism-notes.'+key+'.v1')));
 await p.goto(new URL('?ending=1',base).href,{waitUntil:'domcontentloaded',timeout:60000});await bind(p);await ready(p);
 let state=await inspect(p);assert.equal(state.version,JSON.parse(fs.readFileSync(path.resolve('package.json'),'utf8')).version);assert.equal(state.mode,'viewer');assert.equal(state.journey.cleared,0);assert.equal(state.journey.ended,false);assert.equal(state.ending.scene,'E1');assert.equal(state.latencyHint,.07);
 await p.locator('#ending-next').click();await p.waitForFunction(()=>__prismInspect().ending.time>.25&&__prismInspect().ending.effectiveVolume>.69);
 state=await inspect(p);const webAudio=await p.evaluate(()=>Boolean(window.AudioContext??window.webkitAudioContext));assert.equal(state.ending.sourceConnected,webAudio);assert(Math.abs(state.ending.effectiveVolume-.7)<1e-6);assert.equal(state.voices,0);assert.equal(state.ending.latencyHint,.07);
 report.checks.push({shortcutIsViewer:true,cleared:0,sharedLatencyHint:.07,latencyApplied:webAudio,sharedOutputVolume:.7,outputMode:state.ending.outputMode,uncompressedMasterConnection:webAudio,noAddedEffectVoices:true});
 if(process.argv.includes('--full-song')){
  await p.evaluate(()=>{window.__endingSeen=[__prismInspect().ending.scene];window.__endingWatch=setInterval(()=>{const id=__prismInspect().ending.scene;if(__endingSeen.at(-1)!==id)__endingSeen.push(id);},75);});
  await p.waitForFunction(()=>__prismInspect().ending.scene==='E5',null,{timeout:210000});
  const seen=await p.evaluate(()=>{clearInterval(__endingWatch);return __endingSeen;});assert.deepEqual(seen.filter(id=>id.startsWith('S')),Array.from({length:13},(_,i)=>'S'+String(i+1).padStart(2,'0')));
  assert((await inspect(p)).ending.time>=186.5);report.checks.push({realTimeFullSong:true,all13Scenes:true,naturalEnd:true,seen});
 }
 await p.locator('#ending-sound').click();assert.equal((await inspect(p)).muted,true);assert.equal(await p.locator('#ending-music').evaluate(a=>a.muted),true);
 await p.locator('#ending-sound').click();await p.waitForFunction(()=>__prismInspect().muted===false);assert.equal((await inspect(p)).ending.sound,true);assert.equal((await inspect(p)).voices,0);
 await p.locator('#ending-motion').click();assert.equal((await inspect(p)).ending.reduced,true);await p.locator('#ending-motion').click();
 const ids=await p.evaluate(async()=>{const {ending}=await import(new URL('../content/ending.js',document.querySelector('script[type=module]').src));return ending.song.map(s=>s.id);});
 const sizes=process.argv.includes('--controls-only')?[]:[[1280,800],[1024,768],[844,410],[740,280],[640,240],[410,844],[360,640],[320,568]];
 if(!sizes.length)report.layout='Covered by the separate eight-viewport report; this run rechecks startup, shared settings and playback controls.';
 for(const [width,height] of sizes){
  await p.setViewportSize({width,height});
  for(const id of [...ids,'E5','E6','C1']){
   await choose(p,id);
   const m=await p.evaluate(()=>{const words=document.querySelector('#ending-words'),next=document.querySelector('#ending-next-story');return{page:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],viewport:[innerWidth,innerHeight],words:[words.scrollHeight,words.clientHeight],text:document.querySelector('#ending-narration').textContent,next:next.hidden?'':next.textContent,buttons:[...document.querySelectorAll('#ending-screen .toolbar button,#ending-screen .reader-controls button')].filter(b=>b.getBoundingClientRect().width).map(b=>{const r=b.getBoundingClientRect();return[r.x,r.y,r.width,r.height,r.right,r.bottom];})};});
   assert(m.page[0]<=width+1&&m.page[1]<=height+1,JSON.stringify({id,width,height,m}));assert(m.text.trim());
   assert(m.words[0]<=m.words[1]+2,JSON.stringify({id,width,height,m}));
   assert(m.buttons.every(r=>r[2]>=43.9&&r[3]>=43.9&&r[0]>=-1&&r[4]<=width+1&&r[5]<=height+1),JSON.stringify({id,width,height,buttons:m.buttons}));
   assert.equal(m.next,id==='E6'?'ROOT NOTES':'');
  }
  await choose(p,'E5');const a=await p.locator('[data-art="monochord-story"]').boundingBox();await choose(p,'E6');assert.deepEqual(await p.locator('[data-art="monochord-story"]').boundingBox(),a);
  assert.equal(await p.locator('[data-art="spirit-listening"]').evaluate(e=>getComputedStyle(e).clipPath),'none');
  report.checks.push({viewport:[width,height],scenes:16,allCaptionsFit:true,rootTeaser:true,fixedMonochord:true});
 }
 await p.setViewportSize({width:1280,height:800});await choose(p,'E6');await p.screenshot({path:path.join(out,'root-teaser.png')});
 await choose(p,'S03');assert.equal(await p.locator('#ending-narration').innerText(),'光を届けると、静かだった鐘が応えました。');await p.screenshot({path:path.join(out,'caption.png')});
 await p.locator('#ending-play').click();await p.waitForFunction(()=>__prismInspect().ending.time>30.2&&!__prismInspect().ending.paused);
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});assert.equal((await inspect(p)).ending.paused,true);
 await p.locator('#ending-play').click();await p.waitForFunction(()=>!__prismInspect().ending.paused);await p.locator('#ending-chapters').click();assert.equal((await inspect(p)).ending.paused,true);await p.locator('#ending-close-menu').click();
 await choose(p,'S13');await p.locator('#ending-music').evaluate(a=>{a.currentTime=179.9;});await p.locator('#ending-play').click();await p.waitForFunction(()=>__prismInspect().ending.time>180.1);assert.equal(await p.locator('#ending-narration').innerText(),'鐘の余韻は、静かな夜空へ溶けていきました。');
 await p.locator('#ending-music').evaluate(a=>{a.currentTime=a.duration-.3;});await p.waitForFunction(()=>__prismInspect().ending.scene==='E5');assert.equal((await inspect(p)).ending.paused,true);
 await p.locator('#ending-next').click();await p.waitForFunction(()=>__prismInspect().ending.scene==='E6');await p.locator('#ending-next').click();await p.waitForFunction(()=>__prismInspect().ending.scene==='C1');await p.locator('#ending-next').click();assert.equal((await inspect(p)).active,false);
 assert.equal(await p.locator('#ending-screen').count(),0);assert.deepEqual(await p.evaluate(()=>['circuits','scores','guides'].map(key=>localStorage.getItem('prism-notes.'+key+'.v1'))),saved);
 state=await inspect(p);assert.equal(state.journey.cleared,0);assert.equal(state.journey.ended,false);
 report.checks.push({pauseOnHiddenFixture:true,menuPauses:true,finalBellWords:true,naturalEndFromTail:true,postSongE5E6Credits:true,shortcutDoesNotWriteResults:true,disposedOnClose:true});
 await p.locator('#title-story').click();await p.waitForFunction(()=>__prismInspect().active&&!__prismInspect().loading);
 await p.locator('#story-chapters').click();await p.locator('#story-scene-list button[data-index="26"]').click();await ready(p);assert.equal((await inspect(p)).ending.scene,'E6');await p.locator('#ending-chapters').click();await p.locator('#ending-exit').click();assert.equal((await inspect(p)).active,false);
 report.checks.push({galleryUsesSameEnding:true});
 assert.deepEqual(report.errors,[]);report.passed=true;console.log(JSON.stringify(report));
}catch(error){report.error=error.stack;if(p){report.state=await inspect(p).catch(()=>null);report.media=await p.locator('#ending-music').evaluate(a=>({duration:a.duration,time:a.currentTime,ready:a.readyState,network:a.networkState,error:a.error?{code:a.error.code,message:a.error.message}:null})).catch(()=>null);await p.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}throw error;}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
