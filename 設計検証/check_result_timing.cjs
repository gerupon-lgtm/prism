// Result-card tuning through real UI, with real animation-frame playback.
// Only the timeout bound is a synthetic fixture; scoring and records stay real.
// Usage: node 設計検証/check_result_timing.cjs --playwright-path <playwright>
//   [--engine chromium|webkit] [--out <directory>] [--url https://...]
//   [--cases layout,settings,playback] [--self-check]
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chooseChallenge,dragConnection}=require('./browser_wait.cjs');
const arg=name=>{const index=process.argv.indexOf(name);return index<0?null:process.argv[index+1];};
const storageKey='prism-notes.result-timing.v1',root=path.resolve('dist'),engine=arg('--engine')||'chromium';
const groups=(arg('--cases')||'layout,settings,playback').split(',');
for(const group of groups)assert(['layout','settings','playback'].includes(group),'Unknown --cases group '+group);
const selectors=['result-timing-open','result-timing-clear','result-timing-failure','result-timing-apply','result-timing-reset','result-timing-status'];
if(process.argv.includes('--self-check')){
  const source=fs.readFileSync('src/ui/app.js','utf8');
  for(const id of selectors)assert(source.includes(id),'Missing UI contract '+id);
  assert(source.includes('結果カードのタイミング'),'Missing Japanese dialog title');
  console.log(JSON.stringify({passed:true,boundary:'Static UI contract only; no browser launched',selectors}));return;
}
assert(arg('--playwright-path'),'--playwright-path is required');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),version=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'),'utf8')).version;
const output=path.resolve(arg('--out')||path.join('設計検証/結果カード調整-20261024',engine));fs.mkdirSync(output,{recursive:true});
const report={version,passed:false,checks:[],boundary:'Disposable desktop browsers; phone size/orientation and enlarged text are emulated. Physical-device touch and listening remain unverified.'};
const check=(name,evidence={})=>{report.checks.push({name,passed:true,...evidence});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(name+' passed');};
const server=http.createServer((req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===root)file=path.join(root,'index.html');assert(file.startsWith(root+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.ttf':'font/ttf','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
const layouts=[
  {name:'phone',width:390,height:844,mobile:true},
  {name:'landscape',width:844,height:390,mobile:true},
  {name:'desktop',width:1440,height:960,mobile:false},
  {name:'enlarged',width:390,height:844,mobile:true,font:28},
  {name:'enlarged-landscape',width:844,height:390,mobile:true,font:28},
  {name:'short-enlarged',width:640,height:240,mobile:true,font:28},
];
let browser,url;
const settle=p=>p.evaluate(async()=>{await document.fonts.ready;for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});
async function pageFor(layout=layouts[0]){
  const context=await browser.newContext({viewport:{width:layout.width,height:layout.height},isMobile:layout.mobile,hasTouch:layout.mobile});
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{Math.random=()=>.5;localStorage.setItem('prism-notes.motion.v1',JSON.stringify({version:1,value:'full'}));});
  await p.goto(url);await p.locator('#board [data-node="S"]').waitFor({state:'attached'});
  assert.equal(await p.locator('meta[name="prism-version"]').getAttribute('content'),version,'Page matches the built release');
  if(layout.font)await p.evaluate(font=>{document.documentElement.style.fontSize=font+'px';dispatchEvent(new Event('resize'));},layout.font);
  await settle(p);return {p,context,errors};
}
async function openTiming(p,from='title'){
  if(from==='title')await p.locator('#title-about').click();
  else {if(await p.locator('#title-screen').isVisible())await p.locator('#title-resume').click();await p.locator('#menu').click();}
  await p.getByRole('button',{name:'表示・演出',exact:true}).click();
  await p.locator('#result-timing-open').click();
  assert.equal(await p.locator('#dialog-title').textContent(),'結果カードのタイミング');await settle(p);
}
const readStorage=p=>p.evaluate(key=>localStorage.getItem(key),storageKey);
async function assertValues(p,clear,failure){assert.equal(await p.locator('#result-timing-clear').inputValue(),clear);assert.equal(await p.locator('#result-timing-failure').inputValue(),failure);}
async function save(p,clear,failure){
  await p.locator('#result-timing-clear').fill(clear);await p.locator('#result-timing-failure').fill(failure);await p.locator('#result-timing-apply').click();
  await p.waitForFunction(key=>Boolean(localStorage.getItem(key)),storageKey);
  assert.deepEqual(JSON.parse(await readStorage(p)),{version:1,clearMs:Math.round(Number(clear)*1000),failureMs:Math.round(Number(failure)*1000)});
  assert.match(await p.locator('#result-timing-status').textContent(),/保存/);
}
async function geometry(p){
  return p.evaluate(async()=>{
    const ids=['dialog-title','result-timing-clear','result-timing-failure','result-timing-apply','result-timing-reset','dialog-close'];
    const nodes=[...ids.map(id=>document.getElementById(id)),...document.querySelectorAll('label[for="result-timing-clear"],label[for="result-timing-failure"]')];
    const dialog=document.getElementById('dialog').getBoundingClientRect(),bad=[];
    const measurements=[];
    for(const e of nodes){if(!e){bad.push('missing element');continue;}
      // A short dialog may scroll its body; each complete field and its label
      // must remain reachable while its action buttons stay on screen.
      if(e.closest('.result-timing-fields')){e.scrollIntoView({block:'nearest'});await new Promise(requestAnimationFrame);}
      const r=e.getBoundingClientRect(),name=e.id||e.textContent,style=getComputedStyle(e),box=rect=>({left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height});
      const record={name,text:e.textContent,rect:box(r),clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,style:{font:style.font,lineHeight:style.lineHeight,whiteSpace:style.whiteSpace,textOverflow:style.textOverflow,overflowX:style.overflowX,overflowY:style.overflowY},textRects:[],clipAncestors:[]};
      if(!r.width||!r.height||e.closest('[hidden]'))bad.push(name+' invisible');
      if(r.left<Math.max(0,dialog.left)-1||r.right>Math.min(innerWidth,dialog.right)+1||r.top<Math.max(0,dialog.top)-1||r.bottom>Math.min(innerHeight,dialog.bottom)+1)bad.push(name+' outside visible dialog/viewport');
      if(e.closest('#dialog-body')){const b=document.getElementById('dialog-body').getBoundingClientRect();if(r.left<b.left-1||r.right>b.right+1||r.top<b.top-1||r.bottom>b.bottom+1)bad.push(name+' clipped by scrolling body');}
      record.contentOverflows={x:e.scrollWidth>e.clientWidth+1,y:e.scrollHeight>e.clientHeight+1};
      if(e.matches('input,button')&&(record.contentOverflows.x||record.contentOverflows.y))bad.push(name+' control content overflow');
      if(!e.matches('input')){
        // A CJK glyph's Range box can extend beyond its CSS line box even when
        // overflow is visible. Test the actual clipping ancestors, not that
        // harmless font-metric overhang; keep raw line/scroll metrics as proof.
        const visible={left:Math.max(0,dialog.left),right:Math.min(innerWidth,dialog.right),top:Math.max(0,dialog.top),bottom:Math.min(innerHeight,dialog.bottom)};
        for(let ancestor=e;ancestor;ancestor=ancestor.parentElement){
          const css=getComputedStyle(ancestor),clipX=['hidden','clip','auto','scroll'].includes(css.overflowX),clipY=['hidden','clip','auto','scroll'].includes(css.overflowY);if(!clipX&&!clipY)continue;
          const rect=ancestor.getBoundingClientRect(),client={left:rect.left+ancestor.clientLeft,right:rect.left+ancestor.clientLeft+ancestor.clientWidth,top:rect.top+ancestor.clientTop,bottom:rect.top+ancestor.clientTop+ancestor.clientHeight};
          record.clipAncestors.push({name:ancestor.id||ancestor.tagName,className:ancestor.className,overflowX:css.overflowX,overflowY:css.overflowY,client});
          if(clipX){visible.left=Math.max(visible.left,client.left);visible.right=Math.min(visible.right,client.right);}if(clipY){visible.top=Math.max(visible.top,client.top);visible.bottom=Math.min(visible.bottom,client.bottom);}
        }
        const range=document.createRange();range.selectNodeContents(e);record.textRects=[...range.getClientRects()].map(box);record.textVisibleRegion=visible;
        if(record.textRects.some(text=>text.left<visible.left-1||text.right>visible.right+1||text.top<visible.top-1||text.bottom>visible.bottom+1))bad.push(name+' text clipped by visible region');
      }
      measurements.push(record);
    }
    return {bad,viewport:{width:innerWidth,height:innerHeight},font:getComputedStyle(document.documentElement).fontSize,measurements};
  });
}
async function layoutChecks(){
  for(const layout of layouts){
    const {p,context,errors}=await pageFor(layout);
    for(const from of ['title','play']){
      report.step='layout-'+layout.name+'-'+from;await openTiming(p,from);await assertValues(p,'1.6','1.6');
      for(const id of ['clear','failure'])assert.deepEqual(await p.locator('#result-timing-'+id).evaluate(e=>({type:e.type,min:e.min,max:e.max,step:e.step})),{type:'number',min:'0',max:'5',step:'0.1'});
      if(layout.name==='short-enlarged')assert.equal(await p.locator('#dialog-info').isVisible(),true,'Short form makes its notes available through the explanation button');
      if(await p.locator('#dialog-info').isVisible()){
        const before=await readStorage(p);
        await p.locator('#result-timing-clear').fill('0.9');await p.locator('#result-timing-failure').fill('2.1');
        await p.locator('#dialog-info').click();await p.getByRole('button',{name:'戻る',exact:true}).click();await settle(p);
        assert.equal(await p.locator('#dialog-title').textContent(),'結果カードのタイミング');
        assert.equal(await p.locator('#dialog').evaluate(e=>e.classList.contains('settings-dialog')&&e.classList.contains('result-timing-dialog')),true,'Explanation back restores timing dialog classes');
        assert.equal(await p.locator('#dialog-body').evaluate(e=>e.classList.contains('result-timing-form')),true,'Explanation back restores timing form class');
        await assertValues(p,'0.9','2.1');assert.equal(await readStorage(p),before,'Viewing explanation preserves the unsaved draft without saving it');
        check(report.step+'-explanation-roundtrip',{clearDraft:'0.9',failureDraft:'2.1',savedValue:before});
      }
      const measured=await geometry(p);await p.screenshot({path:path.join(output,report.step+'.png')});
      if(measured.bad.length){report.failedGeometry={name:report.step,...measured};fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.error(JSON.stringify({step:report.step,failedGeometry:measured}));}
      assert.deepEqual(measured.bad,[],report.step+' complete labels and controls fit');
      check(report.step,measured);await p.locator('#dialog-close').click();
    }
    assert.deepEqual(errors,[],'No layout page errors');await context.close();
  }
}
async function settingsChecks(){
  report.step='settings';const {p,context,errors}=await pageFor();await openTiming(p);await assertValues(p,'1.6','1.6');
  assert.equal(await readStorage(p),null,'First open does not persist a synthetic user choice');
  await save(p,'0.7','2.8');await p.locator('#dialog-close').click();await p.reload();await p.locator('#board [data-node="S"]').waitFor({state:'attached'});await openTiming(p);await assertValues(p,'0.7','2.8');
  check('save-and-reload',{stored:JSON.parse(await readStorage(p))});
  const invalid=[{field:'clear',value:''},{field:'clear',value:'-0.1'},{field:'failure',value:'5.1'},{field:'clear',value:'0.15'}];
  for(const item of invalid){
    await p.locator('#result-timing-clear').fill('0.7');await p.locator('#result-timing-failure').fill('2.8');
    const before=await readStorage(p);await p.locator('#result-timing-'+item.field).fill(item.value);await p.locator('#result-timing-apply').click();
    assert.equal(await readStorage(p),before,'Invalid '+JSON.stringify(item)+' preserves both saved values');
    assert(await p.locator('#dialog-error').textContent()||!await p.locator('#result-timing-'+item.field).evaluate(e=>e.validity.valid),'Invalid input gives an error or native validation');
  }
  check('invalid-input-preserves-both-values',{invalid});
  await p.locator('#result-timing-reset').click();await assertValues(p,'1.6','1.6');
  const reset=await readStorage(p);assert(!reset||JSON.stringify(JSON.parse(reset))===JSON.stringify({version:1,clearMs:1600,failureMs:1600}),'Reset saves or removes only the default timing preference');
  await p.locator('#dialog-close').click();await p.reload();await p.locator('#board [data-node="S"]').waitFor({state:'attached'});await openTiming(p);await assertValues(p,'1.6','1.6');
  check('reset-persists-defaults',{stored:reset});
  await save(p,'0','5');await p.locator('#dialog-close').click();await openTiming(p,'title');await assertValues(p,'0.0','5.0');check('allowed-boundaries-save',{stored:JSON.parse(await readStorage(p))});
  assert.deepEqual(errors,[],'No settings page errors');await context.close();
}
// Read real rendering timestamps and official state without replacing clocks or
// advancing the simulation. The Session wrapper exposes the actual UI instance.
function observe(){
  const stringify=value=>JSON.stringify(value,(_key,v)=>typeof v==='bigint'?v.toString():v);
  const state=window.resultTimingProbe={completed:null,toast:null,editing:null,toastText:null,maxPaintGapMs:0,samples:[],started:performance.now()};
  const visible=e=>Boolean(e&&!e.hidden&&!e.closest('[hidden]')&&e.getClientRects().length);
  const read=()=>{const now=performance.now(),play=document.getElementById('play');
    if(play.disabled&&play.textContent==='終了'){state.completed??=now;state.uiCompleted??=now;}
    const clear=document.getElementById('clear-toast'),failure=document.getElementById('failure-toast'),shown=visible(clear)?clear:visible(failure)?failure:null;
    if(shown&&state.toast===null){state.toast=now;state.toastKind=shown===clear?'clear':'failure';state.toastText=shown.textContent;}
    if(state.completed&&play.dataset.state==='stopped'&&!play.disabled)state.editing??=now;
  };
  const observer=new MutationObserver(read);observer.observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});
  let previous=null,frame=null;
  const paint=now=>{if(previous!==null)state.maxPaintGapMs=Math.max(state.maxPaintGapMs,now-previous);previous=now;read();
    const session=window.resultTimingSession;
    if(state.completed&&!state.toast&&session?.result?.timeLimitReached){
      const official=stringify({clock:session.run.clock,pauseReason:session.run.pauseReason,records:session.run.records,result:session.result});
      const markers=stringify([...document.querySelectorAll('#board [data-arrival-count]')].map(e=>({node:e.dataset.node,count:e.dataset.arrivalCount,last:e.classList.contains('last-arrival')})));
      const moving=[...document.querySelectorAll('#board .light-particle.moving')].map(e=>e.getAttribute('transform'));
      state.samples.push({wall:performance.now(),official,markers,moving,displayClock:session.timeoutMotionRun?.circuit.time.format(session.timeoutMotionRun.clock)??null});
    }
    if(!state.toast)frame=requestAnimationFrame(paint);
  };frame=requestAnimationFrame(paint);
  window.stopResultTimingObserver=()=>{observer.disconnect();cancelAnimationFrame(frame);};
}
async function instrument(p,limit){
  await p.evaluate(async limit=>{const base=document.querySelector('script[type=module]').src,{Session}=await import(new URL('../app/session.js',base)),start=Session.prototype.start;
    Session.prototype.start=function(...args){window.resultTimingSession=this;if(limit)this.challenge={...this.challenge,maxDuration:limit};return start.apply(this,args);};
    const {EndWait}=await import(new URL('./end-wait.js',base)),ready=EndWait.prototype.ready;
    EndWait.prototype.ready=function(run,now,...args){const result=ready.call(this,run,now,...args),probe=window.resultTimingProbe;if(probe&&this.deadline!==null&&probe.completed===null){probe.completed=now;probe.completionSource='Real EndWait.ready anchor after final-frame preparation';}return result;};
  },limit||null);
}
async function enterWired(p,edges,id='Q1'){
  await p.locator('#title-challenges').click();await chooseChallenge(p,id,{pagerTimeout:5000});
  const c=await p.evaluate(async id=>{const {challenges}=await import(new URL('../content/challenges.js',document.querySelector('script[type=module]').src));return challenges.find(c=>c.id===id);},id);
  for(const id of edges){const e=c.candidates.find(e=>e.id===id);assert(e,'Fixture edge '+id);await dragConnection(p,e.from,e.to);}
}
async function measuredPlay(p,{name,kind,expectedMs,timeout=false,storageChange=null}){
  report.step=name;await p.evaluate(observe);await p.locator('#play').click();
  await p.waitForFunction(()=>window.resultTimingProbe.completed!==null,null,{timeout:15000});
  if(storageChange)await p.evaluate(({key,value})=>{const oldValue=localStorage.getItem(key),newValue=JSON.stringify(value);localStorage.setItem(key,newValue);dispatchEvent(new StorageEvent('storage',{key,oldValue,newValue,storageArea:localStorage,url:location.href}));},{key:storageKey,value:storageChange});
  await p.waitForFunction(()=>window.resultTimingProbe.toast!==null&&window.resultTimingProbe.editing!==null,null,{timeout:8000});
  const result=await p.evaluate(()=>{window.stopResultTimingObserver();return {probe:window.resultTimingProbe,exported:window.resultTimingSession.exportResult()};});
  const waitMs=result.probe.toast-result.probe.completed,tolerance=Math.max(250,result.probe.maxPaintGapMs*2);
  assert.equal(result.probe.toastKind,kind,name+' correct card');assert(waitMs>=expectedMs-80,name+' selected minimum delay');assert(waitMs<=expectedMs+tolerance,name+' selected upper delay');
  if(timeout){
    assert.match(result.probe.toastText,/時間切れ/);const samples=result.probe.samples;assert(samples.length>5,'Multiple continuation frames observed');
    assert.equal(new Set(samples.map(s=>s.official)).size,1,'Official clock, scores, judgment and records stay fixed throughout continuation');
    assert.equal(new Set(samples.map(s=>s.markers)).size,1,'Official arrival counts and last-arrival marker stay fixed');
    const moving=samples.filter(s=>s.moving.length);assert(moving.length>5,'Visible continuation sampled');assert(new Set(moving.map(s=>JSON.stringify(s.moving))).size>1,'Continued light actually moves');
    assert(samples.at(-1).wall>=result.probe.completed+expectedMs-180,'Continuation remains active through the selected failure wait');
    const late=samples.filter(s=>s.wall>result.probe.completed+1800);assert(late.length>5&&new Set(late.map(s=>s.displayClock)).size>1,'Display clock continues beyond the previous 1.5 second bound');
    assert(Number(samples.at(-1).displayClock)>=1.1+(expectedMs-180)/1000,'Presentation clock reaches the selected failure duration');
    assert.equal(await p.locator('#board .light-particle').count(),0,'Card ends remaining light motion');
    assert.equal(result.exported.evaluation.timeLimitReached,true);assert(result.exported.records.every(row=>Number(row.time)<=1.1),'Official export excludes later display-only events');
  }
  await p.screenshot({path:path.join(output,name+'.png')});check(name,{waitMs,expectedMs,...result});return result;
}
async function playbackChecks(){
  const scenarios=[
    {name:'default-clear',kind:'clear',edges:['SA','AG'],expectedMs:1600},
    {name:'default-failure',kind:'failure',edges:['SA'],expectedMs:1600},
    {name:'custom-clear',kind:'clear',edges:['SA','AG'],settings:['0.4','2.7'],expectedMs:400},
    {name:'custom-failure',kind:'failure',edges:['SA'],settings:['0.4','2.7'],expectedMs:2700},
    {name:'custom-timeout-continuation',kind:'failure',id:'Q29',edges:['SA','SB','BD','DS','AG'],settings:['0.4','2.7'],expectedMs:2700,timeout:true},
    {name:'zero-clear',kind:'clear',edges:['SA','AG'],settings:['0','5'],expectedMs:0},
  ];
  for(const scenario of scenarios){
    const {p,context,errors}=await pageFor();
    if(scenario.settings){await openTiming(p);await save(p,...scenario.settings);await p.locator('#dialog-close').click();}
    await instrument(p,scenario.timeout?'1.1':null);await enterWired(p,scenario.edges,scenario.id);await measuredPlay(p,scenario);assert.deepEqual(errors,[],scenario.name+' no page errors');await context.close();
  }
  const {p,context,errors}=await pageFor();await openTiming(p);await save(p,'0.8','2.7');await p.locator('#dialog-close').click();await instrument(p);await enterWired(p,['SA','AG']);
  await measuredPlay(p,{name:'current-run-keeps-snapshot',kind:'clear',expectedMs:800,storageChange:{version:1,clearMs:2300,failureMs:600}});
  await p.locator('#clear-again').click();await measuredPlay(p,{name:'next-run-uses-reloaded-preference',kind:'clear',expectedMs:2300});
  assert.deepEqual(errors,[],'No run snapshot page errors');await context.close();
}
(async()=>{try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url=arg('--url')||`http://127.0.0.1:${server.address().port}/`;report.url=url;
  browser=await pw[engine].launch({headless:true});report.browser={engine,version:browser.version()};
  if(groups.includes('layout'))await layoutChecks();if(groups.includes('settings'))await settingsChecks();if(groups.includes('playback'))await playbackChecks();report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(report.step,error.stack);}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));}})();
