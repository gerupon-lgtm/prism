import test from 'node:test';
import assert from 'node:assert/strict';
import { Offline } from '../src/ui/offline.js';

function fixture() {
  const previous=Object.fromEntries(['document','navigator','window','location'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const events=new EventTarget();let reloads=0;
  for(const [key,value] of Object.entries({document:{querySelector:()=>({content:'0.4.0'})},navigator:{serviceWorker:events},window:new EventTarget(),location:{reload:()=>reloads++}}))Object.defineProperty(globalThis,key,{value,configurable:true});
  const offline=new Offline(()=>{});offline.state.update=true;offline.registration={waiting:{},active:{}};
  return {offline,events,reloads:()=>reloads,restore:()=>{for(const [key,descriptor] of Object.entries(previous)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}};
}
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
