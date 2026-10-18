// Actual UI layout/gestures in disposable PC browsers; no physical-device claim.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {enterApp,selectChallenge,wiringBounds,dragConnection,startAndPause}=require('./browser_wait.cjs');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),engine=arg('--engine')||'chromium',channel=arg('--channel'),root=path.resolve(__dirname,'../dist'),version=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version;
const out=path.join(__dirname,'下側の常設欄',version,arg('--url')?new URL(arg('--url')).hostname:'local',channel||engine);fs.mkdirSync(out,{recursive:true});
const report={version,checks:[],evidence:'PC browser layout and gestures; orientation, screen size and larger text emulated. Physical fingers, phones and listening remain unverified.'};
const file=path.join(out,'report.json');if(fs.existsSync(file))fs.copyFileSync(file,path.join(out,'previous-'+Date.now()+'.json'));
const server=http.createServer((req,res)=>{let f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(f===root)f=path.join(root,'index.html');if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.ttf':'font/ttf'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
const check=(label,data={})=>report.checks.push({label,passed:true,...data});
const bounds=p=>p.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};};return{strip:rect(document.getElementById('result-line')),board:rect(document.getElementById('board')),play:rect(document.getElementById('play-controls')),viewBox:document.getElementById('board').getAttribute('viewBox'),nodes:[...document.querySelectorAll('[data-node]')].map(e=>({id:e.dataset.node,...rect(e.querySelector('.node-hit'))})).sort((a,b)=>a.id.localeCompare(b.id)),scroll:document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1};});
(async()=>{let browser;await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 browser=await pw[engine].launch({headless:true,...(channel?{channel}:{})});report.browser={engine,channel,version:browser.version()};
 for(const s of [{name:'portrait',width:412,height:844,mobile:true},{name:'small',width:320,height:568,mobile:true},{name:'enlarged',width:320,height:480,mobile:true,large:true},{name:'left',width:844,height:412,mobile:true,angle:90},{name:'right',width:844,height:412,mobile:true,angle:270},{name:'desktop',width:1440,height:900}]){
  const c=await browser.newContext({viewport:{width:s.width,height:s.height},isMobile:!!s.mobile,hasTouch:!!s.mobile});try{
   await c.addInitScript(angle=>{const o=new EventTarget();Object.defineProperties(o,{angle:{get:()=>angle},type:{get:()=>angle?'landscape-primary':'portrait-primary'}});Object.defineProperty(screen,'orientation',{get:()=>o});},s.angle||0);
   const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(arg('--url')||`http://127.0.0.1:${server.address().port}/`);await enterApp(p);if(s.large)await p.evaluate(()=>{document.documentElement.style.fontSize='28px';dispatchEvent(new Event('resize'));});
   for(const id of ['Q1','Q7','Q12']){
    if(id!=='Q1')await selectChallenge(p,id);const {a}=await wiringBounds(p,'S','A'),before=await bounds(p);assert(!before.scroll);assert(await p.locator('#result-line').isVisible());
    if(s.name==='portrait')assert.equal(before.strip.h,44);
    const footer=await p.locator('footer').boundingBox();
    if(!s.angle)assert(before.play.y+before.play.h<=footer.y+.5);
    else if(s.angle===90){assert(before.board.x+before.board.w<=before.strip.x+.5);assert(before.strip.x+before.strip.w<=before.play.x+.5);}
    else{assert(before.play.x+before.play.w<=before.strip.x+.5);assert(before.strip.x+before.strip.w<=before.board.x+.5);}
    check(s.name+' '+id+' lower strip and controls fit',before);
    if(await p.locator('#magnifier-toggle').getAttribute('aria-pressed')!=='true')await p.locator('#magnifier-toggle').click();
    await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();
    const loupe=await p.locator('#wire-magnifier').boundingBox();if(loupe){assert(loupe.x>=0&&loupe.y>=0&&loupe.x+loupe.width<=s.width+1&&loupe.y+loupe.height<=s.height+1);if(s.name==='portrait'&&id==='Q1')assert(loupe.y<=before.board.y+before.board.h*.35);const again=await p.locator('#wire-magnifier').boundingBox();await p.mouse.move(a.x+a.width/2+3,a.y+a.height/2-4);assert.deepEqual(await p.locator('#wire-magnifier').boundingBox(),again);}
    check(s.name+' '+id+' magnifier fits and stays anchored',{loupe});await p.mouse.up();
    assert.deepEqual(await bounds(p),before,'Starting/ending a stroke must not move field, view, or nodes');
    if(id==='Q1'){
     await dragConnection(p,'S','A');await dragConnection(p,'A','G');try{await p.waitForFunction(()=>document.querySelectorAll('#board .edge:not(.candidate)').length===2&& !document.getElementById('wire-limit-notice').hidden,null,{timeout:5000});}catch(error){await p.screenshot({path:path.join(out,s.name+'-zero-failed.png')});throw Error(JSON.stringify(await p.evaluate(()=>({edges:[...document.querySelectorAll('.edge:not(.candidate)')].map(e=>e.dataset.edge),budget:document.getElementById('wire-budget').innerText,status:document.getElementById('result').textContent,dialog:document.getElementById('dialog').open}))),{cause:error});}const zero=await bounds(p);assert.deepEqual(zero,before);check(s.name+' zero automatically displayed with no layout shift');
     if(['portrait','desktop'].includes(s.name))await p.screenshot({path:path.join(out,s.name+'-zero.png')});
     await startAndPause(p);assert(await p.locator('#wire-limit-notice').isHidden());assert.match(await p.locator('#result-summary').innerText(),/秒/);assert.deepEqual(await bounds(p),before);check(s.name+' running/paused time replaces zero warning in the same strip');await p.locator('#stop').click();
     assert(await p.locator('#wire-limit-notice').isVisible());await p.locator('#result-info').click();assert.equal(await p.locator('#dialog-title').innerText(),'実行状況');await p.locator('#dialog-close').click();check(s.name+' result remains readable beside persistent zero warning');
    }
    if(['portrait','small','desktop','left'].includes(s.name))await p.screenshot({path:path.join(out,s.name+'-'+id+'.png')});
   }
   assert.deepEqual(errors,[]);check(s.name+' no script errors');
  }finally{await c.close();}
 }
 report.passed=true;console.log('Lower strip and magnifier checks passed: '+report.checks.length);
 }catch(e){report.passed=false;report.failure=e.stack;console.error(e.stack);process.exitCode=1;}finally{await browser?.close();fs.writeFileSync(file,JSON.stringify(report,null,2));await new Promise(r=>server.close(r));}})();
