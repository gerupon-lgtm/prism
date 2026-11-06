// Record-panel regression: real practice runs; read-only Session observation.
// Small screens may use the existing records fullscreen presentation.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {dragConnection}=require('./browser_wait.cjs');
const arg=name=>{const at=process.argv.indexOf(name);return at<0?null:process.argv[at+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),engine=arg('--engine')||'chromium',root=path.resolve(arg('--root')||'.'),empty=process.argv.includes('--empty');
const out=path.resolve(arg('--out')||`設計検証/チュートリアル記録-20261107/${empty?'after-minimal':'after-real'}/${engine}`);fs.mkdirSync(out,{recursive:true});
const version=JSON.parse(fs.readFileSync('package.json','utf8')).version;
const report={version,engine,empty,passed:false,cases:[],boundary:'Actual UI and wall-clock practice records in desktop browsers. Touch, CSS text enlargement and screen.orientation change events are emulated; physical-device operation is unverified.'};
const server=http.createServer((req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===root)file=path.join(root,'index.html');assert(file.startsWith(root+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.ttf':'font/ttf','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
const scenarios=[{name:'phone',width:410,height:844,comparison:true,dialog:true},{name:'small',width:320,height:480},{name:'enlarged',width:410,height:844,font:28},{name:'left',width:410,height:844,rotate:{type:'landscape-primary',angle:90}},{name:'right',width:410,height:844,rotate:{type:'landscape-secondary',angle:270}},{name:'desktop',width:1440,height:960,desktop:true},{name:'desktop-small',width:1100,height:700,desktop:true}];
let browser,currentPage;
const settle=p=>p.evaluate(async()=>{await document.fonts.ready;let last='',stable=0;for(let n=0;n<120;n++){await new Promise(requestAnimationFrame);const key=['app','workspace','board','guide-bar','records-panel'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return[id,r.x,r.y,r.width,r.height,e.hidden];});const next=JSON.stringify(key);stable=next===last?stable+1:0;last=next;if(stable>=4)return;}throw Error('Record layout did not settle in 120 frames');});
const snapshot=p=>p.evaluate(()=>{const s=window.recordsProbe.session;return {step:s.guide.step,lesson:s.guide.lesson,ready:s.guide.readyToFinish,circuit:s.circuit,result:s.result,run:s.run?{status:s.run.status,time:s.run.format(),records:s.run.records}:null};});
const measure=p=>p.evaluate(()=>{
  const rect=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,width:r.width};};
  const app=document.getElementById('app'),header=app.querySelector('header'),workspace=document.getElementById('workspace'),guide=document.getElementById('guide-bar'),records=document.getElementById('records-panel'),v=window.visualViewport;
  const visible=e=>Boolean(e.getClientRects().length)&&getComputedStyle(e).visibility!=='hidden';
  return {fullscreen:document.body.classList.contains('records-fullscreen'),desktop:document.documentElement.classList.contains('desktop-layout'),rotation:Number(document.documentElement.dataset.boardRotation),header:rect(header),workspace:rect(workspace),stage:{visible:visible(document.getElementById('stage')),...rect(document.getElementById('stage'))},board:rect(document.getElementById('board')),guide:{hidden:guide.hidden,visibility:getComputedStyle(guide).visibility,...rect(guide)},guideSlot:rect(document.getElementById('desktop-guide')),records:{visible:visible(records),...rect(records)},gap:workspace.offsetTop-header.offsetTop-header.offsetHeight,allowedGap:(parseFloat(getComputedStyle(app).rowGap)||0)+(parseFloat(getComputedStyle(header).marginBottom)||0),page:{width:v?v.width*v.scale:innerWidth,height:v?v.height*v.scale:innerHeight,rootWidth:document.documentElement.scrollWidth,rootHeight:document.documentElement.scrollHeight,bodyWidth:document.body.scrollWidth,bodyHeight:document.body.scrollHeight},rows:[...document.querySelectorAll('#record-list .record-row')].map(e=>({text:e.textContent,visible:visible(e),...rect(e)})),emptyText:document.querySelector('#record-list>p')?.textContent,pager:document.getElementById('record-page').textContent,controls:['record-prev','record-next','close-records'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect(),point={x:r.x+r.width/2,y:r.y+r.height/2};return{id,visible:visible(e),disabled:e.disabled,hit:document.elementFromPoint(point.x,point.y)?.closest('button')===e,...rect(e)};})};
});
function assertPage(m,label){for(const [axis,limit]of [['Width',m.page.width],['Height',m.page.height]])for(const target of ['root','body'])assert(m.page[target+axis]<=limit+1,label+' no page '+axis+' overflow');}
function assertRecords(m,label,{allowEmpty=false}={}){
  assertPage(m,label);assert.equal(m.guide.hidden,true,label+' guide is removed from layout');assert(m.guide.width<=1&&m.guide.height<=1,label+' guide occupies zero area');assert(m.records.visible&&m.records.width>0&&m.records.height>0,label+' real record panel is visible');
  if(m.desktop)assert(m.guideSlot.height<=1,label+' empty desktop guide slot reserves no height');
  if(m.fullscreen)assert.equal(m.stage.visible,false,label+' existing fullscreen hides the board');
  else{
    assert(m.gap<=m.allowedGap+2,label+' no blank tutorial row above workspace');assert(m.stage.visible&&m.board.width>=44&&m.board.height>=44,label+' board retains a usable visible area');
    const a=m.board,b=m.records;assert(Math.min(a.right,b.right)-Math.max(a.left,b.left)<=1||Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<=1,label+' board and records do not overlap');
  }
  for(const c of m.controls){assert(c.visible&&c.width>0&&c.height>0,label+' visible '+c.id);assert(c.left>=-1&&c.top>=-1&&c.right<=m.page.width+1&&c.bottom<=m.page.height+1,label+' control within physical viewport '+c.id);assert(c.hit,label+' control can be touched '+c.id);}
  if(allowEmpty)assert.match(m.emptyText??'',/まだありません/);
  else{assert(m.rows.length>0,label+' actual execution rows are present');for(const r of m.rows)assert(r.visible&&r.left>=m.records.left-1&&r.right<=m.records.right+1&&r.top>=m.records.top-1&&r.bottom<=m.records.bottom+1,label+' record row is visible inside panel');}
}
async function click(p,selector){const point=await p.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});await p.mouse.click(point.x,point.y);}
async function paginate(p){const result={before:await p.locator('#record-page').textContent(),moved:false};if(!await p.locator('#record-next').isDisabled()){await click(p,'#record-next');await settle(p);result.next=await p.locator('#record-page').textContent();assert.notEqual(result.next,result.before,'Next record page changes');assert.equal(await p.locator('#record-prev').isDisabled(),false);await click(p,'#record-prev');await settle(p);assert.equal(await p.locator('#record-page').textContent(),result.before,'Previous record page restores position');result.moved=true;}else assert.equal(await p.locator('#record-prev').isDisabled(),true,'A single record page disables both directions');return result;}
async function rotate(p,direction,width,height){await p.evaluate(direction=>{Object.assign(window.__recordsDirection,direction);screen.orientation.dispatchEvent(new Event('change'));},direction);await p.setViewportSize({width,height});await settle(p);}
async function play(p){await click(p,'#play');await p.waitForFunction(()=>document.getElementById('play').dataset.state==='stopped',null,{timeout:9500});await settle(p);}
async function removeAG(p){const at=await p.locator('.edge:not(.candidate)[data-edge="AG"] .edge-line').evaluate(e=>{const point=e.getPointAtLength(e.getTotalLength()/2).matrixTransform(e.getScreenCTM());return{x:point.x,y:point.y};});await p.mouse.move(at.x,at.y);await p.mouse.down();try{await p.waitForFunction(()=>document.getElementById('wire-delete-toast').open,null,{timeout:2000});}finally{await p.mouse.up();}await click(p,'#wire-delete-ok');await settle(p);}
async function inspectOpen(p,c,label){await settle(p);const m=await measure(p);c.opened.push({label,...m});await p.screenshot({path:path.join(out,`${c.name}-${label}.png`)});assertRecords(m,c.name+' '+label,{allowEmpty:empty});assert.equal(await p.locator('.tutorial-demonstration').count(),0,'Record reading pauses tutorial illustration');return m;}
function sameRect(a,b,label){for(const key of ['top','bottom','left','right','width','height'])assert(Math.abs(a[key]-b[key])<=1,label+' '+key+' restored');}

