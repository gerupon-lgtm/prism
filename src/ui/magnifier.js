import { svg } from './svg.js';

export const MAGNIFIER_ZOOM=1.4;

// Keep the window anchored for a stroke; relocate only to clear the finger.
export function magnifierPlacement({area,obstacles,pointer,previous=null}) {
  const away=({x,y,size,height})=>pointer.x<x-35||pointer.x>x+size+35||pointer.y<y-35||pointer.y>y+height+35;
  const inside=p=>p.x>=area.left&&p.y>=area.top&&p.x+p.size<=area.right&&p.y+p.height<=area.bottom;
  if(previous&&inside(previous)&&away(previous))return previous;
  const maximum=Math.min(150,area.width-12,area.height-35);
  let size=previous?.size??Math.min(maximum,Math.max(55,Math.min(150,area.width*.45,area.height*.45)));
  if(size<55||size>maximum||area.height<size+35)return null;
  const overlap=p=>obstacles.reduce((sum,b)=>sum+Math.max(0,Math.min(p.x+p.size,b.right)-Math.max(p.x,b.left))*Math.max(0,Math.min(p.y+p.height,b.bottom)-Math.max(p.y,b.top)),0);
  const choose=(positions,size)=>positions.reduce((best,p)=>p.y<best.y-1||Math.abs(p.y-best.y)<=1&&Math.hypot(p.x+size/2-pointer.x,p.y+p.height/2-pointer.y)>Math.hypot(best.x+size/2-pointer.x,best.y+best.height/2-pointer.y)?p:best);
  for(;;){
    const height=size+23,left=area.left+6,right=area.right-size-6,top=area.top+6,bottom=area.bottom-height-6;
    const upperBottom=Math.max(top,Math.min(bottom,area.top+area.height*.35));
    const positions=Array.from({length:13},(_,i)=>left+(right-left)*i/12).flatMap(x=>Array.from({length:7},(_,i)=>({x,y:top+(upperBottom-top)*i/6,size,height}))).filter(away);
    const empty=positions.filter(p=>overlap(p)===0);
    if(empty.length)return choose(empty,size);
    if(previous||size<=55){
      // Very short/dense fields may have no clear upper location. Keep the
      // current size and avoid the finger; prefer parts/labels over empty scenery.
      const all=Array.from({length:13},(_,i)=>left+(right-left)*i/12).flatMap(x=>Array.from({length:9},(_,i)=>({x,y:top+(bottom-top)*i/8,size,height}))).filter(away);
      if(!all.length)return null;
      const clear=all.filter(p=>overlap(p)===0);if(clear.length)return choose(clear,size);
      return all.reduce((best,p)=>overlap(p)<overlap(best)?p:best);
    }
    size=Math.max(55,size-20);
  }
}

// A second view of the board, in screen coordinates. It never receives input.
export class Magnifier {
  constructor(board) {
    this.board=board;this.enabled=matchMedia('(pointer:coarse)').matches;
    this.element=document.createElement('aside');this.element.id='wire-magnifier';this.element.hidden=true;this.element.inert=true;this.element.setAttribute('aria-hidden','true');
    this.label=document.createElement('span');this.image=svg('svg',{viewBox:'0 0 150 150'});this.detail=svg('g');
    this.detail.append(svg('use',{href:'#board-detail'}));this.image.append(this.detail,svg('circle',{cx:75,cy:75,r:8,class:'magnifier-center'}));
    this.element.append(this.label,this.image);document.body.append(this.element);
  }
  hide(){this.element.hidden=true;this.layout=null;this.placement=null;}
  toggle(){this.enabled=!this.enabled;this.hide();}
  show(event,label) {
    if(!this.enabled){this.hide();return;}
    if(!this.layout){
      const matrix=this.board.orientation.getScreenCTM();if(!matrix)return;
      const area=this.board.element.getBoundingClientRect();
      const obstacles=[...this.board.world.querySelectorAll('.node-hit,.node-name,.node-time,.edge-label-card'),...document.querySelectorAll('#stage-controls button')].filter(e=>e.getClientRects().length&&!e.closest('[hidden]')).map(e=>e.getBoundingClientRect());
      this.layout={matrix,area,obstacles};
    }
    const placement=magnifierPlacement({...this.layout,pointer:{x:event.clientX,y:event.clientY},previous:this.placement});
    if(!placement){this.element.hidden=true;return;}
    if(placement!==this.placement){this.placement=placement;const {x,y,size,height}=placement;this.element.style.cssText=`left:${x}px;top:${y}px;width:${size}px;height:${height}px`;}
    const {matrix}=this.layout,{size}=placement;
    this.image.style.setProperty('--board-factor',this.board.fontFactor??1);
    const zoom=MAGNIFIER_ZOOM*150/size;
    this.detail.setAttribute('transform',`matrix(${matrix.a*zoom} ${matrix.b*zoom} ${matrix.c*zoom} ${matrix.d*zoom} ${(matrix.e-event.clientX)*zoom+75} ${(matrix.f-event.clientY)*zoom+75})`);
    this.label.textContent=label;this.element.hidden=false;
  }
}
