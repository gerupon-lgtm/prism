import { Session } from '../app/session.js';
import { LocalRecords } from '../core/storage.js';
import { TimeScale } from '../core/time.js';
import { displayScore,perfectScore,compareScores } from '../core/evaluation.js';
import { matchesChallengeScore } from '../core/challenge-identity.js';
import { challenges } from '../content/challenges.js';
import { samples } from '../content/samples.js';
import { Board } from './board.js';
import { Chime } from './audio.js';
import { Offline } from './offline.js';
import { updateSafety } from '../app/update-safety.js';
import { LoadMeter } from './load-meter.js';
import { OrientationLayout } from './orientation.js';
import { EndWait, END_WAIT_MS, CLEAR_END_WAIT_MS } from './end-wait.js';
import { partName,objectName } from './labels.js';
import { PerfectCelebration } from './celebration.js';
import { OutcomeSound } from './outcome-sound.js';

const $ = id => document.getElementById(id);
function setText(id,value){const node=$(id);if(node.textContent!==value)node.textContent=value;}
function element(tag,text='',attributes={}) {
  const item=document.createElement(tag);item.textContent=text;
  for(const [name,value] of Object.entries(attributes))item.setAttribute(name,value);
  return item;
}
function button(text,action,attributes={}) {
  const item=element('button',text,{type:'button',title:text,'aria-label':text,...attributes});item.addEventListener('click',()=>attempt(action));return item;
}
const load=new LoadMeter();
const endWait=new EndWait();
const LAUNCH_DELAY_MS=250;
const storage={getItem:key=>load.measure('records',()=>window.localStorage.getItem(key)),setItem:(key,value)=>load.measure('records',()=>window.localStorage.setItem(key,value))};
const session=new Session(new LocalRecords(storage)),chime=new Chime();
const dialog=$('dialog'),body=$('dialog-body'),actions=$('dialog-actions');
const wireDelete=$('wire-delete-toast');
let pendingWireDelete=null,deleteNeedsPress=false;
let settingsTapGuard=null;
// A second tap at the same board position must not activate the new dialog behind it.
for(const type of ['pointerdown','click'])dialog.addEventListener(type,event=>{
  if(settingsTapGuard&&performance.now()<settingsTapGuard.until&&Math.hypot(event.clientX-settingsTapGuard.x,event.clientY-settingsTapGuard.y)<24){event.preventDefault();event.stopImmediatePropagation();}
},true);
let message='',recordCapacity=1,recordResize=false,clockAnchor=null,dialogPage=null,dialogLayout=null,updating=false,clearedConnections=null,startPrelude=null;
const dismissedClears=new WeakSet();
let clearToastRun=null,clearToastCircuit=null;
const dismissedFailures=new WeakSet();
let failureToastRun=null,failureToastCircuit=null;
const board=new Board($('board'),session,render,settings,notify,()=>chime.wire(),showWireDelete);
const celebration=new PerfectCelebration(board.fireworksLayer,()=>board.element.viewBox.baseVal);
const outcomeSound=new OutcomeSound(chime);
const orientation=new OrientationLayout($('app'));
const offline=new Offline(()=>{updateNotice();if(dialog.open&&$('dialog-title').textContent==='オフラインと更新')offlineStatus();});
let soundUnlock=null,automaticSoundFailed=false;
// Create/resume audio inside an actual user action. A pending resume must never
// overwrite an explicit mute, and opening a page alone must not start audio.
document.addEventListener('click',event=>{
  if(!event.isTrusted||event.target.closest('#sound')||chime.muted||automaticSoundFailed||chime.context?.state==='running')return;
  soundUnlock??=chime.unlock().catch(error=>{automaticSoundFailed=true;failure(error);}).finally(()=>{soundUnlock=null;});
},true);

function updateNotice(){
  $('update-notice').hidden=!offline.state.update;
  const control=$('title-update');control.hidden=false;control.disabled=offline.state.checking||updating;
  control.textContent=offline.state.checking?'確認中':offline.state.update?'更新':$('title-screen').classList.contains('title-compact')?'確認':'更新確認';
  control.setAttribute('aria-label',offline.state.checking?'更新を確認中':offline.state.update?'更新':'更新を確認');
  control.setAttribute('aria-busy',String(offline.state.checking));
}

document.addEventListener('click',event=>{
  const target=event.target.closest('button');if(!target||target.disabled)return;
  target.classList.remove('button-response');void target.offsetWidth;target.classList.add('button-response');
  if(target.id!=='sound')chime.tap();
});
document.addEventListener('animationend',event=>{if(event.animationName==='button-response')event.target.classList.remove('button-response');});

function notify(text) { message=text;if(!$('title-screen').hidden)$('title-error').textContent=text;render(false); }
function attempt(action) {
  try {const pending=action();if(pending?.catch)pending.catch(failure);}
  catch(error){failure(error);}
}
function failure(error) {
  if(dialog.open)$('dialog-error').textContent=error.message;
  else notify(error.message);
}
function open(title) {
  board.cancelAll();cancelWireDelete();
  celebration.cancel();cancelStart();
  session.pause('dialog');chime.stop();clockAnchor=null;
  $('dialog-title').textContent=title;dialog.classList.remove('menu-dialog','settings-dialog','time-dialog');body.replaceChildren();body.className='';actions.replaceChildren();$('dialog-error').textContent='';$('dialog-info').hidden=true;dialogPage=null;dialogLayout=null;
  document.body.classList.remove('input-focus');
  if(!dialog.open)dialog.showModal();render(false);
}
function close() { if(updating)return;dialog.close();document.body.classList.remove('input-focus');dialogPage=null;render(); }
dialog.addEventListener('close',()=>{if(dialog.open)return;document.body.classList.remove('input-focus');dialogPage=null;render(false);});
dialog.addEventListener('cancel',event=>{if(updating){event.preventDefault();return;}document.body.classList.remove('input-focus');});
document.addEventListener('focusin',event=>{if(event.target.matches('input[type=text],input:not([type])'))event.target.select();});
// Safari can collapse focus-time selection during the pointer's default click.
// Reapply it only for a newly focused field; later clicks can position the caret.
let selectAfterClick=null;
document.addEventListener('pointerdown',event=>{const field=event.target.closest('input[type=text],input:not([type])');selectAfterClick=field&&document.activeElement!==field?field:null;},true);
document.addEventListener('click',event=>{
  const field=selectAfterClick;selectAfterClick=null;
  if(field===event.target)requestAnimationFrame(()=>{if(document.activeElement===field)field.select();});
});

