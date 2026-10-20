import test from 'node:test';
import assert from 'node:assert/strict';
import {TimeScale} from '../src/core/time.js';
import {gateState,nextGateOpen} from '../src/core/periodic.js';
import {createCircuit,shortestPath} from '../src/core/circuit.js';
import {Simulation} from '../src/core/simulation.js';
import {Session} from '../src/app/session.js';
import {LocalRecords,circuitFile,readCircuitFile} from '../src/core/storage.js';

test('周期の開始は開き、開く時間の終端は閉じる。位相と次の境界を正確な時計で求める',()=>{
  const gate={period:'2',open:'0.5',phase:'0.2'},scale=new TimeScale(Object.values(gate));
  assert.deepEqual(gateState(gate,scale,scale.ticks('0')),{open:true,remaining:3n,phase:2n});
  assert.deepEqual(gateState(gate,scale,scale.ticks('0.3')),{open:false,remaining:15n,phase:5n});
  assert.equal(nextGateOpen(gate,scale,scale.ticks('0.3')),scale.ticks('1.8'));
  assert.deepEqual(gateState(gate,scale,scale.ticks('1.8')),{open:true,remaining:5n,phase:0n});
  assert.equal(nextGateOpen(gate,scale,scale.ticks('1.8')),scale.ticks('1.8'));
  assert.equal(gateState({period:'2',open:'2',phase:'0'},scale,scale.ticks('2')).open,true);
});

function gatedCircuit(overrides={}) {
  return {mode:'spread',target:'G',nodes:[{id:'S',kind:'source',process:'0'},
    {id:'P',kind:'prism',process:'0.4',gate:{period:'2',open:'0.5',phase:'0'}},{id:'G',kind:'goal',process:'0'}],
    edges:[{id:'first',from:'S',to:'P',time:'1'},{id:'second',from:'S',to:'P',time:'1.2'},{id:'third',from:'S',to:'P',time:'1.3'},{id:'PG',from:'P',to:'G',time:'0.5'}],...overrides};
}

test('閉じた到達は開くまで順番を保ち、開始した処理は閉じても最後まで進める',()=>{
  const input=gatedCircuit(),run=new Simulation(input);run.advanceUntil('1.3');
  assert.deepEqual(run.circuit.raw.nodes[1].gate,input.nodes[1].gate);
  assert.equal(run.records.some(row=>row.type==='process-start'),false);assert.equal(run.activeCount,3);assert.equal(run.exhausted,false);
  assert.equal(run.format(run.nextTime),'2');assert.equal(run.events.items.filter(event=>event.kind==='opening').length,1);
  run.advanceUntil('5');
  const starts=run.records.filter(row=>row.type==='process-start');
  assert.deepEqual(starts.map(row=>[row.arrivedAt,row.time,row.wait]),[['1','2','1'],['1.2','2.4','1.2'],['1.3','4','2.7']]);
  assert.deepEqual(run.records.filter(row=>row.type==='process-end').map(row=>row.time),['2.4','2.8','4.4']);
  assert.deepEqual(run.arrivals('G').map(row=>row.time),['2.9','3.3','4.9']);assert.equal(run.exhausted,true);
});

test('最短経路はプリズムの到達時点の開閉待ちを含め、開始位置で有利な経路が変わる',()=>{
  const input={mode:'fastest',target:'G',nodes:[{id:'S',kind:'source',process:'0'},
    {id:'P',kind:'prism',process:'0.2',gate:{period:'2',open:'0.5',phase:'0'}},{id:'B',kind:'prism',process:'0'},{id:'G',kind:'goal',process:'0'}],
    edges:[{id:'SP',from:'S',to:'P',time:'0.6'},{id:'PG',from:'P',to:'G',time:'0.2'},{id:'SB',from:'S',to:'B',time:'0.7'},{id:'BG',from:'B',to:'G',time:'0.7'}]};
  let run=new Simulation(input);assert.deepEqual(shortestPath(run.circuit,'G').edges,['SB','BG']);run.advanceUntil('10');
  assert.equal(run.arrivals('G')[0].time,'1.4');assert.equal(run.records[0].plannedTime,'1.4');
  input.nodes[1].gate.phase='1.4';run=new Simulation(input);
  assert.deepEqual(shortestPath(run.circuit,'G').edges,['SP','PG']);run.advanceUntil('10');
  assert.equal(run.arrivals('G')[0].time,'1');assert.equal(run.records[0].plannedTime,'1');
});

