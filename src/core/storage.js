import { createCircuit } from './circuit.js';
import { compareScores } from './evaluation.js';
import { challengeScoreId,RANDOM_CHALLENGE_REVISION } from './challenge-identity.js';
import {validateBellSequence} from './bell-sequence.js';

export const CIRCUIT_FORMAT = 'prism-notes-circuit';
export const RESULT_FORMAT = 'prism-notes-result';
export const FORMAT_VERSION = 1;
export const STORAGE_KEYS = Object.freeze({ circuits:'prism-notes.circuits.v1', scores:'prism-notes.scores.v1', guides:'prism-notes.guides.v1' });

function validScore(value) {
  if (!value || typeof value.numerator !== 'string' || typeof value.denominator !== 'string' || !/^\d+$/.test(value.numerator) || !/^[1-9]\d*$/.test(value.denominator)) return false;
  const numerator=BigInt(value.numerator), denominator=BigInt(value.denominator);
  return numerator > 50n * denominator && numerator <= 100n * denominator;
}

function validateProblem(problem,challenge,rule){
  if(!problem?.draw||!/^[0-9a-f]{16}$/.test(problem.draw.id)||problem.draw.revision!==RANDOM_CHALLENGE_REVISION||!Number.isSafeInteger(problem.draw.number)||problem.draw.number<1||!Number.isSafeInteger(problem.version)||!Number.isSafeInteger(problem.limit)||problem.limit<1||!['interval','delivery-all','bell-sequence'].includes(problem.type))throw new Error('出題条件が不正です。元の成績は保持しています。');
  if(challenge!==challengeScoreId(problem)||rule!==`${problem.type}@1`)throw new Error('成績と出題条件が一致しません。');
  const circuit=createCircuit({mode:'spread',target:problem.goal??'all',nodes:problem.nodes,edges:problem.candidates});
  if(circuit.time.ticks(problem.baseline)<=0n||circuit.time.ticks(problem.maxDuration)<circuit.time.ticks(problem.baseline))throw new Error('出題の基準時間が不正です。');
  if(problem.type==='interval'&&(!Number.isSafeInteger(problem.count)||problem.count<1||circuit.time.ticks(problem.interval)<=0n))throw new Error('出題の到達条件が不正です。');
  if(problem.type==='delivery-all'&&(!Array.isArray(problem.goals)||!problem.goals.length||problem.goals.some(id=>!circuit.goals.includes(id))))throw new Error('出題の鐘が不正です。');
  if(problem.type==='bell-sequence')validateBellSequence(problem,circuit.time,circuit.goals);
}

export function circuitFile(input, name = '') {
  if (typeof name !== 'string') throw new Error('回路名が不正です。');
  return { format: CIRCUIT_FORMAT, version: FORMAT_VERSION, name, circuit: createCircuit(input).raw };
}
export function readCircuitFile(text) {
  const file = JSON.parse(text);
  if (!file || file.format !== CIRCUIT_FORMAT || file.version !== FORMAT_VERSION || typeof file.name !== 'string') throw new Error('対応する回路ファイルではありません。元の回路は変更していません。');
  return circuitFile(file.circuit, file.name);
}
export function resultFile(run, evaluation = null) {
  return { format: RESULT_FORMAT, version: FORMAT_VERSION, conditions: structuredClone(run.circuit.raw), elapsed: run.format(), status: run.status, records: structuredClone(run.records), evaluation: structuredClone(evaluation) };
}