function challengeGoal(challenge){
  const bell=id=>partName(challenge.nodes.find(point=>point.id===id),challenge.nodes);
  if(challenge.type==='delivery-all')return `${challenge.goals.map(bell).join('・')}すべてに届ける`;
  if(challenge.type==='interval')return `鐘を${challenge.interval}秒間隔で${challenge.count}回鳴らす`;
  return ({time:`${bell(challenge.goal)}へより早く届ける`,'time-hops':`${bell(challenge.goal)}へ早く・少ない道で届ける`,'edge-fault':`どの道が1本止まっても${bell(challenge.goal)}へ`,'prism-fault':`どのプリズムが1つ止まっても${bell(challenge.goal)}へ`}[challenge.type]);
}
function render(redraw=true,{records=true}={}) {
  const readableFont=parseFloat(getComputedStyle(document.documentElement).fontSize),textEnlarged=readableFont>=20,compact=innerHeight<=300||(innerHeight<=360&&textEnlarged);
  document.documentElement.style.setProperty('--layout-font',`${readableFont}px`);
  document.documentElement.style.setProperty('--layout-footer-font',getComputedStyle(document.querySelector('footer')).fontSize);
  $('app').classList.toggle('text-enlarged',textEnlarged);
  $('app').classList.toggle('compact',compact);
  const narrowControls=textEnlarged||compact||Math.abs(orientation.rotation)===90;
  setText('add-prism',narrowControls?'◇＋':'＋プリズム');setText('add-goal',narrowControls?'鐘＋':'＋鐘');
  const canRestore=clearedConnections?.cleared===session.circuit;
  setText('clear-wires',canRestore?'戻す':textEnlarged?'消去':'クリア');$('clear-wires').setAttribute('aria-label',canRestore?'クリアした配線を戻す':'配線をすべてクリア');
  $('clear-wires').disabled=Boolean(startPrelude)||!session.editable||(!canRestore&&!session.circuit.edges.length);
  $('magnifier-toggle').setAttribute('aria-pressed',String(board.magnifier.enabled));
  setText('magnifier-toggle',textEnlarged?'補助':board.magnifier.enabled?'補助ON':'補助OFF');
  const allTimes=session.view.showAllTimes!==false;
  $('candidate-times').hidden=session.mode!=='challenge';$('candidate-times').setAttribute('aria-pressed',String(allTimes));
  setText('candidate-times',textEnlarged?(allTimes?'全秒':'候補'):(allTimes?'秒数 全体':'秒数 候補'));
  $('candidate-times').title=allTimes?'進める候補の秒数だけに絞る':'全候補の秒数を表示する';
  $('records-panel').hidden=!session.view.recordsOpen;
  if(!session.view.recordsOpen)document.body.classList.remove('records-fullscreen');
  setText('title',session.mode==='challenge'?`${session.challenge.id} ${session.challenge.name}`:session.name||'自由');
  $('app').dataset.problemId=session.challenge?.draw?.id??'';
  const goal=session.mode==='challenge'?challengeGoal(session.challenge):'';
  setText('condition',session.mode==='challenge'?`${Number(session.challenge.id.slice(1))<=6?'お試し':'実践'}${session.challenge.draw?'・出題'+session.challenge.draw.number:''}・${session.challenge.stage}`:`${session.circuit.mode==='spread'?'分かれて広がる':'最速経路'}・${session.circuit.nodes.length}点 ${session.circuit.edges.length}本${session.dirty?'・未保存':''}`);
  $('challenge-info').hidden=session.mode!=='challenge'||Boolean(session.guide&&textEnlarged&&innerHeight<=600);
  setText('challenge-goal',textEnlarged&&Math.abs(orientation.rotation)===90?'課題':goal?.replace(/^祭壇/,'')??'');
  $('challenge-info').setAttribute('aria-label',`${goal}。課題と配線を全文で読む`);
  if(session.mode==='challenge'){
    const used=session.circuit.edges.length,limit=session.challenge.limit;
    const shortCounters=textEnlarged&&Math.abs(orientation.rotation)===90;
    const counter=(label,value)=>{const part=element('span');part.append(document.createTextNode(label),element('b',String(value),{class:'wire-count'}),document.createTextNode(shortCounters?'':'本'));return part;};
    $('wire-budget').style.setProperty('--wire-digits',Math.max(1,String(limit).length));
    const budgetKey=JSON.stringify([shortCounters,textEnlarged,limit,used]);
    if($('wire-budget').dataset.layout!==budgetKey){
      $('wire-budget').replaceChildren(counter(`${textEnlarged?'':'配線 '}上限`,limit),counter('使用',used),counter('残り',limit-used));
      $('wire-budget').dataset.layout=budgetKey;
    }
    $('wire-budget').setAttribute('aria-label',`配線：上限${limit}本、使用${used}本、残り${limit-used}本`);
    if(compact)setText('title',`課題${session.challenge.id.slice(1)}`);
    else if(shortCounters)setText('title',`課題${session.challenge.id.slice(1)}`);
  }
  $('add-controls').hidden=session.mode!=='free'||!session.editable||Boolean(session.guide);
  for(const kind of ['prism','goal'])$('add-'+kind).setAttribute('aria-pressed',String(board.addKind===kind));
  const run=session.run;
  const startBlockedReason=session.editable?session.startBlockedReason:'';
  $('stage').inert=Boolean(startPrelude);$('stage').classList.toggle('launching',Boolean(startPrelude));
  setText('play',startPrelude?'準備中':session.editable?'鐘を鳴らす':run.exhausted?'終了':run.status==='running'?'一時停止':'再開');
  $('play').disabled=session.editable?Boolean(startBlockedReason):run.exhausted;
  $('play').title=startBlockedReason||(!session.editable&&run?.exhausted?'動作は終了しています。停止で編集へ戻れます。':'');
  $('stop').disabled=session.editable&&!startPrelude;$('next').disabled=Boolean(startPrelude)||!run||run.status!=='paused'||run.exhausted;
  $('play').dataset.state=startPrelude?'preparing':run?.status??'ready';$('play').setAttribute('aria-pressed',String(run?.status==='running'));
  setText('next',narrowControls?'次へ':'次の動き');
  $('records').setAttribute('aria-pressed',String(session.view.recordsOpen));
  setText('sound-label',chime.muted?'音なし':'音あり');$('sound').setAttribute('aria-pressed',String(!chime.muted));$('sound').setAttribute('aria-label',chime.muted?'音なし':'音あり');
  const execution=run?(run.status==='stopped'?'編集可能':run.exhausted?'動作終了':run.status==='running'?'実行中':'一時停止'):'';
  let text=run?`${execution}｜${run.format()}秒・${run.activeCount}光線`:'';
  if(session.result){
    const stateText={pending:'判定待ち',achieved:'達成',failed:'未達成',stopped:'中断',finished:'到着・動作終了',running:'実行中'}[session.result.state];
    text=`${stateText}${session.result.score?' '+displayScore(session.result.score)+'点':''}・${text}`;
    if(session.result.reason&&session.result.state!=='failed')text+='　'+playerReason();
    if(session.result.goals)text+=`　鐘 ${session.result.goals.filter(goal=>goal.first!==null).length}/${session.result.goals.length}${session.result.state==='achieved'?'・全到達 '+session.result.evaluatedTime+'秒':''}`;
  }
  if(run?.pauseReason==='load')text+='　負荷のため一時停止。状態を保持しています。';
  if(session.pendingScores.size)text+=`　成績${session.pendingScores.size}件未保存`;
  $('retry-result').hidden=session.pendingScores.size===0;
  setText('result',[text,message||startBlockedReason].filter(Boolean).join('　'));$('result').classList.toggle('error',Boolean(message));
  const selectedWire=session.circuit.edges.some(edge=>edge.id===session.selection),selectedCandidate=!selectedWire&&session.challenge?.candidates.some(edge=>edge.id===session.selection);
  setText('hint',board.addKind?'追加する位置をタップ':session.selection?`${objectName(session.selection,session.circuit,session.challenge?.candidates)}：${selectedWire?'タップで設定・長押しで削除':selectedCandidate?'未結線の候補':'ダブルタップで設定'}`:'起点から候補をなぞって結線');
  $('guide-bar').hidden=!session.guide;
  if(session.guide){
    const guide=session.guide,steps=guide.mode==='challenge'?['星から候補へドラッグしてつなぎます。','鐘までつないで「鐘を鳴らす」を押します。','鐘への到着と点数を見て、上の「記録」を開きます。']:['「鐘を鳴らす」で2.5秒後に鐘が鳴る様子を見ます。','停止してプリズムAをダブルタップ。処理時間を1.5秒へ。','もう一度「鐘を鳴らす」を押して、プリズムB経由で3秒後に鐘が鳴る様子を見ます。'];
    setText('guide-text',`${guide.step+1}/3 ${steps[guide.step]}`);$('guide-finish').hidden=!guide.readyToFinish;
    if(compact)setText('hint',`案内 ${$('guide-text').textContent}`);
  }
  if(redraw)board.render();else board.particles();
  if(records&&!$('records-panel').hidden)load.measure('records',renderRecords);
  renderClearToast();
  renderFailureToast();
  outcomeSound.update(run,session.result,Boolean(session.clearChoices||failureOutcome())&&!startPrelude&&!dialog.open&&$('title-screen').hidden&&!session.view.recordsOpen&&!updating&&!endWait.interrupted.has(run));
}

