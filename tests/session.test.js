import test from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../src/app/session.js';
import { LocalRecords, STORAGE_KEYS, circuitFile } from '../src/core/storage.js';
import { challenges,challengeCircuit } from '../src/content/challenges.js';
import { sampleCircuit } from '../src/content/samples.js';

function fixture() {
  const values = new Map(); let failing = false; let writes = 0;
  const records = new LocalRecords({getItem:key=>values.get(key) ?? null,setItem:(key,value)=>{ writes++; if (failing) throw new Error('Synthetic quota failure'); values.set(key,value); }});
  return {session:new Session(records),records,values,fail:()=>{failing=true;},recover:()=>{failing=false;},writes:()=>writes};
}
function free(f) { f.session.replace({sampleId:'compare'}); return f.session; }
function authored(s,id){s.replace({challengeId:id});s.challenge=structuredClone(challenges.find(c=>c.id===id));if(id==='Q7'){s.challenge.version=1;s.challenge.candidates=s.challenge.candidates.filter(e=>e.id!=='CD');}s.circuit=challengeCircuit(s.challenge);return s;}
function q1(f) { f.session.connect('S','A'); f.session.connect('A','G'); return f.session; }

test('旧固定版の実践の複数祭壇課題は一つだけの到達では未達成で、全部への到達時間を採点する',()=>{
  const f=fixture(),s=f.session;authored(s,'Q7');s.connectPath(['S','A','B','D','G1']);s.start();s.advance('10');
  assert.equal(s.result.state,'failed');assert.equal(s.result.score.numerator,'0');assert.equal(s.clearChoices,null);assert.equal(f.records.scores().length,0);
  s.stop();authored(s,'Q7');s.connectPath(['S','A','B','D','G1']);s.connectPath(['A','C','E','G2']);s.start();s.advance('3.5');
  assert.equal(s.result.state,'pending');assert.equal(s.result.score,null);assert.equal(s.clearChoices,null);assert.equal(f.records.scores().length,0);
  s.advance('4');assert.equal(s.result.state,'achieved');assert.equal(s.result.evaluatedTime,'4');assert.deepEqual(s.result.score,{numerator:'100',denominator:'1'});
  assert.deepEqual(s.result.goals,[{id:'G1',first:'3.5'},{id:'G2',first:'4'}]);assert.equal(s.clearChoices.nextChallengeId,'Q8');assert.equal(f.records.scores()[0].challenge,'Q7@1');
  const before=s.exportResult();s.stop();assert.deepEqual(s.exportResult().evaluation,before.evaluation);assert.deepEqual(s.exportResult().records,before.records);
});

test('旧固定版の合流の実践課題は一本道では失敗し、順番待ちを含む二到達で達成する',()=>{
  const f=fixture(),s=f.session;authored(s,'Q11');s.connectPath(['S','A','B','D','G']);s.start();s.advance('10');assert.equal(s.result.state,'failed');s.stop();
  authored(s,'Q11');s.connectPath(['S','A','B','D','G']);s.connectPath(['A','C','D']);s.start();s.advance('10');
  assert.equal(s.result.state,'achieved');assert.deepEqual(s.run.arrivals('G').map(r=>r.time),['3.5','4.5']);assert(s.run.records.some(r=>r.type==='process-start'&&r.node==='D'&&r.wait==='0.5'));assert.deepEqual(s.result.score,{numerator:'100',denominator:'1'});
});

test('課題の再構成後も旧版の成績を保持し、新版の成績と混ぜない',()=>{
  const f=fixture();f.records.saveScore('Q6@1','interval@1',{numerator:'100',denominator:'1'});
  const old=structuredClone(f.records.scores()[0]),s=f.session;s.replace({challengeId:'Q6'});for(const id of ['A','B','C'])s.connectPath(['S',id,'G']);s.start();s.advance('5');
  assert.deepEqual(f.records.scores()[0],old);assert.equal(f.records.scores()[1].challenge,'Q6@2');assert.deepEqual(f.records.scores()[1].score,{numerator:'100',denominator:'1'});
});

