const {enterApp,startGuide,skipGuide}=require('./browser_wait.cjs');
// PC engine evidence, synthetic circuits and a labelled synthetic rendering stall.
// No claim about physical touch, device speed or listening quality.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const arg=name=>{const at=process.argv.indexOf(name);return at<0?null:process.argv[at+1];};
if(!arg('--playwright-path'))throw new Error('Pass --playwright-path');
process.env.PLAYWRIGHT_BROWSERS_PATH=arg('--browser-cache')||'C:/Users/user/AppData/Local/ms-playwright';
const pw=require(path.resolve(arg('--playwright-path'))),root=path.resolve(__dirname,'../dist'),out=path.join(__dirname,'世界観と負荷');
fs.mkdirSync(out,{recursive:true});
const report={version:JSON.parse(fs.readFileSync(path.join(__dirname,'../package.json'),'utf8')).version,checkedAt:new Date().toISOString(),evidence:'PC Chromium/WebKit. Synthetic circuits; explicitly injected 135ms DOM stall verifies preservation, not a real-device load threshold. No physical touch or listening evidence. Unavailable audio APIs remain pending, never counted as sound acceptance.',checks:[],measurements:[],pending:[]};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.ttf':'font/ttf','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=http.createServer((request,response)=>{
  let file=path.resolve(root,'.'+decodeURIComponent(new URL(request.url,'http://localhost').pathname));
  if(file!==root&&!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}if(file===root)file=path.join(root,'index.html');
  try{response.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');response.setHeader('Cache-Control','no-store');response.end(fs.readFileSync(file));}catch{response.writeHead(404).end();}
});
const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const inspect=page=>page.evaluate(async()=>{const app=await import(document.querySelector('script[type=module]').src);return app.inspectPerformance();});
const check=(label,details={})=>report.checks.push({label,passed:true,...details});
async function menuItem(page,name){
  await page.locator('#menu').click();await settle(page);
  for(let i=0;i<30;i++){const item=page.getByRole('button',{name,exact:true});if(await item.count()){await item.click();return;}const next=page.locator('#dialog-body .pager button').last();if(await next.isDisabled())break;await next.click();await settle(page);}throw new Error(`Missing ${name}`);
}
async function result(page){
  const pending=page.waitForEvent('download');await menuItem(page,'実行結果を書き出す');const download=await pending,data=JSON.parse(fs.readFileSync(await download.path(),'utf8'));await page.locator('#dialog-close').click();return data;
}
async function importCircuit(page,circuit){
  await page.locator('#import').setInputFiles({name:'synthetic-circuit.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'prism-notes-circuit',version:1,name:'検証用合成回路',circuit}))});await settle(page);
}
function manyGoals(count,shared=false){
  const nodes=[{id:'S',kind:'source',x:.5,y:.12,process:'0'}],edges=[];
  if(shared){nodes.push({id:'A',kind:'prism',x:.5,y:.4,process:'0.1'});edges.push({id:'SA',from:'S',to:'A',time:'0.1'});}
  for(let i=0;i<count;i++){const id=`G${i}`;nodes.push({id,kind:'goal',x:.08+(i%8)*.12,y:.65+Math.floor(i/8)*.07,process:'0'});edges.push({id:`e${i}`,from:shared?'A':'S',to:id,time:'0.1'});}
  return {mode:'fastest',target:'all',nodes,edges};
}
async function pausedStart(page){await page.locator('#play').click();await page.waitForFunction(()=>document.getElementById('play').dataset.state==='running');await page.locator('#records').click();await page.locator('#close-records').click();}
async function finishNext(page){
  // Finite fixture check guard only; production has no event/time/count cap.
  for(let i=0;i<160;i++){if(await page.locator('#next').isDisabled())return;await page.locator('#next').click();}throw new Error('Finite fixture did not finish');
}
(async()=>{
  const {Simulation}=await import(pathToFileURL(path.join(__dirname,'../src/core/simulation.js')).href);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}/`;
  try{
    for(const engine of ['chromium','webkit']){
      const browser=await pw[engine].launch({headless:true});
      try{
        const page=await browser.newPage({viewport:{width:390,height:664}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
        await page.addInitScript(()=>{const Audio=window.AudioContext??window.webkitAudioContext;if(!Audio)return;const original=Audio.prototype.createOscillator,resume=Audio.prototype.resume;window.__oscillators=0;window.__bellStarts=[];window.__audioContexts=[];Audio.prototype.createOscillator=function(...args){window.__oscillators++;const voice=original.apply(this,args),start=voice.start.bind(voice);voice.start=at=>{if(Math.abs(voice.frequency.value-523.22)<.04)window.__bellStarts.push({frequency:voice.frequency.value,at});return start(at);};return voice;};Audio.prototype.resume=function(...args){window.__audioContexts.push(this);return resume.apply(this,args);};});
        await page.goto(url);await enterApp(page);await startGuide(page);await page.locator('#guide-spirit').waitFor({state:'visible'});
        await page.waitForFunction(()=>document.getElementById('guide-spirit').complete&&document.getElementById('guide-spirit').naturalHeight===1536);
        const alpha=await page.locator('#guide-spirit').evaluate(img=>{const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const context=canvas.getContext('2d');context.drawImage(img,0,0);return context.getImageData(0,0,1,1).data[3];});assert.equal(alpha,0);
        check(`${engine} adopted humanoid transparent image loaded only during guide`);
        for(const [width,height]of [[320,480],[360,640],[390,664],[480,240],[568,260],[844,310],[768,1024],[1280,800]]){
          await page.setViewportSize({width,height});await settle(page);
          const fits=await page.evaluate(()=>{const bar=document.getElementById('guide-bar'),image=document.getElementById('guide-spirit'),rect=bar.getBoundingClientRect();return document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight&&rect.bottom<=innerHeight&&bar.scrollWidth<=bar.clientWidth&&bar.scrollHeight<=bar.clientHeight&&image.getBoundingClientRect().height>0;});assert(fits,`${engine} guide ${width}x${height}`);
        }check(`${engine} guide fits all eight portrait/landscape sizes`);
        await page.setViewportSize({width:390,height:664});await settle(page);await page.screenshot({path:path.join(out,`${engine}-guide.png`)});
        await skipGuide(page);assert(!(await page.locator('#guide-spirit').isVisible()));
        for(const id of Array.from({length:12},(_,i)=>'Q'+(i+1))){
          await page.locator('#home').click();await settle(page);
          for(let i=0;i<10;i++){const item=page.getByRole('button',{name:new RegExp(`^${id} `)});if(await item.count()){await item.click();break;}const next=page.locator('#dialog-body .pager button').last();assert(!(await next.isDisabled()),`${id} missing: ${await page.locator('#dialog-body').innerText()}`);await next.click();await settle(page);}
          await settle(page);assert.equal(await page.locator('.scene').getAttribute('data-scene'),[1,2,3,7,9,11].includes(Number(id.slice(1)))?'ruins':'observatory');
          assert.equal(await page.locator('.scene').evaluate(el=>getComputedStyle(el).pointerEvents),'none');assert.equal(await page.locator('.scene [data-node],.scene [data-edge]').count(),0);
        }check(`${engine} all twelve stages use their adopted setting with no decoration hit targets`);
        await page.screenshot({path:path.join(out,`${engine}-observatory.png`)});
        await page.locator('#home').click();await page.getByRole('button',{name:'自由へ',exact:true}).click();await skipGuide(page);
        const painted=await page.locator('[data-node] .node-symbol').evaluateAll(async elements=>Promise.all(elements.map(async e=>{const img=new Image();img.src=e.getAttribute('href');await img.decode();return {src:img.src,width:img.naturalWidth,height:img.naturalHeight};})));assert.equal(painted.length,4);assert(painted.every(a=>a.width>0&&a.src.includes('/public/graphics/')));assert.equal(painted.filter(a=>a.src.endsWith('/prism.png')).length,2);check(`${engine} prisms, source star and altar chime symbols`);
        const contexts=await page.evaluate(()=>['#board','#play','.node-hit'].map(selector=>{const event=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});document.querySelector(selector).dispatchEvent(event);return event.defaultPrevented;}));assert(contexts.every(Boolean));
        await menuItem(page,'回路を保存');const input=page.getByRole('textbox',{name:'回路名'});await input.fill('全選択の合成入力');await input.blur();await input.focus();
        assert(await input.evaluate(el=>el.selectionStart===0&&el.selectionEnd===el.value.length));assert(await input.evaluate(el=>{const event=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});el.dispatchEvent(event);return !event.defaultPrevented;}));await page.locator('#dialog-close').click();check(`${engine} unwanted context menus suppressed; input selection/menu retained`);
        const simultaneous=manyGoals(3);await importCircuit(page,simultaneous);
        const audioSupport=await page.evaluate(()=>({AudioContext:typeof window.AudioContext,webkitAudioContext:typeof window.webkitAudioContext,OfflineAudioContext:typeof window.OfflineAudioContext}));
        const hasAudio=audioSupport.AudioContext==='function'||audioSupport.webkitAudioContext==='function';await page.locator('#sound').click();
        if(hasAudio)await page.waitForFunction(()=>document.getElementById('sound').textContent==='音あり',{},{timeout:5000});
        else{
          assert((await page.locator('#result').textContent()).includes('このブラウザでは音を開始できません'));
          report.pending.push({engine,label:'Actual Web Audio synthesis and output',observed:audioSupport,reason:'This Windows test engine exposes no audio context. macOS Safari and iPhone/iPad Safari remain in the verification scope.'});
          check(`${engine} unavailable audio API reported without disabling simulation`,{audioSupport});
        }
        await pausedStart(page);await finishNext(page);
        assert.equal(await page.locator('.arrival-art').count(),3);if(hasAudio)assert.equal(await page.evaluate(()=>window.__bellStarts.length),3);
        const arrival=await inspect(page);assert.equal(arrival.run.clock,'0.1');assert.equal(arrival.run.retainedParticles,3);
        await page.screenshot({path:path.join(out,`${engine}-arrivals.png`)});
        await page.waitForFunction(()=>document.querySelectorAll('.arrival-art').length===0,{},{timeout:4000});const after=await inspect(page);
        assert.equal(after.run.clock,arrival.run.clock);assert.equal(after.run.records,arrival.run.records);assert.equal(after.run.retainedParticles,3);
        check(`${engine} three same-time arrivals have three tails; fading adds no experiment time`,{clock:after.run.clock,records:after.run.records});
        if(hasAudio)check(`${engine} three arrivals each start one upper-octave bell`,{bellStarts:await page.evaluate(()=>window.__bellStarts)});
        await page.locator('#stop').click();assert.equal(await page.locator('.arrival-art').count(),0);assert.equal((await inspect(page)).audioVoices,0);check(`${engine} stop clears decoration and all audio voices`);
        const queued=manyGoals(24,true);await importCircuit(page,queued);
        // Inject one blocking render operation to deterministically test the load pause.
        await page.evaluate(()=>{const original=Element.prototype.append;window.__originalAppend=original;window.__stallPending=true;Element.prototype.append=function(...args){if(window.__stallPending&&this.closest?.('#board')){window.__stallPending=false;const start=performance.now();while(performance.now()-start<135){/* Explicit synthetic stall. */}}return original.apply(this,args);};});
        await page.locator('#play').click();await page.waitForFunction(()=>document.getElementById('result').textContent.includes('負荷のため一時停止'));
        await page.evaluate(()=>{Element.prototype.append=window.__originalAppend;delete window.__originalAppend;});
        const held=await inspect(page);assert.equal(held.run.pauseReason,'load');assert.equal(held.run.active,24);assert.equal(held.run.retainedParticles,24);assert(held.last.milliseconds>=120);
        await settle(page);assert.equal((await inspect(page)).run.clock,held.run.clock);check(`${engine} measured synthetic rendering stall pauses while preserving every active particle`,{measurement:held.last});
        report.measurements.push({engine,fixture:'24 all-goal particles sharing one processing gate',syntheticStall:held});
        await page.locator('#next').click();const waiting=await inspect(page);assert.equal(waiting.run.waiting,23);report.measurements.push({engine,fixture:'24-particle shared gate queue',snapshot:waiting});
        await page.locator('#records').click();const opened=await inspect(page);assert(opened.totals.records.calls>0);await page.locator('#close-records').click();
        await finishNext(page);const exported=await result(page),reference=new Simulation(queued);reference.advanceUntil('4');assert.deepEqual(exported.records,reference.records);assert.equal(exported.records.filter(r=>r.type==='goal').length,24);
        report.measurements.push({engine,fixture:'completed queued run with record display and JSON export',snapshot:await inspect(page)});
        check(`${engine} after load pause, all 24 arrivals and full records equal uninterrupted reference; record display and file export measured`,{records:exported.records.length});
        assert.deepEqual(errors,[]);check(`${engine} no browser script errors`);
      }finally{await browser.close();}
    }
    report.passed=true;console.log(`World/load checks passed: ${report.checks.length}`);
  }catch(error){report.passed=false;report.failure=error.stack;throw error;}
  finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
