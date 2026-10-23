import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {challenges,challengeLabel,challengeCircuit} from '../src/content/challenges.js';
import {drawChallenge} from '../src/content/challenge-draw.js';
import {arrivalFrequencies} from '../src/content/bell-pitches.js';
import {TimeScale} from '../src/core/time.js';
import {Simulation} from '../src/core/simulation.js';
import {Session} from '../src/app/session.js';
import {LocalRecords} from '../src/core/storage.js';
import {randomVariants} from '../src/content/random-variants.js';
const proof=JSON.parse(readFileSync(new URL('../設計検証/ランダム課題/generation.json',import.meta.url)));
function assertHistoricalBank(id,bank){
 const authored=challenges.find(c=>c.id===id);
 if(!authored.balanceRevision)assert.deepEqual(randomVariants[id],bank,id);
 else {
  assert.equal(randomVariants[id].length,bank.length,id);
  assert(randomVariants[id].every(v=>v.baseVersion===authored.version),id);
  assert(bank.every(v=>v.baseVersion<authored.version),id);
 }
}
// Independent DAG timetable: collect every predecessor's arrivals first, then
// add serial processing and travel on an integer decimal grid. No event engine.
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

test('42面を6面のテーマへ整理し、古い課題IDと版を番号から分離する',()=>{
 assert.deepEqual(challenges.map(challengeLabel),Array.from({length:42},(_,i)=>'Q'+(i+1)));
 assert.equal(new Set(challenges.map(c=>c.id)).size,42);
 assert(challenges.slice(6,12).every(c=>c.type==='delivery-all'&&c.world==='starwalk'));
 assert(challenges.slice(12,18).every(c=>c.type==='interval'&&c.world==='moonwater'));
 assert(challenges.slice(18,24).every(c=>c.type==='bell-sequence'&&c.world==='starecho'));
 assert.equal(challenges[14].id,'Q11');assert.equal(challenges[14].version,2);assert.equal(challenges[17].id,'Q10');
});
test('新しい6面は選び直すと満点配線の系統も変わり、再挑戦とクリアは出題を保つ',()=>{
 const values=new Map(),records=new LocalRecords({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),s=new Session(records,{random:()=>0});
 records.saveScore('Q9@1','interval@1',{numerator:'100',denominator:'1'});const previous=records.scores()[0];
 for(const id of ['Q19','Q20','Q21','Q22','Q13','Q14']){
  s.replace({challengeId:id});const c=structuredClone(s.challenge),a=proof.stages.find(p=>p.id===c.draw.id);
  s.circuit=challengeCircuit(c,a.winner);s.start();s.advance(c.maxDuration);assert.equal(s.result.state,'achieved');assert.equal(s.result.score.numerator,'100');s.stop();
  s.clearConnections();assert.deepEqual(s.challenge,c);s.replace({challengeId:id});const b=proof.stages.find(p=>p.id===s.challenge.draw.id);assert.notDeepEqual(a.winner,b.winner);
 }
 assert.deepEqual(records.scores()[0],previous);
 s.replace({challengeId:'Q10'});const c=s.challenge,a=proof.stages.find(p=>p.id===c.draw.id);s.circuit=challengeCircuit(c,a.winner);s.start();s.advance(c.maxDuration);assert.equal(s.clearChoices.nextChallengeId,'Q23');
});
test('旧48出題は変更しない課題で保持し、配置と経路の改訂課題だけ現行の内容版へ分ける',()=>{
 const old=JSON.parse(readFileSync(new URL('../設計検証/テーマ課題/legacy-variants.json',import.meta.url)));
 for(const id of Object.keys(old))assertHistoricalBank(id,old[id]);
});
test('0.5秒未満の続く到達は同じ音へ寄せ、ちょうど0.5秒からは採用音程を使う',()=>{
 const c={goals:['G1','G2','G3'],bellPitches:[72,79,84]},rows=[{node:'G1',time:'2'},{node:'G2',time:'2.49'},{node:'G3',time:'2.99'}],before=structuredClone(rows),plan=arrivalFrequencies(c,rows,new TimeScale(['2.49']));
 assert.equal(plan.get(rows[1]),plan.get(rows[0]));assert.equal(plan.get(rows[2]),440*2**((84-69)/12));assert.deepEqual(rows,before);
 assert.equal(arrivalFrequencies(null,rows,new TimeScale(['2.49'])).get(rows[2]),440);
});
test('音程の適用は実行時間・全記録・満点の判定へ影響しない',()=>{
 for(const authored of challenges.slice(6,12)){
  const c=drawChallenge(authored,{random:()=>0}),a=proof.stages.find(p=>p.id===c.draw.id),run=new Simulation(challengeCircuit(c,a.winner));while(!run.exhausted)run.advanceNext();
  const before=JSON.stringify(run.records),clock=run.clock;const frequencies=arrivalFrequencies(c,run.arrivals(),run.circuit.time);assert.equal(frequencies.size,run.arrivals().length);assert.equal(JSON.stringify(run.records),before);assert.equal(run.clock,clock);
 }
});
test('追加6面の初出題の全到達を独立した整数の時刻表と照合し、未改訂3面の手計算値も保つ',()=>{
 const fixed={Q19:['2.5','3'],Q13:['2.5','3.5'],Q14:['2.5','3.5','4.5']};
 for(const id of ['Q19','Q20','Q21','Q22','Q13','Q14']){
  const c=drawChallenge(challenges.find(c=>c.id===id),{random:()=>0}),a=proof.stages.find(p=>p.id===c.draw.id),run=new Simulation(challengeCircuit(c,a.winner));while(!run.exhausted)run.advanceNext();
  const rows=run.arrivals().map(r=>[r.node,r.time]).sort((a,b)=>Number(a[1])-Number(b[1])||a[0].localeCompare(b[0]));assert.deepEqual(rows,timetable(c,a.winner),id);
  if(fixed[id])assert.deepEqual(run.arrivals().map(r=>r.time),fixed[id],id);
 }
});
