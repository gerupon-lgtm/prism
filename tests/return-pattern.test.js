import test from 'node:test';
import assert from 'node:assert/strict';
import {Session} from '../src/app/session.js';
import {LocalRecords} from '../src/core/storage.js';
import {challengeScoreId} from '../src/core/challenge-identity.js';
import {Simulation} from '../src/core/simulation.js';
import {returnPatternResult} from '../src/core/return-pattern.js';

// The first send skips the star's processing. Each return takes 0.4 + 0.2 +
// 0.4 + 0.5 = 1.5 seconds before the star branches again.
function returnChallenge(overrides={}) {
  return {id:'return-test',version:1,name:'星へ戻る',type:'return-pattern',goal:'G',count:3,
    interval:'1.5',baseline:'3.5',maxDuration:'30',limit:3,
    nodes:[{id:'S',kind:'source',process:'0.5'},{id:'A',kind:'prism',process:'0.2'},{id:'G',kind:'goal',process:'0'}],
    candidates:[{id:'SA',from:'S',to:'A',time:'0.4'},{id:'AS',from:'A',to:'S',time:'0.4'},{id:'SG',from:'S',to:'G',time:'0.5'}],
    ...overrides};
}
function fixture(challenge=returnChallenge()) {
  const values=new Map();
  const records=new LocalRecords({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)});
  const session=new Session(records);
  session.challenge=structuredClone(challenge);
  session.circuit={mode:'spread',target:challenge.goal,nodes:structuredClone(challenge.nodes),edges:structuredClone(challenge.candidates)};
  return {session,records,values};
}

test('星へ戻って分岐する課題は最初の3回を正確に判定し、大きな時間送りでも3回目で終了する',()=>{
  const {session:s,records}=fixture();
  s.start();s.advance('0.5');assert.equal(s.result.state,'pending');
  s.advance('20');
  assert.equal(s.result.state,'achieved');
  assert.equal(s.result.first,'0.5');assert.equal(s.result.evaluatedTime,'3.5');
  assert.deepEqual(s.result.score,{numerator:'100',denominator:'1'});
  assert.deepEqual(s.run.arrivals('G').map(row=>row.time),['0.5','2','3.5']);
  assert.equal(s.run.format(),'3.5');assert.equal(s.run.exhausted,true);assert.equal(s.run.activeCount,0);
  assert.equal(s.run.status,'paused');assert.equal(records.scores().length,1);
});

test('星へ戻る出題の成績と元条件を保存し、不正な新条件で旧成績を変えない',()=>{
  const challenge=returnChallenge({draw:{id:'1234567890abcdef',revision:1,number:1}});
  const {session:s,records,values}=fixture(challenge);
  records.saveScore('Q6@1','interval@1',{numerator:'100',denominator:'1'});
  s.start();s.advance('20');
  const scores=records.scores();
  assert.equal(scores.length,2);assert.equal(scores[0].challenge,'Q6@1');
  assert.equal(scores[1].challenge,challengeScoreId(challenge));assert.deepEqual(scores[1].problem,challenge);
  const saved=[...values.entries()];
  for(const changes of [{count:1},{count:2.5},{interval:'0'},{interval:1.5},{goal:'absent'},{baseline:3.5},{maxDuration:30}]) {
    const invalid={...challenge,...changes};
    assert.throws(()=>records.saveScore(challengeScoreId(invalid),'return-pattern@1',{numerator:'100',denominator:'1'},invalid));
    assert.deepEqual([...values.entries()],saved);
  }
});

