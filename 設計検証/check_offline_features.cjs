const {enterApp,startGuide,skipGuide,wiringBounds,chooseChallenge}=require('./browser_wait.cjs');
// Actual UI flows after prepared-asset startup with no reachable origin.
// PC engines and synthetic fixtures; this does not prove physical-device acceptance.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const challengeFixtures=require('./challenge_fixtures.cjs');
const {waitForAsync}=require('./browser_wait.cjs');
const {expectedStoppedOriginWorkerError}=require('./browser_errors.cjs');
const arg=name=>{const at=process.argv.indexOf(name);return at<0?null:process.argv[at+1];};
if(!arg('--playwright-path'))throw new Error('Pass --playwright-path');
process.env.PLAYWRIGHT_BROWSERS_PATH=arg('--browser-cache')||'C:/Users/user/AppData/Local/ms-playwright';
const channel=arg('--channel');if(channel&&!['chrome','msedge'].includes(channel))throw new Error('Use --channel chrome or msedge');
const pw=require(path.resolve(arg('--playwright-path'))),root=path.resolve(__dirname,'../dist'),out=path.join(__dirname,'オフライン機能',channel||'');
fs.mkdirSync(out,{recursive:true});
const version=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'),'utf8')).version;
const report={version,checkedAt:new Date().toISOString(),evidence:'PC Chromium: context offline. Windows WebKit: stopped origin. Actual UI, downloads, localStorage, prepared service worker; synthetic fixture circuits and a labelled 135ms render stall. Audio API checks are not listening evidence. Physical-device checks remain pending.',checks:[],pending:[],errors:[],windowErrors:[]};
if(channel)report.evidence=`Installed Windows ${channel}: HTTP cache cleared, context offline. Disposable browser context; actual UI, files, localStorage and worker with synthetic circuits/errors/stall. Audio API checks are not listening evidence. Phone and OS shutdown checks remain pending.`;
report.browsers=[];
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.ttf':'font/ttf','.webmanifest':'application/manifest+json'};
let originOffline=false,port;
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(!pathname.startsWith('/prism/')){res.writeHead(404).end();return;}
 const file=path.resolve(root,pathname.slice(7)||'index.html');
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
const settle=page=>page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
const inspect=page=>page.evaluate(async()=>(await import(document.querySelector('script[type=module]').src)).inspectPerformance());
const record=(engine,label,requirements,details={})=>report.checks.push({engine,label,requirements,passed:true,...details});
async function choose(page,name){
 await settle(page);
 for(let i=0;i<60;i++){
  const item=page.locator('#dialog').getByRole('button',{name,exact:typeof name==='string'});if(await item.count()){await item.click();await settle(page);return;}
  const next=page.locator('#dialog-body .pager button').last();assert(await next.count()&&!(await next.isDisabled()),'Missing choice '+String(name));await next.click();await settle(page);
 }
 throw new Error('Finite fixture dialog paging guard');
}
async function menu(page,name){await page.locator('#menu').click();await choose(page,name);}
async function download(page,name){
 const pending=page.waitForEvent('download');await menu(page,name);const file=await pending;
 const result=JSON.parse(fs.readFileSync(await file.path(),'utf8'));await page.locator('#dialog-close').click();return result;
}
const circuit=page=>download(page,'回路ファイルを書き出す');
const result=page=>download(page,'実行結果を書き出す');
async function drag(page,from,to){
 const {a,b}=await wiringBounds(page,from,to);
 await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:10});await page.mouse.up();await settle(page);
}
async function pauseStart(page){await page.locator('#play').click();await page.waitForFunction(()=>['running','paused'].includes(document.getElementById('play').dataset.state));await page.locator('#records').click();await page.locator('#close-records').click();}
async function finish(page){
 for(let step=0;step<220;step++){if(await page.locator('#next').isDisabled())return;await page.locator('#next').click();}
 throw new Error('Finite fixture did not finish; this guard is not a production limit');
}
async function time(page,id,value){await page.locator('[data-node="'+id+'"] .node-hit').dblclick();await choose(page,'時間');await page.getByRole('textbox',{name:'秒数'}).fill(value);await choose(page,'確定');}
async function selectChallenge(page,id){await page.locator('#home').click();await chooseChallenge(page,id);}
async function replaceDiscard(page){const item=page.getByRole('button',{name:'保存せず入替',exact:true});if(await item.count())await item.click();await settle(page);}
async function importFile(page,file){
 await page.locator('#import').setInputFiles({name:'synthetic-circuit.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(file))});await settle(page);
}
async function blockStorageWrites(page,key){
 await page.evaluate(key=>{window.__offlineStorageWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(name,value){if(name===key)throw new DOMException('Synthetic offline quota failure','QuotaExceededError');return window.__offlineStorageWrite.call(this,name,value);};},key);
}
async function restoreStorageWrites(page){await page.evaluate(()=>{Storage.prototype.setItem=window.__offlineStorageWrite;delete window.__offlineStorageWrite;});}
async function prepared(page){
 await waitForAsync(page,async()=>{
  if(!navigator.serviceWorker.controller)return false;
  const v=document.querySelector('meta[name=prism-version]').content,cache=await caches.open('prism-notes:/prism/:'+v),response=await cache.match(new URL('build-info.json',document.baseURI));
  if(!response)return false;const info=await response.json();return info.version===v&&(await Promise.all(info.assets.map(asset=>cache.match(new URL(asset,document.baseURI))))).every(Boolean);
 },{},{timeout:15000});
}
async function exercise(page,engine){
 const keys=['prism-notes.circuits.v1','prism-notes.scores.v1','prism-notes.guides.v1'];
 // Complete all three actual steps in each mode, and verify practice isolation.
 await startGuide(page);assert(await page.locator('#guide-bar').isVisible());await drag(page,'S','A');await drag(page,'A','G');await pauseStart(page);await finish(page);await page.locator('#records').click();assert(await page.locator('#guide-finish').isVisible());await page.locator('#guide-finish').click();
 assert.equal(await page.locator('.edge:not(.candidate)').count(),0);assert.equal(await page.evaluate(()=>localStorage.getItem('prism-notes.scores.v1')),null);
 await page.locator('#home').click();await choose(page,'自由へ');await startGuide(page);assert(await page.locator('#guide-bar').isVisible());await pauseStart(page);await finish(page);await page.locator('#stop').click();await time(page,'A','1.5');await pauseStart(page);await finish(page);assert(await page.locator('#guide-finish').isVisible());await page.locator('#guide-finish').click();assert.equal(await page.locator('[data-node="A"] .node-time').textContent(),'0.5s');
 const history=await page.evaluate(()=>JSON.parse(localStorage.getItem('prism-notes.guides.v1')).value);assert.deepEqual(history,{challenge:'completed',free:'completed'});
 record(engine,'Both three-step guides complete, restore original circuits, and never save practice scores',['F-019','F-021','NF-003']);
 // Exercise all introductory and practical challenges, including every independently replayed fault.
 for(const id of Object.keys(challengeFixtures)){
  await selectChallenge(page,id);
  const routes=await page.evaluate(async({id,edges})=>{const entry=document.querySelector('script[type=module]').src,{challenges}=await import(new URL('../content/challenges.js',entry));const challenge=challenges.find(c=>c.id===id);return edges.map(id=>{const edge=challenge.candidates.find(e=>e.id===id);return [edge.from,edge.to];});},{id,edges:challengeFixtures[id]});
  for(const [from,to] of routes)await drag(page,from,to);
  if(id==='Q1')await blockStorageWrites(page,'prism-notes.scores.v1');
  await pauseStart(page);await finish(page);assert((await page.locator('#result').textContent()).includes('100.00点'));
  if(id==='Q1'){
   assert(await page.locator('#retry-result').isVisible());await page.locator('#retry-result').click();assert(await page.locator('#retry-result').isVisible());assert.equal(await page.evaluate(()=>localStorage.getItem('prism-notes.scores.v1')),null);
   await restoreStorageWrites(page);await page.locator('#retry-result').click();assert(!(await page.locator('#retry-result').isVisible()));
   record(engine,'Offline synthetic score-write failure retains result and retry saves after recovery',['F-024','NF-003'],{syntheticQuotaFailure:true});
  }
  const exported=await result(page);assert.equal(exported.evaluation.state,'achieved');assert.deepEqual(exported.evaluation.score,{numerator:'100',denominator:'1'});
  if(['Q1','Q2','Q3'].includes(id))assert.deepEqual(exported.records.filter(r=>r.type==='goal').map(r=>r.time),['2.5']);
  if(id==='Q6')assert.deepEqual(exported.records.filter(r=>r.type==='goal').map(r=>r.time),['1','3','5']);
  if(['Q7','Q8'].includes(id)){assert(exported.evaluation.goals.every(goal=>goal.first!==null));assert.equal(exported.evaluation.evaluatedTime,'4');}
  if(['Q11','Q12'].includes(id))assert(exported.records.some(row=>row.type==='process-start'&&Number(row.wait)>0));
  if(['Q4','Q5'].includes(id)){
   const cases=exported.faultCases;assert.equal(cases.length,id==='Q4'?4:3);assert(cases.every(c=>c.reachable&&c.time==='2.5'));
   for(const item of cases){
    const disabled=[...item.conditions.nodes,...item.conditions.edges].filter(x=>x.enabled===false);assert.equal(disabled.length,1);assert.equal(disabled[0].id,item.id);
    await page.locator('#records').click();if((await page.locator('#record-title').textContent())!=='故障ケース')await page.locator('#record-tab').click();
    for(let n=0;n<20;n++){const row=page.locator('#record-list button').filter({hasText:new RegExp('^'+item.id+' 不可')});if(await row.count()){await row.click();break;}assert(!(await page.locator('#record-next').isDisabled()));await page.locator('#record-next').click();await settle(page);}
    await choose(page,'このケースで流す');await page.waitForFunction(()=>['running','paused'].includes(document.getElementById('play').dataset.state));await page.locator('#records').click();await page.locator('#close-records').click();await finish(page);const replay=await result(page);assert.equal(replay.replayCase,item.id);assert(replay.records.some(r=>r.type==='goal'&&r.time==='2.5'));
   }
  }
  await page.locator('#stop').click();record(engine,id+' reaches 100; all fault cases separately replayed where applicable',['F-003','F-014','F-021','F-024',...(id==='Q4'?['F-012']:id==='Q5'?['F-013']:[])],{challenge:id,cases:exported.faultCases.length});
 }
 const scores=await page.evaluate(()=>JSON.parse(localStorage.getItem('prism-notes.scores.v1')).value);assert.equal(scores.length,12);
 record(engine,'All twelve scores persisted locally without a network connection',['F-024']);
 await selectChallenge(page,'Q2');await drag(page,'S','C');await drag(page,'C','G');await pauseStart(page);await finish(page);const lowerScore=await result(page);assert.equal(lowerScore.evaluation.state,'achieved');assert.deepEqual(lowerScore.records.filter(row=>row.type==='goal').map(row=>row.time),['3']);assert(BigInt(lowerScore.evaluation.score.numerator)<100n*BigInt(lowerScore.evaluation.score.denominator));await page.locator('#stop').click();
 await selectChallenge(page,'Q1');await drag(page,'S','A');await pauseStart(page);await finish(page);const failedScore=await result(page);assert.equal(failedScore.evaluation.state,'failed');assert.deepEqual(failedScore.evaluation.score,{numerator:'0',denominator:'1'});assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('prism-notes.scores.v1')).value),scores);
 const failedViews=[];
 for(const enlarged of [false,true]){
  const style=enlarged?await page.addStyleTag({content:':root{font-size:28px!important}'}):null;
  for(const [width,height] of [[320,480],[390,664],[480,240],[844,310]]){
   await page.setViewportSize({width,height});await settle(page);assert((await page.locator('#result').textContent()).includes('未達成 0.00点'));
   const fit=await page.evaluate(()=>{const result=document.getElementById('result'),rect=result.getBoundingClientRect(),range=document.createRange();range.setStart(result.firstChild,0);range.setEnd(result.firstChild,result.textContent.indexOf('｜'));const prefix=range.getBoundingClientRect(),style=getComputedStyle(result);return {viewport:[innerWidth,innerHeight],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],result:[result.clientWidth,result.clientHeight,result.scrollWidth,result.scrollHeight],ellipsis:style.overflow==='hidden'&&style.textOverflow==='ellipsis',prefix:[prefix.left,prefix.top,prefix.right,prefix.bottom],rect:[rect.left,rect.top,rect.right,rect.bottom]};});
   try{assert(fit.document.every((size,index)=>size<=fit.viewport[index]));assert(fit.result[3]<=fit.result[1]+1);assert(fit.result[2]<=fit.result[0]+1||fit.ellipsis);assert(fit.prefix[0]>=fit.rect[0]-.5&&fit.prefix[2]<=fit.rect[2]+.5,'Zero score and execution state visibly fit before the ellipsized details');assert(fit.rect[0]>=0&&fit.rect[1]>=0&&fit.rect[2]<=width+.5&&fit.rect[3]<=height+.5);}catch(error){report.failureLayout={engine,cssTextEnlarged:enlarged,...fit};await page.screenshot({path:path.join(out,'failed-layout.png')});throw error;}failedViews.push({cssTextEnlarged:enlarged,...fit});
  }
  if(style)await style.evaluate(element=>element.remove());
 }
 await page.setViewportSize({width:390,height:664});await settle(page);await page.locator('#stop').click();
 record(engine,'Lower achieved score and failed zero score preserve all previous bests offline; zero score fits normal and CSS-enlarged views',['F-014','F-024','NF-003','NF-005'],{acceptance:['AC-17','AC-21'],failedViews,physicalTextZoomVerified:false});
 await page.locator('#home').click();await choose(page,'自由へ');
 const originalCircuit=(await circuit(page)).circuit,worldTransform=()=>page.locator('[data-node="A"]').evaluate(node=>node.parentElement.getAttribute('transform'));
 const originalTransform=await worldTransform();await page.locator('#zoom-in').click();assert.notEqual(await worldTransform(),originalTransform);await page.locator('#zoom-out').click();
 const emptyBoard=await page.locator('#board').boundingBox(),panStart={x:emptyBoard.x+emptyBoard.width*.08,y:emptyBoard.y+emptyBoard.height*.15};assert(await page.evaluate(({x,y})=>!document.elementFromPoint(x,y).closest('[data-node],[data-edge]'),panStart));
 const beforePan=await worldTransform();await page.mouse.move(panStart.x,panStart.y);await page.mouse.down();await page.mouse.move(panStart.x+20,panStart.y+15,{steps:8});await page.mouse.up();assert.notEqual(await worldTransform(),beforePan);await page.locator('#fit').click();
 await page.setViewportSize({width:844,height:310});await settle(page);assert((await page.locator('[data-node="A"]').getAttribute('transform')).includes('rotate(0)'));assert.equal(await page.locator('html').getAttribute('data-board-rotation'),'0');assert.deepEqual((await circuit(page)).circuit,originalCircuit);
 const landscape=await page.evaluate(()=>({viewport:[innerWidth,innerHeight],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight]}));assert(landscape.document.every((size,index)=>size<=landscape.viewport[index]));await page.setViewportSize({width:390,height:664});await settle(page);assert((await page.locator('[data-node="A"]').getAttribute('transform')).includes('rotate(0)'));
 record(engine,'Offline zoom, background pan, fit and wide desktop preserve circuit coordinates and avoid document scroll',['F-020','NF-005'],{landscape,physicalTouchVerified:false});
 // Add, move, connect, fault, change direction, and delete via real controls.
 await page.locator('#add-prism').click();const board=await page.locator('#board').boundingBox();await page.mouse.click(board.x+board.width*.12,board.y+board.height*.65);assert.equal(await page.locator('[data-node="P1"] .node-time').textContent(),'0.5s');
 const before=(await circuit(page)).circuit.nodes.find(n=>n.id==='P1');await page.locator('[data-node="P1"] .node-hit').click();await settle(page);const handle=await page.locator('[data-node="P1"] .move-handle').boundingBox();await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2+25,handle.y+handle.height/2-25,{steps:8});await page.mouse.up();await drag(page,'P1','G');
 const after=(await circuit(page)).circuit;assert.notDeepEqual(after.nodes.find(n=>n.id==='P1'),before);assert(after.edges.some(e=>e.id==='E1'&&e.from==='P1'&&e.to==='G'&&e.time==='1'));
 await menu(page,'点と道の一覧');await choose(page,/^E1：/);await choose(page,'向き：片方向');await choose(page,'P1 ↔ G');
 await menu(page,'点と道の一覧');await choose(page,/^E1：/);await choose(page,'使用：可');await page.locator('[data-node="P1"] .node-hit').dblclick();await choose(page,'使用：可');const faults=(await circuit(page)).circuit;assert.equal(faults.edges.find(e=>e.id==='E1').bidirectional,true);assert.equal(faults.edges.find(e=>e.id==='E1').enabled,false);assert.equal(faults.nodes.find(n=>n.id==='P1').enabled,false);
 await page.locator('[data-node="P1"] .node-hit').dblclick();await choose(page,'削除');await choose(page,'削除');const removed=(await circuit(page)).circuit;assert(!removed.nodes.some(n=>n.id==='P1'));assert(!removed.edges.some(e=>e.id==='E1'));assert.equal(removed.nodes.filter(n=>n.kind==='source').length,1);
 record(engine,'Add/move/connect/direction and simultaneous faults; point deletion removes only its related path',['F-001','F-002','F-015','NF-003']);
 // Actual manual save operations fill ten slots; no fixture writes bypass these controls.
 for(let i=0;i<10;i++){await menu(page,'回路を保存');await page.getByRole('textbox',{name:'回路名'}).fill('通信なし枠 '+i);await choose(page,'保存');}
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('prism-notes.circuits.v1')).value);assert.equal(saved.length,10);
 await menu(page,'回路を保存');await page.getByRole('textbox',{name:'回路名'}).fill('取消する置換');await choose(page,'保存');await choose(page,'取消');assert.equal(await page.getByRole('textbox',{name:'回路名'}).inputValue(),'取消する置換');await page.locator('#dialog-close').click();assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('prism-notes.circuits.v1')).value),saved);
 await menu(page,'回路を保存');await page.getByRole('textbox',{name:'回路名'}).fill('選択した置換');await choose(page,'保存');await choose(page,'通信なし枠 9');await choose(page,'確定');const replaced=await page.evaluate(()=>JSON.parse(localStorage.getItem('prism-notes.circuits.v1')).value);assert.deepEqual(replaced.slice(0,9),saved.slice(0,9));assert.equal(replaced[9].id,saved[9].id);assert.equal(replaced[9].name,'選択した置換');
 await menu(page,'保存回路');await choose(page,'選択した置換');await choose(page,'名前変更');await page.getByRole('textbox',{name:'新しい回路名'}).fill('変更した保存名');await choose(page,'変更');await choose(page,'変更した保存名');await choose(page,'読込');assert.equal(await page.locator('#title').textContent(),'変更した保存名');
 record(engine,'Ten actual saves, canceled replacement, selected-only replacement, rename and load',['F-016','F-025']);
 await time(page,'A','1.7');const edited=await circuit(page);
 await menu(page,'保存回路');await choose(page,'変更した保存名');await choose(page,'読込');await choose(page,'取消');assert.equal(await page.locator('[data-node="A"] .node-time').textContent(),'1.7s');
 await importFile(page,{...edited,version:999});assert((await page.locator('#result').textContent()).includes('対応する回路ファイルではありません'));assert.equal(await page.locator('[data-node="A"] .node-time').textContent(),'1.7s');
 await menu(page,'保存回路');await choose(page,'変更した保存名');await choose(page,'読込');await choose(page,'保存して入替');await page.getByRole('textbox',{name:'回路名'}).fill('保護した編集');await choose(page,'保存');await choose(page,'通信なし枠 8');await choose(page,'確定');assert.equal(await page.locator('[data-node="A"] .node-time').textContent(),'0.5s');const protectedEdit=await page.evaluate(()=>JSON.parse(localStorage.getItem('prism-notes.circuits.v1')).value.find(x=>x.name==='保護した編集'));assert.equal(protectedEdit.circuit.nodes.find(n=>n.id==='A').process,'1.7');
 const roundTrip=await circuit(page);await importFile(page,roundTrip);assert.deepEqual((await circuit(page)).circuit,roundTrip.circuit);
 await menu(page,'保存回路');await choose(page,'変更した保存名');await choose(page,'削除');await choose(page,'取消');await choose(page,'変更した保存名');await choose(page,'削除');await choose(page,'確定');const remaining=await page.evaluate(()=>JSON.parse(localStorage.getItem('prism-notes.circuits.v1')).value);assert.equal(remaining.length,9);assert(!remaining.some(x=>x.id===saved[9].id));assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('prism-notes.scores.v1')).value),scores);await page.locator('#dialog-close').click();
 record(engine,'Cancel and save-before-load preserve edits; invalid file rejected, circuit download round-trips, single slot deletion preserves scores',['F-017','F-018','F-026','NF-003','NF-007']);
 const beforeFailedSave=await circuit(page);await blockStorageWrites(page,'prism-notes.circuits.v1');await menu(page,'回路を保存');await page.getByRole('textbox',{name:'回路名'}).fill('通信なし保存失敗');await choose(page,'保存');assert((await page.locator('#dialog-error').textContent()).length>0);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('prism-notes.circuits.v1')).value),remaining);
 const fallbackPending=page.waitForEvent('download');await choose(page,'回路ファイル');const fallback=JSON.parse(fs.readFileSync(await (await fallbackPending).path(),'utf8'));assert.equal(fallback.name,'通信なし保存失敗');assert.deepEqual(fallback.circuit,beforeFailedSave.circuit);await restoreStorageWrites(page);
 assert.equal(await page.getByRole('textbox',{name:'回路名'}).inputValue(),'通信なし保存失敗');await choose(page,'保存');const recovered=await page.evaluate(()=>JSON.parse(localStorage.getItem('prism-notes.circuits.v1')).value);assert.equal(recovered.length,10);assert.deepEqual(recovered.slice(0,9),remaining);assert.equal(recovered[9].name,'通信なし保存失敗');assert.deepEqual(recovered[9].circuit,beforeFailedSave.circuit);
 record(engine,'Offline synthetic circuit-write failure preserves all slots, exports a fallback file and saves after recovery',['F-016','F-017','NF-003'],{syntheticQuotaFailure:true,realCapacityVerified:false});
 assert.equal((await circuit(page)).circuit.edges.find(edge=>edge.id==='SA').time,'1');await menu(page,'点と道の一覧');await choose(page,/^SA：/);await choose(page,'時間');await page.getByRole('textbox',{name:'秒数'}).fill('2');await choose(page,'確定');assert.equal((await circuit(page)).circuit.edges.find(edge=>edge.id==='SA').time,'2');
 const beforeUnsavedClose=await page.evaluate(()=>localStorage.getItem('prism-notes.circuits.v1'));await page.reload();await enterApp(page);await settle(page);assert.equal(await page.evaluate(()=>localStorage.getItem('prism-notes.circuits.v1')),beforeUnsavedClose);await page.locator('#home').click();await choose(page,'自由へ');await menu(page,'保存回路');await choose(page,'通信なし保存失敗');await choose(page,'読込');assert.equal((await circuit(page)).circuit.edges.find(edge=>edge.id==='SA').time,'1');
 record(engine,'Saved one-second path remains one second after unsaved two-second edit and offline reload',['F-016','F-018','NF-003','NF-004'],{acceptance:'AC-18'});
 // Use the adopted cyclic example, compare hand-calculated arrivals and FIFO waits.
 await menu(page,'分かれて、待って、巡る');await replaceDiscard(page);await pauseStart(page);
 let loop;
 for(let block=0;block<12;block++){for(let step=0;step<8;step++)await page.locator('#next').click();loop=await result(page);if(loop.records.filter(r=>r.type==='goal'&&r.node==='G1').length>=4)break;}
 assert.deepEqual(loop.records.filter(r=>r.type==='goal'&&r.node==='G1').slice(0,4).map(r=>r.time),['4','5','7','8']);assert(loop.records.some(r=>r.type==='process-start'&&Number(r.wait)>0));assert(loop.records.some(r=>r.type==='branch'&&r.children.length>1));assert(loop.records.filter(r=>r.type==='arrival'&&r.node==='C').length>2);
 await page.locator('#records').click();let branch;
 for(let n=0;n<30;n++){const row=page.locator('#record-list button').filter({hasText:/分岐$/});if(await row.count()){branch=(await row.first().textContent()).match(/#(\d+)/)[1];await row.first().click();break;}assert(!(await page.locator('#record-next').isDisabled()));await page.locator('#record-next').click();await settle(page);}
 assert(branch);const branchRecord=loop.records.find(r=>r.type==='branch'&&String(r.particle)===branch);await choose(page,'分岐後の光線：'+branchRecord.children[0]);assert((await page.locator('#dialog-title').textContent()).includes('#'+branchRecord.children[0]));await page.locator('#dialog-body .dialog-list .dialog-list>button').first().click();await choose(page,'親の光線：'+branch);assert((await page.locator('#dialog-title').textContent()).includes('#'+branch));await page.locator('#dialog-close').click();await page.locator('#close-records').click();
 const paused=(await inspect(page)).run;assert.equal(paused.status,'paused');const beforeGuide=await result(page),beforeGuideHistory=await page.evaluate(()=>localStorage.getItem('prism-notes.guides.v1'));await menu(page,'操作の案内');assert(await page.locator('#guide-bar').isVisible());await blockStorageWrites(page,'prism-notes.guides.v1');await skipGuide(page);assert(await page.locator('#guide-bar').isVisible());assert((await page.locator('#result').textContent()).includes('Synthetic offline quota failure'));assert.equal(await page.evaluate(()=>localStorage.getItem('prism-notes.guides.v1')),beforeGuideHistory);await restoreStorageWrites(page);await skipGuide(page);assert(!(await page.locator('#guide-bar').isVisible()));
 const afterGuide=await result(page);assert.deepEqual(afterGuide.records,beforeGuide.records);assert.deepEqual(afterGuide.conditions,beforeGuide.conditions);assert.deepEqual(afterGuide.evaluation,beforeGuide.evaluation);const restoredRun=(await inspect(page)).run;assert.equal(restoredRun.status,'paused');assert.equal(restoredRun.clock,paused.clock);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('prism-notes.circuits.v1')).value),recovered);
 record(engine,'Guide history write failure retains practice; retry restores paused original clock, circuit and all records without using save slots',['F-019','NF-003','NF-004'],{acceptance:['AC-25','AC-26'],syntheticQuotaFailure:true});
 await page.locator('#play').click();await page.waitForFunction(()=>document.getElementById('play').dataset.state==='running');await page.locator('#play').click();assert.equal((await inspect(page)).run.status,'paused');await page.locator('#stop').click();const stopped=await result(page);assert.deepEqual(stopped.records,loop.records.concat(stopped.records.slice(loop.records.length)));assert.equal(stopped.status,'stopped');
 record(engine,'Cyclic spread preserves branch/parent records and hand-calculated 4/5/7/8 arrivals, queue waits, pause/resume and stop',['F-004','F-005','F-007','F-008','F-010','F-011','NF-004'],{records:stopped.records.length});
 // One finite synthetic all-goal circuit makes both visible arrival and dead end observable.
 const finite={format:'prism-notes-circuit',version:1,name:'通信なし合成回路',circuit:{mode:'spread',target:'all',nodes:[{id:'S',kind:'source',x:.5,y:.1,process:'0'},{id:'A',kind:'prism',x:.2,y:.5,process:'0'},{id:'G',kind:'goal',x:.8,y:.8,process:'0'},{id:'U',kind:'goal',x:.1,y:.8,process:'0'}],edges:[{id:'SA',from:'S',to:'A',time:'0.5'},{id:'SG',from:'S',to:'G',time:'0.5'}]}};
 await importFile(page,finite);await replaceDiscard(page);await page.locator('#flow').click();await page.getByRole('combobox',{name:'流れ方',exact:true}).selectOption('fastest');await page.getByRole('combobox',{name:'送信先',exact:true}).selectOption('all');await choose(page,'確定');await pauseStart(page);await finish(page);const unreachable=await result(page);assert(unreachable.records.some(r=>r.type==='unreachable'&&r.target==='U'));assert(unreachable.records.some(r=>r.type==='goal'&&r.node==='G'));await page.locator('#stop').click();
 await page.locator('#flow').click();await page.getByRole('combobox',{name:'流れ方',exact:true}).selectOption('spread');await choose(page,'確定');
 const audio=await page.evaluate(()=>({AudioContext:typeof window.AudioContext,webkitAudioContext:typeof window.webkitAudioContext}));const hasAudio=audio.AudioContext==='function'||audio.webkitAudioContext==='function';
 await page.locator('#sound').click();if(hasAudio)assert.equal(await page.locator('#sound').textContent(),'音あり');else{assert((await page.locator('#result').textContent()).includes('このブラウザでは音を開始できません'));report.pending.push({engine,requirement:'F-020',label:'Actual offline audio synthesis/output',observed:audio,reason:'Windows test engine has no audio context; physical Safari remains required.'});}
 await page.evaluate(()=>window.__offlineBellStarts=[]);await pauseStart(page);await finish(page);if(hasAudio)assert.equal(await page.evaluate(()=>window.__offlineBellStarts.length),1);const endings=await result(page);assert(endings.records.some(r=>r.type==='deadend'&&r.node==='A'));assert(endings.records.some(r=>r.type==='goal'&&r.node==='G'));if(hasAudio){await page.locator('#sound').click();assert.equal(await page.locator('#sound').textContent(),'音なし');}await page.locator('#stop').click();
 record(engine,'Flow/target settings, dead end and unreachable target remain visible with all records; audio control API path checked separately',['F-002','F-006','F-020'],{audioSupport:audio,listeningVerified:false});
 // A labelled render stall tests offline preservation, not a device speed threshold.
 const queued={...finite,name:'通信なし待ち列合成回路',circuit:{mode:'fastest',target:'all',nodes:[{id:'S',kind:'source',x:.5,y:.1,process:'0'},{id:'A',kind:'prism',x:.5,y:.45,process:'0.5'},...[0,1,2].map(i=>({id:'G'+i,kind:'goal',x:.15+i*.35,y:.8,process:'0'}))],edges:[{id:'SA',from:'S',to:'A',time:'0.5'},...[0,1,2].map(i=>({id:'AG'+i,from:'A',to:'G'+i,time:'0.5'}))]}};
 await importFile(page,queued);await replaceDiscard(page);
 await page.evaluate(()=>{const append=Element.prototype.append;window.__offlineAppend=append;let stalled=false;Element.prototype.append=function(...args){if(!stalled&&this.closest?.('#board')){stalled=true;const start=performance.now();while(performance.now()-start<135){/* synthetic fixture */}}return append.apply(this,args);};});
 await page.locator('#play').click();await page.waitForFunction(()=>document.getElementById('result').textContent.includes('負荷のため一時停止'));
 await page.evaluate(()=>{Element.prototype.append=window.__offlineAppend;delete window.__offlineAppend;});const held=await inspect(page);assert.equal(held.run.pauseReason,'load');assert.equal(held.run.active,3);assert.equal(held.run.retainedParticles,3);await settle(page);assert.equal((await inspect(page)).run.clock,held.run.clock);
 await page.locator('#next').click();const waiting=await inspect(page);assert.equal(waiting.run.waiting,2);await finish(page);const resumed=await result(page);
 const {Simulation}=await import(pathToFileURL(path.join(root,'v'+version,'src/core/simulation.js')).href),reference=new Simulation(queued.circuit);reference.advanceUntil('3');assert(reference.exhausted);assert.deepEqual(resumed.records,reference.records);assert.deepEqual(resumed.records.filter(r=>r.type==='goal').map(r=>r.time),['1.5','2','2.5']);await page.locator('#stop').click();
 record(engine,'Measured synthetic render stall retains all particles, frozen clock and queue; every resumed record equals uninterrupted reference',['F-009','NF-002','NF-004'],{syntheticMilliseconds:135,held:held.run,waiting:waiting.run,records:resumed.records.length,referenceRecords:reference.records.length});
 const persisted=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),keys);await page.reload();await enterApp(page);assert.equal(await page.locator('#guide-bar').isVisible(),false);assert.deepEqual(await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),keys),persisted);
 await menu(page,'操作の案内');assert(await page.locator('#guide-bar').isVisible());await skipGuide(page);assert.equal(await page.locator('.edge:not(.candidate)').count(),0);
 record(engine,'Offline reload retains every saved slot/score/guide history; manual guide returns to the original mode',['F-019','F-023','NF-003','NF-004','NF-008']);
 const beforeHistoryLoss=await page.evaluate(keys=>Object.fromEntries(keys.slice(0,2).map(key=>[key,localStorage.getItem(key)])),keys);await page.evaluate(()=>localStorage.removeItem('prism-notes.guides.v1'));await page.reload();await enterApp(page);await settle(page);await startGuide(page);assert(await page.locator('#guide-bar').isVisible());await skipGuide(page);await page.locator('#home').click();await choose(page,'自由へ');await startGuide(page);assert(await page.locator('#guide-bar').isVisible());await skipGuide(page);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('prism-notes.guides.v1')).value),{challenge:'skipped',free:'skipped'});assert.deepEqual(await page.evaluate(keys=>Object.fromEntries(keys.slice(0,2).map(key=>[key,localStorage.getItem(key)])),keys),beforeHistoryLoss);
 record(engine,'Synthetic guide-history loss leaves manual guides available for each mode independently without changing saved circuits or scores',['F-019','NF-003','NF-008'],{acceptance:'AC-26',syntheticHistoryLoss:true});
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));port=server.address().port;const url='http://127.0.0.1:'+port+'/prism/';
 try{
  for(const engine of channel?['chromium']:['chromium','webkit']){
   originOffline=false;if(!server.listening)await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));const browser=await pw[engine].launch({headless:true,...(channel?{channel}:{})});report.browsers.push({engine,channel:channel||null,version:browser.version()});
   try{
    const context=await browser.newContext({viewport:{width:390,height:664}});await context.exposeBinding('__offlineWindowError',(source,error)=>report.windowErrors.push({engine,url:source.page.url(),...error}));
    await context.addInitScript(()=>{addEventListener('error',e=>{void window.__offlineWindowError({type:'error',message:e.message}).catch(()=>{});});addEventListener('unhandledrejection',e=>{void window.__offlineWindowError({type:'unhandledrejection',message:String(e.reason)}).catch(()=>{});});
      window.__offlineBellStarts=[];const Audio=window.AudioContext??window.webkitAudioContext;
      if(Audio){const create=Audio.prototype.createOscillator;Audio.prototype.createOscillator=function(){const oscillator=create.call(this),start=oscillator.start.bind(oscillator);oscillator.start=at=>{if(Math.abs(oscillator.frequency.value-523.22)<.02)window.__offlineBellStarts.push({at,frequency:oscillator.frequency.value});return start(at);};return oscillator;};}
    });
    const initial=await context.newPage();await initial.goto(url);await enterApp(initial);await prepared(initial);if(engine==='chromium'){const cdp=await context.newCDPSession(initial);await cdp.send('Network.clearBrowserCache');await cdp.detach();}await initial.close();
    originOffline=true;if(engine==='chromium')await context.setOffline(true);else await new Promise(resolve=>server.close(resolve));
    const page=await context.newPage(),assetResponses=[];page.on('response',response=>{if(response.url().startsWith(url))assetResponses.push({url:response.url(),status:response.status(),fromServiceWorker:response.fromServiceWorker()});});page.on('pageerror',e=>{const detail={engine,url:page.url(),originOffline,name:e.name,message:e.message,stack:e.stack};detail.expectedStoppedOrigin=expectedStoppedOriginWorkerError(detail);report.errors.push(detail);});
    const response=await page.goto(url);await enterApp(page);assert.equal(response.status(),200);assert(response.fromServiceWorker());await prepared(page);assert.equal(await page.locator('meta[name=prism-version]').getAttribute('content'),version);
    record(engine,'Closed-page prepared startup is served by the real worker with no reachable origin',['F-022','F-023','NF-008'],{fromServiceWorker:true});
    await exercise(page,engine);assert(assetResponses.some(response=>response.url.includes('/src/ui/app.js')));assert(assetResponses.every(response=>response.status===200&&response.fromServiceWorker));record(engine,'All observed app responses during offline flows and reload came from the worker',['F-023','NF-008'],{assetResponses});assert.deepEqual(report.errors.filter(e=>e.engine===engine&&!e.expectedStoppedOrigin),[]);assert.deepEqual(report.windowErrors.filter(e=>e.engine===engine),[]);await page.screenshot({path:path.join(out,engine+'-offline.png')});
    await context.close();
   }finally{await browser.close();}
  }
  report.passed=true;console.log('Offline feature checks passed: '+report.checks.length);
 }catch(error){report.passed=false;report.failure=error.stack;throw error;}
 finally{if(server.listening)await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
})().catch(error=>{console.error(error);process.exitCode=1;});