function playerReason(){return (session.result?.reason??'').replaceAll('ゴール','鐘').replaceAll('祭壇','鐘');}
function failureArrivalData(){
  const run=session.run,challenge=session.runContext.challenge,nodes=run.circuit.raw.nodes;
  const goals=challenge.type==='delivery-all'?challenge.goals:[challenge.goal];
  const rows=goals.flatMap(goal=>{
    const arrivals=run.arrivals(goal),required=challenge.type==='interval'?challenge.count:1;
    return Array.from({length:Math.max(required,arrivals.length)},(_,index)=>{
      const arrival=arrivals[index],previous=arrivals[index-1];
      const label=`${goals.length>1?partName(nodes.find(node=>node.id===goal),nodes)+' ':''}${index+1}回目`;
      const time=arrival?`${arrival.time}秒`:'到達なし';
      const gap=arrival&&previous?`前回から${run.circuit.time.format(run.circuit.time.ticks(arrival.time)-run.circuit.time.ticks(previous.time))}秒`:'';
      return {label,time,gap};
    });
  });
  return {condition:`条件：${challengeGoal(challenge)}`,rows};
}
function failureResultText(){
  const {condition,rows}=failureArrivalData();
  return [playerReason(),condition,'鐘が鳴った時刻（開始から）',...rows.map(row=>`${row.label}：${row.time}${row.gap?`（${row.gap}）`:''}`)].join('\n');
}
function failureOutcome(){
  const run=session.run;
  return Boolean(run&&session.mode==='challenge'&&!session.guide&&!session.runContext?.guide&&session.result?.challenge===session.challenge.id&&session.result.state==='failed'&&(run.exhausted||run.status==='stopped'));
}
function renderFailureToast(){
  const toast=$('failure-toast'),run=session.run;
  if(run&&failureToastRun===run&&failureToastCircuit!==session.circuit)dismissedFailures.add(run);
  toast.hidden=!failureOutcome()||dismissedFailures.has(run)||Boolean(startPrelude)||dialog.open||!$('title-screen').hidden||session.view.recordsOpen||updating||['load','error'].includes(run?.pauseReason);
  if(toast.hidden)return;
  if(failureToastRun!==run){failureToastRun=run;failureToastCircuit=session.circuit;}
  const reason=playerReason();if($('failure-reason').textContent!==reason)$('failure-reason').textContent=reason;
  const timing=$('failure-timing'),data=failureArrivalData(),key=JSON.stringify(data);
  if(timing.dataset.result!==key){
    $('failure-condition').textContent=data.condition;
    $('failure-arrivals').replaceChildren(...data.rows.map(row=>{
      const item=element('li');item.append(element('span',row.label+'：'),element('b',row.time));
      if(row.gap)item.append(element('small',row.gap));return item;
    }));timing.dataset.result=key;
  }
  const boardBox=$('board').getBoundingClientRect(),resultBox=$('result-line').getBoundingClientRect();
  const controls=[...document.querySelectorAll('#stage-controls button')].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect());
  const goals=[...$('board').querySelectorAll('.goal .node-symbol')].map(e=>{const r=e.getBoundingClientRect();return {left:r.left-44,right:r.right+44,top:r.top-44,bottom:r.bottom+44};});
  for(const mark of $('board').querySelectorAll('.bell-constellation')){const r=mark.getBoundingClientRect();goals.push({left:r.left-6,right:r.right+6,top:r.top-6,bottom:r.bottom+6});}
  const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
  // Full reason in ordinary viewports. Compact notices expose a complete,
  // paginated explanation rather than squeezing or ellipsizing the reason.
  for(const {area,compact,slim=false} of [{area:boardBox,compact:false},{area:boardBox,compact:true},{area:resultBox,compact:true,slim:true}]){
    const maximum=Math.min(420,innerWidth-16,area.width-8);
    for(const width of slim?[maximum,Math.min(160,maximum)]:[maximum]){
      if(width<40)continue;
      toast.style.width=`${width}px`;toast.classList.toggle('compact-notice',compact);toast.classList.toggle('narrow-notice',width<(slim?140:220));toast.classList.toggle('slim-notice',slim);
      $('failure-title').textContent=compact?'未達成':'課題未達成';$('failure-reason').hidden=compact;$('failure-timing').hidden=compact;$('failure-edit').hidden=compact;
      $('failure-details').textContent=slim||width<150?'結果':'結果を見る';
      if(toast.scrollHeight>toast.clientHeight+1)continue;
      const height=toast.getBoundingClientRect().height,pad=4;
      const xs=[area.left+(area.width-width)/2,area.left+pad,area.right-width-pad];
      const controlTop=Math.min(area.bottom-pad,...controls.filter(r=>r.top>area.top+area.height/2).map(r=>r.top-6));
      const ys=[controlTop-height,area.top+pad,area.top+(area.height-height)/2,area.bottom-height-pad];
      for(const top of ys)for(const left of xs){
        const place={left,top,right:left+width,bottom:top+height};
        if(left<area.left||top<area.top||place.right>area.right||place.bottom>area.bottom||left<0||top<0||place.right>innerWidth||place.bottom>innerHeight)continue;
        if([...goals,...controls].some(r=>overlap(place,r)>0))continue;
        // Clamp stale positions during rotation too, before the next resize
        // callback can choose a new placement. Measurement must not zoom the page.
        toast.style.left=`clamp(8px,${left}px,calc(100vw - ${width}px - 8px))`;
        toast.style.top=`clamp(8px,${top}px,calc(100dvh - ${height}px - 8px))`;return;
      }
    }
  }
  // At an extreme viewport/font combination there may be no overlay space.
  // The status button still opens the same complete reason without moving UI.
  toast.hidden=true;
}
function dismissFailure(){if(session.run)dismissedFailures.add(session.run);render(false);}
function reviewFailure(){if(!failureOutcome())return;dismissFailure();stopRun();}
function failureDetails(title='未達成の結果',text=failureResultText()){outcomeDetails(title,text);}
function outcomeDetails(title,text){
  open(title);
  // Keep each short page row free of embedded newlines. Even a two-line
  // fragment can cover the pager in a short window with enlarged text.
  const parts=String(text).split('\n').flatMap(line=>{
    const chars=Array.from(line);return Array.from({length:Math.ceil(chars.length/12)},(_,index)=>chars.slice(index*12,index*12+12).join(''));
  });
  listPage(parts,part=>element('p',part,{class:'detail-value'}));actions.append(button('戻る',close));
}

function clearTimeLabel(){
  const type=session.runContext?.challenge?.type;
  return type==='interval'?'初回到達':type==='delivery-all'?'全てに到達':'到達時間';
}
function renderClearToast() {
  const toast=$('clear-toast'),choices=session.clearChoices,run=session.run;
  if(run&&clearToastRun===run&&clearToastCircuit!==session.circuit)dismissedClears.add(run);
  toast.hidden=!choices||dismissedClears.has(run)||dialog.open||!$('title-screen').hidden||session.view.recordsOpen||updating||['load','error'].includes(run?.pauseReason);
  celebration.update(run,session.result,!toast.hidden&&!endWait.interrupted.has(run));
  if(toast.hidden)return;
  if(clearToastRun!==run){clearToastRun=run;clearToastCircuit=session.circuit;}
  const perfect=perfectScore(session.result.score),time=session.result.evaluatedTime,score=displayScore(session.result.score);
  $('clear-next').textContent=choices.nextChallengeId?'次へ':'課題一覧へ';
  $('clear-time-label').textContent=clearTimeLabel();$('clear-time').textContent=time+'秒';$('clear-score').textContent=score+'点';
  $('clear-time').setAttribute('aria-label',`${clearTimeLabel()} ${time}秒`);$('clear-score').setAttribute('aria-label',`スコア ${score}点`);
  toast.classList.toggle('perfect-clear',perfect);
  const boardBox=$('board').getBoundingClientRect(),resultBox=$('result-line').getBoundingClientRect();
  const controls=[...document.querySelectorAll('#stage-controls button')].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect());
  const goals=[...$('board').querySelectorAll('.goal .node-symbol')].map(e=>{const r=e.getBoundingClientRect();return {left:Math.max(boardBox.left,r.left-54),right:Math.min(boardBox.right,r.right+54),top:Math.max(boardBox.top,r.top-90),bottom:Math.min(boardBox.bottom,r.bottom+54)};});
  for(const motif of $('board').querySelectorAll('.bell-constellation')){const r=motif.getBoundingClientRect();goals.push({left:r.left-6,right:r.right+6,top:r.top-6,bottom:r.bottom+6});}
  const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
  for(const {area,compact,slim=false} of [{area:boardBox,compact:false},{area:boardBox,compact:true},{area:resultBox,compact:true,slim:true}]){
    const maximum=Math.min(420,innerWidth-16,area.width-8);
    for(const width of slim?[maximum,Math.min(180,maximum)]:[maximum]){
      if(width<40)continue;
      toast.style.width=`${width}px`;toast.classList.toggle('compact-clear',compact);toast.classList.toggle('narrow',width<240);toast.classList.toggle('slim',slim);toast.classList.toggle('docked',slim);
      toast.querySelector('.clear-heading strong').textContent=slim?'達成':perfect?'100点クリア！':'課題クリア！';
      toast.querySelector('.clear-actions').hidden=slim;$('clear-details').hidden=!slim;$('clear-details').textContent=slim?'結果':'結果を見る';
      $('clear-score').textContent=(slim?score.replace(/\.00$/,''):score)+'点';
      if(toast.scrollHeight>toast.clientHeight+1)continue;
      const height=toast.getBoundingClientRect().height,pad=4;
      const xs=[area.left+(area.width-width)/2,area.left+pad,area.right-width-pad];
      const controlTop=Math.min(area.bottom-pad,...controls.filter(r=>r.top>area.top+area.height/2).map(r=>r.top-6));
      const ys=[controlTop-height,area.top+pad,area.top+(area.height-height)/2,area.bottom-height-pad];
      for(const top of ys)for(const left of xs){
        const place={left,top,right:left+width,bottom:top+height};
        if(left<area.left||top<area.top||place.right>area.right||place.bottom>area.bottom||left<0||top<0||place.right>innerWidth||place.bottom>innerHeight)continue;
        if([...goals,...controls].some(r=>overlap(place,r)>0))continue;
        toast.style.left=`clamp(8px,${left}px,calc(100vw - ${width}px - 8px))`;
        toast.style.top=`clamp(8px,${top}px,calc(100dvh - ${height}px - 8px))`;return;
      }
    }
  }
  toast.hidden=true;
}
function clearDetails(){
  if(!session.clearChoices)return;
  outcomeDetails('クリアの結果',`${clearTimeLabel()}：${session.result.evaluatedTime}秒\nスコア：${displayScore(session.result.score)}点`);
  actions.replaceChildren(button('もう一度',()=>{close();clearAction();}),button(session.clearChoices.nextChallengeId?'次の課題へ':'課題一覧へ',()=>{close();clearAction(true);}));
}

function dismissClear(){if(session.run)dismissedClears.add(session.run);render(false);}
function clearAction(next=false){
  const choices=session.clearChoices;
  if(!choices||updating)return;
  if(session.run)dismissedClears.add(session.run);
  stopRun();
  if(next){if(choices.nextChallengeId)replace({challengeId:choices.nextChallengeId});else chooseMode();}
}

