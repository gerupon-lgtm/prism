// Await each asynchronous predicate result explicitly. waitForFunction tests
// the returned Promise for truthiness before adopting its resolved value.
async function waitForAsync(page,predicate,arg,{timeout=15000}={}) {
  const deadline=performance.now()+timeout;
  const expired=()=>new Error('Asynchronous browser condition did not become ready');
  while(true){
    const remaining=deadline-performance.now();if(remaining<=0)throw expired();
    let timer,result;
    try{result=await Promise.race([page.evaluate(predicate,arg),new Promise((_,reject)=>{timer=setTimeout(()=>reject(expired()),remaining);})]);}
    finally{clearTimeout(timer);}
    if(performance.now()>=deadline)throw expired();if(result)return result;
    await page.waitForTimeout(Math.min(100,deadline-performance.now()));
  }
}
// ResizeObserver can replace SVG nodes between separate locator calls.
// Read both targets together after their geometry is stable; never skip a drag.
async function wiringBounds(page,from,to) {
  return waitForAsync(page,async({from,to})=>{
    await document.fonts.ready;let previous=null,stable=0;
    for(let frame=0;frame<60;frame++){
      await new Promise(requestAnimationFrame);
      const measure=id=>{const node=document.querySelector('[data-node="'+id+'"] .node-hit');if(!node)return null;const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
      const a=measure(from),b=measure(to),current=JSON.stringify({a,b});
      stable=a?.width>0&&a.height>0&&b?.width>0&&b.height>0?(current===previous?stable+1:1):0;previous=current;
      if(stable===3)return {a,b,frames:frame+1};
    }
    throw new Error('Wiring targets did not stabilize in 60 frames');
  },{from,to},{timeout:5000});
}
// Enter through the actual title controls; no hidden query or bypass flag.
async function enterApp(page) {
  if(!await page.locator('#title-screen').count())return; // Worker recovery HTML has no app.
  await page.locator('#board [data-node="S"]').waitFor({state:'attached'});
  if(await page.locator('#title-screen').isVisible())await page.locator('#title-resume').click();
}
async function startGuide(page) {
  await page.locator('#board [data-node="S"]').waitFor({state:'attached'});
  if(await page.locator('#title-screen').isVisible())await page.locator('#title-tutorial').click();
  else if(!await page.locator('#guide-skip').isVisible()){
    await page.locator('#menu').click();await page.getByRole('button',{name:'操作の案内',exact:true}).click();
  }
}
async function skipGuide(page) {await startGuide(page);await page.locator('#guide-skip').click();}
async function startAndPause(page) {
  // Pause on the actual UI state change, before the next animation frame.
  // An unreachable trial is already paused when its simulation is constructed.
  // That completed result also passes here after the launch prelude.
  await page.evaluate(()=>{window.__pausedAfterLaunch=false;const play=document.getElementById('play'),observer=new MutationObserver(()=>{if(play.dataset.state==='running'||play.dataset.state==='paused'){observer.disconnect();if(play.dataset.state==='running')play.click();window.__pausedAfterLaunch=play.dataset.state==='paused';}});observer.observe(play,{attributes:true,attributeFilter:['data-state']});});
  await page.locator('#play').click();
  try{await page.waitForFunction(()=>window.__pausedAfterLaunch,null,{timeout:5000});}
  catch(error){const state=await page.evaluate(()=>({play:document.getElementById('play').outerHTML,hint:document.getElementById('hint').textContent,error:document.getElementById('dialog-error').textContent,edges:[...document.querySelectorAll('.edge:not(.candidate)')].map(e=>e.dataset.edge)}));throw new Error('Start did not reach running: '+JSON.stringify(state),{cause:error});}
  await page.waitForFunction(()=>document.getElementById('play').dataset.state==='paused');
}
async function chooseChallenge(page,id) {
  // Helpers take stable IDs. The human-facing Q number can move across sets.
  const number=await page.evaluate(async id=>{const {challenges}=await import(new URL('../content/challenges.js',document.querySelector('script[type=module]').src));const c=challenges.find(c=>c.id===id);return c?.number??Number(id.slice(1));},id);
  await page.locator('#dialog-body .dialog-list button').first().waitFor({state:'visible'});
  for(let n=0;n<30;n++){
    const item=page.locator(`[data-challenge="${id}"]`);if(await item.count()){await item.click();return;}
    const names=await page.locator('#dialog-body .dialog-list button').allTextContents(),first=names.map(name=>/^Q(\d+) /.exec(name)).find(Boolean);
    const pager=page.locator('#dialog-body .pager button'),next=first&&number<Number(first[1])?pager.first():pager.last();if(await next.isDisabled())break;
    await next.click();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  }
  throw new Error('Challenge not available in selector: '+id+' '+await page.locator('#dialog-body').innerText());
}
async function selectChallenge(page,id){await page.locator('#home').click();await chooseChallenge(page,id);}
async function setSound(page,enabled){
  if(await page.locator('#sound').getAttribute('aria-pressed')!==String(enabled))await page.locator('#sound').click();
  await page.waitForFunction(enabled=>document.getElementById('sound').getAttribute('aria-pressed')===String(enabled),enabled);
}
async function challengeSolution(page,id,{partial=false}={}){
  const problem=await page.locator('#app').getAttribute('data-problem-id');
  if(!problem)return require('./challenge_fixtures.cjs')[id];
  const fs=require('node:fs'),path=require('node:path');
  const proof=JSON.parse(fs.readFileSync(path.join(__dirname,'ランダム課題/generation.json'),'utf8'));
  const row=proof.stages.find(item=>item.challenge===id&&item.id===problem);
  if(!row)throw new Error('No verified fixture for visible problem '+id+' '+problem);
  return partial?row.partial.edges:row.winner;
}
async function dragConnection(page,from,to){
  const {a,b}=await wiringBounds(page,from,to),start={x:a.x+a.width/2,y:a.y+a.height/2},end={x:b.x+b.width/2,y:b.y+b.height/2};
  const geometry=await page.locator('#board').evaluate((board,{from,to})=>{
    const box=board.getBoundingClientRect();
    return {box:{left:box.left,right:box.right,top:box.top,bottom:box.bottom},others:[...board.querySelectorAll('[data-node] .node-hit')].filter(e=>![from,to].includes(e.closest('[data-node]').dataset.node)).map(e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})};
  },{from,to});
  const distance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);};
  const clear=points=>geometry.others.every(p=>points.slice(1).every((b,i)=>distance(p,points[i],b)>34));
  let route=[start,end];
  if(!clear(route)){
    const dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy),box=geometry.box;
    const choices=[40,-40,70,-70,100,-100,140,-140].map(offset=>[start,{x:(start.x+end.x)/2-dy/length*offset,y:(start.y+end.y)/2+dx/length*offset},end]);
    route=choices.find(points=>points.slice(1,-1).every(p=>p.x>box.left+8&&p.x<box.right-8&&p.y>box.top+8&&p.y<box.bottom-8)&&clear(points));
    if(!route)throw new Error('No fixture drag route avoiding intermediate nodes '+from+' -> '+to);
  }
  await page.mouse.move(start.x,start.y);await page.mouse.down();for(const point of route.slice(1))await page.mouse.move(point.x,point.y,{steps:10});await page.mouse.up();
}
async function holdWire(page,id){
  const point=await page.locator(`.edge:not(.candidate)[data-edge="${id}"] .edge-line`).evaluate(line=>{const p=line.getPointAtLength(line.getTotalLength()*.35).matrixTransform(line.getScreenCTM());return {x:p.x,y:p.y};});
  await page.mouse.move(point.x,point.y);await page.mouse.down();try{await page.waitForFunction(()=>document.getElementById('wire-delete-toast').open,null,{timeout:2000});}finally{await page.mouse.up();}
}
module.exports={waitForAsync,wiringBounds,enterApp,startGuide,skipGuide,startAndPause,chooseChallenge,selectChallenge,setSound,challengeSolution,dragConnection,holdWire};
