import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/core/simulation.js';
import {Session} from '../src/app/session.js';
import {LocalRecords} from '../src/core/storage.js';
import {TimeoutMotion} from '../src/ui/timeout-motion.js';
import {END_WAIT_MS} from '../src/ui/end-wait.js';
import {arrivalFrequencies} from '../src/content/bell-pitches.js';

function gateCircuit(){
  return {mode:'spread',nodes:[
    {id:'S',kind:'source',process:'0.5'},
    {id:'A',kind:'prism',process:'1',gate:{period:'2',open:'0.5',phase:'0'}},
    {id:'G',kind:'goal',process:'0'},
  ],edges:[{id:'SA1',from:'S',to:'A',time:'1'},{id:'SA2',from:'S',to:'A',time:'1.2'},{id:'AG',from:'A',to:'G',time:'0.5'}]};
}
function mirrorCycle(){
  return {mode:'spread',nodes:[{id:'S',kind:'source',process:'0.5'},
    {id:'M',kind:'mirror',process:'0',reflectTo:'N'},
    {id:'N',kind:'mirror',process:'0',reflectTo:'M'},
    {id:'G',kind:'goal',process:'0'}],edges:[
    {id:'SM',from:'S',to:'M',time:'0.1'},
    {id:'MN',from:'M',to:'N',time:'0'},
    {id:'NM',from:'N',to:'M',time:'0'},
  ]};
}
function timeoutFixture(){
  const values=new Map(),records=new LocalRecords({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)});
  const session=new Session(records);session.challenge=structuredClone(session.challenge);
  session.challenge.maxDuration='1';session.connectPath(['S','A','G']);session.start();session.advance('10');
  return {session,records,values};
}
const quiet=options=>new TimeoutMotion({...options,measure:()=>0});

test('続行中の到達を音と演出へ1回だけ渡し、公式の結果と履歴は変えない',()=>{
  const {session,records}=timeoutFixture(),motion=quiet(),before=session.exportResult(),scores=records.scores();
  motion.update(session,100);assert.deepEqual(motion.entries,[]);
  motion.update(session,600);assert(motion.entries.some(entry=>entry.type==='process-end'));
  motion.update(session,1600);
  const goals=motion.entries.filter(entry=>entry.type==='goal');
  assert.equal(goals.length,1);assert.equal(goals[0].time,'2.5');
  assert.deepEqual(motion.goalHistory,goals);
  motion.update(session,1700);assert.deepEqual(motion.entries,[],'同じ到達を再通知しない');
  assert.deepEqual(session.exportResult(),before);assert.deepEqual(records.scores(),scores);
  motion.clear();assert.deepEqual(motion.entries,[]);assert.deepEqual(motion.goalHistory,[]);
});

test('続行の鐘も締切前の到達と合わせて音程を選び、短い間隔の音をそろえる',()=>{
  const source=new Simulation({mode:'spread',nodes:[{id:'S',kind:'source',process:'0.5'},{id:'G1',kind:'goal',process:'0'},{id:'G2',kind:'goal',process:'0'}],edges:[{id:'SG1',from:'S',to:'G1',time:'0.4'},{id:'SG2',from:'S',to:'G2',time:'0.6'}]});
  source.advanceUntil('0.5');const copy=source.fork({includeRecords:false}),before=structuredClone(source.records);source.complete();
  const session={run:source,timeoutMotionRun:copy,result:{timeLimitReached:true}},motion=quiet();
  motion.update(session,0);motion.update(session,100);
  assert.deepEqual(motion.goalHistory.map(entry=>entry.node),['G1','G2']);
  const frequencies=arrivalFrequencies({goals:['G1','G2'],bellPitches:[72,79]},motion.goalHistory,source.circuit.time);
  assert.equal(frequencies.get(motion.goalHistory[1]),frequencies.get(motion.goalHistory[0]));
  assert.deepEqual(source.records,before);
});

test('表示用分岐は開閉の待ち行列・予約・条件検査・heapを独立させ、続行結果が一致する',()=>{
  const run=new Simulation(gateCircuit());run.advanceUntil('1.5');run.intervalResult('G','1',2);
  const snapshot=structuredClone({records:run.records,particles:run.particles,gates:run.gates,checks:run.intervalChecks,events:run.events.items});
  const fork=run.fork(),expected=new Simulation(gateCircuit());expected.advanceUntil('5');
  assert.equal(run.fork({includeRecords:false}).records.length,0);
  assert.equal(fork.circuit,run.circuit,'compiled conditions remain read-only');
  assert.notEqual(fork.events.items,run.events.items);assert.notEqual(fork.events.items[0],run.events.items[0]);
  assert.notEqual(fork.gates.get('A').queue,run.gates.get('A').queue);
  assert.notEqual(fork.intervalChecks.values().next().value.result,run.intervalChecks.values().next().value.result);
  fork.advanceUntil('5');assert.deepEqual(fork.records,expected.records);
  assert.equal(run.format(),'1.5');
  assert.deepEqual({records:run.records,particles:run.particles,gates:run.gates,checks:run.intervalChecks,events:run.events.items},snapshot);
});

