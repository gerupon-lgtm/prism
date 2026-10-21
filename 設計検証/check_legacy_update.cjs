// Build the actual historical source, not current source with an older label.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {enterApp,waitForAsync,wiringBounds}=require('./browser_wait.cjs');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};
if(!arg('--playwright-path'))throw new Error('Pass --playwright-path');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),root=path.resolve(__dirname,'..');
const targetDist=path.resolve(arg('--target-dist')||path.join(root,'dist'));
const onlyEngine=arg('--engine'),onlyMode=arg('--mode');if(onlyEngine)assert(['chromium','webkit'].includes(onlyEngine));if(onlyMode)assert(['menu','unregister'].includes(onlyMode));
const oldCommit=arg('--from-commit')||'2a17b65b47e169b015b30e53c221786a0af9b027',oldVersion=JSON.parse(cp.execFileSync('git',['show',oldCommit+':package.json'],{cwd:root,encoding:'utf8'})).version;
assert.match(oldVersion,/^\d+\.\d+\.\d+$/);
const out=path.join(__dirname,'旧版更新',arg('--from-commit')?'from-'+oldVersion:'',arg('--channel')||[onlyEngine,onlyMode,arg('--target-dist')?'baseline':null].filter(Boolean).join('-'));fs.mkdirSync(out,{recursive:true});
const source=path.join(__dirname,'PWA','fixture-legacy-source-'+oldVersion);fs.mkdirSync(source,{recursive:true});
const archive=path.join(source,'snapshot.tar');fs.writeFileSync(archive,cp.execFileSync('git',['archive','--format=tar',oldCommit,'src','public','画面案/ロゴ/fonts','index.html','package.json','scripts/build.js'],{cwd:root,maxBuffer:64*1024*1024}));
cp.execFileSync('python',['-c','import sys,tarfile; t=tarfile.open(sys.argv[1]); t.extractall(sys.argv[2],filter="data"); t.close()',archive,source]);cp.execFileSync(process.execPath,['scripts/build.js'],{cwd:source,encoding:'utf8'});
const nextInfo=JSON.parse(fs.readFileSync(path.join(targetDist,'build-info.json'))),next=nextInfo.version,report={fromVersion:oldVersion,fromCommit:oldCommit,toVersion:next,evidence:'Actual historical source and worker, disposable PC browser under /prism/. Phone viewport is synthetic; not Pixel device evidence.',browsers:[],checks:[],requests:[],errors:[]};
let newer=false,blocked=false,transfers=[];
const oldInfo=JSON.parse(fs.readFileSync(path.join(source,'dist','build-info.json')));
const reusableLarge=new Set(nextInfo.assets.filter(asset=>/\.(png|ttf)$/.test(asset)&&nextInfo.hashes?.[asset]&&nextInfo.hashes[asset]===oldInfo.hashes?.[asset.replace('v'+next+'/','v'+oldVersion+'/')]).map(asset=>'/prism/'+asset.slice(2)));
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.ttf':'font/ttf','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost'),base=newer?targetDist:path.join(source,'dist'),name=decodeURIComponent(u.pathname);
 const file=path.resolve(base,name.replace(/^\/prism\//,'')||'index.html');
 if(!name.startsWith('/prism/')||!file.startsWith(base+path.sep)){res.writeHead(404).end();return;}
 if(blocked&&name==='/prism/sw.js'){report.requests.push({path:name,release:next,status:503,synthetic:true});res.writeHead(503).end('Synthetic update-check failure');return;}
 try{const data=fs.readFileSync(file);if(newer)transfers.push({path:decodeURIComponent(u.pathname),bytes:data.length});res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':newer?'no-store':'max-age=600'}).end(data);if(name.endsWith('sw.js')||name.endsWith('build-info.json'))report.requests.push({path:u.pathname,release:newer?next:oldVersion,status:200});}
 catch{report.requests.push({path:u.pathname,release:newer?next:oldVersion,status:404});res.writeHead(404).end();}
});
async function prepared(page){await waitForAsync(page,async()=>{
 const r=await navigator.serviceWorker.getRegistration(new URL('./',document.baseURI).href),v=document.querySelector('meta[name=prism-version]')?.content;
 if(!navigator.serviceWorker.controller||!v)return false;
 if(!r?.active){
  // PC WebKit can omit a newly re-registered worker from getRegistration after
  // unregister, even in the unchanged 0.81.0 baseline. Require the controlling
  // worker itself to prove the exact version and complete assets in that case.
  const status=await new Promise(resolve=>{const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(null);},3000);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};navigator.serviceWorker.controller.postMessage({type:'STATUS',version:v},[channel.port2]);});
  if(status?.currentVersion!==v||!status.currentReady||!status.ready)return false;
 }
 const c=await caches.open('prism-notes:/prism/:'+v),m=await c.match(new URL('build-info.json',document.baseURI));if(!m)return false;
 return (await Promise.all((await m.json()).assets.map(p=>c.match(new URL(p,document.baseURI))))).every(Boolean);
},{},{timeout:20000}).catch(async error=>{
 report.preparationFailure=await page.evaluate(async()=>{
  const r=await navigator.serviceWorker.getRegistration(),v=document.querySelector('meta[name=prism-version]')?.content,c=v?await caches.open('prism-notes:/prism/:'+v):null;
  const response=c?await c.match(new URL('build-info.json',document.baseURI)):null,m=response?await response.json():null;
  const explicit=await navigator.serviceWorker.getRegistration(new URL('./',document.baseURI).href),registrations=await navigator.serviceWorker.getRegistrations();
  const controllerReply=await new Promise(resolve=>{const ch=new MessageChannel(),timer=setTimeout(()=>{ch.port1.close();resolve(null);},3000);ch.port1.onmessage=e=>{clearTimeout(timer);ch.port1.close();resolve(e.data);};if(navigator.serviceWorker.controller)navigator.serviceWorker.controller.postMessage({type:'STATUS'},[ch.port2]);else{clearTimeout(timer);ch.port1.close();ch.port2.close();resolve(null);}});
  return {version:v,controller:navigator.serviceWorker.controller?.state,controllerReply,active:r?.active?.state,explicit:explicit?{scope:explicit.scope,active:explicit.active?.state}:null,registrations:registrations.map(r=>({scope:r.scope,active:r.active?.state,waiting:r.waiting?.state,installing:r.installing?.state})),waiting:r?.waiting?.state,installing:r?.installing?.state,caches:await caches.keys(),missing:m?await Promise.all(m.assets.map(async a=>await c.match(new URL(a,document.baseURI))?null:a)).then(a=>a.filter(Boolean)):['manifest'],titleUpdate:document.getElementById('title-update')?.textContent,error:document.getElementById('dialog-error')?.textContent};
 });throw error;
}).then(async()=>{const proof=await page.evaluate(async()=>({version:document.querySelector('meta[name=prism-version]')?.content,registered:Boolean((await navigator.serviceWorker.getRegistration(new URL('./',document.baseURI).href))?.active),controller:navigator.serviceWorker.controller?.state}));(report.registrationChecks??=[]).push(proof);});}
async function menu(page,name){await enterApp(page);await page.locator('#menu').click();await page.getByRole('button',{name,exact:true}).click();}
async function drag(page,from,to){const {a,b}=await wiringBounds(page,from,to);await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:10});await page.mouse.up();}
async function snapshot(page){return page.evaluate(async()=>{
 const r=await navigator.serviceWorker.getRegistration(new URL('./',document.baseURI).href);return {version:document.querySelector('meta[name=prism-version]')?.content,active:r?.active?.scriptURL,waiting:r?.waiting?.state,installing:r?.installing?.state,body:document.getElementById('dialog-body')?.textContent,error:document.getElementById('dialog-error')?.textContent,actions:document.getElementById('dialog-actions')?.textContent,slots:localStorage.getItem('prism-notes.circuits.v1'),scores:localStorage.getItem('prism-notes.scores.v1')};
});}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/prism/`;
 try{for(const engine of arg('--channel')?['chromium']:onlyEngine?[onlyEngine]:['chromium','webkit']){
  const browser=await pw[engine].launch({headless:true,...(arg('--channel')?{channel:arg('--channel')}:{})});report.browsers.push({engine,channel:arg('--channel'),version:browser.version()});try{for(const mode of onlyMode?[onlyMode]:['menu','unregister']){
   newer=false;blocked=false;transfers=[];
   const context=await browser.newContext({viewport:{width:393,height:740},hasTouch:true,isMobile:true});let page=await context.newPage();page.on('pageerror',e=>report.errors.push({engine,message:e.message}));
   await page.goto(url);await prepared(page);assert.equal((await snapshot(page)).version,oldVersion);
   await enterApp(page);await drag(page,'S','A');await drag(page,'A','G');await page.locator('#play').click();await page.waitForFunction(()=>document.getElementById('result').textContent.includes('100.00点'),{},{timeout:10000});await page.locator('#stop').click();
   await page.locator('#home').click();await page.getByRole('button',{name:'自由へ',exact:true}).click();
   await menu(page,'回路を保存');await page.getByRole('textbox',{name:'回路名'}).fill('旧版からの移行確認');await page.getByRole('button',{name:'保存',exact:true}).click();
   const before=await snapshot(page);assert(before.slots);assert(before.scores);
   if(mode==='unregister')blocked=true;
   newer=true;await menu(page,'オフラインと更新');await page.getByRole('button',{name:'準備・更新を確認',exact:true}).click();
   if(mode==='unregister'){
    await page.waitForFunction(()=>document.getElementById('dialog-error').textContent.length>0,{},{timeout:20000});
    assert.equal(await page.getByRole('button',{name:'更新へ',exact:true}).count(),0);
    report.checks.push({label:engine+' synthetic old update failure retains old circuit and score',passed:true,state:await snapshot(page)});blocked=false;
    const cacheBefore=await page.evaluate(()=>caches.keys());
    // The bundled Chromium headless shell cannot open Chrome internal pages.
    // Installed Chrome exercises the actual UI; other engines use the same API.
    if(arg('--channel')==='chrome'){
     const manager=await context.newPage();await manager.goto('chrome://serviceworker-internals/');
     await manager.getByText('Unregister',{exact:true}).waitFor();
     assert((await manager.locator('body').innerText()).includes('Scope: '+url));
     assert.equal(await manager.getByText('Unregister',{exact:true}).count(),1,'Disposable context has exactly the target registration');
     await manager.getByText('Unregister',{exact:true}).click();
    }else assert(await page.evaluate(async()=>await(await navigator.serviceWorker.getRegistration()).unregister()));
    await waitForAsync(page,async()=>!await navigator.serviceWorker.getRegistration());
    assert.deepEqual(await page.evaluate(()=>caches.keys()),cacheBefore);assert.equal((await snapshot(page)).slots,before.slots);assert.equal((await snapshot(page)).scores,before.scores);
    await page.close();page=await context.newPage();page.on('pageerror',e=>report.errors.push({engine,message:e.message}));await page.goto(url+'?recover='+next);await prepared(page);assert.equal((await snapshot(page)).version,next);
    assert.equal((await snapshot(page)).slots,before.slots);assert.equal((await snapshot(page)).scores,before.scores);
    report.checks.push({label:engine+' registration-only recovery bypasses old menu without reinstalling or deleting caches/circuits/scores',passed:true,method:arg('--channel')==='chrome'?'Actual chrome://serviceworker-internals Unregister link':'Web API unregister, not Chrome internal UI'});
    await page.screenshot({path:path.join(out,engine+'-recovered-title.png')});await context.close();continue;
   }
   try{await page.getByRole('button',{name:'更新へ',exact:true}).waitFor({timeout:20000});}
   catch(error){report.failureState=await snapshot(page);await page.screenshot({path:path.join(out,engine+'-failure.png')});throw error;}
   await page.screenshot({path:path.join(out,engine+'-old-update-ready.png')});report.checks.push({label:engine+' actual '+oldVersion+' menu prepares '+next,passed:true,state:await snapshot(page)});
   await page.getByRole('button',{name:'更新へ',exact:true}).click();await page.getByRole('button',{name:'更新を適用',exact:true}).click();
   await page.waitForFunction(v=>document.querySelector('meta[name=prism-version]')?.content===v,next,{timeout:20000});await prepared(page);
   const after=await snapshot(page);assert.equal(after.slots,before.slots);assert.equal(after.scores,before.scores);
   if(reusableLarge.size){assert.deepEqual(transfers.filter(item=>reusableLarge.has(item.path)),[],'Unchanged large assets must reuse verified cached bytes');report.checks.push({label:engine+' verified old large assets reused without network transfer',passed:true,eligible:reusableLarge.size,downloadedBytes:transfers.reduce((sum,item)=>sum+item.bytes,0)});}
   report.checks.push({label:engine+' historical menu applies actual new source and keeps saved data',passed:true});await page.screenshot({path:path.join(out,engine+'-new-title.png')});await context.close();
  }}finally{await browser.close();}
 }assert.deepEqual(report.errors,[]);report.passed=true;console.log('Legacy update checks passed: '+report.checks.length);
 }catch(error){report.passed=false;report.failure=error.stack;console.error(error);process.exitCode=1;}
 finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await new Promise(r=>server.close(r));}
})();
