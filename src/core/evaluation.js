import { createCircuit, shortestPath } from './circuit.js';
import { compare } from './heap.js';

export function faultCases(input, kind, goal) {
  const original = createCircuit(input);
  if (!['edge', 'prism'].includes(kind)) throw new Error('故障対象が不正です。');
  const targets = kind === 'edge' ? [...original.edges.keys()] : [...original.nodes.values()].filter(n => n.kind === 'prism').map(n => n.id);
  return targets.sort(compare).map(id => {
    const conditions = structuredClone(original.raw);
    (kind === 'edge' ? conditions.edges : conditions.nodes).find(item => item.id === id).enabled = false;
    const circuit = createCircuit(conditions);
    const route = shortestPath(circuit, goal);
    return { id, kind, conditions, reachable: route !== null, time: route ? circuit.time.format(route.time) : null, edges: route?.edges ?? [] };
  });
}

export function worstFault(cases, timeScale) {
  if (!cases.length) return null;
  return [...cases].sort((a,b) => {
    if (a.reachable !== b.reachable) return a.reachable ? 1 : -1;
    if (a.reachable) { const timeOrder = compare(timeScale.ticks(b.time), timeScale.ticks(a.time)); if (timeOrder) return timeOrder; }
    return compare(a.id,b.id);
  })[0];
}

function gcd(a,b) { while (b) [a,b] = [b,a % b]; return a; }
function score(numerator, denominator) {
  if (denominator <= 0n || numerator < 50n * denominator || numerator > 100n * denominator) throw new Error('採点の基準値が実現結果と一致しません。');
  const divisor = gcd(numerator, denominator);
  return { numerator: (numerator/divisor).toString(), denominator: (denominator/divisor).toString() };
}

export function timeScore(actual, baseline) {
  actual = BigInt(actual); baseline = BigInt(baseline);
  if (actual <= 0n || baseline <= 0n) throw new Error('採点時間は0より大きい値です。');
  return score(50n * (actual + baseline), actual);
}

// SD-023 technical proposal. Do not relabel the proposed formula as approved.
export function timeHopScore(actual, hops, baseline, baselineHops, nodeCount) {
  if (![hops,baselineHops,nodeCount].every(Number.isSafeInteger) || nodeCount < 2 || hops < 1 || baselineHops < 1 || hops >= nodeCount || baselineHops >= nodeCount) throw new Error('経路の本数が不正です。');
  const twiceBound = 2n * BigInt(nodeCount - 1);
  const adjusted = BigInt(actual) * twiceBound + BigInt(hops - baselineHops);
  if (BigInt(actual) <= 0n || BigInt(baseline) <= 0n) throw new Error('採点時間は0より大きい値です。');
  return score(50n * (adjusted + BigInt(baseline) * twiceBound), adjusted);
}

export function compareScores(a,b) {
  return compare(BigInt(a.numerator) * BigInt(b.denominator), BigInt(b.numerator) * BigInt(a.denominator));
}
export function perfectScore(value) { return BigInt(value.numerator) === 100n * BigInt(value.denominator); }
export function displayScore(value) {
  const hundredths = BigInt(value.numerator) * 100n / BigInt(value.denominator);
  return `${hundredths / 100n}.${(hundredths % 100n).toString().padStart(2,'0')}`;
}
