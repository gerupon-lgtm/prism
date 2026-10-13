import { Session } from '../app/session.js';
import { LocalRecords } from '../core/storage.js';
import { TimeScale } from '../core/time.js';
import { displayScore } from '../core/evaluation.js';
import { challenges } from '../content/challenges.js';
import { samples } from '../content/samples.js';
import { Board } from './board.js';
import { Chime } from './audio.js';
import { Offline } from './offline.js';
import { updateSafety } from '../app/update-safety.js';
import { LoadMeter } from './load-meter.js';
import { OrientationLayout } from './orientation.js';
import { EndWait } from './end-wait.js';

const $ = id => document.getElementById(id);
function element(tag,text='',attributes={}) {
  const item=document.createElement(tag);item.textContent=text;
  for(const [name,value] of Object.entries(attributes))item.setAttribute(name,value);
  return item;
}
function button(text,action,attributes={}) {
  const characters=Array.from(String(text));
  const label=characters.length>18?characters.slice(0,17).join('')+'…':text;
  const item=element('button',label,{type:'button',title:text,'aria-label':text,...attributes});item.addEventListener('click',()=>attempt(action));return item;
}
const load=new LoadMeter();
const endWait=new EndWait();
const storage={getItem:key=>load.measure('records',()=>window.localStorage.getItem(key)),setItem:(key,value)=>load.measure('records',()=>window.localStorage.setItem(key,value))};
const session=new Session(new LocalRecords(storage)),chime=new Chime();
const dialog=$('dialog'),body=$('dialog-body'),actions=$('dialog-actions');
let message='',recordCapacity=1,recordResize=false,clockAnchor=null,dialogPage=null,dialogLayout=null,updating=false,clearedConnections=null;
const dismissedClears=new WeakSet();
let clearToastRun=null,clearToastCircuit=null;
const board=new Board($('board'),session,render,settings,notify);
const orientation=new OrientationLayout($('app'));
const offline=new Offline(()=>{updateNotice();if(dialog.open&&$('dialog-title').textContent==='オフラインと更新')offlineStatus();});

function updateNotice(){ $('update-notice').hidden=!offline.state.update; }

document.addEventListener('click',event=>{
  const target=event.target.closest('button');if(!target||target.disabled)return;
  target.classList.remove('button-response');void target.offsetWidth;target.classList.add('button-response');
  if(target.id!=='sound')chime.tap();
});
document.addEventListener('animationend',event=>{if(event.animationName==='button-response')event.target.classList.remove('button-response');});

function notify(text) { message=text; render(false); }
function attempt(action) {
  try {const pending=action();if(pending?.catch)pending.catch(failure);}
  catch(error){failure(error);}
}
function failure(error) {
  if(dialog.open)$('dialog-error').textContent=error.message;
  else notify(error.message);
}
function open(title) {
  session.pause('dialog');chime.stop();clockAnchor=null;
  $('dialog-title').textContent=title;dialog.classList.remove('menu-dialog');body.replaceChildren();body.className='';actions.replaceChildren();$('dialog-error').textContent='';$('dialog-info').hidden=true;dialogPage=null;dialogLayout=null;
  document.body.classList.remove('input-focus');
  if(!dialog.open)dialog.showModal();render(false);
}
function close() { if(updating)return;dialog.close();document.body.classList.remove('input-focus');dialogPage=null;render(); }
dialog.addEventListener('close',()=>{document.body.classList.remove('input-focus');dialogPage=null;render(false);});
dialog.addEventListener('cancel',event=>{if(updating){event.preventDefault();return;}document.body.classList.remove('input-focus');});
document.addEventListener('focusin',event=>{if(event.target.matches('input[type=text],input:not([type])'))event.target.select();});