test('達成した課題だけに次の選択を出し、停止しても配線・結果・記録を残す',()=>{
  const f=fixture(),s=q1(f);assert.equal(s.clearChoices,null);s.start();s.advance('2.5');
  assert.deepEqual(s.clearChoices,{challengeId:'Q1',nextChallengeId:'Q2'});
  const circuit=structuredClone(s.circuit),result=s.exportResult();s.stop();
  assert.deepEqual(s.circuit,circuit);assert.deepEqual(s.exportResult().records,result.records);assert.equal(s.result.state,'achieved');
  assert.equal(s.clearChoices.nextChallengeId,'Q2');s.replace({challengeId:'Q2'});assert.equal(s.clearChoices,null);
  s.connect('S','C');s.start();s.stop();assert.equal(s.clearChoices,null);
  s.replace({challengeId:'Q6'});for(const id of ['A','B','C'])s.connectPath(['S',id,'G']);
  s.start();s.advance('1');assert.equal(s.clearChoices,null);s.advance('5');assert.deepEqual(s.clearChoices,{challengeId:'Q6',nextChallengeId:'Q7'});s.stop();
  s.replace({sampleId:'compare'});s.start();s.advance('3');assert.equal(s.clearChoices,null);s.stop();
  s.replace({challengeId:'Q1'});s.beginGuide();s.connectPath(['S','A','G']);s.start();s.advance('2.5');assert.equal(s.clearChoices,null);
});

test('配線0本では開始せず、自由のクリア後も直前の全記録・結果・保存を保持する',()=>{
  const f=fixture(),s=f.session;
  assert.throws(()=>s.start(),/つないで/);assert.equal(s.run,null);assert.equal(s.result,null);assert.equal(f.writes(),0);
  free(f);s.saveCircuit('元回路');s.start();s.advance('2.5');s.stop();s.clearConnections();
  const run=s.run,result=s.exportResult(),circuit=structuredClone(s.circuit),saved=f.records.slots(),writes=f.writes();
  assert.throws(()=>s.start(),/つないで/);assert.equal(s.run,run);assert.deepEqual(s.exportResult(),result);assert.deepEqual(s.circuit,circuit);assert.deepEqual(f.records.slots(),saved);assert.equal(f.writes(),writes);assert.equal(s.editable,true);
  s.connect('S','A');s.start();assert.equal(s.result.state,'finished');
});

test('連続結線は全体を検査して確定し、候補外では途中の配線も残さない',()=>{
  const s=fixture().session;
  assert.throws(()=>s.connectPath(['S','A','G','B']));assert.equal(s.circuit.edges.length,0);assert.equal(s.dirty,false);
  s.connectPath(['S','A','G']);assert.deepEqual(s.circuit.edges.map(e=>e.id),['SA','AG']);assert.equal(s.selection,'G');
});

test('配線クリアは点・保存回路・停止後の記録を保持し、再生と一時停止では拒否する',()=>{
  const f=fixture(),s=free(f);s.setTime('A','1.5');s.moveNode('B',.8,.4);s.setEnabled('B',false);s.setTime(s.circuit.edges[0].id,'1.2');s.saveCircuit('元回路');const nodes=structuredClone(s.circuit.nodes),saved=structuredClone(f.records.slots());
  s.start();assert.throws(()=>s.clearConnections());s.pause();assert.throws(()=>s.clearConnections());s.stop();
  const run=s.run,oldCircuit=structuredClone(run.circuit.raw),result=structuredClone(s.exportResult());
  s.clearConnections();assert.equal(s.circuit.edges.length,0);assert.equal(s.dirty,true);assert.deepEqual(s.circuit.nodes,nodes);assert.deepEqual(f.records.slots(),saved);
  assert.equal(s.run,run);assert.deepEqual(run.circuit.raw,oldCircuit);assert.deepEqual(s.exportResult(),result);
});

