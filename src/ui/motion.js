export const MOTION_STORAGE_KEY='prism-notes.motion.v1';
export const MOTION_OPTIONS=Object.freeze([
  {value:'auto',label:'端末設定に合わせる（初期値）'},
  {value:'full',label:'通常の演出'},
  {value:'reduce',label:'控えめな演出'},
]);
const valid=value=>MOTION_OPTIONS.some(option=>option.value===value);

// Presentation only. Never write to OS preferences or game records.
export class MotionPreference {
  constructor(storage,root,media,changed=()=>{}) {
    Object.assign(this,{storage,root,media,changed});this.preference='auto';this.warning='';
    this.read();this.apply();
    this.listener=()=>this.apply();
    if(media.addEventListener)media.addEventListener('change',this.listener);
    else media.addListener?.(this.listener);
  }
  get reduced(){return this.preference==='reduce'||(this.preference==='auto'&&this.media.matches);}
  read() {
    try {
      const text=this.storage.getItem(MOTION_STORAGE_KEY);
      if(text===null){this.preference='auto';this.warning='';return;}
      const saved=JSON.parse(text);
      if(saved?.version!==1||!valid(saved.value))throw Error('Invalid motion preference');
      this.preference=saved.value;this.warning='';
    }catch{this.preference='auto';this.warning='演出の設定を読み取れないため、端末設定に合わせています。元の保存内容は保持しています。';}
  }
  apply(){this.root.dataset.motion=this.reduced?'reduce':'full';this.changed();}
  select(value) {
    if(!valid(value))throw new Error('演出の設定を選んでください。');
    try{this.storage.setItem(MOTION_STORAGE_KEY,JSON.stringify({version:1,value}));}
    catch{throw new Error('演出の設定を保存できませんでした。元の設定を保っています。もう一度お試しください。');}
    this.preference=value;this.warning='';this.apply();
  }
  reload(){this.read();this.apply();}
}
