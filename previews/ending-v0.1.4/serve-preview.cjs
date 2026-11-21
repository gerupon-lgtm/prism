const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.png':'image/png','.ttf':'font/ttf','.woff2':'font/woff2','.mid':'audio/midi','.mp3':'audio/mpeg','.wav':'audio/wav'};
const server=http.createServer((req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  const url=new URL(req.url,'http://127.0.0.1'),decoded=decodeURIComponent(url.pathname);
  if(decoded.split('/').some(p=>p.startsWith('.'))){res.writeHead(403).end();return;}
  let file=path.resolve(root,'.'+decoded);
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  const length=fs.statSync(file).size,headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','Accept-Ranges':'bytes'};
  let start=0,end=length-1,status=200;
  if(req.headers.range){const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);if(!match){res.writeHead(416).end();return;}
   if(match[1]){start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}else start=Math.max(0,length-Number(match[2]));
   if(start>end||start>=length){res.writeHead(416,{'Content-Range':'bytes */'+length}).end();return;}
   status=206;headers['Content-Range']=`bytes ${start}-${end}/${length}`;
  }
  headers['Content-Length']=end-start+1;res.writeHead(status,headers);
  if(req.method==='HEAD')res.end();else fs.createReadStream(file,{start,end}).pipe(res);
 }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('見つかりません。');}
});
function listening(){const url=`http://127.0.0.1:${server.address().port}/`;console.log(JSON.stringify({preview:url,root,loopbackOnly:true}));}
server.on('error',e=>{if(e.code==='EADDRINUSE')server.listen(0,'127.0.0.1',listening);else throw e;});
server.listen(4188,'127.0.0.1',listening);