test('自由の連続結線は道の識別子が重ならず、不正な点を含む経路で元の配線を変えない',()=>{
  const s=free(fixture());s.clearConnections();s.connectPath(['S','A','B','G']);assert.equal(new Set(s.circuit.edges.map(e=>e.id)).size,3);
  const before=structuredClone(s.circuit);assert.throws(()=>s.connectPath(['S','missing','G']));assert.deepEqual(s.circuit,before);
});

test('実行から記録で停止、次動作、明示再開、停止後編集を一連で行える',()=>{
  const f=fixture(), s=free(f), original=structuredClone(s.circuit);
  s.start();
  assert.throws(()=>s.setTime('A','1.5'));
  s.advance('1'); s.openRecords();
  assert.equal(s.run.status,'paused'); assert.equal(s.run.pauseReason,'records');
  const first=s.next(); assert.ok(first.some(row=>row.type==='process-end'));
  assert.equal(s.run.format(),'1.5');
  assert.throws(()=>s.connect('S','G'));
  s.resume(); s.advance('2.5');
  assert.equal(s.result.arrivals[0].time,'2.5');
  s.stop(); s.setTime('A','1.5');
  assert.deepEqual(s.exportResult().conditions,original);
  assert.equal(s.exportResult().records.filter(row=>row.type==='goal')[0].time,'2.5');
  s.start(); s.advance('3');
  assert.equal(s.result.arrivals[0].time,'3');
});

test('全候補と制限を守り、途中結線の到達不能は未達成として受け付ける',()=>{
  const f=fixture(),s=f.session;
  assert.throws(()=>s.connect('A','S')); assert.equal(s.circuit.edges.length,0);
  q1(f); assert.throws(()=>s.connect('S','B')); assert.equal(s.circuit.edges.length,2);
  assert.throws(()=>s.setTime('SA','2'));
  s.start(); assert.equal(s.result.state,'pending'); assert.equal(f.records.scores().length,0);
  s.advance('2.5'); assert.equal(s.result.state,'achieved');
  assert.deepEqual(s.result.score,{numerator:'100',denominator:'1'});
  assert.equal(f.records.scores().length,1);
  s.stop(); s.remove('AG',true); s.start();
  assert.equal(s.result.state,'failed'); assert.equal(f.records.scores().length,1);
  assert.deepEqual(s.result.score,{numerator:'0',denominator:'1'});assert.equal(s.pendingScores.size,0);
});

test('AC-17：全評価方式の確定した未達成は0点、成績候補にせず判定待ち・途中中断は無得点',()=>{
  for(const id of ['Q1','Q2','Q3','Q4','Q5']){
    const f=fixture(),s=f.session;s.replace({challengeId:id});s.connect('S','A');s.start();
    assert.equal(s.result.state,'failed');assert.deepEqual(s.result.score,{numerator:'0',denominator:'1'});
    s.stop();assert.equal(s.result.state,'failed');assert.deepEqual(s.exportResult().evaluation.score,{numerator:'0',denominator:'1'});assert.equal(f.records.scores().length,0);assert.equal(s.pendingScores.size,0);
  }
  const f=fixture(),s=f.session;s.replace({challengeId:'Q6'});s.connectPath(['S','A','G']);s.connectPath(['S','B','G']);s.start();
  assert.equal(s.result.state,'pending');assert.equal(s.result.score,null);s.advance('3');assert.equal(s.result.state,'failed');assert.deepEqual(s.result.score,{numerator:'0',denominator:'1'});assert.equal(f.records.scores().length,0);assert.equal(s.pendingScores.size,0);
  const interrupted=q1(fixture());interrupted.start();interrupted.advance('1');interrupted.stop();assert.equal(interrupted.result.state,'stopped');assert.equal(interrupted.result.score,null);
});

