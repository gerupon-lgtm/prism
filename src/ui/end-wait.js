import {DEFAULT_RESULT_TIMING,validResultWaitMs} from './result-timing.js';

// Display-only wait; never advances the simulation or adds record time.
export const END_WAIT_MS = DEFAULT_RESULT_TIMING.failureMs;
export const CLEAR_END_WAIT_MS = DEFAULT_RESULT_TIMING.clearMs;

export class EndWait {
  constructor() { this.run = null; this.deadline = null; this.checked = false; this.interrupted = new WeakSet(); }
  interrupt(run) { if (run?.exhausted) this.interrupted.add(run); }
  ready(run, now, {allowNoArrival=false,cleared=false,delayMs} = {}) {
    if (run !== this.run) {
      this.run = run; this.deadline = null; this.checked = false;
    }
    // Viewing records/dialogs can replace pauseReason; do not erase an interrupted ending.
    if (['load','error'].includes(run?.pauseReason)) this.interrupt(run);
    if (!run || run.status === 'stopped' || !run.exhausted || this.interrupted.has(run)) {
      this.deadline = null; this.checked = false; return false;
    }
    if (!Number.isFinite(now)) return false;
    // Scan the finished run once, including runs finished by the next-event button.
    // Keep this run's chosen wait even if settings change before its deadline.
    if (!this.checked) {
      this.checked = true;
      if (allowNoArrival || run.records.some(entry => entry.type === 'goal')) {
        const duration=validResultWaitMs(delayMs)?delayMs:(cleared?CLEAR_END_WAIT_MS:END_WAIT_MS);
        this.deadline = now + duration;
      }
    }
    return this.deadline !== null && now >= this.deadline;
  }
}
