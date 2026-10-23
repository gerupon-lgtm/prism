import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gateChallenges} from '../src/content/gate-challenges.js';
import {gateVariants} from '../src/content/gate-variants.js';
import {runGate,inspectGate} from '../scripts/generate-gate-challenges.js';
import * as gateGenerator from '../scripts/generate-gate-challenges.js';

const previous=JSON.parse(readFileSync(new URL('./fixtures/pre-brisk-0.88.json',import.meta.url),'utf8'));
const proof=()=>JSON.parse(readFileSync(new URL('../設計検証/星刻の開廊/proof.json',import.meta.url),'utf8'));
const half=value=>String(Number(value)/2);
const authored=id=>gateChallenges.find(c=>c.id===id);

test('開閉6面は旧条件の時刻を半分にし、最終面の開く幅を保つ',()=>{
 for(const c of gateChallenges){
  const old=previous.definitions.find(p=>p.id===c.id);
  assert.equal(c.version,old.version+1,c.id+' content version');
  assert.equal(c.limit,old.limit);assert.deepEqual(c.goals,old.goals);
  assert.deepEqual(c.candidates.map(({time,...e})=>e),old.candidates.map(({time,...e})=>e));
  for(const n of c.nodes){
   const before=old.nodes.find(p=>p.id===n.id);
   const {process:currentProcess,gate:currentGate,...currentPart}=n;
   const {process:oldProcess,gate:oldGate,...oldPart}=before;
   assert.deepEqual(currentPart,oldPart,c.id+' part identity and coordinates');
   assert.equal(n.process,half(before.process),c.id+' processing '+n.id);
   if(before.gate)assert.deepEqual(n.gate,{period:half(before.gate.period),open:c.id==='Q46'?'2.5':half(before.gate.open),phase:half(before.gate.phase)});
  }
  for(const e of c.candidates)assert.equal(e.time,half(old.candidates.find(p=>p.id===e.id).time));
 }
});

test('正確な0.05秒刻みで満点・部分点・失敗の終了を別々に検証する',()=>{
 assert.equal(gateGenerator.GATE_GENERATION?.phaseStep,'0.05');
 const c={id:'small-gate',type:'delivery-all',limit:2,goals:['G'],
  nodes:[{id:'S',kind:'source',x:.5,y:0,process:'0'},{id:'A',kind:'prism',x:.5,y:.5,process:'0.25',gate:{period:'2',open:'1.25',phase:'0'}},{id:'G',kind:'goal',x:.5,y:1,process:'0'}],
  candidates:[{id:'SA',from:'S',to:'A',time:'0.25'},{id:'AG',from:'A',to:'G',time:'0.25'}]};
 const row=inspectGate(c);
 assert.equal(row.phaseSamples,40);assert.equal(row.phaseStep,'0.05');
 assert.equal(row.baseline,'0.75');assert.equal(row.perfectWindowSeconds,1.25);
 assert.equal(row.execution.perfect.maxDuration,'0.75');
 assert.equal(row.execution.partial.maxDuration,'1.5');
 assert.equal(row.execution.failed.maxDuration,'1.25');
 assert.equal(row.execution.perfect.count+row.execution.partial.count+row.execution.failed.count,row.combinations);
 assert.equal(row.maxDuration,'1.5');
 const offGrid=structuredClone(c);offGrid.candidates[0].time='0.03';
 assert.throws(()=>inspectGate(offGrid),/align with the exact phase step/);
});

test('全48出題は余裕のある開始幅と短い実動時間を備え、旧出題と混ざらない',()=>{
 const rows=proof().stages;
 for(const c of gateChallenges){
  const bank=gateVariants[c.id],old=previous.banks[c.id],winners=new Set();
  assert.equal(bank.length,8);assert.equal(new Set(bank.map(v=>v.family)).size,2);
  for(const v of bank){
   assert.equal(v.baseVersion,c.version);assert(!old.some(o=>o.id===v.id));
   const previousDraw=old[bank.indexOf(v)];
   assert.deepEqual(v.times,previousDraw.times.map(half),c.id+' coordinated draw timing');
   assert.equal(v.baseline,half(previousDraw.baseline));
   if(c.id!=='Q46')assert.equal(v.maxDuration,half(previousDraw.maxDuration));
   else assert(Number(v.maxDuration)<=Number(previousDraw.maxDuration)/2);
   const row=rows.find(r=>r.challenge===c.id&&r.id===v.id);
   assert(row,c.id+' proof');assert.equal(row.phaseStep,'0.05');
   assert.equal(row.valid,true);assert.equal(row.winners,1);
   assert(Number(v.baseline)<=5);assert(Number(v.maxDuration)<=12);
   assert(row.perfectWindowSeconds>=1);
   assert.equal(row.execution.perfect.count+row.execution.partial.count+row.execution.failed.count,row.combinations);
   const maxima=['perfect','partial','failed'].map(k=>Number(row.execution[k].maxDuration));
   assert.equal(Math.max(...maxima),Number(v.maxDuration));
   const problem={...c,candidates:c.candidates.map((e,i)=>({...e,time:v.times[i]}))};
   assert.equal(String(runGate(problem,row.winner,row.optimalPhase).actual),v.baseline);
   assert(Number(runGate(problem,row.partial.edges,row.partial.phase).actual)>Number(v.baseline));
   for(const category of ['perfect','partial','failed']){
    const metric=row.execution[category],witness=metric.witness;
    assert(metric.count>0,c.id+' '+category+' cases');
    const actual=runGate(problem,witness.edges,witness.phase);
    assert.equal(actual.run.format(),metric.maxDuration);
    if(category==='failed')assert.equal(actual.actual,null);
    else if(category==='perfect')assert.equal(String(actual.actual),v.baseline);
    else assert(actual.actual>Number(v.baseline));
   }
   winners.add([...row.winner].sort().join(','));
  }
  assert.equal(winners.size,2,c.id+' two solution families');
 }
});
