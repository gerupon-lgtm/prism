const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {selectChallenge,chooseChallenge,dragConnection,startAndPause}=require('./browser_wait.cjs');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};
const url=arg('--url');assert(url,'Pass --url');process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),version=JSON.parse(fs.readFileSync(path.join(__dirname,'../package.json'))).version;
const out=path.join(__dirname,'厳密な到達間隔',version,new URL(url).hostname);fs.mkdirSync(out,{recursive:true});
const reportFile=path.join(out,'report.json');if(fs.existsSync(reportFile)&&JSON.parse(fs.readFileSync(reportFile)).passed===false)fs.copyFileSync(reportFile,path.join(out,'failed-rule-paging.json'));
const proof=JSON.parse(fs.readFileSync(path.join(__dirname,'ランダム課題/generation.json'))),report={version,url,checks:[],pending:['Physical devices, actual speaker listening and difficulty playtesting.']};
const check=(label,data={})=>report.checks.push({label,passed:true,...data});
(async()=>{let browser;try{
 browser=await pw.chromium.launch({headless:true});report.browser=browser.version();const context=await browser.newContext({viewport:{width:412,height:844},isMobile:true,hasTouch:true});
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(url);assert.equal(await p.locator('meta[name=prism-version]').getAttribute('content'),version);
 const bank=await p.evaluate(async proof=>{
  const base=document.querySelector('script[type=module]').src;
  const [{challenges,challengeCircuit},{randomVariants},{Simulation},{bellSequenceResult}]=await Promise.all(['../content/challenges.js','../content/random-variants.js','../core/simulation.js','../core/bell-sequence.js'].map(s=>import(new URL(s,base))));
  const rows=[];
  for(const c of challenges.filter(c=>c.type==='bell-sequence'&&c.intervals)){
   if(c.version!==2||c.intervalTolerance!==undefined)throw Error('Published condition is not exact');
   for(const draw of randomVariants[c.id]){
    const problem={...c,candidates:c.candidates.map((e,i)=>({...e,time:draw.times[i]}))},sample=proof.find(r=>r.id===draw.id);if(!sample)throw Error('Published draw differs from verified draw');
    for(const [kind,ids]of [['full',sample.winner],['partial',sample.partial.edges]]){
     const run=new Simulation(challengeCircuit(problem,ids));for(let i=0;!run.exhausted&&i<2048;i++)run.advanceNext();if(!run.exhausted)throw Error('Run did not end');
     const result=bellSequenceResult(problem,run);if(result.state!=='achieved'||JSON.stringify(result.gaps)!==JSON.stringify(c.intervals))throw Error('Published gap is not exact');if(result.actual!==(kind==='full'?sample.baseline:sample.partial.time))throw Error('Published arrival differs from verified result');
     rows.push({id:c.id,draw:draw.id,kind,gaps:result.gaps});
    }
   }
  }
  return {challenges,rows};
 },proof.stages);assert.equal(bank.rows.length,64);check('All 32 published draws achieve their exact gaps with both full and partial solutions',{rows:bank.rows});
 await p.locator('#title-challenges').click();await chooseChallenge(p,'Q1');
 for(const id of ['Q24','Q26','Q27','Q28']){
  await selectChallenge(p,id);const text=await p.locator('#challenge-goal').innerText();assert(!text.includes('約'));await p.locator('#challenge-info').click();const pages=[];
  for(let i=0;i<30;i++){await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));pages.push((await p.locator('#dialog-body .detail-value').allTextContents()).join(''));const next=p.locator('#dialog-body .pager button').last();if(await next.isDisabled())break;await next.click();}
  assert(pages.join('').replace(/\s/g,'').includes('完全一致'),'Exact rule accessible '+id);await p.locator('#dialog-close').click();check(id+' exact condition and full rule are visible',{text,pages});
 }
 await selectChallenge(p,'Q26');const draw=await p.locator('#app').getAttribute('data-problem-id'),row=proof.stages.find(r=>r.id===draw),c=bank.challenges.find(c=>c.id==='Q26');assert(row);
 for(const id of row.winner){const e=c.candidates.find(e=>e.id===id);await dragConnection(p,e.from,e.to);}
 await startAndPause(p);await p.evaluate(async()=>{for(let i=0;i<512&&!document.getElementById('next').disabled;i++){document.getElementById('next').click();await new Promise(requestAnimationFrame);}});
 await p.locator('#clear-toast').waitFor({state:'visible',timeout:6000});assert((await p.locator('#clear-score').innerText()).includes('100.00'));if(await p.locator('#stop').isEnabled())await p.locator('#stop').click();
 await p.screenshot({path:path.join(out,'Q22-clear.png')});await p.locator('#menu').click();const download=p.waitForEvent('download');await p.getByRole('button',{name:'実行結果を書き出す',exact:true}).click();const stream=await(await download).createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const exported=JSON.parse(Buffer.concat(chunks).toString());
 assert.equal(exported.challenge.version,2);assert.equal(exported.evaluation.state,'achieved');assert.deepEqual(exported.evaluation.gaps,['1','1']);assert.equal(exported.evaluation.evaluatedTime,row.baseline);check('Published Q22 actual wiring, score and exported gaps match the exact rule',{draw,gaps:exported.evaluation.gaps,goals:exported.evaluation.goals});
 assert.deepEqual(errors,[]);check('No JavaScript errors');report.passed=true;await context.close();
 }catch(error){report.passed=false;report.failure=error.stack;process.exitCode=1;}finally{await browser?.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failure:report.failure,out}));}})();