(async()=>{try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await pw[engine].launch({headless:true});
 const selected=scenarios.filter(c=>arg('--cases')?arg('--cases').split(',').includes(c.name):!empty||c.name==='phone');
 for(const setup of selected){
  const c={name:setup.name,passed:false,opened:[]};report.cases.push(c);report.step=setup.name;
  const context=await browser.newContext({viewport:{width:setup.width,height:setup.height},hasTouch:!setup.desktop,isMobile:!setup.desktop}),p=await context.newPage();currentPage=p;const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{window.__recordsDirection={type:'portrait-primary',angle:0};const orientation=new EventTarget();Object.defineProperties(orientation,{type:{get:()=>window.__recordsDirection.type},angle:{get:()=>window.__recordsDirection.angle}});Object.defineProperty(screen,'orientation',{get:()=>orientation});localStorage.setItem('prism-notes.motion.v1',JSON.stringify({version:1,value:'full'}));});
  await p.goto(arg('--url')||`http://127.0.0.1:${server.address().port}/`);await p.locator('#board [data-node="S"]').waitFor({state:'attached'});assert.equal(await p.locator('meta[name="prism-version"]').getAttribute('content'),version);
  await p.evaluate(async()=>{const {Session}=await import(new URL('../app/session.js',document.querySelector('script[type=module]').src)),original=Session.prototype.beginGuide;window.recordsProbe={};Session.prototype.beginGuide=function(...args){window.recordsProbe.session=this;return original.apply(this,args);};});
  if(setup.font)await p.evaluate(font=>{document.documentElement.style.fontSize=font+'px';dispatchEvent(new Event('resize'));},setup.font);
  await click(p,'#title-tutorial');await settle(p);
  if(!empty){await dragConnection(p,'S','A');await dragConnection(p,'A','G');await play(p);}
  c.before=await measure(p);const before=await snapshot(p);await click(p,'#records');await p.locator('#records-panel').waitFor({state:'visible'});await inspectOpen(p,c,'open');c.paging=await paginate(p);
  if(setup.name==='phone'&&!empty){await p.locator('#record-list .record-row').first().click();await p.locator('#dialog').waitFor({state:'visible'});await settle(p);assert.equal(await p.locator('#guide-bar').evaluate(e=>e.getBoundingClientRect().height),0,'Record details do not restore the hidden guide');await click(p,'#dialog-close');await inspectOpen(p,c,'details-return');}
  if(setup.rotate){
    await rotate(p,setup.rotate,844,410);const m=await inspectOpen(p,c,'rotated');assert.equal(m.rotation,setup.rotate.angle===90?-90:90);c.rotatedPaging=await paginate(p);
    await rotate(p,{type:'portrait-primary',angle:0},setup.width,setup.height);await inspectOpen(p,c,'portrait-return');
  }
  const openState=await snapshot(p);await click(p,'#close-records');await settle(p);c.closed=await measure(p);assertPage(c.closed,c.name+' closed');assert.deepEqual(await snapshot(p),openState,c.name+' record close preserves circuit, result and guide progress');sameRect(c.closed.board,c.before.board,c.name+' board');assert.equal(c.closed.guide.hidden,c.before.guide.hidden,c.name+' guide collapse state restored');if(!c.before.guide.hidden)sameRect(c.closed.guide,c.before.guide,c.name+' guide');
  assert.deepEqual(openState,before,c.name+' initial record inspection does not alter practice data');
  if(setup.dialog){
    const prior=c.closed;await click(p,'#hint');await p.locator('#dialog').waitFor({state:'visible'});await settle(p);c.regularDialog=await measure(p);sameRect(c.regularDialog.board,prior.board,'Ordinary full-text dialog keeps the board steady');assert.equal(c.regularDialog.guide.hidden,prior.guide.hidden,'A non-record dialog retains guide space');assertPage(c.regularDialog,'ordinary dialog');await click(p,'#dialog-close');await settle(p);
  }
  if(setup.comparison&&!empty){
    await removeAG(p);await dragConnection(p,'A','B');await dragConnection(p,'B','G');await play(p);assert.equal(await p.evaluate(()=>window.recordsProbe.session.guide.step),3);
    const comparison=await snapshot(p);await click(p,'#records');await inspectOpen(p,c,'comparison-records');assert.equal(await p.evaluate(()=>window.recordsProbe.session.guide.step),4,'Actual comparison record qualifies next chapter');await click(p,'#close-records');await settle(p);const closedComparison=await snapshot(p);assert.deepEqual(closedComparison.circuit,comparison.circuit);assert.deepEqual(closedComparison.result,comparison.result);assert.equal(closedComparison.step,4);
    if(await p.locator('#guide-next').isVisible())await click(p,'#guide-next');else{await click(p,'#hint');await p.getByRole('button',{name:'響きをつなぐ',exact:true}).click();}await p.locator('[data-node="G3"]').waitFor({state:'visible'});c.nextChapter={step:await p.evaluate(()=>window.recordsProbe.session.guide.step),comparisonTime:comparison.result.evaluatedTime};assert.equal(c.nextChapter.step,5);
  }
  assert.deepEqual(errors,[]);c.passed=true;console.log(c.name+' passed');await context.close();currentPage=null;
 }
 report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(report.step,error.stack);if(currentPage){try{report.failure=await measure(currentPage);report.failureState=await snapshot(currentPage);await currentPage.screenshot({path:path.join(out,'failed.png')});}catch{}}}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}})();
