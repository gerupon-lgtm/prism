import { svg } from './svg.js';
import { perfectScore } from '../core/evaluation.js';

export const CELEBRATION_DURATION_MS = 2400;

// A presentation effect belongs to one run, not to each re-render of its result.
export class PerfectCelebration {
  constructor(layer, frame, sound) {
    Object.assign(this,{layer,frame,sound});this.seen=new WeakSet();this.run=null;this.timer=null;
  }
  update(run,result,visible) {
    if(this.run!==run||!visible||run?.status==='stopped')this.cancel();
    if(!visible||!run||run.status==='stopped'||result?.state!=='achieved'||!result.score||!perfectScore(result.score)||this.seen.has(run))return;
    this.seen.add(run);this.run=run;
    const {x,y,width,height}=this.frame(),radius=Math.min(width*.22,height*.14,240);
    const root=svg('g',{class:'perfect-fireworks','aria-hidden':'true'});
    const positions=[[.24,.23],[.76,.31],[.5,.16],[.18,.46],[.82,.5]];
    const colors=['#ffe3a2','#bfe8ff','#f7efda','#d5b9ff','#a9e9f0'];
    positions.forEach(([u,v],index)=>{
      const cx=x+width*u,cy=y+height*v,delay=index*180;
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
    this.layer.replaceChildren(root);this.sound();
    this.timer=setTimeout(()=>{if(this.run===run)this.cancel();},CELEBRATION_DURATION_MS);
  }
  cancel() {
    clearTimeout(this.timer);this.timer=null;this.run=null;if(this.layer.firstChild)this.layer.replaceChildren();
  }
}
