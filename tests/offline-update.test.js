import test from 'node:test';
import assert from 'node:assert/strict';
import { Offline } from '../src/ui/offline.js';

function fixture() {
  const previous=Object.fromEntries(['document','navigator','window','location','fetch'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const events=new EventTarget();let reloads=0;
  for(const [key,value] of Object.entries({document:{querySelector:()=>({content:'0.4.0'})},navigator:{serviceWorker:events},window:new EventTarget(),location:{reload:()=>reloads++},fetch:async()=>({ok:true,json:async()=>({version:'0.4.0'})})}))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  const offline=new Offline(()=>{});offline.state.update=true;offline.registration={waiting:{},active:{}};
  return {offline,events,reloads:()=>reloads,restore:()=>{for(const [key,descriptor] of Object.entries(previous)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}};
}
function preparationFixture() {
  const f=fixture(),registration=new EventTarget();
  Object.assign(registration,{scope:'https://example.test/prism/',active:{},waiting:null,installing:null,update:async()=>{}});
  f.offline.registration=registration;globalThis.document.baseURI=registration.scope;globalThis.navigator.onLine=true;globalThis.window.isSecureContext=true;
  f.offline.request=async()=>({ready:true,currentReady:true,currentVersion:'0.4.0'});
  return f;
}

test('資材の取得は短い状態確認より長く待ち、正常な遅い応答を時間切れにしない',async()=>{
  const f=fixture(),original=setTimeout;
  try{
    globalThis.setTimeout=(callback,delay,...args)=>original(callback,delay>=5000?delay/100:delay,...args);
    const worker={postMessage(_data,ports){original(()=>{ports[0].postMessage({ready:true});ports[0].close();},80);}};
    const result=await f.offline.request(worker,null,'PREPARE_ASSETS');assert.equal(result.ready,true);
  }finally{globalThis.setTimeout=original;f.restore();}
});

test('通信が進んでいるインストールを30秒相当で失敗扱いにしない',async()=>{
  const f=fixture(),original=setTimeout;
  try{
    globalThis.setTimeout=(callback,delay,...args)=>original(callback,delay>=5000?delay/1000:delay,...args);
    const worker=new EventTarget();worker.state='installing';
    original(()=>{worker.state='installed';worker.dispatchEvent(new Event('statechange'));},60);
    await f.offline.installation(worker);
  }finally{globalThis.setTimeout=original;f.restore();}
});
test('資材準備の応答を待つ間も確認中を保持し、重複した確認をまとめる',async()=>{
  const f=preparationFixture();try{
    const releases=[];let calls=0;f.offline.request=async(_worker,_version,type='STATUS')=>{
      if(type==='PREPARE_ASSETS'){calls++;return new Promise(resolve=>releases.push(resolve));}
      return {ready:true,currentReady:true,currentVersion:'0.4.0'};
    };
    const first=f.offline.prepare();await new Promise(resolve=>setImmediate(resolve));
    const busy=f.offline.state.checking;
    const second=f.offline.prepare();await new Promise(resolve=>setImmediate(resolve));
    releases.forEach(release=>release({ready:true}));await Promise.all([first,second]);
    assert.equal(busy,true,'準備待ちを確認完了として表示しない');assert.equal(calls,1);assert.equal(f.offline.state.checking,false);assert.equal(f.offline.state.checked,true);
  }finally{f.restore();}
});
test('資材準備がready:falseを返したら成功表示にせず失敗を伝える',async()=>{
  const f=preparationFixture();try{
    f.offline.request=async(_worker,_version,type='STATUS')=>type==='PREPARE_ASSETS'?{ready:false}:{ready:false,currentReady:false,currentVersion:'0.4.0'};
    await f.offline.prepare();assert.match(f.offline.state.error??'',/準備.*失敗/);assert.equal(f.offline.state.checked,false);
  }finally{f.restore();}
});
test('通信なしの確認では保存済み資材を保持し、最新版確認済みと扱わない',async()=>{
  const f=preparationFixture();try{
    globalThis.navigator.onLine=false;await f.offline.prepare();assert.equal(f.offline.state.ready,true);assert.equal(f.offline.state.checked,false);assert.match(f.offline.state.error??'',/通信/);
  }finally{f.restore();}
});
test('更新資材のインストール完了まで確認を終えず、失敗時は旧版を保持する',async()=>{
  const f=preparationFixture();try{
    const worker=new EventTarget();worker.state='installing';let requests=0;
    f.offline.registration.update=async()=>{f.offline.registration.installing=worker;};
    f.offline.request=async()=>{requests++;return {ready:true,currentReady:true,currentVersion:'0.4.0'};};
    const pending=f.offline.prepare();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(f.offline.state.checking,true);assert.equal(f.offline.state.checked,false);assert.equal(requests,1);
    f.offline.registration.installing=null;worker.state='redundant';worker.dispatchEvent(new Event('statechange'));await pending;
    assert.match(f.offline.state.error,/準備.*失敗/);assert.equal(f.offline.state.ready,true);assert.equal(f.offline.state.checking,false);
  }finally{f.restore();}
});
test('ブラウザがオンラインでも版情報を取得できなければ最新版と表示しない',async()=>{
  const f=preparationFixture();try{
    globalThis.fetch=async()=>{throw new TypeError('Failed to fetch');};await f.offline.prepare();
    assert.equal(f.offline.state.ready,true);assert.equal(f.offline.state.checked,false);assert.match(f.offline.state.error,/版情報を取得できません/);
  }finally{f.restore();}
});
test('更新の最終確認を待っている間の状態変更で適用を拒否する',async()=>{
  const f=fixture();try{
    let reply,allowed=true;f.offline.request=()=>new Promise(resolve=>reply=resolve);
    const pending=f.offline.apply(()=>allowed);allowed=false;reply({ready:true});
    await assert.rejects(pending,/状態が変わり/);f.events.dispatchEvent(new Event('controllerchange'));assert.equal(f.reloads(),0);
  }finally{f.restore();}
});
test('資材不足で適用を拒否された後、別タブの更新でも再読込しない',async()=>{
  const f=fixture();try{
    f.offline.request=async(_worker,_version,type='STATUS')=>type==='APPLY_UPDATE'?{applied:false}:{ready:true};
    f.offline.refresh=async()=>{};
    await assert.rejects(f.offline.apply(),/資材が不足/);assert.equal(f.offline.applying,false);
    f.events.dispatchEvent(new Event('controllerchange'));assert.equal(f.reloads(),0);
  }finally{f.restore();}
});
test('承認した状態が適用完了直前に変わった場合も再読込しない',async()=>{
  const f=fixture();try{
    let allowed=true;f.offline.request=async(_worker,_version,type='STATUS')=>type==='APPLY_UPDATE'?{applied:true}:{ready:true};
    const pending=f.offline.apply(()=>allowed);await new Promise(resolve=>setImmediate(resolve));allowed=false;
    f.events.dispatchEvent(new Event('controllerchange'));await assert.rejects(pending,/状態が変わり/);assert.equal(f.reloads(),0);assert.equal(f.offline.applying,false);
  }finally{f.restore();}
});

test('適用完了の応答が来ない場合は許可を解除し、後の更新で再読込しない',async()=>{
  const f=fixture(),original=setTimeout;
  try{
    // Synthetic clock only shortens the activation deadline, not page behavior.
    globalThis.setTimeout=(callback,delay,...args)=>original(callback,delay===10000?1:delay,...args);
    f.offline.request=async(_worker,_version,type='STATUS')=>type==='APPLY_UPDATE'?{applied:true}:{ready:true};f.offline.refresh=async()=>{};
    await assert.rejects(f.offline.apply(),/適用が完了しません/);assert.equal(f.offline.applying,false);
    f.events.dispatchEvent(new Event('controllerchange'));assert.equal(f.reloads(),0);
  }finally{globalThis.setTimeout=original;f.restore();}
});
