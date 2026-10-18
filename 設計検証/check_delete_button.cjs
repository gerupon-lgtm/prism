// Actual Chromium touch/pen input; WebKit touch taps and synthetic drift.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {enterApp,selectChallenge,dragConnection}=require('./browser_wait.cjs');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),engine=arg('--engine')||'chromium',channel=arg('--channel'),root=path.resolve(__dirname,'../dist'),version=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version;
const out=path.join(__dirname,'削除ボタン',version,arg('--url')?new URL(arg('--url')).hostname:'local',channel||engine);fs.mkdirSync(out,{recursive:true});const file=path.join(out,'report.json');if(fs.existsSync(file)&&!JSON.parse(fs.readFileSync(file)).passed)fs.copyFileSync(file,path.join(out,'failed-'+Date.now()+'.json'));
const report={version,checks:[],evidence:'Disposable PC browsers. Actual Chromium protocol touch and pen, WebKit native touch taps and synthetic drift. Physical phone usability and acoustic output remain unverified.'};
const server=http.createServer((req,res)=>{let f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(f===root)f=path.join(root,'index.html');if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.ttf':'font/ttf'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
const check=(label,data={})=>report.checks.push({label,passed:true,...data});
const built=page=>page.locator('#board .edge:not(.candidate)').evaluateAll(es=>es.map(e=>e.dataset.edge).sort());
const point=page=>page.locator('#board [data-edge=BD] .edge-line').evaluate(e=>{const p=e.getPointAtLength(e.getTotalLength()*.35).matrixTransform(e.getScreenCTM());return{x:p.x,y:p.y};});
(async()=>{let browser;await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 browser=await pw[engine].launch({headless:true,...(channel?{channel}:{})});report.browser={engine,channel,version:browser.version()};
 const context=await browser.newContext({viewport:{width:412,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(arg('--url')||`http://127.0.0.1:${server.address().port}/`);await enterApp(page);await selectChallenge(page,'Q7');
 assert.equal(await page.locator('meta[name=prism-version]').getAttribute('content'),version);
 await page.evaluate(async version=>{const {Chime}=await import('./v'+version+'/src/ui/audio.js');window.__tapSounds=[];window.__confirmClicks=[];document.addEventListener('click',e=>__confirmClicks.push({id:e.target.id,detail:e.detail,pointerId:e.pointerId,pointerType:e.pointerType,trusted:e.isTrusted}),true);const tap=Chime.prototype.tap;Chime.prototype.tap=function(){const before=this.voices.size;tap.call(this);__tapSounds.push({muted:this.muted,state:this.context?.state,created:this.voices.size-before});};},version);
 await dragConnection(page,'S','A');await dragConnection(page,'A','B');
 const cdp=engine==='chromium'?await context.newCDPSession(page):null;
 const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
 async function ensure(){if(await page.locator('#wire-delete-toast').evaluate(e=>e.open))await page.keyboard.press('Escape');if(!await page.locator('#board .edge:not(.candidate)[data-edge=BD]').count())await dragConnection(page,'B','D');}
 async function hold(){const p=await point(page);if(cdp)await touch('touchStart',[{...p,id:1}]);else{await page.mouse.move(p.x,p.y);await page.mouse.down();}await page.waitForFunction(()=>document.getElementById('wire-delete-toast').open);if(cdp)await touch('touchEnd',[]);else await page.mouse.up();assert.equal(await page.locator('#board .edge.pending-delete[data-edge=BD]').count(),1);assert(await page.locator('#wire-delete-toast').evaluate(e=>e.open));return p;}
 async function action(id,delta=0,{outside=false,cancel=false,multi=false}={}){
  const b=await page.locator('#'+id).boundingBox(),p={x:b.x+b.width/2,y:b.y+b.height/2,id:2},end={...p,x:outside?b.x-15:p.x+delta,y:p.y+delta};await page.evaluate(()=>{__tapSounds=[];__confirmClicks=[];});
  if(cdp){await touch('touchStart',[p]);if(multi)await touch('touchStart',[p,{...p,x:p.x+20,id:3}]);if(delta||outside)await touch('touchMove',[end]);if(cancel)await touch('touchCancel',[]);else await touch('touchEnd',[]);}
  else if(!delta&&!outside&&!cancel&&!multi)await page.touchscreen.tap(p.x,p.y);
  else await page.locator('#'+id).evaluate((button,{p,end,cancel,multi})=>{button.dispatchEvent(new PointerEvent('pointerdown',{pointerId:2,pointerType:'touch',isPrimary:true,button:0,clientX:p.x,clientY:p.y,bubbles:true}));if(multi)button.dispatchEvent(new PointerEvent('pointerdown',{pointerId:3,pointerType:'touch',isPrimary:false,button:0,clientX:p.x+20,clientY:p.y,bubbles:true}));button.dispatchEvent(new PointerEvent(cancel?'pointercancel':'pointerup',{pointerId:2,pointerType:'touch',isPrimary:true,button:0,clientX:end.x,clientY:end.y,bubbles:true,cancelable:true}));if(multi)button.dispatchEvent(new PointerEvent('pointerup',{pointerId:3,pointerType:'touch',isPrimary:false,button:0,bubbles:true}));},{p,end,cancel,multi});
  return await page.evaluate(()=>__tapSounds);
 }
 for(const delta of [0,6,16,24]){
  await ensure();const before=await built(page);await hold();const sounds=await action('wire-delete-ok',delta);assert.deepEqual(await built(page),before.filter(id=>id!=='BD'));assert.equal(await page.locator('#wire-delete-toast').evaluate(e=>e.open),false);assert.equal(await page.locator('#play').getAttribute('data-state'),'ready','No ghost click may start the circuit underneath');assert.equal(sounds.length,1,'Exactly one accepted operation sound '+JSON.stringify(await page.evaluate(()=>__confirmClicks)));if(cdp){assert.equal(sounds[0].muted,false);assert.equal(sounds[0].state,'running');assert(sounds[0].created>0,'Operation sound must create a voice');}check('fresh OK with drift '+delta+' deletes only BD and requests one operation sound',{sounds,input:cdp?'protocol touch':delta?'synthetic pointer':'native touch tap'});
 }
 for(const mode of ['outside','cancel','multi']){
  await ensure();const before=await built(page);await hold();await action('wire-delete-ok',16,{[mode]:true});assert.deepEqual(await built(page),before);check(mode+' does not delete');await page.keyboard.press('Escape');
 }
 if(cdp){
  await ensure();const before=await built(page);await hold();const b=await page.locator('#wire-delete-ok').boundingBox(),p={x:b.x+b.width/2,y:b.y+b.height/2};await page.evaluate(()=>__tapSounds=[]);
  await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',pointerType:'pen',button:'left',buttons:1,clickCount:1,...p});await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',pointerType:'pen',buttons:1,x:p.x+16,y:p.y+16});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',pointerType:'pen',button:'left',clickCount:1,x:p.x+16,y:p.y+16});
  assert.deepEqual(await built(page),before.filter(id=>id!=='BD'));assert.equal((await page.evaluate(()=>__tapSounds)).length,1);check('protocol pen drift confirms once');
 }
 await ensure();let before=await built(page);await hold();const cancelSound=await action('wire-delete-cancel',16);assert.deepEqual(await built(page),before);assert.equal(await page.locator('#wire-delete-toast').evaluate(e=>e.open),false);assert.equal(cancelSound.length,1);check('Cancel accepts thumb drift, closes, and keeps all wiring');
 // A following outside tap dismisses the confirmation, without clearing the board.
 await ensure();await hold();const popup=await page.locator('#wire-delete-toast').boundingBox();await page.touchscreen.tap(12,popup.y>30?15:830);assert.equal(await page.locator('#wire-delete-toast').evaluate(e=>e.open),false);assert.deepEqual(await built(page),before);check('outside tap closes and never activates controls behind');
 // Recover after the original long-press pointer was cancelled or became two fingers.
 if(cdp){for(const mode of ['cancel','multi']){
  const p=await point(page);await touch('touchStart',[{...p,id:1}]);await page.waitForFunction(()=>document.getElementById('wire-delete-toast').open);if(mode==='cancel')await touch('touchCancel',[]);else{await touch('touchStart',[{...p,id:1},{...p,x:p.x+40,id:2}]);await touch('touchEnd',[]);}assert.equal(await page.locator('#wire-delete-toast').evaluate(e=>e.open),false);await hold();await action('wire-delete-ok',16);assert.deepEqual(await built(page),before.filter(id=>id!=='BD'));check('fresh OK works after original hold '+mode);await ensure();
 }}
 await hold();await page.locator('#wire-delete-ok').focus();await page.keyboard.press('Enter');assert.deepEqual(await built(page),before.filter(id=>id!=='BD'));check('keyboard confirmation still works');await ensure();await hold();await page.locator('#wire-delete-ok').click();assert.deepEqual(await built(page),before.filter(id=>id!=='BD'));check('mouse confirmation still works');
 await ensure();await hold();await page.locator('#wire-delete-cancel').click();await page.locator('#sound').click();assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'false');await hold();const muted=await action('wire-delete-ok',16);assert.equal(muted.length,1);assert.equal(muted[0].muted,true);assert.equal(muted[0].created,0);assert.deepEqual(await built(page),before.filter(id=>id!=='BD'));check('muted confirmation still deletes, without creating audio voices');
 assert.deepEqual(errors,[]);await cdp?.detach();report.passed=true;console.log('Delete button checks passed: '+report.checks.length);
 }catch(e){report.passed=false;report.failure=e.stack;console.error(e.stack);process.exitCode=1;}finally{await browser?.close();fs.writeFileSync(file,JSON.stringify(report,null,2));await new Promise(r=>server.close(r));}})();