function listPage(items,makeRow,empty='まだありません。') {
  const container=element('div','',{class:'dialog-list'}),rows=element('div','',{class:'dialog-list'}),pager=element('nav','',{class:'pager'});
  let start=0,end=0;const history=[];
  const previous=button('前へ',()=>{start=history.pop()??0;draw();}),position=element('span'),next=button('次へ',()=>{history.push(start);start=end;draw();});
  pager.append(previous,position,next);container.append(rows,pager);body.append(container);
  function draw(){
    if(!dialog.open||dialogPage!==draw)return;
    start=Math.min(start,Math.max(0,items.length-1));rows.replaceChildren();end=start;
    if(!items.length)rows.append(element('p',empty));
    else while(end<items.length){
      const row=makeRow(items[end]);rows.append(row);
      if(end>start&&row.getBoundingClientRect().bottom>rows.getBoundingClientRect().bottom+.5){row.remove();break;}
      end++;
      if(row.getBoundingClientRect().bottom>rows.getBoundingClientRect().bottom+.5)break;
    }
    previous.disabled=start===0;next.disabled=end===items.length;position.textContent=items.length?`${start+1}–${end}/${items.length}`:'0/0';
  }
  dialogPage=draw;requestAnimationFrame(draw);
}
new ResizeObserver(()=>{if(dialog.open){dialogLayout?.();dialogPage?.();}}).observe(body);
function fitDialogForm(adapt=()=>{},notes=[...body.children].filter(node=>node.tagName==='P'),restored=()=>{}){
  const layout=()=>{
    if(!dialog.open||dialogLayout!==layout)return;
    body.classList.remove('condensed-form');notes.forEach(node=>node.hidden=false);$('dialog-info').hidden=true;adapt(false);
    if(body.scrollHeight>body.clientHeight+1){
      body.classList.add('condensed-form');notes.forEach(node=>node.hidden=true);$('dialog-info').hidden=!notes.length;adapt(true);
    }
  };
  dialogLayout=layout;
  $('dialog-info').onclick=()=>{
    const saved={title:$('dialog-title').textContent,nodes:[...body.childNodes],actions:[...actions.childNodes],error:$('dialog-error').textContent,page:dialogPage,layout:dialogLayout};
    fullText('説明',notes.map(node=>node.textContent).join('\n'),()=>{
      open(saved.title);body.append(...saved.nodes);actions.append(...saved.actions);$('dialog-error').textContent=saved.error;dialogPage=saved.page;dialogLayout=saved.layout;restored();requestAnimationFrame(()=>{dialogLayout?.();dialogPage?.();});
    });
  };
  requestAnimationFrame(dialogLayout);
}

function chooseMode(after=null) {
  if(session.guide){
    open('案内を閉じますか？');body.append(element('p','案内を閉じると、案内を開く前の配線と記録へ戻ってから課題を選べます。'));
    actions.append(button('案内を閉じて課題を選ぶ',()=>{board.cancelAll();chime.stop();session.endGuide('skipped');message='';render();chooseMode(after);}),button('案内を続ける',close));
    fitDialogForm();return;
  }
  if(!session.editable){
    open('停止して課題を選びますか？');body.append(element('p','課題を切り替える前に、現在の実行を停止します。配線と記録は停止後も確認できます。'));
    actions.append(button('停止して課題を選ぶ',()=>{stopRun();chooseMode(after);}),button('戻る',close));
    fitDialogForm();return;
  }
  if(after){after();return;}
  open('課題と自由');
  actions.append(button('自由へ',()=>replace({sampleId:'compare'})),button('閉じる',close));
  let scores=[];
  try{scores=session.records.scores();}catch(error){$('dialog-error').textContent=error.message;}
  listPage(challenges,challenge=>{
    const best=scores.filter(score=>matchesChallengeScore(score,challenge)).sort((a,b)=>compareScores(b.score,a.score))[0];
    const text=`${challenge.id} ${challenge.name}${Number(challenge.id.slice(1))>6?'［実践］':''}${best?'　'+displayScore(best.score)+'点':''}`;
    const row=button(text,()=>replace({challengeId:challenge.id}),{class:'challenge-row','data-challenge':challenge.id});row.replaceChildren();
    const name=element('span','',{class:'challenge-name'});name.append(element('span',challenge.id+' ',{class:'challenge-number'}),document.createTextNode(challenge.name));
    if(Number(challenge.id.slice(1))>6)name.append(element('small','実践',{class:'challenge-tier'}));
    const score=element('span','',{class:'challenge-score'});score.append(element('small',Number(challenge.id.slice(1))>6?'最高点（全出題）':'最高点'),element('strong',best?displayScore(best.score)+'点':'未達成'));
    row.append(name,score);return row;
  });
}
function replace(request) {
  session.requireEditable();session.replacement(request);
  if(session.mode==='free'&&session.dirty){
    open('現在の未保存回路');body.append(element('p','読み込み前に、現在の回路をどうしますか？'));
    actions.append(button('保存して入替',()=>saveForm(()=>finishReplacement(request,{choice:'discard'}))),button('保存せず入替',()=>finishReplacement(request,{choice:'discard'})),button('取消',close));
    fitDialogForm();
  }else finishReplacement(request);
}
function finishReplacement(request,options) {
  session.replace(request,options);close();maybeGuide();
  if(!$('title-screen').hidden)leaveTitle();
}
function maybeGuide() {
  // Guides are chosen explicitly from the title/menu, including first launch.
  render();
}
function showTitle() {
  interruptRun('title');board.cancelAll();
  if(dialog.open)close();$('title-screen').hidden=false;$('app').inert=true;$('title-error').textContent='';$('clear-toast').hidden=true;$('failure-toast').hidden=true;
  $('title-resume').focus();
}
function leaveTitle() { $('title-screen').hidden=true;$('app').inert=false;render(); }
function layoutTitle(width,height) {
  const compact=height<360||parseFloat(getComputedStyle(document.documentElement).fontSize)>=20;
  $('title-screen').classList.toggle('title-compact',compact);
  for(const [id,full,short] of [['title-start','連続プレイ','開始'],['title-challenges','選択プレイ','選択'],['title-free','自由作成','自由'],['title-tutorial','チュートリアル','案内'],['title-parts','パーツの説明','部品'],['title-about','遊び方と概要','概要'],['title-resume','プレイ画面へ','続き']]){
    $(id).textContent=compact?short:full;$(id).setAttribute('aria-label',full);
  }
  updateNotice();
}
function tutorial() {leaveTitle();if(!session.guide)session.beginGuide();message='';render();}
function partsExplanation() {
  open('パーツの説明');
  listPage([
    ['source','星の光','光の出発点。ここから鐘へ道をつなぎます。'],
    ['prism','プリズム','光の中継点。道の時間に加え、ここでの処理時間もかかります。'],
    ['goal','祭壇の鐘','光の到着先。光が届くと鐘が鳴り、星の光が浮かびます。'],
  ],([asset,name,text])=>{const compact=body.clientHeight<180,item=button('',()=>fullText(name,text,partsExplanation)),copy=element('div');item.className=`part-description${compact?' compact':''}`;item.setAttribute('aria-label',`${name}の説明`);copy.append(element('strong',name));if(!compact)copy.append(element('p',text));item.append(element('img','',{src:new URL(`../../public/graphics/${asset}.png`,import.meta.url).href,alt:''}),copy);return item;});
  actions.append(button('閉じる',close));
}
function aboutGame() {
  open('遊び方と概要');
  body.append(element('p','星の光をプリズムから鐘へ導くゲームです。お試し6問と実践6問で、候補の道をつないで「鐘を鳴らす」を押し、到着時間や記録を比べてつなぎ直します。'),element('p','道の秒数・プリズムの処理・合流先の待ち時間を考えます。実践では途中で分岐し、複数の鐘への到達や指定間隔を満たします。複数の鐘の点数は最後の鐘への到達時間で比べます。自由では自分の回路を作れます。'),element('p','1本指で点から候補へドラッグすると連続して結線できます。スマホの表示移動は2本指、拡大縮小は2本指の開閉または＋−。点はダブルタップ、結線済みの道はタップで設定を開きます。結線済みの道を長押しすると、赤い線を確認して1本だけ削除できます。「プレイ画面へ」は現在の配線・記録を残して画面へ戻る入口です。'));
  actions.append(button('閉じる',close));fitDialogForm();
}
function menu() {
  open('メニュー');
  const items=[
    ['タイトルへ',showTitle],
    ['課題と自由',chooseMode],
    ['操作の案内',()=>{close();session.beginGuide();message='';render();}],
    ['点と道の一覧',objects],
    ['保存回路',slots],
    ['実行結果を書き出す',()=>download('prism-notes-result.json',session.exportResult())],
    ['成績未保存を再試行',pendingScores],
    ['オフラインと更新',offlineDialog],
  ];
  if(session.mode==='free')items.splice(2,0,['回路を保存',()=>saveForm()],['回路ファイルを書き出す',()=>download('prism-notes-circuit.json',session.exportCircuit())],['回路ファイルを読む',()=>{session.requireEditable();$('import').click();}],...samples.map(sample=>[sample.name,()=>replace({sampleId:sample.id})]));
  if(!session.editable)items.unshift(['停止して編集へ',()=>{session.stop();chime.stop();message='';close();}]);
  const short=['遊ぶ','案内','一覧','回路','結果','成績','更新'];
  const aliases=new Map(['課題と自由','操作の案内','点と道の一覧','保存回路','実行結果を書き出す','成績未保存を再試行','オフラインと更新'].map((name,index)=>[name,short[index]]));
  [['タイトルへ','表紙'],['回路を保存','保存'],['回路ファイルを書き出す','出力'],['回路ファイルを読む','読込'],['停止して編集へ','停止'],...samples.map((sample,index)=>[sample.name,index?'循環':'比較'])].forEach(([name,label])=>aliases.set(name,label));
  dialog.classList.add('menu-dialog');body.className='menu-grid';
  const entries=items.map(([name,action])=>button(name,action));body.append(...entries);actions.append(button('閉じる',close));
  const layout=()=>{
    if(!dialog.open||dialogLayout!==layout)return;
    // Grid rows can shrink before this callback. Measure the content as well
    // so an extra item adds a column instead of clipping every row's text.
    const height=Math.max(...entries.map(entry=>{const rect=entry.getBoundingClientRect();return Math.max(rect.height,entry.scrollHeight+rect.height-entry.clientHeight);}));
    const rows=Math.max(1,Math.floor((body.clientHeight+6)/(height+5))),columns=Math.max(2,Math.ceil(entries.length/rows));
    body.style.setProperty('--menu-columns',columns);
    body.classList.toggle('tight-menu',columns>=6);
    entries.forEach((entry,index)=>{entry.textContent=items[index][0];});
    entries.forEach((entry,index)=>{if(entry.scrollWidth>entry.clientWidth+1)entry.textContent=aliases.get(items[index][0])??items[index][0];});
  };
  dialogLayout=layout;requestAnimationFrame(layout);
}
function download(name,data) {
  const url=load.measure('records',()=>URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})));
  const link=element('a','',{href:url,download:name});document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('import').addEventListener('change',()=>attempt(async()=>{
  const file=$('import').files[0];$('import').value='';if(!file)return;
  const fileText=await file.text();replace({fileText});
}));

