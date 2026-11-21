// A screen wake lock only inhibits automatic sleep while music is playing.
// It is optional, and a denied or late request must never interrupt playback.
export class KeepAwake {
 constructor(provider=globalThis.navigator?.wakeLock){this.provider=provider;this.active=false;this.lock=null;this.pending=false;this.epoch=0;this.error=null;}
 async start(){
  this.active=true;if(!this.provider||this.lock||this.pending)return;
  const ticket=++this.epoch;this.pending=true;this.error=null;
  try{
   const lock=await this.provider.request('screen');
   if(ticket!==this.epoch||!this.active){await lock.release();return;}
   this.lock=lock;lock.addEventListener('release',()=>{if(this.lock===lock)this.lock=null;},{once:true});
  }catch(error){if(ticket===this.epoch)this.error=error.name;}
  finally{if(ticket===this.epoch)this.pending=false;}
 }
 stop(){this.active=false;this.epoch++;this.pending=false;const lock=this.lock;this.lock=null;if(lock)void lock.release().catch(()=>{});}
 inspect(){return {supported:!!this.provider,active:this.active,held:!!this.lock,pending:this.pending,error:this.error};}
}
