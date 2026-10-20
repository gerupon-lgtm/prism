// Native touch clicks can disappear after a small drift, even inside a button.
// Confirm only a fresh, single-pointer press released inside the same button.
export class TouchConfirm {
  constructor(root,{context,beforeActivate=()=>{},selector='.wire-delete-actions button'}) {
    Object.assign(this,{root,context,beforeActivate,selector});this.pointers=new Set();this.press=null;this.consumedUntil=0;
    const doc=root.ownerDocument;
    doc.addEventListener('pointerdown',event=>this.down(event),true);
    doc.addEventListener('pointerup',event=>this.up(event),true);
    doc.addEventListener('pointercancel',event=>{this.pointers.delete(event.pointerId);if(this.press?.id===event.pointerId)this.press=null;},true);
    doc.addEventListener('click',event=>{
      // WebKit can retarget the compatibility click to the board underneath
      // with a different mouse id. A fresh pointerdown always clears this guard.
      if(event.detail!==0&&performance.now()<this.consumedUntil){
        this.consumedUntil=0;event.preventDefault();event.stopImmediatePropagation();
      }
    },true);
    doc.defaultView?.addEventListener('blur',()=>this.reset());
    doc.addEventListener('visibilitychange',()=>{if(doc.hidden)this.reset();});
  }
  reset(){this.press=null;this.pointers.clear();}
  down(event) {
    this.consumedUntil=0;
    if(event.pointerType!=='touch'&&event.pointerType!=='pen')return;
    this.pointers.add(event.pointerId);if(this.press)this.press.cancelled=true;
    if(event.button!==0||event.isPrimary===false)return;
    const button=event.target.closest?.(this.selector),context=this.context();
    if(this.pointers.size===1&&button&&this.root.contains(button)&&this.root.open&&!button.disabled&&context){
      this.press={id:event.pointerId,button,context,cancelled:false};
    }
  }
  up(event) {
    this.pointers.delete(event.pointerId);const press=this.press;
    if(!press||press.id!==event.pointerId)return;
    this.press=null;this.consumedUntil=performance.now()+700;
    event.preventDefault();
    const r=press.button.getBoundingClientRect();
    if(press.cancelled||!this.root.open||press.button.disabled||this.context()!==press.context||event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)return;
    this.beforeActivate(event,press.button);press.button.click();
  }
}
