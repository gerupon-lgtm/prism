// Build replaces these constants with the release's complete asset list.
const VERSION='__PRISM_VERSION__';
const ASSETS=__PRISM_ASSETS__;
const base=self.registration.scope;
const prefix=`prism-notes:${new URL(base).pathname}:`;
const cacheName=version=>prefix+version;
const cacheURL=path=>new URL(path,base).href;

async function prepareAssets() {
  const cache=await caches.open(cacheName(VERSION));
  // Fetch directly, bypassing this worker's cached responses when repairing.
  await cache.addAll(ASSETS.map(path=>new Request(cacheURL(path),{cache:'reload'})));
}
self.addEventListener('install',event=>{event.waitUntil(prepareAssets());});
// Applying in one tab must not reload or purge assets used by another tab.
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});

async function ready(version) {
  if(!/^\d+\.\d+\.\d+$/.test(version)||!await caches.has(cacheName(version)))return false;
  const cache=await caches.open(cacheName(version)),response=await cache.match(cacheURL('./build-info.json'));
  if(!response)return false;
  try{
    const manifest=await response.json();if(manifest.version!==version||!Array.isArray(manifest.assets))return false;
    for(const asset of manifest.assets)if(!await cache.match(cacheURL(asset)))return false;
    return true;
  }catch{return false;}
}
self.addEventListener('message',event=>{
  if(event.data?.type==='PREPARE_ASSETS'){event.waitUntil((async()=>{
    try{if(!await ready(VERSION))await prepareAssets();event.ports[0]?.postMessage({ready:await ready(VERSION)});}
    catch{event.ports[0]?.postMessage({ready:false});}
  })());return;}
  if(event.data?.type==='APPLY_UPDATE'){event.waitUntil((async()=>{
    try{if(!await ready(VERSION)){event.ports[0]?.postMessage({applied:false});return;}await self.skipWaiting();event.ports[0]?.postMessage({applied:true});}
    catch{event.ports[0]?.postMessage({applied:false});}
  })());return;}
  if(event.data?.type==='STATUS')event.waitUntil((async()=>{
    const version=event.data.version??VERSION,currentReady=await ready(VERSION);
    event.ports[0]?.postMessage({version,currentVersion:VERSION,currentReady,ready:version===VERSION?currentReady:await ready(version)});
  })());
});

const unavailable=()=>new Response(`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>プリズム・ノーツ</title><body style="margin:0;padding:24px;background:#090d1a;color:#e3e8f6;font:16px sans-serif"><h1 style="font-size:22px">プリズム・ノーツ</h1><p>起動に必要な資材が不足しています。通信できる状態で開き直し、オフラインの準備を行ってください。</p><p>この表示で保存回路や成績を削除していません。</p><button onclick="location.reload()" style="font:inherit;padding:10px">再試行</button><p>検証 v${VERSION}</p></body></html>`,{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});

self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url),scope=new URL(base);
  if(request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
  event.respondWith((async()=>{
    // Update checks must reach the origin. An unavailable origin is a handled
    // result, rather than a rejected fetch event that can break offline clients.
    if(url.pathname===new URL('./build-info.json',base).pathname&&url.searchParams.has('update-check')){
      try{return await fetch(request);}
      catch{return new Response('{}',{status:503,headers:{'Content-Type':'application/json'}});}
    }
    const cache=await caches.open(cacheName(VERSION));
    if(request.mode==='navigate'){
      const index=await cache.match(cacheURL('./index.html'));if(index&&await ready(VERSION))return index;
      try{return await fetch(request);}catch{return unavailable();}
    }
    const cached=await cache.match(request);if(cached)return cached;
    // Old pages retain their fully prepared version and can continue safely.
    for(const name of await caches.keys())if(name.startsWith(prefix)&&name!==cacheName(VERSION)){
      const old=await(await caches.open(name)).match(request);if(old)return old;
    }
    return fetch(request);
  })());
});
