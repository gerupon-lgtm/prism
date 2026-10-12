import { svg } from './svg.js';

// A second view of the board, in screen coordinates. It never receives input.
export class Magnifier {
  constructor(board) {
    this.board=board;this.enabled=matchMedia('(pointer:coarse)').matches;
    this.element=document.createElement('aside');this.element.id='wire-magnifier';this.element.hidden=true;this.element.inert=true;this.element.setAttribute('aria-hidden','true');
    this.label=document.createElement('span');this.image=svg('svg',{viewBox:'0 0 150 150'});this.detail=svg('g');
    this.detail.append(svg('use',{href:'#board-detail'}));this.image.append(this.detail,svg('circle',{cx:75,cy:75,r:8,class:'magnifier-center'}));
    this.element.append(this.label,this.image);document.body.append(this.element);
  }
  hide(){this.element.hidden=true;}
  toggle(){this.enabled=!this.enabled;this.hide();}
  show(event,label) {
    if(!this.enabled){this.hide();return;}
    const matrix=this.board.orientation.getScreenCTM(),area=this.board.element.getBoundingClientRect();if(!matrix)return;
    const maximum=Math.min(150,area.width-12,area.height-35);
    let size=Math.min(maximum,Math.max(55,Math.min(150,area.width*.45,area.height*.45))),height=size+23;
    if(size<55||area.height<height+12){this.hide();return;}
    const obstacles=[...this.board.world.querySelectorAll('.node-hit'),...document.querySelectorAll('#stage-controls button')].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect());
    const awayFromFinger=([x,y])=>event.clientX<x-35||event.clientX>x+size+35||event.clientY<y-35||event.clientY>y+height+35;
    const overlap=([x,y])=>obstacles.reduce((sum,b)=>sum+Math.max(0,Math.min(x+size,b.right)-Math.max(x,b.left))*Math.max(0,Math.min(y+height,b.bottom)-Math.max(y,b.top)),0);
    let choices=[];
    for(;;){
      height=size+23;
      const left=area.left+6,right=area.right-size-6,top=area.top+6,bottom=area.bottom-height-6;
      const positions=Array.from({length:5},(_,i)=>left+(right-left)*i/4).flatMap(x=>Array.from({length:5},(_,i)=>[x,top+(bottom-top)*i/4]));
      const available=positions.filter(awayFromFinger),empty=available.filter(corner=>overlap(corner)===0);
      if(empty.length){choices=empty;break;}
      if(size<=55){choices=available;break;}
      size=Math.max(55,size-20);
    }
    if(!choices.length){this.hide();return;}
    const score=([x,y])=>Math.hypot(x+size/2-event.clientX,y+height/2-event.clientY)-overlap([x,y])/20;
    const [x,y]=choices.reduce((best,corner)=>score(corner)>score(best)?corner:best);
    this.element.style.cssText=`left:${x}px;top:${y}px;width:${size}px;height:${height}px`;
    this.image.style.setProperty('--board-factor',this.board.fontFactor??1);
    const zoom=2*150/size;
    this.detail.setAttribute('transform',`matrix(${matrix.a*zoom} ${matrix.b*zoom} ${matrix.c*zoom} ${matrix.d*zoom} ${(matrix.e-event.clientX)*zoom+75} ${(matrix.f-event.clientY)*zoom+75})`);
    this.label.textContent=label;this.element.hidden=false;
  }
}