test('自由の新しい点・道の初期値、出発点保護、接続付き削除、故障を保つ',()=>{
  const s=free(fixture());
  const prism=s.addNode('prism',0.4,0.3),goal=s.addNode('goal',0.4,0.6);
  const edge=s.connect(prism,goal);
  assert.equal(s.circuit.nodes.find(n=>n.id===prism).process,'0.5');
  assert.equal(s.circuit.edges.find(e=>e.id===edge).time,'1');
  assert.equal(s.circuit.edges.find(e=>e.id===edge).bidirectional,false);
  assert.throws(()=>s.addNode('source',0,0)); assert.throws(()=>s.remove('S',true));
  s.setEnabled(prism,false); s.setEnabled('SA',false);
  assert.equal(s.circuit.nodes.find(n=>n.id===prism).enabled,false);
  assert.equal(s.circuit.edges.find(e=>e.id==='SA').enabled,false);
  assert.throws(()=>s.remove(prism));
  s.remove(prism,true);
  assert.ok(!s.circuit.edges.some(e=>e.id===edge)); assert.ok(s.circuit.nodes.some(n=>n.id===goal));
  s.setFlow('fastest',goal); s.remove(goal,true); assert.equal(s.circuit.target,'all');
});

test('誤入力は条件を変えず、正確な0.1秒刻みと0秒処理を認める',()=>{
  const s=free(fixture()), before=structuredClone(s.circuit);
  for (const text of ['', 'abc', '-1', '0.15', '１.５']) assert.throws(()=>s.setTime('SA',text));
  assert.throws(()=>s.setTime('SA','0')); assert.throws(()=>s.setTime('G','1'));
  assert.deepEqual(s.circuit,before);
  s.setTime('A','000.00'); s.setTime('SA','01.500');
  assert.equal(s.circuit.nodes.find(n=>n.id==='A').process,'0');
  assert.equal(s.circuit.edges.find(e=>e.id==='SA').time,'1.5');
});

test('自由の道は正方向・逆方向・両方向を選べ、位置や他の道を変えない',()=>{
  const s=free(fixture()),before=structuredClone(s.circuit);
  s.setDirection('SA',{reverse:true});
  assert.equal(s.circuit.edges[0].from,'A');assert.equal(s.circuit.edges[0].to,'S');
  s.setDirection('SA',{bidirectional:true});assert.equal(s.circuit.edges[0].bidirectional,true);
  assert.deepEqual(s.circuit.nodes,before.nodes);assert.deepEqual(s.circuit.edges.slice(1),before.edges.slice(1));
  s.start();assert.throws(()=>s.setDirection('SA',{reverse:true}));
});

test('未保存編集の取消と保存失敗では入替えず、再試行成功後だけ読み込む',()=>{
  const f=fixture(), s=free(f); s.setTime('A','1.5');
  const before=structuredClone(s.circuit);
  assert.equal(s.replace({sampleId:'loop'}),false); assert.deepEqual(s.circuit,before);
  f.fail(); assert.throws(()=>s.replace({sampleId:'loop'},{choice:'save',save:{name:'修正案',id:'saved'}}));
  assert.deepEqual(s.circuit,before); assert.equal(s.dirty,true); assert.equal(f.records.slots().length,0);
  assert.deepEqual(s.exportCircuit('修正案').circuit,before);
  f.recover(); assert.equal(s.replace({sampleId:'loop'},{choice:'save',save:{name:'修正案',id:'saved'}}),true);
  assert.equal(s.circuit.mode,'spread'); assert.equal(f.records.slots()[0].name,'修正案');
  assert.deepEqual(f.records.slots()[0].circuit,before);
});

test('不正ファイルは保存して入替の選択でも元の案と10枠を変えない',()=>{
  const f=fixture(),s=free(f); s.setTime('A','1.5');
  const before=structuredClone(s.circuit), count=f.writes();
  const bad={...circuitFile(sampleCircuit()),version:99};
  assert.throws(()=>s.replace({fileText:JSON.stringify(bad)},{choice:'save',save:{name:'現状',id:'saved'}}));
  assert.equal(f.writes(),count); assert.deepEqual(s.circuit,before);
  assert.equal(s.dirty,true); assert.equal(s.name,'自由の回路');
});

