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

test('24面を6面のテーマへ整理し、古い課題IDと版を番号から分離する',()=>{
 assert.deepEqual(challenges.map(challengeLabel),Array.from({length:24},(_,i)=>'Q'+(i+1)));
 assert.equal(new Set(challenges.map(c=>c.id)).size,24);
 assert(challenges.slice(6,12).every(c=>c.type==='delivery-all'&&c.world==='starwalk'));
 assert(challenges.slice(12,18).every(c=>c.type==='interval'&&c.world==='moonwater'));
 assert(challenges.slice(18).every(c=>c.type==='bell-sequence'&&c.world==='starecho'));
 assert.equal(challenges[14].id,'Q11');assert.equal(challenges[14].version,1);assert.equal(challenges[17].id,'Q10');
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
test('既存48出題の秒数と識別子は再編前と同一で、同じ成績へ紐付く',()=>{
 const old=JSON.parse(readFileSync(new URL('../設計検証/テーマ課題/legacy-variants.json',import.meta.url)));
 for(const id of Object.keys(old))assert.deepEqual(randomVariants[id],old[id],id);
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
test('追加6面の最初の出題は、分岐後に処理秒数と道を足した手計算の時刻表と一致する',()=>{
 // Initial source send is at0. S->A: .5 travel + .5 A process =1.
 // Then branch travel/processing: Q19 B at2/C at2.5, Q20 D at3, Q21 C at3, Q22 D at3/E at3.5.
 const expected={Q19:['2.5','3'],Q20:['3.5','4','4'],Q21:['3','3.5','4'],Q22:['3.5','4','4.5'],Q13:['2.5','3.5'],Q14:['2.5','3.5','4.5']};
 for(const [id,times] of Object.entries(expected)){
  const c=drawChallenge(challenges.find(c=>c.id===id),{random:()=>0}),a=proof.stages.find(p=>p.id===c.draw.id),run=new Simulation(challengeCircuit(c,a.winner));while(!run.exhausted)run.advanceNext();assert.deepEqual(run.arrivals().map(r=>r.time),times,id);
 }
});
