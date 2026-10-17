import test from 'node:test';
import assert from 'node:assert/strict';
import {MotionPreference,MOTION_STORAGE_KEY} from '../src/ui/motion.js';

function fixture({saved=null,reduced=false,getError=false,setError=false,legacy=false}={}) {
  const data=new Map(saved===null?[]:[[MOTION_STORAGE_KEY,saved]]),root={dataset:{}},media={matches:reduced},writes=[];let change;
  media[legacy?'addListener':'addEventListener']=legacy?listener=>{change=listener;}:(_type,listener)=>{change=listener;};
  const storage={getItem:key=>{if(getError)throw Error('Blocked');return data.get(key)??null;},setItem:(key,value)=>{if(setError)throw Error('Full');data.set(key,value);writes.push(key);}};
  const motion=new MotionPreference(storage,root,media);
  return {motion,root,data,writes,system(value){media.matches=value;change();}};
}
test('演出の初期値は端末に従い、端末側の変更も読み取りだけで反映する',()=>{
  const f=fixture({reduced:true});assert.equal(f.motion.preference,'auto');assert.equal(f.root.dataset.motion,'reduce');
  f.system(false);assert.equal(f.root.dataset.motion,'full');assert.deepEqual(f.writes,[]);
});
test('通常・控えめの明示選択は端末設定から独立し、自動へ戻すと再び追従する',()=>{
  const f=fixture({reduced:true});f.motion.select('full');assert.equal(f.root.dataset.motion,'full');f.system(false);f.system(true);assert.equal(f.root.dataset.motion,'full');
  f.motion.select('reduce');f.system(false);assert.equal(f.root.dataset.motion,'reduce');
  f.motion.select('auto');assert.equal(f.root.dataset.motion,'full');f.system(true);assert.equal(f.root.dataset.motion,'reduce');
  assert(f.writes.every(key=>key===MOTION_STORAGE_KEY));
});
test('保存済みの選択を再起動と別タブの再読込で復元し、ゲームの保存形式へ混ぜない',()=>{
  const saved=JSON.stringify({version:1,value:'full'}),f=fixture({saved,reduced:true});
  assert.equal(f.root.dataset.motion,'full');assert.deepEqual(f.writes,[]);
  f.data.set(MOTION_STORAGE_KEY,JSON.stringify({version:1,value:'reduce'}));f.motion.reload();assert.equal(f.root.dataset.motion,'reduce');
  f.data.delete(MOTION_STORAGE_KEY);f.motion.reload();assert.equal(f.motion.preference,'auto');
});
test('壊れた値や未知の版は上書きせず端末に従い、明示選択でだけ保存し直す',()=>{
  for(const saved of ['broken','null','{"version":2,"value":"full"}','{"version":1,"value":"unknown"}']){
    const f=fixture({saved,reduced:true});assert.equal(f.root.dataset.motion,'reduce');assert(f.motion.warning);assert.equal(f.data.get(MOTION_STORAGE_KEY),saved);assert.deepEqual(f.writes,[]);
    f.motion.select('full');assert.equal(f.motion.warning,'');assert.equal(f.root.dataset.motion,'full');
  }
});
test('保存が拒否されても旧設定と元データを保ち、誤った選択は書き込まない',()=>{
  const saved=JSON.stringify({version:1,value:'reduce'}),f=fixture({saved,setError:true});
  assert.throws(()=>f.motion.select('full'),/保存できません/);assert.equal(f.motion.preference,'reduce');assert.equal(f.data.get(MOTION_STORAGE_KEY),saved);
  assert.throws(()=>f.motion.select('invalid'),/選んで/);assert.deepEqual(f.writes,[]);
  const blocked=fixture({getError:true,reduced:false});assert.equal(blocked.root.dataset.motion,'full');assert(blocked.motion.warning);
});
test('旧ブラウザの端末設定通知でも自動選択が追従する',()=>{
  const f=fixture({legacy:true});f.system(true);assert.equal(f.root.dataset.motion,'reduce');
});
