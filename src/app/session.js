import { createCircuit } from '../core/circuit.js';
import { Simulation } from '../core/simulation.js';
import { TimeScale } from '../core/time.js';
import { faultCases, worstFault, timeScore, timeHopScore, compareScores } from '../core/evaluation.js';
import { circuitFile, readCircuitFile, resultFile } from '../core/storage.js';
import { challenges, challengeCircuit } from '../content/challenges.js';
import { drawChallenge } from '../content/challenge-draw.js';
import { challengeScoreId } from '../core/challenge-identity.js';
import { sampleCircuit } from '../content/samples.js';

const copy = value => structuredClone(value);
const challengeById = id => {
  const challenge = challenges.find(item => item.id === id);
  if (!challenge) throw new Error('課題が見つかりません。');
  return challenge;
};
const stateFields = ['mode','challenge','circuit','name','dirty','run','runContext','result','cases','replayCase','selection','view'];

// Owns the user's editing and running state. No DOM, audio, or wall clock here.
export class Session {
  constructor(records,{random=Math.random}={}) {
    this.records = records;
    this.random=random;this.lastDraws=new Map();
    this.mode = 'challenge';
    this.challenge = challengeById('Q1');
    this.circuit = createCircuit(challengeCircuit(this.challenge)).raw;
    this.name = '';
    this.dirty = false;
    this.run = null;
    this.runContext = null;
    this.result = null;
    this.cases = [];
    this.replayCase = null;
    this.selection = null;
    this.view = { zoom:1, panX:0, panY:0, recordPage:0, casePage:0 };
    this.pendingScores = new Map();
    this.scoreErrors = new Map();
    this.guide = null;
    this.saveRevision = 0;
  }

