import { TimeScale } from './time.js';
import { Heap, compare } from './heap.js';
import {gateTimes,validateGate,nextGateOpen} from './periodic.js';

export function createCircuit(input) {
  if (!input || !Array.isArray(input.nodes) || !Array.isArray(input.edges)) throw new Error('回路の点と道が必要です。');
  if (!['fastest', 'spread'].includes(input.mode)) throw new Error('実験方式が不正です。');
  // Only circuit conditions belong to a circuit file or a saved slot.
  const pick = (item, fields) => Object.fromEntries(fields.filter(field => Object.hasOwn(item,field)).map(field => [field,item[field]]));
  if ([...input.nodes,...input.edges].some(item => !item || typeof item !== 'object' || Array.isArray(item))) throw new Error('点または道の項目が不正です。');
  const raw = structuredClone({
    ...pick(input,['mode','target']),
    nodes: input.nodes.map(node => pick(node,['id','kind','name','process','x','y','enabled','reflectTo','gate'])),
    edges: input.edges.map(edge => pick(edge,['id','from','to','time','bidirectional','enabled'])),
  });
  const ids = new Set();
  for (const item of [...raw.nodes, ...raw.edges]) {
    if (typeof item.id !== 'string' || !item.id || ids.has(item.id)) throw new Error('点と道の識別子が不正または重複しています。');
    ids.add(item.id);
    if (item.enabled !== undefined && typeof item.enabled !== 'boolean') throw new Error('使用状態が不正です。');
    if (item.name !== undefined && typeof item.name !== 'string') throw new Error('点の名前が不正です。');
  }
  for (const node of raw.nodes) {
    if (!['source', 'prism', 'mirror', 'goal'].includes(node.kind)) throw new Error('点の役割が不正です。');
    node.process ??= ['goal','mirror'].includes(node.kind) ? '0' : '0.5';
    if (!['prism','mirror'].includes(node.kind) && node.enabled === false) throw new Error('出発点・祭壇を使用不可にはできません。');
    if (node.reflectTo != null && (typeof node.reflectTo !== 'string' || node.reflectTo === node.id || !raw.nodes.some(target => target.id === node.reflectTo))) throw new Error('鏡の反射先が不正です。');
    if(node.gate!==undefined) {
      if(node.kind!=='prism')throw new Error('周期開閉を設定できるのはプリズムです。');
      gateTimes(node.gate);
      node.gate=pick(node.gate,['period','open','phase']);
    }
    for (const axis of ['x', 'y']) if (node[axis] !== undefined && (typeof node[axis] !== 'number' || !Number.isFinite(node[axis]))) throw new Error('配置の座標が不正です。');
  }
  if (raw.nodes.filter(n => n.kind === 'source').length !== 1) throw new Error('出発点は一つ必要です。');
  const time = new TimeScale([...raw.nodes.flatMap(n => [n.process,...(n.gate?gateTimes(n.gate):[])]), ...raw.edges.map(e => e.time)]);
  for(const node of raw.nodes)if(node.gate)validateGate(node.gate,time);
  const nodes = new Map(raw.nodes.map(n => [n.id, { ...n, processing: time.ticks(n.process) }]));
  const edges = new Map();
  const outgoing = new Map([...nodes.keys()].map(id => [id, []]));
  for (const edge of raw.edges) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to) || edge.from === edge.to) throw new Error('道は異なる二点を結んでください。');
    if (edge.bidirectional !== undefined && typeof edge.bidirectional !== 'boolean') throw new Error('道の向きが不正です。');
    const compiled = { ...edge, travel: time.ticks(edge.time) };
    const reflection=nodes.get(edge.from).kind==='mirror'||edge.bidirectional&&nodes.get(edge.to).kind==='mirror';
    if (compiled.travel < time.ticks('0.1')&&!(reflection&&compiled.travel===0n)) throw new Error('道の時間は0.1秒以上です。鏡から反射する道だけ0秒にできます。');
    edges.set(edge.id, compiled);
    if (edge.enabled === false || nodes.get(edge.from).enabled === false || nodes.get(edge.to).enabled === false) continue;
    outgoing.get(edge.from).push({ edge: compiled, to: edge.to });
    if (edge.bidirectional) outgoing.get(edge.to).push({ edge: compiled, to: edge.from });
  }
  for (const [id,list] of outgoing) {
    const node=nodes.get(id);
    const choices=node.kind==='mirror'?list.filter(choice=>choice.to===node.reflectTo):list;
    if(node.kind==='mirror'&&choices.length>1)throw new Error('鏡の反射先への配線は一本にしてください。');
    choices.sort((a,b)=>compare(a.edge.id,b.edge.id)||compare(a.to,b.to));
    outgoing.set(id,choices);
  }
  const goals = raw.nodes.filter(n => n.kind === 'goal').map(n => n.id).sort(compare);
  if (raw.target !== undefined && raw.target !== 'all' && !goals.includes(raw.target)) throw new Error('送信先の祭壇が不正です。');
  return { raw, time, nodes, edges, outgoing, source: raw.nodes.find(n => n.kind === 'source').id, goals };
}

function routeOrder(a, b) {
  return compare(a.time, b.time) || compare(a.edges.length, b.edges.length) || compare(JSON.stringify(a.edges), JSON.stringify(b.edges));
}

export function shortestPath(circuit, goal) {
  if (!circuit.goals.includes(goal)) throw new Error('送信先の祭壇が存在しません。');
  const work = new Heap(routeOrder);
  const start = { node: circuit.source, time: 0n, edges: [], nodes: [circuit.source] };
  const best = new Map([[circuit.source, start]]);
  work.push(start);
  while (work.size) {
    const current = work.pop();
    if (best.get(current.node) !== current) continue;
    if (current.node === goal) return current;
    if (circuit.nodes.get(current.node).kind === 'goal') continue;
    for (const { edge, to } of circuit.outgoing.get(current.node)) {
      const node = circuit.nodes.get(to);
      const arrival=current.time+edge.travel;
      const start=node.gate?nextGateOpen(node.gate,circuit.time,arrival):arrival;
      const candidate = { node: to, time: start + (node.kind === 'goal' ? 0n : node.processing), edges: [...current.edges, edge.id], nodes: [...current.nodes, to] };
      if (!best.has(to) || routeOrder(candidate, best.get(to)) < 0) {
        best.set(to, candidate);
        work.push(candidate);
      }
    }
  }
  return null;
}