test('故障全ケースから最悪を再生し、他ケース再生でも元条件と全件を出力する',()=>{
  const f=fixture(),s=f.session; s.replace({challengeId:'Q4'});
  for (const [from,to] of [['S','A'],['A','G'],['S','B'],['B','G']]) s.connect(from,to);
  const original=structuredClone(s.circuit);
  s.start(); assert.equal(s.cases.length,4); assert.ok(s.cases.every(c=>c.reachable));
  assert.equal(s.run.circuit.edges.get(s.replayCase).enabled,false);
  assert.deepEqual(s.circuit,original); assert.equal(s.result.state,'pending');
  s.advance('2.5'); assert.equal(s.result.state,'achieved');
  const exported=s.exportResult(); assert.equal(exported.faultCases.length,4); assert.deepEqual(exported.originalConditions,original);
  s.stop(); s.start({caseId:'SB'}); assert.equal(s.replayCase,'SB'); assert.deepEqual(s.circuit,original);
  s.stop(); s.remove('BG',true); s.start();
  assert.equal(s.result.state,'failed'); assert.ok(s.cases.some(c=>!c.reachable));
});

test('間隔の達成を実到着後に確定し、停止しても確定結果と成績を保つ',()=>{
  const f=fixture(),s=f.session; s.replace({challengeId:'Q6'});
  for(const id of ['A','B','C']) s.connectPath(['S',id,'G']);
  s.start(); s.advance('1'); assert.equal(s.result.state,'pending'); assert.equal(f.records.scores().length,0);
  s.advance('3'); assert.equal(s.result.state,'pending');
  s.advance('5'); assert.equal(s.result.state,'achieved');
  s.stop(); assert.equal(s.result.state,'achieved'); assert.equal(s.result.first,'1');
  assert.equal(f.records.scores().length,1);
});

test('未確定で停止した間隔を0点失敗にしない',()=>{
  const f=fixture(),s=f.session; s.replace({challengeId:'Q6'});
  for(const id of ['A','B','C']) s.connectPath(['S',id,'G']);
  s.start(); s.advance('1'); s.stop();
  assert.equal(s.result.state,'stopped'); assert.equal(s.result.score,null); assert.equal(f.records.scores().length,0);
});

test('到着前の停止は未確定の中断、既に到達不能なら失敗の確定を保つ',()=>{
  const f=fixture(),s=q1(f); s.start(); s.advance('1'); s.stop();
  assert.equal(s.result.state,'stopped'); assert.equal(s.result.score,null);
  s.remove('AG',true); s.start(); assert.equal(s.result.state,'failed');
  s.stop(); assert.equal(s.result.state,'failed');
  s.replace({challengeId:'Q4'});
  for (const [from,to] of [['S','A'],['A','G'],['S','B'],['B','G']]) s.connect(from,to);
  s.start(); s.stop(); assert.equal(s.result.state,'stopped');
});

test('道の削除も確認前は変更せず、選んだ一本だけを消す',()=>{
  const s=free(fixture()),before=structuredClone(s.circuit);
  assert.throws(()=>s.remove('SA')); assert.deepEqual(s.circuit,before);
  s.remove('SA',true); assert.equal(s.circuit.edges.length,before.edges.length-1);
  assert.ok(s.circuit.edges.some(edge=>edge.id==='AG'));
});

test('成績未保存候補を画面切替後も保持し、無限自動再試行せず戻って保存できる',()=>{
  const f=fixture(),s=q1(f); f.fail(); s.start(); s.advance('2.5');
  const writes=f.writes(); assert.equal(s.pendingScores.size,1);
  s.evaluate(); s.evaluate(); assert.equal(f.writes(),writes);
  s.stop(); s.replace({challengeId:'Q2'});
  assert.equal(s.pendingScores.size,1); assert.equal(f.records.scores().length,0);
  f.recover(); const key=[...s.pendingScores.keys()][0]; assert.equal(s.retryScore(key),true);
  assert.equal(s.pendingScores.size,0); assert.equal(f.records.scores()[0].challenge,'Q1@1');
});

