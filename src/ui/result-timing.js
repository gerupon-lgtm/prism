export const RESULT_TIMING_STORAGE_KEY='prism-notes.result-timing.v1';
export const DEFAULT_RESULT_TIMING=Object.freeze({clearMs:1600,failureMs:1600});
export const MIN_RESULT_WAIT_MS=0;
export const MAX_RESULT_WAIT_MS=5000;
export const RESULT_WAIT_STEP_MS=100;

export function validResultWaitMs(value) {
  return typeof value==='number'&&Number.isFinite(value)&&Number.isInteger(value)
    &&value>=MIN_RESULT_WAIT_MS&&value<=MAX_RESULT_WAIT_MS&&value%RESULT_WAIT_STEP_MS===0;
}

const exactKeys=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)
  &&Object.keys(value).length===keys.length&&keys.every(key=>Object.prototype.hasOwnProperty.call(value,key));
const validValues=value=>exactKeys(value,['clearMs','failureMs'])
  &&validResultWaitMs(value.clearMs)&&validResultWaitMs(value.failureMs);

// Presentation only. Never write to circuit or score storage.
export class ResultTimingPreference {
  #values=DEFAULT_RESULT_TIMING;

  constructor(storage) {
    this.storage=storage;this.warning='';this.reload();
  }
  get values(){return this.#values;}

  select(value) {
    if(!validValues(value))throw new Error('結果表示の待ち時間は、両方とも0〜5秒を0.1秒刻みで指定してください。');
    const next=Object.freeze({clearMs:value.clearMs,failureMs:value.failureMs});
    try{this.storage.setItem(RESULT_TIMING_STORAGE_KEY,JSON.stringify({version:1,...next}));}
    catch{throw new Error('結果表示の待ち時間を保存できませんでした。元の設定を保っています。ブラウザの保存設定や空き容量を確認して、もう一度お試しください。');}
    this.#values=next;this.warning='';
  }
  reset(){this.select(DEFAULT_RESULT_TIMING);}

  reload() {
    try {
      const text=this.storage.getItem(RESULT_TIMING_STORAGE_KEY);
      if(text===null){this.#values=DEFAULT_RESULT_TIMING;this.warning='';return;}
      const saved=JSON.parse(text);
      if(!exactKeys(saved,['version','clearMs','failureMs'])||saved.version!==1
        ||!validResultWaitMs(saved.clearMs)||!validResultWaitMs(saved.failureMs))throw Error('Invalid result timing preference');
      this.#values=Object.freeze({clearMs:saved.clearMs,failureMs:saved.failureMs});this.warning='';
    }catch{
      this.#values=DEFAULT_RESULT_TIMING;
      this.warning='結果表示の待ち時間を読み取れないため、初期値を使っています。元の保存内容は保持しています。';
    }
  }
}
