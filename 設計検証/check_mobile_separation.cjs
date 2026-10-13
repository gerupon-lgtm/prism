const {startAndPause}=require('./browser_wait.cjs');
const {enterApp,startGuide,skipGuide}=require('./browser_wait.cjs');
// Real Chromium protocol touch and explicitly synthetic WebKit pointer types.
// PC evidence only; physical phone gestures and artistic judgement remain separate.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {wiringBounds}=require('./browser_wait.cjs');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),root=path.resolve(__dirname,'../dist'),out=path.join(__dirname,'スマホ操作と分離',arg('--url')?'public':'');fs.mkdirSync(out,{recursive:true});
const reportFile=path.join(out,'report.json');
if(fs.existsSync(reportFile)&&JSON.parse(fs.readFileSync(reportFile)).passed===false)fs.copyFileSync(reportFile,path.join(out,'failed-'+Date.now()+'.json'));
const report={version:JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version,evidence:'PC Chromium protocol touch; WebKit synthetic pointerType on real mouse events. No physical phone acceptance.',checks:[],browsers:[]};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{let f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(f===root)f=path.join(root,'index.html');if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',mime[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
const url=()=>arg('--url')||`http://127.0.0.1:${server.address().port}/`;
async function settle(page){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...new Set([...document.querySelectorAll('#board image')].map(e=>e.getAttribute('href')))].map(async src=>{const image=new Image();image.src=src;await image.decode();}));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});}
const view=page=>page.locator('[data-node="S"]').evaluate(e=>e.parentElement.getAttribute('transform'));
const count=page=>page.locator('.edge:not(.candidate)').count();
async function center(page,id){const {a}=await wiringBounds(page,id,id);return {x:a.x+a.width/2,y:a.y+a.height/2};}
async function choose(page,id){await page.locator('#home').click();await page.getByRole('button',{name:new RegExp('^'+id+' ')}).click();await settle(page);}
async function mouseDrag(page,a,b){await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();await settle(page);}
async function touchStroke(cdp,points){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...points[0],id:1}]});for(const p of points.slice(1))await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
async function noSinglePan(page,cdp,label){
  const area=await page.locator('#board').boundingBox(),a={x:area.x+18,y:area.y+42},b={x:a.x+70,y:a.y+70},before=await view(page),edges=await count(page);
  if(cdp)await touchStroke(cdp,[a,b]);else await mouseDrag(page,a,b);
  await settle(page);const after=await view(page);
  assert.equal(after,before,label+' one-finger background drag must not move the circuit');assert.equal(await count(page),edges);
  report.checks.push({label,before,after,passed:true});
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{for(const engine of ['chromium','webkit']){
 const browser=await pw[engine].launch({headless:true});report.browsers.push({engine,version:browser.version()});try{
 const context=await browser.newContext({viewport:{width:436,height:1000},isMobile:true,hasTouch:true});
 await context.addInitScript(()=>{window.__touchMode=true;window.__direction={angle:0,type:'portrait-primary'};const o=new EventTarget();Object.defineProperties(o,{angle:{get:()=>__direction.angle},type:{get:()=>__direction.type}});Object.defineProperty(screen,'orientation',{get:()=>o});});
 if(engine==='webkit')await context.addInitScript(()=>{const descriptor=Object.getOwnPropertyDescriptor(PointerEvent.prototype,'pointerType');Object.defineProperty(PointerEvent.prototype,'pointerType',{get(){return window.__touchMode?'touch':descriptor.get.call(this);}});});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url());await enterApp(page);await skipGuide(page);await settle(page);
 const cdp=engine==='chromium'?await context.newCDPSession(page):null;
 await noSinglePan(page,cdp,engine+' portrait');
 const original=await view(page),s=await center(page,'S'),a=await center(page,'A'),g=await center(page,'G');
 if(cdp)await touchStroke(cdp,[s,a,g]);else{await page.mouse.move(s.x,s.y);await page.mouse.down();await page.mouse.move(a.x,a.y,{steps:8});await page.mouse.move(g.x,g.y,{steps:8});await page.mouse.up();}await settle(page);
 assert.equal(await count(page),2);assert.equal(await view(page),original);report.checks.push({label:engine+' uninterrupted touch S-A-G builds both roads without moving board',passed:true});
 const edge=await page.locator('.edge:not(.candidate) .edge-label-card').first().boundingBox(),start={x:edge.x+edge.width/2,y:edge.y+edge.height/2},end={x:start.x+50,y:start.y+40};
 if(cdp)await touchStroke(cdp,[start,end]);else await mouseDrag(page,start,end);assert.equal(await view(page),original);assert.equal(await count(page),2);report.checks.push({label:engine+' touching a road card does not drag the whole circuit',passed:true});
 if(cdp){
   const area=await page.locator('#board').boundingBox(),p={x:area.x+70,y:area.y+70,id:1},q={x:area.x+150,y:area.y+70,id:2};
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p,q]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,x:p.x+35,y:p.y+25},{...q,x:q.x+35,y:q.y+25}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   const shifted=await view(page);assert.notEqual(shifted,original);assert.equal(await count(page),2);report.checks.push({label:'Chromium two fingers translate without creating or changing wiring',passed:true});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p,q]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,x:p.x-15},{...q,x:q.x+15}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.notEqual(await view(page),shifted);assert.equal(await count(page),2);await page.locator('#fit').click();await settle(page);
   report.checks.push({label:'Chromium pinch retains zoom and fit with all wiring unchanged',passed:true});
 }
 await startAndPause(page);await page.evaluate(()=>{for(let i=0;i<40&&!document.getElementById('next').disabled;i++)document.getElementById('next').click();});await settle(page);
 const result=await page.locator('#result').textContent();assert(result.includes('2.5秒')&&result.includes('100.00点'));assert(await page.locator('.arrival-art .arrival-glow').count()>0);assert.equal(await page.locator('.arrival-ring').count(),0);
 // Freeze decorative animation only to compare frames at a reproducible 400 ms.
 await page.locator('#clear-dismiss').click();await page.locator('.arrival-art').evaluateAll(items=>items.forEach(e=>{e.style.setProperty('--arrival-age','0ms');for(const a of e.getAnimations({subtree:true})){a.pause();a.currentTime=400;}}));await page.screenshot({path:path.join(out,engine+'-bell-arrival.png')});
 await page.waitForFunction(()=>document.querySelectorAll('.arrival-art').length===0,{},{timeout:4000});assert.equal(await page.locator('#result').textContent(),result);await page.locator('#stop').click();report.checks.push({label:engine+' altar glow fades without changing time or score',passed:true});
 for(const id of ['Q1','Q6']){await choose(page,id);await page.screenshot({path:path.join(out,engine+'-'+id+'-portrait.png')});}
 const separation=await page.evaluate(()=>({nodes:document.querySelectorAll('.node-separation').length,paths:document.querySelectorAll('.edge-backdrop').length,backgroundOpacity:getComputedStyle(document.querySelector('.observatory')).opacity,shadow:getComputedStyle(document.querySelector('.node-symbol')).filter}));assert.equal(separation.nodes,5);assert.equal(separation.paths,8);assert.equal(separation.backgroundOpacity,'0.72');assert.notEqual(separation.shadow,'none');report.checks.push({label:engine+' local soft separation preserves adopted background opacity',...separation,passed:true});
 for(const angle of [90,270,0]){await page.evaluate(angle=>{Object.assign(__direction,{angle,type:angle?angle===90?'landscape-primary':'landscape-secondary':'portrait-primary'});screen.orientation.dispatchEvent(new Event('change'));},angle);await page.setViewportSize(angle?{width:1000,height:436}:{width:436,height:1000});await settle(page);await noSinglePan(page,cdp,engine+' direction '+angle);await page.screenshot({path:path.join(out,engine+'-direction-'+angle+'.png')});}
 await page.emulateMedia({reducedMotion:'reduce'});const reduced=await page.evaluate(()=>{const sample=document.createElementNS('http://www.w3.org/2000/svg','g');sample.classList.add('arrival-art');const star=document.createElementNS(sample.namespaceURI,'circle');star.classList.add('constellation-star');sample.append(star);document.getElementById('board-detail').append(sample);const style=getComputedStyle(star),result={animation:style.animationName,opacity:style.opacity};sample.remove();return result;});assert.equal(reduced.animation,'none');assert(Number(reduced.opacity)>0);report.checks.push({label:engine+' reduced motion retains static star feedback',...reduced,passed:true});
 if(cdp)await cdp.detach();assert.deepEqual(errors,[]);await context.close();
 const desktop=await browser.newContext({viewport:{width:1280,height:800}}),pc=await desktop.newPage();await pc.goto(url());await enterApp(pc);await skipGuide(pc);await settle(pc);const area=await pc.locator('#board').boundingBox(),old=await view(pc);await mouseDrag(pc,{x:area.x+18,y:area.y+40},{x:area.x+88,y:area.y+90});assert.notEqual(await view(pc),old);await pc.locator('#fit').click();await settle(pc);await pc.screenshot({path:path.join(out,engine+'-desktop.png')});report.checks.push({label:engine+' desktop mouse pan and fit remain available',passed:true});await desktop.close();
 }finally{await browser.close();}
}report.passed=true;console.log('Mobile separation checks passed: '+report.checks.length);}catch(e){report.passed=false;report.failure=e.stack;console.error(e.stack);process.exitCode=1;}finally{fs.writeFileSync(reportFile,JSON.stringify(report,null,2));await new Promise(r=>server.close(r));}})();
