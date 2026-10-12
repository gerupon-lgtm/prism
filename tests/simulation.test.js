import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/core/simulation.js';

export function loopExample() {
  return {
    mode: 'spread', target: 'all',
    nodes: [
      { id: 'S', kind: 'source', process: '0.5' },
      ...['A', 'B', 'D', 'E'].map(id => ({ id, kind: 'prism', process: '0' })),
      { id: 'C', kind: 'prism', process: '1' },
      ...['G1', 'G2'].map(id => ({ id, kind: 'goal', process: '0' })),
    ],
    edges: [
      ...[['SA','S','A'], ['SB','S','B'], ['AC','A','C'], ['BC','B','C'], ['CG1','C','G1'], ['EC','E','C']].map(([id, from, to]) => ({ id, from, to, time: '1' })),
      { id: 'CG2', from: 'C', to: 'G2', time: '2' },
      { id: 'CD', from: 'C', to: 'D', time: '0.5' },
      { id: 'DE', from: 'D', to: 'E', time: '0.5' },
    ],
  };
}

test('自由の見本2はCで順番に処理し、G1に4・5・7・8秒、G2に5・6・8・9秒で到達する', () => {
  const run = new Simulation(loopExample());
  run.advanceUntil('9');
  assert.deepEqual(run.arrivals('G1').map(e => e.time), ['4', '5', '7', '8']);
  assert.deepEqual(run.arrivals('G2').map(e => e.time), ['5', '6', '8', '9']);
  const starts = run.records.filter(e => e.type === 'process-start' && e.node === 'C');
  assert.deepEqual(starts.slice(0, 4).map(e => [e.arrivedAt, e.time]), [['2','2'], ['2','3'], ['5','5'], ['6','6']]);
  assert.equal(run.exhausted, false);
});

test('次の動作と連続実行が同じ記録になり、0秒処理を同時刻に反映する', () => {
  const continuous = new Simulation(loopExample());
  continuous.advanceUntil('9');
  const stepping = new Simulation(loopExample());
  while (stepping.events.peek()?.at <= stepping.circuit.time.ticks('9')) stepping.advanceNext();
  assert.deepEqual(stepping.records, continuous.records);
  const first = new Simulation(loopExample());
  first.advanceNext();
  assert.equal(first.format(), '1');
  assert.equal(first.records.filter(r => r.type === 'process-end' && r.time === '1').length, 2);
});

test('全祭壇への最速同時送信は選択経路を保ち、共有する処理点の混雑を実到達へ加える', () => {
  const graph = { mode: 'fastest', target: 'all', nodes: [
    { id: 'S', kind: 'source', process: '8' }, { id: 'A', kind: 'prism', process: '1' },
    { id: 'G1', kind: 'goal', process: '0' }, { id: 'G2', kind: 'goal', process: '0' },
  ], edges: [['SA','S','A'], ['AG1','A','G1'], ['AG2','A','G2']].map(([id,from,to]) => ({id,from,to,time:'1'})) };
  const run = new Simulation(graph);
  run.advanceUntil('4');
  assert.deepEqual(run.records.filter(e => e.type === 'send').map(e => e.plannedTime), ['3','3']);
  assert.deepEqual(run.arrivals().map(e => [e.node,e.time]), [['G1','3'], ['G2','4']]);
  assert.equal(run.records.some(e => e.type === 'branch'), false);
});

test('戻った出発点は処理するが初回送出には処理を加えない', () => {
  const graph = { mode: 'spread', nodes: [
    { id: 'S', kind: 'source', process: '0.5' },
    ...['A','B'].map(id => ({id,kind:'prism',process:'0'})),
    {id:'G',kind:'goal',process:'0'},
  ], edges: [['SA','S','A'], ['AB','A','B'], ['BS','B','S'], ['SG','S','G']].map(([id,from,to]) => ({id,from,to,time:'1'})) };
  const run = new Simulation(graph);
  run.advanceUntil('4.5');
  assert.deepEqual(run.arrivals().map(e => e.time), ['1','4.5']);
  assert.deepEqual(run.records.filter(e => e.type === 'process-start' && e.node === 'S').map(e => e.time), ['3']);
});

test('平行道は別の道として折り返せるが、直前の道そのものへは送り返さない', () => {
  const graph = { mode:'spread', nodes:[{id:'S',kind:'source',process:'0'},{id:'A',kind:'prism',process:'0'},{id:'G',kind:'goal',process:'0'}], edges:[
    {id:'one',from:'S',to:'A',time:'1',bidirectional:true},
    {id:'two',from:'S',to:'A',time:'2',bidirectional:true},
    {id:'goal',from:'S',to:'G',time:'1'},
  ]};
  const run = new Simulation(graph);
  run.advanceUntil('2');
  const outward = run.records.find(e => e.type === 'travel' && e.edge === 'one');
  const returns = run.records.filter(e => e.type === 'travel' && e.particle === outward.particle);
  assert.deepEqual(returns.map(e => e.edge), ['one','two']);
});

test('行き止まりは処理後に終了し、絵を残しても次の粒のゲートを塞がない', () => {
  const graph = {mode:'spread', nodes:[{id:'S',kind:'source',process:'0'},{id:'A',kind:'prism',process:'1'}],edges:[
    {id:'a',from:'S',to:'A',time:'1'},{id:'b',from:'S',to:'A',time:'1'},
  ]};
  const run = new Simulation(graph);
  run.advanceUntil('3');
  assert.deepEqual(run.records.filter(e => e.type === 'deadend').map(e => e.time), ['2','3']);
  assert.equal([...run.particles.values()].filter(p => p.status === 'deadend').length, 2);
  assert.equal(run.exhausted, true);
});

test('負荷による停止は未処理の同時刻イベントを保持し、続行で通常実行と一致する', () => {
  const expected = new Simulation(loopExample());
  expected.advanceUntil('9');
  const actual = new Simulation(loopExample());
  let operations = 0;
  actual.advanceNext({ shouldPause: () => ++operations > 2 });
  assert.equal(actual.pauseReason, 'load');
  assert.equal(actual.status, 'paused');
  assert.equal(actual.exhausted, false);
  actual.resume();
  actual.advanceUntil('9');
  assert.deepEqual(actual.records, expected.records);
});

test('停止は粒の絵を消して条件と記録を残し、新しい実行は前の粒を引き継がない', () => {
  const run = new Simulation(loopExample());
  run.advanceUntil('5');
  const records = structuredClone(run.records);
  run.stop();
  assert.equal(run.particles.size, 0);
  assert.deepEqual(run.records, records);
  run.resume();
  run.advanceNext();
  assert.equal(run.status, 'stopped');
  const restarted = new Simulation(run.circuit.raw);
  restarted.advanceUntil('5');
  assert.deepEqual(restarted.records, records);
});

test('到達不能が混ざる全祭壇送信でも、到達できる祭壇には送る', () => {
  const run = new Simulation({mode:'fastest', target:'all', nodes:[{id:'S',kind:'source',process:'0'}, {id:'G1',kind:'goal',process:'0'}, {id:'G2',kind:'goal',process:'0'}],edges:[{id:'one',from:'S',to:'G1',time:'1'}]});
  run.advanceUntil('1');
  assert.deepEqual(run.arrivals().map(e => e.node), ['G1']);
  assert.deepEqual(run.records.filter(e => e.type === 'unreachable').map(e => e.target), ['G2']);
});