function saveForm(after=close,draftName=null) {
  session.requireFree();session.requireEditable();open('回路を保存');
  const input=element('input','',{type:'text',value:draftName??(session.name||`自由 ${new Date().toLocaleDateString('ja-JP')}`),'aria-label':'回路名'});
  body.append(element('label','回路名'),input,element('p','保存されるのは配置と設定です。実行途中や記録は含みません。'));
  const save=()=>{
    const slots=session.records.slots();
    if(slots.length<10){session.saveCircuit(input.value);after();}
    else{const name=input.value;open('置換する回路を選ぶ');body.append(element('p',`10枠が満杯です。置換する保存先を選んでください。\n保存する名前：${name}`));
      listPage(slots,slot=>button(slot.name||'名前なし',()=>{
        confirmAction(`「${slot.name||'名前なし'}」を置換`,()=>{session.saveCircuit(name,{replaceId:slot.id});after();},()=>saveForm(after,name));
        body.replaceChildren();body.append(element('p',`選んだ保存枠「${slot.name||'名前なし'}」だけを置き換えます。\n保存する名前：${name}`));
        actions.append(button('回路ファイル',()=>download('prism-notes-circuit.json',session.exportCircuit(name))));
        fitDialogForm();
      }));
      actions.append(button('取消',()=>saveForm(after,name)));
      fitDialogForm();
    }
  };
  input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();attempt(save);}});
  actions.append(button('保存',save),button('回路ファイル',()=>download('prism-notes-circuit.json',session.exportCircuit(input.value))),button('取消',close));
  fitDialogForm(compact=>{$('dialog-title').textContent=compact?'回路名を保存':'回路を保存';});
}
function confirmAction(title,action,cancel=close) {
  open(title);body.append(element('p',`${title}\nこの対象を変更します。`));
  actions.append(button('確定',action),button('取消',cancel));
  fitDialogForm();
}
function slots() {
  open('保存回路（10枠）');
  listPage(session.records.slots(),slot=>button(slot.name||'名前なし',()=>slotActions(slot)));
  actions.append(button('閉じる',close));
}
function slotActions(slot) {
  open(slot.name||'名前なし');
  body.append(element('p',`${slot.circuit.nodes.length}点・${slot.circuit.edges.length}本`),button('名前の全文',()=>fullText('保存回路名',slot.name,()=>slotActions(slot))));
  actions.append(button('読込',()=>replace({slotId:slot.id})),button('名前変更',()=>{
    open('回路名を変更');const input=element('input','',{type:'text',value:slot.name,'aria-label':'新しい回路名'});body.append(input);
    actions.append(button('変更',()=>{session.records.rename(slot.id,input.value);slots();}),button('取消',slots));
  }),button('削除',()=>confirmAction(`「${slot.name||'名前なし'}」を削除`,()=>{session.records.remove(slot.id);slots();},slots)));
}
function pendingScores() {
  open('成績の保存を再試行');
  listPage([...session.pendingScores.entries()],([key,candidate])=>{
    const problem=candidate.problem??challenges.find(c=>`${c.id}@${c.version}`===candidate.challenge);
    const label=problem?`${problem.id} ${problem.name}${problem.draw?' 出題'+problem.draw.number:''}`:'成績';
    return button(`${label} ${displayScore(candidate.score)}点`,()=>{
      if(!session.retryScore(key))throw new Error(session.scoreErrors.get(key));pendingScores();render(false);
    },{class:'challenge-row'});
  },'未保存の成績はありません。');actions.append(button('閉じる',close));
}

function offlineStatus() {
  const {ready,update,error,checking,checked}=offline.state;
  const result=checking?'更新を確認しています。':update?'更新版の準備ができました。':checked&&!error?'最新版です。':error?'更新確認を完了できませんでした。':'更新はまだ確認していません。';
  body.replaceChildren(element('p',result,{'role':'status'}),element('p',ready?'オフラインの準備が完了しています。':'オフラインの準備は未完了です。'),element('p','初回準備と更新には通信が必要です。保存回路・成績を外部へ送信しません。'));
  const check=button(checking?'確認中':'準備・更新を確認',()=>offline.prepare());check.disabled=checking;
  actions.replaceChildren(check,button('閉じる',close));
  if(update){body.append(element('p','適用するまで現在の画面を保持します。'));actions.prepend(button('更新へ',updateDialog));}
  $('dialog-error').textContent=error??'';
  fitDialogForm(()=>{},[...body.querySelectorAll('p')].slice(1),offlineStatus);
}
function offlineDialog(){open('オフラインと更新');offlineStatus();}
function requestUpdate() {
  cancelStart();
  if(updateSafety(session).kind==='confirm'&&!session.run?.records.length)return applyUpdate(false);
  updateDialog();
}
function updateDialog() {
  const safety=updateSafety(session);open('更新の前に');body.append(element('p',safety.message));
  if(safety.kind==='guide')actions.append(button('案内を閉じて戻る',()=>{session.endGuide('interrupted');updateDialog();}));
  else if(safety.kind==='running')actions.append(button('停止して更新へ',()=>{session.stop();chime.stop();clockAnchor=null;updateDialog();}));
  else if(safety.kind==='scores')actions.append(button('成績の保存を再試行',()=>{
    for(const key of session.pendingScores.keys())session.retryScore(key);
    if(session.pendingScores.size)throw new Error('成績を保存できません。現在の結果と再試行候補を保持し、更新を延期します。');
    updateDialog();
  }));
  else if(safety.kind==='circuit')actions.append(button('保存して更新へ',()=>saveForm(updateDialog)),button('保存せず更新へ',()=>confirmUpdate(true)));
  else actions.append(button('更新を適用',()=>applyUpdate(false)));
  if(session.run?.records.length)body.append(button('実行記録を書き出す',()=>download('prism-notes-result.json',session.exportResult())));
  actions.append(button('取消',close));
  fitDialogForm();
}
function confirmUpdate(discard) {
  open('更新を適用');body.append(element('p','現在の未保存回路と実行記録を閉じて更新します。保存済みの回路・成績・案内履歴は保持します。'));
  if(session.run?.records.length)body.append(button('実行記録を書き出す',()=>download('prism-notes-result.json',session.exportResult())));
  actions.append(button('更新を適用',()=>applyUpdate(discard)),button('取消',close));
  fitDialogForm();
}
async function applyUpdate(discard) {
  if(updating)return;
  const safety=updateSafety(session);
  if(safety.kind!=='confirm'&&!(discard&&safety.kind==='circuit')){updateDialog();return;}
  // Keep the confirmation modal open while asynchronous worker checks run.
  // No edit, close, escape or duplicate apply can invalidate that confirmation.
  updating=true;$('app').inert=true;$('title-screen').inert=true;
  const approvedCircuit=session.circuit;
  const controls=[...dialog.querySelectorAll('button'),...$('title-screen').querySelectorAll('button'),$('update-notice')].map(control=>({control,disabled:control.disabled}));controls.forEach(({control})=>control.disabled=true);
  try{await offline.apply(()=>{
    const current=updateSafety(session);
    return session.circuit===approvedCircuit&&(current.kind==='confirm'||(discard&&current.kind==='circuit'));
  });}
  catch(error){updating=false;$('app').inert=!$('title-screen').hidden;$('title-screen').inert=false;controls.forEach(({control,disabled})=>control.disabled=disabled);throw error;}
}

