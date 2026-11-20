// The current continuous play only. Scores, saved circuits and tutorial state
// remain owned by Session; opening the story gallery never changes this object.
export const STORY_BEFORE_STAGE=Object.freeze({1:'P',4:'M1',6:'M2',7:'B1',13:'B2',19:'B3',25:'B4',31:'B5',37:'B6'});
export class StoryProgress {
  constructor(challengeIds){this.ids=[...challengeIds];this.cancel();}
  cancel(){this.active=false;this.index=-1;this.cleared=0;this.ended=false;}
  start(id){
    this.cancel();if(id!==this.ids[0])return null;
    this.active=true;this.index=0;return 'P';
  }
  advance(clearedId,nextId){
    if(!this.active)return null;
    if(this.index>0&&clearedId===this.ids[this.index-1]&&nextId===this.ids[this.index])return null;
    if(clearedId!==this.ids[this.index]||nextId!==this.ids[this.index+1]){this.cancel();return null;}
    this.index++;this.cleared=this.index;return STORY_BEFORE_STAGE[this.index+1]??null;
  }
  canEnd(id){return this.active&&this.index===this.ids.length-1&&this.cleared===this.ids.length-1&&id===this.ids[this.index];}
  finish(id){if(!this.canEnd(id))return null;this.cleared++;this.active=false;this.ended=true;return 'E';}
  snapshot(){return {active:this.active,stage:this.index<0?null:this.index+1,cleared:this.cleared,ended:this.ended};}
}

// A cancellable presentation wait, separate from the game's official clock.
export class StoryTransition {
  constructor({schedule=(action,delay)=>setTimeout(action,delay),clear=handle=>clearTimeout(handle)}={}){this.schedule=schedule;this.clear=clear;this.ticket=null;}
  get pending(){return this.ticket!==null;}
  cancel(){if(this.ticket)this.clear(this.ticket.handle);this.ticket=null;}
  wait(delay,action){
    this.cancel();const ticket={};this.ticket=ticket;
    ticket.handle=this.schedule(()=>{if(this.ticket!==ticket)return;this.ticket=null;action();},delay);
  }
}
