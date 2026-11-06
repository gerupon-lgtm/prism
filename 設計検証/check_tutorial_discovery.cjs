// The real two-chapter tutorial, its demonstration, three bell pitches and
// original-state recovery. Hooks observe calls; all progression uses real UI.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {startGuide,dragConnection,holdWire,wiringBounds}=require('./browser_wait.cjs');
const arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),engine=arg('--engine')||'chromium',root=path.resolve('dist');
const out=path.resolve(arg('--out')||`設計検証/チュートリアル体験-20261106/${engine}`);fs.mkdirSync(out,{recursive:true});
const version=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version;
const report={version,engine,passed:false,cases:[],runner:{pid:process.pid,startedAt:new Date().toISOString()},boundary:'Desktop browser UI and actual wall-clock playback. Mobile touch/viewport/text size are emulated. Native audio requests and generated bell voices are observed where AudioContext exists; physical-device listening and understanding are unverified.'};console.log('Verifier PID '+process.pid);
const server=http.createServer((req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===root)file=path.join(root,'index.html');assert(file.startsWith(root+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.ttf':'font/ttf','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
const scenarios=[{name:'phone',width:390,height:844,saveFailure:true},{name:'small',width:320,height:480},{name:'desktop',width:1440,height:960,desktop:true},{name:'landscape',width:844,height:390},{name:'enlarged',width:390,height:844,font:28},{name:'small-enlarged',width:320,height:480,font:28},{name:'landscape-enlarged',width:844,height:390,font:28},{name:'reduce',width:390,height:844,reduced:true},{name:'alternate',width:390,height:844,alternate:true},{name:'recovery',width:390,height:700,recovery:true},{name:'free',width:390,height:844,free:true}];
let browser,currentPage;
const settle=p=>p.evaluate(async()=>{await document.fonts.ready;for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});
const snapshot=p=>p.evaluate(()=>({edges:[...document.querySelectorAll('.edge:not(.candidate)')].map(e=>e.dataset.edge).sort(),nodes:[...document.querySelectorAll('[data-node]')].map(e=>({id:e.dataset.node,time:e.querySelector('.node-time')?.textContent})),scores:localStorage.getItem('prism-notes.scores.v1'),circuits:localStorage.getItem('prism-notes.circuits.v1')}));
async function inspectViewport(p){
  const value=await p.evaluate(()=>{const r=document.getElementById('app').getBoundingClientRect(),v=window.visualViewport;return {width:innerWidth,height:innerHeight,physical:{width:v?v.width*v.scale:innerWidth,height:v?v.height*v.scale:innerHeight,scale:v?.scale??1},root:{height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth},body:{height:document.body.scrollHeight,width:document.body.scrollWidth},app:{left:r.left,right:r.right,top:r.top,bottom:r.bottom}};});
  for(const [name,box]of Object.entries({root:value.root,body:value.body})){assert(box.height<=value.physical.height+1,name+' has no page vertical overflow');assert(box.width<=value.physical.width+1,name+' has no page horizontal overflow');}
  const a=value.app;assert(a.left>=-1&&a.top>=-1&&a.right<=value.physical.width+1&&a.bottom<=value.physical.height+1,'App remains inside physical viewport');return value;
}
async function inspectLayout(p){
  await settle(p);const viewport=await inspectViewport(p),layout=await p.evaluate(()=>{
    const board=document.getElementById('board'),guide=document.getElementById('guide-bar'),b=board.getBoundingClientRect(),g=guide.getBoundingClientRect();
    const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
    const visible=e=>Boolean(e.getClientRects().length)&&getComputedStyle(e).visibility!=='hidden';
    return {board:rect(board),guide:rect(guide),guideVisible:visible(guide),guideOverflow:guide.scrollHeight>guide.clientHeight+1||guide.scrollWidth>guide.clientWidth+1,overlap:visible(guide)&&Math.min(b.right,g.right)-Math.max(b.left,g.left)>1&&Math.min(b.bottom,g.bottom)-Math.max(b.top,g.top)>1,copy:[...guide.querySelectorAll('#guide-heading,#guide-text,#guide-note')].filter(visible).map(e=>({id:e.id,clipped:e.scrollHeight>e.clientHeight+1||e.scrollWidth>e.clientWidth+1,text:e.textContent})),targets:[...board.querySelectorAll('.node-hit,.node-symbol')].map(e=>({id:e.closest('[data-node]').dataset.node,kind:e.classList.contains('node-hit')?'hit':'art',...rect(e)})),actions:[...guide.querySelectorAll('button')].filter(visible).map(e=>({id:e.id,...rect(e)}))};
  });
  assert.equal(layout.overlap,false,'Instructions do not cover the field');
  if(layout.guideVisible){assert.equal(layout.guideOverflow,false,'Guide content fits');for(const text of layout.copy)assert.equal(text.clipped,false,text.id+' is not clipped');for(const action of layout.actions)assert(action.height>=43,action.id+' retains a 44px touch height');}
  for(const target of layout.targets){const b=layout.board;assert(target.left>=b.left-1&&target.right<=b.right+1&&target.top>=b.top-1&&target.bottom<=b.bottom+1,target.kind+' '+target.id+' fits field');if(target.kind==='hit')assert(target.width>=43&&target.height>=43,target.id+' retains 44px interaction area');}
  const art=layout.targets.filter(t=>t.kind==='art');for(let i=0;i<art.length;i++)for(let j=i+1;j<art.length;j++)assert(Math.min(art[i].right,art[j].right)-Math.max(art[i].left,art[j].left)<=1||Math.min(art[i].bottom,art[j].bottom)-Math.max(art[i].top,art[j].top)<=1,'Practice symbols '+art[i].id+' and '+art[j].id+' remain separate');
  return {...layout,viewport};
}
async function finishPlayback(p){
  await monitorPlayback(p);await p.locator('#play').click();await p.waitForFunction(()=>window.tutorialProbe?.session?.run,null,{timeout:3000});
  await p.waitForFunction(()=>document.getElementById('play').dataset.state==='stopped',null,{timeout:9500});await settle(p);await inspectViewport(p);await verifyPlaybackLayout(p);
}
async function monitorPlayback(p){await p.evaluate(()=>{
  const probe=window.tutorialProbe,s=probe?.session;if(!s?.guide||s.guide.mode!=='challenge'||!s.challenge.practice)return;
  const cards=()=>Object.fromEntries([...document.querySelectorAll('.edge:not(.candidate) .edge-label-card')].map(e=>{const r=e.getBoundingClientRect();return[e.closest('[data-edge]').dataset.edge,{x:r.x,y:r.y,width:r.width,height:r.height}];}));
  const board=document.getElementById('board');const m=probe.monitor={initial:cards(),initialBoard:{width:board.clientWidth,height:board.clientHeight},fitStart:probe.runningFits.length,frames:0,maxDelta:0,moved:[],active:false};
  const frame=()=>{if(probe.monitor!==m)return;const state=document.getElementById('play').dataset.state;if(state==='running'||state==='paused')m.active=true;if(m.active&&state==='stopped')return;
    if(m.active){m.frames++;const signature=s.run?.records.length;if(signature!==m.lastRecords){m.lastRecords=signature;const current=cards();for(const [id,before]of Object.entries(m.initial)){const after=current[id];if(!after)continue;const delta=Math.max(...['x','y','width','height'].map(k=>Math.abs(before[k]-after[k])));m.maxDelta=Math.max(m.maxDelta,delta);if(delta>1&&m.moved.length<20)m.moved.push({id,delta,time:s.run?.format(),state});}}}
    requestAnimationFrame(frame);
  };requestAnimationFrame(frame);
});}
async function verifyPlaybackLayout(p){const m=await p.evaluate(()=>{const p=window.tutorialProbe;if(!p.monitor)return null;return {...p.monitor,runningFits:p.runningFits.slice(p.monitor.fitStart)};});if(!m)return null;m.initialFits=m.runningFits.filter(f=>f.time==='0'&&(f.inResize||f.inRender)&&Math.abs(f.width-m.initialBoard.width)<=1&&Math.abs(f.height-m.initialBoard.height)<=1&&m.maxDelta<=1);m.processingFits=m.runningFits.filter(f=>!m.initialFits.includes(f));assert.equal(m.processingFits.length,0,'Fixed practice does not refit time cards on processing-state changes');assert.equal(m.moved.length,0,'Fixed practice time cards stay in place through actual arrivals');assert(m.frames>0,'Time-card stability observed during live playback');return m;}
async function removeWire(p,id){
  const point=await p.locator(`.edge:not(.candidate)[data-edge="${id}"] .edge-line`).evaluate(line=>{
    const matrix=line.getScreenCTM(),length=line.getTotalLength(),nodes=[...document.querySelectorAll('#board .node-hit')].map(e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,r:Math.max(r.width,r.height)/2+8};});
    for(const fraction of [.5,.65,.35,.75,.25,.85,.15]){const p=line.getPointAtLength(length*fraction).matrixTransform(matrix);if(nodes.every(n=>Math.hypot(p.x-n.x,p.y-n.y)>n.r))return{x:p.x,y:p.y};}
    throw Error('No wire-only long-press point outside part hit areas');
  });
  await p.mouse.move(point.x,point.y);await p.mouse.down();try{await p.waitForFunction(()=>document.getElementById('wire-delete-toast').open,null,{timeout:2000});}finally{await p.mouse.up();}
  await settle(p);assert.equal(await p.locator('.tutorial-demonstration').count(),0,'Delete confirmation pauses demonstration');await p.locator('#wire-delete-ok').click();await p.waitForFunction(id=>!document.querySelector(`.edge:not(.candidate)[data-edge="${id}"]`),id);
}
async function setTime(p,value){await p.locator('[data-node="A"] .node-hit').dblclick();await p.getByRole('button',{name:'時間',exact:true}).click();await p.getByRole('textbox',{name:'秒数'}).fill(value);await p.getByRole('button',{name:'確定',exact:true}).click();}
async function nextLesson(p){
  if(await p.locator('#guide-next').isVisible())await p.locator('#guide-next').click();
  else{await p.locator('#hint').click();await p.getByRole('button',{name:'響きをつなぐ',exact:true}).click();}
  await p.locator('[data-node="G3"]').waitFor({state:'visible'});await settle(p);
}
async function demoCheck(p,reduced){
  await p.locator('.tutorial-demonstration').waitFor({state:'attached'});const value=await p.locator('.tutorial-demonstration').evaluate(e=>({pointerEvents:getComputedStyle(e).pointerEvents,still:e.classList.contains('is-still'),motion:e.querySelectorAll('animateMotion,animate').length,animations:e.getAnimations({subtree:true}).filter(a=>a.playState==='running').length}));
  assert.equal(value.pointerEvents,'none','Demonstration cannot intercept input');assert.equal(value.still,reduced);if(reduced)assert.equal(value.motion,0,'Reduced setting uses a still demonstration');else assert(value.motion>0,'Normal setting shows the drag gesture');
  const {a}=await wiringBounds(p,'S','A');await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();assert.equal(await p.locator('.tutorial-demonstration').count(),0,'Real gesture immediately removes demonstration');await p.mouse.up();await settle(p);
  return value;
}
async function visibilityRecovery(p){
  const before=await p.evaluate(()=>({step:window.tutorialProbe.session.guide.step,edges:window.tutorialProbe.session.circuit.edges.length}));
  await p.evaluate(()=>{window.tutorialOwnHidden=Object.getOwnPropertyDescriptor(document,'hidden');Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await settle(p);assert.equal(await p.locator('.tutorial-demonstration').count(),0,'A hidden document removes demonstration');
  await p.evaluate(()=>{if(window.tutorialOwnHidden)Object.defineProperty(document,'hidden',window.tutorialOwnHidden);else delete document.hidden;delete window.tutorialOwnHidden;document.dispatchEvent(new Event('visibilitychange'));});
  await p.locator('.tutorial-demonstration').waitFor({state:'attached'});await settle(p);
  assert.deepEqual(await p.evaluate(()=>({step:window.tutorialProbe.session.guide.step,edges:window.tutorialProbe.session.circuit.edges.length})),before,'Visibility does not complete a lesson or edit the circuit');
  return {method:'Synthetic document.hidden getter with real visibilitychange events; no Session mutations',restored:true};
}
async function readFullGuide(p){
  const expected=await p.locator('#guide-note').textContent();await p.locator('#hint').click();await settle(p);assert.equal(await p.locator('.tutorial-demonstration').count(),0,'Full guide dialog removes demonstration');
  let text='',pages=0;
  for(;pages<20;pages++){
    await inspectViewport(p);text+=(await p.locator('#dialog-body .detail-value').allTextContents()).join('');
    const next=p.locator('#dialog-body .pager button').last();if(!await next.count()||await next.isDisabled())break;await next.click();await settle(p);
  }
  assert(text.includes(expected),'Supplement hidden by short viewport remains reachable in full guide');assert(text.includes('100点'));assert(pages<20,'Full guide pagination terminates');
  await p.locator('#dialog-close').click();await settle(p);return {pages:pages+1,fullText:text};
}
async function instrument(p){
  await p.evaluate(async profiling=>{
    const base=document.querySelector('script[type=module]').src,{Chime}=await import(new URL('./audio.js',base)),{Session}=await import(new URL('../app/session.js',base)),{Board}=await import(new URL('./board.js',base)),app=await import(base);
    const probe=window.tutorialProbe={strikes:[],rings:[],runningFits:[],resizeDepth:0,renderDepth:0,capable:Boolean(window.AudioContext||window.webkitAudioContext),inspectPerformance:app.inspectPerformance};
    const begin=Session.prototype.beginGuide;Session.prototype.beginGuide=function(...args){probe.session=this;return begin.apply(this,args);};
    const strike=Chime.prototype.strike;Chime.prototype.strike=function(...args){probe.strikes.push({frequency:args[0]?.frequencyHz??null,at:performance.now()});return strike.apply(this,args);};
    const ring=Chime.prototype.ring;Chime.prototype.ring=function(...args){const before=new Set(this.voices),value=ring.apply(this,args);for(const voice of this.voices)if(!before.has(voice)&&voice.frequencyHz!==undefined)probe.rings.push({frequency:voice.frequencyHz,time:voice.time,endTime:voice.endTime});return value;};
    const render=Board.prototype.render;Board.prototype.render=function(...args){probe.renderDepth++;try{return render.apply(this,args);}finally{probe.renderDepth--;}};const resize=Board.prototype.resize;Board.prototype.resize=function(...args){probe.resizeDepth++;try{return resize.apply(this,args);}finally{probe.resizeDepth--;}};const fit=Board.prototype.fitTimeLabels;Board.prototype.fitTimeLabels=function(...args){const s=this.session;if(s?.guide?.mode==='challenge'&&s.challenge.practice&&s.run?.status==='running')probe.runningFits.push({step:s.guide.step,time:s.run.format(),inResize:probe.resizeDepth>0,inRender:probe.renderDepth>0,stack:new Error().stack,width:this.element.clientWidth,height:this.element.clientHeight});return fit.apply(this,args);};
    if(profiling){
      const {TutorialGuide}=await import(new URL('./tutorial-guide.js',base)),stack=[];
      const profile=probe.profile={stats:{},slow:[],boundary:'Prototype wrappers preserve methods, arguments, return values and thresholds; exclusive times subtract nested instrumented calls.'};
      for(const [type,prototype,methods]of [['Board',Board.prototype,['render','particles','fitTimeLabels','renderArrivals','updateGoalMarkers','placeConstellations','transform','resize','liftLayout']],['TutorialGuide',TutorialGuide.prototype,['update','highlight','drawDemo']]])for(const name of methods){
        const original=prototype[name];if(typeof original!=='function')continue;const key=type+'.'+name;
        prototype[name]=function(...args){const timer={start:performance.now(),children:0};stack.push(timer);try{return original.apply(this,args);}finally{const wall=performance.now()-timer.start,own=Math.max(0,wall-timer.children);stack.pop();if(stack.length)stack.at(-1).children+=wall;const stat=profile.stats[key]??={calls:0,wall:0,own:0,maxWall:0,maxOwn:0};stat.calls++;stat.wall+=wall;stat.own+=own;stat.maxWall=Math.max(stat.maxWall,wall);stat.maxOwn=Math.max(stat.maxOwn,own);if(wall>=20&&profile.slow.length<250){const s=probe.session;profile.slow.push({method:key,wall,own,step:s?.guide?.step,status:s?.run?.status,pauseReason:s?.run?.pauseReason,time:s?.run?.format()});}}};
      }
    }
  },Boolean(arg('--profile')));
}

(async()=>{try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await pw[engine].launch({headless:true});
  for(const c of scenarios.filter(c=>!arg('--cases')||arg('--cases').split(',').includes(c.name))){
    report.step=c.name;const context=await browser.newContext({viewport:{width:c.width,height:c.height},isMobile:!c.desktop,hasTouch:!c.desktop}),p=await context.newPage();currentPage=p;const errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.addInitScript(options=>{Math.random=()=>.5;localStorage.setItem('prism-notes.motion.v1',JSON.stringify({version:1,value:options.reduced?'reduce':'full'}));if(options.fastReplay)localStorage.setItem('prism-notes.result-timing.v1',JSON.stringify({version:1,clearMs:0,failureMs:0}));},{reduced:Boolean(c.reduced),fastReplay:Boolean(c.recovery)});
    await p.goto(arg('--url')||`http://127.0.0.1:${server.address().port}/`);await p.locator('#board [data-node="S"]').waitFor({state:'attached'});assert.equal(await p.locator('meta[name="prism-version"]').getAttribute('content'),version);
    if(c.font)await p.evaluate(font=>{document.documentElement.style.fontSize=font+'px';dispatchEvent(new Event('resize'));},c.font);
    await settle(p);await inspectViewport(p);await instrument(p);await p.locator(c.free?'#title-free':'#title-resume').click();await settle(p);
    if(c.free)await setTime(p,'0.7');else await dragConnection(p,'S','A');const before=await snapshot(p);
    await startGuide(p);await settle(p);const layouts=[await inspectLayout(p)];
    if(c.free){
      await finishPlayback(p);assert.equal(await p.locator('#guide-count').textContent(),'2 / 4');await removeWire(p,'SA');await dragConnection(p,'S','A');await setTime(p,'1.5');await p.locator('#play').click();
    }else{
      const demonstration=await demoCheck(p,Boolean(c.reduced));if(c.recovery)c.visibility=await visibilityRecovery(p);await p.screenshot({path:path.join(out,c.name+'-start.png')});
      for(const [from,to]of c.alternate?[['S','A'],['A','B'],['B','G']]:[['S','A'],['A','G']])await dragConnection(p,from,to);
      if(c.alternate){await settle(p);assert.equal(await p.locator('#play').evaluate(e=>e.classList.contains('tutorial-target')),true,'A complete alternative first route asks the learner to play');assert.match(await p.locator('#guide-text').textContent(),/鐘を鳴らす/);}
      await finishPlayback(p);assert.equal(await p.locator('#guide-count').textContent(),'2 / 6');assert.equal(await p.locator('#tutorial-clear-finish').isVisible(),false,'The first bell is not the whole tutorial');
      await removeWire(p,c.alternate?'BG':'AG');assert.equal(await p.locator('#guide-count').textContent(),'3 / 6');await settle(p);
      const choosingSize=await p.locator('#board').evaluate(e=>({width:e.clientWidth,height:e.clientHeight}));
      if(c.recovery){
        await dragConnection(p,'A','B');await dragConnection(p,'A','C');await settle(p);assert.match(await p.locator('#guide-heading').textContent(),/1本消して/);assert.equal(await p.locator('.edge[data-edge="AC"]').evaluate(e=>e.classList.contains('tutorial-target')),true,'Over-budget recovery identifies the spare line');await removeWire(p,'AC');await dragConnection(p,'B','G');
      }else for(const [from,to]of c.alternate?[['A','G']]:[['A','B'],['B','G']]){await dragConnection(p,from,to);await settle(p);const size=await p.locator('#board').evaluate(e=>({width:e.clientWidth,height:e.clientHeight}));assert(Math.abs(size.width-choosingSize.width)<=1&&Math.abs(size.height-choosingSize.height)<=1,'Choosing a wire does not add/remove a guide row or resize the field');}
      await finishPlayback(p);assert.equal(await p.locator('#guide-count').textContent(),'4 / 6');layouts.push(await inspectLayout(p));
      if(c.recovery){
        const oldKeys=await p.locator('[data-arrival-key]').evaluateAll(elements=>elements.map(e=>e.dataset.arrivalKey));assert(oldKeys.length>0,'Zero-wait replay begins while prior arrival art is still visible');
        await monitorPlayback(p);await p.locator('#play').click();await p.waitForFunction(()=>document.getElementById('play').dataset.state==='running',null,{timeout:3000});
        assert.equal(await p.locator('[data-arrival-key]').count(),0,'New practice run clears previous transient arrival art');assert.equal(await p.locator('#guide-count').textContent(),'3 / 6','Replaying the comparison waits for its own arrival');
        await p.waitForFunction(()=>document.getElementById('play').dataset.state==='stopped',null,{timeout:7000});await settle(p);await inspectViewport(p);await verifyPlaybackLayout(p);assert.equal(await p.locator('#guide-count').textContent(),'4 / 6');
        c.fastReplay={waitMs:0,previousArt:oldKeys.length,oldArtCleared:true,newArrivalRequired:true};
      }
      const comparison=await p.evaluate(()=>({first:window.tutorialProbe.session.guide.firstResult,second:window.tutorialProbe.session.guide.comparison}));
      assert.equal(comparison.first.time,c.alternate?'2.5':'4');assert.equal(comparison.second.time,c.alternate?'4':'2.5');
      if(c.recovery)c.fullGuide=await readFullGuide(p);
      await p.locator('#records').click();await p.locator('#record-list .record-row').first().waitFor({state:'visible'});await settle(p);await inspectViewport(p);assert.equal(await p.locator('.tutorial-demonstration').count(),0,'Reading records pauses demonstration');assert.equal(await p.locator('#dialog').evaluate(e=>e.open),false);
      await p.locator('#close-records').click();assert.equal(await p.locator('#guide-count').textContent(),'5 / 6');await nextLesson(p);layouts.push(await inspectLayout(p));
      for(const [from,to]of [['S','A'],['A','B'],['A','C'],['B','G1'],['B','G2'],['C','G3']])await dragConnection(p,from,to);
      await p.screenshot({path:path.join(out,c.name+'-branch.png')});const strikeStart=await p.evaluate(()=>window.tutorialProbe.strikes.length);
      await monitorPlayback(p);await p.locator('#play').click();await p.waitForFunction(()=>document.getElementById('play').dataset.state==='running',null,{timeout:3000});assert.equal(await p.locator('.tutorial-demonstration').count(),0,'Actual playback has no gesture demonstration');
      await p.waitForFunction(()=>window.tutorialProbe.session.run.arrivals().length===3,null,{timeout:6000});
      const sound=await p.evaluate(start=>({capable:window.tutorialProbe.capable,arrivals:window.tutorialProbe.session.run.arrivals().map(e=>({node:e.node,time:e.time})),strikes:window.tutorialProbe.strikes.slice(start),rings:window.tutorialProbe.rings.slice(-3)}),strikeStart);
      assert.deepEqual(sound.arrivals,[{node:'G1',time:'2'},{node:'G2',time:'2.5'},{node:'G3',time:'3'}]);assert.equal(sound.strikes.length,3);
      const f=sound.strikes.map(s=>s.frequency);assert(Math.abs(f[1]/f[0]-2**(7/12))<1e-9);assert(Math.abs(f[2]/f[0]-2)<1e-9);
      if(sound.capable){assert.equal(sound.rings.length,3);for(let i=0;i<3;i++)assert(Math.abs(sound.rings[i].frequency/f[i]-1)<1e-9,'Native bell voice uses requested pitch');}
      c.playbackLayout=await verifyPlaybackLayout(p);c.demonstration=demonstration;c.comparison=comparison;c.sound=sound;
    }
    await p.locator('#tutorial-clear-finish').waitFor({state:'visible',timeout:9000});await settle(p);const viewport=await inspectViewport(p);
    assert.equal(await p.locator('#dialog-title').textContent(),'チュートリアルクリア！');assert.equal(await p.locator('.tutorial-demonstration').count(),0,'Completion leaves no gesture overlay');
    assert.equal(await p.locator('#tutorial-clear-time').textContent(),c.free?'3秒':c.alternate?'2.5秒 → 4秒':'4秒 → 2.5秒');
    if(!c.free){assert.equal(await p.locator('#tutorial-clear-score').textContent(),c.alternate?'81.25点':'100.00点');assert.deepEqual(await p.locator('.tutorial-melody>div>span').allTextContents(),['2秒','2.5秒','3秒']);}
    assert.match(await p.locator('#tutorial-score-explanation').textContent(),/クリア条件.*短い時間.*高得点.*最速.*100点/);assert.equal(await p.evaluate(()=>localStorage.getItem('prism-notes.guides.v1')),null,'No premature completion history');
    const dialog=await p.locator('#dialog').evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,overflow:e.scrollWidth>e.clientWidth+1};});assert(dialog.left>=-1&&dialog.top>=-1&&dialog.right<=c.width+1&&dialog.bottom<=c.height+1);assert.equal(dialog.overflow,false);
    await p.screenshot({path:path.join(out,c.name+'-clear.png')});
    if(c.saveFailure){await p.evaluate(()=>{window.tutorialSavedSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='prism-notes.guides.v1')throw Error('Synthetic guide save failure');return window.tutorialSavedSetItem.call(this,k,v);};});await p.locator('#tutorial-clear-finish').click();assert.notEqual(await p.locator('#dialog-error').textContent(),'');assert.equal(await p.locator('#dialog').evaluate(e=>e.open),true);await p.evaluate(()=>{Storage.prototype.setItem=window.tutorialSavedSetItem;delete window.tutorialSavedSetItem;});}
    await p.locator('#tutorial-clear-finish').click();await settle(p);await inspectViewport(p);assert.deepEqual(await snapshot(p),before,'Original circuit, times, scores and saved circuits restored');assert.equal(await p.locator('.tutorial-demonstration').count(),0);assert.equal(await p.locator('#guide-bar').isVisible(),false);
    assert.equal(await p.evaluate(mode=>JSON.parse(localStorage.getItem('prism-notes.guides.v1')).value[mode],c.free?'free':'challenge'),'completed');assert.deepEqual(errors,[]);
    report.cases.push({name:c.name,passed:true,layouts,completionViewport:viewport,before,after:await snapshot(p),demonstration:c.demonstration,comparison:c.comparison,sound:c.sound,visibility:c.visibility,fullGuide:c.fullGuide,fastReplay:c.fastReplay,playbackLayout:c.playbackLayout,profile:await p.evaluate(()=>window.tutorialProbe?.profile),saveFailureRecovered:Boolean(c.saveFailure)});console.log(c.name+' passed');await context.close();currentPage=null;
  }
  report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(report.step,error.stack);if(currentPage){try{report.diagnostic=await currentPage.evaluate(()=>({heading:document.getElementById('guide-heading')?.textContent,count:document.getElementById('guide-count')?.textContent,copy:document.getElementById('guide-text')?.textContent,play:document.getElementById('play')?.outerHTML,error:document.getElementById('dialog-error')?.textContent,guide:window.tutorialProbe?.session?.guide?{step:window.tutorialProbe.session.guide.step,ready:window.tutorialProbe.session.guide.readyToFinish}:null,run:window.tutorialProbe?.session?.run?{status:window.tutorialProbe.session.run.status,pauseReason:window.tutorialProbe.session.run.pauseReason,time:window.tutorialProbe.session.run.format(),arrivals:window.tutorialProbe.session.run.arrivals().map(e=>({node:e.node,time:e.time})),edges:window.tutorialProbe.session.run.circuit.raw.edges.map(e=>e.id)}:null,performance:window.tutorialProbe?.inspectPerformance?.(),profile:window.tutorialProbe?.profile,runningFits:window.tutorialProbe?.runningFits,monitor:window.tutorialProbe?.monitor}));await currentPage.screenshot({path:path.join(out,'failed.png')});}catch{}}}
finally{report.runner.memory=process.memoryUsage();report.runner.cpu=process.cpuUsage();await browser?.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}})();
