// Offline feasibility study only. Not imported by the app or shipped in dist.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { challenges, challengeCircuit } from '../src/content/challenges.js';
import { Session } from '../src/app/session.js';
import { Simulation } from '../src/core/simulation.js';
import { displayScore, perfectScore, timeScore } from '../src/core/evaluation.js';

const samples = Number(process.argv[2] ?? 24);
assert(Number.isSafeInteger(samples) && samples >= 1 && samples <= 256);
const examplesOnly = process.argv.includes('--examples');
const out = new URL('./秒数入替検討/', import.meta.url);
mkdirSync(out, { recursive: true });
const report = {
  method: examplesOnly
    ? 'Feasibility examples with proposed new edge values, not literal permutations. Every allowed subset is simulated. Require one perfect wiring, other slower clears, branching, and queue use in Q11/Q12. No production content, node costs, limits, scoring, or interval targets changed.'
    : 'Seeded permutations of the authored edge-time multiset; every subset within the authored wiring limit is simulated to exhaustion. Exact integer experiment times. No app, scoring, node-time, candidate, or interval change.',
  seed: 0x20261015, samplesPerStage: examplesOnly ? 0 : samples, stages: [], complete: false,
  createdAt: new Date().toISOString(), appVersion: JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version,
  sourceHashes: Object.fromEntries(['src/content/challenges.js','src/core/simulation.js','src/core/circuit.js','src/core/evaluation.js','src/core/time.js','src/app/session.js'].map(name => [name, createHash('sha256').update(readFileSync(new URL('../' + name, import.meta.url))).digest('hex')])),
  ...(examplesOnly ? { feasibilityOnly: true, difficultyReviewed: false } : {}),
};
let state = report.seed;
function random() {
  state = (state + 0x6D2B79F5) >>> 0;
  let value = state;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}