  get editable() { return !this.run || this.run.status === 'stopped'; }
  get startBlockedReason() { return this.circuit.edges.length ? '' : '点をつないでから「鐘を鳴らす」を押してください。'; }
  get clearChoices() {
    if(this.mode!=='challenge'||this.guide||this.runContext?.guide||this.result?.state!=='achieved'||this.result.challenge!==this.challenge.id)return null;
    const index=challenges.findIndex(item=>item.id===this.challenge.id);
    return {challengeId:this.challenge.id,nextChallengeId:challenges[index+1]?.id??null};
  }
  requireEditable() {
    if (!this.editable) throw new Error('停止してから変更してください。一時停止中も実験条件は固定です。');
  }
  requireFree() {
    if (this.mode !== 'free') throw new Error('課題では決められた候補から道を選びます。');
  }
  commitEdit(input) {
    this.requireEditable();
    const checked = createCircuit(input).raw;
    this.circuit = checked;
    this.dirty = true;
    // Keep the previous run and its result available, but never change its conditions.
    if (this.guide?.mode === 'free' && this.guide.step === 1) {
      const a = checked.nodes.find(node => node.id === 'A');
      if (a?.process === '1.5') this.guide.step = 2;
    }
  }
  connect(from, to, candidateId = null) {
    return this.connectPath([from,to],candidateId).at(-1);
  }
  planConnections(path,candidateId=null) {
    this.requireEditable();
    if(!Array.isArray(path)||path.length<2)throw new Error('二点以上をつないでください。');
    const next = copy(this.circuit);
    const added=[];
    for(let index=1;index<path.length;index++){
      const from=path[index-1],to=path[index];
      if(from===to||!next.nodes.some(n=>n.id===from)||!next.nodes.some(n=>n.id===to))throw new Error('接続する点が不正です。');
      if (this.mode === 'challenge') {
        const candidate = this.challenge.candidates.find(edge => edge.from === from && edge.to === to && !next.edges.some(built => built.id === edge.id) && (candidateId === null || edge.id === candidateId));
        if (!candidate) throw new Error('この向きの未接続の候補はありません。');
        next.edges.push(copy(candidate));
        if (next.edges.length > this.challenge.limit) throw new Error(`道は${this.challenge.limit}本までです。`);
      } else {
        next.edges.push({id:this.nextId('E',next),from,to,time:'1',bidirectional:false});
      }
      added.push(next.edges.at(-1).id);
    }
    createCircuit(next);
    return {next,added};
  }
  connectPath(path,candidateId=null) {
    const {next,added}=this.planConnections(path,candidateId);
    this.commitEdit(next);
    if (this.guide?.mode === 'challenge' && this.guide.step === 0 && next.edges.length) this.guide.step = 1;
    this.selection=path.at(-1);
    return added;
  }
  clearConnections() {
    this.commitEdit({...this.circuit,edges:[]});this.selection=null;this.view.showAllTimes=true;
  }
  nextId(prefix,circuit=this.circuit) {
    const used = new Set([...circuit.nodes,...circuit.edges].map(item => item.id));
    let number = 1;
    while (used.has(`${prefix}${number}`)) number++;
    return `${prefix}${number}`;
  }
  addNode(kind, x, y) {
    this.requireFree(); this.requireEditable();
    if (!['prism','goal'].includes(kind)) throw new Error('追加できるのはプリズムと祭壇です。');
    const id = this.nextId(kind === 'goal' ? 'G' : 'P');
    const next = copy(this.circuit);
    next.nodes.push({id,kind,x,y,process:kind === 'goal' ? '0' : '0.5'});
    this.commitEdit(next);
    return id;
  }
  moveNode(id, x, y) {
    this.requireFree();
    const next = copy(this.circuit), node = next.nodes.find(item => item.id === id);
    if (!node) throw new Error('移動する点が見つかりません。');
    Object.assign(node,{x,y}); this.commitEdit(next);
  }
  setTime(id, value) {
    this.requireFree(); this.requireEditable();
    // Validate the user's text without rounding or applying half-entered values.
    if (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value)) throw new Error('秒数を半角数字で入力してください。');
    const next = copy(this.circuit), edge = next.edges.find(item => item.id === id), node = next.nodes.find(item => item.id === id);
    if (!edge && (!node || node.kind === 'goal')) throw new Error('この対象には時間を設定できません。');
    const scale = new TimeScale([value]);
    if (scale.digits > 1) throw new Error('時間は0.1秒刻みで入力してください。');
    const time = scale.format(scale.ticks(value));
    if (edge) edge.time = time; else node.process = time;
    this.commitEdit(next);
  }
  setEnabled(id, enabled) {
    this.requireFree();
    const next = copy(this.circuit), item = next.edges.find(edge => edge.id === id) ?? next.nodes.find(node => node.id === id);
    if (!item || (item.kind && item.kind !== 'prism')) throw new Error('使用状態を変えられるのは道とプリズムです。');
    item.enabled = enabled; this.commitEdit(next);
  }
  setDirection(id, {bidirectional=false, reverse=false} = {}) {
    this.requireFree();
    if(typeof bidirectional!=='boolean'||typeof reverse!=='boolean')throw new Error('道の向きが不正です。');
    const next = copy(this.circuit), edge = next.edges.find(item => item.id === id);
    if (!edge) throw new Error('道が見つかりません。');
    if(reverse)[edge.from,edge.to]=[edge.to,edge.from];
    edge.bidirectional = bidirectional; this.commitEdit(next);
  }
  setFlow(mode, target = this.circuit.target) {
    this.requireFree(); this.commitEdit({...this.circuit,mode,target});
  }
  remove(id, confirmed = false) {
    this.requireEditable();
    const next = copy(this.circuit), node = next.nodes.find(item => item.id === id);
    if (node) {
      this.requireFree();
      if (node.kind === 'source') throw new Error('出発点は削除できません。');
      if (!confirmed) throw new Error('点と接続している道の削除を確認してください。');
      next.nodes = next.nodes.filter(item => item.id !== id);
      next.edges = next.edges.filter(edge => edge.from !== id && edge.to !== id);
      if (next.target === id) next.target = 'all';
    } else {
      if (!next.edges.some(edge => edge.id === id)) throw new Error('削除する道が見つかりません。');
      if (!confirmed) throw new Error('選んだ道の削除を確認してください。');
      next.edges = next.edges.filter(edge => edge.id !== id);
    }
    this.commitEdit(next);
    if (this.selection === id) this.selection = null;
  }

  replacement({challengeId, sampleId, fileText, slotId} = {}) {
    if (challengeId) {
      const challenge = challengeById(challengeId);
      return {mode:'challenge',challenge,circuit:createCircuit(challengeCircuit(challenge)).raw,name:''};
    }
    const file = fileText !== undefined ? readCircuitFile(fileText)
      : slotId ? this.records.slots().find(slot => slot.id === slotId)
        : circuitFile(sampleCircuit(sampleId ?? 'compare'),'自由の回路');
    if (!file) throw new Error('読み込む回路が見つかりません。');
    return {mode:'free',challenge:null,circuit:createCircuit(file.circuit).raw,name:file.name};
  }
  replace(request, {choice = 'cancel', save = {}} = {}) {
    this.requireEditable();
    if (this.guide) throw new Error('案内を閉じて元の回路へ戻ってから切り替えてください。');
    // Validate the incoming file before either saving or replacing anything.
    const next = this.replacement(request);
    if (this.mode === 'free' && this.dirty) {
      if (choice === 'cancel') return false;
      if (choice === 'save') this.saveCircuit(save.name ?? this.name,save);
      else if (choice !== 'discard') throw new Error('読み込み前の保存方法を選んでください。');
    }
    if(next.mode==='challenge'){
      next.challenge=drawChallenge(next.challenge,{previousId:this.lastDraws.get(next.challenge.id),random:this.random});
      next.circuit=createCircuit(challengeCircuit(next.challenge)).raw;
    }
    Object.assign(this,next,{dirty:false,run:null,runContext:null,result:null,cases:[],replayCase:null,selection:null,view:{zoom:1,panX:0,panY:0,recordPage:0,casePage:0}});
    if(next.challenge?.draw)this.lastDraws.set(next.challenge.id,next.challenge.draw.id);
    return true;
  }
  saveCircuit(name = this.name, options = {}) {
    this.requireFree(); this.requireEditable();
    if (this.guide) throw new Error('練習用の回路は保存枠に書き込みません。');
    const slot = this.records.saveCircuit(this.circuit,name,options);
    this.name = name; this.dirty = false; this.saveRevision++;
    return slot;
  }
  exportCircuit(name = this.name) { this.requireFree(); return circuitFile(this.circuit,name); }
  exportResult() {
    if (!this.run) throw new Error('書き出す実行記録がありません。');
    return {...resultFile(this.run,this.result),challenge:copy(this.runContext.challenge),originalConditions:copy(this.runContext.original),faultCases:copy(this.cases),replayCase:this.replayCase};
  }

  start({caseId = null} = {}) {
    this.requireEditable();
    if (this.startBlockedReason) throw new Error(this.startBlockedReason);
    const original = createCircuit(this.circuit).raw;
    let conditions = original, cases = [], selected = null;
    if (this.mode === 'challenge' && ['edge-fault','prism-fault'].includes(this.challenge.type)) {
      cases = faultCases(original,this.challenge.type === 'edge-fault' ? 'edge' : 'prism',this.challenge.goal);
      selected = caseId === null ? worstFault(cases,createCircuit(original).time) : cases.find(item => item.id === caseId);
      if (caseId !== null && !selected) throw new Error('故障ケースが見つかりません。');
      conditions = selected?.conditions ?? original;
    } else if (caseId !== null) throw new Error('この実験には故障ケースがありません。');
    const run = new Simulation(conditions);
    this.run = run; this.cases = cases; this.replayCase = selected?.id ?? null;
    this.runContext = {mode:this.mode,challenge:copy(this.challenge),original,guide:this.guide !== null};
    this.view.recordPage = 0; this.result = null;
    this.evaluate();
    return run;
  }
  pause(reason = null) { this.run?.pause(reason); }
  resume() {
    if (!this.run || this.run.status !== 'paused' || this.run.exhausted) throw new Error('再開する動作がありません。');
    this.run.resume();
  }
  stop() {
    this.evaluate(); this.run?.stop(); this.evaluate();
  }
  get runTimeLimit() {
    return this.runContext?.mode==='challenge'?this.run.circuit.time.ticks(this.runContext.challenge.maxDuration):null;
  }
  stopAtTimeLimit() {
    const limit=this.runTimeLimit;
    if(limit===null||this.run.exhausted||this.run.clock<limit||['load','error'].includes(this.run.pauseReason))return;
    this.runContext.timeLimitReached=true;this.stop();
  }
  next(options) {
    if (!this.run || this.run.status !== 'paused') throw new Error('一時停止中に次の動作へ進めます。');
    const limit=this.runTimeLimit;
    const entries=limit!==null&&this.run.nextTime!==null&&this.run.nextTime>limit?this.run.advanceUntil(this.run.circuit.time.format(limit),options):this.run.advanceNext(options);
    this.evaluate();this.stopAtTimeLimit();return entries;
  }
  advance(seconds, options) {
    if (!this.run || this.run.status !== 'running') return [];
    const limit=this.runTimeLimit,scale=this.run.circuit.time,requested=scale.ticks(seconds);
    const entries = this.run.advanceUntil(limit!==null&&requested>limit?scale.format(limit):seconds,options); this.evaluate();this.stopAtTimeLimit();
    if (this.run.status!=='stopped'&&!this.run.exhausted && this.run.pauseReason !== 'load') this.run.resume();
    return entries;
  }
  openRecords() {
    this.pause('records');
    if (this.guide?.mode === 'challenge' && this.guide.step === 2) this.guide.readyToFinish = true;
  }

  evaluate() {
    if (!this.run) return null;
    const {mode,challenge,guide} = this.runContext;
    if (mode === 'free') {
      this.result = {state:this.run.status === 'stopped' ? 'stopped' : this.run.exhausted ? 'finished' : 'running',arrivals:copy(this.run.arrivals())};
      if (this.guide?.mode === 'free' && this.run.arrivals().length) {
        if (this.guide.step === 0) this.guide.step = 1;
        else if (this.guide.step === 2 && this.run.arrivals()[0].time === '3') this.guide.readyToFinish = true;
      }
      return this.result;
    }
    const arrival = this.run.arrivals(challenge.goal)[0], scale = this.run.circuit.time;
    let state = arrival ? 'achieved' : this.run.status === 'stopped' ? (this.result?.state === 'failed' ? 'failed' : 'stopped') : this.run.exhausted ? 'failed' : 'pending';
    let actual = arrival?.time ?? null;
    let goals;
    if (challenge.type === 'delivery-all') {
      goals=challenge.goals.map(id=>({id,first:this.run.arrivals(id)[0]?.time??null}));
      const missing=goals.filter(goal=>goal.first===null);
      if(!missing.length){state='achieved';actual=goals.reduce((latest,goal)=>scale.ticks(goal.first)>scale.ticks(latest)?goal.first:latest,goals[0].first);}
      else if(this.run.status==='stopped'){state=this.result?.state==='failed'?'failed':'stopped';actual=null;}
      else{state=missing.some(goal=>!this.run.hasFutureArrival(goal.id))?'failed':'pending';actual=null;}
    } else if (challenge.type === 'interval') {
      const interval = this.run.intervalResult(challenge.goal,challenge.interval,challenge.count);
      state = interval.state; actual = interval.first;
    } else if (['edge-fault','prism-fault'].includes(challenge.type)) {
      const worst = worstFault(this.cases,createCircuit(this.runContext.original).time);
      if (!worst || !worst.reachable) state = 'failed';
      actual = worst?.time ?? null;
    }
    let score = state === 'failed' ? {numerator:'0',denominator:'1'} : null;
    if (state === 'achieved') {
      const baseline = scale.ticks(challenge.baseline);
      score = challenge.type === 'time-hops' ? timeHopScore(scale.ticks(actual),arrival.hops,baseline,challenge.baselineHops,this.run.circuit.nodes.size) : timeScore(scale.ticks(actual),baseline);
    }
    this.result = {state,first:arrival?.time ?? null,evaluatedTime:actual,score,challenge:challenge.id};
    if(goals)this.result.goals=goals;
    if(state==='failed')this.result.reason=challenge.type==='delivery-all'?'必要な祭壇すべてに届く配線になっていません。':['edge-fault','prism-fault'].includes(challenge.type)?'故障するとゴールへ届かないケースがあります。':!arrival?'ゴールへ届く配線になっていません。':'到達回数または間隔が条件を満たしていません。';
    if(this.runContext.timeLimitReached){this.result.timeLimitReached=true;this.result.reason=`動作上限${challenge.maxDuration}秒で停止しました。記録を確認してつなぎ直せます。`;}
    if (state === 'achieved' && score && !guide) this.offerScore(challenge,score);
    if (this.guide?.mode === 'challenge' && this.guide.step === 1 && arrival) this.guide.step = 2;
    return this.result;
  }
  scoreKey(challenge) { return `${challengeScoreId(challenge)}/${challenge.type}@1`; }
  offerScore(challenge, score) {
    const key = this.scoreKey(challenge), previous = this.pendingScores.get(key);
    if (previous && compareScores(previous.score,score) >= 0) return;
    // Do not write or retry the same achieved score on every animation frame.
    if (this.runContext.offered && compareScores(this.runContext.offered,score) >= 0) return;
    const candidate = {challenge:challengeScoreId(challenge),rule:`${challenge.type}@1`,score:copy(score),...(challenge.draw?{problem:copy(challenge)}:{})};
    this.runContext.offered = copy(score);
    this.pendingScores.set(key,candidate);
    this.retryScore(key);
  }
  retryScore(key) {
    const candidate = this.pendingScores.get(key);
    if (!candidate) return true;
    try {
      this.records.saveScore(candidate.challenge,candidate.rule,candidate.score,candidate.problem);
      this.pendingScores.delete(key); this.scoreErrors.delete(key); return true;
    } catch (error) {
      this.scoreErrors.set(key,error.message); return false;
    }
  }

  needsGuide(mode = this.mode) { return this.records.guideHistory()[mode] === undefined; }
  beginGuide() {
    if (this.guide) throw new Error('案内はすでに開いています。');
    this.pause('guide');
    const backup = Object.fromEntries(stateFields.map(field => [field,this[field]]));
    const mode = this.mode;
    const replacement = mode === 'free' ? this.replacement({sampleId:'compare'}) : this.replacement({challengeId:'Q1'});
    Object.assign(this,replacement,{dirty:false,run:null,runContext:null,result:null,cases:[],replayCase:null,selection:null,view:{zoom:1,panX:0,panY:0,recordPage:0,casePage:0}});
    this.guide = {mode,step:0,readyToFinish:false,backup};
  }
  endGuide(outcome = 'skipped') {
    if (!this.guide) return;
    if (!['completed','skipped','interrupted'].includes(outcome)) throw new Error('案内の終了方法が不正です。');
    if (outcome === 'completed' && !this.guide.readyToFinish) throw new Error('案内の操作を終えてから完了できます。');
    // On persistence failure keep practice + backup, so retry or leave without a false completion.
    if (outcome !== 'interrupted') this.records.finishGuide(this.guide.mode,outcome);
    const backup = this.guide.backup;
    this.run?.stop(); Object.assign(this,backup); this.guide = null;
  }
}