function render(redraw=true,{records=true}={}) {
  const readableFont=parseFloat(getComputedStyle(document.documentElement).fontSize),textEnlarged=readableFont>=20,compact=innerHeight<=360&&textEnlarged;
  document.documentElement.style.setProperty('--layout-font',`${readableFont}px`);
  document.documentElement.style.setProperty('--layout-footer-font',getComputedStyle(document.querySelector('footer')).fontSize);
  $('app').classList.toggle('text-enlarged',textEnlarged);
  $('app').classList.toggle('compact',compact);
  const narrowControls=textEnlarged||compact||Math.abs(orientation.rotation)===90;
  $('add-prism').textContent=narrowControls?'◇＋':'＋プリズム';$('add-goal').textContent=narrowControls?'祭壇＋':'＋祭壇';
  const canRestore=clearedConnections?.cleared===session.circuit;
  $('clear-wires').textContent=canRestore?'戻す':textEnlarged?'消去':'クリア';$('clear-wires').setAttribute('aria-label',canRestore?'クリアした配線を戻す':'配線をすべてクリア');
  $('clear-wires').disabled=!session.editable||(!canRestore&&!session.circuit.edges.length);
  $('magnifier-toggle').setAttribute('aria-pressed',String(board.magnifier.enabled));
  $('magnifier-toggle').textContent=textEnlarged?'補助':board.magnifier.enabled?'補助ON':'補助OFF';
  $('records-panel').hidden=!session.view.recordsOpen;
  if(!session.view.recordsOpen)document.body.classList.remove('records-fullscreen');
  $('title').textContent=session.mode==='challenge'?`${session.challenge.id} ${session.challenge.name}`:session.name||'自由';
  $('condition').textContent=session.mode==='challenge'?`${session.challenge.stage}・道 ${session.circuit.edges.length}/${session.challenge.limit}本${session.challenge.type==='interval'?`・${session.challenge.interval}秒間隔で${session.challenge.count}回`:''}`:`${session.circuit.mode==='spread'?'分かれて広がる':'最速経路'}・${session.circuit.nodes.length}点 ${session.circuit.edges.length}本${session.dirty?'・未保存':''}`;
  $('add-controls').hidden=session.mode!=='free'||!session.editable||Boolean(session.guide);
  for(const kind of ['prism','goal'])$('add-'+kind).setAttribute('aria-pressed',String(board.addKind===kind));
  const run=session.run;
  const startBlockedReason=session.editable?session.startBlockedReason:'';
  $('play').textContent=session.editable?'流す':run.status==='running'?'一時停止':'再開';
  $('play').disabled=session.editable?Boolean(startBlockedReason):run.exhausted;
  $('play').title=startBlockedReason;
  $('stop').disabled=session.editable;$('next').disabled=!run||run.status!=='paused'||run.exhausted;
  $('play').dataset.state=run?.status??'ready';$('play').setAttribute('aria-pressed',String(run?.status==='running'));
  $('records').setAttribute('aria-pressed',String(session.view.recordsOpen));
  $('sound').textContent=chime.muted?'音なし':'音あり';$('sound').setAttribute('aria-pressed',String(!chime.muted));
  let text=run?`${run.format()}秒・${run.activeCount}光線`:'';
  if(session.result){
    const stateText={pending:'判定待ち',achieved:'達成',failed:'未達成',stopped:'中断',finished:'到着・動作終了',running:'実行中'}[session.result.state];
    text+=`　${stateText}`;if(session.result.score)text+=` ${displayScore(session.result.score)}点`;
  }
  if(run?.pauseReason==='load')text+='　負荷のため一時停止。状態を保持しています。';
  if(session.pendingScores.size)text+=`　成績${session.pendingScores.size}件未保存`;
  $('retry-result').hidden=session.pendingScores.size===0;
  $('result').textContent=[text,message||startBlockedReason].filter(Boolean).join('　');$('result').classList.toggle('error',Boolean(message));
  $('hint').textContent=board.addKind?'追加する位置をタップ':session.selection?`${session.selection}：ダブルタップで設定`:'起点から候補をなぞって結線';
  $('guide-bar').hidden=!session.guide;
  if(session.guide){
    const guide=session.guide,steps=guide.mode==='challenge'?['起点から候補へドラッグしてつなぎます。','祭壇までつないで「流す」を押します。','到着と点数を見て「記録」を開きます。']:['「流す」で2.5秒の到着を見ます。','停止してAをダブルタップ。処理時間を1.5秒へ。','もう一度流して、B経由の3秒到着を見ます。'];
    $('guide-text').textContent=`${guide.step+1}/3 ${steps[guide.step]}`;$('guide-finish').hidden=!guide.readyToFinish;
    if(compact)$('hint').textContent=`案内 ${$('guide-text').textContent}`;
  }
  if(redraw)board.render();else board.particles();
  if(records&&!$('records-panel').hidden)load.measure('records',renderRecords);
  renderClearToast();
}

