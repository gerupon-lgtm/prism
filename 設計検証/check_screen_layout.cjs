// Real desktop engine checks of a UI fixture, not game/device acceptance.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
function arg(name) { const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1]; }
const library=arg('--playwright-path');
if(!library)throw new Error('Pass --playwright-path for an existing playwright-core package.');
if(arg('--browser-cache'))process.env.PLAYWRIGHT_BROWSERS_PATH=arg('--browser-cache');
const pw=require(path.resolve(library));
const root=path.resolve(__dirname,'..');
const out=path.join(__dirname,'操作画面');fs.mkdirSync(out,{recursive:true});
const version='0.1.0';
const report={version,evidence:'Desktop Chromium/WebKit; viewport emulation and synthetic display fixtures only. No real device, simulation, audio, storage, or deployment evidence.',results:[],flows:[]};
const sizes=[[320,480],[360,640],[390,664],[430,780],[480,240],[568,260],[844,310],[768,1024],[1280,800]];
const views=['play','settings','records','saves','guide','input','save-error','score-error','delete','load-protect','record-detail'];
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{
  try { const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
  } catch {res.writeHead(404).end();}
});
async function settle(page){await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});}
async function measure(page,engine,label){
  const data=await page.evaluate(()=>{
    const visible=e=>e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden';
    const box=e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    const containers=[...document.querySelectorAll('.app,.workspace,.stage,.sky,.panel,.panel-content,.settings,.paged,.list-space,.form-view,.guide-view,.detail-view,.confirm-view')].filter(visible);
    return {viewport:{width:innerWidth,height:innerHeight},document:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},view:document.querySelector('.app').dataset.view,
      containers:containers.map(e=>({class:e.className,...box(e),scrollWidth:e.scrollWidth,scrollHeight:e.scrollHeight,clientWidth:e.clientWidth,clientHeight:e.clientHeight,overflow:[getComputedStyle(e).overflowX,getComputedStyle(e).overflowY]})),
      controls:[...document.querySelectorAll('button,input')].filter(visible).map(e=>({name:e.getAttribute('aria-label')||e.textContent||e.value,tag:e.tagName,...box(e),scrollWidth:e.scrollWidth,scrollHeight:e.scrollHeight,clientWidth:e.clientWidth,clientHeight:e.clientHeight})),
      text:[...document.querySelectorAll('.panel-content h2,.panel-content p,.panel-content label,.position,footer span')].filter(visible).map(e=>({name:e.textContent,...box(e)})),
      logo:[...document.querySelectorAll('.prism,.notes')].map(e=>({font:parseFloat(getComputedStyle(e).fontSize),...box(e)})),
      listCount:document.querySelector('.list-space')?.children.length??null,version:document.querySelector('footer').textContent};
  });
  const context=`${engine} ${label}`;
  assert(data.document.width<=data.viewport.width,`${context}: page horizontal scroll`);
  assert(data.document.height<=data.viewport.height,`${context}: page vertical scroll`);
  for(const item of [...data.containers,...data.controls,...data.text,...data.logo]) {
    assert(item.left>=-.5&&item.top>=-.5&&item.right<=data.viewport.width+.5&&item.bottom<=data.viewport.height+.5,`${context}: outside viewport ${item.name||item.class}`);
  }
  for(const item of data.containers){
    assert(item.scrollWidth<=item.clientWidth+1,`${context}: inner horizontal scroll ${item.class}`);
    assert(item.scrollHeight<=item.clientHeight+1,`${context}: inner vertical scroll ${item.class}: ${item.scrollHeight}/${item.clientHeight}`);
    assert(!item.overflow.some(v=>v==='hidden'||v==='clip'),`${context}: content hidden to fit ${item.class}`);
  }
  for(const item of data.controls.filter(item=>item.tag==='BUTTON'))assert(item.scrollWidth<=item.clientWidth+1&&item.scrollHeight<=item.clientHeight+1,`${context}: button text overflow ${item.name}`);
  if(['records','saves'].includes(data.view))assert(data.listCount>0,`${context}: no visible list items`);
  assert(Math.abs(data.logo[0].font/data.logo[1].font-96/36)<.005,`${context}: logo proportions`);
  assert(data.version.includes(`v${version}`));
  report.results.push({engine,label,...data});
}
async function checkPages(page,kind,total){
  const seen=new Set();let turns=0;
  while(true){
    for(const index of await page.locator('.list-row').evaluateAll(items=>items.map(e=>Number(e.dataset.index))))seen.add(index);
    const next=page.locator('[data-action=next]');if(await next.isDisabled())break;
    assert(++turns<=total,'Pagination did not terminate');await next.click();await settle(page);
  }
  assert.equal(seen.size,total,`All ${kind} remain reachable`);
  return turns+1;
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${server.address().port}/%E7%94%BB%E9%9D%A2%E6%A1%88/%E6%93%8D%E4%BD%9C%E7%94%BB%E9%9D%A2/index.html`;
  try {
    for(const engine of ['chromium','webkit']){
      const browser=await pw[engine].launch({headless:true});
      try {
        const context=await browser.newContext({viewport:{width:390,height:664},deviceScaleFactor:1});
        await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
        const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
        for(const [width,height]of sizes){
          await page.setViewportSize({width,height});
          for(const view of views){
            await page.goto(`${url}?view=${view}`);await settle(page);await measure(page,engine,`${width}x${height}/${view}`);
            if(engine==='chromium'&&((width===390&&height===664&&['play','settings','records','saves','input','score-error'].includes(view))||(width===480&&height===240&&['play','settings'].includes(view)))){
              await page.screenshot({path:path.join(out,`screen-${width}x${height}-${view}-v${version}.png`)});
            }
          }
        }
        await page.setViewportSize({width:320,height:480});
        await page.goto(`${url}?view=records`);await settle(page);
        const recordPages=await checkPages(page,'records',40);
        const position=await page.locator('.position').textContent();
        await page.locator('[data-tab=settings]').click();await page.locator('[data-tab=records]').click();
        assert.equal(await page.locator('.position').textContent(),position,'Record page preserved on tab switch');
        await page.goto(`${url}?view=saves&long=1`);await settle(page);await measure(page,engine,'320x480/long-names');
        const savePages=await checkPages(page,'saved fixtures',10);
        await page.setViewportSize({width:480,height:240});
        await page.goto(`${url}?view=saves&long=1`);await settle(page);await measure(page,engine,'480x240/long-names');
        await checkPages(page,'saved fixtures in short landscape',10);
        await page.goto(`${url}?view=record-detail`);await settle(page);await measure(page,engine,'480x240/detail-pagination');
        await checkPages(page,'record detail fields',6);
        for(const view of ['records','saves']) {await page.goto(`${url}?view=${view}&empty=1`);await settle(page);await measure(page,engine,`480x240/${view}-empty`);assert(await page.locator('[data-action=next]').isDisabled());}
        await page.setViewportSize({width:320,height:480});
        await page.goto(`${url}?view=input`);await settle(page);
        await page.locator('#time-value').focus();
        assert.deepEqual(await page.locator('#time-value').evaluate(e=>[e.selectionStart,e.selectionEnd]),[0,3],'Select all existing time');
        await page.locator('#time-value').fill('-1');await page.locator('[data-action=confirm-input]').click();
        assert.equal(await page.locator('#time-value').inputValue(),'-1','Invalid draft preserved');
        assert((await page.locator('#input-error').textContent()).length>1);
        await measure(page,engine,'320x480/input-error');
        await page.setViewportSize({width:568,height:260});await settle(page);
        assert.equal(await page.locator('#time-value').inputValue(),'-1','Draft preserved on rotation');
        await measure(page,engine,'568x260/input-error-rotation');
        await page.setViewportSize({width:320,height:320});await settle(page);await measure(page,engine,'320x320/input-keyboard-space');
        await page.locator('[data-action=cancel-input]').click();
        await page.setViewportSize({width:390,height:664});
        await page.locator('[data-action=close-panel]').click();
        await page.locator('[data-node=A]').click();
        assert.equal(await page.locator('.app').getAttribute('data-view'),'play','Single tap preserves play area');
        const playBounds=await page.locator('.sky').boundingBox();
        await page.locator('[data-node=A]').dblclick();
        assert.equal(await page.locator('.app').getAttribute('data-view'),'settings','Double tap opens popup fixture');
        assert.deepEqual(await page.locator('.sky').boundingBox(),playBounds,'Settings popup does not resize play area');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.app').getAttribute('data-view'),'play','Escape closes popup fixture');
        await page.locator('[data-tab=settings]').click();
        await page.locator('[data-action=close-panel]').click();
        await page.locator('[data-action=run]').click();await page.locator('[data-tab=records]').click();
        assert.equal(await page.locator('#run-state').textContent(),'一時停止中');
        await page.locator('[data-tab=settings]').click();assert.equal(await page.locator('#run-state').textContent(),'一時停止中');
        assert(await page.locator('[data-action=input]').isDisabled(),'Edit only after stop');
        await page.locator('[data-action=close-panel]').click();
        await page.locator('[data-action=run]').click();await page.locator('[data-action=guide]').click();
        await page.locator('[data-action=end-guide]').click();assert.equal(await page.locator('#run-state').textContent(),'一時停止中','No auto resume after guide');
        await page.goto(`${url}?view=save-error`);await page.locator('#save-name').focus();
        assert.deepEqual(await page.locator('#save-name').evaluate(e=>[e.selectionStart,e.selectionEnd]),[0,5],'Select all name input');
        assert.deepEqual(errors,[]);
        report.flows.push({engine,status:'passed',recordPages,savePages,checked:'Pagination, tab position, select-all, invalid input, rotation, keyboard-space fixture, explicit resume, guide return fixture'});
        await context.close();console.log(`PASS ${engine}: ${sizes.length*views.length} layouts and fixture flows`);
      } finally {await browser.close();}
    }
    report.status='passed';
  } catch(error){report.status='failed';report.failure=error.message;throw error;}
  finally {fs.writeFileSync(path.join(out,`screen-layout-report-v${version}.json`),JSON.stringify(report,null,2)+'\n');await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