test('次の動作と連続実行は同じ時刻まで全記録が一致し、最終到達と同時刻の動作を省かない',()=>{
  const challenge=returnChallenge({baseline:'3.4',candidates:returnChallenge().candidates.map(edge=>edge.id==='SG'?{...edge,time:'0.4'}:edge)});
  const direct=fixture(challenge).session,stepped=fixture(challenge).session;
  direct.start();direct.advance('20');
  stepped.start();stepped.pause();
  let steps=0;while(!stepped.run.exhausted&&steps++<100)stepped.next();
  assert(steps<100);assert.equal(direct.run.format(),'3.4');
  assert.deepEqual(stepped.exportResult(),direct.exportResult());
  assert(direct.run.records.some(row=>row.type==='arrival'&&row.node==='A'&&row.time==='3.4'));
  assert(direct.run.records.some(row=>row.type==='process-start'&&row.node==='A'&&row.time==='3.4'));
  assert(direct.run.records.every(row=>Number(row.time)<=3.4));
});

test('指定間隔との差を許さず、次の指定時刻で自動終了して失敗と全記録を停止後も保持する',()=>{
  const {session:s,records}=fixture(returnChallenge({interval:'1.4'}));
  s.start();s.advance('2');assert.equal(s.result.state,'failed');assert.match(s.result.reason,/間隔/);
  s.advance('20');assert.equal(s.run.format(),'1.9');assert.equal(s.run.exhausted,true);
  assert.deepEqual(s.result.score,{numerator:'0',denominator:'1'});assert.equal(records.scores().length,0);
  const result=s.exportResult();s.stop();
  assert.deepEqual(s.exportResult().records,result.records);assert.deepEqual(s.result,result.evaluation);
});

function finiteChallenge(overrides={}) {
  const nodes=[{id:'S',kind:'source',process:'0'},...['A','B','C'].map(id=>({id,kind:'prism',process:'0'})),{id:'G',kind:'goal',process:'0'}];
  const candidates=['A','B','C'].flatMap((id,index)=>[{id:`S${id}`,from:'S',to:id,time:String((index+1)/2)},{id:`${id}G`,from:id,to:'G',time:String((index+1)/2)}]);
  return returnChallenge({nodes,candidates,limit:6,interval:'1',baseline:'3',...overrides});
}

test('最初の星の分岐だけでは達成せず、星へ戻って再び分岐する条件を判定する',()=>{
  const {session:s}=fixture(finiteChallenge());s.start();s.advance('20');
  assert.deepEqual(s.run.arrivals('G').map(row=>row.time),['1','2','3']);
  assert.equal(s.run.format(),'3');assert.equal(s.result.state,'failed');assert.match(s.result.reason,/星.*分岐/);
});

test('最後の判定対象より後の星の分岐を条件の達成に使わない',()=>{
  const challenge=finiteChallenge();challenge.nodes.push({id:'R',kind:'prism',process:'0'});
  challenge.candidates.push({id:'SR',from:'S',to:'R',time:'10'},{id:'RS',from:'R',to:'S',time:'10'});challenge.limit=8;
  const run=new Simulation({mode:'spread',target:'G',nodes:challenge.nodes,edges:challenge.candidates});
  run.advanceUntil('20');assert(run.records.some(row=>row.type==='branch'&&row.node==='S'&&row.time==='20'));
  const result=returnPatternResult(challenge,run);assert.equal(result.state,'failed');assert.equal(result.actual,'3');assert.match(result.reason,/星.*分岐/);
});

test('指定回数へ今後届かない配線は失敗とし、途中停止は未確定の中断として区別する',()=>{
  const {session:missing}=fixture();missing.circuit.edges=missing.circuit.edges.filter(edge=>edge.id!=='AS');
  missing.start();missing.advance('0.5');assert.equal(missing.result.state,'failed');assert.match(missing.result.reason,/回数/);
  missing.stop();assert.equal(missing.result.state,'failed');assert.match(missing.result.reason,/回数/);
  const {session:stopped,records}=fixture();stopped.start();stopped.advance('0.5');stopped.stop();
  assert.equal(stopped.result.state,'stopped');assert.equal(stopped.result.score,null);assert.equal(records.scores().length,0);
  assert.deepEqual(stopped.run.arrivals('G').map(row=>row.time),['0.5']);
});

