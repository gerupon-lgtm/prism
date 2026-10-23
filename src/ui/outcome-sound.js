import { perfectScore } from '../core/evaluation.js';

// Consume each confirmed result once, even when sound/visibility is unavailable.
// Reopening results or enabling sound later must not replay an old outcome.
export class OutcomeSound {
  constructor(chime) { this.chime=chime;this.seen=new WeakSet(); }
  update(run,result,enabled=false) {
    if(!run||this.seen.has(run))return;
    const achieved=result?.state==='achieved'&&result.score;
    const failed=(result?.state==='failed'||result?.timeLimitReached&&!achieved)&&(run.exhausted||run.status==='stopped');
    if(!achieved&&!failed)return;
    this.seen.add(run);
    if(!enabled||run.status==='stopped'||['load','error'].includes(run.pauseReason))return;
    if(failed)this.chime.failure();
    else if(perfectScore(result.score))this.chime.perfect();
    else this.chime.clear();
  }
}