function sessionFixture(input=gatedCircuit()) {
  const values=new Map(),records=new LocalRecords({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)});
  const session=new Session(records);session.replace({fileText:JSON.stringify(circuitFile(input,'周期の回路'))});
  return {session,records,values};
}

test('開始位置を細かい秒数も落とさず取り込み、編集前条件と実行条件を別々に出力する',()=>{
  const input=gatedCircuit();input.nodes[1].process='0.1';input.nodes[1].gate={period:'0.3',open:'0.1',phase:'0.05'};
  input.edges=[{id:'SP',from:'S',to:'P',time:'0.1'},{id:'PG',from:'P',to:'G',time:'0.1'}];
  const {session:s}=sessionFixture(input),original=structuredClone(s.circuit);
  s.start({phaseOffset:'0.025'});s.advance('1');
  assert.equal(s.run.circuit.raw.nodes[1].gate.phase,'0.075');assert.equal(s.run.arrivals('G')[0].time,'0.425');
  assert.deepEqual(s.circuit,original);assert.deepEqual(s.runContext.original,original);assert.equal(s.runContext.phaseOffset,'0.025');
  const result=s.exportResult();assert.equal(result.phaseOffset,'0.025');assert.deepEqual(result.originalConditions,original);
  assert.equal(result.conditions.nodes[1].gate.phase,'0.075');
  s.stop();s.start({phaseOffset:result.phaseOffset});s.advance('1');assert.deepEqual(s.exportResult(),result);
});

test('出題の元の周期を変えず、成績には採点した開始位置を添えて再現できるようにする',()=>{
  const input=gatedCircuit();input.edges=input.edges.filter(edge=>['first','PG'].includes(edge.id));
  const {session:s,records}=sessionFixture(input);
  s.mode='challenge';s.challenge={id:'periodic-test',version:1,name:'開く時を選ぶ',type:'delivery-all',goal:'G',goals:['G'],baseline:'1.9',maxDuration:'10',limit:2,nodes:structuredClone(input.nodes),candidates:structuredClone(input.edges),draw:{id:'0123456789abcdef',revision:1,number:1}};
  const authored=structuredClone(s.challenge);s.start({phaseOffset:'1'});s.advance('5');
  assert.equal(s.result.state,'achieved');assert.equal(s.result.evaluatedTime,'1.9');
  assert.deepEqual(s.challenge,authored);assert.equal(records.scores().length,1);
  const saved=records.scores()[0].problem;assert.equal(saved.nodes[1].gate.phase,'0');assert.equal(saved.capturedStartOffset,'1');
});

test('開く境界では直ちに始まり、閉じる境界と同時の処理終了では次の開放まで待つ',()=>{
  for(const [arrival,start] of [['0.4','0.4'],['0.5','2'],['2','2']]) {
    const input=gatedCircuit();input.edges=[{id:'SP',from:'S',to:'P',time:arrival},input.edges.at(-1)];
    const run=new Simulation(input);run.advanceUntil('5');assert.equal(run.records.find(row=>row.type==='process-start').time,start);
  }
  const input=gatedCircuit();input.nodes[1].process='0.5';
  const run=new Simulation(input);run.advanceUntil('8');
  assert.deepEqual(run.records.filter(row=>row.type==='process-start').map(row=>row.time),['2','4','6']);
  input.nodes[1].gate.open='2';const always=new Simulation(input);always.advanceUntil('8');
  assert.deepEqual(always.records.filter(row=>row.type==='process-start').map(row=>row.time),['1','1.5','2']);
});

