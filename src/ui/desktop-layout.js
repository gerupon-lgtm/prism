// Move the existing controls, rather than maintaining a second set of buttons
// or calculation state. Restoring the original slots preserves phone rotation.
export class DesktopLayout {
  constructor(root=document) {
    this.root=root;this.active=false;this.sidebar=root.getElementById('desktop-sidebar');
    this.slots=[['stage-heading','desktop-heading'],['challenge-info','desktop-challenge'],['guide-bar','desktop-guide'],['result-line','desktop-runtime'],['play-controls','desktop-actions']].map(([id,target])=>{
      const node=root.getElementById(id),slot=root.createComment(`Original ${id} position`);
      node.before(slot);return {node,slot,target:root.getElementById(target)};
    });
  }
  update({width,height,coarse,rotation,fontSize}) {
    const active=!coarse&&rotation===0&&width>=1100&&height>=700&&fontSize<20;
    if(active===this.active)return false;
    this.active=active;this.root.documentElement.classList.toggle('desktop-layout',active);
    for(const {node,slot,target} of this.slots)active?target.append(node):slot.after(node);
    this.sidebar.hidden=!active;return true;
  }
}
