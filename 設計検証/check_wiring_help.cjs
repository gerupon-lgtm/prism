const {enterApp,startGuide,skipGuide}=require('./browser_wait.cjs');
// PC browser gestures on the built app. These are not physical touch-device results.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
if(!arg('--playwright-path'))throw new Error('Pass --playwright-path');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),channel=arg('--channel');
if(channel&&!['chrome','msedge'].includes(channel))throw new Error('Use chrome or msedge');
const root=path.resolve(__dirname,'../dist'),out=path.join(__dirname,'結線補助',arg('--url')?'public':channel||'');
fs.mkdirSync(out,{recursive:true});
const reportFile=path.join(out,'report.json');
if(fs.existsSync(reportFile)&&JSON.parse(fs.readFileSync(reportFile)).passed===false)fs.copyFileSync(reportFile,path.join(out,'failed-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json'),fs.constants.COPYFILE_EXCL);
const report={version:JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version,evidence:'PC engines, mouse pointer gestures in mobile emulation, Chromium protocol touch input, synthetic orientation and CSS text enlargement. No physical touch-device evidence.',checks:[],browsers:[]};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.ttf':'font/ttf','.png':'image/png'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{const target=file===root?path.join(root,'index.html'):file;res.setHeader('Content-Type',mime[path.extname(target)]||'application/octet-stream');res.end(fs.readFileSync(target));}catch{res.writeHead(404).end();}});
const settle=page=>page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
const count=page=>page.locator('#board .edge:not(.candidate)').count();
async function center(page,id){const hit=page.locator(`#board [data-node="${id}"] .node-hit`);await hit.waitFor({state:'visible'});const b=await hit.boundingBox();assert(b,`Visible target ${id}`);return {x:b.x+b.width/2,y:b.y+b.height/2};}
async function start(page,id){const p=await center(page,id);await page.mouse.move(p.x,p.y);await page.mouse.down();return p;}
async function move(page,id){const p=await center(page,id);await page.mouse.move(p.x,p.y,{steps:8});return p;}
async function loupe(page,p,label){
  await settle(page);const state=await page.evaluate(({x,y})=>{const m=document.getElementById('wire-magnifier'),b=document.getElementById('board').getBoundingClientRect(),r=m.getBoundingClientRect();return {hidden:m.hidden,rect:[r.left,r.top,r.right,r.bottom],board:[b.left,b.top,b.right,b.bottom],avoidsFinger:x<r.left-30||x>r.right+30||y<r.top-30||y>r.bottom+30,use:m.querySelector('use').getAttribute('href'),transform:m.querySelector('g').getAttribute('transform'),route:m.querySelector('span').textContent};},p);
  assert.equal(state.hidden,false,label);assert(state.avoidsFinger,label+' avoids finger');
  for(let i=0;i<4;i++)assert(i<2?state.rect[i]>=state.board[i]-.5:state.rect[i]<=state.board[i]+.5,label+' within board');
  assert.equal(state.use,'#board-detail');assert(!state.transform.includes('NaN'));report.checks.push({label,...state});
}
async function controls(page,label){
  await settle(page);const measure=await page.evaluate(()=>{const buttons=[...document.querySelectorAll('#stage-controls button')].filter(e=>e.getClientRects().length);const rect=e=>{const r=e.getBoundingClientRect();return {id:e.id,l:r.left,t:r.top,r:r.right,b:r.bottom,client:[e.clientWidth,e.clientHeight],scroll:[e.scrollWidth,e.scrollHeight]};};return {viewport:[innerWidth,innerHeight],scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],buttons:buttons.map(rect)};});
  assert(measure.scroll[0]<=measure.viewport[0]+1&&measure.scroll[1]<=measure.viewport[1]+1,label+' document fits');
  for(const b of measure.buttons){assert(b.l>=-.5&&b.t>=-.5&&b.r<=measure.viewport[0]+.5&&b.b<=measure.viewport[1]+.5,label+' bounds '+b.id);assert(b.scroll[0]<=b.client[0]+1&&b.scroll[1]<=b.client[1]+1,label+' text '+b.id);}
  for(let i=0;i<measure.buttons.length;i++)for(let j=i+1;j<measure.buttons.length;j++){const a=measure.buttons[i],b=measure.buttons[j];assert(Math.min(a.r,b.r)-Math.max(a.l,b.l)<1||Math.min(a.b,b.b)-Math.max(a.t,b.t)<1,label+' overlap '+a.id+'/'+b.id);}
  report.checks.push({label,...measure});
}
async function rotate(page,angle){await page.evaluate(angle=>{Object.assign(__direction,{angle,type:angle?'landscape-primary':'portrait-primary'});screen.orientation.dispatchEvent(new Event('change'));},angle);await page.setViewportSize(angle?{width:915,height:330}:{width:412,height:804});await settle(page);}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
  for(const engine of channel?['chromium']:['chromium','webkit']){
    const browser=await pw[engine].launch({headless:true,...(channel?{channel}:{})});report.browsers.push({engine,channel,version:browser.version()});
    try{const context=await browser.newContext({viewport:{width:412,height:804},isMobile:true,hasTouch:true});
      await context.addInitScript(()=>{window.__direction={angle:0,type:'portrait-primary'};const o=new EventTarget();Object.defineProperties(o,{type:{get:()=>__direction.type},angle:{get:()=>__direction.angle}});Object.defineProperty(screen,'orientation',{get:()=>o});document.addEventListener('pointerdown',e=>{window.__lastPointer=e.pointerId;},true);});
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(arg('--url')??`http://127.0.0.1:${server.address().port}/`);await enterApp(page);await settle(page);
      if(await page.locator('#guide-skip').isVisible())await skipGuide(page);
      assert.equal(await page.locator('meta[name=prism-version]').getAttribute('content'),report.version);
      assert.equal(await page.locator('#magnifier-toggle').getAttribute('aria-pressed'),'true');await controls(page,engine+' portrait controls');
      await start(page,'S');const a=await move(page,'A');assert.equal(await count(page),0);await loupe(page,a,engine+' continuous preview at A');
      assert(await page.locator('#board [data-node="G"]').evaluate(e=>e.classList.contains('choice')));const g=await move(page,'G');assert.equal(await count(page),0);await loupe(page,g,engine+' continuous preview at G');
      await page.screenshot({path:path.join(out,engine+'-magnifier.png')});await page.mouse.up();await settle(page);assert.equal(await count(page),2);assert(await page.locator('#wire-magnifier').isHidden());
      report.checks.push({label:engine+' single uninterrupted S-A-G stroke commits two edges on release',passed:true});
      await page.locator('#clear-wires').click();assert.equal(await count(page),0);assert.equal(await page.locator('#clear-wires').textContent(),'戻す');await page.locator('#clear-wires').click();assert.equal(await count(page),2);
      report.checks.push({label:engine+' clear all edges and immediate undo',passed:true});
      await page.locator('#play').click();await page.waitForFunction(()=>document.getElementById('play').dataset.state==='running');assert(await page.locator('#clear-wires').isDisabled());await page.locator('#play').click();assert(await page.locator('#clear-wires').isDisabled());await page.locator('#stop').click();await page.locator('#clear-wires').click();
      report.checks.push({label:engine+' running and paused circuits reject clear',passed:true});
      const hit=async id=>page.locator(`[data-node="${id}"] .node-hit`).evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,r:Math.min(r.width,r.height)/2};});
      const nearStart=await hit('S'),nearA=await hit('A');await page.mouse.move(nearStart.x,nearStart.y+nearStart.r+6);await page.mouse.down();await page.mouse.move(nearA.x-nearA.r-8,nearA.y,{steps:8});await page.mouse.up();assert.equal(await page.locator('.edge:not(.candidate)[data-edge="SA"]').count(),1);await page.locator('#clear-wires').click();
      report.checks.push({label:engine+' near-miss start and release just outside the prism still connect to its centre',passed:true});
      await start(page,'S');const relay=await hit('A');await page.mouse.move(relay.x-21,relay.y,{steps:8});await settle(page);assert((await page.locator('#wire-magnifier span').textContent()).includes('A'));assert.equal(await count(page),0);const bell=await hit('G');await page.mouse.move(bell.x+bell.r+8,bell.y,{steps:8});await page.mouse.up();assert.equal(await count(page),2);await page.locator('#clear-wires').click();
      report.checks.push({label:engine+' off-centre intermediate and drifted bell release finish one continuous S-A-G stroke',passed:true});
      await start(page,'S');await move(page,'A');await page.mouse.move(30,100);await page.mouse.up();assert.equal(await count(page),0);
      report.checks.push({label:engine+' release on empty space cancels entire stroke',passed:true});
      await start(page,'S');await move(page,'A');await page.evaluate(()=>document.getElementById('board').dispatchEvent(new PointerEvent('pointercancel',{pointerId:__lastPointer,bubbles:true})));await page.mouse.up();assert.equal(await count(page),0);assert(await page.locator('#wire-magnifier').isHidden());
      report.checks.push({label:engine+' interrupted stroke leaves no partial edges',passed:true});
      await page.locator('#magnifier-toggle').click();await start(page,'S');await move(page,'A');assert(await page.locator('#wire-magnifier').isHidden());await page.mouse.up();assert.equal(await count(page),1);await start(page,'A');await move(page,'G');await page.mouse.up();assert.equal(await count(page),2);
      report.checks.push({label:engine+' magnifier OFF and separate consecutive drags',passed:true});
      await page.locator('#magnifier-toggle').click();await page.locator('#clear-wires').click();
      for(const angle of [90,270]){await rotate(page,angle);await controls(page,engine+' rotated '+angle);await start(page,'S');const p=await move(page,'A');await loupe(page,p,engine+' rotated loupe '+angle);await move(page,'G');await page.mouse.up();assert.equal(await count(page),2);await page.locator('#clear-wires').click();report.checks.push({label:engine+' rotated continuous stroke '+angle,passed:true});}
      await rotate(page,0);
      await page.locator('#home').click();await page.getByRole('button',{name:/^Q3 速く、少ない道で/}).click();await settle(page);await start(page,'S');await move(page,'A');await page.mouse.up();assert.equal(await page.locator('#board .edge:not(.candidate)[data-edge="SA"]').count(),1);assert.equal(await page.locator('#board .edge:not(.candidate)[data-edge="SC"]').count(),0);await start(page,'A');await move(page,'G');await page.mouse.up();assert.equal(await count(page),2);await page.locator('#clear-wires').click();await page.locator('#home').click();await page.getByRole('button',{name:/^Q1 はじめの一音/}).click();await settle(page);
      report.checks.push({label:engine+' Q3 individual drag does not detour through nearby C',passed:true});
      if(engine==='chromium'){
        const cdp=await context.newCDPSession(page),s=await center(page,'S'),a=await center(page,'A'),g=await center(page,'G');
        const sr=await hit('S'),gr=await hit('G'),offA={x:a.x-21,y:a.y};
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:s.x,y:s.y+sr.r+6,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...offA,id:1}]});await loupe(page,offA,engine+' protocol off-centre touch loupe');await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:g.x+gr.r+8,y:g.y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await count(page),2);await page.locator('#clear-wires').click();
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...s,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...a,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1},{x:a.x+60,y:a.y+40,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await count(page),0);assert(await page.locator('#wire-magnifier').isHidden());await cdp.detach();
        report.checks.push({label:engine+' browser protocol touch connects and second finger cancels pending stroke; not physical-device evidence',passed:true});
      }
      await rotate(page,0);await page.locator('#home').click();await page.getByRole('button',{name:'自由へ',exact:true}).click();if(await page.locator('#guide-skip').isVisible())await skipGuide(page);
      const save=async name=>{await page.locator('#menu').click();await page.getByRole('button',{name:'回路を保存',exact:true}).click();await page.getByRole('textbox',{name:'回路名'}).fill(name);await page.getByRole('button',{name:'保存',exact:true}).click();};
      await save('元の配線');const original=await count(page);await page.locator('#clear-wires').click();assert.equal(await count(page),0);await save('空の配線');await page.locator('#clear-wires').click();assert.equal(await count(page),original);assert((await page.locator('#condition').textContent()).includes('未保存'));
      await page.locator('#home').click();await page.getByRole('button',{name:/^Q1 はじめの一音/}).click();assert(await page.getByRole('button',{name:'保存せず入替',exact:true}).isVisible());await page.getByRole('button',{name:'保存せず入替',exact:true}).click();
      report.checks.push({label:engine+' saving cleared circuit then undo still protects unsaved restored edges',passed:true});
      await rotate(page,0);await page.setViewportSize({width:320,height:568});await controls(page,engine+' short portrait');
      await page.evaluate(()=>{document.documentElement.style.fontSize='28px';window.dispatchEvent(new Event('resize'));});await controls(page,engine+' enlarged short portrait');
      await page.setViewportSize({width:412,height:804});await controls(page,engine+' enlarged portrait');await rotate(page,90);await controls(page,engine+' enlarged landscape');
      assert.deepEqual(errors,[]);report.checks.push({label:engine+' no browser script errors',passed:true});await context.close();
      const desktop=await browser.newContext({viewport:{width:900,height:900}}),mousePage=await desktop.newPage();await mousePage.goto(arg('--url')??`http://127.0.0.1:${server.address().port}/`);await enterApp(mousePage);await settle(mousePage);if(await mousePage.locator('#guide-skip').isVisible())await skipGuide(mousePage);await settle(mousePage);assert.equal(await mousePage.locator('#magnifier-toggle').getAttribute('aria-pressed'),'false');await start(mousePage,'S');await move(mousePage,'A');assert(await mousePage.locator('#wire-magnifier').isHidden());await mousePage.mouse.up();report.checks.push({label:engine+' desktop mouse starts with loupe OFF',passed:true});await desktop.close();
    }finally{await browser.close();}
  }
  report.passed=true;console.log(`Wiring help checks passed: ${report.checks.length}`);
}catch(e){report.passed=false;report.failure=e.stack;console.error(e.stack);process.exitCode=1;}finally{fs.writeFileSync(reportFile,JSON.stringify(report,null,2));await new Promise(r=>server.close(r));}})();
