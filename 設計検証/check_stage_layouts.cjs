const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chooseChallenge}=require('./browser_wait.cjs');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};
const pw=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const engine=arg('--engine')||'chromium',version=JSON.parse(fs.readFileSync('package.json')).version;
const out=path.resolve('設計検証/配置点検',arg('--label')||version,arg('--url')?new URL(arg('--url')).hostname:'local',engine);fs.mkdirSync(out,{recursive:true});
const layouts=(arg('--layouts')||'phone,short,landscape,desktop').split(','),shots=(arg('--shots')||'17').split(',').map(Number);
const report={version,engine,passed:false,layouts:[],pending:['Physical phones and subjective readability']};
const root=path.resolve('dist'),server=http.createServer((req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===root)file=path.join(root,'index.html');if(!file.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.ttf':'font/ttf'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
function segment(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy,t=den?((p.x-a.x)*dx+(p.y-a.y)*dy)/den:0,u=Math.max(0,Math.min(1,t));return {gap:Math.hypot(p.x-a.x-dx*u,p.y-a.y-dy*u),t};}
function metrics(data){
 const close=[],crossings=[],curved=[],stems=[];
 for(const e of data.edges){const a=e.points[0],b=e.points.at(-1);
  if(e.points.some(p=>segment(p,a,b).gap>.1))curved.push(e.id);
  for(const n of data.nodes){if(n.id===e.from||n.id===e.to)continue;let gap=Infinity;for(let i=1;i<e.points.length;i++)gap=Math.min(gap,segment(n,e.points[i-1],e.points[i]).gap);const d=segment(n,a,b);if(d.t>0&&d.t<1&&gap-n.radius<5)close.push({edge:e.id,node:n.id,gap:+(gap-n.radius).toFixed(2)});}
 }
 for(let i=0;i<data.edges.length;i++)for(let j=i+1;j<data.edges.length;j++){
  const e=data.edges[i],f=data.edges[j],ids=[e.from,e.to],shared=[f.from,f.to].filter(id=>ids.includes(id));
  if(shared.length===1){const id=shared[0],n=data.nodes.find(n=>n.id===id),a=data.nodes.find(n=>n.id===(e.from===id?e.to:e.from)),b=data.nodes.find(n=>n.id===(f.from===id?f.to:f.from)),u=Math.atan2(a.y-n.y,a.x-n.x),v=Math.atan2(b.y-n.y,b.x-n.x),angle=Math.abs(Math.atan2(Math.sin(u-v),Math.cos(u-v)))*180/Math.PI;if(angle<16)stems.push({edges:[e.id,f.id],angle:+angle.toFixed(1)});}
  if(shared.length)continue;
  const a=e.points[0],b=e.points.at(-1),c=f.points[0],d=f.points.at(-1),rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y,den=rx*sy-ry*sx;if(Math.abs(den)<1e-8)continue;
  const t=((c.x-a.x)*sy-(c.y-a.y)*sx)/den,u=((c.x-a.x)*ry-(c.y-a.y)*rx)/den;
  if(t>0&&t<1&&u>0&&u<1){let angle=Math.abs(Math.atan2(den,rx*sx+ry*sy))*180/Math.PI;angle=Math.min(angle,180-angle);crossings.push({edges:[e.id,f.id],x:a.x+t*rx,y:a.y+t*ry,angle:+angle.toFixed(1)});}
 }
 const outside=data.nodes.filter(n=>n.x-n.radius<data.bounds.left-1||n.x+n.radius>data.bounds.right+1||n.y-n.radius<data.bounds.top-1||n.y+n.radius>data.bounds.bottom+1).map(n=>n.id);
 return {...data,close,curved,stems,crossings,outside};
}
async function settle(p){await p.evaluate(async()=>{await document.fonts.ready;for(let i=0;i<3;i++)await new Promise(requestAnimationFrame);});}
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=arg('--url')||'http://127.0.0.1:'+server.address().port+'/';browser=await pw[engine].launch({headless:true});
 for(const layout of [{name:'phone',width:390,height:844,touch:true},{name:'short',width:390,height:664,touch:true},{name:'landscape',width:844,height:390,touch:true,angle:90},{name:'desktop',width:1600,height:1000}]){
  if(!layouts.includes(layout.name))continue;
  const context=await browser.newContext({viewport:{width:layout.width,height:layout.height},hasTouch:!!layout.touch,isMobile:!!layout.touch}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  if(layout.touch)await p.addInitScript(angle=>{const orientation=new EventTarget();Object.defineProperties(orientation,{angle:{value:angle},type:{value:angle?'landscape-primary':'portrait-primary'}});Object.defineProperty(screen,'orientation',{get:()=>orientation});},layout.angle||0);
  await p.addInitScript(()=>{Math.random=()=>4.5/8;});await p.goto(url);await p.locator('#title-challenges').click();await chooseChallenge(p,'Q1');await settle(p);
  const catalogue=await p.evaluate(async()=>{const {challenges}=await import(new URL('../content/challenges.js',document.querySelector('script[type=module]').src));return challenges;});const rows=[];
  for(const c of catalogue){
   if(c.number>1)await p.locator('#stage-next').click();if(await p.locator('#mirror-intro-start').isVisible())await p.locator('#mirror-intro-start').click();await settle(p);assert.match(await p.locator('#title').textContent(),new RegExp('^Q'+c.number+' '));
   const data=await p.evaluate(c=>{const board=document.getElementById('board'),r=board.getBoundingClientRect();return {id:c.id,number:c.number,width:innerWidth,height:innerHeight,scrollW:document.documentElement.scrollWidth,scrollH:document.documentElement.scrollHeight,bounds:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},nodes:c.nodes.map(n=>{const hit=board.querySelector('[data-node="'+n.id+'"] .node-hit'),b=hit.getBoundingClientRect();return {id:n.id,kind:n.kind,x:b.x+b.width/2,y:b.y+b.height/2,radius:Math.min(b.width,b.height)/2};}),edges:c.candidates.map(e=>{const line=board.querySelector('[data-edge="'+e.id+'"] .edge-line'),m=line.getScreenCTM(),length=line.getTotalLength();return {id:e.id,from:e.from,to:e.to,points:Array.from({length:33},(_,i)=>{const p=line.getPointAtLength(length*i/32).matrixTransform(m);return{x:p.x,y:p.y};})};})};},c);
   const row=metrics(data);rows.push(row);if(shots.includes(c.number))await p.screenshot({path:path.join(out,layout.name+'-Q'+c.number+'.png')});if(row.close.length||row.curved.length||row.outside.length)console.log(layout.name+' Q'+c.number+' close='+row.close.length+' curved='+row.curved.length+' stems='+row.stems.length+' crosses='+row.crossings.length);

   if(!process.argv.includes('--audit')&&[17,26].includes(c.number)){
    const stroke=async(from,to)=>{
     const a=row.nodes.find(n=>n.id===from),b=row.nodes.find(n=>n.id===to);
     if(layout.touch&&engine==='chromium'){
      const client=await p.context().newCDPSession(p),finger=(x,y)=>({x,y,id:1,radiusX:5,radiusY:5,force:1});
      await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger(a.x,a.y)]});
      for(let i=1;i<=24;i++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[finger(a.x+(b.x-a.x)*i/24,a.y+(b.y-a.y)*i/24)]});
      await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await client.detach();
     }else{await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(b.x,b.y,{steps:24});await p.mouse.up();}
     await settle(p);
    };
    if(c.number===17){
     await stroke('A','F');assert.equal(await p.locator('[data-edge="AF"]:not(.candidate)').count(),1,'Straight A-F gesture connects AF');
     assert.equal(await p.locator('.edge:not(.candidate)').count(),1,'A-F must not turn into A-C-F');
     row.gesture='Direct A-F accepted without connecting C';
     await p.screenshot({path:path.join(out,layout.name+'-Q17-AF.png')});
    }else{
     const old=await p.locator('[data-edge="SC"] .edge-line').getAttribute('d');
     await stroke('S','C');assert.equal(await p.locator('[data-edge="SC"]:not(.candidate)').count(),1);
     assert.equal(await p.locator('[data-edge="SC"] .edge-line').getAttribute('d'),old,'Connected lane keeps its position');
     await stroke('C','S');assert.equal(await p.locator('[data-edge="CS"]:not(.candidate)').count(),1);
     assert.equal(await p.locator('[data-edge="SC"] .edge-line').getAttribute('d'),old,'Reverse connection does not swap lanes');
     row.gesture='Both return directions accepted, stable straight lanes';
    }
    await p.locator('#clear-wires').click();await settle(p);assert.equal(await p.locator('.edge:not(.candidate)').count(),0);
   }
  }
  assert.deepEqual(errors,[]);report.layouts.push({name:layout.name,rows});await context.close();
 }
 if(!process.argv.includes('--audit'))for(const layout of report.layouts)for(const row of layout.rows){assert.deepEqual(row.close,[],layout.name+' Q'+row.number+' parts clear other routes');assert.deepEqual(row.curved,[],layout.name+' Q'+row.number+' light stays straight');assert.deepEqual(row.outside,[],layout.name+' Q'+row.number+' parts fit');assert(row.scrollW<=row.width+1&&row.scrollH<=row.height+1,'no page scroll');}
 report.passed=true;console.log('Layout audit complete: '+report.layouts.map(l=>l.name+'='+l.rows.length).join(', '));
}catch(e){report.error=e.stack;console.error(e.stack);process.exitCode=1;}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));if(browser)await browser.close();await new Promise(r=>server.close(r));}})();
