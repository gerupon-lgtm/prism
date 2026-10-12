import test from 'node:test';
import assert from 'node:assert/strict';
import { createCircuit, shortestPath } from '../src/core/circuit.js';
import { TimeScale } from '../src/core/time.js';

const example = () => ({
  mode: 'fastest', target: 'G',
  nodes: [
    { id: 'S', kind: 'source', process: '7.0' },
    { id: 'A', kind: 'prism', process: '0.5' },
    { id: 'B', kind: 'prism', process: '0' },
    { id: 'G', kind: 'goal', process: '9' },
  ],
  edges: [
    { id: 'SA', from: 'S', to: 'A', time: '1' },
    { id: 'AG', from: 'A', to: 'G', time: '1' },
    { id: 'SB', from: 'S', to: 'B', time: '1.5' },
    { id: 'BG', from: 'B', to: 'G', time: '1.5' },
  ],
});

test('設計の見本1は2.5秒、Aの処理を変えると別経路の3秒になる', () => {
  const first = createCircuit(example());
  assert.equal(first.time.format(shortestPath(first, 'G').time), '2.5');
  assert.deepEqual(shortestPath(first, 'G').edges, ['SA', 'AG']);
  const next = example();
  next.nodes[1].process = '1.5';
  const changed = createCircuit(next);
  assert.equal(changed.time.format(shortestPath(changed, 'G').time), '3');
  assert.deepEqual(shortestPath(changed, 'G').edges, ['SB', 'BG']);
});

test('浮動小数の誤差で0.1＋0.2と0.3の順位が変わらず、同時間なら少ない本数を選ぶ', () => {
  const graph = { mode: 'fastest', nodes: [{ id: 'S', kind: 'source', process: '0' }, { id: 'A', kind: 'prism', process: '0' }, { id: 'G', kind: 'goal', process: '0' }], edges: [
    { id: '1', from: 'S', to: 'A', time: '0.1' }, { id: '2', from: 'A', to: 'G', time: '0.2' }, { id: '3', from: 'S', to: 'G', time: '0.3' },
  ] };
  const circuit = createCircuit(graph);
  assert.deepEqual(shortestPath(circuit, 'G').edges, ['3']);
  assert.equal(circuit.time.format(shortestPath(circuit, 'G').time), '0.3');
});

test('平行な道と両方向、使用不可、祭壇が終点であることを守る', () => {
  const graph = example();
  graph.edges[0].enabled = false;
  graph.edges.push({ id: 'GS', from: 'G', to: 'S', time: '0.1', bidirectional: true });
  const circuit = createCircuit(graph);
  assert.deepEqual(shortestPath(circuit, 'G').edges, ['GS']);
  graph.edges.at(-1).bidirectional = false;
  assert.deepEqual(shortestPath(createCircuit(graph), 'G').edges, ['SB', 'BG']);
  graph.edges[2].enabled = false;
  assert.equal(shortestPath(createCircuit(graph), 'G'), null);
});

test('回路入力を変更しても計算条件の写しを変えない', () => {
  const graph = example();
  const circuit = createCircuit(graph);
  graph.edges[0].time = '99';
  graph.nodes[1].process = '88';
  assert.equal(circuit.time.format(shortestPath(circuit, 'G').time), '2.5');
});

test('不正な道・識別子・役割・時間・向き・送信先を検査する', () => {
  const mutations = [
    graph => { graph.edges[0].time = '0.09'; },
    graph => { graph.nodes[1].process = '-0.1'; },
    graph => { graph.edges[0].to = 'S'; },
    graph => { graph.edges[0].to = 'missing'; },
    graph => { graph.edges[0].id = 'S'; },
    graph => { graph.nodes[1].kind = 'source'; },
    graph => { graph.nodes[0].enabled = false; },
    graph => { graph.nodes[1].kind = 'unknown'; },
    graph => { graph.nodes[1].x = Infinity; },
    graph => { graph.edges[0].enabled = 'false'; },
    graph => { graph.edges[0].bidirectional = 'yes'; },
    graph => { graph.target = 'A'; },
  ];
  for (const mutate of mutations) { const graph = example(); mutate(graph); assert.throws(() => createCircuit(graph)); }
});

test('400個の小回路で、独立した全単純経路の列挙と最短時間・本数を照合する', () => {
  let seed = 9047;
  const random = max => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
  for (let sample = 0; sample < 400; sample++) {
    const n = 2 + random(5);
    const nodes = Array.from({ length: n }, (_, i) => ({ id: `n${i}`, kind: i === 0 ? 'source' : i === n - 1 ? 'goal' : 'prism', process: random(4) / 10, enabled: i === 0 || i === n - 1 || random(6) !== 0 }));
    const edges = [];
    for (let i = 0; i < 14; i++) {
      const from = random(n), to = random(n);
      if (from !== to) edges.push({ id: `e${i}`, from: `n${from}`, to: `n${to}`, time: (1 + random(15)) / 10, bidirectional: random(3) === 0, enabled: random(5) !== 0 });
    }
    // Oracle uses original graph and integer tenths, not compiled adjacency or Dijkstra.
    const solutions = [];
    const enumerate = (node, seen, cost, hops) => {
      if (node === n - 1) { solutions.push({ cost, hops }); return; }
      for (const edge of edges) {
        if (!edge.enabled) continue;
        let to;
        if (edge.from === `n${node}`) to = Number(edge.to.slice(1));
        else if (edge.bidirectional && edge.to === `n${node}`) to = Number(edge.from.slice(1));
        else continue;
        if (seen.has(to) || !nodes[to].enabled) continue;
        enumerate(to, new Set([...seen, to]), cost + Math.round(edge.time * 10) + (to === n - 1 ? 0 : Math.round(nodes[to].process * 10)), hops + 1);
      }
    };
    enumerate(0, new Set([0]), 0, 0);
    solutions.sort((a,b) => a.cost - b.cost || a.hops - b.hops);
    const actual = shortestPath(createCircuit({ mode: 'fastest', nodes, edges }), `n${n-1}`);
    if (!solutions.length) assert.equal(actual, null, `sample ${sample}`);
    else { assert.equal(actual.time, BigInt(solutions[0].cost), `sample ${sample} time`); assert.equal(actual.edges.length, solutions[0].hops, `sample ${sample} hops`); }
  }
});

test('非常に細かい時間単位でも有限の表示秒を失わず、大量の値を引数展開しない',()=>{
  const fine=new TimeScale(['0.'+'0'.repeat(400)+'1']);
  assert.equal(fine.seconds(fine.ticks('1')),1);
  const many=new TimeScale(Array(200000).fill('1'));
  assert.equal(many.format(many.ticks('1')),'1');
});
