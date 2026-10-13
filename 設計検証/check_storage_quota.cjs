const {enterApp,startGuide,skipGuide}=require('./browser_wait.cjs');
// Actual localStorage quota in disposable PC browser contexts, with synthetic padding.
// This does not prove physical-device storage, disk exhaustion, or OS eviction behavior.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const arg=name=>{const at=process.argv.indexOf(name);return at<0?null:process.argv[at+1];};
if(!arg('--playwright-path'))throw new Error('Pass --playwright-path');
process.env.PLAYWRIGHT_BROWSERS_PATH=arg('--browser-cache')||'C:/Users/user/AppData/Local/ms-playwright';
const pw=require(path.resolve(arg('--playwright-path'))),root=path.resolve(__dirname,'../dist'),out=path.join(__dirname,'保存容量');fs.mkdirSync(out,{recursive:true});
const previous=path.join(out,'report.json');
if(fs.existsSync(previous)){
 const prior=JSON.parse(fs.readFileSync(previous,'utf8'));
 if(prior.passed!==true){const archive=path.join(out,'failed-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');fs.copyFileSync(previous,archive,fs.constants.COPYFILE_EXCL);}
}
const build=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'),'utf8'));
const report={version:build.version,checkedAt:new Date().toISOString(),evidence:'Actual PC localStorage QuotaExceededError from bounded synthetic padding in disposable contexts. No setItem replacement. Not disk exhaustion, physical phones, OS shutdown/eviction, or production.',browsers:[],checks:[],errors:[]};
const keys=['prism-notes.circuits.v1','prism-notes.scores.v1','prism-notes.guides.v1'];
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.ttf':'font/ttf','.webmanifest':'application/manifest+json'};
const server=http.createServer((request,response)=>{
 const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname),file=path.resolve(root,'.'+pathname+(pathname==='/'?'index.html':''));
 if(file!==root&&!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
 try{response.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');response.setHeader('Cache-Control','no-store');response.end(fs.readFileSync(file));}catch{response.writeHead(404).end();}
});
const settle=page=>page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
const snapshot=page=>page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),keys);
const fillQuota=page=>page.evaluate(()=>{
 const prefix='prism-quota-fixture:',names=[],failures=[],limitBytes=16*1024*1024;let total=0,estimatedUTF16Bytes=0,chunk=65536;
 while(chunk>=1){
  const key=prefix+names.length,bytes=2*(key.length+chunk);
  if(estimatedUTF16Bytes+bytes>limitBytes)throw new Error('No quota error within bounded 16 MiB UTF-16 fixture');
  try{localStorage.setItem(key,'x'.repeat(chunk));names.push(key);total+=chunk;estimatedUTF16Bytes+=bytes;}
  catch(error){if(!(error instanceof DOMException)||error.name!=='QuotaExceededError')throw error;failures.push({name:error.name,code:error.code,chunk});chunk=Math.floor(chunk/2);}
 }
 // A failed new key still leaves room for a small growth of an existing value.
 const last=names.at(-1);if(!last)throw new Error('No dedicated padding key to finish filling quota');
 let tail=localStorage.getItem(last),finalTailAddedCharacters=0;
 while(true){
  if(estimatedUTF16Bytes+2>limitBytes)throw new Error('No existing-key quota error within bounded 16 MiB UTF-16 fixture');
  try{localStorage.setItem(last,tail+'x');tail+='x';total++;estimatedUTF16Bytes+=2;finalTailAddedCharacters++;}
  catch(error){if(!(error instanceof DOMException)||error.name!=='QuotaExceededError')throw error;failures.push({name:error.name,code:error.code,chunk:1,phase:'grow-existing-key'});break;}
 }
 return {names,totalValueCharacters:total,estimatedUTF16Bytes,limitBytes,finalTailAddedCharacters,failures,setItemReplaced:false};
});
const removePadding=(page,padding)=>page.evaluate(names=>{for(const key of names)localStorage.removeItem(key);},padding.names);
async function choose(page,name){
 await settle(page);
 for(let i=0;i<60;i++){
  const target=page.locator('#dialog').getByRole('button',{name,exact:typeof name==='string'});if(await target.count()){await target.click();await settle(page);return;}
  const next=page.locator('#dialog-body .pager button').last();assert(await next.count()&&!(await next.isDisabled()),'Missing '+name);await next.click();await settle(page);
 }
 throw new Error('Fixture navigation limit: '+name);
}
async function menu(page,name){await page.locator('#menu').click();await choose(page,name);}
async function download(page,name){
 const pending=page.waitForEvent('download');await menu(page,name);const item=await pending;const stream=await item.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);
 const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));await page.locator('#dialog-close').click();return value;
}
async function drag(page,from,to){
 const start=page.locator(`[data-node="${from}"] .node-hit`),end=page.locator(`[data-node="${to}"] .node-hit`);
 await start.waitFor({state:'visible'});await end.waitFor({state:'visible'});await settle(page);
 const a=await start.boundingBox(),b=await end.boundingBox();assert(a&&b,'Fixture drag nodes must be rendered');
 await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:10});await page.mouse.up();
}
async function save(page,name){await menu(page,'回路を保存');await page.getByRole('textbox',{name:'回路名'}).fill(name);await choose(page,'保存');}
async function challenge(page,id){await page.locator('#home').click();await choose(page,new RegExp('^'+id+' '));await drag(page,'S','A');await drag(page,'A','G');}
async function complete(page){await page.locator('#play').click();await page.waitForFunction(()=>document.getElementById('result').textContent.includes('100.00点'),{},{timeout:7000});}
const configurations=[{name:'chromium',type:pw.chromium},{name:'webkit',type:pw.webkit},{name:'windows-chrome',type:pw.chromium,channel:'chrome'},{name:'windows-edge',type:pw.chromium,channel:'msedge'}];
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}/`;
 try{
  for(const config of configurations){
   const browser=await config.type.launch({headless:true,...(config.channel?{channel:config.channel}:{})});report.browsers.push({name:config.name,channel:config.channel||null,version:browser.version()});
   try{
    const context=await browser.newContext({viewport:{width:390,height:664},acceptDownloads:true}),page=await context.newPage();
    page.on('pageerror',error=>report.errors.push({browser:config.name,message:error.message}));
    await page.goto(url);await enterApp(page);await skipGuide(page);await drag(page,'S','A');await drag(page,'A','G');await page.locator('#play').click();
    await page.waitForFunction(()=>document.getElementById('result').textContent.includes('100.00点'),{},{timeout:7000});await page.locator('#stop').click();
    await page.locator('#home').click();await choose(page,'自由へ');await skipGuide(page);await save(page,'容量確認の元回路1');await save(page,'容量確認の元回路2');
    await page.locator('[data-node="A"] .node-hit').dblclick();await choose(page,'時間');await page.getByRole('textbox',{name:'秒数'}).fill('1.7');await choose(page,'確定');
    const edited=(await download(page,'回路ファイルを書き出す')).circuit,before=await snapshot(page),slots=JSON.parse(before[keys[0]]).value;
    assert.equal(slots.length,2);assert.equal(JSON.parse(before[keys[1]]).value.length,1);assert.equal(edited.nodes.find(node=>node.id==='A').process,'1.7');
    const padding=await fillQuota(page);
    assert(padding.failures.length>0);assert(padding.failures.some(failure=>failure.chunk===1));assert.deepEqual(await snapshot(page),before);
    report.checks.push({browser:config.name,label:'Bounded synthetic padding reaches actual browser localStorage quota without replacing setItem; existing circuits/score/history unchanged',passed:true,padding,requirements:['NF-003'],acceptance:['AC-24']});
    const name='容量不足から再保存';await save(page,name);const message=await page.locator('#dialog-error').textContent();assert(message.length>0);assert.equal(await page.getByRole('textbox',{name:'回路名'}).inputValue(),name);assert.deepEqual(await snapshot(page),before);
    report.checks.push({browser:config.name,label:'Actual quota prevents circuit save while preserving input and all existing circuits/score/history',message,passed:true,requirements:['F-016','NF-003'],acceptance:['AC-24']});
    const pending=page.waitForEvent('download');await choose(page,'回路ファイル');const item=await pending,stream=await item.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);
    const fallback=JSON.parse(Buffer.concat(chunks).toString('utf8'));assert.equal(fallback.name,name);assert.deepEqual(fallback.circuit,edited);assert.equal(fallback.format,'prism-notes-circuit');assert.equal(await page.getByRole('textbox',{name:'回路名'}).inputValue(),name);assert.deepEqual(await snapshot(page),before);
    report.checks.push({browser:config.name,label:'Fallback download during actual quota failure contains exact unsaved circuit and name, without erasing data',passed:true,requirements:['F-017','NF-003'],acceptance:['AC-24']});
    await removePadding(page,padding);assert.deepEqual(await snapshot(page),before);await choose(page,'保存');
    const after=await snapshot(page),saved=JSON.parse(after[keys[0]]).value;assert.equal(saved.length,3);assert.deepEqual(saved.slice(0,2),slots);assert.equal(saved[2].name,name);assert.deepEqual(saved[2].circuit,edited);assert.equal(after[keys[1]],before[keys[1]]);assert.equal(after[keys[2]],before[keys[2]]);
    await menu(page,'保存回路');await choose(page,name);await choose(page,'読込');assert.equal(await page.locator('[data-node="A"] .node-time').textContent(),'1.7s');
    await page.screenshot({path:path.join(out,config.name+'.png')});assert.deepEqual(report.errors.filter(error=>error.browser===config.name),[]);
    report.checks.push({browser:config.name,label:'Removing only test padding permits retry in same form; new circuit reloads and prior circuits/score/history remain exact',passed:true,requirements:['F-016','F-017','NF-003'],acceptance:['AC-24']});

    await challenge(page,'Q2');const beforeScores=await snapshot(page),scorePadding=await fillQuota(page);await complete(page);
    assert((await page.locator('#result').textContent()).includes('成績1件未保存'));assert(await page.locator('#retry-result').isVisible());assert.deepEqual(await snapshot(page),beforeScores);
    await page.locator('#retry-result').click();assert(await page.locator('#retry-result').isVisible());assert.deepEqual(await snapshot(page),beforeScores);
    const scoreRetryText=await page.locator('#result').textContent();assert(scoreRetryText.includes('100.00点')&&scoreRetryText.includes('成績1件未保存'));assert(await page.locator('#result').evaluate(element=>element.classList.contains('error')));
    const failedScore=await download(page,'実行結果を書き出す');assert.equal(failedScore.evaluation.state,'achieved');assert.deepEqual(failedScore.evaluation.score,{numerator:'100',denominator:'1'});
    report.checks.push({browser:config.name,label:'Actual quota retains achieved Q2 result, inline retry and original best while retry still fails',passed:true,scoreRetryText,padding:scorePadding,requirements:['F-024','NF-003'],acceptance:['AC-21']});
    await page.locator('#stop').click();await challenge(page,'Q3');await complete(page);assert((await page.locator('#result').textContent()).includes('成績2件未保存'));assert.deepEqual(await snapshot(page),beforeScores);
    const secondScore=await download(page,'実行結果を書き出す');assert.equal(secondScore.evaluation.challenge,'Q3');assert.deepEqual(secondScore.evaluation.score,{numerator:'100',denominator:'1'});await page.locator('#stop').click();
    await menu(page,'成績未保存を再試行');await choose(page,/^Q2@1 100/);assert((await page.locator('#dialog-error').textContent()).length>0);assert.deepEqual(await snapshot(page),beforeScores);await page.locator('#dialog-close').click();
    report.checks.push({browser:config.name,label:'Play continues on Q3 during actual quota; both unsaved candidates survive a failed menu retry',passed:true,requirements:['F-024','NF-003'],acceptance:['AC-21']});
    await removePadding(page,scorePadding);await page.locator('#retry-result').click();assert(!(await page.locator('#retry-result').isVisible()));
    const afterScores=await snapshot(page),scoreValues=JSON.parse(afterScores[keys[1]]).value;assert.equal(scoreValues.length,3);assert.deepEqual(scoreValues[0],JSON.parse(beforeScores[keys[1]]).value[0]);
    for(const id of ['Q2@1','Q3@1'])assert.deepEqual(scoreValues.find(value=>value.challenge===id).score,{numerator:'100',denominator:'1'});
    assert.equal(afterScores[keys[0]],beforeScores[keys[0]]);assert.equal(afterScores[keys[2]],beforeScores[keys[2]]);
    report.checks.push({browser:config.name,label:'Removing only padding allows both score retries; original best, circuits and guide history remain exact',passed:true,requirements:['F-024','NF-003'],acceptance:['AC-21']});

    const originalResult=await download(page,'実行結果を書き出す');await menu(page,'操作の案内');await drag(page,'S','A');await drag(page,'A','G');await complete(page);await page.locator('#records').click();await page.locator('#guide-finish').waitFor({state:'visible'});
    const guidePadding=await fillQuota(page);await page.locator('#guide-finish').click();assert(await page.locator('#guide-bar').isVisible());assert(await page.locator('#guide-finish').isVisible());assert(await page.locator('#result').evaluate(element=>element.classList.contains('error')));assert.deepEqual(await snapshot(page),afterScores);
    await page.screenshot({path:path.join(out,config.name+'-guide-quota.png')});
    report.checks.push({browser:config.name,label:'Actual quota prevents skipped-to-completed guide history growth; practice and finish retry remain, with no false completion or lost data',passed:true,padding:guidePadding,requirements:['F-019','NF-003'],acceptance:['AC-26']});
    await removePadding(page,guidePadding);await page.locator('#guide-finish').click();assert(!(await page.locator('#guide-bar').isVisible()));
    const afterGuide=await snapshot(page);assert.equal(afterGuide[keys[0]],afterScores[keys[0]]);assert.equal(afterGuide[keys[1]],afterScores[keys[1]]);assert.deepEqual(JSON.parse(afterGuide[keys[2]]).value,{challenge:'completed',free:'skipped'});assert.deepEqual(await download(page,'実行結果を書き出す'),originalResult);
    report.checks.push({browser:config.name,label:'Guide finish retry after removing only padding restores original Q3 circuit/run/result and records completion without changing scores or circuits',passed:true,requirements:['F-019','NF-003'],acceptance:['AC-26']});
    await page.reload();await enterApp(page);await page.locator('#board [data-node="S"]').waitFor({state:'visible'});await settle(page);assert(!(await page.locator('#guide-bar').isVisible()));assert.deepEqual(await snapshot(page),afterGuide);assert.deepEqual(report.errors.filter(error=>error.browser===config.name),[]);
    report.checks.push({browser:config.name,label:'Reload retains recovered circuits, scores and independent guide outcomes without automatic challenge guide',passed:true,requirements:['F-019','F-024','NF-004'],acceptance:['AC-21','AC-26']});
    console.log(config.name+': '+report.checks.filter(check=>check.browser===config.name).length+' actual quota checks passed');
    await context.close();
   }finally{await browser.close();}
  }
  report.passed=true;console.log('Actual quota checks passed: '+report.checks.length);
 }catch(error){report.passed=false;report.failure=error.stack;throw error;}
 finally{if(server.listening)await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
})().catch(error=>{console.error(error);process.exitCode=1;});
