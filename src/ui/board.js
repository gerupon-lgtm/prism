import { svg } from './svg.js';
import { Scene,symbol,constellation } from './scene.js';

export class Board {
  constructor(element, session, changed, openSettings, notify) {
    Object.assign(this,{element,session,changed,openSettings,notify});
    this.orientation = svg('g',{class:'board-orientation'}); this.world = svg('g'); this.particleLayer = svg('g');this.effectsLayer=svg('g',{class:'arrival-layer'});
    this.orientation.append(this.effectsLayer,this.world,this.particleLayer); element.append(this.orientation);
    this.scene=new Scene(element);this.arrivalPictures=new Map();this.pictureRun=null;
    this.pointers = new Map(); this.gesture = null; this.lastTap = null; this.addKind = null;
    element.addEventListener('pointerdown',event=>this.down(event));
    element.addEventListener('pointermove',event=>this.move(event));
    element.addEventListener('pointerup',event=>this.up(event));
    element.addEventListener('pointercancel',event=>this.cancel(event));
    element.addEventListener('contextmenu',event=>event.preventDefault());
    element.addEventListener('wheel',event=>{event.preventDefault();this.zoom(event.deltaY<0?1.15:1/1.15,event.clientX,event.clientY);},{passive:false});
    this.resizeObserver = new ResizeObserver(()=>this.resize()); this.resizeObserver.observe(element);
    this.render(); this.resize();
  }
  resize() {
    this.angle=Number(document.documentElement.dataset.boardRotation||0);
    // Leave room around the canonical circuit for readable labels and touch targets.
    this.element.setAttribute('viewBox','-180 -240 1360 2080');
    this.orientation.setAttribute('transform','');
    this.cancelAll(); this.transform(); this.render();
  }
  transform() {
    const {panX,panY,zoom}=this.session.view;
    const matrix=`translate(${panX} ${panY}) scale(${zoom})`;
    this.world.setAttribute('transform',matrix); this.particleLayer.setAttribute('transform',matrix);this.effectsLayer.setAttribute('transform',matrix);
    const screenMatrix=this.world.getScreenCTM();
    if(screenMatrix){const scale=Math.hypot(screenMatrix.a,screenMatrix.b);this.fontFactor=Math.max(1,0.5/scale);this.element.style.setProperty('--board-factor',this.fontFactor);}
  }
  location(x,y,matrix=this.world.getScreenCTM().inverse()) {
    return new DOMPoint(x,y).matrixTransform(matrix);
  }
  position(node) {return {x:((node.x??0.5)/(this.projectionScale??1))*1000,y:1600-((node.y??0.5)/(this.projectionScale??1))*1600};}
  coordinates(at) {return {x:at.x/1000*(this.projectionScale??1),y:(1600-at.y)/1600*(this.projectionScale??1)};}
  zoom(factor,x,y) {
    const rect=this.element.getBoundingClientRect();
    x ??= rect.left+rect.width/2; y ??= rect.top+rect.height/2;
    const before=this.location(x,y), old=this.session.view.zoom, next=Math.max(0.25,Math.min(6,old*factor));
    this.session.view.panX += before.x*(old-next); this.session.view.panY += before.y*(old-next);
    this.session.view.zoom=next; this.transform(); this.render();
  }
  fit() {
    const input=this.session.run&&this.session.run.status!=='stopped'?this.session.run.circuit.raw:this.session.circuit;
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const node of input.nodes){const at=this.position(node);minX=Math.min(minX,at.x);minY=Math.min(minY,at.y);maxX=Math.max(maxX,at.x);maxY=Math.max(maxY,at.y);}
    const zoom=Math.min(6,1000/(maxX-minX+250),1600/(maxY-minY+300));
    Object.assign(this.session.view,{zoom,panX:500-(minX/2+maxX/2)*zoom,panY:800-(minY/2+maxY/2)*zoom});this.transform();this.render();
  }
  render() {
    this.world.replaceChildren(); this.curves = new Map(); this.transform();
    const kind=this.session.mode==='free'?'sky':Number(this.session.challenge.id.slice(1))<=3?'ruins':'observatory';
    this.scene.draw(1000,1600,kind);
    const input=this.session.run && this.session.run.status!=='stopped' ? this.session.run.circuit.raw : this.session.circuit;
    let extent=1;for(const node of input.nodes)extent=Math.max(extent,Math.abs(node.x??0.5),Math.abs(node.y??0.5));
    // Display projection only; original coordinates are retained in circuit files.
    this.projectionScale=extent>1000?extent:1;
    const nodes=new Map(input.nodes.map(node=>[node.id,node]));
    const candidates=this.session.mode==='challenge' ? this.session.challenge.candidates.filter(edge=>!input.edges.some(built=>built.id===edge.id)) : [];
    const all=[...input.edges,...candidates];
    const parallels=new Map();
    for(const edge of all){const key=JSON.stringify([edge.from,edge.to].sort());let list=parallels.get(key);if(!list){list=[];parallels.set(key,list);}list.push(edge);}
    for (const edge of all) {
      const a=this.position(nodes.get(edge.from)),b=this.position(nodes.get(edge.to));
      const parallel=parallels.get(JSON.stringify([edge.from,edge.to].sort()));
      const at=parallel.findIndex(other=>other.id===edge.id), offset=(at-(parallel.length-1)/2)*95;
      const length=Math.hypot(b.x-a.x,b.y-a.y),normal=offset*(edge.from<edge.to?1:-1);
      const control=length ? {x:(a.x+b.x)/2-(b.y-a.y)/length*normal,y:(a.y+b.y)/2+(b.x-a.x)/length*normal} : {x:a.x+160+offset,y:a.y-160-offset};
      const curve={a,b,control}; this.curves.set(edge.id,curve);
      const candidate=candidates.includes(edge),disabled=edge.enabled===false||nodes.get(edge.from).enabled===false||nodes.get(edge.to).enabled===false;
      const group=svg('g',{'data-edge':edge.id,class:`edge${candidate?' candidate':''}${disabled?' unavailable':''}${this.session.selection===edge.id?' selected':''}`});
      const d=`M${a.x},${a.y} Q${control.x},${control.y} ${b.x},${b.y}`;
      group.append(svg('path',{d,class:'edge-hit'}),svg('path',{d,class:'edge-line'}));
      const middle=this.onCurve(curve,0.5), label=svg('g',{transform:`translate(${middle.x} ${middle.y}) rotate(${-this.angle})`});
      label.append(svg('text',{y:-10,class:'edge-time'},`${edge.time}s ${edge.bidirectional?'↔':'→'}`));group.append(label);
      this.world.append(group);
    }
    for (const node of input.nodes) {
      const at=this.position(node),selected=this.session.selection===node.id;
      const group=svg('g',{'data-node':node.id,class:`node ${node.kind}${selected?' selected':''}${node.enabled===false?' unavailable':''}`,transform:`translate(${at.x} ${at.y}) rotate(${-this.angle})`,tabindex:0,role:'button','aria-label':`${node.name??node.id} ${node.kind==='goal'?'祭壇':node.kind==='source'?'出発点':'プリズム'}${node.enabled===false?' 使用不可':''}`});
      const factor=this.fontFactor??1;
      group.append(svg('circle',{r:65*factor,class:'node-hit'}));
      group.append(symbol(node.kind,factor));
      if(node.enabled===false)group.append(svg('path',{d:`M${-28*factor} ${-28*factor} L${28*factor} ${28*factor} M${28*factor} ${-28*factor} L${-28*factor} ${28*factor}`,class:'disabled-mark'}));
      const label=node.name??node.id;
      group.append(svg('title',{},label),svg('text',{y:(node.kind==='goal'?-50:8)*factor,class:'node-name'},label.length>8?`${label.slice(0,7)}…`:label));
      if(node.kind!=='goal') group.append(svg('text',{y:(node.kind==='source'?-58:58)*factor,class:'node-time'},`${node.process}s${node.kind==='source'?'（戻り）':''}`));
      if(selected&&this.session.mode==='free'&&this.session.editable) group.append(svg('circle',{cx:55*factor,cy:-45*factor,r:19*factor,'data-move':node.id,class:'move-handle'}));
      group.addEventListener('keydown',event=>{
        if(event.key==='Enter'||event.key===' '){event.preventDefault();this.session.selection=node.id;this.render();this.openSettings();}
      });
      this.world.append(group);
    }
    const selected=this.world.querySelector(`[data-node="${CSS.escape(this.session.selection??'')}"]`);if(selected)this.world.append(selected);
    if (this.session.selection) {
      for(const group of this.world.querySelectorAll('[data-node]')) {
        if(candidates.some(edge=>edge.from===this.session.selection&&edge.to===group.dataset.node)) group.classList.add('choice');
      }
    }
    this.wire=svg('path',{class:'wire-preview'});this.world.append(this.wire);
    this.renderArrivals();
    this.particles();
  }
  renderArrivals() {
    const run=this.session.run;
    if(this.pictureRun!==run||run?.status==='stopped'){this.arrivalPictures.clear();this.pictureRun=run;}
    this.effectsLayer.replaceChildren();
    const now=performance.now();
    for(const [id,picture] of this.arrivalPictures){
      if(now-picture.at>=1300){this.arrivalPictures.delete(id);continue;}
      const node=run.circuit.nodes.get(picture.node),art=constellation(this.position(node),this.fontFactor??1,this.angle,id);
      art.style.animationDelay=`-${Math.max(0,now-picture.at)}ms`;this.effectsLayer.append(art);
    }
  }
  arrivals(entries) {
    if(this.pictureRun!==this.session.run){this.arrivalPictures.clear();this.pictureRun=this.session.run;}
    for(const entry of entries)if(entry.type==='goal'){
      this.arrivalPictures.set(entry.particle,{node:entry.node,at:performance.now()});
      const run=this.session.run,id=entry.particle;
      setTimeout(()=>{if(this.pictureRun===run){this.arrivalPictures.delete(id);this.effectsLayer.querySelector(`[data-arrived-particle="${id}"]`)?.remove();}},1300);
    }
    this.renderArrivals();
  }
  onCurve({a,b,control},fraction) {
    const r=1-fraction;return {x:r*r*a.x+2*r*fraction*control.x+fraction*fraction*b.x,y:r*r*a.y+2*r*fraction*control.y+fraction*fraction*b.y};
  }
  particles() {
    this.particleLayer.replaceChildren();
    const run=this.session.run;if(!run||run.status==='stopped')return;
    for(const group of this.world.querySelectorAll('[data-node]')){
      group.querySelector('.node-state')?.remove();const gate=run.gates.get(group.dataset.node),waiting=gate.queue.length-gate.head;
      if(waiting||gate.current!==null)group.append(svg('text',{y:(group.classList.contains('source')?-84:84)*(this.fontFactor??1),class:'node-state'},`${gate.current!==null?'処理中':''}${waiting?' 待ち'+waiting:''}`));
    }
    for(const particle of run.particles.values()) {
      let at;
      if(particle.status==='moving') {
        const curve=this.curves.get(particle.edge); if(!curve)continue;
        // Calculate a bounded ratio without turning huge absolute times into Numbers.
        const travelled=run.clock-particle.departed,duration=particle.due-particle.departed;
        const fraction=Number(travelled*10000n/duration)/10000;
        const directed=particle.from===run.circuit.edges.get(particle.edge).from?curve:{a:curve.b,b:curve.a,control:curve.control};
        at=this.onCurve(directed,fraction);
        const tail=this.onCurve(directed,Math.max(0,fraction-.045));
        this.particleLayer.append(svg('path',{d:`M${tail.x} ${tail.y} L${at.x} ${at.y}`,class:'light-trail'}));
      } else if(['waiting','processing','deadend'].includes(particle.status)) at=this.position(run.circuit.nodes.get(particle.node));
      else continue;
      this.particleLayer.append(svg('circle',{cx:at.x,cy:at.y,r:particle.status==='deadend'?16:11,class:`particle ${particle.status}`}));
    }
  }
  down(event) {
    if(event.button!==0)return;event.preventDefault();this.element.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(this.pointers.size>=2){if(this.pointers.size===2)this.gesture={kind:'pinch',distance:this.distance()};this.wire?.setAttribute('d','');return;}
    const node=event.target.closest('[data-node]')?.dataset.node,edge=event.target.closest('[data-edge]')?.dataset.edge;
    if(node||edge){this.session.selection=node??edge;this.render();this.changed(false);}
    const matrix=this.world.getScreenCTM().inverse(), at=this.location(event.clientX,event.clientY,matrix);
    this.gesture={kind:event.target.dataset.move?'move':node?'wire':'pan',id:node??edge,start:at,last:at,x:event.clientX,y:event.clientY,matrix,moved:false,panX:this.session.view.panX,panY:this.session.view.panY};
  }
  distance() {const [a,b]=[...this.pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y);}
  move(event) {
    if(!this.pointers.has(event.pointerId)||!this.gesture)return;
    this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});const gesture=this.gesture;
    if(gesture.kind==='pinch') {
      if(this.pointers.size<2)return; const distance=this.distance(),[a,b]=[...this.pointers.values()];
      if(gesture.distance>0)this.zoom(distance/gesture.distance,(a.x+b.x)/2,(a.y+b.y)/2);gesture.distance=distance;return;
    }
    gesture.moved ||= Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>7;
    gesture.last=this.location(event.clientX,event.clientY,gesture.matrix);
    if(gesture.kind==='pan'&&gesture.moved) {
      const zoom=this.session.view.zoom;this.session.view.panX=gesture.panX+(gesture.last.x-gesture.start.x)*zoom;this.session.view.panY=gesture.panY+(gesture.last.y-gesture.start.y)*zoom;this.transform();
    } else if(gesture.kind==='wire'&&gesture.moved&&this.session.editable) {
      const at=this.position(this.session.circuit.nodes.find(node=>node.id===gesture.id));
      this.wire.setAttribute('d',`M${at.x},${at.y} L${gesture.last.x},${gesture.last.y}`);
    } else if(gesture.kind==='move'&&gesture.moved&&this.session.editable) {
      const group=this.world.querySelector(`[data-node="${CSS.escape(gesture.id)}"]`);
      group?.setAttribute('transform',`translate(${gesture.last.x} ${gesture.last.y}) rotate(${-this.angle})`);
    }
  }
  up(event) {
    const gesture=this.gesture;this.pointers.delete(event.pointerId);
    if(!gesture)return;
    if(gesture.kind==='pinch'){if(this.pointers.size===0)this.cancelAll();return;}
    this.gesture=null;this.wire?.setAttribute('d','');
    try {
      if(gesture.kind==='wire'&&gesture.moved&&this.session.editable) {
        const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-node]')?.dataset.node;
        if(target&&target!==gesture.id)this.session.connect(gesture.id,target);
      } else if(gesture.kind==='move'&&gesture.moved&&this.session.editable) {const at=this.coordinates(gesture.last);this.session.moveNode(gesture.id,at.x,at.y);}
      else if(!gesture.moved) {
        if(this.addKind&&gesture.kind==='pan'&&!gesture.id){const at=this.coordinates(gesture.last);this.session.addNode(this.addKind,at.x,at.y);this.addKind=null;}
        else if(gesture.id) {
          const now=performance.now();
          if(this.lastTap?.id===gesture.id&&now-this.lastTap.time<400){this.lastTap=null;this.openSettings();}
          else this.lastTap={id:gesture.id,time:now};
        }
      }
    } catch(error){this.notify(error.message);}
    this.render();this.changed();
  }
  cancel(event) {this.pointers.delete(event.pointerId);this.cancelAll();this.render();}
  cancelAll() {this.gesture=null;this.pointers.clear();this.lastTap=null;this.wire?.setAttribute('d','');}
}
