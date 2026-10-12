export class Offline {
  constructor(changed) {
    this.changed=changed;this.version=document.querySelector('meta[name="prism-version"]').content;
    this.enabled=Boolean(document.querySelector('meta[name="prism-offline"]'));
    this.registration=null;this.applying=false;this.state={ready:false,update:false,error:null,checking:false};
    navigator.serviceWorker?.addEventListener('controllerchange',()=>{
      if(this.applying){
        if(!this.allowed())this.rejectApply?.(new Error('更新確認後に状態が変わりました。現在の状態を保持し、更新を延期します。'));
        else{this.applying=false;this.applied?.();location.reload();}
      }else this.refresh().catch(error=>this.fail(error));
    });
    window.addEventListener('online',()=>this.prepare().catch(error=>this.fail(error)));
  }
  fail(error) {this.state.error=error.message;this.state.checking=false;this.changed();}
  request(worker,version=this.version,type='STATUS') {
    return new Promise((resolve,reject)=>{
      if(!worker){reject(new Error('オフラインの準備はまだ完了していません。'));return;}
      const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(new Error('準備の確認に応答がありません。通信を確認して再試行してください。'));},5000);
      channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};
      try{worker.postMessage({type,version},[channel.port2]);}catch(error){clearTimeout(timer);channel.port1.close();channel.port2.close();reject(error);}
    });
  }
  watch(worker) {
    if(!worker)return;
    this.watched??=new WeakSet();if(this.watched.has(worker))return;this.watched.add(worker);
    const changed=()=>{
      if(worker.state==='redundant')this.fail(new Error('新しい資材の準備に失敗しました。現在の資材と保存データは保持しています。'));
      else if(['installed','activated'].includes(worker.state))this.refresh().catch(error=>this.fail(error));
      if(['redundant','activated'].includes(worker.state))worker.removeEventListener('statechange',changed);
    };
    worker.addEventListener('statechange',changed);
  }
  async prepare() {
    if(!this.enabled){this.state.error='開発用の画面です。オフライン確認には配信資材を使ってください。';this.changed();return;}
    if(!('serviceWorker' in navigator)||!window.isSecureContext){this.fail(new Error('この環境ではオフライン準備ができません。対応ブラウザでHTTPSの公開URLを開いてください。'));return;}
    this.state.checking=true;this.state.error=null;this.changed();
    try {
      const scope=new URL('./',document.baseURI);
      if(!this.registration){
        const existing=await navigator.serviceWorker.getRegistration(scope.href);
        this.registration=existing?.scope===scope.href?existing:await navigator.serviceWorker.register(new URL('./sw.js',document.baseURI),{scope:scope.pathname,updateViaCache:'none'});
      }
      if(!this.watching){this.registration.addEventListener('updatefound',()=>this.watch(this.registration.installing));this.watching=true;}
      this.watch(this.registration.installing);
      await this.refresh();
      if(navigator.onLine&&!this.registration.installing)await this.registration.update();
      if(navigator.onLine&&this.registration.active)await this.request(this.registration.active,null,'PREPARE_ASSETS');
      await this.refresh();
    }catch(error){this.fail(error);await this.refresh().catch(()=>{});}
  }
  async refresh() {
    if(!this.registration)return;
    const worker=this.registration.active??this.registration.waiting;
    if(!worker){this.state.checking=Boolean(this.registration.installing);this.changed();return;}
    const status=await this.request(worker);
    this.state.ready=status.ready===true;
    const waiting=this.registration.waiting;
    const next=waiting?await this.request(waiting,null):null;
    this.state.update=Boolean(next?.ready)||(status.currentVersion!==this.version&&status.currentReady);
    this.state.checking=Boolean(this.registration.installing);
    this.changed();
  }
  async apply(allowed=()=>true) {
    if(!this.state.update)throw new Error('適用できる更新版はまだ準備されていません。');
    const worker=this.registration.waiting??this.registration.active,status=await this.request(worker,null);
    if(!status.ready)throw new Error('更新版の資材が不足しています。通信ありで準備し直してください。');
    if(!allowed())throw new Error('更新確認後に状態が変わりました。現在の状態を保持し、更新を延期します。');
    if(worker===this.registration.active){location.reload();return;}
    this.applying=true;
    this.allowed=allowed;
    let timer;
    try{
      await new Promise((resolve,reject)=>{
        this.applied=resolve;
        this.rejectApply=reject;
        timer=setTimeout(()=>reject(new Error('更新の適用が完了しませんでした。現在の状態を保持して、再試行できます。')),10000);
        this.request(worker,null,'APPLY_UPDATE').then(result=>{if(!result.applied)reject(new Error('更新版の資材が不足しています。現在の状態を保持して、更新を延期します。'));},reject);
      });
    }catch(error){this.applying=false;throw error;}
    finally{clearTimeout(timer);this.applied=null;this.rejectApply=null;this.allowed=null;}
  }
}
