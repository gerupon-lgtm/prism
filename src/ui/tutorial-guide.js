// Presentation only. Session owns progress, records, and the original circuit.
export class TutorialGuide {
  constructor(card,board,status=null) {
    this.card=card;this.board=board;this.status=status;this.targets=[];this.collapsed=false;
    card.classList.add('tutorial-guide');
    this.observer=new ResizeObserver(()=>{
      if(this.frame)return;
      this.frame=requestAnimationFrame(()=>{this.frame=null;this.highlight();});
    });this.observer.observe(board);
  }
  highlight() {
    const targets=this.card.hidden&&!this.collapsed?[]:this.targets,names=new Set(targets);
    for(const item of document.querySelectorAll('.tutorial-target'))if(!names.has(item.id)&&!names.has(item.dataset.node)&&!names.has(item.dataset.edge))item.classList.remove('tutorial-target');
    for(const id of targets)(document.getElementById(id)||this.board.querySelector(`[data-node="${CSS.escape(id)}"],.edge:not(.candidate)[data-edge="${CSS.escape(id)}"]`))?.classList.add('tutorial-target');
  }
  update({guide,hidden,compact,targets=[]}) {
    this.targets=guide&&!hidden?targets:[];
    const root=document.documentElement,rotated=Math.abs(Number(root.dataset.boardRotation))===90;
    const enlarged=parseFloat(getComputedStyle(root).fontSize)>=20;
    this.collapsed=Boolean(guide&&(compact||rotated&&innerHeight<=360||enlarged&&(rotated||innerHeight<700)));
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
