// Direction indicators are display-only. Validate actual SVG geometry and gestures.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {dragConnection,waitForAsync}=require('./browser_wait.cjs');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),engine=arg('--engine')||'chromium',channel=arg('--channel'),root=path.resolve(__dirname,'../dist');
const version=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version,offline=process.argv.includes('--offline');
const out=path.join(__dirname,'配線の方向',version,arg('--url')?new URL(arg('--url')).hostname:offline?'offline':'local',channel||engine);fs.mkdirSync(out,{recursive:true});
const reportFile=path.join(out,'report.json');if(fs.existsSync(reportFile)&&JSON.parse(fs.readFileSync(reportFile)).passed===false)fs.copyFileSync(reportFile,path.join(out,'failed-'+Date.now()+'.json'));
const report={version,passed:false,checks:[],pending:['Physical phone operation, iOS/iPadOS/macOS Safari.']},check=(label,data={})=>{report.checks.push({label,passed:true,...data});console.log(label);};
const server=http.createServer((req,res)=>{try{let f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(f===root)f=path.join(root,'index.html');if(!f.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.ttf':'font/ttf'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
const settle=p=>p.evaluate(async()=>{await document.fonts.ready;for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});
async function chooseChallenge(p,id){
 const number=await p.evaluate(async id=>{const {challenges}=await import(new URL('../content/challenges.js',document.querySelector('script[type=module]').src));return challenges.find(c=>c.id===id).number;},id);
 for(let n=0;n<30;n++){
  await settle(p);const state=await p.evaluate(({id,number})=>{const item=document.querySelector(`[data-challenge="${id}"]`);if(item)return 'item';const first=[...document.querySelectorAll('#dialog-body .dialog-list button')].map(e=>/^Q(\d+) /.exec(e.textContent)).find(Boolean);return first&&number<Number(first[1])?'previous':'next';},{id,number});
  if(state==='item'){await p.locator(`[data-challenge="${id}"]`).click();return;}
  const pager=p.locator('#dialog-body .pager button'),button=state==='previous'?pager.first():pager.last();
  // The responsive selector can repaginate after it opens. Re-read the target
  // rather than waiting forever on a pager that became disabled meanwhile.
  try{await button.click({timeout:1000});}catch(error){if(!await button.isDisabled())throw error;}
 }
 throw Error('Challenge did not become selectable: '+id);
}
async function selectChallenge(p,id){await p.locator('#home').click();await chooseChallenge(p,id);}
async function inspect(p,label,{requireEach=true}={}){
 await settle(p);const r=await p.evaluate(()=>{
  const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};};
  const world=document.querySelector('#board-detail>g:not([class])'),area=rect(document.getElementById('board'));
  const obstacles=[...document.querySelectorAll('#board .node-hit,#board .node-symbol,#board .node-name,#board .node-time,#board .node-state,#board .edge-label-card,#stage-controls button')].filter(e=>!e.closest('[hidden]')).map(e=>({...rect(e),label:e.closest('[data-node]')?.dataset.node||e.textContent||e.parentElement.dataset.edge}));
  const screen=(line,at)=>line.getPointAtLength(at).matrixTransform(line.getScreenCTM());
  return {area,viewport:[innerWidth,innerHeight],scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],obstacles,edges:[...document.querySelectorAll('#board [data-edge]')].map(e=>{
   const line=e.querySelector('.edge-line'),length=line.getTotalLength(),matrix=line.getScreenCTM();
   const markers=[...e.querySelectorAll('.edge-direction-marker')].map(m=>{const arrow=m.querySelector('.edge-direction'),values=arrow.getAttribute('d').match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi).map(Number),matrix=arrow.getScreenCTM(),[a,tip,b]=[0,2,4].map(i=>new DOMPoint(values[i],values[i+1]).matrixTransform(matrix)),axis={x:tip.x-(a.x+b.x)/2,y:tip.y-(a.y+b.y)/2};let distance=Infinity,at=0;
    for(let i=0;i<=96;i++){const s=length*i/96,q=screen(line,s),d=Math.hypot(q.x-tip.x,q.y-tip.y);if(d<distance){distance=d;at=s;}}
    const step=length/96;for(let i=0;i<=48;i++){const s=Math.max(0,Math.min(length,at-step+2*step*i/48)),q=screen(line,s),d=Math.hypot(q.x-tip.x,q.y-tip.y);if(d<distance){distance=d;at=s;}}
    const before=screen(line,Math.max(0,at-1)),after=screen(line,Math.min(length,at+1)),dx=after.x-before.x,dy=after.y-before.y,sign=Number(m.dataset.direction);
    return {distance,cosine:(axis.x*dx+axis.y*dy)/Math.hypot(axis.x,axis.y)/Math.hypot(dx,dy)*sign,tip:{x:tip.x,y:tip.y},size:Math.hypot(axis.x,axis.y),rect:rect(m),direction:sign,pointerEvents:getComputedStyle(arrow).pointerEvents,color:getComputedStyle(arrow).stroke};
   });const start=screen(line,0),end=screen(line,length);return {id:e.dataset.edge,start:{x:start.x,y:start.y},end:{x:end.x,y:end.y},candidate:e.classList.contains('candidate'),label:e.getAttribute('aria-label'),markers};
  })};
 });
 report.lastGeometry=r;if(requireEach&&r.edges.some(e=>!e.markers.length))await p.screenshot({path:path.join(out,'missing-arrow.png')});assert(r.scroll.every((n,i)=>n<=r.viewport[i]+1),label+' page scroll');
 for(const e of r.edges){if(requireEach)assert(e.markers.length>=1,label+' missing arrow '+e.id);for(const m of e.markers){assert(m.distance<1.5,label+' tip on route '+e.id+' '+m.distance);assert(m.cosine>.97,label+' actual tangent '+e.id+' '+m.cosine);assert(Math.abs(m.size-11)<.1||Math.abs(m.size-8)<.1,label+' screen size '+e.id);assert.equal(m.pointerEvents,'none');for(const b of r.obstacles)assert(Math.min(m.rect.right,b.right)-Math.max(m.rect.left,b.left)<=.6||Math.min(m.rect.bottom,b.bottom)-Math.max(m.rect.top,b.top)<=.6,label+' arrow overlaps part/card '+e.id);}}
 check(label,{edges:r.edges.map(e=>({id:e.id,arrows:e.markers.length})),arrows:r.edges.reduce((n,e)=>n+e.markers.length,0)});return r;
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await pw[engine].launch({headless:true,...(channel?{channel}:{})});report.browser={engine,channel,version:browser.version()};
 for(const scenario of [{name:'phone',width:390,height:844,mobile:true},...(!offline?[{name:'desktop',width:1600,height:1000}]:[])]){
  const context=await browser.newContext({viewport:{width:scenario.width,height:scenario.height},isMobile:!!scenario.mobile,hasTouch:!!scenario.mobile});
  try{
   await context.addInitScript(()=>{Math.random=()=>0;window.__direction={type:'portrait-primary',angle:0};const o=new EventTarget();Object.defineProperties(o,{type:{get:()=>__direction.type},angle:{get:()=>__direction.angle}});Object.defineProperty(screen,'orientation',{get:()=>o});});
   let p=await context.newPage();const errors=[],url=arg('--url')||`http://127.0.0.1:${server.address().port}/`;p.on('pageerror',e=>errors.push(e.message));await p.goto(url);
   if(offline){await waitForAsync(p,async()=>{if(!navigator.serviceWorker.controller)return false;const c=await caches.open('prism-notes:/:'+document.querySelector('meta[name=prism-version]').content),r=await c.match(new URL('build-info.json',location.href));if(!r)return false;const info=await r.json();return(await Promise.all(info.assets.map(a=>c.match(new URL(a,location.href))))).every(Boolean);},{},{timeout:30000});await new Promise(r=>server.close(r));await p.close();p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(url);check('New offline tab starts after origin stops with every asset prepared');}
   await p.locator('#title-challenges').click();await chooseChallenge(p,'Q1');
   const ids=await p.evaluate(async()=>{const {challenges}=await import(new URL('../content/challenges.js',document.querySelector('script[type=module]').src));return challenges.map(c=>({id:c.id,number:c.number}));});
   for(const c of ids){if(c.number>1)await p.locator('#stage-next').click();if(await p.locator('#mirror-intro-start').isVisible())await p.locator('#mirror-intro-start').click();assert.match(await p.locator('#title').textContent(),new RegExp('^Q'+c.number+' '));await inspect(p,scenario.name+' Q'+c.number+' all candidate directions');}
   await selectChallenge(p,'Q20');for(const [a,b]of [['S','A'],['A','C'],['C','G2'],['C','G3']])await dragConnection(p,a,b);
   let r=await inspect(p,scenario.name+' Q10 four wires');const dc=r.edges.find(e=>e.id==='DC');assert.equal(dc.markers.length,2,'D to C has middle and destination markers');assert(dc.markers.every(m=>m.direction===1));
   await p.screenshot({path:path.join(out,scenario.name+'-Q10.png')});const count=()=>p.locator('#board .edge:not(.candidate)').count();assert.equal(await count(),4);
   await dragConnection(p,'C','D');assert.equal(await count(),4);assert(await p.locator('[data-edge="DC"]').evaluate(e=>e.classList.contains('candidate')));await dragConnection(p,'D','C');assert.equal(await count(),5);
   r=await inspect(p,scenario.name+' D to C accepts; C to D refuses without adding a wire');const built=r.edges.find(e=>e.id==='DC');assert(!built.candidate);assert.notEqual(built.markers[0].color,dc.markers[0].color);
   const point=built.markers.at(-1).tip;await p.mouse.move(point.x,point.y);await p.mouse.down();await p.waitForFunction(()=>document.getElementById('wire-delete-toast').open);await p.mouse.up();await p.locator('#wire-delete-ok').click();assert.equal(await count(),4);check(scenario.name+' arrow is input-free; holding its line still deletes only that wire');
   if(await p.locator('#magnifier-toggle').getAttribute('aria-pressed')!=='true')await p.locator('#magnifier-toggle').click();
   const endpoints=await p.evaluate(()=>['D','C'].map(id=>{const r=document.querySelector(`[data-node="${id}"] .node-hit`).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};}));
   await p.mouse.move(endpoints[0].x,endpoints[0].y);await p.mouse.down();await p.mouse.move(endpoints[0].x+(endpoints[1].x-endpoints[0].x)*.42,endpoints[0].y+(endpoints[1].y-endpoints[0].y)*.42,{steps:8});
   await p.waitForFunction(()=>document.querySelector('[data-edge="DC"]').classList.contains('wiring-focus'));assert.equal(await p.locator('[data-edge="DC"] .edge-direction').first().evaluate(e=>getComputedStyle(e).fill),'rgb(166, 238, 255)');assert(await p.locator('#wire-magnifier').isVisible());assert.equal(await p.locator('#wire-magnifier use').getAttribute('href'),'#board-detail');await p.screenshot({path:path.join(out,scenario.name+'-magnifier.png')});await p.mouse.up();assert.equal(await count(),4);check(scenario.name+' provisional cyan directions and same geometry in magnifier; unfinished tail adds no wire');
   for(let i=0;i<3;i++)await p.locator('#zoom-in').click();await inspect(p,scenario.name+' zoom keeps readable direction size',{requireEach:false});await p.locator('#fit').click();
   if(scenario.mobile)for(const [w,h,type,angle,font]of [[320,640,'portrait-primary',0,14],[390,844,'portrait-primary',0,28],[844,390,'landscape-primary',90,14],[844,390,'landscape-secondary',270,14],[390,844,'portrait-primary',0,14]]){
    await p.evaluate(v=>{Object.assign(__direction,v);document.documentElement.style.fontSize=v.font+'px';},{type,angle,font});await p.setViewportSize({width:w,height:h});await p.evaluate(()=>screen.orientation.dispatchEvent(new Event('change')));await inspect(p,`phone ${w}x${h} ${angle} font${font}`,{requireEach:false});
   }
   await p.locator('#menu').click();await p.getByRole('button',{name:'タイトルへ',exact:true}).click();await p.locator('#title-free').click();
   const file={format:'prism-notes-circuit',version:1,name:'双方向と逆向きの平行道',circuit:{mode:'spread',target:'all',nodes:[{id:'S',kind:'source',x:.5,y:.1,process:'0.5'},{id:'A',kind:'prism',x:.25,y:.45,process:'0.5'},{id:'B',kind:'prism',x:.75,y:.45,process:'0.5'},{id:'G',kind:'goal',x:.5,y:.9,process:'0'}],edges:[{id:'SA',from:'S',to:'A',time:'1',bidirectional:true},{id:'AB',from:'A',to:'B',time:'1'},{id:'BA',from:'B',to:'A',time:'2'},{id:'BG',from:'B',to:'G',time:'1'}]}};
   await p.locator('#import').setInputFiles({name:'directions.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(file))});await p.waitForFunction(()=>document.getElementById('app').dataset.mode==='free'&&document.querySelector('[data-edge="BA"]'));r=await inspect(p,scenario.name+' free bidirectional and opposite parallel routes');assert.deepEqual(r.edges.find(e=>e.id==='SA').markers.map(m=>m.direction).sort(),[-1,1]);
   await p.screenshot({path:path.join(out,scenario.name+'-free.png')});
   assert.deepEqual(errors,[]);check(scenario.name+' no JavaScript errors');
  }finally{await context.close();}
 }
 report.passed=true;
}catch(error){report.failure=error.stack;console.error(error.stack);process.exitCode=1;}
finally{await browser?.close();if(server.listening)await new Promise(r=>server.close(r));fs.writeFileSync(reportFile,JSON.stringify(report,null,2));}
})();
