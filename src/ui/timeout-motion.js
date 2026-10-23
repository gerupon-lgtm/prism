import {END_WAIT_MS} from './end-wait.js';
import {validResultWaitMs} from './result-timing.js';

// A bounded presentation continuation. The official experiment,
// its clock, arrivals, scoring and exported records have already ended.
export class TimeoutMotion {
  constructor({maxDurationMs=END_WAIT_MS,maxEventsPerFrame=256,budgetMs=4,measure=()=>performance.now()}={}) {
    this.maxDurationMs=validResultWaitMs(maxDurationMs)?maxDurationMs:END_WAIT_MS;this.maxEventsPerFrame=maxEventsPerFrame;
    this.budgetMs=budgetMs;this.measure=measure;
    this.source=null;this.run=null;this.anchor=null;this.clock=null;this.durationMs=null;
    this.entries=[];this.goalHistory=[];
    this.blocked=new WeakSet();
  }
  clear() {
    if(this.run){this.blocked.add(this.run);this.run.complete();}
    this.source=null;this.run=null;this.anchor=null;this.clock=null;this.durationMs=null;
    this.entries=[];this.goalHistory=[];
  }
  update(session,now,{enabled=true,durationMs}={}) {
    this.entries=[];
    const source=session.run,run=session.timeoutMotionRun;
    if(!enabled||!Number.isFinite(now)||!run||!source?.exhausted||source.status!=='paused'||source.pauseReason||!session.result?.timeLimitReached) {
      this.clear();return null;
    }
    if(this.blocked.has(run))return null;
    if(this.source!==source||this.run!==run) {
      this.clear();this.source=source;this.run=run;this.anchor=now;this.clock=run.clock;
      this.durationMs=validResultWaitMs(durationMs)?durationMs:this.maxDurationMs;
      this.goalHistory=source.arrivals();
      // Particle drawing never reads the copied history. Avoid accumulating a
      // second full execution log during this short, non-scoring continuation.
      run.records.length=0;
    }
    const elapsed=BigInt(Math.max(0,Math.min(this.durationMs,Math.floor(now-this.anchor))));
    const until=this.clock+elapsed*run.circuit.time.unit/1000n;
    if(until<=run.clock||run.exhausted)return run;
    let events=0;const started=this.measure();
    try {
      const entries=run.advanceUntil(run.circuit.time.format(until),{shouldPause:()=>++events>this.maxEventsPerFrame||this.measure()-started>=this.budgetMs});
      run.records.length=0;
      if(run.pauseReason==='load'){this.clear();return null;}
      this.entries=entries;this.goalHistory.push(...entries.filter(entry=>entry.type==='goal'));
      return run;
    } catch {
      // A cyclic zero-time reflection or an expensive optional picture must
      // never prevent the already-fixed result card from appearing.
      this.clear();return null;
    }
  }
}
