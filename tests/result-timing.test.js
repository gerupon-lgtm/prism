import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ResultTimingPreference,RESULT_TIMING_STORAGE_KEY,DEFAULT_RESULT_TIMING,
  MIN_RESULT_WAIT_MS,MAX_RESULT_WAIT_MS,RESULT_WAIT_STEP_MS,validResultWaitMs,
} from '../src/ui/result-timing.js';

const encode=(clearMs,failureMs)=>JSON.stringify({version:1,clearMs,failureMs});
function fixture({saved=null,getError=false,setError=false,beforeSave=()=>{}}={}) {
  const data=new Map(saved===null?[]:[[RESULT_TIMING_STORAGE_KEY,saved]]),writes=[],reads=[];
  const faults={getError,setError};
  const storage={
    getItem(key){reads.push(key);if(faults.getError)throw Error('Blocked');return data.get(key)??null;},
    setItem(key,value){beforeSave();if(faults.setError)throw Error('Full');data.set(key,value);writes.push({key,value});},
  };
  const timing=new ResultTimingPreference(storage);
  return {timing,storage,data,writes,reads,faults};
}

test('待ち時間は0〜5000msの100ms刻みだけを数値として受け付ける',()=>{
  assert.equal(MIN_RESULT_WAIT_MS,0);assert.equal(MAX_RESULT_WAIT_MS,5000);assert.equal(RESULT_WAIT_STEP_MS,100);
  for(let value=MIN_RESULT_WAIT_MS;value<=MAX_RESULT_WAIT_MS;value+=RESULT_WAIT_STEP_MS)assert(validResultWaitMs(value));
  for(const value of [-100,-1,1,99,101,1599,1600.5,5001,5100,NaN,Infinity,-Infinity,'1600','',null,undefined,true,false,{},[],1600n]){
    assert.equal(validResultWaitMs(value),false,`invalid: ${String(value)}`);
  }
});

test('初期値は成功・未達成とも1600msで、値を外から書き換えられない',()=>{
  const f=fixture();assert.deepEqual(DEFAULT_RESULT_TIMING,{clearMs:1600,failureMs:1600});
  assert.deepEqual(f.timing.values,DEFAULT_RESULT_TIMING);assert(Object.isFrozen(DEFAULT_RESULT_TIMING));assert(Object.isFrozen(f.timing.values));
  assert.throws(()=>{f.timing.values.clearMs=2000;},TypeError);
  assert.throws(()=>{f.timing.values={clearMs:0,failureMs:0};},TypeError);
  assert.equal(f.timing.warning,'');assert.deepEqual(f.writes,[]);assert.deepEqual(f.reads,[RESULT_TIMING_STORAGE_KEY]);
});

test('成功と未達成を別々に保存し、再起動で同じ設定を復元する',()=>{
  const f=fixture(),selection={clearMs:0,failureMs:5000};f.timing.select(selection);
  selection.clearMs=900;
  assert.deepEqual(f.timing.values,{clearMs:0,failureMs:5000});assert(Object.isFrozen(f.timing.values));
  assert.deepEqual(f.writes,[{key:RESULT_TIMING_STORAGE_KEY,value:encode(0,5000)}]);
  const restored=new ResultTimingPreference(f.storage);assert.deepEqual(restored.values,f.timing.values);assert.equal(restored.warning,'');
});

test('二つの値を保存してから実行中の設定を一括で更新する',()=>{
  let timing;
  const f=fixture({beforeSave:()=>assert.deepEqual(timing.values,DEFAULT_RESULT_TIMING)});timing=f.timing;
  timing.select({clearMs:1200,failureMs:3400});assert.deepEqual(timing.values,{clearMs:1200,failureMs:3400});
});

test('片方の欠落・範囲外・文字列などは設定も保存内容も変更しない',()=>{
  const saved=encode(700,2300),f=fixture({saved}),original=f.timing.values;
  for(const value of [null,undefined,[],{},1600,{clearMs:1600},{failureMs:1600},{clearMs:'1600',failureMs:1600},
    {clearMs:1600,failureMs:5100},{clearMs:1600,failureMs:1550},{clearMs:NaN,failureMs:1600},
    {clearMs:1600,failureMs:1600,other:1},Object.create({clearMs:1600,failureMs:1600})]){
    assert.throws(()=>f.timing.select(value),/0〜5秒.*0.1秒/);assert.equal(f.timing.values,original);
  }
  assert.equal(f.data.get(RESULT_TIMING_STORAGE_KEY),saved);assert.deepEqual(f.writes,[]);
});

