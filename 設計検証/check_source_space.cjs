// Rendering and real UI input in disposable PC browsers; not device acceptance.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {enterApp,selectChallenge,wiringBounds,dragConnection,startAndPause}=require('./browser_wait.cjs');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),engine=arg('--engine')||'chromium',channel=arg('--channel'),root=path.resolve(__dirname,'../dist'),version=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version;
const out=path.join(__dirname,'星の秒数と盤面余白',version,arg('--url')?new URL(arg('--url')).hostname:'local',channel||engine);fs.mkdirSync(out,{recursive:true});
const file=path.join(out,'report.json');if(fs.existsSync(file))fs.copyFileSync(file,path.join(out,'previous-'+Date.now()+'.json'));
const report={version,checks:[],evidence:'PC browsers; phone viewports, orientation and enlarged text are emulated. Physical devices remain unverified.'};
const check=(label,data={})=>report.checks.push({label,passed:true,...data});
const server=http.createServer((req,res)=>{let f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(f===root)f=path.join(root,'index.html');if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.ttf':'font/ttf'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
const geometry=p=>p.evaluate(()=>{const rect=e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,w:b.width,h:b.height};},source=document.querySelector('.node.source');return{board:rect(document.getElementById('board')),scene:rect(document.querySelector('.scene-shade')),source:rect(source.querySelector('.node-symbol')),time:rect(source.querySelector('.node-time')),timeText:source.querySelector('.node-time').textContent,viewBox:document.getElementById('board').getAttribute('viewBox'),nodes:[...document.querySelectorAll('[data-node]')].map(e=>({id:e.dataset.node,...rect(e.querySelector('.node-hit'))})),controls:[...document.querySelectorAll('#stage-controls button')].filter(e=>e.getClientRects().length&&!e.closest('[hidden]')).map(rect),scroll:document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1};});
const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
const within=(a,b)=>a.x>=b.x-1&&a.y>=b.y-1&&a.x+a.w<=b.x+b.w+1&&a.y+a.h<=b.y+b.h+1;
(async()=>{let browser;await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 browser=await pw[engine].launch({headless:true,...(channel?{channel}:{})});report.browser={engine,channel,version:browser.version()};
 for(const s of [{name:'portrait',width:412,height:844,mobile:true},{name:'small',width:320,height:568,mobile:true},{name:'enlarged',width:320,height:480,mobile:true,large:true},{name:'left',width:844,height:412,mobile:true,angle:90},{name:'right',width:844,height:412,mobile:true,angle:270},{name:'desktop',width:1440,height:900}]){
  const c=await browser.newContext({viewport:{width:s.width,height:s.height},isMobile:!!s.mobile,hasTouch:!!s.mobile});try{
   await c.addInitScript(angle=>{const o=new EventTarget();Object.defineProperties(o,{angle:{get:()=>angle},type:{get:()=>angle?'landscape-primary':'portrait-primary'}});Object.defineProperty(screen,'orientation',{get:()=>o});},s.angle||0);
   const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(arg('--url')||`http://127.0.0.1:${server.address().port}/`);await enterApp(p);if(s.large)await p.evaluate(()=>{document.documentElement.style.fontSize='28px';dispatchEvent(new Event('resize'));});
   for(let n=1;n<=12;n++){
    const id='Q'+n;if(n!==1)await selectChallenge(p,id);await wiringBounds(p,'S','A');const g=await geometry(p);assert(!g.scroll,s.name+' '+id+' page fits');assert(within(g.time,g.board),s.name+' '+id+' source time fits field');assert(overlap(g.time,g.source)<1,s.name+' '+id+' source time does not cover star');for(const control of g.controls)assert(overlap(g.time,control)<1,s.name+' '+id+' source time avoids controls');
    if(s.name==='portrait'){assert(within(g.time,g.scene),id+' source seconds are inside the background');assert(Math.abs(g.time.y+g.time.h/2-g.source.y-g.source.h/2)<g.source.h/2,id+' source seconds are alongside star');}
    check(s.name+' '+id+' seconds and expanded field fit',g);
    if(n===2&&['portrait','small','left','desktop','enlarged'].includes(s.name))await p.screenshot({path:path.join(out,s.name+'-Q2.png')});
   }
   await selectChallenge(p,'Q1');await wiringBounds(p,'S','A');const before=await geometry(p);await dragConnection(p,'S','A');await dragConnection(p,'A','G');assert.deepEqual(await p.locator('.edge:not(.candidate)').evaluateAll(es=>es.map(e=>e.dataset.edge).sort()),['AG','SA']);const wired=await geometry(p);assert.deepEqual(wired,before,'Wiring must not move the field or source');
   await startAndPause(p);const running=await geometry(p);assert.deepEqual(running,before,'Starting must not move the field or source');await p.locator('#stop').click();check(s.name+' wiring and execution keep geometry stable');
   await p.locator('#clear-wires').click();await p.locator('#zoom-in').click();await p.locator('#fit').click();await wiringBounds(p,'S','A');const fitted=await geometry(p);assert(within(fitted.time,fitted.board));assert(!fitted.scroll);check(s.name+' zoom and fit retain readable source time');
   assert.deepEqual(errors,[]);check(s.name+' no browser errors');
  }finally{await c.close();}
 }
 report.passed=true;console.log('Source-space checks passed: '+report.checks.length);
 }catch(e){report.passed=false;report.failure=e.stack;console.error(e.stack);process.exitCode=1;}finally{await browser?.close();fs.writeFileSync(file,JSON.stringify(report,null,2));await new Promise(r=>server.close(r));}})();
