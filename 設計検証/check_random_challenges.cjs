const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {enterApp,selectChallenge,chooseChallenge,wiringBounds,startAndPause,challengeSolution,dragConnection}=require('./browser_wait.cjs');
const arg=name=>{const at=process.argv.indexOf(name);return at<0?null:process.argv[at+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),channel=arg('--channel'),root=path.resolve(__dirname,'../dist');
const out=path.join(__dirname,'ランダム課題',arg('--url')?'public':channel||('browser'+(arg('--engine')?'-'+arg('--engine'):'')+(arg('--challenge')?'-'+arg('--challenge'):'')));fs.mkdirSync(out,{recursive:true});
const reportFile=path.join(out,'report.json');
if(fs.existsSync(reportFile)&&JSON.parse(fs.readFileSync(reportFile)).passed===false)fs.copyFileSync(reportFile,path.join(out,'failed-'+Date.now()+'.json'));
const proof=JSON.parse(fs.readFileSync(path.join(__dirname,'ランダム課題/generation.json')));
const report={version:JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version,evidence:'Real UI and exported records in disposable PC browsers. Synthetic mobile orientation and CSS enlargement; no physical-device or listening acceptance.',checks:[],browsers:[]};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{let f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(f===root)f=path.join(root,'index.html');if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',mime[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
const snapshot=page=>page.locator('#board .edge-time').evaluateAll(nodes=>nodes.map(n=>[n.closest('[data-edge]').dataset.edge,n.textContent]));
async function wire(page,id,partial=false){
  const edges=await challengeSolution(page,id,{partial});
  const routes=await page.evaluate(async({id,edges})=>{const entry=document.querySelector('script[type=module]').src,{challenges}=await import(new URL('../content/challenges.js',entry));const c=challenges.find(c=>c.id===id);return edges.map(id=>{const edge=c.candidates.find(e=>e.id===id);return [edge.from,edge.to];});},{id,edges});
  for(const [from,to] of routes)await dragConnection(page,from,to);
  const actual=await page.locator('.edge:not(.candidate)').evaluateAll(items=>items.map(item=>item.dataset.edge));
  assert.deepEqual([...actual].sort(),[...edges].sort(),'Requested individual routes: '+JSON.stringify({id,edges,actual}));
}
async function finish(page){
  if(page.realTime){await page.locator('#play').click();await page.waitForFunction(()=>document.getElementById('play').dataset.state!=='preparing');await page.waitForFunction(()=>{const text=document.getElementById('result').textContent;return text.includes('動作終了')||text.includes('編集可能')||text.includes('負荷のため');},null,{timeout:22000});}
  else{await startAndPause(page);await page.evaluate(async()=>{for(let i=0;i<512&&!document.getElementById('next').disabled;i++){document.getElementById('next').click();await new Promise(requestAnimationFrame);await new Promise(r=>setTimeout(r,100));}});}
  await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  report.lastPlayback=await page.evaluate(async()=>{const app=await import(document.querySelector('script[type=module]').src);return {performance:app.inspectPerformance(),profile:window.__displayProfile};});
}
async function exported(page){await page.locator('#menu').click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'実行結果を書き出す',exact:true}).click();const chunks=[],stream=await (await pending).createReadStream();for await(const c of stream)chunks.push(c);await page.locator('#dialog-close').click();return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
async function waitClear(page){
  try{await page.locator('#clear-toast').waitFor({state:'visible',timeout:5500});}
  catch(error){report.clearDiagnostic=await page.evaluate(async()=>{const app=await import(document.querySelector('script[type=module]').src);return {toast:document.getElementById('clear-toast').outerHTML,result:document.getElementById('result').textContent,problem:document.getElementById('app').dataset.problemId,constellations:document.querySelectorAll('.bell-constellation').length,performance:app.inspectPerformance(),profile:window.__displayProfile};});await page.screenshot({path:path.join(out,'clear-unavailable.png')});throw error;}
}
async function fitted(page,label){
  const data=await page.evaluate(()=>{const e=document.getElementById('condition');return {w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,condition:{width:e.clientWidth,scroll:e.scrollWidth},text:e.textContent};});
  assert(data.sw<=data.w+1&&data.sh<=data.h+1,label+' no page scroll');assert(data.condition.scroll<=data.condition.width+1,label+' condition not truncated');
  report.checks.push({label,passed:true,...data});
}
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{
 for(const engine of channel?['chromium']:arg('--engine')?[arg('--engine')]:['chromium','webkit']){
  const browser=await pw[engine].launch({headless:true,...(channel?{channel}:{})});report.browsers.push({engine,channel,version:browser.version()});
  try{
   const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
   await context.addInitScript(()=>{const original=Math.random;Math.random=()=>window.__fixtureDrawValue??original();});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   page.realTime=engine==='webkit';
   await page.goto(arg('--url')||`http://127.0.0.1:${server.address().port}/`);await enterApp(page);
   if(process.argv.includes('--profile'))await page.evaluate(async()=>{
    window.__displayProfile=[];const entry=document.querySelector('script[type=module]').src,{Board}=await import(new URL('./board.js',entry));
    const wrap=(prototype,name)=>{const original=prototype[name];prototype[name]=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{const milliseconds=performance.now()-start;if(milliseconds>=25)window.__displayProfile.push({name,milliseconds,stack:new Error().stack});}};};
    for(const name of ['renderArrivals','placeConstellations','particles','fitTimeLabels'])wrap(Board.prototype,name);
    for(const name of ['getBoundingClientRect','getClientRects'])wrap(Element.prototype,name);
    wrap(SVGGraphicsElement.prototype,'getScreenCTM');
   });
   const old={challenge:'Q7@1',rule:'delivery-all@1',achieved:true,score:{numerator:'90',denominator:'1'}};
   await page.evaluate(old=>localStorage.setItem('prism-notes.scores.v1',JSON.stringify({version:1,value:[old]})),old);
   for(const id of arg('--challenge')?[arg('--challenge')]:['Q7','Q8','Q9','Q10','Q11','Q12']){
    await page.evaluate(()=>window.__fixtureDrawValue=0);await selectChallenge(page,id);await page.evaluate(()=>delete window.__fixtureDrawValue);const first=await page.locator('#app').getAttribute('data-problem-id');assert.match(first,/^[0-9a-f]{16}$/);
    assert((await page.locator('#condition').textContent()).includes('出題'));
    const fixture=proof.stages.find(p=>p.id===first);assert(fixture);
    await fitted(page,engine+' '+id+' drawn condition fits');
    await wire(page,id);await finish(page);await waitClear(page);assert((await page.locator('#clear-score').textContent()).includes('100.00'));
    const file=await exported(page);assert.equal(file.challenge.draw.id,first);assert.equal(file.evaluation.evaluatedTime,file.challenge.baseline);
    assert.equal(file.challenge.baseline,fixture.baseline);assert.equal(file.challenge.maxDuration,fixture.maxDuration);
    for(const edge of file.conditions.edges)assert.equal(edge.time,file.challenge.candidates.find(c=>c.id===edge.id).time);
    const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('prism-notes.scores.v1')).value);assert.deepEqual(stored[0],old);
    assert.deepEqual(stored.find(score=>score.problem?.draw.id===first).problem,file.challenge);
    report.checks.push({label:engine+' '+id+' unique-perfect UI, actual baseline and complete persisted/exported conditions',passed:true,problem:first,baseline:file.challenge.baseline});
    const values=await snapshot(page);assert(values.length>0);await page.locator('#clear-again').click();assert.equal(await page.locator('#app').getAttribute('data-problem-id'),first);assert.deepEqual(await snapshot(page),values);
    assert.equal(await page.locator('.edge:not(.candidate)').count(),fixture.winner.length);
    await page.locator('#clear-wires').click();assert.equal(await page.locator('.edge:not(.candidate)').count(),0);assert.equal(await page.locator('#app').getAttribute('data-problem-id'),first);
    const before=await exported(page);assert.deepEqual(before.challenge,file.challenge);assert.deepEqual(before.records,file.records);
    report.checks.push({label:engine+' '+id+' retry, clear, menu and record export preserve the same draw and full result',passed:true});
    await page.evaluate(()=>window.__fixtureDrawValue=.9999);await selectChallenge(page,id);await page.evaluate(()=>delete window.__fixtureDrawValue);const second=await page.locator('#app').getAttribute('data-problem-id');assert.notEqual(second,first);assert.notDeepEqual(await snapshot(page),values);
    if(id==='Q7'){
     const alternate=proof.stages.find(p=>p.id===second);assert.notDeepEqual(alternate.winner,fixture.winner,'Q7 must change its perfect wiring as well as times');
     await wire(page,id);await finish(page);await waitClear(page);const perfect=await exported(page);assert.deepEqual(perfect.evaluation.score,{numerator:'100',denominator:'1'});
     report.checks.push({label:engine+' Q7 reselected problem has a different unique-perfect wiring and earns 100 points in the UI',passed:true,first,second,firstWiring:fixture.winner,secondWiring:alternate.winner});
     await page.locator('#clear-again').click();await page.locator('#clear-wires').click();assert.equal(await page.locator('#app').getAttribute('data-problem-id'),second);
    }
    await wire(page,id,true);await finish(page);const partial=await exported(page);assert.equal(partial.evaluation.state,'achieved');assert(Number(partial.evaluation.score.numerator)/Number(partial.evaluation.score.denominator)<100);await waitClear(page);
    report.checks.push({label:engine+' '+id+' reselection changes weights; another wiring clears with partial points',passed:true,first,second,score:partial.evaluation.score});
    await page.screenshot({path:path.join(out,engine+'-'+id+'.png')});
    await page.locator('#clear-next').click();if(id==='Q12'){assert.equal(await page.locator('#dialog-title').textContent(),'課題と自由');await chooseChallenge(page,'Q1');}else assert((await page.locator('#title').textContent()).startsWith('Q'+(Number(id.slice(1))+1)+' '));
    console.log(engine+' '+id+' random UI passed');
    if(process.argv.includes('--profile')){report.profile??=[];report.profile.push({engine,id,slow:await page.evaluate(()=>window.__displayProfile)});}
   }
   await selectChallenge(page,'Q1');assert.equal(await page.locator('#app').getAttribute('data-problem-id'),'');
   await page.locator('#home').click();await page.screenshot({path:path.join(out,engine+'-scores.png')});await page.locator('#dialog-close').click();
   await page.evaluate(()=>window.__fixtureDrawValue=.5);await selectChallenge(page,'Q12');await page.evaluate(()=>delete window.__fixtureDrawValue);await wire(page,'Q12');
   await page.evaluate(()=>{window.__savedScoreWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='prism-notes.scores.v1')throw new DOMException('Synthetic score quota','QuotaExceededError');return window.__savedScoreWrite.call(this,key,value);};});
   await finish(page);await page.locator('#retry-result').click();assert(await page.locator('#retry-result').isVisible());
   await page.locator('#menu').click();await page.getByRole('button',{name:'成績未保存を再試行',exact:true}).click();await page.locator('#dialog-title').filter({hasText:'成績の保存を再試行'}).waitFor({state:'visible'});
   const enlarged=await page.addStyleTag({content:':root{font-size:28px!important}'});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const retry=page.locator('#dialog-body .challenge-row').first(),metrics=await retry.evaluate(e=>({text:e.textContent,width:e.clientWidth,scrollWidth:e.scrollWidth,height:e.clientHeight,scrollHeight:e.scrollHeight}));
   assert.match(metrics.text,/Q12 .*出題\d+/);assert(metrics.scrollWidth<=metrics.width+1&&metrics.scrollHeight<=metrics.height+1,'Full pending problem and score wrap without clipping: '+JSON.stringify(metrics));
   await enlarged.evaluate(e=>e.remove());await page.evaluate(()=>{Storage.prototype.setItem=window.__savedScoreWrite;delete window.__savedScoreWrite;});await retry.click();
   assert.equal(await page.locator('#retry-result').isVisible(),false);await page.locator('#dialog-close').click();
   report.checks.push({label:engine+' failed variant score retry shows its full problem name and draw with enlarged text, then saves the retained conditions',passed:true,metrics,syntheticQuotaFailure:true});
   assert.deepEqual(errors,[]);report.checks.push({label:engine+' introductory content unchanged and no page errors',passed:true});await context.close();
  }finally{await browser.close();}
 }
 report.passed=true;console.log('Random challenge UI checks passed: '+report.checks.length);
}catch(error){report.passed=false;report.failure=error.stack;console.error(error.stack);process.exitCode=1;}finally{fs.writeFileSync(reportFile,JSON.stringify(report,null,2));await new Promise(resolve=>server.close(resolve));}})();
