import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {returnChallenges} from '../src/content/return-challenges.js';
import {returnVariants} from '../src/content/return-variants.js';
import {challengeCircuit} from '../src/content/challenges.js';
import {drawChallenge} from '../src/content/challenge-draw.js';
import {Session} from '../src/app/session.js';
import {LocalRecords} from '../src/core/storage.js';
import {returnPatternResult} from '../src/core/return-pattern.js';
import {runReturn,inspectReturn} from '../scripts/generate-return-challenges.js';
const old=JSON.parse(readFileSync(new URL('./fixtures/pre-brisk-0.88.json',import.meta.url),'utf8'));
const proof=JSON.parse(readFileSync(new URL('../設計検証/星への帰還/proof.json',import.meta.url),'utf8'));
const intended={Q29:['SA','AC','CS','SB','BG'],Q30:['SC','CS','SA','AD','DG'],Q31:['SA','AD','DS','SB','BG'],Q32:['SA','AC','CS','SB','AG','BG'],Q33:['SA','AD','SB','BD','DS','DG'],Q34:['SA','AC','CS','AG','SB','BG','CG']};
const reflect={SA:'SB',SB:'SA',AC:'BD',BD:'AC',CS:'DS',DS:'CS',AG:'BG',BG:'AG',SC:'SD',SD:'SC',CG:'DG',DG:'CG',AD:'BC',BC:'AD'};
const candidates={
 Q29:['SA','AC','CS','SB','BD','DS','AG','BG'],
 Q30:['SA','CS','SB','DS','SC','CG','SD','DG','AD','BC'],
 Q31:['SA','CS','SB','DS','AG','BG','AD','BC'],
 Q32:['SA','AC','CS','SB','BD','DS','AG','BG','CG','DG'],
 Q33:['SA','AC','CS','SB','BD','DS','CG','DG','AD','BC'],
 Q34:['SA','AC','CS','SB','BD','DS','AG','BG','SC','CG','SD','DG'],
};
const legalCounts={Q29:219,Q30:638,Q31:219,Q32:848,Q33:848,Q34:3302};
const retainedPerfectBase={Q29:4.1,Q30:6,Q31:4.3,Q32:3.6,Q33:8,Q34:5.2};

test('帰還の候補は両系統の満点と必要最小の左右ペアへ絞る',()=>{
 for(const c of returnChallenges){
  assert.deepEqual(c.candidates.map(e=>e.id),candidates[c.id],c.id);
  assert(c.candidates.every(e=>c.candidates.some(f=>f.id===reflect[e.id])),c.id+' mirrored subset');
 }
});