function orderingCircuit() {
  return {mode:'spread',target:'G',nodes:[{id:'S',kind:'source',process:'0'},{id:'A',kind:'prism',process:'1'},
    {id:'P',kind:'prism',process:'0.4',gate:{period:'2',open:'0.5',phase:'0'}},{id:'G',kind:'goal',process:'0'}],
    edges:[{id:'SA',from:'S',to:'A',time:'1'},{id:'SP',from:'S',to:'P',time:'1'},{id:'late',from:'S',to:'P',time:'2'},
      {id:'AG',from:'A',to:'G',time:'0.1'},{id:'PG',from:'P',to:'G',time:'0.1'}]};
}

test('同時刻は処理終了、開く処理、新しい到達の順とし、先に待った光を優先する',()=>{
  const run=new Simulation(orderingCircuit());run.advanceUntil('5');
  const rows=run.records.filter(row=>row.time==='2');
  assert.deepEqual(rows.map(row=>[row.type,row.node]),[['process-end','A'],['travel','A'],['process-start','P'],['arrival','P']]);
  assert.deepEqual(run.records.filter(row=>row.type==='process-start'&&row.node==='P').map(row=>[row.arrivedAt,row.time]),[['1','2'],['2','2.4']]);
});

test('開く時刻の途中で負荷停止しても再開で全記録が一致し、大きな時間送りも次動作と一致する',()=>{
  const input=orderingCircuit(),expected=new Simulation(input);expected.advanceUntil('20');
  const paused=new Simulation(input);
  paused.advanceUntil('20',{shouldPause:run=>run.records.some(row=>row.type==='process-start'&&row.node==='P'&&row.time==='2')});
  assert.equal(paused.pauseReason,'load');assert.equal(paused.format(),'2');assert.equal(paused.exhausted,false);
  paused.resume();paused.advanceUntil('20');assert.deepEqual(paused.records,expected.records);
  const stepped=new Simulation(input);let steps=0;while(!stepped.exhausted&&steps++<100)stepped.advanceNext();
  assert(steps<100);stepped.advanceUntil('20');assert.deepEqual(stepped.records,expected.records);
  assert.equal(stepped.format(),expected.format());
});

test('閉じて待つ間の一時停止は時計を変えず、明示停止と完了は開く予定を消して記録を残す',()=>{
  for(const complete of [false,true]) {
    const run=new Simulation(gatedCircuit());run.advanceUntil('1.3');const records=structuredClone(run.records);
    run.pause('records');assert.equal(run.format(),'1.3');assert.equal(run.hasFutureArrival('G'),true);
    if(complete)run.complete();else run.stop();
    assert.equal(run.exhausted,true);assert.equal(run.nextTime,null);assert.equal(run.activeCount,0);assert.equal(run.gates.get('P').opening,null);
    assert.deepEqual(run.advanceNext(),[]);assert.deepEqual(run.records,records);
    if(!complete){run.resume();run.advanceUntil('20');assert.equal(run.format(),'1.3');assert.equal(run.status,'stopped');}
  }
  const run=new Simulation(gatedCircuit());run.advanceUntil('1.3');run.pause('records');run.resume();run.advanceUntil('5');
  assert.deepEqual(run.arrivals('G').map(row=>row.time),['2.9','3.3','4.9']);
});

test('周期条件は複製して保存し、細かい周期の単位も計算から落とさない',()=>{
  const input=gatedCircuit();input.nodes[1].gate={period:'0.03',open:'0.01',phase:'0'};input.nodes[1].process='0';
  input.edges=[{id:'SP',from:'S',to:'P',time:'0.1'},{id:'PG',from:'P',to:'G',time:'0.1'}];
  const run=new Simulation(input),file=circuitFile(input,'短い周期');input.nodes[1].gate.period='99';
  assert.equal(run.circuit.raw.nodes[1].gate.period,'0.03');assert.equal(run.circuit.time.digits,2);
  assert.deepEqual(readCircuitFile(JSON.stringify(file)),file);run.advanceUntil('1');assert.equal(run.arrivals('G')[0].time,'0.22');
});

