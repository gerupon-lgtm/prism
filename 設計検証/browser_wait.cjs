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
  await page.locator('#dialog-body .dialog-list button').first().waitFor({state:'visible'});
  for(let n=0;n<30;n++){
    const item=page.getByRole('button',{name:new RegExp('^'+id+' ')});if(await item.count()){await item.click();return;}
    const names=await page.locator('#dialog-body .dialog-list button').allTextContents(),first=names.map(name=>/^Q(\d+) /.exec(name)).find(Boolean);
    const pager=page.locator('#dialog-body .pager button'),next=first&&Number(id.slice(1))<Number(first[1])?pager.first():pager.last();if(await next.isDisabled())break;
    await next.click();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  }
  throw new Error('Challenge not available in selector: '+id+' '+await page.locator('#dialog-body').innerText());
}
async function selectChallenge(page,id){await page.locator('#home').click();await chooseChallenge(page,id);}
async function setSound(page,enabled){
  if(await page.locator('#sound').getAttribute('aria-pressed')!==String(enabled))await page.locator('#sound').click();
  await page.waitForFunction(enabled=>document.getElementById('sound').getAttribute('aria-pressed')===String(enabled),enabled);
}
module.exports={waitForAsync,wiringBounds,enterApp,startGuide,skipGuide,startAndPause,chooseChallenge,selectChallenge,setSound};
