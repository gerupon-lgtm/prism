import { svg } from './svg.js';
import { perfectScore } from '../core/evaluation.js';

export const CELEBRATION_DURATION_MS = 1500;

// A presentation effect belongs to one run, not to each re-render of its result.
export class PerfectCelebration {
  constructor(layer, frame) {
    Object.assign(this,{layer,frame});this.seen=new WeakSet();this.run=null;this.root=null;
    this.timer=null;this.limitTimer=null;this.animationFrame=null;
  }
  update(run,result,visible,{naturalEnding=false}={}) {
    if(this.run!==run||!visible||(run?.status==='stopped'&&!naturalEnding))this.cancel();
    if(!visible||!run||run.status==='stopped'||result?.state!=='achieved'||!result.score||!perfectScore(result.score)||this.seen.has(run))return;
    this.seen.add(run);this.run=run;
    const {x,y,width,height}=this.frame(),radius=Math.min(width*.22,height*.14,240);
    const root=svg('g',{class:'perfect-fireworks','aria-hidden':'true'});
    const positions=[[.24,.23],[.76,.31],[.5,.16],[.18,.46],[.82,.5]];
    const colors=['#ffe3a2','#bfe8ff','#f7efda','#d5b9ff','#a9e9f0'];
    positions.forEach(([u,v],index)=>{
      const cx=x+width*u,cy=y+height*v,delay=index*112.5;
      const burst=svg('g',{class:'firework',transform:`translate(${cx} ${cy})`});
      burst.style.setProperty('--firework-delay',`${delay}ms`);
      burst.style.setProperty('--firework-color',colors[index]);
      burst.append(svg('path',{d:`M${x+width*.5-cx} ${y+height*.86-cy} Q${-radius*.25} ${radius*.8} 0 0`,pathLength:1,class:'firework-rocket'}));
      const bloom=svg('g',{class:'firework-bloom'});
      for(let ray=0;ray<24;ray++){
        const angle=ray*Math.PI/12+index*.21,length=radius*(ray%3===0?1:.72);
        const dx=Math.cos(angle)*length,dy=Math.sin(angle)*length;
        bloom.append(svg('path',{d:`M${dx*.12} ${dy*.12} L${dx} ${dy}`,pathLength:1,class:'firework-ray'}));
        bloom.append(svg('circle',{cx:dx,cy:dy,r:ray%3===0?3.5:2,class:'firework-star'}));
      }
      burst.append(bloom);root.append(burst);
    });
    this.layer.replaceChildren(root);
    this.root=root;
    let minimumElapsed=false,waitingForAnimations=false,deferCleanup=false;
    const current=()=>this.root===root;
    const finish=()=>{if(current())this.cancel();};
    const finishWhenReady=()=>{
      if(!current()||!minimumElapsed||waitingForAnimations)return;
      if(deferCleanup&&typeof requestAnimationFrame==='function'){
        if(this.animationFrame!==null)return;
        // finished resolves before CSS animationend is dispatched. Keep the
        // final frame attached until the next rendering opportunity.
        this.animationFrame=requestAnimationFrame(()=>{
          if(!current())return;
          this.animationFrame=null;finish();
        });
      }else finish();
    };
    const animationsFinished=(completed=false)=>{
      if(!current())return;
      waitingForAnimations=false;deferCleanup=completed&&minimumElapsed;
      if(!deferCleanup){clearTimeout(this.limitTimer);this.limitTimer=null;}
      finishWhenReady();
    };
    this.timer=setTimeout(()=>{
      if(!current())return;
      this.timer=null;minimumElapsed=true;finishWhenReady();
    },CELEBRATION_DURATION_MS);
    if(typeof requestAnimationFrame==='function'&&typeof root.getAnimations==='function'){
      waitingForAnimations=true;
      // Missing animation completion must still leave a bounded presentation.
      this.limitTimer=setTimeout(finish,CELEBRATION_DURATION_MS*2);
      this.animationFrame=requestAnimationFrame(()=>{
        if(!current())return;
        this.animationFrame=null;
        try{
          // CSS can start after insertion under first-paint load. Wait for its
          // real completion rather than removing the final burst at 1500ms.
          const pending=[];let supported=true;
          for(const animation of root.getAnimations({subtree:true})){
            const finished=animation.finished;
            if(typeof finished?.then!=='function'){supported=false;continue;}
            // Observe each rejection immediately, even if a later API entry is
            // missing or throws. Manual cancellation rejects CSS finished.
            pending.push(Promise.resolve(finished).catch(()=>{}));
          }
          if(!supported||!pending.length){animationsFinished();return;}
          // Old completion callbacks cannot cancel a newer presentation.
          Promise.allSettled(pending).then(()=>animationsFinished(true));
        }catch{animationsFinished();}
      });
    }
  }
  cancel() {
    clearTimeout(this.timer);clearTimeout(this.limitTimer);
    if(this.animationFrame!==null&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(this.animationFrame);
    this.timer=null;this.limitTimer=null;this.animationFrame=null;this.run=null;this.root=null;
    if(this.layer.firstChild)this.layer.replaceChildren();
  }
}
