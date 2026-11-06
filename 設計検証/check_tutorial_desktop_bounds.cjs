const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),root=path.resolve('dist'),out=path.resolve(arg('--out')||'設計検証/チュートリアル体験-20261106/desktop-bounds');fs.mkdirSync(out,{recursive:true});
const report={version:JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version,passed:true,cases:[],boundary:'Read-only desktop-browser geometry at the lower desktop breakpoint; no physical-device claims.'};
const server=http.createServer((req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===root)file=path.join(root,'index.html');assert(file.startsWith(root+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.ttf':'font/ttf','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
let browser;
(async()=>{try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await pw.chromium.launch({headless:true});
  for(const [width,height]of [[1100,700],[1366,768]]){
    const context=await browser.newContext({viewport:{width,height}}),p=await context.newPage();
    await p.goto(`http://127.0.0.1:${server.address().port}/`);await p.locator('#board [data-node="S"]').waitFor({state:'attached'});await p.locator('#title-tutorial').click();await p.evaluate(async()=>{await document.fonts.ready;for(let n=0;n<6;n++)await new Promise(requestAnimationFrame);});
    const value=await p.evaluate(()=>({desktop:document.documentElement.classList.contains('desktop-layout'),rootHeight:document.documentElement.scrollHeight,rootWidth:document.documentElement.scrollWidth,boxes:Object.fromEntries(['app','desktop-sidebar','play','stop','guide-bar','guide-text'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return [id,{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}];}))}));
    const failures=[];if(!value.desktop)failures.push('Desktop breakpoint is active');
    for(const id of ['play','stop','guide-bar']){const b=value.boxes[id];if(b.top<0||b.left<0||b.right>width+1||b.bottom>height+1)failures.push(id+' remains within viewport');}
    for(const id of ['desktop-sidebar','guide-bar','guide-text']){const b=value.boxes[id];if(b.scrollHeight>b.clientHeight+1||b.scrollWidth>b.clientWidth+1)failures.push(id+' fits without internal overflow');}
    if(value.rootHeight>height+1||value.rootWidth>width+1)failures.push('Page has no scroll overflow');
    await p.screenshot({path:path.join(out,`${width}x${height}.png`)});report.cases.push({width,height,...value,passed:!failures.length,failures});if(failures.length)report.passed=false;console.log(width+'x'+height+' '+(failures.length?failures.join('; '):'passed'));await context.close();
  }
}catch(error){report.passed=false;report.error=error.stack;console.error(error.stack);}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;}})();
