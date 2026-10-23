import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {challenges,challengeCircuit} from '../src/content/challenges.js';
import {randomVariants} from '../src/content/random-variants.js';
import {randomVariants as legacyVariants} from '../設計検証/鐘の順番/0.67.0/legacy-variants.js';
import {Session} from '../src/app/session.js';
import {LocalRecords} from '../src/core/storage.js';
import {perfectScore,compareScores} from '../src/core/evaluation.js';
import {Simulation} from '../src/core/simulation.js';
import {drawChallenge} from '../src/content/challenge-draw.js';
import {matchesChallengeScore} from '../src/core/challenge-identity.js';
const briskSnapshot=JSON.parse(readFileSync(new URL('./fixtures/pre-brisk-0.88.json',import.meta.url),'utf8'));
const proof=JSON.parse(readFileSync(new URL('../設計検証/ランダム課題/generation.json',import.meta.url)));
function fixture(){const values=new Map(),records=new LocalRecords({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)});return {values,records,s:new Session(records,{random:()=>0})};}
function assertHistoricalBank(id,bank){
 const authored=challenges.find(c=>c.id===id);
 if(!authored.balanceRevision&&!authored.tempoRevision)assert.deepEqual(randomVariants[id],bank,id);
 else {
  assert.equal(randomVariants[id].length,bank.length,id);
  assert(randomVariants[id].every(v=>v.baseVersion===authored.version),id);
  assert(bank.every(v=>v.baseVersion<authored.version),id);
 }
}
// Sum arrivals, serialized processing and travel on a decimal integer grid in
// topological order, independently of Simulation's particle/event scheduler.
function timetable(c,selected){
 const edges=selected.map(id=>c.candidates.find(e=>e.id===id));assert(edges.every(Boolean));
 const values=[...c.nodes.map(n=>n.process),...edges.map(e=>e.time)];
 const digits=Math.max(0,...values.map(v=>(String(v).split('.')[1]??'').length)),unit=10n**BigInt(digits);
 const ticks=v=>{const [whole,fraction='']=String(v).split('.');return BigInt(whole)*unit+BigInt(fraction.padEnd(digits,'0')||'0');};
 const format=t=>{const fraction=(t%unit).toString().padStart(digits,'0').replace(/0+$/,'');return String(t/unit)+(fraction?'.'+fraction:'');};
 const arrivals=new Map(c.nodes.map(n=>[n.id,[]])),indegree=new Map(c.nodes.map(n=>[n.id,0]));
 for(const e of edges)indegree.set(e.to,indegree.get(e.to)+1);
 const order=c.nodes.filter(n=>indegree.get(n.id)===0).map(n=>n.id),rows=[];
 for(let i=0;i<order.length;i++){
  const node=c.nodes.find(n=>n.id===order[i]),queued=arrivals.get(node.id).sort((a,b)=>a<b?-1:a>b?1:0);
  let free=0n;const departures=node.kind==='source'?[0n]:node.kind==='goal'?[]:queued.map(at=>{free=(at>free?at:free)+ticks(node.process);return free;});
  if(node.kind==='goal')for(const at of queued)rows.push([node.id,format(at)]);
  for(const e of edges.filter(e=>e.from===node.id)){
   for(const at of departures)arrivals.get(e.to).push(at+ticks(e.time));
   indegree.set(e.to,indegree.get(e.to)-1);if(indegree.get(e.to)===0)order.push(e.to);
  }
 }
 assert.equal(order.length,c.nodes.length,'時刻表の対象は循環しない有向回路');
 return rows.sort((a,b)=>Number(a[1])-Number(b[1])||a[0].localeCompare(b[0]));
}

test('完全一致の間隔条件を保ち、左右配置と経路の改訂対象だけ内容版と出題を更新する',()=>{
 const unchanged=JSON.parse(readFileSync(new URL('../設計検証/厳密な到達間隔/0.69.0/unchanged-draws.json',import.meta.url)));
 for(const [id,bank]of Object.entries(unchanged))assertHistoricalBank(id,bank);
 const versions={Q23:2,Q24:3,Q25:3,Q26:4,Q27:4,Q28:4};
 for(const c of challenges.slice(18,24)){
  assert.equal(c.version,versions[c.id]);assert(randomVariants[c.id].every(v=>v.baseVersion===c.version));
  if(c.intervals)assert.equal(c.intervalTolerance,undefined);
  else assert.equal(c.intervals,undefined);
 }
});