test('不正な周期、開く時間、開始位置、役割は拒み、元の入力を変更しない',()=>{
  const invalid=[null,[],{}, {period:'0',open:'0.1',phase:'0'}, {period:'2',open:'0',phase:'0'},
    {period:'2',open:'2.1',phase:'0'}, {period:'2',open:'0.5',phase:'2'}, {period:'2',open:'0.5',phase:'-0.1'},
    {period:2,open:'0.5',phase:'0'}, {period:'2',open:0.5,phase:'0'}, {period:'2',open:'0.5',phase:0}];
  for(const gate of invalid) {
    const input=gatedCircuit();input.nodes[1].gate=gate;const before=structuredClone(input);
    assert.throws(()=>createCircuit(input));assert.deepEqual(input,before);
  }
  for(const role of ['source','goal','mirror']) {
    const input=gatedCircuit();
    if(role==='mirror'){input.nodes[1].kind='mirror';input.nodes[1].reflectTo='G';}
    else{delete input.nodes[1].gate;input.nodes.find(node=>node.kind===role).gate={period:'2',open:'1',phase:'0'};}
    assert.throws(()=>createCircuit(input));
  }
});

test('開始位置は各周期で折り返し、不正入力では直前の実行・保存・編集条件を保持する',()=>{
  const input=gatedCircuit();input.nodes[1].gate.phase='1.5';input.nodes.push({id:'Q',kind:'prism',process:'0',gate:{period:'3',open:'0.5',phase:'0.2'}});
  const {session:s,values}=sessionFixture(input);s.start({phaseOffset:'3.7'});
  assert.equal(s.run.circuit.raw.nodes[1].gate.phase,'1.2');assert.equal(s.run.circuit.raw.nodes[3].gate.phase,'0.9');s.stop();
  const oldRun=s.run,oldResult=s.exportResult(),oldCircuit=structuredClone(s.circuit),saved=[...values.entries()];
  for(const phaseOffset of [-1,0,null,'','-0.1','abc','1e3',' 1 ']) {
    assert.throws(()=>s.start({phaseOffset}));assert.equal(s.run,oldRun);assert.deepEqual(s.exportResult(),oldResult);
    assert.deepEqual(s.circuit,oldCircuit);assert.deepEqual([...values.entries()],saved);
  }
});

test('周期なしの回路と鏡の選択方向を保ち、鏡の先の周期待ちも最短経路へ含める',()=>{
  const input={mode:'fastest',target:'G',nodes:[{id:'S',kind:'source',process:'0'},{id:'M',kind:'mirror',process:'0.2',reflectTo:'P'},
    {id:'P',kind:'prism',process:'0.2',gate:{period:'1',open:'0.5',phase:'0'}},{id:'G',kind:'goal',process:'0'}],
    edges:[{id:'SM',from:'S',to:'M',time:'0.4'},{id:'MP',from:'M',to:'P',time:'0.2'},{id:'MG',from:'M',to:'G',time:'0.1'},{id:'PG',from:'P',to:'G',time:'0.2'}]};
  let run=new Simulation(input);assert.deepEqual(shortestPath(run.circuit,'G').edges,['SM','MP','PG']);run.advanceUntil('2');assert.equal(run.arrivals('G')[0].time,'1.4');
  delete input.nodes[2].gate;run=new Simulation(input);run.advanceUntil('2');assert.equal(run.arrivals('G')[0].time,'1.2');
  const {session:s}=sessionFixture(input);s.start();s.advance('2');assert.equal(s.runContext.phaseOffset,'0');assert.deepEqual(s.run.records,run.records);assert.deepEqual(s.run.circuit.raw,createCircuit(input).raw);
});
