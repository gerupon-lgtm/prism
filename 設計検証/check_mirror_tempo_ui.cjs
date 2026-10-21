const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {chooseChallenge,selectChallenge,dragConnection}=require('./browser_wait.cjs');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')||'C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const engine=arg('--engine')||'chromium',channel=arg('--channel'),root=path.resolve('dist'),version=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version;
const interaction=process.argv.includes('--interaction'),out=path.resolve('設計検証/鏡のテンポ',version,arg('--url')?new URL(arg('--url')).hostname:'local',(interaction?'interaction-':'')+(channel||engine));fs.mkdirSync(out,{recursive:true});
const proof=JSON.parse(process.argv.includes('--baseline')?execFileSync('git',['show','463d073:設計検証/月鏡の静殿/proof.json'],{encoding:'utf8',windowsHide:true}):fs.readFileSync('設計検証/月鏡の静殿/proof.json'));
const report={version,passed:false,checks:[],pending:['Physical phone feel']};
const settle=p=>p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#board image')].map(async e=>{const i=new Image();i.src=e.getAttribute('href');await i.decode();}));for(let n=0;n<3;n++)await new Promise(requestAnimationFrame);});
const server=http.createServer((req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===root)file=path.join(root,'index.html');if(!file.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.ttf':'font/ttf'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
let browser,activePage;
(async()=>{try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=arg('--url')||`http://127.0.0.1:${server.address().port}/`;
 browser=await pw[engine].launch({headless:true,...(channel?{channel}:{})});
 const desktop=process.argv.includes('--desktop'),page=await browser.newPage({viewport:desktop?{width:1600,height:1000}:{width:390,height:844},hasTouch:!desktop,isMobile:!desktop}),errors=[];activePage=page;page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__tempoFamily=0;Math.random=()=>window.__tempoFamily/2;const direction=new EventTarget();Object.defineProperties(direction,{angle:{value:0},type:{value:'portrait-primary'}});Object.defineProperty(screen,'orientation',{get:()=>direction});});
 await page.goto(url);await page.locator('#title-challenges').click();await chooseChallenge(page,'Q1');
 const catalogue=await page.evaluate(async()=>{const m=await import(new URL('../content/challenges.js',document.querySelector('script[type=module]').src));return m.challenges.filter(c=>c.nodes.some(n=>n.kind==='mirror')&&!c.nodes.some(n=>n.gate));});
 for(const c of catalogue.filter(c=>!interaction||c.instantStart))for(const family of interaction?[0]:[0,1]){
  await selectChallenge(page,'Q1');await page.evaluate(f=>window.__tempoFamily=f,family);await selectChallenge(page,c.id);await settle(page);
  const id=await page.locator('#app').getAttribute('data-problem-id'),row=proof.stages.find(r=>r.id===id);assert(row);assert.equal(row.family,family);
  const size=await page.evaluate(()=>{const goal=document.getElementById('challenge-goal');return{width:innerWidth,height:innerHeight,scrollW:document.documentElement.scrollWidth,scrollH:document.documentElement.scrollHeight,goalW:goal.clientWidth,goalSW:goal.scrollWidth,goalH:goal.clientHeight,goalSH:goal.scrollHeight};});assert(size.scrollW<=size.width+1&&size.scrollH<=size.height+1,'no page scroll');assert(size.goalSW<=size.goalW+1&&size.goalSH<=size.goalH+1,'condition fully visible');
  for(const id of row.winner){const e=c.candidates.find(e=>e.id===id);await dragConnection(page,e.from,e.to);}
  if(family===0&&[31,32,36].includes(c.number))await page.screenshot({path:path.join(out,`Q${c.number}.png`)});
  // Observe elapsed wall time in the real app: no stepping, clock override or speed-up.
  await page.evaluate(goals=>{window.__tempoStart=performance.now();window.__tempoArrivals={};window.__tempoObserver=new MutationObserver(()=>{for(const id of goals){const e=document.querySelector(`[data-node="${id}"]`);if(Number(e?.dataset.arrivalCount)>0&&window.__tempoArrivals[id]===undefined)window.__tempoArrivals[id]=performance.now()-window.__tempoStart;}});window.__tempoObserver.observe(document.getElementById('board'),{subtree:true,attributes:true,attributeFilter:['class','data-arrival-count']});},c.goals);await page.locator('#play').click();
  await page.waitForFunction(()=>document.getElementById('result').textContent.includes('達成 100.00点'),null,{timeout:16000});
  const measured=await page.evaluate(()=>{window.__tempoObserver.disconnect();return{wallMs:performance.now()-window.__tempoStart,arrivals:window.__tempoArrivals};}),{wallMs,arrivals}=measured;report.checks.push({stage:c.number,family,expectedSeconds:Number(row.baseline),...measured});console.log(`Q${c.number} family ${family}: ${row.baseline}s, real ${Math.round(wallMs)}ms`);
  if(c.instantStart){assert(arrivals.G1<=350,`first door chime takes ${arrivals.G1}ms`);assert(Math.abs(arrivals.G2-arrivals.G1-500)<=120,'real door chime gap');}
  assert(wallMs<=6200,`Q${c.number}: actual playback takes ${Math.round(wallMs)}ms`);
  await page.locator('#stop').click();
  if(interaction){
   const watchLaunch=()=>page.evaluate(()=>{window.__launchMs=null;let at;const button=document.getElementById('play');button.addEventListener('click',()=>at=performance.now(),{capture:true,once:true});const observer=new MutationObserver(()=>{if(button.dataset.state==='running'&&at!==undefined){window.__launchMs=performance.now()-at;observer.disconnect();}});observer.observe(button,{attributes:true,attributeFilter:['data-state']});});
   await page.locator('#play').click();await page.waitForFunction(()=>document.getElementById('play').dataset.state==='running');await page.waitForFunction(()=>Number(document.querySelector('[data-node="G1"]').dataset.arrivalCount)>0);await page.locator('#play').click();assert.equal(await page.locator('#play').getAttribute('data-state'),'paused');
   await watchLaunch();await page.locator('#play').click();await page.waitForFunction(()=>window.__launchMs!==null);const resumeMs=await page.evaluate(()=>window.__launchMs);assert(resumeMs>=230,'resume keeps250ms preparation');
   await page.waitForFunction(()=>document.getElementById('result').textContent.includes('達成 100.00点'));await page.locator('#stop').click();
   await page.locator('#zoom-in').click();await page.locator('#zoom-in').click();await watchLaunch();await page.locator('#play').click();await page.waitForFunction(()=>window.__launchMs!==null);const zoomMs=await page.evaluate(()=>window.__launchMs);assert(zoomMs>=230,'zoomed start keeps250ms fit animation');
   await page.waitForFunction(()=>document.getElementById('result').textContent.includes('達成 100.00点'));await page.locator('#stop').click();report.interactions={resumeMs,zoomMs};console.log(`Resume ${Math.round(resumeMs)}ms; zoom fit ${Math.round(zoomMs)}ms`);
  }
 }
 assert.deepEqual(errors,[]);report.passed=true;
}catch(e){report.error=e.stack;console.error(e);await activePage?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});report.state=await activePage?.evaluate(()=>({title:document.getElementById('title').textContent,parts:[...document.querySelectorAll('[data-node] .node-hit')].map(e=>({id:e.parentNode.dataset.node,box:e.getBoundingClientRect().toJSON()}))})).catch(()=>null);process.exitCode=1;}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser?.close();server.close();}})();