test('旧許容幅の成績と元条件を残し、新条件の最高点と混ぜない',()=>{
 const legacy=JSON.parse(readFileSync(new URL('../設計検証/厳密な到達間隔/0.69.0/legacy-problems.json',import.meta.url)));
 for(const {problem,winner}of legacy){
  const {s,records}=fixture();s.replace({challengeId:problem.id});s.challenge=structuredClone(problem);s.circuit=challengeCircuit(problem,winner);s.start();s.advance(problem.maxDuration);
  assert.equal(s.result.state,'achieved');const old=structuredClone(records.scores()[0]);assert.equal(old.problem.intervalTolerance,'0.1');
  s.stop();s.replace({challengeId:problem.id});assert.equal(s.challenge.version,challenges.find(c=>c.id===problem.id).version);assert.equal(matchesChallengeScore(old,s.challenge),false);
  const row=proof.stages.find(p=>p.id===s.challenge.draw.id);s.circuit=challengeCircuit(s.challenge,row.winner);s.start();s.advance(s.challenge.maxDuration);
  assert.equal(s.result.state,'achieved');assert.equal(records.scores().length,2);assert.deepEqual(records.scores().find(r=>r.challenge===old.challenge),old);
 }
});
test('旧96出題は未改訂課題で保持し、改訂課題の現行出題とは区別して順番セットを6面保つ',()=>{
 for(const [id,variants]of Object.entries(legacyVariants))assertHistoricalBank(id,variants);
 assert.deepEqual(challenges.slice(18,24).map(c=>c.number),[19,20,21,22,23,24]);assert.equal(challenges[18].intervals,undefined);assert.equal(challenges[21].intervals,undefined);assert(challenges.slice(18,24).every(c=>c.type==='bell-sequence'));
});
test('新48出題の満点と部分点を本体で採点・保存し、全到達時刻を結果へ保持する',()=>{
 for(const authored of challenges.slice(18,24))for(const variant of randomVariants[authored.id]){
  const f=fixture();f.s.replace({challengeId:authored.id});const c={...structuredClone(authored),candidates:authored.candidates.map((e,i)=>({...e,time:variant.times[i]})),baseline:variant.baseline,maxDuration:variant.maxDuration,draw:{id:variant.id,revision:1,number:randomVariants[authored.id].indexOf(variant)+1}};
  f.s.challenge=c;const row=proof.stages.find(p=>p.id===variant.id);assert(row);
  f.s.circuit=challengeCircuit(c,row.winner);f.s.start();f.s.advance(c.maxDuration);assert.equal(f.s.result.state,'achieved',variant.id);assert(perfectScore(f.s.result.score));assert.equal(f.s.result.evaluatedTime,row.baseline);assert.equal(f.s.result.goals.length,c.goals.length);assert.equal(f.records.scores()[0].problem.draw.id,variant.id);
  const full=f.s.exportResult();assert.deepEqual(full.evaluation.goals,f.s.result.goals);f.s.stop();f.s.circuit=challengeCircuit(c,row.partial.edges);f.s.start();f.s.advance(c.maxDuration);assert.equal(f.s.result.state,'achieved');assert(!perfectScore(f.s.result.score));assert(compareScores(f.records.scores()[0].score,f.s.result.score)>0);
 }
});
test('新しい6面は選び直しで満点配線が変わり、配線クリアでは同じ問題を保つ',()=>{
 for(const c of challenges.slice(18,24)){
  const {s}=fixture();s.replace({challengeId:c.id});const first=structuredClone(s.challenge),a=proof.stages.find(p=>p.id===first.draw.id);s.clearConnections();assert.deepEqual(s.challenge,first);s.replace({challengeId:c.id});const b=proof.stages.find(p=>p.id===s.challenge.draw.id);assert.notDeepEqual(a.winner,b.winner);
 }
});
test('18面クリアから19面へ続き、24面から25面へ進める',()=>{
 const {s}=fixture();for(const [id,next]of [['Q10','Q23'],['Q23','Q24'],['Q28','Q29']]){s.stop();s.replace({challengeId:id});const row=proof.stages.find(p=>p.id===s.challenge.draw.id);s.circuit=challengeCircuit(s.challenge,row.winner);s.start();s.advance(s.challenge.maxDuration);assert.equal(s.clearChoices.nextChallengeId,next);}
});
test('一部の鐘への配線だけでは未達成となり、成績を作らない',()=>{
 const {s,records}=fixture();s.replace({challengeId:'Q23'});s.circuit=challengeCircuit(s.challenge,['SA','AB','BG1']);s.start();s.advance(s.challenge.maxDuration);assert.equal(s.result.state,'failed');assert.match(s.result.reason,/すべて/);assert.equal(records.scores().length,0);
});
test('6面の初出題の全到達を独立した整数の時刻表と照合し、未改訂2面の手計算値も保つ',()=>{
 const fixed={Q23:[['G1','2.5'],['G2','3.5']],Q24:[['G1','4.5'],['G2','5']]};
 for(const authored of challenges.slice(18,24)){
  const c=drawChallenge(authored,{random:()=>0}),row=proof.stages.find(p=>p.id===c.draw.id),run=new Simulation(challengeCircuit(c,row.winner));while(!run.exhausted)run.advanceNext();
  const actual=run.arrivals().map(r=>[r.node,r.time]).sort((a,b)=>Number(a[1])-Number(b[1])||a[0].localeCompare(b[0]));assert.deepEqual(actual,timetable(c,row.winner),c.id);
  if(fixed[c.id]){const previous=briskSnapshot.definitions.find(p=>p.id===c.id),v=briskSnapshot.banks[c.id][0],r=briskSnapshot.proof.regular.stages.find(p=>p.id===v.id);const legacy={...previous,candidates:previous.candidates.map((e,i)=>({...e,time:v.times[i]}))},priorRun=new Simulation(challengeCircuit(legacy,r.winner));while(!priorRun.exhausted)priorRun.advanceNext();assert.deepEqual(legacy.goals.map(id=>[id,priorRun.arrivals(id)[0].time]),fixed[c.id],c.id+' historical hand timetable');}
 }
});