test('分岐は最短経路配列も共有せず、0秒循環の履歴も正しく引き継ぐ',()=>{
  const fastest=new Simulation({...gateCircuit(),mode:'fastest',target:'G'});
  const fastestFork=fastest.fork(),id=[...fastest.particles.keys()][0];
  fastestFork.particles.get(id).route.edges.push('only-copy');
  assert(!fastest.particles.get(id).route.edges.includes('only-copy'));
  const original=new Simulation(mirrorCycle());let count=0;
  original.advanceNext({shouldPause:()=>++count>3});
  const clone=original.fork(),particle=[...original.particles.values()][0],copied=clone.particles.get(particle.id);
  const path=original.instantPaths.get(particle),copiedPath=clone.instantPaths.get(copied);
  assert(path);assert.deepEqual(copiedPath,path);assert.notEqual(copiedPath.visited,path.visited);
  copiedPath.visited.add('copy-only');assert(!path.visited.has('copy-only'));
  original.resume();clone.resume();
  assert.throws(()=>original.advanceUntil('1'),/循環/);assert.throws(()=>clone.advanceUntil('1'),/循環/);
});

test('時間切れ後の表示粒だけが動き、追加到達は公式時刻・結果・全記録・成績へ入らない',()=>{
  const {session,records}=timeoutFixture(),motion=quiet();
  const before=session.exportResult(),scores=records.scores(),official=session.run;
  assert.equal(official.format(),'1');assert.equal(official.exhausted,true);assert.equal(session.result.timeLimitReached,true);
  const picture=motion.update(session,100);assert.equal(picture,session.timeoutMotionRun);
  assert([...picture.particles.values()].some(p=>p.status==='processing'));
  motion.update(session,600);assert([...picture.particles.values()].some(p=>p.status==='moving'&&p.edge==='AG'));
  motion.update(session,1600);assert([...picture.particles.values()].some(p=>p.status==='goal'));
  assert.equal(picture.records.length,0,'temporary history is not retained');
  assert.equal(official.format(),'1');assert.deepEqual(session.exportResult(),before);assert.deepEqual(records.scores(),scores);
  assert.equal(session.result.state,'stopped');assert.match(session.result.reason,/時間切れ/);
  assert(!JSON.stringify(session.exportResult()).includes('timeoutMotionRun'));
  session.stop();assert.equal(session.timeoutMotionRun,null);assert.equal(motion.update(session,1700),null);
  assert.deepEqual(session.exportResult(),{...before,status:'stopped'});
});

test('時間切れの表示継続は最大で未達成カードの待機まで、時刻を巻き戻さない',()=>{
  const {session}=timeoutFixture(),motion=quiet();
  const run=motion.update(session,1000);motion.update(session,1500);
  assert.equal(run.format(),'1.5');motion.update(session,1200);assert.equal(run.format(),'1.5');
  motion.update(session,100000);assert.equal(run.clock,run.circuit.time.ticks('1')+BigInt(END_WAIT_MS)*run.circuit.time.unit/1000n);
});

test('画面を隠す・記録を見る等で中断した表示は同じrunで再開しない',()=>{
  for(const reason of ['hidden','records','load','error']){
    const {session}=timeoutFixture(),motion=quiet();const picture=motion.update(session,0);
    session.pause(reason);assert.equal(motion.update(session,200),null,reason);
    session.pause(null);assert.equal(motion.update(session,400),null,reason+' cannot restart');
    assert.equal(picture.exhausted,true);
  }
  const {session}=timeoutFixture(),motion=quiet();motion.update(session,0);
  assert.equal(motion.update(session,200,{enabled:false}),null);assert.equal(motion.update(session,400),null);
});

test('手動停止・次の実行・課題切替・練習開始は表示コピーを引き継がない',()=>{
  const {session}=timeoutFixture();assert(session.timeoutMotionRun);session.stop();assert.equal(session.timeoutMotionRun,null);
  session.start();assert.equal(session.timeoutMotionRun,null);session.advance('10');assert(session.timeoutMotionRun);
  session.stop();session.replace({challengeId:'Q2'});assert.equal(session.timeoutMotionRun,null);
  session.beginGuide();assert.equal(session.timeoutMotionRun,null);session.endGuide('interrupted');assert.equal(session.timeoutMotionRun,null);
});

test('負荷のある表示継続はイベント数と実時間の双方で打ち切り、公式結果を変更しない',()=>{
  for(const options of [{maxEventsPerFrame:1,measure:()=>0},{budgetMs:1,measure:(()=>{let time=0;return ()=>time++;})()}]){
    const {session}=timeoutFixture(),motion=new TimeoutMotion(options),before=session.exportResult();
    motion.update(session,0);assert.equal(motion.update(session,1900),null);
    assert.deepEqual(session.exportResult(),before);assert.equal(motion.update(session,1950),null);
  }
});

test('表示中の0秒循環でも結果表示を妨げず、公式記録へ追記しない',()=>{
  const source=new Simulation(mirrorCycle());let count=0;source.advanceNext({shouldPause:()=>++count>3});
  const run=source.fork(),records=structuredClone(source.records);source.complete();
  const session={run:source,timeoutMotionRun:run,result:{timeLimitReached:true}},motion=quiet();
  assert(motion.update(session,0));assert.equal(motion.update(session,100),null);
  assert.deepEqual(source.records,records);assert.equal(source.pauseReason,null);
});