test('初期値へ戻す操作は両方の1600msを保存し、再起動後にも保持する',()=>{
  const f=fixture({saved:encode(500,4000)});f.timing.reset();
  assert.deepEqual(f.timing.values,DEFAULT_RESULT_TIMING);assert.equal(f.data.get(RESULT_TIMING_STORAGE_KEY),encode(1600,1600));
  assert.deepEqual(new ResultTimingPreference(f.storage).values,DEFAULT_RESULT_TIMING);
});

test('再読込で別タブの変更と削除を反映し、読み取りだけでは書き込まない',()=>{
  const f=fixture({saved:encode(800,900)});
  f.data.set(RESULT_TIMING_STORAGE_KEY,encode(2100,1700));f.timing.reload();assert.deepEqual(f.timing.values,{clearMs:2100,failureMs:1700});
  f.data.delete(RESULT_TIMING_STORAGE_KEY);f.timing.reload();assert.deepEqual(f.timing.values,DEFAULT_RESULT_TIMING);
  assert.equal(f.timing.warning,'');assert.deepEqual(f.writes,[]);
});

test('壊れた保存内容や未知の形式は上書きせず初期値と警告へ切り替える',()=>{
  const invalid=['broken','null','[]',JSON.stringify({version:2,clearMs:1600,failureMs:1600}),
    JSON.stringify({version:'1',clearMs:1600,failureMs:1600}),JSON.stringify({version:1,clearMs:1600}),
    JSON.stringify({version:1,clearMs:'1600',failureMs:1600}),JSON.stringify({version:1,clearMs:1600,failureMs:1650}),
    JSON.stringify({version:1,clearMs:1600,failureMs:5100}),JSON.stringify({version:1,clearMs:1600,failureMs:null}),
    JSON.stringify({version:1,clearMs:1600,failureMs:1600,other:1})];
  for(const saved of invalid){
    const f=fixture({saved});assert.deepEqual(f.timing.values,DEFAULT_RESULT_TIMING);assert.match(f.timing.warning,/初期値.*保存内容は保持/);
    assert.equal(f.data.get(RESULT_TIMING_STORAGE_KEY),saved);assert.deepEqual(f.writes,[]);
    f.timing.select({clearMs:900,failureMs:2000});assert.equal(f.timing.warning,'');assert.equal(f.data.get(RESULT_TIMING_STORAGE_KEY),encode(900,2000));
  }
});

test('保存領域を読み取れない時も初期値を使い、元の保存内容を保持する',()=>{
  const saved=encode(200,300),f=fixture({saved,getError:true});
  assert.deepEqual(f.timing.values,DEFAULT_RESULT_TIMING);assert(f.timing.warning);assert.equal(f.data.get(RESULT_TIMING_STORAGE_KEY),saved);assert.deepEqual(f.writes,[]);
  f.faults.getError=false;f.timing.reload();assert.deepEqual(f.timing.values,{clearMs:200,failureMs:300});assert.equal(f.timing.warning,'');
  f.faults.getError=true;f.timing.reload();assert.deepEqual(f.timing.values,DEFAULT_RESULT_TIMING);assert(f.timing.warning);
  const unavailable=new ResultTimingPreference(undefined);assert.deepEqual(unavailable.values,DEFAULT_RESULT_TIMING);assert(unavailable.warning);
  assert.throws(()=>unavailable.select({clearMs:0,failureMs:0}),/保存できません/);
});

test('保存失敗では以前の両設定を保持し、初期化の失敗でも消さない',()=>{
  const saved=encode(700,2300),f=fixture({saved,setError:true}),original=f.timing.values;
  assert.throws(()=>f.timing.select({clearMs:800,failureMs:900}),/保存できません.*もう一度お試し/);
  assert.equal(f.timing.values,original);assert.equal(f.data.get(RESULT_TIMING_STORAGE_KEY),saved);assert.deepEqual(f.writes,[]);
  assert.throws(()=>f.timing.reset(),/保存できません/);assert.equal(f.timing.values,original);assert.equal(f.data.get(RESULT_TIMING_STORAGE_KEY),saved);
  const corrupt=fixture({saved:'broken',setError:true}),warning=corrupt.timing.warning;
  assert.throws(()=>corrupt.timing.reset(),/保存できません/);assert.equal(corrupt.timing.warning,warning);assert.equal(corrupt.data.get(RESULT_TIMING_STORAGE_KEY),'broken');
  f.faults.setError=false;f.timing.select({clearMs:800,failureMs:900});assert.deepEqual(f.timing.values,{clearMs:800,failureMs:900});
});
