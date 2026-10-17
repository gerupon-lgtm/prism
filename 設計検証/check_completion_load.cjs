// Real PC browser actions with labelled synthetic delays/errors; not device-speed or listening evidence.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {enterApp,selectChallenge,dragConnection,setSound}=require('./browser_wait.cjs');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),root=path.resolve(__dirname,'../dist'),channel=arg('--channel'),url=arg('--url');
const out=path.join(__dirname,'完了時の負荷',url?'public':channel||'');fs.mkdirSync(out,{recursive:true});
const stall=Number(arg('--stall')??135),report={version:JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version,syntheticDelay:stall,checks:[],browsers:[],evidence:'Synthetic single presentation delay or handled exception, real Q8 draw 2 wiring; PC browsers only.'};
const pairs=[['S','A'],['A','B'],['A','C'],['B','D'],['D','G1'],['D','G2'],['C','E'],['E','G3']];
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===root)file=path.join(root,'index.html');if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
async function state(page){return page.evaluate(async()=>{const app=await import(document.querySelector('script[type=module]').src);return {...app.inspectPerformance(),result:document.getElementById('result').textContent,play:document.getElementById('play').outerHTML,toast:!document.getElementById('clear-toast').hidden,perfectCalls:window.__perfectCalls,stops:window.__outcomeStops};});}
async function exported(page){await page.locator('#menu').click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'実行結果を書き出す',exact:true}).click();const chunks=[],stream=await(await pending).createReadStream();for await(const c of stream)chunks.push(c);await page.locator('#dialog-close').click();return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
(async()=>{let browser,page;await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 const {Session}=await import(pathToFileURL(path.join(__dirname,'../src/app/session.js')).href),{LocalRecords}=await import(pathToFileURL(path.join(__dirname,'../src/core/storage.js')).href);
 const values=new Map(),reference=new Session(new LocalRecords({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),{random:()=>.13});reference.replace({challengeId:'Q8'});for(const [from,to]of pairs)reference.connect(from,to);reference.start();reference.advance('3.8');assert.equal(reference.result.state,'achieved');assert.deepEqual(reference.result.score,{numerator:'100',denominator:'1'});
 for(const engine of channel?['chromium']:arg('--engine')?[arg('--engine')]:['chromium','webkit']){
  browser=await pw[engine].launch({headless:true,...(channel?{channel}:{})});report.browsers.push({engine,channel,version:browser.version()});
  for(const phase of arg('--phase')?[arg('--phase')]:['completed','unfinished','error']){
   page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{Math.random=()=>.13;});await page.goto(url||`http://127.0.0.1:${server.address().port}/`);await enterApp(page);assert.equal(await page.locator('meta[name=prism-version]').getAttribute('content'),report.version);await selectChallenge(page,'Q8');assert((await page.locator('#condition').textContent()).includes('出題2'));
   for(const [from,to]of pairs)await dragConnection(page,from,to);await setSound(page,true);
   await page.evaluate(async({stall,phase})=>{
    const {Chime}=await import(new URL('./audio.js',document.querySelector('script[type=module]').src)),perfect=Chime.prototype.perfect,relay=Chime.prototype.relay,stop=Chime.prototype.stop;
    window.__perfectCalls=[];window.__outcomeStops=[];let delayed=false;
    const delay=()=>{if(delayed)return;delayed=true;const start=performance.now();while(performance.now()-start<stall){/* One labelled synthetic presentation delay. */}};
    Chime.prototype.perfect=function(...args){window.__perfectCalls.push(performance.now());const result=perfect.apply(this,args);if(phase==='error')throw Error('Synthetic outcome failure');if(phase==='completed')delay();return result;};
    Chime.prototype.relay=function(...args){const result=relay.apply(this,args);if(phase==='unfinished')delay();return result;};
    Chime.prototype.stop=function(...args){if(window.__perfectCalls.length)window.__outcomeStops.push(performance.now());return stop.apply(this,args);};
   },{stall,phase});
   await page.locator('#play').click();
   if(phase==='unfinished'){
    await page.waitForFunction(()=>document.getElementById('result').textContent.includes('負荷のため一時停止'),null,{timeout:5000});const paused=await state(page);assert.equal(paused.run.pauseReason,'load');assert(paused.run.active>0);assert.equal(await page.locator('#play').isDisabled(),false);await page.locator('#play').click();
    report.checks.push({label:(channel||engine)+' unfinished calculation still pauses for load and can resume',passed:true,paused});
   }
   await page.waitForFunction(()=>document.getElementById('result').textContent.includes('達成 100.00点'),null,{timeout:10000});const completed=await state(page);
   if(phase==='error'){
    assert.equal(completed.run.pauseReason,'error');await page.waitForTimeout(3000);assert.equal(await page.locator('#play').getAttribute('data-state'),'paused');assert.equal(await page.locator('#play').isDisabled(),true);await page.locator('#stop').click();
   }else{
    assert.equal(completed.run.active,0);assert(completed.toast,'Confirmed clear must remain visible after a slow presentation frame');assert.equal(completed.stops.length,0,'A completed presentation delay must not cut the outcome audio');
    await page.waitForFunction(()=>!document.getElementById('play').disabled&&document.getElementById('play').dataset.state==='stopped',null,{timeout:4500});
   }
   const returned=await state(page);assert.equal(returned.run.clock,'3.8');assert.equal(returned.run.records,completed.run.records);assert(returned.toast);assert.equal(returned.perfectCalls.length,1);assert.deepEqual((await exported(page)).records,reference.run.records);assert.deepEqual(errors,[]);
   report.checks.push({label:(channel||engine)+' '+phase+' preserves the complete reference records, 3.8 seconds and 100 points',passed:true,completed,returned});await page.screenshot({path:path.join(out,`${channel||engine}-${phase}.png`)});
   if(phase==='completed'){
    await page.locator('#clear-dismiss').click();const at=await page.locator('[data-edge="DG1"] .edge-line').evaluate(line=>{const p=line.getPointAtLength(line.getTotalLength()*.5).matrixTransform(line.getScreenCTM());return {x:p.x,y:p.y};});
    await page.mouse.move(at.x,at.y);await page.mouse.down();await page.waitForFunction(()=>document.getElementById('wire-delete-toast').open);await page.mouse.up();assert(await page.locator('#wire-delete-toast').evaluate(e=>e.open),'Original hold release must not dismiss');
    const menu=await page.locator('#menu').boundingBox();await page.touchscreen.tap(menu.x+menu.width/2,menu.y+menu.height/2);assert(!(await page.locator('#wire-delete-toast').evaluate(e=>e.open)));assert(!(await page.locator('#dialog').evaluate(e=>e.open)),'Outside touch must not activate the menu underneath');assert.equal(await page.locator('.edge:not(.candidate)').count(),8);assert.deepEqual((await exported(page)).records,reference.run.records);
    report.checks.push({label:(channel||engine)+' outside touch dismisses deletion without passing through or changing wires and records',passed:true});
   }await page.close();page=null;
  }await browser.close();browser=null;
 }report.passed=true;console.log('Completion load checks passed: '+report.checks.length);
}catch(e){report.passed=false;report.failure=e.stack;if(page){try{report.failureState=await state(page);await page.screenshot({path:path.join(out,'failed.png')});}catch(detail){report.diagnosticError=detail.message;}}console.error(e.stack);process.exitCode=1;}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,arg('--phase')?`${arg('--phase')}-report.json`:'report.json'),JSON.stringify(report,null,2));}})();
