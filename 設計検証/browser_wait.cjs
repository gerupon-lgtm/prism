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
module.exports={waitForAsync,wiringBounds,enterApp,startGuide,skipGuide};