test('案内は別見本で練習し、スキップで元の回路・実行・結果・表示位置へ一時停止で戻る',()=>{
  const f=fixture(),s=free(f); s.replace({sampleId:'loop'}); s.start(); s.advance('4');
  s.view={zoom:2,panX:123,panY:-47,recordPage:3,casePage:0}; s.selection='C';
  const run=s.run,circuit=s.circuit,result=s.result,view=s.view;
  s.beginGuide(); assert.notEqual(s.circuit,circuit); assert.equal(s.circuit.nodes.length,4);
  assert.equal(run.status,'paused'); assert.equal(s.needsGuide('free'),true);
  s.start(); s.advance('2.5');
  assert.throws(()=>s.saveCircuit('練習')); assert.equal(f.records.slots().length,0);
  s.endGuide('skipped');
  assert.equal(s.circuit,circuit); assert.equal(s.run,run); assert.equal(s.result,result);
  assert.equal(s.view,view); assert.equal(s.selection,'C'); assert.equal(s.run.status,'paused');
  assert.equal(s.needsGuide('free'),false); assert.equal(s.needsGuide('challenge'),true);
  s.resume(); s.advance('5'); assert.ok(s.run.arrivals().some(a=>a.time==='5'));
});

test('案内履歴の保存失敗で完了を捏造せず、途中離脱では元へ戻り履歴をつけない',()=>{
  const f=fixture(),s=free(f),original=s.circuit;
  s.beginGuide(); s.start(); s.advance('2.5'); s.stop(); s.setTime('A','1.5'); s.start(); s.advance('3');
  assert.equal(s.guide.readyToFinish,true); f.fail();
  assert.throws(()=>s.endGuide('completed')); assert.ok(s.guide); assert.equal(f.values.has(STORAGE_KEYS.guides),false);
  s.endGuide('interrupted'); assert.equal(s.circuit,original); assert.equal(s.guide,null); assert.equal(s.needsGuide(),true);
});

test('課題案内は結線・到着・記録を体験し、練習成績は本番へ登録しない',()=>{
  const f=fixture(),s=f.session;
  s.beginGuide(); s.connect('S','A'); s.connect('A','G'); s.start();
  assert.equal(s.guide.step,1); assert.throws(()=>s.endGuide('completed'));
  s.advance('2.5'); assert.equal(s.guide.step,2); assert.equal(s.guide.readyToFinish,false);
  assert.equal(f.records.scores().length,0); s.openRecords(); assert.equal(s.guide.readyToFinish,true);
  s.endGuide('completed'); assert.equal(s.circuit.edges.length,0); assert.equal(s.needsGuide('challenge'),false);
});

test('課題の上限を超える合成条件は連続実行と次動作の両方で停止し、最高点と条件を保つ',()=>{
  for(const stepped of [false,true]){
    const f=fixture(),s=q1(f);f.records.saveScore('Q1@1','time@1',{numerator:'100',denominator:'1'});const scores=f.records.scores(),circuit=structuredClone(s.circuit);
    // Synthetic stale bound: not the verified time limit of the shipped Q1.
    s.challenge={...s.challenge,maxDuration:'1'};s.start();if(stepped){s.pause();s.next();}else s.advance('10');
    assert.equal(s.run.format(),'1');assert.equal(s.run.status,'stopped');assert(s.editable);assert.equal(s.result.timeLimitReached,true);assert.equal(s.result.score,null);assert.match(s.result.reason,/上限/);assert.deepEqual(s.circuit,circuit);assert.deepEqual(f.records.scores(),scores);assert(s.exportResult().records.some(r=>r.type==='arrival'&&r.node==='A'));
  }
});

test('自由作成は固定課題の時間上限を引き継がず、長い移動も実験できる',()=>{
  const s=free(fixture());s.setTime('SA','100');s.setTime('SB','100');s.start();s.advance('20');assert.equal(s.run.format(),'20');assert.equal(s.run.status,'running');assert.equal(s.result.timeLimitReached,undefined);s.stop();assert.equal(s.run.format(),'20');
});