function cancelWireDelete(){
  if(!pendingWireDelete&&!wireDelete.open)return;
  pendingWireDelete=null;deleteNeedsPress=false;board.removalId=null;board.cancelAll();
  if(wireDelete.open)wireDelete.close();board.render();
}
function positionWireDelete(){
  if(!wireDelete.open)return;
  const rect=wireDelete.getBoundingClientRect(),line=board.world.querySelector(`[data-edge="${CSS.escape(pendingWireDelete.id)}"] .edge-line`)?.getBoundingClientRect();
  const gap=8,bottom=Math.max(gap,innerHeight-rect.height-gap),overlap=top=>line?Math.max(0,Math.min(top+rect.height,line.bottom)-Math.max(top,line.top)):0;
  wireDelete.style.top=`${overlap(bottom)<=overlap(gap)?bottom:gap}px`;
  wireDelete.style.left=`${Math.max(gap,(innerWidth-rect.width)/2)}px`;
}
function showWireDelete(id,pointer){
  session.requireEditable();if(!session.circuit.edges.some(edge=>edge.id===id))return;
  cancelWireDelete();board.cancelAll();if(dialog.open)dialog.close();
  pendingWireDelete={id,circuit:session.circuit,hold:pointer?{id:pointer.pointerId,x:pointer.clientX,y:pointer.clientY}:null};deleteNeedsPress=Boolean(pointer);
  board.removalId=id;session.selection=id;board.render();
  $('wire-delete-target').textContent=objectName(id,session.circuit);
  wireDelete.showModal();positionWireDelete();
}
wireDelete.addEventListener('pointerdown',()=>{deleteNeedsPress=false;},true);
wireDelete.addEventListener('click',event=>{if(deleteNeedsPress&&event.detail!==0){event.preventDefault();event.stopImmediatePropagation();}},true);
function abortHeldDelete(event){cancelWireDelete();event.preventDefault();event.stopImmediatePropagation();}
document.addEventListener('pointermove',event=>{const hold=pendingWireDelete?.hold;if(hold&&event.pointerId===hold.id&&Math.hypot(event.clientX-hold.x,event.clientY-hold.y)>12)abortHeldDelete(event);},true);
document.addEventListener('pointerdown',event=>{const hold=pendingWireDelete?.hold;if(hold&&event.pointerId!==hold.id)abortHeldDelete(event);},true);
document.addEventListener('pointerup',event=>{if(pendingWireDelete?.hold?.id===event.pointerId)pendingWireDelete.hold=null;},true);
document.addEventListener('pointercancel',event=>{if(pendingWireDelete?.hold?.id===event.pointerId)abortHeldDelete(event);},true);
wireDelete.addEventListener('close',()=>{if(!wireDelete.open)cancelWireDelete();});
$('wire-delete-cancel').addEventListener('click',cancelWireDelete);
$('wire-delete-target').addEventListener('click',()=>{
  const {id,circuit}=pendingWireDelete;cancelWireDelete();fullText('対象の名前',objectName(id,circuit),()=>showWireDelete(id));
});
$('wire-delete-ok').addEventListener('click',()=>attempt(()=>{
  const pending=pendingWireDelete;if(!pending)return;
  if(!session.editable||session.circuit!==pending.circuit){cancelWireDelete();notify('配線が変わったため、もう一度選んでください。');return;}
  session.remove(pending.id,true);cancelWireDelete();message='';render();
}));

function settings(pointer) {
  const id=session.selection;if(!id)return;
  const input=session.circuit,edge=input.edges.find(item=>item.id===id),node=input.nodes.find(item=>item.id===id);
  if(!edge&&!node){
    const candidate=session.mode==='challenge'&&session.challenge.candidates.find(item=>item.id===id);
    if(candidate){open('未結線の候補');body.append(element('p',objectName(id,input,session.challenge.candidates)),element('p',`${candidate.time}秒。まだ結線されていません。起点の星やプリズムからドラッグすると結線できます。`));actions.append(button('閉じる',close));fitDialogForm();}
    return;
  }
  open(`${objectName(id,input)}の設定`);
  dialog.classList.add('settings-dialog');
  if(pointer)settingsTapGuard={x:pointer.clientX,y:pointer.clientY,until:performance.now()+400};
  const items=[];
  items.push(['名前の全文',()=>fullText('対象の名前',objectName(id,input),settings)]);
  if(edge||node.kind!=='goal')items.push(['時間',()=>timeInput(id,edge?.time??node.process)]);
  if(session.mode==='free'&&edge)items.push([edge.bidirectional?'向き：両方向':'向き：片方向',()=>{
    session.requireEditable();open('道の向き');
    listPage([
      [`${objectName(edge.from,input)}から${objectName(edge.to,input)}へ`,{bidirectional:false}],
      [`${objectName(edge.to,input)}から${objectName(edge.from,input)}へ`,{bidirectional:false,reverse:true}],
      [`${objectName(edge.from,input)}と${objectName(edge.to,input)}の両方向`,{bidirectional:true}],
    ],([name,direction])=>button(name,()=>{session.setDirection(id,direction);close();}));actions.append(button('取消',close));
  }]);
  if(session.mode==='free'&&(edge||node.kind==='prism'))items.push([`使用：${(edge??node).enabled===false?'不可':'可'}`,()=>{session.setEnabled(id,(edge??node).enabled===false);close();}]);
  if(node&&session.mode==='free')items.push(['名前',()=>{
    session.requireEditable();open('点の名前');const field=element('input','',{type:'text',value:partName(node,input.nodes),'aria-label':'点の名前'});body.append(field);
    actions.append(button('確定',()=>{const next=structuredClone(session.circuit);next.nodes.find(n=>n.id===id).name=field.value;session.commitEdit(next);close();}),button('取消',close));
  }]);
  const remove=()=>{
    if(edge){showWireDelete(id);return;}
    session.requireEditable();const related=node?input.edges.filter(path=>path.from===id||path.to===id):[edge];
    open('選んだパーツを削除');body.append(element('p',node?`このパーツと、接続する${related.length}本の道を削除します。`:'選んだ道だけを削除します。'));
    listPage(related,path=>element('p',objectName(path.id,input)),'接続する道はありません。');
    actions.append(button('削除',()=>{session.remove(id,true);close();}),button('取消',close));
    fitDialogForm();
  };
  if(edge)actions.append(button(session.editable?'削除':'停止して編集',()=>{if(session.editable)remove();else{stopRun();settings();}}));
  else if(node.kind!=='source'&&session.mode==='free')items.push(['削除',remove]);
  listPage(items,item=>{
    const row=button(item[0],item[1],{class:'setting-option'});
    const value=item[0]==='時間'?`${edge?.time??node.process}秒`:null;
    if(value){const label=element('span','時間'),current=element('span',value.length>18?value.slice(0,16)+'…':value,{class:'setting-value','aria-hidden':'true'});row.replaceChildren(label,current);row.title=`時間：${value}`;}
    return row;
  });actions.append(button('記録',()=>{close();showRecords();}),button('閉じる',close));
}
function fullText(title,text,back=close){
  open(title);const chunks=Array.from(String(text));const parts=[];
  for(let start=0;start<chunks.length;start+=18)parts.push(chunks.slice(start,start+18).join(''));
  listPage(parts,part=>element('p',part,{class:'detail-value'}),'名前は空欄です。');actions.append(button('戻る',back));
}
function objects(){
  open('点と道の一覧');
  listPage([...session.circuit.nodes,...session.circuit.edges],item=>button(objectName(item.id,session.circuit),()=>{session.selection=item.id;board.render();settings();}));
  actions.append(button('回路名の全文',()=>fullText('回路名',session.name,objects)),button('閉じる',close));
}
function timeInput(id,initial) {
  const editing=session.mode==='free'&&session.editable;
  open(`${objectName(id,session.circuit)}の時間`);
  dialog.classList.add('time-dialog');
  if(!editing){body.append(element('p',`${initial}秒。${session.mode==='challenge'?'課題の時間は固定です。':'停止後に編集できます。'}`));actions.append(button('戻る',settings));return;}
  const input=element('input','',{type:'text',inputmode:'decimal',value:initial,'aria-label':'秒数',enterkeyhint:'done'});
  const row=element('div','',{class:'dialog-row'}),scale=new TimeScale(['0.1']);
  const adjust=direction=>{
    const current=scale.ticks(input.value),next=current+BigInt(direction);if(next<0n)throw new Error('0秒未満にはできません。');
    const edge=session.circuit.edges.find(item=>item.id===id);
    if(edge&&next<1n)throw new Error('道の時間は0.1秒以上です。');
    input.value=scale.format(next);
  };
  row.append(button('−0.1',()=>adjust(-1)),input,button('＋0.1',()=>adjust(1)));body.append(element('label','秒（0.1秒刻み）'),row);
  input.addEventListener('focus',()=>{if(matchMedia('(pointer:coarse)').matches)document.body.classList.add('input-focus');});
  const submit=()=>{session.setTime(id,input.value);close();};
  input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();attempt(submit);}});
  actions.append(button('確定',submit),button('取消',close));
  fitDialogForm(compact=>{$('dialog-title').textContent=`${objectName(id,session.circuit)}の時間${compact?'（秒）':''}`;});
}
function flow() {
  session.requireEditable();open('自由の流れ方');
  const mode=element('select','',{'aria-label':'流れ方'});
  mode.append(element('option','最速経路',{value:'fastest'}),element('option','分かれて広がる',{value:'spread'}));mode.value=session.circuit.mode;
  const target=element('select','',{'aria-label':'送信先'});target.append(element('option','すべての鐘へ',{value:'all'}));
  for(const node of session.circuit.nodes.filter(node=>node.kind==='goal'))target.append(element('option',partName(node,session.circuit.nodes),{value:node.id}));
  target.value=session.circuit.target??'all';
  const fields=element('div','',{class:'flow-fields'}),modeField=element('div','',{class:'flow-field'}),targetField=element('div','',{class:'flow-field'});
  modeField.append(element('label','流れ方'),mode);targetField.append(element('label','最速の送信先'),target);fields.append(modeField,targetField);body.append(fields);
  actions.append(button('確定',()=>{session.setFlow(mode.value,target.value);close();}),button('取消',close));
  fitDialogForm(compact=>fields.classList.toggle('columns',compact));
}

