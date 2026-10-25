// Real tutorial actions, records, completion dialog and original-circuit recovery.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {startGuide,dragConnection,holdWire}=require('./browser_wait.cjs');
const arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),engine=arg('--engine')||'chromium',root=path.resolve('dist'),out=path.resolve(arg('--out')||`設計検証/チュートリアル完了-20261025/${engine}`);fs.mkdirSync(out,{recursive:true});
const version=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version,report={version,passed:false,cases:[],boundary:'Real UI and wall-clock playback in desktop browsers. Phone touch, viewport and enlarged text are emulated; physical-device appearance/listening are unverified.'};
const server=http.createServer((req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===root)file=path.join(root,'index.html');assert(file.startsWith(root+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.ttf':'font/ttf','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
const scenarios=[{name:'phone',width:390,height:844,saveFailure:true},{name:'small-phone',width:320,height:640},{name:'desktop',width:1440,height:960,desktop:true},{name:'landscape',width:844,height:390},{name:'enlarged',width:390,height:844,font:28},{name:'short-enlarged',width:640,height:240,font:28},{name:'free',width:390,height:844,free:true}];
let browser;
const snapshot=p=>p.evaluate(()=>({edges:[...document.querySelectorAll('.edge:not(.candidate)')].map(e=>e.dataset.edge).sort(),times:[...document.querySelectorAll('[data-node]')].map(e=>({id:e.dataset.node,time:e.querySelector('.node-time')?.textContent})),scores:localStorage.getItem('prism-notes.scores.v1'),circuits:localStorage.getItem('prism-notes.circuits.v1')}));
const settle=p=>p.evaluate(async()=>{await document.fonts.ready;for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});
async function coach(p){await settle(p);if(await p.locator('#guide-bar').isVisible()){const box=await p.locator('#guide-bar').evaluate(e=>({overflow:e.scrollHeight>e.clientHeight+1||e.scrollWidth>e.clientWidth+1,text:e.textContent}));assert.equal(box.overflow,false,'Full guide text fits its card');}}
async function setTime(p,value){await p.locator('[data-node="A"] .node-hit').dblclick();await p.getByRole('button',{name:'時間',exact:true}).click();await p.getByRole('textbox',{name:'秒数'}).fill(value);await p.getByRole('button',{name:'確定',exact:true}).click();}
async function reopenClear(p){if(await p.locator('#guide-finish').isVisible())await p.locator('#guide-finish').click();else{await p.locator('#hint').click();await p.getByRole('button',{name:'完了',exact:true}).click();}await p.locator('#tutorial-clear-finish').waitFor({state:'visible'});}
async function geometry(p){return p.evaluate(()=>{const ids=['dialog','dialog-title','dialog-body','tutorial-clear-finish','tutorial-clear-practice'];return ids.map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect(),s=getComputedStyle(e);return{id,rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,overflow:s.overflowY,whiteSpace:s.whiteSpace,clamp:s.webkitLineClamp};});});}
(async()=>{try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await pw[engine].launch({headless:true});
 for(const c of scenarios.filter(c=>!arg('--cases')||arg('--cases').split(',').includes(c.name))){
  report.step=c.name;const context=await browser.newContext({viewport:{width:c.width,height:c.height},isMobile:!c.desktop,hasTouch:!c.desktop}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{Math.random=()=>.5;localStorage.setItem('prism-notes.motion.v1',JSON.stringify({version:1,value:'full'}));});
  await p.goto(arg('--url')||`http://127.0.0.1:${server.address().port}/`);await p.locator('#board [data-node="S"]').waitFor({state:'attached'});assert.equal(await p.locator('meta[name="prism-version"]').getAttribute('content'),version);
  if(c.font)await p.evaluate(font=>{document.documentElement.style.fontSize=font+'px';dispatchEvent(new Event('resize'));},c.font);
  await p.locator(c.free?'#title-free':'#title-resume').click();await settle(p);
  if(c.free)await setTime(p,'0.7');else await dragConnection(p,'S','A');
  const before=await snapshot(p);await startGuide(p);await coach(p);
  if(c.free){await p.locator('#play').click();await p.waitForFunction(()=>document.getElementById('guide-heading').textContent.includes('2/4'),null,{timeout:9000});await p.locator('#stop').click();}
  else await dragConnection(p,'S','A');
  await holdWire(p,'SA');await p.locator('#wire-delete-ok').click();await dragConnection(p,'S','A');
  if(c.free)await setTime(p,'1.5');else await dragConnection(p,'A','G');
  await coach(p);await p.locator('#play').click();
  if(!c.free){
    await p.waitForFunction(()=>document.getElementById('guide-heading').textContent.includes('4/4'),null,{timeout:9000});await coach(p);
    assert.match(await p.locator('#guide-text').textContent(),/早く.*高得点.*最速.*100点/);
    await p.locator('#records').click();await p.locator('#record-list .record-row').first().waitFor({state:'visible'});
    await p.waitForFunction(()=>document.getElementById('play').dataset.state==='stopped',null,{timeout:7000});assert.equal(await p.locator('#dialog').evaluate(e=>e.open),false,'Completion does not cover the records being read');
    await p.locator('#close-records').click();
  }
  await p.locator('#tutorial-clear-finish').waitFor({state:'visible',timeout:9000});await settle(p);
  assert.equal(await p.locator('#dialog-title').textContent(),'チュートリアルクリア！');assert.equal(await p.locator('#guide-heading').textContent(),'チュートリアルクリア！');
  assert.match(await p.locator('#tutorial-score-explanation').textContent(),/クリア条件.*短い時間.*高得点.*最速.*100点/);
  assert.equal(await p.locator('#tutorial-clear-time').textContent(),c.free?'3秒':'2.5秒');if(!c.free)assert.equal(await p.locator('#tutorial-clear-score').textContent(),'100.00点');
  assert.equal(await p.evaluate(()=>localStorage.getItem('prism-notes.guides.v1')),null,'Showing clear does not prematurely save completion');
  const boxes=await geometry(p);for(const box of boxes){assert(box.rect.left>=-1&&box.rect.top>=-1&&box.rect.right<=c.width+1&&box.rect.bottom<=c.height+1,box.id+' fits viewport');assert(box.scrollWidth<=box.clientWidth+1,box.id+' has no horizontal clipping');}
  assert(boxes.find(b=>b.id==='dialog-body').clientHeight>0,'Long text has a reachable scroll area');
  for(const id of ['tutorial-clear-finish','tutorial-clear-practice'])assert.equal(await p.locator('#'+id).evaluate(e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===e;}),true,'Completion action can be touched');
  await p.screenshot({path:path.join(out,c.name+'-clear.png')});await p.locator('#tutorial-score-explanation').evaluate(e=>e.scrollIntoView({block:'center'}));await p.screenshot({path:path.join(out,c.name+'-explanation.png')});
  await p.locator('#tutorial-clear-practice').click();await settle(p);assert.equal(await p.locator('#dialog').evaluate(e=>e.open),false,'Dismissed completion does not immediately reopen');
  await reopenClear(p);
  if(c.saveFailure){
    await p.evaluate(()=>{window.savedTutorialSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='prism-notes.guides.v1')throw new Error('Synthetic guide-save failure');return window.savedTutorialSetItem.call(this,key,value);};});
    await p.locator('#tutorial-clear-finish').click();assert.notEqual(await p.locator('#dialog-error').textContent(),'');assert.equal(await p.locator('#dialog').evaluate(e=>e.open),true);assert.equal(await p.evaluate(()=>localStorage.getItem('prism-notes.guides.v1')),null,'Failed persistence does not pretend completion');
    await p.evaluate(()=>{Storage.prototype.setItem=window.savedTutorialSetItem;delete window.savedTutorialSetItem;});
  }
  await p.locator('#tutorial-clear-finish').click();await settle(p);assert.equal(await p.locator('#guide-bar').isVisible(),false);assert.equal(await p.locator('#dialog').evaluate(e=>e.open),false);
  assert.deepEqual(await snapshot(p),before,'Original circuit, times, scores and saved circuits are restored');assert.equal(await p.evaluate(mode=>JSON.parse(localStorage.getItem('prism-notes.guides.v1')).value[mode],c.free?'free':'challenge'),'completed');
  assert.deepEqual(errors,[]);report.cases.push({name:c.name,passed:true,boxes,before,after:await snapshot(p),saveFailureRecovered:Boolean(c.saveFailure)});console.log(c.name+' passed');await context.close();
 }report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(report.step,error.stack);}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}})();
