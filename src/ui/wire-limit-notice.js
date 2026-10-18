// A short, non-interactive explanation. It never changes the gesture or game.
export class WireLimitNotice {
  constructor(notice,budget,board) {
    Object.assign(this,{notice,budget,board});this.timer=null;
    document.addEventListener('pointerdown',event=>{if(!board.contains(event.target))this.hide();},true);
    document.addEventListener('keydown',()=>this.hide(),true);
    window.addEventListener('resize',()=>this.hide());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.hide();});
  }
  show(limit) {
    this.hide();
    this.notice.querySelector('strong').textContent=`配線は上限${limit}本までです`;
    this.notice.hidden=false;
    const anchor=this.budget.getBoundingClientRect(),fallback=this.board.getBoundingClientRect();
    const at=anchor.width&&anchor.height?anchor:fallback;
    const width=document.documentElement.clientWidth,height=innerHeight,rect=this.notice.getBoundingClientRect();
    this.notice.style.left=`${Math.max(8,Math.min(width-rect.width-8,at.left+(at.width-rect.width)/2))}px`;
    this.notice.style.top=`${Math.max(8,Math.min(height-rect.height-8,at.bottom+8))}px`;
    // Restart only for a new attempt, never on each pointer move.
    void this.budget.offsetWidth;this.budget.classList.add('wire-limit-attention');
    this.timer=setTimeout(()=>this.hide(),3200);
  }
  hide() {
    clearTimeout(this.timer);this.timer=null;if(!this.notice.hidden)this.notice.hidden=true;
    this.budget.classList.remove('wire-limit-attention');
  }
}
