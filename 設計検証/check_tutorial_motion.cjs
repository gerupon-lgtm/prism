// Observe real SVG motion, not merely the presence of animation elements.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const arg=name=>{const at=process.argv.indexOf(name);return at<0?null:process.argv[at+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),root=path.resolve('dist'),out=path.resolve(arg('--out')||'設計検証/チュートリアル体験-20261106/motion');
fs.mkdirSync(out,{recursive:true});const report={version:JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version,passed:false,cases:[],boundary:'Native SVG animation in desktop Chromium/WebKit. Reduced preference is supplied to the same browser storage/event route. Physical phone motion/listening are unverified.'};
const server=http.createServer((req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===root)file=path.join(root,'index.html');assert(file.startsWith(root+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.ttf':'font/ttf','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
const settle=p=>p.evaluate(async()=>{await document.fonts.ready;for(let n=0;n<4;n++)await new Promise(requestAnimationFrame);});
const point=p=>p.locator('.tutorial-demo-finger').evaluate(e=>{const at=new DOMPoint().matrixTransform(e.getScreenCTM());return {x:at.x,y:at.y};});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
(async()=>{let browser;try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 for(const engine of ['chromium','webkit']){
  browser=await pw[engine].launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),p=await context.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>localStorage.setItem('prism-notes.motion.v1',JSON.stringify({version:1,value:'full'})));
  await p.goto(arg('--url')||`http://127.0.0.1:${server.address().port}/`);await p.locator('#title-tutorial').click();await settle(p);
  await p.locator('.tutorial-demo-finger').waitFor({state:'attached'});const first=await point(p);await p.waitForTimeout(900);const second=await point(p);
  const animatedDistance=distance(first,second);assert(animatedDistance>3,engine+' finger actually advances');await p.screenshot({path:path.join(out,engine+'-animated.png')});
  await p.evaluate(()=>{const key='prism-notes.motion.v1';localStorage.setItem(key,JSON.stringify({version:1,value:'reduce'}));dispatchEvent(new StorageEvent('storage',{key}));});
  await p.locator('.tutorial-demonstration.is-still').waitFor({state:'attached'});await settle(p);assert.equal(await p.locator('.tutorial-demonstration animateMotion,.tutorial-demonstration animate').count(),0);
  const stillFirst=await point(p);await p.waitForTimeout(900);const stillSecond=await point(p);assert(distance(stillFirst,stillSecond)<.1,engine+' reduced illustration stays still');
  await p.screenshot({path:path.join(out,engine+'-reduced.png')});assert.deepEqual(errors,[]);
  report.cases.push({engine,passed:true,first,second,animatedDistance,stillFirst,stillSecond});console.log(engine+' motion and reduced mode passed');await context.close();await browser.close();browser=null;
 }report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(error.stack);}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}})();
