import test from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../src/app/session.js';
import { LocalRecords } from '../src/core/storage.js';
import { challenges,challengeCircuit } from '../src/content/challenges.js';
import { randomVariants } from '../src/content/random-variants.js';
import { drawChallenge } from '../src/content/challenge-draw.js';
import { inspectProblem } from '../scripts/random-challenge-validation.js';
import { readFileSync } from 'node:fs';
const proof=JSON.parse(readFileSync(new URL('../設計検証/ランダム課題/generation.json',import.meta.url),'utf8'));

function fixture(){
  const values=new Map();let failing=false;
  const records=new LocalRecords({getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(failing)throw new Error('Synthetic quota');values.set(key,value);}});
  return {session:new Session(records,{random:()=>0}),records,values,fail:()=>{failing=true;},recover:()=>{failing=false;}};
}
function runPerfect(s){
  const solution=proof.stages.find(p=>p.id===s.challenge.draw.id);
  assert(solution);
  s.circuit=challengeCircuit(s.challenge,solution.winner);
  s.start();s.advance(s.challenge.maxDuration);
  assert.equal(s.result.state,'achieved');assert.deepEqual(s.result.score,{numerator:'100',denominator:'1'});
}

test('選び直しで再抽選し、確認・配線クリア・通常の編集では同じ秒数を保つ',()=>{
  const {session:s}=fixture();
  s.replace({challengeId:'Q7'});
  const first=structuredClone(s.challenge);
  assert.match(first.draw.id,/^[0-9a-f]{16}$/);
  s.replacement({challengeId:'Q7'}); // Incoming-request validation does not draw.
  s.connectPath(['S','A','B']);s.clearConnections();
  assert.deepEqual(s.challenge,first);
  s.replace({challengeId:'Q7'});
  assert.notEqual(s.challenge.draw.id,first.draw.id);
  assert.notDeepEqual(s.challenge.candidates.map(e=>e.time),first.candidates.map(e=>e.time));
});

test('お試し6課題は数値も基準も変えず、抽選を呼ばない',()=>{
  for(const authored of challenges.slice(0,6))assert.deepEqual(drawChallenge(authored,{random:()=>{throw new Error('No draw');}}),authored);
});

test('未保存の自由回路からの取消は出題を消費せず、元回路と保存を保つ',()=>{
  const f=fixture(),s=f.session;s.replace({sampleId:'compare'});s.clearConnections();
  const circuit=structuredClone(s.circuit),values=[...f.values];let draws=0;s.random=()=>{draws++;return 0;};
  assert.equal(s.replace({challengeId:'Q7'}),false);
  assert.equal(draws,0);assert.deepEqual(s.circuit,circuit);assert.deepEqual([...f.values],values);
  s.replace({challengeId:'Q7'},{choice:'discard'});assert.equal(draws,1);
});

test('満点後の再編集・記録閲覧・案内の往復は出題と全記録を保持する',()=>{
  const {session:s}=fixture();s.replace({challengeId:'Q11'});runPerfect(s);
  const problem=structuredClone(s.challenge),file=s.exportResult();s.openRecords();s.stop();
  s.beginGuide();s.endGuide('interrupted');
  assert.deepEqual(s.challenge,problem);assert.deepEqual(s.exportResult(),{...file,status:'stopped'});
  s.clearConnections();assert.deepEqual(s.challenge,problem);assert.deepEqual(s.exportResult().challenge,problem);
});

test('固定版と各出題の成績を別々に残し、元の秒数・条件を記録する',()=>{
  const {session:s,records}=fixture();records.saveScore('Q7@1','delivery-all@1',{numerator:'90',denominator:'1'});
  s.replace({challengeId:'Q7'});runPerfect(s);const first=s.exportResult();s.stop();s.replace({challengeId:'Q7'});runPerfect(s);
  const scores=records.scores();assert.equal(scores.length,3);assert.equal(scores[0].challenge,'Q7@1');
  assert.equal(scores[1].problem.draw.id,first.challenge.draw.id);
  assert.notEqual(scores[1].challenge,scores[2].challenge);
  assert.deepEqual(scores[1].problem.candidates,first.challenge.candidates);
  assert.deepEqual(scores[2].problem,s.challenge);
  assert.throws(()=>records.saveScore(scores[2].challenge,scores[2].rule,scores[2].score,scores[1].problem),/一致/);
  assert.equal(records.scores().length,3);
});

test('成績の保存失敗から別出題へ進んでも、二つの元条件で再保存できる',()=>{
  const f=fixture(),s=f.session;f.fail();s.replace({challengeId:'Q7'});runPerfect(s);const first=s.challenge.draw.id;
  s.stop();s.replace({challengeId:'Q7'});runPerfect(s);assert.equal(s.pendingScores.size,2);
  f.recover();for(const key of [...s.pendingScores.keys()])assert(s.retryScore(key));
  assert.equal(s.pendingScores.size,0);assert.equal(f.records.scores().length,2);assert.equal(f.records.scores()[0].problem.draw.id,first);
});

test('全48出題の全配線で唯一の満点・部分点・分岐や合流待ちと上限を確認する',()=>{
  let count=0;
  for(const authored of challenges.slice(6))for(const variant of randomVariants[authored.id]){
    const problem={...authored,candidates:authored.candidates.map((edge,i)=>({...edge,time:variant.times[i]}))};
    const result=inspectProblem(problem);
    assert(result.valid,authored.id+' '+variant.id);assert.equal(result.winners,1);assert.equal(result.purposeFailures,0);
    assert(result.traps.length>0);assert.equal(result.baseline,variant.baseline);assert.equal(result.maxDuration,variant.maxDuration);
    count++;
  }
  assert.equal(count,48);
});