function permute(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function selections(challenge) {
  assert(challenge.candidates.length <= 16, 'This bounded study covers the current small authored graphs only.');
  const result = [];
  for (let mask = 0; mask < 2 ** challenge.candidates.length; mask++) {
    const ids = challenge.candidates.filter((_, i) => mask & 2 ** i).map(e => e.id);
    if (ids.length <= challenge.limit) result.push(ids);
  }
  return result;
}
function finish(challenge, ids) {
  const run = new Simulation(challengeCircuit(challenge, ids));
  for (let i = 0; !run.exhausted && i < 2048; i++) run.advanceNext();
  assert(run.exhausted, challenge.id + ' did not finish');
  return run;
}
function evaluate(challenge, sets) {
  let best = null, maximum = 0n, achieved = 0, winners = 0, example = null;
  const examples = [];
  const timeExamples = new Map();
  const begin = performance.now();
  for (const ids of sets) {
    const run = finish(challenge, ids), scale = run.circuit.time;
    if (run.clock > maximum) maximum = run.clock;
    let time = null;
    if (challenge.type === 'delivery-all') {
      const firsts = challenge.goals.map(id => run.arrivals(id)[0]?.time);
      if (firsts.every(at => at !== undefined)) time = firsts.map(at => scale.ticks(at)).reduce((a, b) => a > b ? a : b);
    } else {
      const result = run.intervalResult(challenge.goal, challenge.interval, challenge.count);
      if (result.state === 'achieved') time = scale.ticks(result.first);
    }
    if (time === null) continue;
    achieved++;
    if (!timeExamples.has(time)) timeExamples.set(time, ids);
    if (best === null || time < best) {
      best = time; winners = 1; example = ids; examples.length = 0; examples.push(ids);
    } else if (time === best) {
      winners++;
      if (examples.length < 3) examples.push(ids);
    }
  }
  const scale = finish(challenge, []).circuit.time;
  const row = {
    achieved, winners, best: best === null ? null : scale.format(best),
    maximum: scale.format(maximum), examples,
    elapsedMs: Math.round(performance.now() - begin),
  };
  const next = [...timeExamples.keys()].sort((a, b) => a < b ? -1 : a > b ? 1 : 0).find(at => at > best);
  if (next !== undefined) row.partialExample = { time: scale.format(next), ids: timeExamples.get(next), score: displayScore(timeScore(next, best)) };
  if (example) {
    const run = finish(challenge, example);
    row.exampleArrivals = run.arrivals().map(r => ({ goal: r.node, time: r.time }));
    row.branchPrisms = [...new Set(run.records.filter(r => r.type === 'branch' && run.circuit.nodes.get(r.node).kind === 'prism').map(r => r.node))];
    row.queueWaits = run.records.filter(r => r.type === 'process-start' && scale.ticks(r.wait) > 0n).map(r => ({ node: r.node, time: r.time, wait: r.wait }));
    assert(perfectScore(timeScore(best, best)));
    row.eligible = winners === 1 && row.branchPrisms.length > 0 &&
      (!['Q9', 'Q10'].includes(challenge.id) || row.branchPrisms.length >= 2) &&
      (!['Q11', 'Q12'].includes(challenge.id) || row.queueWaits.length > 0);
  } else row.eligible = false;
  row.playable = row.eligible && achieved > winners;
  return row;
}
const reportName = examplesOnly ? 'examples-report.json' : 'report.json';
function checkpoint() { writeFileSync(new URL(reportName, out), JSON.stringify(report, null, 2) + '\n'); }
function replaySession(challenge, result, ids) {
  // Disposable in-memory score store, never the user's browser data.
  const session = new Session({ saveScore() {} });
  session.challenge = { ...challenge, baseline: result.best, maxDuration: result.maximum };
  session.circuit = challengeCircuit(session.challenge, ids);
  session.start(); session.pause('feasibility');
  for (let i = 0; !session.run.exhausted && i < 2048; i++) session.next();
  assert(session.run.exhausted && session.result.state === 'achieved');
  return { first: session.result.evaluatedTime, score: displayScore(session.result.score), perfect: perfectScore(session.result.score) };
}

if (!examplesOnly) for (const authored of challenges.slice(6)) {
  const sets = selections(authored), originalTimes = authored.candidates.map(e => e.time);
  const stage = { id: authored.id, type: authored.type, limit: authored.limit, candidateIds: authored.candidates.map(e => e.id), legalSubsets: sets.length, originalTimes, original: evaluate(authored, sets), permutations: [] };
  report.stages.push(stage);
  assert.equal(stage.original.best, authored.baseline);
  assert.equal(stage.original.maximum, authored.maxDuration);
  const seen = new Set([JSON.stringify(originalTimes)]);
  for (let index = 1; index <= samples; index++) {
    let times, key, attempts = 0;
    do { assert(++attempts <= 10000, 'Unique permutation sampling limit'); times = permute(originalTimes); key = JSON.stringify(times); } while (seen.has(key));
    seen.add(key);
    const challenge = { ...authored, candidates: authored.candidates.map((edge, i) => ({ ...edge, time: times[i] })) };
    stage.permutations.push({ index, times, ...evaluate(challenge, sets) });
    checkpoint();
    if (index % 4 === 0) console.log(authored.id + ' ' + index + '/' + samples + ' unique=' + stage.permutations.filter(row => row.winners === 1).length);
  }
  stage.summary = {
    sampled: samples,
    solvable: stage.permutations.filter(row => row.achieved > 0).length,
    unique: stage.permutations.filter(row => row.winners === 1).length,
    eligible: stage.permutations.filter(row => row.eligible).length,
    minimumWinners: Math.min(...stage.permutations.filter(row => row.winners > 0).map(row => row.winners)),
  };
  checkpoint();
  console.log(authored.id + ' ' + JSON.stringify(stage.summary));
}
if (examplesOnly) {
  const sampled = JSON.parse(readFileSync(new URL('report.json', out), 'utf8'));
  assert(sampled.complete);
  const mainEdges = {
    Q7: ['SA','AB','AC','BD','CE','DG1','EG2'],
    Q8: ['SA','AB','AC','BD','DG1','DG2','CE','EG3'],
    Q12: ['SA','AB','BF','AC','CF','AD','DE','EF','FG'],
  };
  for (const authored of challenges.slice(6)) {
    let times, source;
    if (mainEdges[authored.id]) {
      source = 'Proposed new values; feasibility only, not approved content';
      times = authored.candidates.map(edge => mainEdges[authored.id].includes(edge.id)
        ? authored.id === 'Q12' ? edge.time : '0.5'
        : authored.id === 'Q12' ? '4' : '3');
    } else if (authored.id === 'Q9' || authored.id === 'Q11') {
      source = 'Proposed value adjustments to retain both one perfect solution and partial clears';
      const overrides = authored.id === 'Q9'
        ? { AG:'2.5', AC:'3', BD:'4', CE:'4' }
        : { AD:'2.5', BG:'4', CG:'4', AG:'4', BC:'4' };
      times = authored.candidates.map(edge => overrides[edge.id] ?? edge.time);
    } else {
      const previous = sampled.stages.find(stage => stage.id === authored.id);
      assert.deepEqual(previous.originalTimes, authored.candidates.map(e => e.time));
      assert.deepEqual(previous.candidateIds, authored.candidates.map(e => e.id));
      const eligible = previous.permutations.find(row => row.eligible);
      assert(eligible);
      times = eligible.times.map((time, i) => authored.candidates[i].id === 'BG' ? '7.5' : time);
      source = 'Literal permutation #' + eligible.index + ', then BG adjusted to 7.5 for slower partial clears';
    }
    const challenge = { ...authored, candidates: authored.candidates.map((edge, i) => ({ ...edge, time: times[i] })) };
    const sets = selections(challenge), result = evaluate(challenge, sets);
    result.sessionPerfect = replaySession(challenge, result, result.examples[0]);
    assert(result.sessionPerfect.perfect);
    if (result.partialExample) {
      result.sessionPartial = replaySession(challenge, result, result.partialExample.ids);
      assert(!result.sessionPartial.perfect);
      assert.equal(result.sessionPartial.score, result.partialExample.score);
    }
    report.stages.push({ id: authored.id, source, candidateIds: authored.candidates.map(e => e.id), times, legalSubsets: sets.length, ...result });
    checkpoint();
    assert(result.playable, authored.id + ' unique perfect solution, stage purpose, and other partial clears');
    console.log(authored.id + ' example ' + JSON.stringify({ winners: result.winners, best: result.best, achieved: result.achieved, maximum: result.maximum, playable: result.playable }));
  }
}
report.complete = true;
checkpoint();
console.log('Feasibility report: ' + fileURLToPath(new URL(reportName, out)));
