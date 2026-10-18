// Budget feedback through the real UI; no physical-phone usability claim.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {enterApp,wiringBounds,selectChallenge,dragConnection,holdWire}=require('./browser_wait.cjs');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),engine=arg('--engine')||'chromium',channel=arg('--channel'),root=path.resolve(__dirname,'../dist'),version=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version;
const out=path.join(__dirname,'配線の上限',version,arg('--url')?new URL(arg('--url')).hostname:'local',channel||engine);fs.mkdirSync(out,{recursive:true});
const report={version,checks:[],evidence:'Disposable PC browsers. Mouse and Chromium protocol touch; phone orientation and text size emulated. Real-device usability remains unverified.'},file=path.join(out,'report.json');
if(fs.existsSync(file))fs.copyFileSync(file,path.join(out,'previous-'+Date.now()+'.json'));
const server=http.createServer((req,res)=>{let f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(f===root)f=path.join(root,'index.html');if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.ttf':'font/ttf'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
const check=(label,data={})=>report.checks.push({label,passed:true,...data});
const edges=page=>page.locator('#board .edge:not(.candidate)').evaluateAll(es=>es.map(e=>e.dataset.edge).sort());
const center=async(page,id)=>{const {a}=await wiringBounds(page,id,id);return{x:a.x+a.width/2,y:a.y+a.height/2};};
const start=async(page,id)=>{const p=await center(page,id);await page.mouse.move(p.x,p.y);await page.mouse.down();return p;};
const move=async(page,id)=>{const p=await center(page,id);await page.mouse.move(p.x,p.y);return p;};
async function holdVisibleWire(page,id){
 for(let attempt=0;attempt<4;attempt++){
  const point=await page.locator('#board .edge:not(.candidate)[data-edge="'+id+'"] .edge-line').evaluate((line,id)=>{for(const fraction of [.5,.4,.6,.3,.7,.2,.8]){const p=line.getPointAtLength(line.getTotalLength()*fraction).matrixTransform(line.getScreenCTM()),hit=document.elementFromPoint(p.x,p.y);if(hit?.closest('[data-edge]')?.dataset.edge===id&&!hit.closest('[data-node]'))return{x:p.x,y:p.y};}return null;},id);
  if(point){await page.mouse.move(point.x,point.y);await page.mouse.down();try{await page.waitForFunction(()=>document.getElementById('wire-delete-toast').open,null,{timeout:2000});}finally{await page.mouse.up();}return attempt>0;}
  if(attempt===3)throw Error('No exposed wire segment after bounded zoom');await page.locator('#zoom-in').click();await wiringBounds(page,'S','A');
 }
}
(async()=>{let browser;await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 browser=await pw[engine].launch({headless:true,...(channel?{channel}:{})});report.browser={engine,channel,version:browser.version()};
 for(const s of [{name:'desktop',width:1440,height:900},{name:'portrait',width:412,height:844,mobile:true},{name:'left',width:844,height:412,mobile:true,angle:90},{name:'right',width:844,height:412,mobile:true,angle:270},{name:'short',width:320,height:568,mobile:true},{name:'short-large',width:320,height:480,mobile:true,enlarged:true,reduced:true},{name:'large-reduced',width:412,height:844,mobile:true,enlarged:true,reduced:true}]){
  const context=await browser.newContext({viewport:{width:s.width,height:s.height},isMobile:!!s.mobile,hasTouch:!!s.mobile,reducedMotion:s.reduced?'reduce':'no-preference'});
  try{
   await context.addInitScript(angle=>{const o=new EventTarget();Object.defineProperties(o,{angle:{get:()=>angle},type:{get:()=>angle?'landscape-primary':'portrait-primary'}});Object.defineProperty(screen,'orientation',{get:()=>o});},s.angle||0);
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(arg('--url')||`http://127.0.0.1:${server.address().port}/`);await enterApp(page);
   assert.equal(await page.locator('meta[name=prism-version]').getAttribute('content'),version);
   if(s.enlarged){await page.evaluate(()=>{document.documentElement.style.fontSize='28px';dispatchEvent(new Event('resize'));});}
   await dragConnection(page,'S','A');await dragConnection(page,'A','G');assert.deepEqual(await edges(page),['AG','SA']);
   assert.equal(await page.locator('#wire-budget').getAttribute('data-remaining'),'0');
   const remaining=page.locator('#wire-budget>.wire-counter:last-child'),zero=await remaining.evaluate(e=>({text:e.textContent,color:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor}));assert.match(zero.text,/残り0/);assert.notEqual(zero.bg,'rgba(0, 0, 0, 0)');check(s.name+' zero stays visibly distinct',zero);
   const before=await edges(page),geometry=await page.locator('#board').boundingBox();await page.evaluate(()=>{window.__notices=0;const n=document.getElementById('wire-limit-notice');new MutationObserver(es=>{for(const e of es)if(e.oldValue!==null)__notices++;}).observe(n,{attributes:true,attributeOldValue:true,attributeFilter:['hidden']});});
   await start(page,'S');assert(await page.locator('#wire-limit-notice').isHidden());const b=await move(page,'B');
   await page.locator('#wire-limit-notice').waitFor({state:'visible'});assert.match(await page.locator('#wire-limit-notice').innerText(),/上限.*2本/);
   const feedback=await page.locator('#wire-limit-notice').evaluate(e=>{const r=e.getBoundingClientRect();return{role:e.getAttribute('role'),events:getComputedStyle(e).pointerEvents,x:r.x,y:r.y,w:r.width,h:r.height,scroll:e.scrollHeight<=e.clientHeight+1};});assert.equal(feedback.role,'status');assert.equal(feedback.events,'none');assert(feedback.x>=0&&feedback.y>=0&&feedback.x+feedback.w<=s.width+.5&&feedback.y+feedback.h<=s.height+.5);assert(feedback.scroll);
    assert.equal(await page.locator('#board').evaluate(e=>getComputedStyle(e).overflow),'hidden');
    const protectedAreas=await page.locator('#board,#play-controls,header,.node-symbol').evaluateAll(es=>{const b=document.getElementById('board').getBoundingClientRect();return es.map(e=>{const r=e.getBoundingClientRect(),part=e.classList.contains('node-symbol'),x=part?Math.max(b.left,r.left):r.left,y=part?Math.max(b.top,r.top):r.top,right=part?Math.min(b.right,r.right):r.right,bottom=part?Math.min(b.bottom,r.bottom):r.bottom;return{id:e.id||e.getAttribute('class'),x,y,w:Math.max(0,right-x),h:Math.max(0,bottom-y)};}).filter(r=>r.w>0&&r.h>0);});
   for(const r of protectedAreas)assert(Math.min(feedback.x+feedback.w,r.x+r.w)<=Math.max(feedback.x,r.x)+.5||Math.min(feedback.y+feedback.h,r.y+r.h)<=Math.max(feedback.y,r.y)+.5,s.name+' notice must not overlap field, parts, header or play controls: '+r.id);
   assert.equal(await page.locator('footer #hint,footer #result-line').count(),0);check(s.name+' notice has a reserved area outside every circuit part; lower duplicate rows removed');
   assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(await page.locator('#app').evaluate(e=>e.inert),false);assert.equal(await page.locator('#play').isEnabled(),true);
   const animation=await remaining.evaluate(e=>getComputedStyle(e).animationName);assert.equal(animation==='none',!!s.reduced);check(s.name+' attempt shows nonmodal message and respects motion',{feedback,animation});
   for(const dx of [-4,4,0])await page.mouse.move(b.x+dx,b.y);assert.equal(await page.evaluate(()=>__notices),1,'Once per gesture');await page.mouse.up();assert.deepEqual(await edges(page),before);assert.deepEqual(await page.locator('#board').boundingBox(),geometry);check(s.name+' repeated movement never adds wires or moves board');
   if(['desktop','portrait'].includes(s.name))await page.screenshot({path:path.join(out,s.name+'-limit.png')});
   await page.locator('#candidate-times').click();assert(await page.locator('#wire-limit-notice').isHidden());check(s.name+' next control works immediately and dismisses message');
   const zoomed=await holdVisibleWire(page,'SA');await page.locator('#wire-delete-ok').click();assert.equal(await page.locator('#wire-budget').getAttribute('data-remaining'),'1');if(zoomed)await page.locator('#fit').click();await dragConnection(page,'S','B');assert.deepEqual(await edges(page),['AG','SB']);check(s.name+' deleting one frees a slot that can immediately be reused');
   await page.locator('#clear-wires').click();assert.deepEqual(await edges(page),[]);assert.equal(await page.locator('#wire-budget').getAttribute('data-remaining'),'2');check(s.name+' clear restores count and normal appearance');
   // One remaining slot consumed mid-stroke: keep accepted sections, reject only the excess.
    await selectChallenge(page,'Q2');await dragConnection(page,'A','G');await start(page,'S');await move(page,'A');await move(page,'C');assert.equal(await page.locator('#wire-limit-notice').isHidden(),true,'Reaching last allowed part alone is not an error');await move(page,'G');await page.locator('#wire-limit-notice').waitFor({state:'visible'});await page.mouse.up();assert.deepEqual(await edges(page),['AC','AG','SA']);assert.equal(await page.locator('#wire-budget').getAttribute('data-remaining'),'0');check(s.name+' continuous overflow keeps accepted route within limit');
   if(s.name==='portrait'){
    await page.locator('#wire-limit-notice').waitFor({state:'hidden',timeout:5000});await start(page,'S');await move(page,'B');await page.locator('#wire-limit-notice').waitFor({state:'visible'});await page.mouse.up();check('message expires and a fresh attempt announces again');
    if(engine==='chromium'){const cdp=await context.newCDPSession(page),p=await center(page,'S'),q=await center(page,'B');await page.locator('#candidate-times').click();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...q,id:1}]});assert(await page.locator('#wire-limit-notice').isVisible());await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal((await edges(page)).length,3);await cdp.detach();check('native protocol touch at zero also gives feedback without overflow');}
   }
   assert.deepEqual(errors,[]);check(s.name+' no script errors');
  }finally{await context.close();}
 }
 const context=await browser.newContext({viewport:{width:412,height:844},isMobile:true,hasTouch:true});try{const page=await context.newPage();await page.goto(arg('--url')||`http://127.0.0.1:${server.address().port}/`);await page.locator('#title-free').click();await dragConnection(page,'S','A');assert(await page.locator('#wire-limit-notice').isHidden());check('free creation has no budget warning');}finally{await context.close();}
 report.passed=true;console.log('Wire budget checks passed: '+report.checks.length);
 }catch(e){report.passed=false;report.failure=e.stack;console.error(e.stack);process.exitCode=1;}finally{await browser?.close();fs.writeFileSync(file,JSON.stringify(report,null,2));await new Promise(r=>server.close(r));}})();