test('帰還6面は回数・正確な間隔・元座標を保ち、合流処理と三出口の本数変更を明示する',()=>{
 for(const c of returnChallenges){
  const previous=old.definitions.find(p=>p.id===c.id);
  assert.equal(c.version,previous.version+1,c.id);
  for(const key of ['count','interval','goal','type'])assert.deepEqual(c[key],previous[key],c.id+' '+key);
  assert.equal(c.limit,c.id==='Q34'?7:previous.limit,c.id+' explicit three-exit budget');
  const expected=structuredClone(previous.nodes);
  if(c.id==='Q33')for(const n of expected)if(n.kind==='prism')n.process=['C','D'].includes(n.id)?'1.5':'0';
  if(c.id==='Q34')for(const n of expected)if(n.kind==='prism')n.process=['C','D'].includes(n.id)?'0.5':'0';
  assert.deepEqual(c.nodes,expected,c.id+' coordinates and explicit shared processing');
 }
});
test('帰還48出題は全許可配線の成功・失敗を分類し、遅い成立配線を隠さず短い終了を確認する',()=>{
 assert.equal(proof.stages.length,48);
 for(const c of returnChallenges){
  const bank=returnVariants[c.id];assert.equal(bank.length,8);
  const families=new Map();
  for(const v of bank){
   const row=proof.stages.find(p=>p.id===v.id);assert(row,v.id);
   assert.deepEqual(row.candidateIds,candidates[c.id]);
   assert.equal(row.legalWirings,legalCounts[c.id]);assert.equal(row.priorUnfilteredCandidateCount,14);
   assert(row.priorUnfilteredLegalWirings>row.legalWirings,c.id+' enumerate the actual smaller set');
   const variant=bank.indexOf(v)%4;assert.equal(Number(v.baseline),Number((retainedPerfectBase[c.id]+variant*.1).toFixed(1)),c.id+' preserve full-score timing');
   assert.deepEqual([...row.winner].sort(),intended[c.id].map(id=>v.family?reflect[id]:id).sort(),c.id+' distinct authored return structure');
   assert.equal(v.baseVersion,c.version);assert.equal(v.times.length,c.candidates.length);
   assert.equal(row.valid,true);assert.equal(row.winners,1);assert(row.partial);assert(Number(row.partial.time)>Number(row.baseline));
   assert.equal(row.achieved+row.failed,row.legalWirings);
   assert(Number(row.clearFirstMaximum)<=2.5,c.id+' all-clear first bell');
   assert(Number(row.clearMaximum)<=2.5+(c.count-1)*Number(c.interval),c.id+' all-clear last bell');
   assert(Number(row.failedMaximum)<=12,c.id+' all-failed completion');
   assert(Number(v.maxDuration)<=12,c.id+' run budget');
   assert(v.times.every(t=>Number(t)<=2.5),c.id+' no long distractor');
   assert(v.times.every(t=>Number.isInteger(Math.round(Number(t)*100))&&(Number(t)*10%1===0||['0.25','0.75'].includes(t))),c.id+' readable tenths or necessary quarters');
   const winner=JSON.stringify(row.winner);if(families.has(v.family))assert.equal(families.get(v.family),winner);else families.set(v.family,winner);
  }
  assert.deepEqual([...families.keys()].sort(),[0,1]);assert.notEqual(families.get(0),families.get(1),c.id);
 }
});
test('合流の二経路と三出口のどれかを外す短絡は、満点と同じ条件を作れない',()=>{
 for(const id of ['Q33','Q34'])for(const c of returnChallenges.filter(c=>c.id===id))for(let i=0;i<8;i++){
  const v=returnVariants[id][i],row=proof.stages.find(p=>p.id===v.id),draw=drawChallenge(c,{random:()=>i/8});
  const essential=(id==='Q33'?['AD','BD']:['AG','BG','CG']).map(e=>v.family?reflect[e]:e);
  for(const missing of essential){
   const run=runReturn(draw,row.winner.filter(e=>e!==missing));
   assert.equal(returnPatternResult(draw,run).state,'failed',id+' cannot omit '+missing);
  }
  if(id==='Q33')assert.equal(row.waited,true,'the winning shared processor really queues light');
 }
});
test('帰還48出題の満点と部分点は必要最後の鐘で終了し、指定間隔と星の再分岐を保つ',()=>{
 for(const c of returnChallenges)for(let i=0;i<8;i++){
  const v=returnVariants[c.id][i],row=proof.stages.find(p=>p.id===v.id),draw=drawChallenge(c,{random:()=>i/8});
  for(const [ids,time]of [[row.winner,row.baseline],[row.partial.edges,row.partial.time]]){
   const records=new LocalRecords({getItem:()=>null,setItem:()=>{}}),s=new Session(records);
   s.challenge=structuredClone(draw);s.circuit=challengeCircuit(draw,ids);s.start();s.advance(draw.maxDuration);
   assert.equal(s.result.state,'achieved',v.id);assert.equal(s.result.evaluatedTime,time,v.id);
   const arrivals=s.run.arrivals(c.goal),scale=s.run.circuit.time;
   assert.equal(arrivals.length,c.count);assert.equal(s.run.format(),arrivals.at(-1).time);assert.equal(s.run.exhausted,true);
   for(let j=1;j<arrivals.length;j++)assert.equal(scale.ticks(arrivals[j].time)-scale.ticks(arrivals[j-1].time),scale.ticks(c.interval));
   assert(s.run.records.some(r=>r.type==='branch'&&r.node==='S'&&scale.ticks(r.time)>0n&&scale.ticks(r.time)<=scale.ticks(time)));
  }
 }
});
test('全48出題の最も長い失敗例はSessionでも生成proofと同じ実時刻で決着する',()=>{
 for(const c of returnChallenges)for(let i=0;i<8;i++){
  const v=returnVariants[c.id][i],row=proof.stages.find(p=>p.id===v.id),draw=drawChallenge(c,{random:()=>i/8});
  const s=new Session(new LocalRecords({getItem:()=>null,setItem:()=>{}}));
  s.challenge=structuredClone(draw);s.circuit=challengeCircuit(draw,row.failedExample.edges);s.start();s.advance(draw.maxDuration);
  assert.equal(s.result.state,'failed',v.id);assert.equal(s.run.format(),row.failedExample.time,v.id);
  assert.equal(s.run.exhausted,true);assert.equal(s.result.timeLimitReached,undefined);
 }
});
test('上限より遅い成立を失敗へ変えず、成立時刻を検出して出題の受入れを拒否する',()=>{
 const previous=old.definitions.find(c=>c.id==='Q29'),v=old.banks.Q29[0];
 const c={...structuredClone(previous),maxDuration:'0.1',candidates:previous.candidates.map((e,i)=>({...e,time:v.times[i]}))};
 const winner=['SA','AC','CS','SB','BG'],slow=['SA','AC','CS','SB','AG'];
 const run=runReturn(c,slow);assert.equal(returnPatternResult(c,run).state,'achieved');assert.equal(run.format(),'10.5');
 const result=inspectReturn(c,[winner,slow]);assert.equal(result.achieved,2);assert.equal(result.failed,0);
 assert.equal(result.clearFirstMaximum,7.5);assert.equal(result.clearMaximum,10.5);assert.equal(result.valid,false);
});
