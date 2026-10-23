// Display-only wait; never advances the simulation or adds record time.
export const END_WAIT_MS = 1500;
export const CLEAR_END_WAIT_MS = 1500;

export class EndWait {
  constructor() { this.run = null; this.deadline = null; this.checked = false; this.interrupted = new WeakSet(); }
  interrupt(run) { if (run?.exhausted) this.interrupted.add(run); }
  ready(run, now, {allowNoArrival=false,cleared=false} = {}) {
    if (run !== this.run) {
      this.run = run; this.deadline = null; this.checked = false;
    }
    // Viewing records/dialogs can replace pauseReason; do not erase an interrupted ending.
    if (['load','error'].includes(run?.pauseReason)) this.interrupt(run);
    if (!run || run.status === 'stopped' || !run.exhausted || this.interrupted.has(run)) {
      this.deadline = null; this.checked = false; return false;
    }
    // Scan the finished run once, including runs finished by the next-event button.
    if (!this.checked) {
      this.checked = true;
      if (allowNoArrival || run.records.some(entry => entry.type === 'goal')) this.deadline = now + (cleared?CLEAR_END_WAIT_MS:END_WAIT_MS);
    }
    return this.deadline !== null && now >= this.deadline;
  }
}
