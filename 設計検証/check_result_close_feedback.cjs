// Real result-card regression: a previous dismiss must not replay a press on reveal.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chooseChallenge,dragConnection}=require('./browser_wait.cjs');
const arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),engine=arg('--engine')||'chromium',root=path.resolve('dist');
const out=path.resolve(arg('--out')||`設計検証/結果閉じるボタン-20261024/${engine}`);fs.mkdirSync(out,{recursive:true});
const report={version:JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version,passed:false,cases:[],boundary:'Real UI in disposable desktop browsers; touch viewports emulate phones, physical-device appearance is unverified.'};
const server=http.createServer((req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===root)file=path.join(root,'index.html');assert(file.startsWith(root+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.ttf':'font/ttf','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
let browser;
(async()=>{try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await pw[engine].launch({headless:true});
  const scenarios=[{name:'phone-clear',kind:'clear'},{name:'phone-failure',kind:'failure'},{name:'desktop-clear',kind:'clear',desktop:true},{name:'desktop-failure',kind:'failure',desktop:true}];
  for(const c of scenarios.filter(c=>!arg('--cases')||arg('--cases').split(',').includes(c.name))){
    report.step=c.name;const context=await browser.newContext({viewport:c.desktop?{width:1440,height:960}:{width:390,height:844},isMobile:!c.desktop,hasTouch:!c.desktop}),p=await context.newPage(),errors=[];
    p.on('pageerror',e=>errors.push(e.message));
    await p.addInitScript(()=>{Math.random=()=>.5;localStorage.setItem('prism-notes.motion.v1',JSON.stringify({version:1,value:'full'}));});
    await p.goto(arg('--url')||`http://127.0.0.1:${server.address().port}/`);await p.locator('#board [data-node="S"]').waitFor({state:'attached'});
    await p.locator('#title-challenges').click();await chooseChallenge(p,'Q1');
    await dragConnection(p,'S','A');if(c.kind==='clear')await dragConnection(p,'A','G');
    const card='#'+c.kind+'-toast',button='#'+c.kind+'-dismiss';
    const press=selector=>c.desktop?p.locator(selector).click():p.locator(selector).tap();
    await press('#play');await p.locator(card).waitFor({state:'visible',timeout:15000});
    await press(button);await p.locator(card).waitFor({state:'hidden'});
    const afterDismiss=await p.locator(button).evaluate(e=>({classes:e.className,hidden:!e.getClientRects().length}));
    await p.mouse.move(1,1);
    await p.evaluate(({card,button})=>{
      const state=window.closeFeedbackProbe={samples:[],presses:[],shown:null};
      const e=document.querySelector(button),toast=document.querySelector(card);
      document.addEventListener('click',event=>state.presses.push({id:event.target.id,time:performance.now()}),true);
      function sample(){const now=performance.now();if(!toast.hidden&&toast.getClientRects().length){state.shown??=now;const s=getComputedStyle(e);state.samples.push({age:now-state.shown,classes:e.className,animation:s.animationName,background:s.backgroundColor,shadow:s.boxShadow,hover:e.matches(':hover'),active:e.matches(':active'),focus:e.matches(':focus-visible'),focused:document.activeElement===e});}if(state.shown===null||now-state.shown<450)requestAnimationFrame(sample);else state.done=true;}requestAnimationFrame(sample);
    },{card,button});
    await press('#play');await p.waitForFunction(()=>window.closeFeedbackProbe.done,null,{timeout:15000});
    const probe=await p.evaluate(()=>window.closeFeedbackProbe);report.cases.push({name:c.name,afterDismiss,...probe});
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
    await p.screenshot({path:path.join(out,c.name+'.png')});
    assert(probe.samples.length>=5,'Multiple rendered frames sampled');
    assert(probe.samples.every(s=>!s.classes.includes('button-response')&&s.animation!=='button-response'&&!s.active),'Untouched close button must not replay a press when the next result appears');
    assert(probe.samples.every(s=>s.background===probe.samples.at(-1).background&&s.shadow===probe.samples.at(-1).shadow),'Untouched close button appearance stays constant from its first painted frame');
    assert.deepEqual(errors,[],'No page errors');
    // The actual close remains usable after fixing its reveal appearance.
    await press(button);assert.equal(await p.locator(card).isVisible(),false,'Close still dismisses the result');
    assert.equal(await p.locator(button).evaluate(e=>e.classList.contains('button-response')),false,'A button hidden by its own action has no queued response');
    await p.evaluate(async()=>{const {Chime}=await import(new URL('./audio.js',document.querySelector('script[type=module]').src)),tap=Chime.prototype.tap;window.feedbackTaps=0;Chime.prototype.tap=function(...args){window.feedbackTaps++;return tap.apply(this,args);};});
    await press('#records');await p.locator('#records-panel').waitFor({state:'visible'});
    assert.equal(await p.evaluate(()=>window.feedbackTaps),1,'Opening records emits one accepted operation sound');
    await p.waitForFunction(()=>!document.getElementById('records').classList.contains('button-response'));
    // Actual records-close button follows the same hide-on-press pattern.
    for(let n=0;n<2;n++){
      await press('#close-records');await p.locator('#records-panel').waitFor({state:'hidden'});
      assert.equal(await p.locator('#close-records').evaluate(e=>e.classList.contains('button-response')),false,'Hidden records close has no queued press');
      await press('#records');await p.locator('#records-panel').waitFor({state:'visible'});
      assert.equal(await p.locator('#close-records').evaluate(e=>getComputedStyle(e).animationName),'none','Records close also reveals without a press');
    }
    await press('#close-records');
    // Controlled fixture: hide a still-animating control, as an async screen
    // change can do. Repeated presses must keep their new animation, not cancel it.
    await p.evaluate(()=>{const e=document.getElementById('records');window.responseStarts=0;e.addEventListener('animationstart',event=>{if(event.animationName==='button-response')window.responseStarts++;});e.click();getComputedStyle(e).animationName;e.click();getComputedStyle(e).animationName;});
    await p.waitForFunction(()=>window.responseStarts>0);
    const repeated=await p.locator('#records').evaluate(e=>({classes:e.className,running:e.getAnimations().some(a=>a.animationName==='button-response'&&a.playState==='running')}));
    assert(repeated.classes.includes('button-response')&&repeated.running,'A prior cancellation does not remove the new repeated-press feedback');
    await p.locator('#records').evaluate(e=>{e.hidden=true;e.getBoundingClientRect();});
    await p.waitForFunction(()=>!document.getElementById('records').classList.contains('button-response'));
    await p.locator('#records').evaluate(e=>{e.hidden=false;});
    assert.equal(await p.locator('#records').evaluate(e=>getComputedStyle(e).animationName),'none','Canceled animation cannot replay on reveal');
    assert.equal(await p.evaluate(()=>window.feedbackTaps),8,'Accepted controls retain one operation-sound call per click');
    report.cases.at(-1).controlChecks={recordCloseCycles:2,repeated,canceledResponseRemoved:true,tapCalls:8};
    console.log(c.name+' passed');await context.close();
  }report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(report.step,error.stack);}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}})();
