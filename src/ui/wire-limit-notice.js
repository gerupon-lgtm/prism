// A short, non-interactive explanation. It never changes the gesture or game.
export class WireLimitNotice {
  constructor(notice,budget,board) {
    Object.assign(this,{notice,budget,board});this.timer=null;this.noticePress=false;
    document.addEventListener('pointerdown',event=>{
      this.noticePress=!notice.hidden&&Boolean(notice.closest('.orientation-region')?.contains(event.target));
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
  show(limit) {
    this.hide();
    const large=document.getElementById('app').classList.contains('text-enlarged');
    this.notice.querySelector('strong').textContent=`${large?'':'配線は'}上限${limit}本までです`;
    this.notice.querySelector('span').textContent='長押しで削除';
    this.notice.hidden=false;
    // The reserved status region sits outside the field in every orientation.
    // Showing the notice must never resize or cover the circuit.
    // Restart only for a new attempt, never on each pointer move.
    void this.budget.offsetWidth;this.budget.classList.add('wire-limit-attention');
    this.timer=setTimeout(()=>this.hide(),3200);
  }
  hide() {
    clearTimeout(this.timer);this.timer=null;if(!this.notice.hidden)this.notice.hidden=true;
    this.budget.classList.remove('wire-limit-attention');
  }
}
