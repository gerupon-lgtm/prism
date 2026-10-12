import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const port = Number(process.env.PRISM_PORT ?? 4173);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ttf':'font/ttf','.woff2':'font/woff2','.wav':'audio/wav','.webmanifest':'application/manifest+json'};
createServer(async (request,response) => {
  try {
    if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
    const pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    if (pathname.split('/').some(part => part.startsWith('.'))) { response.writeHead(403).end(); return; }
    let file = resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    if ((await stat(file)).isDirectory()) file = resolve(file,'index.html');
    const content = await readFile(file);
    response.writeHead(200,{'Content-Type':types[extname(file)] ?? 'application/octet-stream','Cache-Control':'no-store'});
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch { response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('見つかりません。'); }
}).listen(port,'127.0.0.1',()=>console.log(`Prism local server: http://127.0.0.1:${port}`));