const recordNames={send:'送出',travel:'移動',arrival:'到着',branch:'分岐',goal:'鐘が鳴る',deadend:'行き止まり',unreachable:'到達不能','process-start':'処理開始','process-end':'処理終了'};
function showRecords(){cancelStart();session.openRecords();session.view.recordsOpen=true;chime.stop();clockAnchor=null;render(false);requestAnimationFrame(resizeRecords);}
function resizeRecords(){
  document.body.classList.remove('records-fullscreen');
  orientation.syncRegions();
  const minimum=parseFloat(getComputedStyle($('record-list')).fontSize)*1.4+8;
  const empty=$('record-list').querySelector('p');
  if($('record-list').getBoundingClientRect().height<Math.max(minimum,empty?.getBoundingClientRect().height??0)||$('stage').getBoundingClientRect().height<70)document.body.classList.add('records-fullscreen');
  orientation.syncRegions();
  const list=$('record-list'),space=list.getBoundingClientRect().height,probe=button('0秒 光線0 到着',()=>{},{class:'record-row'});
  list.replaceChildren(probe);const height=probe.getBoundingClientRect().height,gap=parseFloat(getComputedStyle(list).gap)||0;
  recordCapacity=Math.max(1,Math.floor((space+gap)/(height+gap)));renderRecords();
}
new ResizeObserver(()=>{if(!recordResize){recordResize=true;requestAnimationFrame(()=>{recordResize=false;if(!$('records-panel').hidden)resizeRecords();});}}).observe($('record-list'));
function renderRecords(){
  const cases=session.view.recordTab==='cases',items=cases?session.cases:session.run?.records??[],field=cases?'casePage':'recordPage';
  const anchor=`${field}Anchor`;session.view[anchor]??=(session.view[field]??0)*recordCapacity;
  const pages=Math.max(1,Math.ceil(items.length/recordCapacity));session.view[field]=Math.max(0,Math.min(pages-1,Math.floor(session.view[anchor]/recordCapacity)));
  const page=session.view[field];$('record-title').textContent=cases?'故障ケース':'実行記録';$('record-tab').textContent=cases?'記録':'故障';$('record-tab').disabled=!session.cases.length;
  const list=$('record-list');list.replaceChildren();
  if(!items.length)list.append(element('p',cases?'故障ケースはありません。':'実行記録はまだありません。'));
  for(const item of items.slice(page*recordCapacity,(page+1)*recordCapacity)) {
    list.append(button(cases?`${objectName(item.id,session.circuit)} 不可：${item.reachable?item.time+'秒':'到達不能'}`:`${item.time}秒 光線${item.particle??'—'} ${recordNames[item.type]}`,()=>cases?caseDetails(item):recordDetails(item),{class:'record-row'}));
  }
  $('record-prev').disabled=page===0;$('record-next').disabled=page===pages-1;$('record-page').textContent=`${page+1}/${pages}・全${items.length}件`;
}
function moveRecordPage(step){
  const field=session.view.recordTab==='cases'?'casePage':'recordPage';
  session.view[`${field}Anchor`]=Math.max(0,(session.view[field]+step)*recordCapacity);renderRecords();
}
function particleRecords(id,back=close){
  open(`光線${id}の記録`);
  const records=(session.run?.records??[]).filter(item=>item.particle===id);
  listPage(records,item=>button(`${item.time}秒 ${recordNames[item.type]} ${item.node?objectName(item.node,session.circuit):''}`,()=>recordDetails(item,()=>particleRecords(id,back))),'この光線の記録はありません。');
  actions.append(button('戻る',back));
}
function recordDetails(record,back=close){
  open('記録の詳細');
  const names={type:'出来事',time:'時刻',particle:'光線番号',parent:'親の光線',node:'地点',target:'対象の鐘',edge:'道',from:'出発地点',to:'次の地点',plannedTime:'最短経路の予定時間',arrivalTime:'到着予定',hops:'通った道の本数',children:'分岐後の光線',arrivedAt:'到着時刻',wait:'待ち時間',finishTime:'処理終了予定',startedAt:'処理開始時刻',processing:'処理時間',reason:'理由'};
  const fields=Object.entries(record).flatMap(([key,value])=>(Array.isArray(value)?value:[value]).map(item=>({key,label:names[key]??key,value:key==='type'?recordNames[item]:['node','target','edge','from','to'].includes(key)&&item?objectName(item,session.circuit):item??'—'})));
  listPage(fields,({key,label,value})=>button(`${label}：${value}`,()=>['particle','parent','children'].includes(key)&&Number.isSafeInteger(value)&&value>0?particleRecords(value,()=>recordDetails(record,back)):fullText(label,value,()=>recordDetails(record,back))));actions.append(button('戻る',back));
}
function caseDetails(item){
  open(item.kind==='edge'?'道の故障':'プリズムの故障');body.append(element('p',objectName(item.id,session.circuit)),element('p',item.reachable?`${item.time}秒で鐘に届きます。`:'この故障では鐘に届きません。'));
  if(item.edges.length)body.append(button('通った道を見る',()=>fullText('通った道',item.edges.map(id=>objectName(id,session.circuit)).join('\n'),()=>caseDetails(item))));
  fitDialogForm();
  actions.append(button('このケースで鐘を鳴らす',()=>{session.stop();close();return startRun({caseId:item.id});}),button('戻る',close));
}

