// Build replaces these constants with the release's complete asset list.
const VERSION='__PRISM_VERSION__';
const ASSETS=__PRISM_ASSETS__;
const base=self.registration.scope;
const prefix=`prism-notes:${new URL(base).pathname}:`;
const cacheName=version=>prefix+version;
const cacheURL=path=>new URL(path,base).href;

const ASSET_FETCH_TIMEOUT_MS=60000,ASSET_CONCURRENCY=4;
let preparation=null;
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
function responseBytes(bytes,response) {
  // Reusing a Response.url from an old module could resolve its relative imports
  // against the old release. Keep the verified bytes, MIME and status, not its URL.
  const headers=new Headers(response.headers);headers.delete('content-encoding');headers.delete('content-length');
  return new Response(bytes,{status:response.status,statusText:response.statusText,headers});
}
async function download(path,expectedHash) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ASSET_FETCH_TIMEOUT_MS);
  try{
    const response=await fetch(new Request(cacheURL(path),{cache:'reload',signal:controller.signal}));
    if(!response.ok)throw new Error('Asset unavailable');
    const bytes=await response.arrayBuffer();
    if(expectedHash&&await digest(bytes)!==expectedHash)throw new Error('Asset integrity mismatch');
    return responseBytes(bytes,response);
  }finally{clearTimeout(timer);}
}
function validManifest(manifest) {
  return manifest?.version===VERSION&&Array.isArray(manifest.assets)&&manifest.assets.length===ASSETS.length&&manifest.assets.every((asset,index)=>asset===ASSETS[index])&&ASSETS.every(asset=>asset==='./build-info.json'||/^[0-9a-f]{64}$/.test(manifest.hashes?.[asset]??''));
}
async function manifestFor(cache) {
  const cached=await cache.match(cacheURL('./build-info.json'));
  if(cached){try{const manifest=await cached.json();if(validManifest(manifest))return manifest;}catch{}}
  const response=await download('./build-info.json'),manifest=await response.clone().json();
  if(!validManifest(manifest))throw new Error('Release manifest mismatch');
  await cache.put(cacheURL('./build-info.json'),response);return manifest;
}
async function reuseCandidates(hashes) {
  const candidates=new Map(),scope=new URL(base);
  for(const name of (await caches.keys()).reverse()){
    if(!name.startsWith(prefix)||name===cacheName(VERSION))continue;
    try{
      const cache=await caches.open(name),response=await cache.match(cacheURL('./build-info.json'));
      if(!response)continue;
      const manifest=await response.json();
      if(!/^\d+\.\d+\.\d+$/.test(manifest.version)||name!==cacheName(manifest.version)||!Array.isArray(manifest.assets))continue;
      for(const asset of manifest.assets){
        const hash=manifest.hashes?.[asset];if(!hashes.has(hash))continue;
        const url=new URL(asset,base);if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))continue;
        if(!candidates.has(hash))candidates.set(hash,[]);candidates.get(hash).push({cache,url:url.href});
      }
    }catch{/* An incomplete old cache is not a reason to discard another version. */}
  }
  return candidates;
}
async function prepareMissingAssets() {
  const cache=await caches.open(cacheName(VERSION)),manifest=await manifestFor(cache);
  const keys=new Set((await cache.keys()).map(request=>request.url));
  const missing=ASSETS.filter(asset=>asset!=='./build-info.json'&&!keys.has(cacheURL(asset)));
  if(!missing.length)return;
  const candidates=await reuseCandidates(new Set(missing.map(asset=>manifest.hashes[asset])));let index=0,failure=null;
  async function next(){
    while(!failure&&index<missing.length){
      const asset=missing[index++],hash=manifest.hashes[asset];let response;
      try{
        for(const source of candidates.get(hash)??[]){
          try{
            const cached=await source.cache.match(source.url);if(!cached?.ok)continue;
            const bytes=await cached.arrayBuffer();if(await digest(bytes)!==hash)continue;
            response=responseBytes(bytes,cached);break;
          }catch{/* A failed old copy falls back to the network. */}
        }
        await cache.put(cacheURL(asset),response??await download(asset,hash));
      }catch(error){failure=error;throw error;}
    }
  }
  // Keep the single preparation alive until its remaining requests have ended.
  await Promise.allSettled(Array.from({length:Math.min(ASSET_CONCURRENCY,missing.length)},()=>next()));
  if(failure)throw failure;
}
function prepareAssets() {
  if(!preparation)preparation=prepareMissingAssets().finally(()=>{preparation=null;});
  return preparation;
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
    const keys=new Set((await cache.keys()).map(request=>request.url));
    return manifest.assets.every(asset=>typeof asset==='string'&&keys.has(cacheURL(asset)));
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
      const index=await cache.match(cacheURL('./index.html'));
      if(index&&await ready(VERSION)){
        // Static hosts may redirect index.html to /. Navigations use manual
        // redirects and reject a cached Response whose redirected flag is true.
        // Keep the prepared HTML bytes and headers without redirect metadata.
        if(index.redirected){const headers=new Headers(index.headers);headers.delete('content-encoding');headers.delete('content-length');return new Response(index.body,{status:index.status,statusText:index.statusText,headers});}
        return index;
      }
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
