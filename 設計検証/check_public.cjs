// Verify real HTTPS assets and actual public-page startup. Device acceptance remains separate.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {waitForAsync}=require('./browser_wait.cjs');
const arg=name=>{const at=process.argv.indexOf(name);return at<0?null:process.argv[at+1];};
if(!arg('--url')||!arg('--playwright-path'))throw new Error('Pass --url and --playwright-path');
const base=new URL(arg('--url'));assert.equal(base.protocol,'https:');
process.env.PLAYWRIGHT_BROWSERS_PATH=arg('--browser-cache')||'C:/Users/user/AppData/Local/ms-playwright';
const pw=require(path.resolve(arg('--playwright-path'))),root=path.resolve(__dirname,'..'),out=path.join(__dirname,'公開');fs.mkdirSync(out,{recursive:true});
const expected=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
const report={version:expected,url:base.href,checkedAt:new Date().toISOString(),evidence:'Actual HTTPS deployment. PC Chromium/WebKit online; Chromium offline. Not physical devices. WebKit offline covered separately with stopped local origin.',checks:[]};
async function get(asset){const response=await fetch(new URL(asset,base),{cache:'no-store',signal:AbortSignal.timeout(15000)});assert(response.ok,`${asset}: HTTP ${response.status}`);return response;}
async function settle(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function item(page,name){
  await page.locator('#menu').click();await settle(page);
  for(let i=0;i<30;i++){const target=page.getByRole('button',{name,exact:true});if(await target.count()){await target.click();return;}const next=page.locator('#dialog-body .pager button').last();if(await next.isDisabled())break;await next.click();await settle(page);}throw new Error(`Missing ${name}`);
}
async function drag(page,from,to){
  const start=page.locator(`[data-node="${from}"] .node-hit`),end=page.locator(`[data-node="${to}"] .node-hit`);
  await start.waitFor({state:'visible'});await end.waitFor({state:'visible'});
  const a=await start.boundingBox(),b=await end.boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:10});await page.mouse.up();
}
async function prepared(page){await waitForAsync(page,async()=>{
  const r=await navigator.serviceWorker.getRegistration();if(r?.active?.state!=='activated'||!navigator.serviceWorker.controller)return false;
  const v=document.querySelector('meta[name=prism-version]').content,c=await caches.open(`prism-notes:${new URL(document.baseURI).pathname}:${v}`),response=await c.match(new URL('build-info.json',document.baseURI));
  if(!response)return false;const m=await response.json();return m.version===v&&(await Promise.all(m.assets.map(asset=>c.match(new URL(asset,document.baseURI))))).every(Boolean);
},{},{timeout:30000});}
async function contents(download){const stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
(async()=>{
  try{
    const info=await(await get(`build-info.json?verify=${Date.now()}`)).json();assert.equal(info.version,expected);assert.match(info.commit,/^[0-9a-f]{40}$/);if(arg('--commit'))assert.equal(info.commit,arg('--commit'));report.commit=info.commit;
    for(const asset of info.assets){
      if(asset==='./build-info.json')continue;
      const response=await get(asset),content=Buffer.from(await response.arrayBuffer()),hash=crypto.createHash('sha256').update(content).digest('hex');assert.equal(hash,info.hashes[asset],`Hash ${asset}`);
      const type=response.headers.get('content-type')||'';
      if(asset.endsWith('.js'))assert(/(?:text|application)\/javascript/.test(type),`JS MIME ${asset}: ${type}`);
      if(asset.endsWith('.css'))assert(type.includes('text/css'));
      if(asset.endsWith('.png'))assert(type.includes('image/png'));
      report.checks.push({asset,type,sha256:hash,passed:true});
    }
    const worker=await get('sw.js');assert(/(?:text|application)\/javascript/.test(worker.headers.get('content-type')));assert((await worker.text()).includes(`VERSION='${expected}'`));report.checks.push({label:'HTTPS worker MIME and release version',passed:true});
    for(const engine of ['chromium','webkit']){
      const browser=await pw[engine].launch({headless:true});
      try{
        const context=await browser.newContext({viewport:{width:390,height:664},acceptDownloads:true});let page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.goto(base.href);await prepared(page);assert.equal(await page.locator('meta[name=prism-version]').getAttribute('content'),expected);await page.locator('#guide-skip').click();
        for(const [width,height] of [[320,480],[390,664],[844,310]]){
          await page.setViewportSize({width,height});await settle(page);const size=await page.evaluate(()=>{const center=e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};};return {w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,rotation:Number(document.documentElement.dataset.boardRotation),source:center(document.querySelector('[data-node="S"] .node-hit')),goal:center(document.querySelector('[data-node="G"] .node-hit')),header:center(document.querySelector('header')),board:center(document.getElementById('board')),play:center(document.getElementById('play-controls'))};});assert(size.sw<=size.w+1&&size.sh<=size.h+1);if(width<=height){assert.equal(size.rotation,0);assert(size.source.y>size.goal.y&&size.header.y<size.board.y&&size.play.y>size.board.y,'Published portrait source below goal and frame order');}else{assert.equal(size.rotation,-90);assert(size.source.x>size.goal.x&&size.header.x<size.board.x&&size.play.x>size.board.x,'Published landscape retains the device frame');}report.checks.push({label:`${engine} public layout ${width}x${height}`,passed:true,...size});
        }
        await page.setViewportSize({width:390,height:664});
        if(engine==='chromium'){
          // Remove ordinary HTTP cache, while retaining the worker's CacheStorage.
          const protocol=await context.newCDPSession(page);await protocol.send('Network.clearBrowserCache');await protocol.detach();
          report.cacheAfterHTTPClear=await page.evaluate(async()=>({keys:await caches.keys(),registrations:(await navigator.serviceWorker.getRegistrations()).map(r=>({scope:r.scope,active:r.active?.state,script:r.active?.scriptURL})),controller:navigator.serviceWorker.controller?.scriptURL}));
          // Re-observe readiness after the cache operation; never silently repair or re-register.
          await prepared(page);
          await page.evaluate(async()=>{
            const r=await navigator.serviceWorker.getRegistration();
            await new Promise((resolve,reject)=>{const channel=new MessageChannel(),timer=setTimeout(()=>reject(new Error('Prepared worker did not respond')),5000);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();event.data.ready?resolve():reject(new Error('Prepared assets missing'));};r.active.postMessage({type:'STATUS',version:document.querySelector('meta[name=prism-version]').content},[channel.port2]);});
          });
          await context.setOffline(true);await page.close();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
          const response=await page.goto(base.href);await prepared(page);
          assert(response.fromServiceWorker(),'Offline navigation must actually be served by the prepared worker');
          report.checks.push({label:'Public Chromium closed-page offline startup after clearing HTTP cache',url:response.url(),status:response.status(),fromServiceWorker:response.fromServiceWorker(),passed:true});
        }
        await drag(page,'S','A');await drag(page,'A','G');await page.locator('#play').click();await page.waitForFunction(()=>document.getElementById('result').textContent.includes('100.00点'),{},{timeout:7000});await page.locator('#stop').click();
        const resultDownload=page.waitForEvent('download');await item(page,'実行結果を書き出す');const result=await contents(await resultDownload);assert.equal(result.conditions.edges.length,2);assert(result.records.some(r=>r.type==='goal'));await page.locator('#dialog-close').click();
        await page.locator('#home').click();await page.getByRole('button',{name:'自由へ',exact:true}).click();await page.locator('#guide-skip').click();
        await item(page,'回路を保存');await page.getByRole('textbox',{name:'回路名'}).fill('公開確認の合成回路');await page.getByRole('button',{name:'保存',exact:true}).click();
        const circuitDownload=page.waitForEvent('download');await item(page,'回路ファイルを書き出す');const circuit=await contents(await circuitDownload);assert.equal(circuit.name,'公開確認の合成回路');assert.equal(circuit.circuit.nodes.length,4);assert.equal(circuit.records,undefined);
        await page.locator('#dialog-close').click();await page.screenshot({path:path.join(out,`${engine}-portrait.png`)});
        assert.deepEqual(errors,[]);report.checks.push({label:`${engine} public drag/run/score, result/circuit download and local manual save${engine==='chromium'?' while offline':''}`,passed:true});await context.close();
      }finally{await browser.close();}
    }
    report.passed=true;console.log(`Public checks passed: ${report.checks.length}`);
  }catch(error){report.passed=false;report.failure=error.stack;throw error;}
  finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
})().catch(error=>{console.error(error);process.exitCode=1;});
