import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const scope='https://example.test/prism/',oldVersion='1.0.0',version='1.1.0';
const assets=v=>['./index.html',`./v${v}/main.js`,`./v${v}/dependency.js`,`./v${v}/scene.png`,'./build-info.json'];
const material=v=>({'./index.html':`page ${v}`,[`./v${v}/main.js`]:'import "./dependency.js";',[`./v${v}/dependency.js`]:`export const version="${v}";`,[`./v${v}/scene.png`]:'unchanged background bytes'});
const metadata=v=>({version:v,assets:assets(v),hashes:Object.fromEntries(Object.entries(material(v)).map(([key,bytes])=>[key,hash(bytes)]))});
const copy=response=>{const clone=response.clone();Object.defineProperty(clone,'url',{value:response.url});return clone;};
class MemoryCache {
  constructor(){this.values=new Map();}
  key(key){return typeof key==='string'?key:key.url;}
  async match(key){const value=this.values.get(this.key(key));return value?copy(value):undefined;}
  async keys(){return [...this.values.keys()].map(url=>new Request(url));}
  async put(key,response){this.values.set(this.key(key),copy(response));}
  async addAll(requests){const values=await Promise.all(requests.map(async request=>[request,await this.fetch(request)]));for(const [request,response]of values)await this.put(request,response);}
}
async function fixture({old=true}={}) {
  const stores=new Map(),handlers=new Map(),requests=[],overrides=new Map();
  const caches={has:async name=>stores.has(name),keys:async()=>[...stores.keys()],open:async name=>{if(!stores.has(name)){const cache=new MemoryCache();cache.fetch=fetcher;stores.set(name,cache);}return stores.get(name);}};
  const name=v=>'prism-notes:/prism/:'+v,url=asset=>new URL(asset,scope).href;
  async function seed(v){const cache=await caches.open(name(v));for(const [key,body]of Object.entries(material(v))){const response=new Response(body,{headers:{'Content-Type':key.endsWith('.js')?'text/javascript':'image/png','Content-Encoding':'br'}});Object.defineProperty(response,'url',{value:url(key)});await cache.put(url(key),response);}await cache.put(url('./build-info.json'),new Response(JSON.stringify(metadata(v))));return cache;}
  async function fetcher(input){const address=typeof input==='string'?input:input.url;requests.push(address);const key='./'+new URL(address).pathname.slice('/prism/'.length);if(overrides.has(key)){const value=overrides.get(key);return typeof value==='function'?value():value.clone();}if(key==='./build-info.json')return new Response(JSON.stringify(metadata(version)));const body=material(version)[key];return body===undefined?new Response('missing',{status:404}):new Response(body,{headers:{'Content-Type':key.endsWith('.js')?'text/javascript':'image/png'}});}
  if(old)await seed(oldVersion);
  const self={registration:{scope},addEventListener:(type,fn)=>handlers.set(type,fn),clients:{claim:async()=>{},matchAll:async()=>[]},skipWaiting:async()=>{}};
  const source=readFileSync(new URL('../src/pwa/worker.js',import.meta.url),'utf8').replace('__PRISM_VERSION__',version).replace('__PRISM_ASSETS__',JSON.stringify(assets(version)));
  vm.runInNewContext(source,{self,caches,fetch:fetcher,Request,Response,Headers,URL,Set,Map,crypto:webcrypto,AbortController,setTimeout,clearTimeout,console});
  const install=async()=>{let pending;handlers.get('install')({waitUntil:promise=>pending=promise});await pending;};
  const message=async(type='STATUS')=>{let pending,result;handlers.get('message')({data:{type},ports:[{postMessage:value=>{result=value;}}],waitUntil:promise=>pending=promise});await pending;return result;};
  return {caches,stores,requests,overrides,name,url,install,message,seed};
}

test('新版の準備では内容が同じ旧資材を照合して再利用し、旧版の参照先を新版へ持ち込まない',async()=>{
  const f=await fixture();await f.install();const current=await f.caches.open(f.name(version)),old=await f.caches.open(f.name(oldVersion));
  assert.equal(f.requests.includes(f.url(`./v${version}/scene.png`)),false,'unchanged large background must not download again');
  assert.equal(f.requests.includes(f.url(`./v${version}/main.js`)),false,'unchanged module can reuse verified bytes');
  assert(f.requests.includes(f.url(`./v${version}/dependency.js`)),'changed dependency downloads');
  assert.equal((await current.match(f.url(`./v${version}/main.js`))).url,'','a reused module must resolve relative imports under its new request URL');
  assert.equal((await current.match(f.url(`./v${version}/scene.png`))).headers.get('content-encoding'),null);
  assert.equal(await(await old.match(f.url(`./v${oldVersion}/dependency.js`))).text(),material(oldVersion)[`./v${oldVersion}/dependency.js`]);
  assert.equal((await f.message()).ready,true);
});

test('不足が1件ならその1件だけを補い、同時の準備要求も1回へまとめる',async()=>{
  const f=await fixture({old:false});await f.install();const current=await f.caches.open(f.name(version));current.values.delete(f.url(`./v${version}/scene.png`));f.requests.length=0;
  const results=await Promise.all([f.message('PREPARE_ASSETS'),f.message('PREPARE_ASSETS')]);
  assert(results.every(result=>result.ready));assert.deepEqual(f.requests,[f.url(`./v${version}/scene.png`)]);
});

test('旧キャッシュの壊れた内容は流用せず、正しい資材を取得する',async()=>{
  const f=await fixture(),old=await f.caches.open(f.name(oldVersion));await old.put(f.url(`./v${oldVersion}/scene.png`),new Response('corrupted bytes'));
  await f.install();assert(f.requests.includes(f.url(`./v${version}/scene.png`)));assert.equal((await f.message()).ready,true);
});

test('新しい取得内容の照合失敗では準備済みとせず、旧版を保持する',async()=>{
  const f=await fixture();f.overrides.set(`./v${version}/dependency.js`,new Response('incorrect new bytes'));
  await assert.rejects(f.install(),/integrity/);assert.equal((await f.message()).ready,false);
  const old=await f.caches.open(f.name(oldVersion));assert.equal(await(await old.match(f.url(`./v${oldVersion}/dependency.js`))).text(),material(oldVersion)[`./v${oldVersion}/dependency.js`]);
});

test('失敗した準備の通信が残る間は再要求でも二重取得を始めない',async()=>{
  const f=await fixture({old:false}),releases=[];f.overrides.set(`./v${version}/dependency.js`,new Response('unavailable',{status:503}));
  f.overrides.set(`./v${version}/scene.png`,()=>new Promise(resolve=>releases.push(()=>resolve(new Response(material(version)[`./v${version}/scene.png`])))));
  const initial=f.install().catch(()=>{});await new Promise(resolve=>setTimeout(resolve,20));
  const retry=f.message('PREPARE_ASSETS');await new Promise(resolve=>setTimeout(resolve,20));
  const count=f.requests.filter(url=>url.endsWith('/scene.png')).length;releases.forEach(release=>release());await Promise.all([initial,retry]);
  assert.equal(count,1,'outstanding requests belong to one preparation, including the failure path');
});