function interruptRun(reason){celebration.cancel();cancelStart();session.pause(reason);endWait.interrupt(session.run);chime.stop();clockAnchor=null;}
function startClock(){clockAnchor={run:session.run,clock:session.run.clock,wall:performance.now()};message='';render();}
function runCounts(){
  const run=session.run;if(!run)return {};
  let waiting=0;for(const gate of run.gates.values())waiting+=gate.queue.length-gate.head;
  return {records:run.records.length,retainedParticles:run.particles.size,active:run.activeCount,waiting};
}
function finishLoad(){
  if(load.finish(runCounts())&&session.run?.status!=='stopped'){
    interruptRun('load');render(false);
  }
}
function cancelStart(){
  const token=startPrelude;if(!token)return;startPrelude=null;cancelAnimationFrame(token.frame);
  if(token.view===session.view){Object.assign(session.view,token.original);board.transform();board.render();}
  $('stage').style.removeProperty('--launch-progress');token.cancel();render(false);
}
function launch(action){
  const view=session.view,original={zoom:view.zoom,panX:view.panX,panY:view.panY},target=board.fitView();
  const animated=view.zoom>Math.max(1,target.zoom)+.0001,reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const token={view,original,frame:null,started:null};
  return new Promise((resolve,reject)=>{
    token.cancel=()=>resolve(false);
    startPrelude=token;board.cancelAll();session.selection=null;board.render();render(false);
    const step=now=>{
      if(startPrelude!==token)return;
      token.started??=now;const progress=Math.min(1,(now-token.started)/LAUNCH_DELAY_MS),ease=1-(1-progress)**3;
      $('stage').style.setProperty('--launch-progress',progress);
      if(animated&&(!reduced||progress===1)){for(const key of ['zoom','panX','panY'])view[key]=original[key]+(target[key]-original[key])*ease;board.transform();board.render();}
      if(progress<1){token.frame=requestAnimationFrame(step);return;}
      startPrelude=null;$('stage').style.removeProperty('--launch-progress');render(false);
      try{action();resolve(true);}catch(error){Object.assign(view,original);board.transform();board.render();load.current=null;reject(error);}
    };token.frame=requestAnimationFrame(step);
  });
}
function startRun(options){
  session.requireEditable();if(session.startBlockedReason)throw new Error(session.startBlockedReason);
  return launch(()=>{load.begin();load.measure('calculation',()=>session.start(options));session.view.recordPageAnchor=0;load.measure('display',startClock);finishLoad();});
}
function play(){
  if(startPrelude){cancelStart();return;}
  if(session.editable){return startRun();}
  else if(session.run.status==='running'){session.pause();celebration.cancel();chime.stop();clockAnchor=null;render(false);}
  else{return launch(()=>{session.resume();startClock();});}
}
function stopRun(){celebration.cancel();cancelStart();session.stop();chime.stop();clockAnchor=null;message='';render();}
function reactions(entries){
  const goals=entries.filter(entry=>entry.type==='goal');
  const relays=entries.filter(entry=>entry.type==='arrival'&&session.run.circuit.nodes.get(entry.node)?.kind==='prism');
  if(goals.length||relays.length)load.measure('audio',()=>{for(const _entry of goals)chime.strike();for(const _entry of relays)chime.relay();});
  if(!goals.length&&!relays.length)return;
  load.measure('display',()=>{
    board.arrivals([...goals,...relays]);
    for(const entry of [...goals,...relays]){
      const target=$('board').querySelector(`[data-node="${CSS.escape(entry.node)}"]`);target?.classList.add('arrived');
      setTimeout(()=>target?.classList.remove('arrived'),entry.type==='goal'?1800:1000);
    }
  });
}
function frame(now){
  if(session.run?.status==='running'){
    if(!clockAnchor||clockAnchor.run!==session.run)clockAnchor={run:session.run,clock:session.run.clock,wall:now};
    const run=session.run,elapsed=BigInt(Math.max(0,Math.floor(now-clockAnchor.wall)));
    const ticks=clockAnchor.clock+elapsed*run.circuit.time.unit/1000n;
    load.begin();
    try{
      const entries=load.measure('calculation',()=>session.advance(run.circuit.time.format(ticks),{shouldPause:()=>load.calculationExceeded()}));
      if(run.status==='stopped'){chime.stop();clockAnchor=null;}else reactions(entries);load.measure('display',()=>render(false,{records:false}));
      if(!$('records-panel').hidden)load.measure('records',renderRecords);
      finishLoad();
    }catch(error){load.current=null;interruptRun('error');notify(error.message);}
  }
  if(!document.hidden&&endWait.ready(session.run,now,{allowNoArrival:session.runContext?.mode==='challenge',cleared:Boolean(session.clearChoices)}))attempt(stopRun);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
$('home').addEventListener('click',()=>attempt(chooseMode));$('menu').addEventListener('click',()=>attempt(menu));
function showConditions(){
  const challenge=session.challenge;
  const detail=session.mode==='challenge'?`${challenge.id} ${challenge.name}\n${challenge.stage}\n${$('condition').textContent}\n${challengeGoal(challenge)}\n配線 使用${session.circuit.edges.length}/${challenge.limit}本（上限${challenge.limit}本・残り${challenge.limit-session.circuit.edges.length}本）\n満点の基準：${challenge.type==='delivery-all'?'最後の鐘への初回到達':challenge.type==='interval'?'初回到達':'到達'}${challenge.baseline}秒${challenge.type==='time-hops'?'・'+challenge.baselineHops+'本の経路':''}\n動作上限 ${challenge.maxDuration}秒（満点の基準時間とは別）。全粒終了後、クリア時は${CLEAR_END_WAIT_MS/1000}秒、それ以外は${END_WAIT_MS/1000}秒で編集へ戻ります。`:`${$('title').textContent}\n${$('condition').textContent}`;
  fullText('現在の条件',detail);
}
$('condition-info').addEventListener('click',showConditions);$('challenge-info').addEventListener('click',showConditions);
$('result-info').addEventListener('click',()=>session.result?.state==='failed'?failureDetails('実行状況',$('result').textContent+'\n'+failureResultText()):fullText('実行状況',$('result').textContent));
$('play').addEventListener('click',()=>attempt(play));$('stop').addEventListener('click',()=>attempt(stopRun));
$('next').addEventListener('click',()=>attempt(()=>{
  message='';load.begin();
  try{reactions(load.measure('calculation',()=>session.next({shouldPause:()=>load.calculationExceeded()})));load.measure('display',()=>render(false,{records:false}));if(session.view.recordsOpen)load.measure('records',renderRecords);finishLoad();}
  catch(error){load.current=null;interruptRun('error');throw error;}
}));
$('records').addEventListener('click',()=>attempt(showRecords));$('close-records').addEventListener('click',()=>{session.view.recordsOpen=false;document.body.classList.remove('records-fullscreen');render(false);$('records').focus();});
$('record-tab').addEventListener('click',()=>{session.view.recordTab=session.view.recordTab==='cases'?'records':'cases';renderRecords();});
$('record-prev').addEventListener('click',()=>moveRecordPage(-1));
$('record-next').addEventListener('click',()=>moveRecordPage(1));
$('sound').addEventListener('click',()=>attempt(async()=>{if(chime.muted){await chime.enable();automaticSoundFailed=false;chime.tap();}else chime.mute();render(false);}));
$('update-notice').addEventListener('click',()=>attempt(requestUpdate));
$('title-update').addEventListener('click',()=>attempt(()=>{
  if(offline.state.update)return requestUpdate();
  offlineDialog();return offline.prepare();
}));
$('title-start').addEventListener('click',()=>attempt(()=>chooseMode(()=>replace({challengeId:challenges[0].id}))));
$('title-challenges').addEventListener('click',()=>attempt(()=>chooseMode()));
$('title-free').addEventListener('click',()=>attempt(()=>chooseMode(()=>replace({sampleId:'compare'}))));
$('title-tutorial').addEventListener('click',()=>attempt(tutorial));
$('title-parts').addEventListener('click',()=>attempt(partsExplanation));
$('title-about').addEventListener('click',()=>attempt(aboutGame));
$('title-resume').addEventListener('click',leaveTitle);
$('clear-dismiss').addEventListener('click',dismissClear);
$('clear-details').addEventListener('click',()=>attempt(clearDetails));
$('clear-again').addEventListener('click',()=>attempt(()=>clearAction()));
$('clear-next').addEventListener('click',()=>attempt(()=>clearAction(true)));
$('failure-dismiss').addEventListener('click',dismissFailure);
$('failure-edit').addEventListener('click',()=>attempt(reviewFailure));
$('failure-details').addEventListener('click',()=>attempt(failureDetails));
$('retry-result').addEventListener('click',()=>{
  let failed=false;
  for(const key of session.pendingScores.keys())if(!session.retryScore(key))failed=true;
  message=failed?'成績を保存できませんでした。今回の結果と再試行候補は保持しています。':'';render(false);
});
$('zoom-in').addEventListener('click',()=>board.zoom(1.2));$('zoom-out').addEventListener('click',()=>board.zoom(1/1.2));$('fit').addEventListener('click',()=>board.fit());
$('clear-wires').addEventListener('click',()=>attempt(()=>{
  board.cancelAll();session.requireEditable();
  if(clearedConnections?.cleared===session.circuit){session.commitEdit(clearedConnections.before);session.dirty=clearedConnections.dirty||session.saveRevision!==clearedConnections.saveRevision;session.selection=null;clearedConnections=null;}
  else{const before=structuredClone(session.circuit),dirty=session.dirty,saveRevision=session.saveRevision;session.clearConnections();clearedConnections={before,dirty,saveRevision,cleared:session.circuit};}
  message='';render();
}));
$('magnifier-toggle').addEventListener('click',()=>{board.magnifier.toggle();render(false);});
$('candidate-times').addEventListener('click',()=>{session.view.showAllTimes=session.view.showAllTimes===false;board.render();render(false);});
for(const kind of ['prism','goal'])$('add-'+kind).addEventListener('click',()=>{board.addKind=board.addKind===kind?null:kind;render(false);});
$('flow').addEventListener('click',()=>attempt(flow));
$('guide-skip').addEventListener('click',()=>attempt(()=>{session.endGuide('skipped');message='';render();}));
$('guide-finish').addEventListener('click',()=>attempt(()=>{session.endGuide('completed');message='';render();}));
$('hint').addEventListener('click',()=>{
  if(session.guide&&$('app').classList.contains('compact')){
    fullText('操作の案内',$('guide-text').textContent);
    actions.append(button('スキップ',()=>{session.endGuide('skipped');message='';close();}));
    if(session.guide.readyToFinish)actions.append(button('完了',()=>{session.endGuide('completed');message='';close();}));
  }else fullText('操作の案内',$('hint').textContent);
});
document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(wireDelete.open){event.preventDefault();cancelWireDelete();}else if(!dialog.open&&session.view.recordsOpen){event.preventDefault();$('close-records').click();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){board.cancelAll();cancelWireDelete();celebration.cancel();cancelStart();session.pause('hidden');chime.stop();clockAnchor=null;render(false);}});
window.addEventListener('blur',()=>{board.cancelAll();cancelWireDelete();});
document.addEventListener('contextmenu',event=>{if(!event.target.closest('input,textarea,select,[contenteditable="true"]'))event.preventDefault();});
function viewport(){
  if(celebration.run){celebration.cancel();chime.stop();}cancelStart();
  const visual=window.visualViewport;
  // Mobile browsers can temporarily fit overflowing content by zooming out.
  // Reading that enlarged CSS viewport back into the layout preserves the error.
  const width=visual?visual.width*visual.scale:innerWidth,height=visual?visual.height*visual.scale:innerHeight;
  layoutTitle(width,height);
  orientation.update({width,height,type:screen.orientation?.type,angle:screen.orientation?.angle,legacyAngle:window.orientation,coarse:matchMedia('(pointer:coarse)').matches,editing:document.activeElement?.matches('input,textarea')});
  const state={direction:screen.orientation?.type??null,angle:screen.orientation?.angle??window.orientation??null,frame:orientation.rotation,width,height,scale:visual?.scale??1};
  const previous=viewport.history?.at(-1);if(JSON.stringify(previous)!==JSON.stringify(state)){viewport.history??=[];viewport.history.push(state);if(viewport.history.length>8)viewport.history.shift();}
  cancelWireDelete();board.resize();render(false);if(session.view.recordsOpen)requestAnimationFrame(resizeRecords);
}
document.querySelector('.app-version').addEventListener('click',()=>{
  fullText('表示情報',`検証 v${offline.version}\n${[...viewport.history].reverse().map(s=>`画面 ${s.width.toFixed(1)} × ${s.height.toFixed(1)} / 倍率 ${s.scale.toFixed(3)}\n向き ${s.direction??'不明'} / 端末 ${s.angle??'不明'}° / 配置 ${s.frame}°`).join('\n\n')}`);
});
window.visualViewport?.addEventListener('resize',viewport);window.addEventListener('resize',viewport);screen.orientation?.addEventListener('change',viewport);window.addEventListener('orientationchange',viewport);viewport();render();maybeGuide();
// Root font changes can resize text without dispatching a window resize event.
const fontProbe=element('span','',{'aria-hidden':'true',style:'position:fixed;left:0;top:0;width:1rem;height:1rem;opacity:0;pointer-events:none'});
document.body.append(fontProbe);let observedFont=parseFloat(getComputedStyle(document.documentElement).fontSize);
const fontResize=new ResizeObserver(()=>{const next=parseFloat(getComputedStyle(document.documentElement).fontSize);if(next!==observedFont){observedFont=next;viewport();render();}});
fontResize.observe(fontProbe);
if(offline.enabled)offline.prepare();

// Local inspection for performance verification; never stores or uploads data.
export function inspectPerformance(){return {...load.snapshot(),run:session.run?{status:session.run.status,pauseReason:session.run.pauseReason,clock:session.run.format(),...runCounts()}:null,audioVoices:chime.voices.size};}