test('完了後の停止と再実行でも元条件・全記録・確定点・保存済みの最高点を保持する',()=>{
  const {session:s,records}=fixture();s.start();s.advance('20');const completed=s.exportResult(),scores=records.scores();
  s.stop();assert.equal(s.result.state,'achieved');assert.deepEqual(s.exportResult().records,completed.records);
  assert.deepEqual(s.exportResult().conditions,completed.conditions);assert.deepEqual(s.result,completed.evaluation);
  s.start();s.advance('20');assert.deepEqual(s.exportResult(),completed);assert.deepEqual(records.scores(),scores);
});

test('通常の間隔課題は循環の余分な到達を拒み、最初の指定回数では自動終了しない',()=>{
  const {session:s}=fixture(returnChallenge({type:'interval',baseline:'0.5'}));
  s.start();s.advance('3.5');assert.equal(s.result.state,'failed');assert.equal(s.run.exhausted,false);
  s.advance('5');assert.equal(s.run.arrivals('G').length,4);assert.equal(s.run.format(),'5');
  assert.equal(s.result.state,'failed');s.stop();assert.equal(s.result.state,'failed');
  const {session:finite}=fixture(finiteChallenge({type:'interval',baseline:'1'}));
  finite.start();finite.advance('3');assert.equal(finite.result.state,'achieved');assert.equal(finite.result.evaluatedTime,'1');
});

test('完了処理は未来の動作と待ち列を終了させ、鐘の最終表示と記録を残す',()=>{
  const {session:s}=fixture();const run=s.start();run.advanceUntil('1.1');
  const before=structuredClone(run.records),arrived=run.arrivals('G')[0].particle;
  assert(run.activeCount>0);assert.notEqual(run.gates.get('S').current,null);
  run.complete();assert.equal(run.status,'paused');assert.equal(run.exhausted,true);assert.equal(run.nextTime,null);assert.equal(run.activeCount,0);
  assert.equal(run.particles.get(arrived).status,'goal');assert.deepEqual(run.records,before);
  for(const gate of run.gates.values()){assert.equal(gate.current,null);assert.deepEqual(gate.queue,[]);assert.equal(gate.head,0);}
  assert.deepEqual(run.advanceNext(),[]);assert.deepEqual(run.records,before);
});

test('最終到達と同時刻の途中で負荷停止しても、再開後は残りを処理して同じ結果で完了する',()=>{
  const challenge=returnChallenge({baseline:'3.4',candidates:returnChallenge().candidates.map(edge=>edge.id==='SG'?{...edge,id:'00G',time:'0.4'}:edge)});
  const direct=fixture(challenge).session,paused=fixture(challenge).session;
  direct.start();direct.advance('20');
  paused.start();paused.advance('20',{shouldPause:run=>run.arrivals('G').length===3});
  assert.equal(paused.run.pauseReason,'load');assert.equal(paused.run.exhausted,false);assert.equal(paused.run.format(),'3.4');
  paused.resume();paused.advance('20');
  assert.equal(paused.run.exhausted,true);assert.deepEqual(paused.exportResult(),direct.exportResult());
});

test('指定回数の完了を動作上限より先に扱い、未完了の上限停止は中断として記録する',()=>{
  const completed=fixture(returnChallenge({maxDuration:'3.5'})).session;
  completed.start();completed.advance('20');assert.equal(completed.result.state,'achieved');assert.equal(completed.result.timeLimitReached,undefined);
  const {session:limited,records}=fixture(returnChallenge({maxDuration:'2.5'}));
  limited.start();limited.advance('20');assert.equal(limited.run.format(),'2.5');assert.equal(limited.run.status,'stopped');
  assert.equal(limited.result.state,'stopped');assert.equal(limited.result.timeLimitReached,true);assert.equal(limited.result.score,null);assert.equal(records.scores().length,0);
});
