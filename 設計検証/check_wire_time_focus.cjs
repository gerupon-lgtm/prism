// Actual PC browser pointer gestures; phone sizes and directions are emulated.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {enterApp,wiringBounds,selectChallenge}=require('./browser_wait.cjs');
const arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),channel=arg('--channel'),engine=arg('--engine')||'chromium',root=path.resolve(__dirname,'../dist');
const version=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version;
const out=path.join(__dirname,'結線中の秒数',version,arg('--url')?new URL(arg('--url')).hostname:'local',channel||engine);fs.mkdirSync(out,{recursive:true});
const file=path.join(out,'report.json');if(fs.existsSync(file)&&JSON.parse(fs.readFileSync(file)).passed===false)fs.copyFileSync(file,path.join(out,'failed-'+Date.now()+'.json'));
const report={version,evidence:'Disposable PC browsers; real mouse and Chromium protocol touch; emulated phone direction and CSS text enlargement. Not physical-device acceptance.',checks:[],browsers:[]};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.ttf':'font/ttf','.png':'image/png'};
const server=http.createServer((req,res)=>{let f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(f===root)f=path.join(root,'index.html');if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',mime[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
const check=(label,data={})=>report.checks.push({label,passed:true,...data});
const settle=page=>page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
const center=async(page,id)=>{const {a}=await wiringBounds(page,id,id);return{x:a.x+a.width/2,y:a.y+a.height/2};};
const curvePoint=(page,id,t=.5)=>page.locator(`#board [data-edge="${id}"] .edge-line`).evaluate((line,t)=>{const p=line.getPointAtLength(line.getTotalLength()*t).matrixTransform(line.getScreenCTM());return{x:p.x,y:p.y};},t);
async function focus(page,id,label){
 const state=await page.evaluate(()=>{const line=e=>{const s=getComputedStyle(e.querySelector('.edge-line'));return{stroke:s.stroke,dash:s.strokeDasharray,width:s.strokeWidth,effect:s.vectorEffect};};return{focus:[...document.querySelectorAll('#board .wiring-focus')].map(e=>({id:e.dataset.edge,hidden:e.querySelector('.edge-label').hasAttribute('hidden'),fill:getComputedStyle(e.querySelector('.edge-label-card')).fill,text:getComputedStyle(e.querySelector('.edge-time')).fill,line:line(e)})),planned:[...document.querySelectorAll('#board .wiring-planned')].map(e=>({id:e.dataset.edge,line:line(e)})),built:[...document.querySelectorAll('#board .edge:not(.candidate)')].map(e=>e.dataset.edge)};});
 assert.deepEqual(state.focus.map(x=>x.id),id?[id]:[],label);if(id){assert.equal(state.focus[0].hidden,false,label+' card visible');assert.equal(state.focus[0].fill,'rgb(241, 210, 139)',label+' gold card');assert.equal(state.focus[0].text,'rgb(21, 32, 53)',label+' dark text');}
 for(const p of [...state.focus,...state.planned]){assert.equal(p.line.stroke,'rgb(143, 228, 255)',label+' cyan provisional line');assert.notEqual(p.line.dash,'none',label+' provisional remains dashed');assert.equal(p.line.width,'3.5px',label+' clear screen width');assert.equal(p.line.effect,'non-scaling-stroke',label+' zoom keeps line width');}
 check(label,state);
}
async function down(page,id){const p=await center(page,id);await page.mouse.move(p.x,p.y);await page.mouse.down();}
async function moveTo(page,id){const p=await center(page,id);await page.mouse.move(p.x,p.y);}
async function moveLine(page,id){const p=await curvePoint(page,id);await page.mouse.move(p.x,p.y);}
async function earlyPoint(page,id,from){
 const origin=await center(page,from),toward=await curvePoint(page,id),dx=toward.x-origin.x,dy=toward.y-origin.y,length=Math.hypot(dx,dy);
 return{x:origin.x+dx/length*18,y:origin.y+dy/length*18};
}
async function cancel(page){await page.evaluate(()=>document.getElementById('board').dispatchEvent(new PointerEvent('pointercancel',{pointerId:__pointer,bubbles:true})));await page.mouse.up();}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await pw[engine].launch({headless:true,...(channel?{channel}:{})});report.browsers.push({engine,channel,version:browser.version()});
 for(const scenario of [{name:'desktop',width:1440,height:900},{name:'portrait',width:390,height:844,mobile:true},{name:'landscape-left',width:844,height:390,mobile:true,angle:90},{name:'landscape-right',width:844,height:390,mobile:true,angle:270},{name:'enlarged',width:390,height:844,mobile:true,enlarged:true}]){
  const context=await browser.newContext({viewport:{width:scenario.width,height:scenario.height},isMobile:!!scenario.mobile,hasTouch:!!scenario.mobile,reducedMotion:'reduce'});
  try{
   await context.addInitScript(({angle})=>{const o=new EventTarget();Object.defineProperties(o,{angle:{get:()=>angle},type:{get:()=>angle?'landscape-primary':'portrait-primary'}});Object.defineProperty(screen,'orientation',{get:()=>o});document.addEventListener('pointerdown',e=>{window.__pointer=e.pointerId;},true);},{angle:scenario.angle||0});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(arg('--url')||`http://127.0.0.1:${server.address().port}/`);await enterApp(page);await settle(page);
   if(scenario.enlarged){await page.evaluate(()=>{document.documentElement.style.fontSize='28px';dispatchEvent(new Event('resize'));});await settle(page);}
   assert.equal(await page.locator('meta[name=prism-version]').getAttribute('content'),version);
   const original=await page.locator('#board [data-edge="SA"] .edge-label-card').boundingBox();
   await focus(page,null,scenario.name+' idle');await down(page,'S');await focus(page,null,scenario.name+' origin has no arbitrary highlight');
    const earlyA=await earlyPoint(page,'SA','S'),earlyB=await earlyPoint(page,'SB','S');
    await page.mouse.move(earlyA.x,earlyA.y);await focus(page,'SA',scenario.name+' highlights after only 18px toward A');
    const origin=await center(page,'S');await page.mouse.move(origin.x,origin.y);await focus(page,null,scenario.name+' return to centre clears early focus');
    const bisector={x:(earlyA.x+earlyB.x)/2-origin.x,y:(earlyA.y+earlyB.y)/2-origin.y},bisectorLength=Math.hypot(bisector.x,bisector.y);
    await page.mouse.move(origin.x+bisector.x/bisectorLength*18,origin.y+bisector.y/bisectorLength*18);await focus(page,null,scenario.name+' ambiguous branch does not choose arbitrarily');
    await page.mouse.move(earlyB.x,earlyB.y);await focus(page,'SB',scenario.name+' early direction switches to B');
   await moveLine(page,'SA');await focus(page,'SA',scenario.name+' approach A');
   const active=await page.locator('#board [data-edge="SA"] .edge-label-card').boundingBox();assert(Math.abs(active.width-original.width)<.1&&Math.abs(active.height-original.height)<.1,'Focus does not resize the card');
   assert.notEqual(await page.locator('#board [data-edge="SB"] .edge-label-card').evaluate(e=>getComputedStyle(e).fill),'rgb(241, 210, 139)');
    if(['desktop','portrait'].includes(scenario.name))await page.screenshot({path:path.join(out,scenario.name+'-focus.png')});
    assert.equal(await page.locator('#board .wire-preview').getAttribute('d'),'','The full coloured candidate replaces a misleading straight finger line');
   await moveLine(page,'SB');await focus(page,'SB',scenario.name+' change approach to B');
   const area=await page.locator('#board').boundingBox();await page.mouse.move(area.x+8,area.y+8);await focus(page,null,scenario.name+' off route');
    assert((await page.locator('#board .wire-preview').getAttribute('d')).length>0,'Unidentified direction still shows a dashed finger tail');
    assert.equal(await page.locator('#board .wire-preview').getAttribute('d'),await page.locator('#board .wire-preview-backdrop').getAttribute('d'));
   await moveLine(page,'SA');await moveTo(page,'A');await focus(page,'SA',scenario.name+' accepted prism keeps incoming seconds visible');
   const earlyNext=await earlyPoint(page,'AG','A');await page.mouse.move(earlyNext.x,earlyNext.y);await focus(page,'AG',scenario.name+' continuous next leg highlights after 18px');
   await moveLine(page,'AG');await focus(page,'AG',scenario.name+' continuous next leg');await moveTo(page,'G');await focus(page,'AG',scenario.name+' accepted bell');
    assert.deepEqual(await page.locator('#board .wiring-planned').evaluateAll(es=>es.map(e=>e.dataset.edge).sort()),['AG','SA']);assert.equal(await page.locator('#board .edge:not(.candidate)').count(),0,'The blue plan stays uncommitted until release');
    if(['desktop','portrait'].includes(scenario.name))await page.screenshot({path:path.join(out,scenario.name+'-planned.png')});
   await page.mouse.up();await focus(page,null,scenario.name+' release clears highlight');assert.equal(await page.locator('#board .edge:not(.candidate)').count(),2);
    assert.equal(await page.locator('#board .wiring-planned').count(),0);assert.equal(await page.locator('#board .wire-preview-backdrop').getAttribute('d'),'');
    const completed=await page.locator('#board .edge:not(.candidate) .edge-line').evaluateAll(es=>es.map(e=>({stroke:getComputedStyle(e).stroke,dash:getComputedStyle(e).strokeDasharray})));for(const s of completed){assert.equal(s.stroke,'rgb(233, 197, 109)');assert.equal(s.dash,'none');}check(scenario.name+' provisional blue dashes become solid gold only on commit');
   await down(page,'S');await moveLine(page,'SB');await focus(page,null,scenario.name+' wire limit does not highlight a rejected candidate');await page.mouse.up();assert.equal(await page.locator('#board .edge:not(.candidate)').count(),2);
    await page.locator('#clear-wires').click();await down(page,'S');await moveLine(page,'SA');await focus(page,'SA',scenario.name+' new stroke');await moveTo(page,'A');await cancel(page);await focus(page,null,scenario.name+' cancel clears highlight');assert.equal(await page.locator('#board .edge:not(.candidate)').count(),0);assert.equal(await page.locator('#board .wiring-planned').count(),0);assert.equal(await page.locator('#board .wire-preview-backdrop').getAttribute('d'),'');
   await page.locator('#zoom-in').click();await down(page,'S');await moveLine(page,'SA');await focus(page,'SA',scenario.name+' zoom uses same screen distance');await cancel(page);
   assert.deepEqual(errors,[]);check(scenario.name+' no script errors');
   if(scenario.name==='portrait'&&engine==='chromium'){
    await page.locator('#fit').click();await settle(page);const cdp=await context.newCDPSession(page),s=await center(page,'S'),p=await curvePoint(page,'SA');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...s,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,id:1}]});await focus(page,'SA','protocol touch follows route');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1},{x:p.x+50,y:p.y+10,id:2}]});await focus(page,null,'second touch clears highlight');await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await page.locator('#board .edge:not(.candidate)').count(),0);await cdp.detach();
   }
  }finally{await context.close();}
 }
 const free=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});try{
  const page=await free.newPage();await page.goto(arg('--url')||`http://127.0.0.1:${server.address().port}/`);await page.locator('#title-free').click();await settle(page);const before=await page.locator('#board .edge:not(.candidate)').count();
  await down(page,'S');await moveTo(page,'A');const tail=await page.locator('#board .wire-preview').evaluate(e=>{const s=getComputedStyle(e);return{d:e.getAttribute('d'),stroke:s.stroke,dash:s.strokeDasharray,width:s.strokeWidth,effect:s.vectorEffect,underParts:!!(e.compareDocumentPosition(document.querySelector('#board [data-node]'))&Node.DOCUMENT_POSITION_FOLLOWING)};});
  assert(tail.d.length>0);assert.equal(tail.stroke,'rgb(143, 228, 255)');assert.notEqual(tail.dash,'none');assert.equal(tail.width,'3.5px');assert.equal(tail.effect,'non-scaling-stroke');assert(tail.underParts);assert.equal(await page.locator('#board .edge:not(.candidate)').count(),before);await page.mouse.up();assert.equal(await page.locator('#board .edge:not(.candidate)').count(),before+1);assert.equal(await page.locator('#board .wire-preview').getAttribute('d'),'');check('free creation uses a cyan dashed plan underneath the parts, without committing early',tail);
 }finally{await free.close();}
 report.passed=true;console.log('Wire time focus checks passed: '+report.checks.length);
}catch(e){report.passed=false;report.failure=e.stack;console.error(e.stack);process.exitCode=1;}finally{await browser?.close();fs.writeFileSync(file,JSON.stringify(report,null,2));await new Promise(r=>server.close(r));}})();
