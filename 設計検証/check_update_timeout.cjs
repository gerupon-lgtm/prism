// Real Offline + built worker in a disposable browser. The delayed response is
// synthetic; this is not a physical-phone measurement and never touches user data.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')||'C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve('dist'),manifest=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))),version=manifest.version,engine=arg('--engine')||'chromium';
const delayMs=Number(arg('--delay-ms')||6500),target=manifest.assets.find(a=>a.endsWith('/starecho.png'));
assert(target);let delay=false,delayedFinished=false,browser,page;const pending=new Set();
const out=path.resolve('設計検証/更新待ち時間',version,engine);fs.mkdirSync(out,{recursive:true});
const report={version,engine,delayMs,passed:false,evidence:'Disposable desktop browser; synthetic delayed asset response; real shipped Offline and worker.',requests:[]};
const probe=`<!doctype html><html><meta charset="utf-8"><meta name="prism-version" content="${version}"><meta name="prism-offline" content="enabled"><button id="check">準備・更新を確認</button><pre id="state"></pre><script type="module">import {Offline} from './v${version}/src/ui/offline.js';const draw=()=>{document.getElementById('state').textContent=JSON.stringify(window.probeOffline.state);document.getElementById('check').disabled=window.probeOffline.state.checking;};window.probeOffline=new Offline(draw);document.getElementById('check').onclick=()=>window.probeOffline.prepare();window.probeOffline.prepare();</script></html>`;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');if(u.pathname==='/prism/probe.html'){res.writeHead(200,{'Content-Type':'text/html'}).end(probe);return;}
 const file=path.resolve(root,decodeURIComponent(u.pathname).replace(/^\/prism\//,'')||'index.html');if(!u.pathname.startsWith('/prism/')||!file.startsWith(root+path.sep)){res.writeHead(404).end();return;}
 const send=()=>{try{res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(fs.readFileSync(file));if(delay&&u.pathname==='/prism/'+target.slice(2))delayedFinished=true;}catch{res.writeHead(404).end();}};
 report.requests.push({path:u.pathname,delayed:delay&&u.pathname==='/prism/'+target.slice(2)});
 if(delay&&u.pathname==='/prism/'+target.slice(2)){const timer=setTimeout(()=>{pending.delete(timer);send();},delayMs);pending.add(timer);}else send();
});
(async()=>{try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/prism/`;
 browser=await pw[engine].launch({headless:true});page=await browser.newPage({viewport:{width:390,height:844}});await page.goto(url+'probe.html');
 await page.waitForFunction(()=>window.probeOffline?.state.checked&&!window.probeOffline.state.checking,null,{timeout:30000});
 await page.evaluate(async({version,target})=>{const c=await caches.open('prism-notes:/prism/:'+version);if(!await c.delete(new URL(target,document.baseURI)))throw Error('Missing fixture asset');}, {version,target});
 delay=true;const start=Date.now();await page.locator('#check').click();
 await page.waitForFunction(()=>!window.probeOffline.state.checking,null,{timeout:20000});
 report.elapsedMs=Date.now()-start;report.state=await page.evaluate(()=>window.probeOffline.state);report.assetFinishedBeforeResult=delayedFinished;
 await page.screenshot({path:path.join(out,'result.png')});
 console.log(JSON.stringify({version,delayMs,elapsedMs:report.elapsedMs,state:report.state,assetFinishedBeforeResult:delayedFinished}));
 assert.equal(report.state.error,null,'A successful asset preparation taking longer than five seconds must not become a timeout error');assert.equal(report.state.ready,true);assert.equal(report.state.checked,true);report.passed=true;
}catch(error){report.error=error.stack;console.error(error.message);process.exitCode=1;}finally{
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));for(const timer of pending)clearTimeout(timer);await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));
}})();
