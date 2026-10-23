// A labelled 180ms synthetic presentation delay checks the real resume UI.
// It is not a measurement of device speed or natural playback.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {enterApp,selectChallenge,dragConnection}=require('./browser_wait.cjs');
const arg=n=>process.argv[process.argv.indexOf(n)+1];
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),engine=process.argv.includes('--engine')?arg('--engine'):'webkit',root=path.resolve('dist');
const out=path.resolve('設計検証/再生テンポ-20261023/load-resume-'+engine);fs.mkdirSync(out,{recursive:true});
const report={version:JSON.parse(fs.readFileSync(root+'/build-info.json')).version,engine,syntheticDelayMs:180,passed:false,scope:'Real UI resume after one labelled synthetic presentation stall; not a device-speed or listening result'};
const server=http.createServer((req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===root)file=path.join(root,'index.html');assert(file.startsWith(root+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.ttf':'font/ttf'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
async function snapshot(p){return p.evaluate(async()=>{const app=await import(document.querySelector('script[type=module]').src);return {...app.inspectPerformance(),result:document.getElementById('result').textContent};});}
(async()=>{let browser,p;await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 const {Session}=await import(pathToFileURL(path.resolve('src/app/session.js'))),{LocalRecords}=await import(pathToFileURL(path.resolve('src/core/storage.js')));
 const reference=new Session(new LocalRecords({getItem:()=>null,setItem:()=>{}}),{random:()=>0});reference.replace({challengeId:'Q25'});
 const proof=JSON.parse(fs.readFileSync('設計検証/ランダム課題/generation.json')).stages.find(r=>r.id===reference.challenge.draw.id);assert(proof);
 const pairs=proof.winner.map(id=>reference.challenge.candidates.find(e=>e.id===id));
 for(const e of pairs)reference.connect(e.from,e.to);reference.start();reference.advance(reference.challenge.maxDuration);assert.equal(reference.result.state,'achieved');assert.equal(reference.result.score.numerator,'100');
 browser=await pw[engine].launch({headless:true});p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{Math.random=()=>0;});
 await p.goto('http://127.0.0.1:'+server.address().port+'/');await enterApp(p);await selectChallenge(p,'Q25');for(const e of pairs)await dragConnection(p,e.from,e.to);
 await p.evaluate(async()=>{const {Chime}=await import(new URL('./audio.js',document.querySelector('script[type=module]').src)),relay=Chime.prototype.relay;let delayed=false;Chime.prototype.relay=function(...args){const result=relay.apply(this,args);if(!delayed){delayed=true;const until=performance.now()+180;while(performance.now()<until){/* Single labelled test stall. */}}return result;};});
 await p.locator('#play').click();await p.waitForFunction(()=>document.getElementById('result').textContent.includes('負荷のため一時停止'),null,{timeout:10000});report.paused=await snapshot(p);assert.equal(report.paused.run.pauseReason,'load');assert.equal(await p.locator('#play').isDisabled(),false);
 await p.locator('#play').click();await p.waitForFunction(()=>document.getElementById('play').dataset.state==='stopped'&&!document.getElementById('play').disabled,null,{timeout:20000});report.returned=await snapshot(p);assert.match(report.returned.result,/達成 100.00点/);
 await p.locator('#menu').click();const pending=p.waitForEvent('download');await p.getByRole('button',{name:'実行結果を書き出す',exact:true}).click();const d=await pending;await d.saveAs(path.join(out,'result.json'));assert.equal(await d.failure(),null);const file=JSON.parse(fs.readFileSync(path.join(out,'result.json')));assert.deepEqual(file.records,reference.run.records);assert.equal(file.evaluation.evaluatedTime,proof.baseline);assert(!file.evaluation.timeLimitReached);assert.deepEqual(errors,[]);report.recordsMatched=file.records.length;report.baseline=proof.baseline;report.passed=true;await p.screenshot({path:path.join(out,'resumed.png')});console.log('Real UI resume preserves canonical records and full score');
}catch(e){report.error=e.stack;process.exitCode=1;console.error(e.stack);if(p)report.failureState=await snapshot(p).catch(()=>null);}finally{await browser?.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}})();
