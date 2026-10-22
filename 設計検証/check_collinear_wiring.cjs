// Exercise real pointer input and SVG paint order where a long candidate
// overlaps the user's shorter connected route. No personal browser data.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {enterApp,selectChallenge,dragConnection,wiringBounds,startAndPause}=require('./browser_wait.cjs');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),root=path.resolve('dist'),version=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version;
const engine=arg('--engine')||'chromium',scenario=arg('--case')||'scene',desktop=process.argv.includes('--desktop'),out=path.resolve('設計検証/重なる候補線',version,arg('--url')?new URL(arg('--url')).hostname:'local',engine,scenario+(desktop?'-desktop':''));
fs.mkdirSync(out,{recursive:true});
const previous=path.join(out,'report.json');if(fs.existsSync(previous)&&!JSON.parse(fs.readFileSync(previous)).passed)fs.copyFileSync(previous,path.join(out,`failed-${Date.now()}.json`));
const report={version,scenario,desktop,engine,checks:[],passed:false,evidence:'Disposable PC browser. Phone viewport is synthetic; Chromium uses touch input for D to bell. Not a physical phone.'};
const server=http.createServer((req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===root)file=path.join(root,'index.html');if(!file.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.ttf':'font/ttf'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
(async()=>{let browser;try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await pw[engine].launch({headless:true});
  const p=await browser.newPage({viewport:desktop?{width:1600,height:1000}:{width:390,height:844},isMobile:!desktop,hasTouch:!desktop}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{Math.random=()=>6.5/8;});await p.goto(arg('--url')||`http://127.0.0.1:${server.address().port}/`);await enterApp(p);await selectChallenge(p,'Q11');
  assert.match(await p.locator('#title').textContent(),/^Q15 /);report.draw=await p.locator('#challenge-meta').count()?await p.locator('#challenge-meta').textContent():await p.locator('#title').textContent();
  if(scenario!=='minimal')for(const [from,to]of [['S','A'],['A','B'],['B','D'],['B','G']])await dragConnection(p,from,to);
  const before=await p.locator('.edge:not(.candidate)').count();
  if(engine==='chromium'){
    const {a,b}=await wiringBounds(p,'D','G'),start={x:a.x+a.width/2,y:a.y+a.height/2},end={x:b.x+b.width/2,y:b.y+b.height/2},cdp=await p.context().newCDPSession(p),finger=(x,y)=>({x,y,id:1,radiusX:5,radiusY:5,force:1});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger(start.x,start.y)]});
    for(let n=1;n<=10;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[finger(start.x+(end.x-start.x)*n/10,start.y+(end.y-start.y)*n/10)]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  }else await dragConnection(p,'D','G');
  assert.equal(await p.locator('[data-edge="DG"]:not(.candidate)').count(),1,'D to bell must accept the connection');assert.equal(await p.locator('.edge:not(.candidate)').count(),before+1);
  report.checks.push({label:'D to bell is connected by pointer input',passed:true});
  const paint=await p.locator('[data-edge="DG"] .edge-line').evaluate(line=>{
    const pt=line.getPointAtLength(line.getTotalLength()*.5).matrixTransform(line.getScreenCTM());
    const stack=document.elementsFromPoint(pt.x,pt.y).map(e=>({edge:e.closest('[data-edge]')?.dataset.edge,classes:e.getAttribute('class')})).filter(e=>e.edge);
    const groups=[...line.closest('#board-detail').querySelectorAll('[data-edge]')];
    return {point:{x:pt.x,y:pt.y},stack,order:groups.map(g=>({id:g.dataset.edge,candidate:g.classList.contains('candidate')})),built:[...document.querySelectorAll('.edge:not(.candidate)')].map(g=>g.dataset.edge)};
  });
  report.paint=paint;await p.screenshot({path:path.join(out,'wiring.png')});
  const top=paint.stack.find(item=>/edge-(line|core|backdrop|hit)/.test(item.classes||''));
  assert.equal(top?.edge,'DG','A long unconnected candidate must not cover the shorter connected D-to-bell route');
  report.checks.push({label:'Connected D-to-bell route is visible at its own midpoint',passed:true});
  const coveredCards=await p.locator('#board').evaluate(board=>{
    const cards=[...board.querySelectorAll('.edge:not(.candidate) .edge-label:not([hidden])')].map(label=>({edge:label.closest('[data-edge]').dataset.edge,box:label.getBoundingClientRect()})),covered=[];
    for(const line of board.querySelectorAll('.edge.candidate .edge-line'))for(let n=1;n<100;n++){
      const pt=line.getPointAtLength(line.getTotalLength()*n/100).matrixTransform(line.getScreenCTM());
      const card=cards.find(c=>pt.x>c.box.left+1&&pt.x<c.box.right-1&&pt.y>c.box.top+1&&pt.y<c.box.bottom-1);if(!card)continue;
      const top=document.elementsFromPoint(pt.x,pt.y).find(e=>e.closest('[data-edge]'))?.closest('[data-edge]');
      if(top?.classList.contains('candidate')){covered.push({card:card.edge,cover:top.dataset.edge});break;}
    }return covered;
  });
  report.coveredCards=coveredCards;assert.deepEqual(coveredCards,[],'Candidate lines must not cover a connected route time card');report.checks.push({label:'Connected route cards remain above candidate lines',passed:true});
  for(const [id,part,direct,output]of [['Q11','D','AG','G'],['Q12','F','AG','G'],['Q45','D','AG2','G2']]){
    if(id!=='Q11')await selectChallenge(p,id);
    const geometry=await p.locator('#board').evaluate((board,{part,direct})=>{
      const line=board.querySelector(`[data-edge="${direct}"] .edge-line`),hit=board.querySelector(`[data-node="${part}"] .node-hit`).getBoundingClientRect(),center={x:hit.x+hit.width/2,y:hit.y+hit.height/2};
      const clearance=path=>{let gap=Infinity;for(let n=0;n<=100;n++){const at=path.getPointAtLength(path.getTotalLength()*n/100).matrixTransform(path.getScreenCTM());gap=Math.min(gap,Math.hypot(at.x-center.x,at.y-center.y));}return gap;};
      const unrelated=[...board.querySelectorAll('.edge-line')].filter(path=>{const id=path.closest('[data-edge]').dataset.edge;return ![...board.querySelectorAll(`[data-node="${part}"]`)].some(()=>id.startsWith(part)||id.endsWith(part));}).map(path=>({edge:path.closest('[data-edge]').dataset.edge,gap:clearance(path)}));
      const curved=[...board.querySelectorAll('.edge-line')].filter(path=>{const values=path.getAttribute('d').match(/-?[\d.]+/g).map(Number),[ax,ay,cx,cy,bx,by]=values;return Math.abs((bx-ax)*(cy-ay)-(by-ay)*(cx-ax))>1e-5;}).length;
      const field=board.getBoundingClientRect(),outside=[...board.querySelectorAll('.node-hit')].filter(node=>{const r=node.getBoundingClientRect();return r.left<field.left-1||r.right>field.right+1||r.top<field.top-1||r.bottom>field.bottom+1;}).map(node=>node.closest('[data-node]').dataset.node);
      return {gap:clearance(line),radius:Math.min(hit.width,hit.height)/2,curved,unrelated,outside};
    },{part,direct});
    (report.geometry??=[]).push({id,...geometry});assert(geometry.gap>=geometry.radius+6,`${id} direct route must pass outside ${part}'s touch region: ${JSON.stringify(geometry)}`);for(const route of geometry.unrelated)assert(route.gap>=geometry.radius+3,`${id} ${route.edge} must not pass through ${part}: ${JSON.stringify(geometry)}`);assert.equal(geometry.curved,0,'Light paths stay straight');assert.deepEqual(geometry.outside,[],'Parts remain inside the field');
    if(id!=='Q11'){await dragConnection(p,part,output);assert.equal(await p.locator(`[data-edge="${part+output}"]:not(.candidate)`).count(),1);}
    await p.screenshot({path:path.join(out,id+'-straight.png')});report.checks.push({label:id+' straight direct route bypasses the shifted part; output accepts a connection',passed:true,...geometry});
  }
  for(const id of ['Q35','Q44']){await selectChallenge(p,id);assert.equal(await p.locator('#challenge-goal').textContent(),'鐘に届ける');report.checks.push({label:id+' single-bell condition uses natural singular wording',passed:true});}
  for(const [from,to]of [['S','A'],['A','C'],['C','D'],['D','G']])await dragConnection(p,from,to);
  await startAndPause(p);await p.evaluate(async()=>{for(let n=0;n<512&&!document.getElementById('next').disabled;n++){document.getElementById('next').click();await new Promise(requestAnimationFrame);}});
  assert(await p.locator('#clear-toast').isVisible(),'Single-bell task reaches a successful result');assert.equal(await p.locator('#clear-time-label').textContent(),'到達時間');report.checks.push({label:'Single-bell success uses the singular arrival-time label',passed:true});
  assert.deepEqual(errors,[]);report.passed=true;console.log(JSON.stringify({version,scenario,engine,passed:true,checks:report.checks.length}));
}catch(error){report.failure=error.stack;console.error(error.stack);process.exitCode=1;}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));if(browser)await browser.close();await new Promise(r=>server.close(r));}})();