function renderClearToast() {
  const toast=$('clear-toast'),choices=session.clearChoices,run=session.run;
  if(run&&clearToastRun===run&&clearToastCircuit!==session.circuit)dismissedClears.add(run);
  toast.hidden=!choices||dismissedClears.has(run)||dialog.open||session.view.recordsOpen||updating||['load','error'].includes(run?.pauseReason);
  if(toast.hidden)return;
  if(clearToastRun!==run){clearToastRun=run;clearToastCircuit=session.circuit;}
  $('clear-next').textContent=choices.nextChallengeId?'次へ':'課題一覧へ';
  const bounds=$('board').getBoundingClientRect();
  const width=Math.min(420,innerWidth-16,bounds.width-8);
  toast.classList.toggle('narrow',width<240);
  toast.querySelector('strong').textContent=width<240?'クリア':'課題クリア！';
  toast.style.width=`${width}px`;
  toast.style.left=`${Math.max(8,Math.min(innerWidth-width-8,bounds.left+(bounds.width-width)/2))}px`;
  toast.style.top=`${Math.max(bounds.top+4,Math.min(bounds.bottom-toast.offsetHeight-4,bounds.top+8))}px`;
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

function chooseMode() {
  if(session.guide){
    open('案内を閉じますか？');body.append(element('p','案内を閉じると、案内を開く前の配線と記録へ戻ってから課題を選べます。'));
    actions.append(button('案内を閉じて課題を選ぶ',()=>{board.cancelAll();chime.stop();session.endGuide('skipped');message='';render();chooseMode();}),button('案内を続ける',close));
    fitDialogForm();return;
  }
  if(!session.editable){
    open('停止して課題を選びますか？');body.append(element('p','課題を切り替える前に、現在の実行を停止します。配線と記録は停止後も確認できます。'));
    actions.append(button('停止して課題を選ぶ',()=>{stopRun();chooseMode();}),button('戻る',close));
    fitDialogForm();return;
  }
  open('課題と自由');
  actions.append(button('自由へ',()=>replace({sampleId:'compare'})),button('閉じる',close));
  let scores=[];
  try{scores=session.records.scores();}catch(error){$('dialog-error').textContent=error.message;}
  listPage(challenges,challenge=>{
    const best=scores.find(score=>score.challenge===`${challenge.id}@${challenge.version}`&&score.rule===`${challenge.type}@1`);
    return button(`${challenge.id} ${challenge.name}${best?'　'+displayScore(best.score)+'点':''}`,()=>replace({challengeId:challenge.id}));
  });
}
function replace(request) {
  session.requireEditable();session.replacement(request);
  if(session.mode==='free'&&session.dirty){
    open('現在の未保存回路');body.append(element('p','読み込み前に、現在の回路をどうしますか？'));
    actions.append(button('保存して入替',()=>saveForm(()=>{session.replace(request,{choice:'discard'});close();maybeGuide();})),button('保存せず入替',()=>{session.replace(request,{choice:'discard'});close();maybeGuide();}),button('取消',close));
    fitDialogForm();
  }else{session.replace(request);close();maybeGuide();}
}
function maybeGuide() {
  try{if(session.needsGuide()){session.beginGuide();message='';render();}}
  catch(error){notify(`${error.message} 案内はメニューから開けます。`);}
}
function menu() {
  open('メニュー');
  const items=[
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
  [['回路を保存','保存'],['回路ファイルを書き出す','出力'],['回路ファイルを読む','読込'],['停止して編集へ','停止'],...samples.map((sample,index)=>[sample.name,index?'循環':'比較'])].forEach(([name,label])=>aliases.set(name,label));
  dialog.classList.add('menu-dialog');body.className='menu-grid';
  const entries=items.map(([name,action])=>button(name,action));body.append(...entries);actions.append(button('閉じる',close));
  const layout=()=>{
    if(!dialog.open||dialogLayout!==layout)return;
    const height=Math.max(...entries.map(entry=>entry.getBoundingClientRect().height));
    const rows=Math.max(1,Math.floor((body.clientHeight+6)/(height+5))),columns=Math.max(2,Math.ceil(entries.length/rows));
    body.style.setProperty('--menu-columns',columns);
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
  listPage([...session.pendingScores.entries()],([key,candidate])=>button(`${candidate.challenge} ${displayScore(candidate.score)}点`,()=>{
    if(!session.retryScore(key))throw new Error(session.scoreErrors.get(key));pendingScores();render(false);
  }),'未保存の成績はありません。');actions.append(button('閉じる',close));
}

function offlineStatus() {
  const {ready,update,error,checking}=offline.state;
  body.replaceChildren(element('p',checking?'資材を確認しています。':ready?'オフラインの準備が完了しています。':'オフラインの準備は未完了です。'),element('p','初回準備と更新には通信が必要です。保存回路・成績を外部へ送信しません。'));
  actions.replaceChildren(button('準備・更新を確認',()=>offline.prepare()),button('閉じる',close));
  if(update){body.append(element('p','更新版の準備ができました。適用するまで現在の画面を保持します。'));actions.prepend(button('更新へ',updateDialog));}
  $('dialog-error').textContent=error??'';
  fitDialogForm(()=>{},[...body.querySelectorAll('p')].slice(1),offlineStatus);
}
function offlineDialog(){open('オフラインと更新');offlineStatus();}
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
  updating=true;$('app').inert=true;
  const approvedCircuit=session.circuit;
  const controls=[...dialog.querySelectorAll('button')];controls.forEach(control=>control.disabled=true);
  try{await offline.apply(()=>{
    const current=updateSafety(session);
    return session.circuit===approvedCircuit&&(current.kind==='confirm'||(discard&&current.kind==='circuit'));
  });}
  catch(error){updating=false;$('app').inert=false;controls.forEach(control=>control.disabled=false);throw error;}
}

function settings() {
  const id=session.selection;if(!id)return;
  const input=session.circuit,edge=input.edges.find(item=>item.id===id),node=input.nodes.find(item=>item.id===id);
  if(!edge&&!node)return;
  open(`${node?.name??id}の設定`);
  const items=[];
  items.push(['名前・識別子の全文',()=>fullText('対象の名前',`${node?.name??id}\n${id}`,settings)]);
  if(edge||node.kind!=='goal')items.push(['時間',()=>timeInput(id,edge?.time??node.process)]);
  if(session.mode==='free'&&edge)items.push([edge.bidirectional?'向き：両方向':'向き：片方向',()=>{
    session.requireEditable();open('道の向き');
    listPage([
      [`${edge.from} → ${edge.to}`,{bidirectional:false}],
      [`${edge.to} → ${edge.from}`,{bidirectional:false,reverse:true}],
      [`${edge.from} ↔ ${edge.to}`,{bidirectional:true}],
    ],([name,direction])=>button(name,()=>{session.setDirection(id,direction);close();}));actions.append(button('取消',close));
  }]);
  if(session.mode==='free'&&(edge||node.kind==='prism'))items.push([`使用：${(edge??node).enabled===false?'不可':'可'}`,()=>{session.setEnabled(id,(edge??node).enabled===false);close();}]);
  if(node&&session.mode==='free')items.push(['名前',()=>{
    session.requireEditable();open('点の名前');const field=element('input','',{type:'text',value:node.name??node.id,'aria-label':'点の名前'});body.append(field);
    actions.append(button('確定',()=>{const next=structuredClone(session.circuit);next.nodes.find(n=>n.id===id).name=field.value;session.commitEdit(next);close();}),button('取消',close));
  }]);
  if(edge||node.kind!=='source')items.push(['削除',()=>{
    session.requireEditable();const related=node?input.edges.filter(path=>path.from===id||path.to===id):[edge];
    open(`${id}を削除`);body.append(element('p',node?`この点と、接続する${related.length}本の道を削除します。`:'選んだ道だけを削除します。'));
    listPage(related,path=>element('p',`${path.id}：${path.from} → ${path.to}`),'接続する道はありません。');
    actions.append(button('削除',()=>{session.remove(id,true);close();}),button('取消',close));
    fitDialogForm();
  }]);
  listPage(items,item=>button(item[0],item[1]));actions.append(button('記録',()=>{close();showRecords();}),button('閉じる',close));
}
function fullText(title,text,back=close){
  open(title);const chunks=Array.from(String(text));const parts=[];
  for(let start=0;start<chunks.length;start+=18)parts.push(chunks.slice(start,start+18).join(''));
  listPage(parts,part=>element('p',part,{class:'detail-value'}),'名前は空欄です。');actions.append(button('戻る',back));
}
function objects(){
  open('点と道の一覧');
  listPage([...session.circuit.nodes,...session.circuit.edges],item=>button(`${item.name??item.id}${item.from?'：'+item.from+' → '+item.to:''}`,()=>{session.selection=item.id;board.render();settings();}));
  actions.append(button('回路名の全文',()=>fullText('回路名',session.name,objects)),button('閉じる',close));
}
function timeInput(id,initial) {
  const editing=session.mode==='free'&&session.editable;
  open(`${id}の時間`);
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
  fitDialogForm(compact=>{$('dialog-title').textContent=`${id}の時間${compact?'（秒）':''}`;});
}
function flow() {
  session.requireEditable();open('自由の流れ方');
  const mode=element('select','',{'aria-label':'流れ方'});
  mode.append(element('option','最速経路',{value:'fastest'}),element('option','分かれて広がる',{value:'spread'}));mode.value=session.circuit.mode;
  const target=element('select','',{'aria-label':'送信先'});target.append(element('option','全祭壇へ',{value:'all'}));
  for(const node of session.circuit.nodes.filter(node=>node.kind==='goal'))target.append(element('option',node.name??node.id,{value:node.id}));
  target.value=session.circuit.target??'all';
  const fields=element('div','',{class:'flow-fields'}),modeField=element('div','',{class:'flow-field'}),targetField=element('div','',{class:'flow-field'});
  modeField.append(element('label','流れ方'),mode);targetField.append(element('label','最速の送信先'),target);fields.append(modeField,targetField);body.append(fields);
  actions.append(button('確定',()=>{session.setFlow(mode.value,target.value);close();}),button('取消',close));
  fitDialogForm(compact=>fields.classList.toggle('columns',compact));
}

const recordNames={send:'送出',travel:'移動',arrival:'到着',branch:'分岐',goal:'チャイム',deadend:'行き止まり',unreachable:'到達不能','process-start':'処理開始','process-end':'処理終了'};
function showRecords(){session.openRecords();session.view.recordsOpen=true;chime.stop();clockAnchor=null;render(false);requestAnimationFrame(resizeRecords);}
function resizeRecords(){
  document.body.classList.remove('records-fullscreen');
  orientation.syncRegions();
  const minimum=parseFloat(getComputedStyle($('record-list')).fontSize)*1.4+8;
  const empty=$('record-list').querySelector('p');
  if($('record-list').getBoundingClientRect().height<Math.max(minimum,empty?.getBoundingClientRect().height??0)||$('stage').getBoundingClientRect().height<70)document.body.classList.add('records-fullscreen');
  orientation.syncRegions();
  const list=$('record-list'),space=list.getBoundingClientRect().height,probe=button('0s #0 到着',()=>{},{class:'record-row'});
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
    list.append(button(cases?`${item.id} 不可：${item.reachable?item.time+'秒':'到達不能'}`:`${item.time}s #${item.particle??'—'} ${recordNames[item.type]}`,()=>cases?caseDetails(item):recordDetails(item),{class:'record-row'}));
  }
  $('record-prev').disabled=page===0;$('record-next').disabled=page===pages-1;$('record-page').textContent=`${page+1}/${pages}・全${items.length}件`;
}
function moveRecordPage(step){
  const field=session.view.recordTab==='cases'?'casePage':'recordPage';
  session.view[`${field}Anchor`]=Math.max(0,(session.view[field]+step)*recordCapacity);renderRecords();
}
function particleRecords(id,back=close){
  open(`光線 #${id}の記録`);
  const records=(session.run?.records??[]).filter(item=>item.particle===id);
  listPage(records,item=>button(`${item.time}s ${recordNames[item.type]} ${item.node??''}`,()=>recordDetails(item,()=>particleRecords(id,back))),'この光線の記録はありません。');
  actions.append(button('戻る',back));
}
function recordDetails(record,back=close){
  open('記録の詳細');
  const names={type:'出来事',time:'時刻',particle:'光線番号',parent:'親の光線',node:'地点',target:'対象祭壇',edge:'道',from:'出発地点',to:'次の地点',plannedTime:'最短経路の予定時間',arrivalTime:'到着予定',hops:'通った道の本数',children:'分岐後の光線',arrivedAt:'到着時刻',wait:'待ち時間',finishTime:'処理終了予定',startedAt:'処理開始時刻',processing:'処理時間',reason:'理由'};
  const fields=Object.entries(record).flatMap(([key,value])=>(Array.isArray(value)?value:[value]).map(item=>({key,label:names[key]??key,value:key==='type'?recordNames[item]:item??'—'})));
  listPage(fields,({key,label,value})=>button(`${label}：${value}`,()=>['particle','parent','children'].includes(key)&&Number.isSafeInteger(value)&&value>0?particleRecords(value,()=>recordDetails(record,back)):fullText(label,value,()=>recordDetails(record,back))));actions.append(button('戻る',back));
}
function caseDetails(item){
  open(`${item.id} 使用不可`);body.append(element('p',item.reachable?`${item.time}秒・${item.edges.join(' → ')}`:'この故障では祭壇に届きません。'));
  actions.append(button('このケースで流す',()=>{session.stop();close();startRun({caseId:item.id});}),button('戻る',close));
}

function interruptRun(reason){session.pause(reason);endWait.interrupt(session.run);chime.stop();clockAnchor=null;}
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
function startRun(options){
  load.begin();
  try{load.measure('calculation',()=>session.start(options));session.view.recordPageAnchor=0;load.measure('display',startClock);finishLoad();}
  catch(error){load.current=null;throw error;}
}
function play(){
  if(session.editable){startRun();}
  else if(session.run.status==='running'){session.pause();chime.stop();clockAnchor=null;render(false);}
  else{session.resume();startClock();}
}
function stopRun(){session.stop();chime.stop();clockAnchor=null;message='';render();}
function reactions(entries){
  const goals=entries.filter(entry=>entry.type==='goal');
  const relays=entries.filter(entry=>entry.type==='arrival'&&session.run.circuit.nodes.get(entry.node)?.kind==='prism');
  if(goals.length||relays.length)load.measure('audio',()=>{for(const _entry of goals)chime.strike();for(const _entry of relays)chime.relay();});
  if(!goals.length)return;
  load.measure('display',()=>{
    board.arrivals(goals);
    for(const entry of goals){
      const target=$('board').querySelector(`[data-node="${CSS.escape(entry.node)}"]`);target?.classList.add('arrived');
      setTimeout(()=>target?.classList.remove('arrived'),1300);
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
      reactions(entries);load.measure('display',()=>render(false,{records:false}));
      if(!$('records-panel').hidden)load.measure('records',renderRecords);
      finishLoad();
    }catch(error){load.current=null;interruptRun('error');notify(error.message);}
  }
  if(!document.hidden&&endWait.ready(session.run,now))attempt(stopRun);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
$('home').addEventListener('click',()=>attempt(chooseMode));$('menu').addEventListener('click',()=>attempt(menu));
$('condition-info').addEventListener('click',()=>fullText('現在の条件',`${$('title').textContent}\n${$('condition').textContent}`));
$('result-info').addEventListener('click',()=>fullText('実行状況',$('result').textContent));
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
$('sound').addEventListener('click',()=>attempt(async()=>{if(chime.muted){await chime.enable();chime.tap();}else chime.mute();render(false);}));
$('update-notice').addEventListener('click',()=>attempt(updateDialog));
$('clear-dismiss').addEventListener('click',dismissClear);
$('clear-again').addEventListener('click',()=>attempt(()=>clearAction()));
$('clear-next').addEventListener('click',()=>attempt(()=>clearAction(true)));
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
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!dialog.open&&session.view.recordsOpen){event.preventDefault();$('close-records').click();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){session.pause('hidden');chime.stop();clockAnchor=null;render(false);}});
document.addEventListener('contextmenu',event=>{if(!event.target.closest('input,textarea,select,[contenteditable="true"]'))event.preventDefault();});
function viewport(){
  const visual=window.visualViewport;
  // Mobile browsers can temporarily fit overflowing content by zooming out.
  // Reading that enlarged CSS viewport back into the layout preserves the error.
  const width=visual?visual.width*visual.scale:innerWidth,height=visual?visual.height*visual.scale:innerHeight;
  orientation.update({width,height,type:screen.orientation?.type,angle:screen.orientation?.angle,legacyAngle:window.orientation,coarse:matchMedia('(pointer:coarse)').matches,editing:document.activeElement?.matches('input,textarea')});
  const state={direction:screen.orientation?.type??null,angle:screen.orientation?.angle??window.orientation??null,frame:orientation.rotation,width,height,scale:visual?.scale??1};
  const previous=viewport.history?.at(-1);if(JSON.stringify(previous)!==JSON.stringify(state)){viewport.history??=[];viewport.history.push(state);if(viewport.history.length>8)viewport.history.shift();}
  board.resize();render(false);if(session.view.recordsOpen)requestAnimationFrame(resizeRecords);
}
document.querySelector('.app-version').addEventListener('click',()=>{
  fullText('表示情報',`検証 v${offline.version}\n${[...viewport.history].reverse().map(s=>`画面 ${s.width.toFixed(1)} × ${s.height.toFixed(1)} / 倍率 ${s.scale.toFixed(3)}\n向き ${s.direction??'不明'} / 端末 ${s.angle??'不明'}° / 配置 ${s.frame}°`).join('\n\n')}`);
});
window.visualViewport?.addEventListener('resize',viewport);window.addEventListener('resize',viewport);screen.orientation?.addEventListener('change',viewport);window.addEventListener('orientationchange',viewport);viewport();render();maybeGuide();
if(offline.enabled)offline.prepare();

// Local inspection for performance verification; never stores or uploads data.
export function inspectPerformance(){return {...load.snapshot(),run:session.run?{status:session.run.status,pauseReason:session.run.pauseReason,clock:session.run.format(),...runCounts()}:null,audioVoices:chime.voices.size};}
