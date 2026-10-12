// Actual workers/cache/offline/update interactions on PC engines, under a Pages subpath.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {waitForAsync}=require('./browser_wait.cjs');
const {expectedStoppedOriginWorkerError}=require('./browser_errors.cjs');
const arg=name=>{const at=process.argv.indexOf(name);return at<0?null:process.argv[at+1];};
if(!arg('--playwright-path'))throw new Error('Pass --playwright-path');
process.env.PLAYWRIGHT_BROWSERS_PATH=arg('--browser-cache')||'C:/Users/user/AppData/Local/ms-playwright';
const channel=arg('--channel');if(channel&&!['chrome','msedge'].includes(channel))throw new Error('Use --channel chrome or msedge');
const pw=require(path.resolve(arg('--playwright-path'))),root=path.resolve(__dirname,'..'),out=path.join(__dirname,'PWA',channel||'');fs.mkdirSync(out,{recursive:true});
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
const report={version,evidence:'PC engines, not physical devices/production. Chromium: setOffline. WebKit: stopped origin (setOffline worker bug https://github.com/microsoft/playwright/issues/42775). Later releases synthetic. Exact stopped-origin worker diagnostics retained separately; browser window errors/rejections must remain empty.',checks:[],errors:[],windowErrors:[]};
if(channel)report.evidence=`Installed Windows ${channel}: disposable browser context, actual worker/cache and offline operations under /prism/. Later releases/errors are synthetic. No OS installation/shutdown or phone evidence.`;
report.browsers=[];
const parts=version.split('.').map(Number),later=offset=>[parts[0],parts[1],parts[2]+offset].join('.');
const fixtures=[version,later(1),later(2)].map((v,index)=>{
  const output=path.join(out,`fixture-${index}`);
  const result=cp.spawnSync(process.execPath,['scripts/build.js','--fixture-version',v,'--output',output],{cwd:root,encoding:'utf8'});
  if(result.status!==0)throw new Error(result.stderr||result.stdout);return {version:v,output};
});
const broken=JSON.parse(fs.readFileSync(path.join(fixtures[2].output,'build-info.json'),'utf8')).assets.find(asset=>asset.endsWith('board.js'));
fs.unlinkSync(path.join(fixtures[2].output,broken));
let current=0,originOffline=false;
let port;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.ttf':'font/ttf','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((request,response)=>{
  const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
  if(!pathname.startsWith('/prism/')){response.writeHead(404).end();return;}
  const base=fixtures[current].output,file=path.resolve(base,pathname.slice('/prism/'.length)||'index.html');
  if(file!==base&&!file.startsWith(base+path.sep)){response.writeHead(403).end();return;}
  let content;try{content=fs.readFileSync(file);}catch{response.writeHead(404).end();return;}
  response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});response.end(content);
});
async function menuItem(page,name){
  await page.locator('#menu').click();
  await settle(page);
  for(let i=0;i<30;i++){
    const item=page.getByRole('button',{name,exact:true});if(await item.count()){await item.click();return;}
    const next=page.locator('#dialog-body .pager button').last();if(await next.isDisabled())break;await next.click();await settle(page);
  }
  throw new Error(`Menu item missing: ${name}`);
}
async function status(page,type='STATUS',version=null){return page.evaluate(async({type,version})=>{
  const registration=await navigator.serviceWorker.getRegistration(),worker=registration.waiting??registration.active;
  if(!worker)throw new Error(`No worker: ${JSON.stringify({scope:registration.scope,installing:registration.installing?.state,active:registration.active?.state,url:location.href})}`);
  return new Promise((resolve,reject)=>{const channel=new MessageChannel(),timer=setTimeout(()=>reject(new Error('worker timeout')),5000);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};worker.postMessage({type,version},[channel.port2]);});
},{type,version});}
async function prepared(page){await waitForAsync(page,async()=>{
  const r=await navigator.serviceWorker.getRegistration();if(r?.active?.state!=='activated'||!navigator.serviceWorker.controller)return false;
  const version=document.querySelector('meta[name=prism-version]').content;
  const cache=await caches.open(`prism-notes:/prism/:${version}`),response=await cache.match(new URL('build-info.json',document.baseURI));
  if(!response)return false;const manifest=await response.json();return manifest.version===version&&(await Promise.all(manifest.assets.map(asset=>cache.match(new URL(asset,document.baseURI))))).every(Boolean);
},{},{timeout:15000});}
async function settle(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function fit(page,label){
  const size=await page.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,controls:[...document.querySelectorAll('dialog[open] button')].filter(b=>b.getClientRects().length).map(b=>({text:b.textContent,rect:b.getBoundingClientRect().toJSON()}))}));
  assert(size.sw<=size.w+1&&size.sh<=size.h+1,`${label}: document scroll`);
  assert(size.controls.every(b=>b.rect.left>=-1&&b.rect.right<=size.w+1&&b.rect.top>=-1&&b.rect.bottom<=size.h+1),`${label}: inaccessible controls`);
  report.checks.push({label,passed:true});
}
async function enlargedDialog(page,label){
  const viewport=page.viewportSize(),original=await page.evaluate(()=>document.documentElement.getAttribute('style'));
  try{
    await page.evaluate(()=>document.documentElement.style.setProperty('font-size','28px','important'));
    for(const [width,height] of [[390,664],[480,240],[844,310]]){
      await page.setViewportSize({width,height});
      const settlingFrames=await page.evaluate(async()=>{
        await document.fonts.ready;let previous=null,stable=0;
        for(let frame=1;frame<=60;frame++){
          await new Promise(resolve=>requestAnimationFrame(resolve));
          const signature=JSON.stringify([...document.querySelectorAll('dialog[open],dialog[open] *')].map(e=>{const r=e.getBoundingClientRect();return [e.className,e.hidden,e.textContent,r.x,r.y,r.width,r.height,e.scrollHeight,e.clientHeight];}));
          stable=signature===previous?stable+1:0;previous=signature;if(stable>=3)return frame;
        }
        throw new Error('Dialog layout did not settle; do not treat moving geometry as passed');
      });
      const issues=await page.evaluate(()=>[...document.querySelectorAll('dialog[open],dialog[open] form,dialog[open] #dialog-body,dialog[open] #dialog-error,dialog[open] p,dialog[open] button,dialog[open] input')].filter(e=>e.getClientRects().length).flatMap(e=>{
        const r=e.getBoundingClientRect(),name=e.id||e.textContent.slice(0,30),style=getComputedStyle(e);
        const inside=r.left>=-.5&&r.right<=innerWidth+.5&&r.top>=-.5&&r.bottom<=innerHeight+.5;
        const fits=e.scrollHeight<=e.clientHeight+1&&(e.matches('input')||e.scrollWidth<=e.clientWidth+1||style.textOverflow==='ellipsis');
        return inside&&fits?[]:[{name,inside,fits,client:[e.clientWidth,e.clientHeight],scroll:[e.scrollWidth,e.scrollHeight],rect:r.toJSON(),children:[...e.children].map(child=>({tag:child.tagName,text:child.textContent,hidden:child.hidden,rect:child.getBoundingClientRect().toJSON()})),className:e.className}];
      }));
      report.checks.push({label:`${label} CSS root 28px ${width}x${height}`,passed:!issues.length,issues,settlingFrames,method:'CSS simulation, not native OS or browser preferences; three unchanged layout frames before measurement, persistent overflow still fails'});
      assert.deepEqual(issues,[],`${label}: enlarged dialog does not fit`);
    }
  }finally{
    await page.evaluate(style=>{if(style===null)document.documentElement.removeAttribute('style');else document.documentElement.setAttribute('style',style);},original);await page.setViewportSize(viewport);await settle(page);
  }
}
async function drag(page,from,to){
  const box=async id=>page.locator(`[data-node="${id}"] .node-hit`).boundingBox();const a=await box(from),b=await box(to);
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:10});await page.mouse.up();
}
async function connection(context,engine,offline){
  originOffline=offline;
  if(engine==='chromium'){await context.setOffline(offline);return;}
  if(offline){if(server.listening)await new Promise(resolve=>server.close(resolve));}
  else if(!server.listening)await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));port=server.address().port;const url=`http://127.0.0.1:${port}/prism/`;
  try{
    for(const engine of channel?['chromium']:['chromium','webkit']){
      current=0;const browser=await pw[engine].launch({headless:true,...(channel?{channel}:{})});report.browsers.push({engine,channel:channel||null,version:browser.version()});
      try{
        const context=await browser.newContext({viewport:{width:390,height:664}}),errors=[],windowErrors=[];
        await context.exposeBinding('__reportWindowError',(source,detail)=>{const value={engine,url:source.page.url(),originOffline,...detail};windowErrors.push(value);report.windowErrors.push(value);});
        await context.addInitScript(()=>{addEventListener('error',event=>{void window.__reportWindowError({type:'error',message:event.message,filename:event.filename}).catch(()=>{});});addEventListener('unhandledrejection',event=>{void window.__reportWindowError({type:'unhandledrejection',message:String(event.reason)}).catch(()=>{});});});
        const page=await context.newPage();
        const observeErrors=target=>target.on('pageerror',e=>{const detail={engine,message:e.message,name:e.name,stack:e.stack,url:target.url(),originOffline};detail.expectedStoppedOrigin=expectedStoppedOriginWorkerError(detail);errors.push(detail);report.errors.push(detail);});observeErrors(page);
        await page.goto(url);await prepared(page);await page.locator('#guide-skip').click();assert.equal((await status(page)).ready,true);
        const manifest=await page.evaluate(async()=>{const r=await fetch('manifest.webmanifest');return r.json();});assert.deepEqual(manifest.icons.map(i=>i.sizes),['192x192','512x512']);
        for(const [width,height] of [[320,480],[480,240],[844,310],[390,664]]){
          await page.setViewportSize({width,height});await menuItem(page,'オフラインと更新');await fit(page,`${engine} offline dialog ${width}x${height}`);await page.locator('#dialog-close').click();
        }
        await connection(context,engine,true);
        const negative=await browser.newContext();if(engine==='chromium')await negative.setOffline(true);const negativePage=await negative.newPage();let rejected=false;
        try{await negativePage.goto(url,{timeout:3000});}catch{rejected=true;}assert(rejected,'A fresh context without prepared assets must not reach the origin');await negative.close();
        await page.close();const offline=await context.newPage();observeErrors(offline);await offline.goto(url);await prepared(offline);
        assert.equal(await offline.locator('#guide-bar').isVisible(),false);
        await offline.locator('#home').click();await settle(offline);let names=[];
        do{names.push(...await offline.locator('#dialog-body .dialog-list button:not(.pager button)').allTextContents());const next=offline.locator('#dialog-body .pager button').last();if(await next.isDisabled())break;await next.click();await settle(offline);}while(names.length<30);
        for(let q=1;q<=6;q++)assert(names.some(name=>name.startsWith(`Q${q} `)));await offline.locator('#dialog-close').click();
        await drag(offline,'S','A');await drag(offline,'A','G');await offline.locator('#play').click();await offline.waitForFunction(()=>document.getElementById('result').textContent.includes('100.00点'),{},{timeout:7000});await offline.locator('#stop').click();
        const scoreBefore=await offline.evaluate(()=>localStorage.getItem('prism-notes.scores.v1'));assert(scoreBefore);
        await offline.locator('#home').click();await offline.getByRole('button',{name:'自由へ',exact:true}).click();await offline.locator('#guide-skip').click();
        await offline.locator('[data-node="A"] .node-hit').dblclick();await offline.getByRole('button',{name:'時間',exact:true}).click();await offline.getByRole('textbox',{name:'秒数'}).fill('1.5');await offline.getByRole('button',{name:'確定',exact:true}).click();
        await menuItem(offline,'回路を保存');await offline.getByRole('textbox',{name:'回路名'}).fill('通信なし保存');await offline.getByRole('button',{name:'保存',exact:true}).click();
        const slotBefore=await offline.evaluate(()=>localStorage.getItem('prism-notes.circuits.v1'));assert(slotBefore);
        await offline.locator('#play').click();await offline.waitForFunction(()=>document.getElementById('result').textContent.includes('到着'),{},{timeout:7000});await offline.locator('#stop').click();
        report.checks.push({label:`${engine} subpath icons, closed-page offline startup, all six choices, drag/score/free edit/save/run`,passed:true});
        await connection(context,engine,false);
        // Keep a second old-version tab alive through an explicit update in the first.
        const other=await context.newPage();await other.goto(url);await prepared(other);await other.locator('#home').click();await other.getByRole('button',{name:'自由へ',exact:true}).click();
        await other.locator('[data-node="A"] .node-hit').dblclick();await other.getByRole('button',{name:'時間',exact:true}).click();await other.getByRole('textbox',{name:'秒数'}).fill('2.7');
        await offline.locator('[data-node="A"] .node-hit').dblclick();await offline.getByRole('button',{name:'時間',exact:true}).click();await offline.getByRole('textbox',{name:'秒数'}).fill('1.7');await offline.getByRole('button',{name:'確定',exact:true}).click();
        // Finish a synthetic preparation failure while its explanation is open.
        // The return must read current worker state, not the captured checking view.
        await menuItem(offline,'オフラインと更新');await offline.setViewportSize({width:480,height:240});await offline.evaluate(()=>document.documentElement.style.setProperty('font-size','28px','important'));await settle(offline);
        await offline.evaluate(()=>{
          const post=ServiceWorker.prototype.postMessage;window.__originalPreparationPost=post;let hold=true,fail=false;
          ServiceWorker.prototype.postMessage=function(data,ports){
            if(hold&&data.type==='STATUS'){hold=false;window.__releasePreparation=()=>{fail=true;ports[0].postMessage({ready:true,currentReady:true,currentVersion:document.querySelector('meta[name=prism-version]').content});};return;}
            if(fail&&data.type==='PREPARE_ASSETS'){fail=false;window.__preparationFailed=true;throw new Error('Synthetic preparation failure');}
            return post.call(this,data,ports);
          };
        });
        await offline.getByRole('button',{name:'準備・更新を確認',exact:true}).click();await offline.waitForFunction(()=>typeof window.__releasePreparation==='function');await offline.locator('#dialog-info').click();await offline.evaluate(()=>window.__releasePreparation());await offline.waitForFunction(()=>window.__preparationFailed===true);await status(offline);await settle(offline);
        await offline.getByRole('button',{name:'戻る',exact:true}).click();assert((await offline.locator('#dialog-error').textContent()).includes('Synthetic preparation failure'),'Explanation return must expose the completed failure');await enlargedDialog(offline,`${engine} preparation completes while explanation is open`);
        await offline.evaluate(()=>{ServiceWorker.prototype.postMessage=window.__originalPreparationPost;document.documentElement.style.removeProperty('font-size');});await offline.setViewportSize({width:390,height:664});await offline.locator('#dialog-close').click();
        current=1;
        const startup=await context.newPage();observeErrors(startup);await startup.goto(url);await prepared(startup);
        await startup.locator('#update-notice').waitFor({state:'visible',timeout:15000});
        assert.equal(await startup.locator('meta[name=prism-version]').getAttribute('content'),version);
        assert.equal(await startup.evaluate(()=>document.querySelector('dialog').open),false,'Startup update must not interrupt play');
        assert.equal(await startup.evaluate(()=>localStorage.getItem('prism-notes.scores.v1')),scoreBefore);
        assert.equal(await other.getByRole('textbox',{name:'秒数'}).inputValue(),'2.7');
        await startup.locator('#update-notice').click();assert.equal(await startup.locator('#dialog-title').textContent(),'更新の前に');await startup.getByRole('button',{name:'取消',exact:true}).click();
        assert.equal(await startup.locator('meta[name=prism-version]').getAttribute('content'),version);await startup.close();
        report.checks.push({label:`${engine} startup automatically prepares update, unobtrusive notice, user cancels without reload/data change`,passed:true});
        await menuItem(offline,'オフラインと更新');await offline.getByRole('button',{name:'準備・更新を確認',exact:true}).click();await offline.getByRole('button',{name:'更新へ',exact:true}).waitFor({timeout:15000});
        assert.equal(await other.getByRole('textbox',{name:'秒数'}).inputValue(),'2.7');assert.equal(await offline.locator('meta[name=prism-version]').getAttribute('content'),version);await enlargedDialog(offline,`${engine} update prepared status`);
        await offline.getByRole('button',{name:'更新へ',exact:true}).click();await enlargedDialog(offline,`${engine} dirty circuit update protection`);await offline.getByRole('button',{name:'保存せず更新へ',exact:true}).click();await enlargedDialog(offline,`${engine} explicit discard confirmation`);await offline.getByRole('button',{name:'取消',exact:true}).click();await menuItem(offline,'オフラインと更新');await offline.getByRole('button',{name:'更新へ',exact:true}).click();await offline.getByRole('button',{name:'保存して更新へ',exact:true}).click();
        await offline.evaluate(()=>{window.oldSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='prism-notes.circuits.v1')throw new DOMException('Synthetic quota failure','QuotaExceededError');return window.oldSet.call(this,key,value);};});
        await offline.getByRole('textbox',{name:'回路名'}).fill('更新前の回路');await offline.getByRole('button',{name:'保存',exact:true}).click();assert((await offline.locator('#dialog-error').textContent()).length>0);assert.equal(await offline.locator('meta[name=prism-version]').getAttribute('content'),version);
        await enlargedDialog(offline,`${engine} failed pre-update save retains form`);await offline.evaluate(()=>{Storage.prototype.setItem=window.oldSet;});await offline.getByRole('button',{name:'保存',exact:true}).click();await enlargedDialog(offline,`${engine} saved circuit final update confirmation`);
        await offline.evaluate(()=>{
          const post=ServiceWorker.prototype.postMessage;let delay=true;
          ServiceWorker.prototype.postMessage=function(data,ports){if(delay&&data.type==='STATUS'){delay=false;setTimeout(()=>post.call(this,data,ports),600);}else post.call(this,data,ports);};
        });
        await offline.getByRole('button',{name:'更新を適用',exact:true}).click();
        assert.equal(await offline.locator('#dialog-close').isDisabled(),true);assert.equal(await offline.evaluate(()=>document.getElementById('app').inert),true);
        await offline.keyboard.press('Escape');assert.equal(await offline.locator('#dialog').getAttribute('open'),'');
        await offline.waitForFunction(v=>document.querySelector('meta[name=prism-version]').content===v,later(1),{timeout:15000});await prepared(offline);
        assert.equal(await offline.evaluate(()=>localStorage.getItem('prism-notes.scores.v1')),scoreBefore);
        const saved=await offline.evaluate(()=>JSON.parse(localStorage.getItem('prism-notes.circuits.v1')));assert(saved.value.some(item=>item.name==='通信なし保存'));assert(saved.value.some(item=>item.name==='更新前の回路'&&item.circuit.nodes.find(n=>n.id==='A').process==='1.7'));
        assert.equal(await other.locator('meta[name=prism-version]').getAttribute('content'),version);assert.equal(await other.getByRole('textbox',{name:'秒数'}).inputValue(),'2.7');
        await connection(context,engine,true);assert.equal(await other.evaluate(async v=>(await fetch(`v${v}/src/content/samples.js`)).ok,version),true);await connection(context,engine,false);
        report.checks.push({label:`${engine} explicit update retains score/slots, failed save prevents reload, other tab retains typed input/old assets`,passed:true});
        // A missing module with index still present must show the recovery page.
        await offline.evaluate(async()=>{const v=document.querySelector('meta[name=prism-version]').content,c=await caches.open(`prism-notes:/prism/:${v}`);await c.delete(new URL(`v${v}/src/ui/audio.js`,document.baseURI));});assert.equal((await status(offline)).ready,false);
        await connection(context,engine,true);const recovery=await context.newPage();const recovered=await recovery.goto(url);assert.equal(recovered.status(),503);assert((await recovery.locator('body').textContent()).includes('起動に必要な資材が不足'));assert.equal(await recovery.evaluate(()=>localStorage.getItem('prism-notes.scores.v1')),scoreBefore);await recovery.close();await connection(context,engine,false);
        await menuItem(offline,'オフラインと更新');await offline.getByRole('button',{name:'準備・更新を確認',exact:true}).click();await prepared(offline);assert.equal((await status(offline)).ready,true);
        current=2;await offline.getByRole('button',{name:'準備・更新を確認',exact:true}).click();await offline.waitForFunction(()=>document.getElementById('dialog-error').textContent.length>0,{},{timeout:15000});assert.equal(await offline.getByRole('button',{name:'更新へ',exact:true}).count(),0);
        assert.equal(await offline.locator('meta[name=prism-version]').getAttribute('content'),later(1));assert.equal(await offline.evaluate(()=>localStorage.getItem('prism-notes.scores.v1')),scoreBefore);await enlargedDialog(offline,`${engine} incomplete update error and old assets status`);
        await connection(context,engine,true);await offline.reload();assert.equal(await offline.locator('meta[name=prism-version]').getAttribute('content'),later(1));await prepared(offline);await fit(offline,`${engine} failed update old version offline`);
        report.checks.push({label:`${engine} cache-loss readiness/repair and incomplete-update rejection preserve usable old version/data`,passed:true});assert.deepEqual(errors.filter(error=>!error.expectedStoppedOrigin),[]);assert.deepEqual(windowErrors,[]);
        await connection(context,engine,false);await context.close();
      }finally{await browser.close();}
    }
    report.passed=true;
  }catch(error){report.passed=false;report.failure=error.stack;throw error;}
  finally{if(server.listening)await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
  console.log(`PWA checks passed: ${report.checks.length}`);
})().catch(error=>{console.error(error);process.exitCode=1;});
