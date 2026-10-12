const signed=angle=>{const value=((angle%360)+360)%360;return value===270?-90:value;};

// Screen angles are counter-clockwise; CSS angles are clockwise.
// Refer to portrait-primary even when the screen's natural orientation is landscape.
export function frameRotation({width,height,type,angle,portraitAngle,legacyAngle,coarse=false,editing=false,previous=0}) {
  if(coarse&&/^(portrait|landscape)-(primary|secondary)$/.test(type)&&Number.isFinite(angle)) {
    if(type==='portrait-primary')return 0;
    if(type==='portrait-secondary')return 180;
    const naturalPortrait=type.startsWith('portrait')===(angle%180===0);
    return signed(-(angle-(portraitAngle??(naturalPortrait?0:90))));
  }
  if(coarse&&Number.isFinite(legacyAngle))return signed(-legacyAngle);
  if(editing)return previous;
  return width>height?-90:0;
}

export class OrientationLayout {
  constructor(app) {
    this.app=app;this.regions=[...app.querySelectorAll('.orientation-region')];this.rotation=0;
    this.observer=new ResizeObserver(()=>this.syncRegions());for(const region of this.regions)this.observer.observe(region);
  }
  update({width,height,...direction}) {
    if(direction.coarse&&Number.isFinite(direction.angle)&&direction.type?.startsWith('portrait'))this.portraitAngle=signed(direction.angle-(direction.type==='portrait-secondary'?180:0));
    direction.portraitAngle=this.portraitAngle;
    this.rotation=frameRotation({width,height,...direction,previous:this.rotation});
    const root=document.documentElement,landscape=Math.abs(this.rotation)===90;
    root.dataset.boardRotation=String(this.rotation);root.classList.toggle('device-landscape',landscape);root.classList.toggle('device-inverted',this.rotation===180);
    root.classList.toggle('device-left',this.rotation===-90);
    root.style.setProperty('--app-height',`${height}px`);root.style.setProperty('--layout-width',`${landscape?height:width}px`);root.style.setProperty('--layout-height',`${landscape?width:height}px`);
    root.style.setProperty('--ui-rotation',`${-this.rotation}deg`);
    this.app.style.transform=this.rotation===-90?'translateY(var(--layout-width)) rotate(-90deg)':this.rotation===90?'translateX(var(--layout-height)) rotate(90deg)':this.rotation===180?'translate(var(--layout-width),var(--layout-height)) rotate(180deg)':'';
    this.syncRegions();
  }
  syncRegions() {
    for(const region of this.regions) {
      const content=region.querySelector(':scope > .orientation-content');if(!content)continue;
      if(Math.abs(this.rotation)===90) {
        const style=getComputedStyle(region),width=region.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),height=region.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
        content.style.width=`${Math.max(0,height)}px`;content.style.height=`${Math.max(0,width)}px`;
      }else{content.style.width='';content.style.height='';}
    }
  }
}
