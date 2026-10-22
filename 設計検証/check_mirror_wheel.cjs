const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chooseChallenge}=require('./browser_wait.cjs');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};
const pw=require(arg('--playwright-path')||'C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const engine=arg('--engine')||'chromium',channel=arg('--channel'),version=JSON.parse(fs.readFileSync('package.json')).version;
let url=arg('--url'),server;
const out=path.resolve('設計検証/鏡のホイール',version,url?new URL(url).hostname:'local',channel||engine);fs.mkdirSync(out,{recursive:true});
const report={passed:false,version,checks:[],pending:['Physical phone gestures and subjective usability']};
const check=label=>{report.checks.push(label);console.log(label);};
const gap=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
async function geometry(page){return page.evaluate(()=>{
  const dial=document.querySelector('[data-mirror-control="M"]');
  const face=document.querySelector('[data-mirror-face="M"]'),matrix=face.parentNode.getScreenCTM(),inverse=matrix.inverse();
  const origin=new DOMPoint().matrixTransform(face.getScreenCTM()).matrixTransform(inverse);
  const target=new DOMPoint().matrixTransform(document.querySelector('[data-node="C"]').getScreenCTM()).matrixTransform(inverse);
  const incident=Number(face.dataset.incident),surface=Number(face.dataset.surface),angle=Math.atan2(target.y-origin.y,target.x-origin.x);
  let delta=(angle+incident)/2-surface;while(delta>Math.PI/2)delta-=Math.PI;while(delta< -Math.PI/2)delta+=Math.PI;
  const m=dial.getScreenCTM(),scale=Math.hypot(m.a,m.b);
  return {surface,delta,cx:m.e,cy:m.f,rotation:Math.atan2(m.b,m.a),padRadius:Number(dial.querySelector('.mirror-control-pad').getAttribute('r'))*scale,trackRadius:Number(dial.querySelector('.mirror-control-track').getAttribute('r'))*scale};
});}
async function state(page){return page.evaluate(()=>({surface:Number(document.querySelector('[data-mirror-face="M"]').dataset.surface),target:document.querySelector('.mirror-optics')?.dataset.target}));}
async function input(page,touch){
  const cdp=touch?await page.context().newCDPSession(page):null;
  if(cdp)await page.evaluate(()=>{for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])document.addEventListener(type,event=>{window.__wheelPointer={type,x:event.clientX,y:event.clientY};},true);});
  const send=async(type,p)=>{
    await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{x:p.x,y:p.y,id:1,radiusX:4,radiusY:4}]:[]});
    await page.waitForFunction(({type,p})=>{const at=window.__wheelPointer;return at?.type===type&&(!p||Math.hypot(at.x-p.x,at.y-p.y)<2);},{type:{touchStart:'pointerdown',touchMove:'pointermove',touchEnd:'pointerup',touchCancel:'pointercancel'}[type],p});
  };
  return {down:async p=>{if(cdp)await send('touchStart',p);else{await page.mouse.move(p.x,p.y);await page.mouse.down();}},move:async p=>{if(cdp)await send('touchMove',p);else await page.mouse.move(p.x,p.y);},up:async()=>{if(cdp)await send('touchEnd');else await page.mouse.up();},cancel:async()=>{if(cdp)await send('touchCancel');else{await page.locator('#board').dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();}},close:async()=>cdp?.detach()};
}
(async()=>{
  if(!url){const root=path.resolve('dist');server=http.createServer((req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===root)file=path.join(root,'index.html');if(!file.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.ttf':'font/ttf'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url=`http://127.0.0.1:${server.address().port}/`;}
  const browser=await pw[engine].launch({headless:true,...(channel?{channel}:{})}),errors=[];
  try{
    for(const layout of [{name:'portrait',width:390,height:844,touch:true,angle:0},{name:'landscape',width:844,height:390,touch:true,angle:90},{name:'desktop',width:1440,height:900,touch:false,angle:0}]){
      const context=await browser.newContext({viewport:{width:layout.width,height:layout.height},hasTouch:layout.touch}),page=await context.newPage();page.on('pageerror',error=>errors.push(String(error)));
      if(layout.touch)await page.addInitScript(angle=>{const direction=new EventTarget();Object.defineProperties(direction,{angle:{value:angle},type:{value:angle?'landscape-primary':'portrait-primary'}});Object.defineProperty(screen,'orientation',{get:()=>direction});},layout.angle);
      await page.addInitScript(()=>{Math.random=()=>0;});await page.goto(url);await page.locator('#title-challenges').click();await chooseChallenge(page,'Q35');
      const controls=()=>page.locator('[data-node="M"]').press('Enter');
      const io=await input(page,layout.touch&&engine==='chromium');
      const clear=async()=>{if(await page.locator('.edge:not(.candidate)').count())await page.locator('#clear-wires').click();await controls();};
      try{
        // Start well away from the visible knob, including the opposite rim.
        for(const offset of [90,180,-90]){
          await clear();const g=await geometry(page),start=g.surface+g.rotation+offset*Math.PI/180;
          assert(Math.abs(g.padRadius-53)<.01&&Math.abs(g.trackRadius-32)<.01,'visible handle dimensions unchanged');
          const point=(angle,radius=32)=>({x:g.cx+radius*Math.cos(angle),y:g.cy+radius*Math.sin(angle)});
          const before=await state(page);await io.down(point(start));const placed=await state(page);
          assert(gap(before.surface,placed.surface)<1e-8&&placed.target==='','placing finger does not jump or select');
          const steps=Math.max(8,Math.ceil(Math.abs(g.delta)*180/Math.PI/3));for(let i=1;i<=steps;i++)await io.move(point(start+g.delta*i/steps));
          assert.equal((await state(page)).target,'C');assert.equal(await page.locator('.edge:not(.candidate)').count(),0);
          const after=await geometry(page);assert(Math.hypot(after.cx-g.cx,after.cy-g.cy)<.1,'wheel remains fixed: '+JSON.stringify({before:g,after}));
          await io.up();assert.equal(await page.locator('.edge:not(.candidate)[data-edge="MC"]').count(),1);assert(await page.locator('#mirror-controls').isHidden());
          check(`${layout.name}: rim ${offset}deg from knob rotates relatively, previews, and commits once`);
        }
        await clear();let g=await geometry(page),before=await state(page);
        const p=(angle,radius=32)=>({x:g.cx+radius*Math.cos(angle),y:g.cy+radius*Math.sin(angle)});
        await io.down(p(0));await io.move({x:g.cx,y:g.cy});await io.move(p(Math.PI));await io.up();
        assert(gap(before.surface,(await state(page)).surface)<1e-8);assert.equal(await page.locator('.edge:not(.candidate)').count(),0);check(`${layout.name}: crossing centre does not spin or confirm`);
        await io.down({x:g.cx,y:g.cy});await io.move(p(0));await io.up();assert(gap(before.surface,(await state(page)).surface)<1e-8);check(`${layout.name}: starting at centre waits for a new rim movement`);
        await clear();g=await geometry(page);before=await state(page);
        // Extend to the far side of the board while retaining real pointer capture.
        const heading=Math.atan2(layout.height/2-g.cy,layout.width/2-g.cx);
        const q=(angle,radius)=>({x:g.cx+radius*Math.cos(angle),y:g.cy+radius*Math.sin(angle)});
        await io.down(q(heading,32));await io.move(q(heading,80));await io.move(q(heading+.3,80));
        const outside=await state(page);assert(gap(before.surface,outside.surface)>.01,JSON.stringify({before,outside,g,heading}));assert.equal(await page.locator('.edge:not(.candidate)').count(),0);await io.cancel();assert(await page.locator('#mirror-controls').isHidden());assert.equal(await page.locator('.edge:not(.candidate)').count(),0);check(`${layout.name}: off-rim capture rotates and cancellation leaves wires unchanged`);
        await clear();await page.locator('#zoom-in').click();g=await geometry(page);const start=g.surface+g.rotation+Math.PI;
        const z=t=>({x:g.cx+32*Math.cos(start+g.delta*t),y:g.cy+32*Math.sin(start+g.delta*t)});
        await io.down(z(0));for(let i=1;i<=20;i++)await io.move(z(i/20));assert.equal((await state(page)).target,'C');await io.up();assert.equal(await page.locator('.edge:not(.candidate)[data-edge="MC"]').count(),1);check(`${layout.name}: zoom preserves screen-size wheel and rim interaction`);
        await page.screenshot({path:path.join(out,`${layout.name}.png`)});
      }catch(error){await page.screenshot({path:path.join(out,`${layout.name}-failure.png`)}).catch(()=>{});throw error;}
      finally{await io.close();await context.close();}
    }
    assert.deepEqual(errors,[]);check('No uncaught browser errors');report.passed=true;
  }catch(error){report.error=error.stack;throw error;}
  finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
