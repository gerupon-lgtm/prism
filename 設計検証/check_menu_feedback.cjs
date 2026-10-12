// PC UI checks. Synthetic text/orientation/notice layout is separate from device evidence.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};
if(!arg('--playwright-path'))throw new Error('Pass --playwright-path');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),channel=arg('--channel'),root=path.resolve(__dirname,'../dist');
if(channel&&!['chrome','msedge'].includes(channel))throw new Error('Use chrome or msedge');
const out=path.join(__dirname,'操作とメニュー',arg('--url')?'public':channel||'');fs.mkdirSync(out,{recursive:true});
const reportFile=path.join(out,'report.json');
if(fs.existsSync(reportFile)&&JSON.parse(fs.readFileSync(reportFile)).passed===false)fs.copyFileSync(reportFile,path.join(out,'failed-'+Date.now()+'.json'),fs.constants.COPYFILE_EXCL);
const version=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version;
const report={version,evidence:'PC disposable browsers. CSS 28px enlargement, synthetic orientation and visible update-notice geometry. Real audio API where available; fallback audio mock explicitly labelled. No acoustic or physical device evidence.',checks:[],browsers:[]};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.ttf':'font/ttf','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(file===root)file=path.join(root,'index.html');try{res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
const settle=p=>p.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
async function menuFit(page,label,total){
  await page.locator('#menu').click();await settle(page);
  const data=await page.evaluate(()=>{const body=document.getElementById('dialog-body'),buttons=[...body.querySelectorAll('button')];return {count:buttons.length,pagers:body.querySelectorAll('.pager').length,body:[body.clientWidth,body.clientHeight,body.scrollWidth,body.scrollHeight],bounds:buttons.map(b=>{const r=b.getBoundingClientRect();return {name:b.getAttribute('aria-label'),text:b.textContent,rect:[r.left,r.top,r.right,r.bottom],size:[b.clientWidth,b.clientHeight,b.scrollWidth,b.scrollHeight]};}),viewport:[innerWidth,innerHeight],page:[document.documentElement.scrollWidth,document.documentElement.scrollHeight]};});
  assert.equal(data.count,total,label);assert.equal(data.pagers,0,label+' no page switching');assert(data.body[2]<=data.body[0]+1&&data.body[3]<=data.body[1]+1,label+' body fits');
  assert(data.page[0]<=data.viewport[0]+1&&data.page[1]<=data.viewport[1]+1,label+' no scroll');
  for(const b of data.bounds){assert(b.rect[0]>=-.5&&b.rect[1]>=-.5&&b.rect[2]<=data.viewport[0]+.5&&b.rect[3]<=data.viewport[1]+.5,label+' bounds '+b.name);assert(b.size[3]<=b.size[1]+1&&b.size[2]<=b.size[0]+1,label+' full visible text '+b.name);assert(b.text.length>=2,label+' meaningful label');}
  report.checks.push({label,passed:true,...data});
  if(label.includes('free menu 390x664 enlarged=false')||label.includes('free menu 480x240 enlarged=true'))await page.screenshot({path:path.join(out,`${label.startsWith('webkit')?'webkit':'chromium'}-menu${label.includes('enlarged=true')?'-compact':''}.png`)});
  await page.locator('#dialog-close').click();
}
async function noticeFit(page,label){
  // Geometry only: the actual startup/update contract is checked by check_pwa.cjs.
  await page.evaluate(()=>document.getElementById('update-notice').hidden=false);await settle(page);
  const r=await page.locator('#update-notice').boundingBox();assert(r&&r.x>=-.5&&r.y>=-.5&&r.x+r.width<=page.viewportSize().width+.5&&r.y+r.height<=page.viewportSize().height+.5,label);
  const fits=await page.evaluate(()=>{const b=document.getElementById('update-notice');return b.scrollWidth<=b.clientWidth+1&&b.scrollHeight<=b.clientHeight+1&&document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1;});assert(fits,label);report.checks.push({label,passed:true,rect:r});await page.evaluate(()=>document.getElementById('update-notice').hidden=true);
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
  for(const engine of channel?['chromium']:['chromium','webkit']){
    const browser=await pw[engine].launch({headless:true,...(channel?{channel}:{})});report.browsers.push({engine,channel,version:browser.version()});
    try{const context=await browser.newContext({viewport:{width:390,height:664},isMobile:true,hasTouch:true});
      await context.addInitScript(()=>{
        window.__audio=[];const Original=window.AudioContext??window.webkitAudioContext;window.__audioMethod=Original?'real browser API':'synthetic API fallback';
        const ramp=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
        const Fallback=class{constructor(){this.state='running';this.destination={};}get currentTime(){return performance.now()/1000;}async resume(){}createDynamicsCompressor(){return {connect(){}};}createGain(){return {gain:ramp(),connect(){},disconnect(){}};}createOscillator(){return {frequency:ramp(),connect(){},disconnect(){},start(){},stop(){}};}};
        let voiceId=0;
        window.AudioContext=class extends (Original??Fallback){createOscillator(){const id=++voiceId,o=super.createOscillator(),start=o.start.bind(o),stop=o.stop.bind(o);o.start=t=>{__audio.push({id,type:'start',at:t,frequency:o.frequency.value,wall:performance.now()});if(window.__failBell&&Math.abs(o.frequency.value-174.6)<.01)throw new Error('Synthetic bell failure');return start(t);};o.stop=t=>{__audio.push({id,type:'stop',at:t,frequency:o.frequency.value,wall:performance.now()});return stop(t);};return o;}};
        window.__direction={angle:0,type:'portrait-primary'};const direction=new EventTarget();Object.defineProperties(direction,{angle:{get:()=>__direction.angle},type:{get:()=>__direction.type}});Object.defineProperty(screen,'orientation',{get:()=>direction});
      });
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(arg('--url')||`http://127.0.0.1:${server.address().port}/`);await page.locator('#guide-skip').click();await settle(page);
      assert.equal(await page.locator('meta[name=prism-version]').getAttribute('content'),version);
      await menuFit(page,engine+' challenge menu',7);assert.equal(await page.evaluate(()=>__audio.length),0);
      await page.locator('#sound').click();await page.waitForFunction(()=>document.getElementById('sound').getAttribute('aria-pressed')==='true');
      const audio=await page.evaluate(()=>({events:__audio,method:__audioMethod}));assert.equal(audio.events.filter(e=>e.type==='start').length,1);assert(Math.abs(audio.events[1].at-audio.events[0].at-.06)<.001);
      const on=await page.locator('#sound').evaluate(e=>getComputedStyle(e).backgroundColor);await page.locator('#magnifier-toggle').click();await settle(page);await page.waitForTimeout(260);
      await page.locator('#menu').click();await settle(page);assert.equal(await page.locator('#menu').evaluate(e=>e.classList.contains('button-response')),true);await page.locator('#dialog-close').click();
      assert((await page.evaluate(()=>__audio.filter(e=>e.type==='start').length))>=4);
      await page.locator('#sound').click();await settle(page);await page.waitForTimeout(260);const off=await page.locator('#sound').evaluate(e=>getComputedStyle(e).backgroundColor);assert.notEqual(on,off);
      const mutedCount=await page.evaluate(()=>__audio.filter(e=>e.type==='start').length);await page.locator('#fit').click();assert.equal(await page.evaluate(()=>__audio.filter(e=>e.type==='start').length),mutedCount);
      report.checks.push({label:engine+' enabled/disabled state, transient click response, short UI audio only when sound enabled',passed:true,audio});
      await page.locator('#home').click();await page.getByRole('button',{name:'自由へ',exact:true}).click();if(await page.locator('#guide-skip').isVisible())await page.locator('#guide-skip').click();
      for(const enlarged of [false,true]){
        await page.evaluate(enlarged=>document.documentElement.style.setProperty('font-size',enlarged?'28px':'14px','important'),enlarged);
        for(const [width,height] of [[390,664],[320,480],[480,240],[844,310]]){
          await page.setViewportSize({width,height});await settle(page);await menuFit(page,`${engine} free menu ${width}x${height} enlarged=${enlarged}`,12);await noticeFit(page,`${engine} notice ${width}x${height} enlarged=${enlarged}`);
        }
      }
      await page.evaluate(()=>document.documentElement.style.removeProperty('font-size'));await page.setViewportSize({width:390,height:664});await settle(page);await page.locator('#play').click();await page.waitForFunction(()=>document.getElementById('play').dataset.state==='running');await page.waitForTimeout(260);await page.locator('#play').click();await page.waitForFunction(()=>document.getElementById('play').dataset.state==='paused');await menuFit(page,engine+' paused menu retains stop/edit',13);
      await page.locator('#stop').click();await page.locator('#home').click();await page.getByRole('button',{name:/^Q1 /}).click();if(await page.locator('#guide-skip').isVisible())await page.locator('#guide-skip').click();
      await settle(page);
      for(const [from,to] of [['S','A'],['A','G']]){const source=page.locator(`[data-node="${from}"] .node-hit`),target=page.locator(`[data-node="${to}"] .node-hit`);await source.waitFor({state:'visible'});await target.waitFor({state:'visible'});const a=await source.boundingBox(),b=await target.boundingBox();assert(a&&b,'Visible wiring targets');await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});await page.mouse.up();}
      await page.locator('#sound').click();await page.waitForFunction(()=>document.getElementById('sound').getAttribute('aria-pressed')==='true');await page.evaluate(()=>__audio=[]);
      assert.equal(await page.locator('#board .edge:not(.candidate)').count(),2,'Q1 has two complete edges before audio run');
      const movementSettings=await page.evaluate(async()=>{const entry=document.querySelector('script[src*="/ui/app.js"]');return (await import(new URL('audio.js',entry.src))).MOVEMENT_SOUND;});
      assert.equal(movementSettings.intervalSeconds,.1);assert.equal(movementSettings.frequencyHz,330);
      await page.locator('#play').click();await page.waitForFunction(f=>__audio.some(e=>e.type==='start'&&e.frequency===f),movementSettings.frequencyHz);await page.evaluate(()=>document.getElementById('play').click());await page.waitForFunction(()=>document.getElementById('play').dataset.state==='paused');assert((await page.evaluate(()=>__audio)).some(e=>e.type==='stop'&&e.frequency===movementSettings.frequencyHz));
      await page.locator('#play').click();await page.waitForFunction(()=>document.getElementById('result').textContent.includes('100.00点'),{},{timeout:7000});
      const movement=await page.evaluate(()=>__audio),starts=movement.filter(e=>e.type==='start'&&e.frequency===movementSettings.frequencyHz),stops=movement.filter(e=>e.type==='stop'&&e.frequency===movementSettings.frequencyHz),bell=movement.find(e=>e.type==='start'&&Math.abs(e.frequency-174.6)<.01);assert(starts.length>=4);for(const start of starts){const end=stops.find(e=>e.id===start.id&&e.at!==undefined);assert(end&&end.at-start.at<.05&&end.at>start.at,'Short pulse has reserved end');}assert(starts.some((start,i)=>i>0&&Math.abs(start.at-starts[i-1].at-.1)<.001),'0.1 sec pulse cadence');assert(bell&&stops.at(-1).wall<=bell.wall);assert((await page.locator('#result').textContent()).includes('2.5秒'));report.checks.push({label:engine+' short 330 Hz movement pulses at 0.1 sec; pause/processing/arrival stop before bell; calculation remains 2.5 sec and 100 points',passed:true,method:audio.method,movementSettings,movement});
      const upper=movement.find(e=>e.type==='start'&&Math.abs(e.frequency-349.2)<.01);assert(upper&&Math.abs(upper.at-bell.at)<.001,'Bell includes octave at the same start time');
      const inspect=()=>page.evaluate(async()=>{const entry=document.querySelector('script[src*="/ui/app.js"]'),app=await import(entry.src);return {at:performance.now(),run:app.inspectPerformance().run,result:document.getElementById('result').textContent,edges:document.querySelectorAll('#board .edge:not(.candidate)').length,clearDisabled:document.getElementById('clear-wires').disabled};});
      const ended=await inspect();assert.equal(ended.run.status,'paused');assert.equal(ended.clearDisabled,true);
      await page.waitForTimeout(500);assert.equal((await inspect()).run.status,'paused');
      await page.waitForFunction(()=>document.getElementById('play').dataset.state==='stopped',{},{timeout:4500});
      const returned=await inspect(),elapsed=returned.at-ended.at;assert(elapsed>=2700&&elapsed<4200,'Return is about 3 seconds after completion');assert.equal(returned.run.clock,ended.run.clock);assert.equal(returned.run.records,ended.run.records);assert.equal(returned.result,ended.result);assert.equal(returned.edges,2);assert.equal(returned.clearDisabled,false);
      report.checks.push({label:engine+' automatic editing return after 3 sec preserves clock, score, records and wiring',passed:true,elapsed,ended,returned});
      await page.locator('#play').click();await page.waitForFunction(()=>document.getElementById('result').textContent.includes('100.00点')&&document.getElementById('play').dataset.state==='paused',{},{timeout:7000});
      const manualStart=await inspect();await page.locator('#stop').click();const manualEnd=await inspect();assert.equal(manualEnd.run.status,'stopped');assert.equal(manualEnd.clearDisabled,false);assert(manualEnd.at-manualStart.at<1000,'Manual stop skips the 3-second wait');assert.equal(manualEnd.run.clock,manualStart.run.clock);assert.equal(manualEnd.run.records,manualStart.run.records);
      report.checks.push({label:engine+' manual stop allows immediate editing instead of waiting 3 sec',passed:true,elapsed:manualEnd.at-manualStart.at});
      await page.locator('#play').click();await page.evaluate(()=>{document.getElementById('play').click();window.__failBell=true;for(let i=0;i<10&&!document.getElementById('next').disabled;i++)document.getElementById('next').click();});
      const fault=await inspect();assert.equal(fault.run.pauseReason,'error');assert(fault.result.includes('Synthetic bell failure'));
      await menuFit(page,engine+' next-event fault menu keeps stop/edit',8);await page.waitForTimeout(3200);
      const retained=await inspect();assert.equal(retained.run.status,'paused');assert.equal(retained.run.clock,fault.run.clock);assert.equal(retained.run.records,fault.run.records);assert.equal(retained.run.retainedParticles,fault.run.retainedParticles);assert.equal(retained.clearDisabled,true);assert(retained.result.includes('Synthetic bell failure'));
      report.checks.push({label:engine+' synthetic final next-event audio failure survives menu viewing and 3 sec without automatic stop',passed:true,fault,retained});await page.evaluate(()=>window.__failBell=false);await page.locator('#stop').click();
      assert.deepEqual(errors,[]);await context.close();
    }finally{await browser.close();}
  }
  report.passed=true;console.log(`Menu/feedback checks passed: ${report.checks.length}`);
}catch(e){report.passed=false;report.failure=e.stack;throw e;}finally{await new Promise(r=>server.close(r));fs.writeFileSync(reportFile,JSON.stringify(report,null,2));}})().catch(e=>{console.error(e);process.exitCode=1;});
