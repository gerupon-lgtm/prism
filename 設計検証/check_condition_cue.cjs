// Actual stage-entry UI, real CSS animation frames; no simulation-clock changes.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chooseChallenge,dragConnection}=require('./browser_wait.cjs');
const arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),engine=arg('--engine')||'chromium',root=path.resolve('dist'),out=path.resolve(arg('--out')||`設計検証/条件カード開始演出-20261025/${engine}`);fs.mkdirSync(out,{recursive:true});
const version=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version,report={version,passed:false,cases:[],boundary:'Disposable desktop browsers, including phone touch and OS-motion emulation; physical-device appearance remains unverified.'};
const server=http.createServer((req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===root)file=path.join(root,'index.html');assert(file.startsWith(root+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.ttf':'font/ttf','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
let browser;
const layouts=[{name:'phone',width:390,height:844,flow:true},{name:'desktop',width:1440,height:960,desktop:true},{name:'landscape',width:844,height:390},{name:'reduced',width:390,height:844,reduced:true},{name:'system-reduced',width:390,height:844,system:true}];
async function menuItem(p,name){await p.locator('#menu').click();for(let i=0;i<20;i++){const item=p.getByRole('button',{name,exact:true});if(await item.count()){await item.click();return;}await p.locator('#dialog-body .pager button').last().click();}throw Error('Menu item missing '+name);}
const count=p=>p.evaluate(()=>window.cueProbe.starts.length);
async function cue(p,action,expectedName){const n=await count(p);await action();await p.waitForFunction(n=>window.cueProbe.starts.length>n,n,{timeout:5000});const event=await p.evaluate(n=>window.cueProbe.starts[n],n);assert.equal(event.name,expectedName);assert.equal(event.visible,true);await p.waitForFunction(n=>window.cueProbe.ends.length>n,n,{timeout:5000});await p.waitForFunction(()=>!document.getElementById('challenge-info').classList.contains('condition-start-cue'));assert.equal(await count(p),n+1,'Only one cue per entry');return event;}
(async()=>{try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await pw[engine].launch({headless:true});
  for(const c of layouts.filter(c=>!arg('--cases')||arg('--cases').split(',').includes(c.name))){
    report.step=c.name;const context=await browser.newContext({viewport:{width:c.width,height:c.height},isMobile:!c.desktop,hasTouch:!c.desktop,reducedMotion:c.system?'reduce':'no-preference'}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.addInitScript(({reduced,system})=>{Math.random=()=>.5;localStorage.setItem('prism-notes.motion.v1',JSON.stringify({version:1,value:system?'auto':reduced?'reduce':'full'}));},{reduced:Boolean(c.reduced),system:Boolean(c.system)});
    await p.goto(arg('--url')||`http://127.0.0.1:${server.address().port}/`);await p.locator('#board [data-node="S"]').waitFor({state:'attached'});assert.equal(await p.locator('meta[name="prism-version"]').getAttribute('content'),version);
    await p.evaluate(async()=>{await document.fonts.ready;const state=window.cueProbe={starts:[],ends:[],samples:[]},card=document.getElementById('challenge-info');
      const relevant=e=>e.target===card&&e.animationName.startsWith('condition-start-');
      document.addEventListener('animationstart',e=>{if(relevant(e))state.starts.push({name:e.animationName,wall:performance.now(),visible:!document.getElementById('dialog').open&&document.getElementById('title-screen').hidden&&card.getClientRects().length>0,title:document.getElementById('title').textContent});});
      document.addEventListener('animationend',e=>{if(relevant(e))state.ends.push({name:e.animationName,wall:performance.now()});});
      function sample(){if(card.classList.contains('condition-start-cue')&&card.getClientRects().length){const style=getComputedStyle(card),r=card.getBoundingClientRect(),b=document.getElementById('board').getBoundingClientRect();state.samples.push({entry:state.starts.length,bg:style.backgroundColor,shadow:style.boxShadow,card:[r.x,r.y,r.width,r.height],board:[b.x,b.y,b.width,b.height]});}requestAnimationFrame(sample);}requestAnimationFrame(sample);
    });
    assert.equal(await count(p),0,'No cue behind the title');
    const name=c.reduced||c.system?'condition-start-still':'condition-start-glow';
    await p.locator('#title-challenges').click();assert.equal(await count(p),0,'No cue behind stage selector');
    const first=await cue(p,()=>chooseChallenge(p,'Q1'),name);
    const samples=await p.evaluate(()=>window.cueProbe.samples.filter(s=>s.entry===1));assert(samples.length>5);
    for(const key of ['card','board'])for(let axis=0;axis<4;axis++)assert(Math.max(...samples.map(s=>s[key][axis]))-Math.min(...samples.map(s=>s[key][axis]))<1,'Cue does not move or resize '+key);
    if(c.reduced||c.system)assert.equal(new Set(samples.map(s=>s.bg)).size,1,'Reduced cue stays still rather than flashing');else assert(new Set(samples.map(s=>s.bg)).size>5,'Full cue actually fades through intermediate colors');
    // Capture a real midpoint using its running Animation, not altered playback.
    await p.locator('#stage-next').click();await p.waitForFunction(()=>document.getElementById('challenge-info').getAnimations().some(a=>a.animationName?.startsWith('condition-start-')&&a.currentTime>=250&&a.currentTime<=700));
    await p.screenshot({path:path.join(out,c.name+'-cue.png')});await p.waitForFunction(()=>!document.getElementById('challenge-info').classList.contains('condition-start-cue'));
    assert.equal(await count(p),2,'Next stage cues once');
    const before=await count(p);await p.locator('#magnifier-toggle').click();await p.locator('#condition-info').click();await p.locator('#dialog-close').click();
    await p.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});assert.equal(await count(p),before,'Ordinary edits and closing the selector do not repeat the cue');
    if(c.flow){
      await cue(p,()=>p.locator('#stage-previous').click(),name);
      await dragConnection(p,'S','A');await dragConnection(p,'A','G');assert.equal(await count(p),3,'Wiring does not cue');
      await p.locator('#play').click();await p.locator('#clear-toast').waitFor({state:'visible',timeout:12000});await p.locator('#clear-again').click();assert.equal(await count(p),3,'Replay editing does not cue');
      await p.locator('#play').click();await p.locator('#clear-toast').waitFor({state:'visible',timeout:12000});await cue(p,()=>p.locator('#clear-next').click(),name);
      await menuItem(p,'タイトルへ');assert.equal(await p.locator('#title-screen').isVisible(),true);assert.equal(await p.locator('#challenge-info').evaluate(e=>e.classList.contains('condition-start-cue')),false);
      await cue(p,()=>p.locator('#title-start').click(),name);assert.equal(await p.locator('#stage-next').isVisible(),false,'Continuous play retains its controls');
      await menuItem(p,'タイトルへ');await p.locator('#title-free').click();await p.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});assert.equal(await count(p),5,'Free mode has no condition cue');
      await menuItem(p,'タイトルへ');await p.locator('#title-tutorial').click();await p.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});assert.equal(await count(p),5,'Tutorial has no hidden condition cue');await p.locator('#guide-skip').click();
      await p.locator('#home').click();await chooseChallenge(p,'Q35',{dismissMirrorIntro:false,pagerTimeout:5000});await p.locator('#mirror-intro-start').waitFor({state:'visible'});assert.equal(await count(p),5,'First mirror explanation defers the cue');await cue(p,()=>p.locator('#mirror-intro-start').click(),name);
      await p.locator('#home').click();await chooseChallenge(p,'Q36',{pagerTimeout:5000});await p.waitForFunction(()=>window.cueProbe.starts.length===7);
      await p.setViewportSize({width:414,height:896});await p.waitForFunction(()=>!document.getElementById('challenge-info').classList.contains('condition-start-cue'));
      await p.setViewportSize({width:c.width,height:c.height});await p.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});assert.equal(await count(p),7,'Resizing cancels an existing cue and cannot replay it');
    }
    assert.deepEqual(errors,[]);const data=await p.evaluate(()=>window.cueProbe);report.cases.push({name:c.name,first,samples,...data,passed:true});console.log(c.name+' passed');await context.close();
  }report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(report.step,error.stack);}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}})();
