import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const bytes=Uint8Array.from({length:16},(_,i)=>i),scope='https://example.test/prism/';
function fixture({legacy=false}={}){
 const handlers=new Map(),url=new URL('v0.107.0/public/ending/song.mp3',scope).href;
 const file=new Response(bytes,{headers:{'Content-Type':'audio/mpeg'}});
 const name='prism-notes:/prism/:0.107.0',old='prism-notes:/prism/:0.106.0';
 const caches={keys:async()=>[name,...(legacy?[old]:[])],open:async key=>({match:async request=>(!legacy&&key===name||legacy&&key===old)&&(typeof request==='string'?request:request.url)===url?file.clone():undefined})};
 const self={registration:{scope},addEventListener:(type,fn)=>handlers.set(type,fn)};
 const source=readFileSync(new URL('../src/pwa/worker.js',import.meta.url),'utf8').replace('__PRISM_VERSION__','0.107.0').replace('__PRISM_ASSETS__','[]');
 vm.runInNewContext(source,{self,caches,Request,Response,Headers,URL,Set,Map,AbortController,setTimeout,clearTimeout,fetch:()=>{throw Error('origin is offline');}});
 return async range=>{let promise;handlers.get('fetch')({request:new Request(url,{headers:range?{Range:range}:undefined}),respondWith:value=>promise=value});return promise;};
}

test('保存済みの曲は全体の長さを示し、通常取得と頭出しで同じバイトを返す',async()=>{
 const request=fixture();const full=await request();assert.equal(full.status,200);assert.equal(full.headers.get('Content-Length'),'16');assert.equal(full.headers.get('Accept-Ranges'),'bytes');assert.deepEqual(new Uint8Array(await full.arrayBuffer()),bytes);
 for(const [range,start,end] of [['bytes=0-1',0,1],['bytes=4-',4,15],['bytes=-4',12,15],['bytes=2-999',2,15]]){
  const r=await request(range);assert.equal(r.status,206);assert.equal(r.headers.get('Content-Type'),'audio/mpeg');assert.equal(r.headers.get('Content-Range'),`bytes ${start}-${end}/16`);assert.equal(r.headers.get('Content-Length'),String(end-start+1));assert.deepEqual(new Uint8Array(await r.arrayBuffer()),bytes.slice(start,end+1));
 }
 assert.deepEqual(new Uint8Array(await(await request()).arrayBuffer()),bytes,'a seek must not consume or replace the cached full song');
});

test('曲の範囲外や不正な範囲は416で返し、保存済みの曲を変更しない',async()=>{
 const request=fixture();for(const range of ['bytes=16-','bytes=9-2','bytes=-0','bytes=-','bytes=0-1,4-5','unknown=0-1']){const r=await request(range);assert.equal(r.status,416);assert.equal(r.headers.get('Content-Range'),'bytes */16');assert.equal((await r.arrayBuffer()).byteLength,0);}
 assert.deepEqual(new Uint8Array(await(await request()).arrayBuffer()),bytes);
});

test('別タブが使う旧キャッシュの曲も、通信なしで同じ部分取得ができる',async()=>{
 const r=await fixture({legacy:true})('bytes=3-7');assert.equal(r.status,206);assert.equal(r.headers.get('Content-Range'),'bytes 3-7/16');assert.deepEqual(new Uint8Array(await r.arrayBuffer()),bytes.slice(3,8));
});
