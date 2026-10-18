// Real PC browser gestures and Chromium protocol touch; no physical-device claim.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {enterApp,wiringBounds,selectChallenge}=require('./browser_wait.cjs');
const arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),engine=arg('--engine')||'chromium',channel=arg('--channel'),root=path.resolve(__dirname,'../dist');
const version=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version;
const out=path.join(__dirname,'結線操作',version,arg('--url')?new URL(arg('--url')).hostname:'local',channel||engine,...(arg('--scenario')?['scenario-'+arg('--scenario')]:[]));fs.mkdirSync(out,{recursive:true});
const report={version,checks:[],evidence:'Disposable PC browsers, mouse and protocol touch. Phone directions and enlarged text are emulated. Real-phone response remains unverified.'};
const file=path.join(out,'report.json');if(fs.existsSync(file)&&JSON.parse(fs.readFileSync(file)).passed===false)fs.copyFileSync(file,path.join(out,'failed-'+Date.now()+'.json'));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{let f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(f===root)f=path.join(root,'index.html');if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',mime[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
const check=(label,data={})=>report.checks.push({label,passed:true,...data});
const settle=page=>page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
const center=async(page,id)=>{const {a}=await wiringBounds(page,id,id);return{x:a.x+a.width/2,y:a.y+a.height/2,r:Math.min(a.width,a.height)/2};};
const edges=page=>page.locator('#board .edge:not(.candidate)').evaluateAll(es=>es.map(e=>e.dataset.edge).sort());
const start=async(page,id)=>{const p=await center(page,id);await page.mouse.move(p.x,p.y);await page.mouse.down();return p;};
const move=async(page,id)=>{const p=await center(page,id);await page.mouse.move(p.x,p.y);return p;};
async function empty(page){const b=await page.locator('#board').boundingBox();await page.mouse.move(b.x+8,b.y+10);}
async function clear(page){if(!await page.locator('#clear-wires').isDisabled())await page.locator('#clear-wires').click();}
async function loupe(page,p,previous,label){
 const state=await page.evaluate(()=>{const e=document.getElementById('wire-magnifier'),r=e.getBoundingClientRect(),b=document.getElementById('board').getBoundingClientRect(),m=e.querySelector('g').transform.baseVal.consolidate().matrix,board=document.querySelector('#board-detail').getScreenCTM();return{pointer:window.__lastPosition,hidden:e.hidden,inert:e.inert,events:getComputedStyle(e).pointerEvents,x:r.x,y:r.y,w:r.width,h:r.height,board:{left:b.left,top:b.top,right:b.right,bottom:b.bottom},zoom:Math.hypot(m.a,m.b)/Math.hypot(board.a,board.b)*r.width/150};});
 assert.equal(state.hidden,false,label+' visible');assert(state.inert);assert.equal(state.events,'none');assert(Math.abs(state.zoom-1.4)<.01,label+' 1.4x');
 assert(state.x>=state.board.left-.5&&state.y>=state.board.top-.5&&state.x+state.w<=state.board.right+.5&&state.y+state.h<=state.board.bottom+.5,label+' inside board');
 if(previous){assert.equal(state.w,previous.w,label+' stable width');assert.equal(state.h,previous.h,label+' stable height');const actual=state.pointer??p,away=actual.x<previous.x-35||actual.x>previous.x+previous.w+35.1||actual.y<previous.y-35||actual.y>previous.y+previous.h+35.1;if(away){assert.equal(state.x,previous.x,label+' stable x');assert.equal(state.y,previous.y,label+' stable y');}}
 check(label,state);return state;
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await pw[engine].launch({headless:true,...(channel?{channel}:{})});report.browser={engine,channel,version:browser.version()};
 for(const scenario of [{name:'desktop',width:1440,height:900},{name:'portrait',width:412,height:844,mobile:true},{name:'left',width:844,height:412,mobile:true,angle:90},{name:'right',width:844,height:412,mobile:true,angle:270},{name:'short',width:320,height:568,mobile:true},{name:'enlarged',width:412,height:844,mobile:true,enlarged:true}].filter(s=>!arg('--scenario')||arg('--scenario')===s.name)){
  const context=await browser.newContext({viewport:{width:scenario.width,height:scenario.height},isMobile:!!scenario.mobile,hasTouch:!!scenario.mobile});
  try{
   await context.addInitScript(({angle})=>{window.__direction={angle,type:angle?'landscape-primary':'portrait-primary'};const o=new EventTarget();Object.defineProperties(o,{angle:{get:()=>__direction.angle},type:{get:()=>__direction.type}});Object.defineProperty(screen,'orientation',{get:()=>o});document.addEventListener('pointerdown',e=>window.__pointer=e.pointerId,true);for(const type of ['pointerdown','pointermove'])document.addEventListener(type,e=>window.__lastPosition={x:e.clientX,y:e.clientY},true);},{angle:scenario.angle||0});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(arg('--url')||`http://127.0.0.1:${server.address().port}/`);await enterApp(page);await settle(page);
   if(scenario.enlarged){await page.evaluate(()=>{document.documentElement.style.fontSize='28px';dispatchEvent(new Event('resize'));});await settle(page);}
   assert.equal(await page.locator('meta[name=prism-version]').getAttribute('content'),version);
   if(await page.locator('#magnifier-toggle').getAttribute('aria-pressed')!=='true')await page.locator('#magnifier-toggle').click();
   const origin=await start(page,'S');let windowState=await loupe(page,origin,null,scenario.name+' anchored window');
   // Small finger changes away from the window must not make the window jump.
   for(const dx of [-6,6,0]){const p={x:origin.x+dx,y:origin.y-10};await page.mouse.move(p.x,p.y);windowState=await loupe(page,p,windowState,scenario.name+' small movement '+dx);}
   const a=await move(page,'A');windowState=await loupe(page,a,windowState,scenario.name+' continuous prism');
   assert.deepEqual(await edges(page),[]);assert.equal(await page.locator('#board .wiring-planned').count(),1);
   if(['portrait','desktop'].includes(scenario.name))await page.screenshot({path:path.join(out,scenario.name+'-magnifier.png')});
   await empty(page);await page.mouse.up();assert.deepEqual(await edges(page),['SA']);assert(await page.locator('#wire-magnifier').isHidden());assert.equal(await page.locator('#board .wiring-planned').count(),0);check(scenario.name+' final miss preserves accepted S-A');
   assert.equal(await page.locator('#play').isDisabled(),false);await clear(page);
   await start(page,'S');await move(page,'A');await move(page,'B');await page.mouse.up();assert.deepEqual(await edges(page),['SA']);check(scenario.name+' unsupported final direction preserves earlier section');await clear(page);
   await start(page,'S');await move(page,'A');await move(page,'G');await empty(page);await page.mouse.up();assert.deepEqual(await edges(page),['AG','SA']);check(scenario.name+' accepted bell survives release outside');await clear(page);
   await start(page,'S');await empty(page);await page.mouse.up();assert.deepEqual(await edges(page),[]);check(scenario.name+' no accepted endpoint creates no line');
   await start(page,'S');await move(page,'A');await page.evaluate(()=>document.getElementById('board').dispatchEvent(new PointerEvent('pointercancel',{pointerId:__pointer,bubbles:true})));await page.mouse.up();assert.deepEqual(await edges(page),[]);check(scenario.name+' explicit pointer cancel still cancels whole stroke');
   await start(page,'S');const near=await center(page,'A');await page.mouse.move(near.x,near.y+near.r+2);assert.equal(await page.locator('#board .wiring-planned').count(),1);await empty(page);await page.mouse.up();assert.deepEqual(await edges(page),['SA']);check(scenario.name+' pass margin follows part hit size');await clear(page);
   await start(page,'S');await move(page,'A');await page.evaluate(()=>{__direction.angle=__direction.angle?0:90;__direction.type=__direction.angle?'landscape-primary':'portrait-primary';screen.orientation.dispatchEvent(new Event('change'));});await page.mouse.up();await settle(page);assert.deepEqual(await edges(page),[]);check(scenario.name+' direction change cancels provisional stroke');
   await page.evaluate(angle=>{__direction.angle=angle;__direction.type=angle?'landscape-primary':'portrait-primary';screen.orientation.dispatchEvent(new Event('change'));},scenario.angle||0);await settle(page);
   assert.equal(await page.locator('#menu').evaluate(e=>getComputedStyle(e).touchAction),'manipulation');
   if(engine==='chromium'&&scenario.name==='portrait'){
    const cdp=await context.newCDPSession(page),s=await center(page,'S'),p=await center(page,'A');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:s.x,y:s.y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x,y:p.y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:1},{x:p.x+50,y:p.y+10,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.deepEqual(await edges(page),[]);check('protocol second finger cancels accepted provisional section');
    await start(page,'S');await move(page,'A');await empty(page);await page.mouse.up();
    await page.evaluate(()=>{window.__tapEvents=[];document.addEventListener('click',e=>{const b=e.target.closest('button');if(b)__tapEvents.push(b.id);},true);});
    for(const id of ['candidate-times','magnifier-toggle','magnifier-toggle','candidate-times','sound','menu','dialog-close']){
     const box=await page.locator('#'+id).boundingBox(),point={x:box.x+box.width/2,y:box.y+box.height/2,id:1};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }
    assert.deepEqual(await page.evaluate(()=>__tapEvents),['candidate-times','magnifier-toggle','magnifier-toggle','candidate-times','sound','menu','dialog-close']);check('seven actual protocol taps immediately after wiring all reach their buttons');await cdp.detach();
   }
   assert.deepEqual(errors,[]);check(scenario.name+' no script errors');
  }finally{await context.close();}
 }
 const free=await browser.newContext({viewport:{width:412,height:844},isMobile:true,hasTouch:true});try{
  const page=await free.newPage();await page.goto(arg('--url')||`http://127.0.0.1:${server.address().port}/`);await page.locator('#title-free').click();await settle(page);const before=await edges(page);await start(page,'S');await move(page,'A');await empty(page);await page.mouse.up();assert.equal((await edges(page)).length,before.length+1);check('free creation also keeps accepted section on final miss');
 }finally{await free.close();}
 report.passed=true;console.log('Forgiving wiring checks passed: '+report.checks.length);
 }catch(e){report.passed=false;report.failure=e.stack;console.error(e.stack);process.exitCode=1;}finally{await browser?.close();fs.writeFileSync(file,JSON.stringify(report,null,2));await new Promise(r=>server.close(r));}})();
