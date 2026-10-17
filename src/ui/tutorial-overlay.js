// View-only coaching. The Session still owns guide progress and its backup.
export class TutorialOverlay {
  constructor(card,board) {
    this.card=card;this.board=board;this.signature=null;this.collapsed=false;
    card.classList.add('tutorial-overlay');document.body.append(card);
    this.resizeObserver=new ResizeObserver(()=>{
      this.signature=null;if(this.resizeFrame)return;
      this.resizeFrame=requestAnimationFrame(()=>{this.resizeFrame=null;if(this.last)this.update(this.last);});
    });this.resizeObserver.observe(board);
  }
  update({guide,hidden,compact,heading,text,targets=[]}) {
    this.last={guide,hidden,compact,heading,text,targets};
    this.card.hidden=!guide||hidden;
    const names=new Set(targets);
    for(const item of document.querySelectorAll('.tutorial-target'))if(!names.has(item.id)&&!names.has(item.dataset.node))item.classList.remove('tutorial-target');
    if(this.card.hidden){this.signature=null;document.querySelectorAll('.tutorial-target').forEach(item=>item.classList.remove('tutorial-target'));return;}
    const title=document.getElementById('guide-heading'),copy=document.getElementById('guide-text');
    if(title.textContent!==heading)title.textContent=heading;if(copy.textContent!==text)copy.textContent=text;
    for(const id of targets)(document.getElementById(id)||this.board.querySelector(`[data-node="${CSS.escape(id)}"]`))?.classList.add('tutorial-target');
    const area=this.board.getBoundingClientRect(),signature=JSON.stringify([area.x,area.y,area.width,area.height,heading,text,targets,guide.readyToFinish,compact,getComputedStyle(document.documentElement).fontSize]);
    if(signature===this.signature){this.card.hidden=this.collapsed;return;}this.signature=signature;
    this.card.classList.toggle('tight-coach',area.width<350||area.height<450);
    this.collapsed=compact||area.width<180;
    if(this.collapsed){this.card.hidden=true;return;}
    const obstacles=[...this.board.querySelectorAll('.node-symbol,.node-name,.node-time')].map(e=>e.getBoundingClientRect());
    const protectedAreas=[...targets.map(id=>document.getElementById(id)||this.board.querySelector(`[data-node="${CSS.escape(id)}"] .node-symbol`)).filter(Boolean),...(guide.step>0?this.board.querySelectorAll('.goal .node-symbol'):[])].map(e=>e.getBoundingClientRect());
    const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right+8)-Math.max(a.left,b.left-8))*Math.max(0,Math.min(a.bottom,b.bottom+8)-Math.max(a.top,b.top-8));
    let best=null;const maximum=Math.min(440,area.width-16,innerWidth-20);
    for(const width of [...new Set([maximum,Math.min(maximum,Math.max(180,area.width*.6))])]){
      this.card.style.width=`${width}px`;const box=this.card.getBoundingClientRect();if(box.height>area.height-16)continue;
      const xs=[area.left+8,area.right-box.width-8,area.left+(area.width-box.width)/2],ys=[];
      for(let y=area.top+8;y<=area.bottom-box.height-8;y+=8)ys.push(y);ys.push(area.bottom-box.height-8);
      for(const left of xs)for(const top of ys){const rect={left,top,right:left+box.width,bottom:top+box.height},score=protectedAreas.reduce((s,r)=>s+overlap(rect,r),0)*1e9+obstacles.reduce((s,r)=>s+overlap(rect,r),0)*1000+(maximum-width)*10+(top-area.top)*.01;if(!best||score<best.score)best={left,top,width,height:box.height,score};}
    }
    if(!best){this.collapsed=true;this.card.hidden=true;return;}
    this.card.style.width=`${best.width}px`;
    this.card.style.left=`${Math.max(8,Math.min(innerWidth-best.width-8,best.left))}px`;
    this.card.style.top=`${Math.max(8,Math.min(innerHeight-best.height-8,best.top))}px`;
  }
}
