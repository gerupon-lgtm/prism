import {svg} from './svg.js';

// Presentation only. Session owns progress, records, and the original circuit.
export class TutorialGuide {
  constructor(card,board,status=null) {
    this.card=card;this.board=board;this.status=status;this.targets=[];this.collapsed=false;
    this.pointers=new Set();this.keys=new Set();this.hidden=true;this.demo=null;this.demoKey=null;
    card.classList.add('tutorial-guide');
    this.observer=new ResizeObserver(()=>{
      this.schedule();
    });this.observer.observe(board);
    // A demonstration never competes with the player's real gesture. Capture
    // sees the input before Board starts redrawing its route preview.
    document.addEventListener('pointerdown',event=>{
      if(!board.contains(event.target))return;
      this.pointers.add(event.pointerId);this.clearDemo();
    },true);
    const release=event=>{
      if(!this.pointers.delete(event.pointerId))return;
      this.schedule();
    };
    document.addEventListener('pointerup',release,true);
    document.addEventListener('pointercancel',release,true);
    board.addEventListener('lostpointercapture',release);
    document.addEventListener('keydown',event=>{
      if(!this.guide)return;
      this.keys.add(event.code||event.key);this.clearDemo();
    },true);
    document.addEventListener('keyup',event=>{this.keys.delete(event.code||event.key);this.schedule();},true);
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden){this.pointers.clear();this.keys.clear();this.clearDemo();}
      else this.schedule();
    });
    window.addEventListener('blur',()=>{this.blurred=true;this.pointers.clear();this.keys.clear();this.clearDemo();});
    window.addEventListener('focus',()=>{this.blurred=false;this.schedule();});
    this.motionObserver=new MutationObserver(()=>this.schedule());
    this.motionObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-motion','data-board-rotation']});
    this.dialogObserver=new MutationObserver(()=>this.schedule());
    for(const dialog of document.querySelectorAll('dialog'))this.dialogObserver.observe(dialog,{attributes:true,attributeFilter:['open']});
  }
  schedule() {
    if(this.frame!==undefined&&this.frame!==null)return;
    this.frame=requestAnimationFrame(()=>{this.frame=null;this.highlight();});
  }
  clearDemo() {
    this.layer?.remove();this.layer=null;this.demoKey=null;
  }
  highlight() {
    const obscured=document.hidden||document.querySelector('dialog[open]');
    const targets=obscured||this.card.hidden&&!this.collapsed?[]:this.targets,names=new Set(targets);
    for(const item of document.querySelectorAll('.tutorial-target'))if(!names.has(item.id)&&!names.has(item.dataset.node)&&!names.has(item.dataset.edge))item.classList.remove('tutorial-target');
    for(const id of targets)(document.getElementById(id)||this.board.querySelector(`[data-node="${CSS.escape(id)}"],.edge:not(.candidate)[data-edge="${CSS.escape(id)}"]`))?.classList.add('tutorial-target');
    this.drawDemo();
  }
  drawDemo() {
    if(!this.guide||this.hidden||document.hidden||this.blurred||document.querySelector('dialog[open]')||!this.demo||this.pointers.size||this.keys.size){this.clearDemo();return;}
    const matrix=this.board.getScreenCTM();
    if(!matrix||!this.board.getClientRects().length){this.clearDemo();return;}
    let inverse;
    try{inverse=matrix.inverse();}catch{this.clearDemo();return;}
    const locate=id=>{
      const node=this.board.querySelector(`[data-node="${CSS.escape(id)}"]`),m=node?.getScreenCTM();
      return m?new DOMPoint().matrixTransform(m).matrixTransform(inverse):null;
    };
    let a,b;
    if(this.demo.kind==='hold'){
      const edge=this.demo.edge??this.demo.from;
      const line=this.board.querySelector(`.edge:not(.candidate)[data-edge="${CSS.escape(edge)}"] .edge-hit`),m=line?.getScreenCTM();
      if(line&&m){const p=line.getPointAtLength(line.getTotalLength()/2);a=new DOMPoint(p.x,p.y).matrixTransform(m).matrixTransform(inverse);b=a;}
    }else{a=locate(this.demo.from);b=locate(this.demo.to);}
    if(!a||!b||![a.x,a.y,b.x,b.y].every(Number.isFinite)){this.clearDemo();return;}
    const scale=Math.hypot(matrix.a,matrix.b),unit=1/scale;
    if(!Number.isFinite(unit)||unit<=0){this.clearDemo();return;}
    const reduced=document.documentElement.dataset.motion==='reduce';
    const key=[this.key,this.demo.kind,this.demo.edge,this.demo.from,this.demo.to,reduced,...[a.x,a.y,b.x,b.y,unit].map(n=>n.toFixed(3))].join(':');
    if(key===this.demoKey&&this.layer?.isConnected)return;
    this.clearDemo();this.demoKey=key;
    const layer=svg('g',{class:`tutorial-demonstration${reduced?' is-still':''}`, 'aria-hidden':'true','pointer-events':'none'});
    this.layer=layer;
    const ring=svg('circle',{r:12*unit,class:'tutorial-finger-ring','vector-effect':'non-scaling-stroke'});
    const inner=svg('circle',{r:4*unit,class:'tutorial-finger-center','vector-effect':'non-scaling-stroke'});
    if(this.demo.kind==='hold'){
      const finger=svg('g',{transform:`translate(${a.x} ${a.y})`});finger.append(ring,inner);
      if(!reduced)ring.append(svg('animate',{attributeName:'r',values:`${12*unit};${17*unit};${12*unit}`,dur:'1.8s',repeatCount:'indefinite'}));
      layer.append(finger);
    }else{
      const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
      if(length<unit){this.clearDemo();return;}
      const d=`M${a.x} ${a.y}L${b.x} ${b.y}`;
      layer.append(svg('path',{d,class:'tutorial-demo-path','vector-effect':'non-scaling-stroke'}));
      const ux=dx/length,uy=dy/length,at={x:a.x+dx*.63,y:a.y+dy*.63},tip=8*unit,wing=5*unit;
      layer.append(svg('path',{d:`M${at.x-ux*tip-uy*wing} ${at.y-uy*tip+ux*wing}L${at.x} ${at.y}L${at.x-ux*tip+uy*wing} ${at.y-uy*tip-ux*wing}`,class:'tutorial-demo-arrow','vector-effect':'non-scaling-stroke'}));
      const finger=svg('g',{class:'tutorial-demo-finger'});finger.append(ring,inner);
      if(reduced)finger.setAttribute('transform',`translate(${a.x} ${a.y})`);
      else{
        finger.append(svg('animateMotion',{path:d,dur:'2.8s',repeatCount:'indefinite',keyPoints:'0;0;1;1',keyTimes:'0;.18;.78;1',calcMode:'linear'}));
        finger.append(svg('animate',{attributeName:'opacity',values:'0;1;1;0;0',keyTimes:'0;.1;.75;.88;1',dur:'2.8s',repeatCount:'indefinite'}));
      }
      layer.append(finger);
    }
    this.board.append(layer);
  }
  update({guide,hidden,compact,targets=[],demo=null,key=''}) {
    if(this.guide!==guide){this.clearDemo();this.pointers.clear();this.keys.clear();}
    this.guide=guide;this.hidden=!guide||Boolean(hidden);this.demo=demo;this.key=key;
    this.targets=guide&&!hidden?targets:[];
    const root=document.documentElement,rotated=Math.abs(Number(root.dataset.boardRotation))===90;
    const enlarged=parseFloat(getComputedStyle(root).fontSize)>=20;
    // Narrow enlarged-text screens use the same full-text entry from the
    // beginning; a later longer instruction must not suddenly resize the field.
    this.collapsed=Boolean(guide&&(compact||rotated&&innerHeight<=360||enlarged&&(rotated||innerHeight<700||innerWidth<700)));
    this.status?.classList.toggle('tutorial-status',Boolean(guide));
    if(this.status)this.status.hidden=false;
    this.card.hidden=!guide||this.collapsed;
    // Reading a dialog must not resize the circuit behind it.
    this.card.style.visibility=hidden?'hidden':'';
    if(guide&&!hidden&&!this.collapsed&&!root.classList.contains('desktop-layout')){
      const area=this.board.getBoundingClientRect();
      // Very short screens retain the full-text guide action and the circuit.
      if(Math.min(area.width,area.height)<200){this.collapsed=true;this.card.hidden=true;if(this.status)this.status.hidden=false;}
    }
    this.highlight();
  }
}
