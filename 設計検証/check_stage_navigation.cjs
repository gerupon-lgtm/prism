// Real UI navigation in disposable desktop browsers. Phone layouts are emulated.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chooseChallenge,dragConnection,startAndPause,waitForAsync}=require('./browser_wait.cjs');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),engine=arg('--engine')||'chromium',channel=arg('--channel'),root=path.resolve(__dirname,'../dist');
const version=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version;
const offline=process.argv.includes('--offline');
const out=path.join(__dirname,'面の移動',version,arg('--url')?new URL(arg('--url')).hostname:offline?'offline':'local',channel||engine);fs.mkdirSync(out,{recursive:true});
const reportFile=path.join(out,'report.json');if(fs.existsSync(reportFile)&&JSON.parse(fs.readFileSync(reportFile)).passed===false)fs.copyFileSync(reportFile,path.join(out,'failed-'+Date.now()+'.json'));
const report={version,passed:false,checks:[],pending:['Physical phones, iOS/iPadOS/macOS Safari.']};
const check=(label,data={})=>{report.checks.push({label,passed:true,...data});console.log(label);};
const server=http.createServer((req,res)=>{try{let f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(f===root)f=path.join(root,'index.html');if(!f.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.ttf':'font/ttf'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
const settle=p=>p.evaluate(async()=>{await document.fonts.ready;for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});
async function heading(p,label){await settle(p);const r=await p.evaluate(()=>{
 const ids=['stage-previous','condition-info','stage-next','title','challenge-info','home','play'];
 const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};};
 return {viewport:[innerWidth,innerHeight],scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],rotation:Number(document.documentElement.dataset.boardRotation),title:document.getElementById('title').textContent,parts:ids.map(id=>{const e=document.getElementById(id),s=getComputedStyle(e);return {id,...rect(e),sw:e.scrollWidth,sh:e.scrollHeight,cw:e.clientWidth,ch:e.clientHeight,overflow:s.overflow,textOverflow:s.textOverflow,whiteSpace:s.whiteSpace};})};
 });
 report.lastLayout=r;assert(r.scroll.every((n,i)=>n<=r.viewport[i]+1),label+' page scroll '+JSON.stringify(r));
 for(const e of r.parts){assert(e.x>=-1&&e.y>=-1&&e.right<=r.viewport[0]+1&&e.bottom<=r.viewport[1]+1,label+' bounds '+e.id);if(e.id==='condition-info'||e.id==='title')assert(e.sw<=e.cw+1&&e.sh<=e.ch+1,label+' text fit '+JSON.stringify(e));}
 for(const id of ['stage-previous','stage-next']){const e=r.parts.find(e=>e.id===id);assert(e.w>=39&&e.h>=39,label+' tap size '+id);}
 if(Math.abs(r.rotation)!==90){const c=r.parts.find(e=>e.id==='condition-info'),a=r.parts.find(e=>e.id==='stage-previous');assert(a.y+a.h/2>=c.y-1&&a.y+a.h/2<=c.bottom+1,label+' arrows share heading row');}
 const t=r.parts.find(e=>e.id==='title');assert(t.textOverflow!=='ellipsis'&&t.overflow==='visible',label+' full name');check(label,r);
}
async function currentList(p,id){await p.locator('#condition-info').click();const current=p.locator('[aria-current="step"]');await current.waitFor();await settle(p);assert.equal(await current.getAttribute('data-challenge'),id);await p.waitForFunction(id=>document.activeElement?.dataset.challenge===id,id);assert.match(await current.innerText(),/プレイ中/);assert(await current.isVisible());const r=await current.evaluate(e=>({h:e.clientHeight,sh:e.scrollHeight,w:e.clientWidth,sw:e.scrollWidth,text:e.innerText}));assert(r.sh<=r.h+1&&r.sw<=r.w+1,'current row full text '+JSON.stringify(r));check('Current page, marker and keyboard focus '+id);}
async function showTitle(p){await p.locator('#menu').click();await p.getByRole('button',{name:'タイトルへ',exact:true}).click();await p.locator('#title-screen').waitFor({state:'visible'});}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await pw[engine].launch({headless:true,...(channel?{channel}:{})});report.browser={engine,channel,version:browser.version()};
 for(const scenario of [{name:'phone',width:390,height:844,mobile:true},...(!offline?[{name:'desktop',width:1600,height:1000}]:[])]){
  const context=await browser.newContext({viewport:{width:scenario.width,height:scenario.height},isMobile:!!scenario.mobile,hasTouch:!!scenario.mobile});
  try{
   await context.addInitScript(()=>{Math.random=()=>0;window.__direction={type:'portrait-primary',angle:0};const o=new EventTarget();Object.defineProperties(o,{type:{get:()=>__direction.type},angle:{get:()=>__direction.angle}});Object.defineProperty(screen,'orientation',{get:()=>o});});
   let p=await context.newPage();const errors=[],url=arg('--url')||`http://127.0.0.1:${server.address().port}/`;p.on('pageerror',e=>errors.push(e.message));await p.goto(url);
   if(offline){await waitForAsync(p,async()=>{if(!navigator.serviceWorker.controller)return false;const c=await caches.open('prism-notes:/:'+document.querySelector('meta[name=prism-version]').content),r=await c.match(new URL('build-info.json',location.href));if(!r)return false;const info=await r.json();return(await Promise.all(info.assets.map(a=>c.match(new URL(a,location.href))))).every(Boolean);},{},{timeout:30000});await new Promise(r=>server.close(r));await p.close();p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(url);check('Origin stopped, initial tab closed, fresh offline tab uses all prepared assets');}
   await p.locator('#title-start').click();await p.locator('#title-screen').waitFor({state:'hidden'});assert(await p.locator('#stage-next').isHidden());await p.locator('#condition-info').click();assert.equal(await p.locator('#dialog-title').innerText(),'現在の条件');await p.locator('#dialog-close').click();check(scenario.name+' continuous keeps original condition entry without navigation');
   await showTitle(p);await p.locator('#title-challenges').click();await chooseChallenge(p,'Q1');assert(await p.locator('#stage-previous').isDisabled());assert(await p.locator('#stage-next').isVisible());
   const items=await p.evaluate(async()=>{const {challenges}=await import(new URL('../content/challenges.js',document.querySelector('script[type=module]').src));return challenges.map(c=>({id:c.id,title:'Q'+c.number+' '+c.name}));});
   for(let n=0;n<items.length;n++){
    await p.waitForFunction(title=>document.getElementById('title').textContent===title,items[n].title);await heading(p,scenario.name+' '+items[n].title);await currentList(p,items[n].id);await p.locator('[aria-current="step"]').click();
    if(n<items.length-1)await p.locator('#stage-next').click();
   }
   assert(await p.locator('#stage-next').isDisabled());await p.locator('#stage-previous').click();assert.equal(await p.locator('#title').textContent(),items[16].title);check(scenario.name+' boundaries and direct previous before clearing');
   await p.locator('#condition-info').click();await chooseChallenge(p,'Q7');await dragConnection(p,'S','A');
   const state=()=>p.evaluate(()=>({draw:document.getElementById('app').dataset.problemId,edges:[...document.querySelectorAll('.edge:not(.candidate)')].map(e=>e.dataset.edge),view:document.getElementById('board').getAttribute('viewBox'),budget:document.getElementById('wire-budget').textContent}));
   const before=await state();assert.equal(before.edges.length,1);
   for(const action of ['same','close','x','escape']){await currentList(p,'Q7');if(action==='same')await p.locator('[aria-current="step"]').click();else if(action==='close')await p.locator('#dialog-actions').getByRole('button',{name:'閉じる',exact:true}).click();else if(action==='x')await p.locator('#dialog-close').click();else await p.keyboard.press('Escape');assert.deepEqual(await state(),before,'selector cancel preserves '+action);}
   await p.locator('#challenge-info').click();assert.equal(await p.locator('#dialog-title').innerText(),'現在の条件');await p.locator('#dialog-close').click();check(scenario.name+' same-stage and all close paths preserve draw/wiring/view; full conditions still accessible');
   await startAndPause(p);await p.locator('#stage-next').click();assert.match(await p.locator('#dialog-title').innerText(),/停止して/);await p.getByRole('button',{name:'戻る',exact:true}).click();assert.deepEqual(await state(),before);await p.locator('#stage-next').click();await p.getByRole('button',{name:'停止して課題を選ぶ',exact:true}).click();assert.match(await p.locator('#title').innerText(),/^Q9 /);check(scenario.name+' live trial requires stop, cancel preserves circuit');
   if(scenario.mobile){
    for(const [w,h,type,angle,font] of [[320,640,'portrait-primary',0,14],[390,844,'portrait-primary',0,28],[844,390,'landscape-primary',90,14],[844,390,'landscape-secondary',270,14],[390,844,'portrait-primary',0,14],[320,480,'portrait-primary',0,28]]){
     await p.evaluate(v=>{Object.assign(__direction,v);document.documentElement.style.fontSize=v.font+'px';},{type,angle,font});await p.setViewportSize({width:w,height:h});await p.evaluate(()=>screen.orientation.dispatchEvent(new Event('change')));await heading(p,`phone ${w}x${h} angle ${angle} font ${font}`);await currentList(p,'Q8');await p.locator('#dialog-close').click();
    }
    await p.evaluate(()=>{document.documentElement.style.fontSize='14px';});await p.setViewportSize({width:390,height:844});await p.evaluate(()=>window.dispatchEvent(new Event('resize')));
   }
   if(scenario.mobile){
    await p.locator('#condition-info').click();await chooseChallenge(p,'Q10');await currentList(p,'Q10');
    await p.evaluate(()=>{document.documentElement.style.fontSize='28px';});await p.setViewportSize({width:320,height:480});await p.evaluate(()=>window.dispatchEvent(new Event('resize')));
    await settle(p);await p.waitForFunction(()=>document.activeElement?.dataset.challenge==='Q10'&&document.querySelector('[aria-current="step"]')?.dataset.challenge==='Q10');assert(await p.locator('[aria-current="step"]').isVisible());check('Open list resize preserves current row and focus on later page');await p.locator('#dialog-close').click();
    await p.evaluate(()=>{document.documentElement.style.fontSize='14px';});await p.setViewportSize({width:390,height:844});await p.evaluate(()=>window.dispatchEvent(new Event('resize')));await settle(p);
   }
   await p.screenshot({path:path.join(out,scenario.name+'.png')});
   await showTitle(p);await p.locator('#title-tutorial').click();assert(await p.locator('#stage-next').isHidden());await p.locator('#guide-skip').click();assert(await p.locator('#stage-next').isVisible());
   await showTitle(p);await p.locator('#title-free').click();assert(await p.locator('#stage-next').isHidden());await showTitle(p);await p.locator('#title-start').click();assert(await p.locator('#stage-next').isHidden());check(scenario.name+' tutorial/free/continuous do not acquire selection navigation');
   assert.deepEqual(errors,[]);check(scenario.name+' no JavaScript errors');
  }finally{await context.close();}
 }
 report.passed=true;
}catch(error){report.failure=error.stack;console.error(error.stack);process.exitCode=1;}
finally{await browser?.close();if(server.listening)await new Promise(r=>server.close(r));fs.writeFileSync(reportFile,JSON.stringify(report,null,2));}
})();
