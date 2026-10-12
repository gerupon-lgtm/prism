import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalRecords, STORAGE_KEYS, circuitFile, readCircuitFile, resultFile } from '../src/core/storage.js';
import { Simulation } from '../src/core/simulation.js';
import { timeScore } from '../src/core/evaluation.js';

const graph = {mode:'fastest',target:'G',nodes:[{id:'S',kind:'source',process:'0.5'},{id:'G',kind:'goal',process:'0'}],edges:[{id:'SG',from:'S',to:'G',time:'1'}]};
function fixture() {
  const values = new Map();
  let failing = false;
  const adapter = {getItem:key=>values.get(key) ?? null, setItem:(key,value)=>{if(failing) throw new Error('Synthetic quota failure'); values.set(key,value);}};
  return {records:new LocalRecords(adapter),fail:()=>{failing=true;},recover:()=>{failing=false;},values};
}
test('10枠は任意保存、満杯ならユーザー選択の一枠だけ置換する', () => {
  const {records} = fixture();
  for(let i=0;i<10;i++) records.saveCircuit(graph,'同じ名前',{id:`s${i}`});
  assert.throws(()=>records.saveCircuit(graph,'追加',{id:'extra'}));
  records.saveCircuit(graph,'選んだ枠',{replaceId:'s3'});
  assert.equal(records.slots().length,10);
  assert.equal(records.slots().filter(s=>s.name==='選んだ枠')[0].id,'s3');
  assert.equal(records.slots().filter(s=>s.name==='同じ名前').length,9);
});
test('保存・名前変更・削除に失敗しても元の枠を保ち、再試行できる', () => {
  const f=fixture(); f.records.saveCircuit(graph,'前の名前',{id:'one'});
  const old = f.values.get(STORAGE_KEYS.circuits);
  f.fail();
  assert.throws(()=>f.records.rename('one','新しい名前'));
  assert.throws(()=>f.records.remove('one'));
  assert.throws(()=>f.records.saveCircuit(graph,'置換',{replaceId:'one'}));
  assert.equal(f.values.get(STORAGE_KEYS.circuits),old);
  f.recover(); f.records.rename('one','新しい名前');
  assert.equal(f.records.slots()[0].name,'新しい名前');
  assert.deepEqual(f.records.slots()[0].circuit,graph);
});
test('削除は識別子で選んだ枠だけで、成績や案内履歴を消さない', () => {
  const {records}=fixture();
  records.saveCircuit(graph,'同名',{id:'one'}); records.saveCircuit(graph,'同名',{id:'two'});
  records.saveScore('Q1@1','time@1',timeScore(10n,10n)); records.finishGuide('free','skipped');
  records.remove('one');
  assert.deepEqual(records.slots().map(s=>s.id),['two']);
  assert.equal(records.scores().length,1); assert.equal(records.guideHistory().free,'skipped');
});
test('成績は真の値で最高点を保ち、採点版が違う記録を混ぜない', () => {
  const {records}=fixture();
  records.saveScore('Q1@1','time@1',timeScore(20n,10n));
  assert.equal(records.saveScore('Q1@1','time@1',timeScore(40n,10n)),false);
  records.saveScore('Q1@1','time@1',timeScore(10n,10n));
  records.saveScore('Q1@1','time@2',timeScore(20n,10n));
  assert.equal(records.scores().length,2);
  assert.deepEqual(records.scores()[0].score,timeScore(10n,10n));
});
test('成績と案内履歴の保存失敗で元の内容を保持する', () => {
  const f=fixture(); f.records.saveScore('Q1@1','time@1',timeScore(20n,10n)); f.records.finishGuide('free','skipped');
  const oldScores=f.values.get(STORAGE_KEYS.scores), oldGuides=f.values.get(STORAGE_KEYS.guides);
  f.fail(); assert.throws(()=>f.records.saveScore('Q1@1','time@1',timeScore(10n,10n))); assert.throws(()=>f.records.finishGuide('challenge','completed'));
  assert.equal(f.values.get(STORAGE_KEYS.scores),oldScores); assert.equal(f.values.get(STORAGE_KEYS.guides),oldGuides);
});
test('回路ファイルで条件を再現でき、結果ファイルを回路として読まない', () => {
  const file=circuitFile(graph,'ファイル');
  const loaded=readCircuitFile(JSON.stringify(file)); assert.deepEqual(loaded.circuit,graph);
  const a=new Simulation(graph), b=new Simulation(loaded.circuit); a.advanceUntil('1'); b.advanceUntil('1');
  assert.deepEqual(a.records,b.records);
  const result=resultFile(a); assert.equal(result.records.length,a.records.length);
  assert.throws(()=>readCircuitFile(JSON.stringify(result)));
  assert.throws(()=>readCircuitFile(JSON.stringify({...file,version:99})));
  assert.throws(()=>readCircuitFile(JSON.stringify({...file,circuit:{...graph,edges:[{...graph.edges[0],to:'missing'}]}})));
});
test('未知版・破損データを読めなかった場合も自動初期化や消去をしない', () => {
  const f=fixture(); f.values.set(STORAGE_KEYS.circuits,'{"version":99,"value":[]}');
  assert.throws(()=>f.records.saveCircuit(graph,'新規',{id:'one'}));
  assert.equal(f.values.get(STORAGE_KEYS.circuits),'{"version":99,"value":[]}');
});

test('不正な識別子を保存する前に拒否し、既存枠の管理を妨げない',()=>{
  const f=fixture(); f.records.saveCircuit(graph,'元',{id:'one'});
  const old=f.values.get(STORAGE_KEYS.circuits);
  for(const id of [123,'',null]) assert.throws(()=>f.records.saveCircuit(graph,'新規',{id}));
  assert.equal(f.values.get(STORAGE_KEYS.circuits),old);
  assert.equal(f.records.slots()[0].id,'one');
});

test('未達成0点・上限超過・不正な既存成績を達成した最高点として扱わない',()=>{
  const f=fixture();
  for(const numerator of ['0','50','101','1000']) assert.throws(()=>f.records.saveScore('Q1@1','time@1',{numerator,denominator:'1'}));
  assert.equal(f.values.has(STORAGE_KEYS.scores),false);
  const malformed=JSON.stringify({version:1,value:[{challenge:'Q1@1',rule:'time@1',achieved:true,score:{numerator:'1000',denominator:'1'}}]});
  f.values.set(STORAGE_KEYS.scores,malformed);
  assert.throws(()=>f.records.saveScore('Q1@1','time@1',timeScore(10n,10n)));
  assert.equal(f.values.get(STORAGE_KEYS.scores),malformed);
});

test('回路保存と回路ファイルには未知の実行記録や途中状態を混ぜない',()=>{
  const dirty={...graph,records:[{time:'1'}],particles:[{id:1}],nodes:graph.nodes.map(n=>({...n,queue:[1,2]}))};
  const file=circuitFile(dirty,'回路');
  assert.equal('records' in file.circuit,false);
  assert.equal('particles' in file.circuit,false);
  assert.equal('queue' in file.circuit.nodes[0],false);
});
