// These are scheduling safeguards, not caps on particles, queues or experiment time.
export class LoadMeter {
  constructor(now=()=>performance.now()) {
    this.now=now;this.totals={};this.last=null;this.slowFrames=0;this.current=null;this.stack=[];
  }
  measure(name,operation) {
    const timer={start:this.now(),children:0};this.stack.push(timer);
    try{return operation();}
    finally{
      const wall=Math.max(0,this.now()-timer.start),elapsed=Math.max(0,wall-timer.children);this.stack.pop();
      if(this.stack.length)this.stack.at(-1).children+=wall;
      const total=this.totals[name]??={calls:0,milliseconds:0,maximum:0};
      total.calls++;total.milliseconds+=elapsed;total.maximum=Math.max(total.maximum,elapsed);
      if(this.current)this.current.phases[name]=(this.current.phases[name]??0)+elapsed;
    }
  }
  begin(){this.current={start:this.now(),phases:{}};}
  calculationExceeded(){return this.current!==null&&this.now()-this.current.start>12;}
  finish(counts) {
    const total=this.now()-this.current.start;
    this.slowFrames=total>=50?this.slowFrames+1:0;
    this.last={milliseconds:total,phases:{...this.current.phases},counts:{...counts}};this.current=null;
    return total>=120||this.slowFrames>=3;
  }
  snapshot(){return structuredClone({last:this.last,totals:this.totals,slowFrames:this.slowFrames});}
}
