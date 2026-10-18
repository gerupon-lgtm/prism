// Read only at playback boundaries. No audio samples, storage or network use.
export const AUDIO_LATENCY_STORAGE_KEY='prism-notes.audio-latency.v1';
export const DEFAULT_AUDIO_LATENCY_SECONDS=.03;
const validHint=value=>value==='interactive'||value==='playback'||typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
export const playbackLatencyHint=value=>validHint(value)?value:DEFAULT_AUDIO_LATENCY_SECONDS;
export function loadAudioLatency(storage){try{const saved=JSON.parse(storage.getItem(AUDIO_LATENCY_STORAGE_KEY));return saved?.version===1&&validHint(saved.latencyHint)?saved.latencyHint:DEFAULT_AUDIO_LATENCY_SECONDS;}catch{return DEFAULT_AUDIO_LATENCY_SECONDS;}}
export function saveAudioLatency(storage,latencyHint){if(!validHint(latencyHint))throw Error('音声の遅延設定が不正です。');storage.setItem(AUDIO_LATENCY_STORAGE_KEY,JSON.stringify({version:1,latencyHint}));}
export function latencyFromMilliseconds(text){if(!String(text).trim())throw Error('遅延を0〜1000ミリ秒で入力してください。');const ms=Number(text);if(!Number.isFinite(ms)||ms<0||ms>1000)throw Error('遅延を0〜1000ミリ秒で入力してください。');return ms/1000;}
const counters=['underrunEvents','underrunDuration','totalDuration'];
const valid=value=>value&&counters.every(key=>Number.isFinite(value[key])&&value[key]>=0);
const finite=(context,key)=>{try{const value=context?.[key];return Number.isFinite(value)&&value>=0?value:null;}catch{return null;}};
export function readPlaybackStats(context){
  try{const stats=context?.playbackStats;if(!stats)return null;const result=Object.fromEntries(counters.map(key=>[key,stats[key]]));return valid(result)?result:null;}catch{return null;}
}
export function playbackStatsDelta(before,after){
  if(!valid(before)||!valid(after))return {status:'unavailable'};
  if(counters.some(key=>after[key]<before[key]))return {status:'counter-reset'};
  return {status:'measured',...Object.fromEntries(counters.map(key=>[key,after[key]-before[key]]))};
}
export function audioOutputInfo(context){return {sampleRate:finite(context,'sampleRate'),baseLatency:finite(context,'baseLatency'),outputLatency:finite(context,'outputLatency')};}
export class PlaybackDiagnostics {
  constructor(){this.active=null;this.recent=[];this.sequence=0;}
  begin(context,label=''){
    if(this.active)return;
    this.active={context,before:readPlaybackStats(context),id:++this.sequence,label,startedAt:finite(context,'currentTime'),output:audioOutputInfo(context)};
  }
  finish(reason='stopped'){
    const active=this.active;if(!active)return;this.active=null;
    this.recent.unshift({id:active.id,label:active.label,reason,startedAt:active.startedAt,endedAt:finite(active.context,'currentTime'),output:audioOutputInfo(active.context),stats:playbackStatsDelta(active.before,readPlaybackStats(active.context))});
    this.recent.length=Math.min(this.recent.length,8);
  }
  snapshot(){return {active:this.active?{id:this.active.id,label:this.active.label,startedAt:this.active.startedAt,output:{...this.active.output}}:null,recent:this.recent.map(row=>({...row,output:{...row.output},stats:{...row.stats}}))};}
}
export function playbackDiagnosticText({latencyHint,output,active,recent}){
  const ms=value=>value===null?'未計測':`${(value*1000).toFixed(2)}ms`;
  const lines=['音声出力',`要求設定：${typeof latencyHint==='number'?ms(latencyHint):latencyHint}`,`内部処理の遅延（baseLatency）：${ms(output.baseLatency)}`,`出力側の遅延（outputLatency）：${ms(output.outputLatency)}`,`サンプル周波数：${output.sampleRate===null?'未計測':output.sampleRate+'Hz'}`];
  if(active)lines.push(`計測中：${active.label||'再生'} #${active.id}`);
  for(const row of recent.slice(0,3)){
    const stats=row.stats;lines.push(`再生 #${row.id} ${row.label}（${row.reason==='completed'?'自然終了':row.reason==='muted'?'消音':'停止・中断'}）`,stats.status==='measured'?`出力不足 ${stats.underrunEvents}回／合計 ${ms(stats.underrunDuration)}／計測区間 ${stats.totalDuration.toFixed(2)}秒`:stats.status==='counter-reset'?'出力不足：累積値が戻ったため比較不可':'出力不足：未計測（未対応・取得不可）');
  }
  if(!active&&!recent.length)lines.push('再生ごとの記録：まだありません。');
  lines.push('遅延値は操作から聞こえるまでの実測時間ではありません。統計の0回は音欠けがなかった証明ではありません。計測には再生中の無音と余韻も含みます。');
  return lines.join('\n');
}
