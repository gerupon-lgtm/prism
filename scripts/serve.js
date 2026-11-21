import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const port = Number(process.env.PRISM_PORT ?? 4173);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ttf':'font/ttf','.woff2':'font/woff2','.wav':'audio/wav','.mp3':'audio/mpeg','.webmanifest':'application/manifest+json'};
createServer(async (request,response) => {
  try {
    if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
    const pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    if (pathname.split('/').some(part => part.startsWith('.'))) { response.writeHead(403).end(); return; }
    let file = resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    if ((await stat(file)).isDirectory()) file = resolve(file,'index.html');
    const content = await readFile(file);
    const headers={'Content-Type':types[extname(file)] ?? 'application/octet-stream','Cache-Control':'no-store','Accept-Ranges':'bytes'};
    let first=0,last=content.length-1,status=200;
    if(request.headers.range){
      const match=/^bytes=(\d*)-(\d*)$/.exec(request.headers.range.trim());
      const reject=()=>response.writeHead(416,{'Content-Range':`bytes */${content.length}`,'Content-Length':'0'}).end();
      if(!match||(!match[1]&&!match[2])){reject();return;}
      first=match[1]?Number(match[1]):Math.max(0,content.length-Number(match[2]));
      if(match[1]&&match[2])last=Math.min(last,Number(match[2]));
      if(!Number.isSafeInteger(first)||!Number.isSafeInteger(last)||first>last||first>=content.length||(!match[1]&&Number(match[2])===0)){reject();return;}
      status=206;headers['Content-Range']=`bytes ${first}-${last}/${content.length}`;
    }
    headers['Content-Length']=String(last-first+1);response.writeHead(status,headers);
    response.end(request.method === 'HEAD' ? undefined : content.subarray(first,last+1));
  } catch { response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('見つかりません。'); }
}).listen(port,'127.0.0.1',()=>console.log(`Prism local server: http://127.0.0.1:${port}`));