// One synchronous write per mutation. The previous value is not removed first.
export class LocalRecords {
  constructor(storage) { this.storage = storage; }
  read(kind, fallback) {
    const text = this.storage.getItem(STORAGE_KEYS[kind]);
    if (text === null) return structuredClone(fallback);
    const envelope = JSON.parse(text);
    if (!envelope || envelope.version !== FORMAT_VERSION) throw new Error('保存データの版に対応していません。元のデータは保持しています。');
    return envelope.value;
  }
  write(kind, value) { this.storage.setItem(STORAGE_KEYS[kind], JSON.stringify({ version: FORMAT_VERSION, value })); }
  slots() {
    const value = this.read('circuits', []);
    if (!Array.isArray(value) || value.length > 10) throw new Error('保存枠が不正です。元のデータは保持しています。');
    const seen = new Set();
    return value.map(slot => {
      if (!slot || typeof slot.id !== 'string' || !slot.id || seen.has(slot.id)) throw new Error('保存枠の識別子が不正です。');
      seen.add(slot.id);
      return { id: slot.id, ...circuitFile(slot.circuit, slot.name) };
    });
  }
  saveCircuit(input, name, { replaceId = null, id = globalThis.crypto.randomUUID() } = {}) {
    if (typeof id !== 'string' || !id || (replaceId !== null && (typeof replaceId !== 'string' || !replaceId))) throw new Error('保存枠の識別子が不正です。');
    const file = circuitFile(input, name);
    const slots = this.slots();
    if (replaceId !== null) {
      const at = slots.findIndex(slot => slot.id === replaceId);
      if (at < 0) throw new Error('置換対象が見つかりません。');
      slots[at] = { id: replaceId, ...file };
    } else {
      if (slots.length >= 10) throw new Error('保存枠が満杯です。置換する回路を選んでください。');
      if (slots.some(slot => slot.id === id)) throw new Error('保存枠の識別子が重複しています。');
      slots.push({ id, ...file });
    }
    this.write('circuits', slots);
    return structuredClone(slots.find(slot => slot.id === (replaceId ?? id)));
  }
  rename(id, name) {
    if (typeof name !== 'string') throw new Error('回路名が不正です。');
    const slots = this.slots();
    const slot = slots.find(item => item.id === id);
    if (!slot) throw new Error('変更する回路が見つかりません。');
    slot.name = name;
    this.write('circuits', slots);
  }
  remove(id) {
    const slots = this.slots();
    if (!slots.some(slot => slot.id === id)) throw new Error('削除する回路が見つかりません。');
    this.write('circuits', slots.filter(slot => slot.id !== id));
  }
  scores() {
    const values = this.read('scores', []);
    if (!Array.isArray(values)) throw new Error('成績データが不正です。');
    for (const value of values) {
      if (!value || typeof value.challenge !== 'string' || !value.challenge || typeof value.rule !== 'string' || !value.rule || value.achieved !== true || !validScore(value.score)) throw new Error('成績データが不正です。元の成績は保持しています。');
      if(value.problem!==undefined)validateProblem(value.problem,value.challenge,value.rule);
    }
    return values;
  }
  saveScore(challenge, rule, candidate, problem) {
    if (typeof challenge !== 'string' || !challenge || typeof rule !== 'string' || !rule || !validScore(candidate)) throw new Error('今回の成績が不正です。');
    if(problem!==undefined)validateProblem(problem,challenge,rule);
    const values = this.scores();
    const at = values.findIndex(value => value.challenge === challenge && value.rule === rule);
    if (at >= 0 && compareScores(candidate, values[at].score) <= 0) return false;
    const next = { challenge, rule, achieved: true, score: structuredClone(candidate),...(problem===undefined?{}:{problem:structuredClone(problem)}) };
    if (at < 0) values.push(next); else values[at] = next;
    this.write('scores', values);
    return true;
  }
  guideHistory() {
    const value = this.read('guides', {});
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('案内履歴が不正です。');
    for (const mode of ['challenge','free']) if (value[mode] !== undefined && !['completed','skipped'].includes(value[mode])) throw new Error('案内履歴が不正です。');
    return value;
  }
  finishGuide(mode, outcome) {
    if (!['challenge','free'].includes(mode) || !['completed','skipped'].includes(outcome)) throw new Error('案内の完了状態が不正です。');
    const values = this.guideHistory();
    values[mode] = outcome;
    this.write('guides', values);
  }
}
