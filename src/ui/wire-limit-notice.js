// A short, non-interactive explanation. It never changes the gesture or game.
export class WireLimitNotice {
  constructor(notice,budget,board) {
    Object.assign(this,{notice,budget,board});this.timer=null;this.noticePress=false;this.persistent=false;
    document.addEventListener('pointerdown',event=>{
      const r=notice.getBoundingClientRect();
      this.noticePress=!notice.hidden&&event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom&&Boolean(notice.closest('.orientation-region')?.contains(event.target));
      if(!board.contains(event.target)&&!this.noticePress)this.hide();
    },true);
    // A tap on the non-interactive notice must not activate the status button
    // that reappears beneath it, including when the timer expires mid-press.
    // A fresh press elsewhere or keyboard input immediately clears this guard.
    document.addEventListener('click',event=>{if(this.noticePress){this.noticePress=false;event.preventDefault();event.stopImmediatePropagation();}},true);
    document.addEventListener('keydown',()=>{this.noticePress=false;this.hide();},true);
    window.addEventListener('resize',()=>this.hide());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.hide();});
  }
  update({active,limit}) {
    this.persistent=active;
    if(active){clearTimeout(this.timer);this.timer=null;this.display(limit);}
    else this.hide();
  }
  display(limit) {
    const heading=this.notice.querySelector('strong'),detail=this.notice.querySelector('span'),label=`配線は上限${limit}本です。残り0本。追加するには、線を長押しして削除してください。`;
    if(heading.textContent!=='残り0本')heading.textContent='残り0本';
    if(detail.textContent!=='追加するには、線を長押しして削除')detail.textContent='追加するには、線を長押しして削除';
    if(this.notice.getAttribute('aria-label')!==label)this.notice.setAttribute('aria-label',label);
    if(this.notice.hidden)this.notice.hidden=false;
  }
  show(limit) {
    clearTimeout(this.timer);this.display(limit);
    // The reserved status region sits outside the field in every orientation.
    // Showing the notice must never resize or cover the circuit.
    // Restart only for a new attempt, never on each pointer move.
    clearTimeout(this.attentionTimer);this.budget.classList.remove('wire-limit-attention');
    void this.budget.offsetWidth;this.budget.classList.add('wire-limit-attention');
    this.attentionTimer=setTimeout(()=>this.budget.classList.remove('wire-limit-attention'),800);
    if(!this.persistent)this.timer=setTimeout(()=>this.hide(),3200);
  }
  hide() {
    if(this.persistent)return;
    clearTimeout(this.timer);this.timer=null;if(!this.notice.hidden)this.notice.hidden=true;
    this.budget.classList.remove('wire-limit-attention');
  }
}
