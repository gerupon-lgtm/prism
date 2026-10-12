// Display fixture only. No routing, simulation, sound, localStorage, or real circuit saving.
(() => {
  'use strict';
  const app = document.querySelector('.app');
  const content = document.querySelector('#panel-content');
  const params = new URLSearchParams(location.search);
  const allowed = ['play','settings','records','saves','guide','input','save-error','score-error','delete','load-protect','record-detail'];
  const state = {
    view: allowed.includes(params.get('view')) ? params.get('view') : 'play',
    selected: 'A', time: 0.5, nodeTimes:{A:0.5,B:0.5}, setting: 'time', run: 'stopped', recordPage: 0,
    savePage: 0, detailPage: 0, selectedSave: 0, guideStep: 0, returnState: null,
    recordCount: params.has('empty') ? 0 : 40, saveCount: params.has('empty') ? 0 : 10, recordDetail: 0, capacity: 1
  };
  const names = Array.from({length:10},(_,i) => `回路 ${i+1}${params.has('long') ? ' — 二つのプリズムから祭壇へ星の光を導く見本' : ''}`);
  const escape = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const heading = title => `<div class="heading"><h2>${title}</h2></div>`;
  const actions = items => `<div class="actions">${items.map(([name,label,cls='']) => `<button class="${cls}" data-action="${name}">${label}</button>`).join('')}</div>`;
  function setView(view) { state.view = view; render(); if(view==='settings')document.querySelector('[data-action=close-panel]').focus(); }
  function records() {
    return `<div class="paged" data-list="records">${heading('実行記録')}<div class="list-space"></div><div class="pager"><button data-action="prev">前へ</button><span class="position"></span><button data-action="next">次へ</button></div></div>`;
  }
  function saves() {
    return `<div class="paged has-actions" data-list="saves">${heading('保存した回路')}<div class="list-space"></div><div class="pager"><button data-action="prev">前へ</button><span class="position"></span><button data-action="next">次へ</button></div>${actions([['load','読込'],['rename','名前変更'],['delete-save','削除']])}</div>`;
  }
  function render() {
    app.dataset.view = state.view;
    const panel=document.querySelector('.panel');
    const popup=state.view==='settings';
    panel.setAttribute('role',popup?'dialog':'region');
    panel.setAttribute('aria-label',popup?`プリズム ${state.selected} の設定`:'操作欄');
    if(popup)panel.setAttribute('aria-modal','true');else panel.removeAttribute('aria-modal');
    document.querySelector('.stage').inert=popup;
    for(const label of document.querySelectorAll('[data-time]'))label.textContent=`処理 ${state.nodeTimes[label.dataset.time].toFixed(1)} 秒`;
    document.querySelector('#run-state').textContent = {stopped:'停止中', running:'実行中（見本）',paused:'一時停止中'}[state.run];
    document.querySelector('[data-action=run]').textContent = state.run === 'running' ? '一時停止' : state.run === 'paused' ? '再開' : '流す';
    document.querySelector('[data-action=step]').disabled = state.run !== 'paused';
    for (const tab of document.querySelectorAll('[data-tab]')) tab.setAttribute('aria-current', String(state.view === tab.dataset.tab));
    for (const node of document.querySelectorAll('[data-node]')) node.setAttribute('aria-pressed',String(node.dataset.node === state.selected));
    if (state.view === 'play') content.replaceChildren();
    else if (state.view === 'settings') {
      const value = state.setting === 'time' ? `<button data-action="minus" aria-label="0.1秒減らす">−</button><output>${state.time.toFixed(1)}</output><button class="edit-value" data-action="input">手入力</button><button data-action="plus" aria-label="0.1秒増やす">＋</button>` : state.setting === 'direction' ? `<p class="muted">向きは道を選んだ時に設定</p>` : `<button data-action="toggle-use" aria-pressed="true">使用可能</button>`;
      content.innerHTML = `<div class="settings"><div class="heading"><h2>プリズム ${state.selected}</h2><button class="delete danger" data-action="delete">削除</button></div><div class="setting-tabs"><button data-setting="time" aria-pressed="${state.setting==='time'}">時間</button><button data-setting="use" aria-pressed="${state.setting==='use'}">使用状態</button></div><div class="setting-value">${value}</div><p class="muted">処理時間（秒）</p></div>`;
    } else if (state.view === 'records') content.innerHTML = records();
    else if (state.view === 'saves') content.innerHTML = saves();
    else if (state.view === 'input') {
      content.innerHTML = `<form class="form-view entry-view" id="time-form">${heading(`プリズム ${state.selected} の処理時間`)}<label for="time-value">0以上、0.1秒刻み</label><input id="time-value" inputmode="decimal" type="text" autocomplete="off" value="${state.time.toFixed(1)}"><p class="notice" id="input-error" aria-live="polite"> </p>${actions([['confirm-input','確定','primary'],['cancel-input','取消']])}</form>`;
      content.querySelector('[data-action=confirm-input]').type = 'submit';
      content.querySelector('[data-action=cancel-input]').type = 'button';
    } else if (state.view === 'guide') {
      const instructions = ['プリズムから接続先へドラッグして、道をつなぎます。','「流す」で、星の光が届く様子を確かめます。','到着した時刻と、実行記録を確認します。'];
      content.innerHTML = `<div class="guide-view">${heading('別の見本で練習')}<span class="progress">${state.guideStep+1} / 3</span><p>${instructions[state.guideStep]}</p><p class="muted">終わったら元の状態へ戻ります。</p>${actions([[state.guideStep===2?'end-guide':'next-guide',state.guideStep===2?'元へ戻る':'次へ','primary'],['end-guide','スキップ']])}</div>`;
    } else if (state.view === 'save-error') {
      content.innerHTML = `<div class="form-view">${heading('回路を保存')}<label for="save-name">名前</label><input id="save-name" value="回路 11"><p class="notice">保存できませんでした。編集中の回路はそのままです。</p>${actions([['retry-save','再試行'],['export-preview','ファイルに保存']])}</div>`;
    } else if (state.view === 'score-error') {
      content.innerHTML = `<div class="form-view">${heading('今回の点数 95.5 点')}<p>最高点（保存済み） 90.0 点</p><p class="notice">未保存 — 今回の成績を保存できませんでした。</p>${actions([['retry-score','再試行'],['settings','続ける','primary']])}</div>`;
    } else if (state.view === 'delete') {
      content.innerHTML = `<div class="confirm-view">${heading(`プリズム ${state.selected} を削除`)}<p>接続する道2本も削除します。</p><p class="muted">出発点 → ${state.selected}<br>${state.selected} → 祭壇</p>${actions([['settings','取消'],['settings','削除する','danger']])}</div>`;
    } else if (state.view === 'load-protect') {
      content.innerHTML = `<div class="confirm-view">${heading('回路を読み込む')}<p>編集中の回路をどうしますか？</p>${actions([['save-error','保存して入替'],['settings','保存せず入替']])}${actions([['saves','取消']])}</div>`;
    } else if (state.view === 'record-detail') {
      const number = state.recordDetail + 1;
      content.innerHTML = `<div class="paged has-actions" data-list="detail">${heading(`記録 ${number}`)}<div class="list-space"></div><div class="pager"><button data-action="prev">前へ</button><span class="position"></span><button data-action="next">次へ</button></div>${actions([['records','一覧へ戻る']])}</div>`;
    }
    if(state.view==='settings' && state.run!=='stopped') {
      for(const control of content.querySelectorAll('[data-action=minus],[data-action=plus],[data-action=input],[data-action=toggle-use],[data-action=delete]')) control.disabled=true;
    }
    fitList();
  }
  function fitList() {
    const list = content.querySelector('.list-space');
    if (!list) return;
    const isRecord = state.view === 'records';
    const isDetail = state.view === 'record-detail';
    const fields = [['粒',`光 ${state.recordDetail+1}`],['地点','プリズム A'],['到着','1.0 秒'],['処理開始','1.0 秒'],['処理終了','1.5 秒'],['次の道','A → 祭壇']];
    const count = isRecord ? state.recordCount : isDetail ? fields.length : state.saveCount;
    const key = isRecord ? 'recordPage' : isDetail ? 'detailPage' : 'savePage';
    const index = Math.min(state[key],Math.max(0,count-1));
    const available = list.clientHeight;
    list.replaceChildren();
    let shown = 0;
    for (let i=index;i<count;i++) {
      const button = document.createElement(isDetail ? 'div' : 'button');
      button.className='list-row';
      button.dataset.index = String(i);
      if(!isDetail)button.dataset.action = isRecord ? 'record-detail' : 'select-save';
      button.innerHTML = isRecord ? `<span class="row-title">光 ${i+1} / プリズム A 到着</span><time>${(1+i*.1).toFixed(1)} 秒</time>` : isDetail ? `<span class="row-title">${fields[i][0]}</span><span>${fields[i][1]}</span>` : `<span class="row-title">${escape(names[i])}</span>`;
      if (!isRecord && !isDetail) button.setAttribute('aria-pressed',String(i===state.selectedSave));
      list.append(button);
      const first = list.firstElementChild.getBoundingClientRect();
      if (button.getBoundingClientRect().bottom-first.top > available+.5) { button.remove(); break; }
      shown++;
    }
    state.capacity = Math.max(1,shown);
    content.querySelector('.position').textContent = shown ? `${index+1}–${index+shown} / ${count} 件` : `0 / ${count} 件`;
    content.querySelector('[data-action=prev]').disabled = index === 0;
    content.querySelector('[data-action=next]').disabled = index + shown >= count;
    if (!count) {
      list.innerHTML = `<p class="empty">${isRecord?'まだ実行記録はありません。':'保存した回路はまだありません。'}</p>`;
      content.querySelector('[data-action=next]').disabled=true;
      for(const button of content.querySelectorAll('[data-action=load],[data-action=rename],[data-action=delete-save]'))button.disabled=true;
    } else if (!shown) list.innerHTML = '<p class="empty">表示する広さが不足しています</p>';
  }
  function openGuide() {
    state.returnState = {view:state.view, run:state.run, selected:state.selected, time:state.time, recordPage:state.recordPage,savePage:state.savePage};
    if (state.run==='running') state.run='paused';
    state.guideStep=0; setView('guide');
  }
  app.addEventListener('click',event => {
    const button=event.target.closest('button'); if (!button || button.disabled) return;
    if (button.dataset.tab) { if(button.dataset.tab==='records' && state.run==='running') state.run='paused'; setView(button.dataset.tab);return; }
    if (button.dataset.setting) { state.setting=button.dataset.setting;render();return; }
    const action=button.dataset.action;
    if(action==='close-panel') setView('play');
    else if (['settings','records','saves','save-error','delete','record-detail'].includes(action)) { if(action==='record-detail') state.recordDetail=Number(button.dataset.index); setView(action); }
    else if(action==='guide') openGuide();
    else if(action==='next-guide') { state.guideStep++;render(); }
    else if(action==='end-guide') { const saved=state.returnState;if(saved) {Object.assign(state,saved);if(saved.run==='running')state.run='paused';}state.returnState=null;setView(saved?.view || 'settings'); }
    else if(action==='run') {state.run=state.run==='running'?'paused':'running';render();}
    else if(action==='stop') {state.run='stopped';render();}
    else if(action==='step') {state.run='paused';render();}
    else if(action==='plus'||action==='minus') { state.time=Math.max(0,Math.round((state.time+(action==='plus'?.1:-.1))*10)/10);state.nodeTimes[state.selected]=state.time;render();content.querySelector(`[data-action=${action}]`).focus(); }
    else if(action==='input') {setView('input');content.querySelector('input').focus();}
    else if(action==='cancel-input') setView('settings');
    else if(action==='next'||action==='prev') {const key=state.view==='records'?'recordPage':state.view==='record-detail'?'detailPage':'savePage';state[key]=Math.max(0,state[key]+(action==='next'?state.capacity:-state.capacity));if(state.view==='saves')state.selectedSave=state.savePage;fitList();}
    else if(action==='select-save') {state.selectedSave=Number(button.dataset.index);fitList();}
    else if(action==='load') setView('load-protect');
    else if(action==='rename') {content.innerHTML=`<div class="form-view">${heading('回路の名前変更')}<label for="rename-value">名前</label><input id="rename-value" value="${escape(names[state.selectedSave])}">${actions([['finish-rename','変更','primary'],['saves','取消']])}</div>`;}
    else if(action==='finish-rename') {names[state.selectedSave]=content.querySelector('input').value;setView('saves');}
    else if(action==='delete-save') {content.innerHTML=`<div class="confirm-view">${heading('保存回路を削除')}<p>${escape(names[state.selectedSave])}</p>${actions([['saves','取消'],['finish-delete-save','削除する','danger']])}</div>`;}
    else if(action==='finish-delete-save') {names.splice(state.selectedSave,1);state.saveCount--;state.selectedSave=0;state.savePage=0;setView('saves');}
    else if(action==='retry-save'||action==='retry-score') {button.textContent='再試行中';button.disabled=true;}
    else if(action==='export-preview') {button.textContent='書き出しの入口';button.disabled=true;}
  });
  content.addEventListener('focusin',event => {if(event.target instanceof HTMLInputElement)event.target.select();});
  content.addEventListener('submit',event => {
    event.preventDefault(); const field=content.querySelector('#time-value'); if(!field)return;
    const text=field.value.trim(); const value=Number(text);
    if(!/^\d+(?:\.\d)?$/.test(text)||!Number.isFinite(value)||value<0) {content.querySelector('#input-error').textContent='0以上の数を、0.1秒刻みで入力してください。';field.focus();return;}
    state.time=value;state.nodeTimes[state.selected]=value;setView('settings');
  });
  for(const node of document.querySelectorAll('[data-node]')) {
    node.addEventListener('click',()=>{state.selected=node.dataset.node;state.time=state.nodeTimes[state.selected];render();});
    node.addEventListener('dblclick',()=>setView('settings'));
    node.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();state.selected=node.dataset.node;state.time=state.nodeTimes[state.selected];setView('settings');}});
  }
  app.addEventListener('contextmenu',event=>{if(!event.target.closest('input'))event.preventDefault();});
  document.addEventListener('keydown',event=>{
    if(state.view!=='settings')return;
    if(event.key==='Escape'){setView('play');document.querySelector(`[data-node=${state.selected}]`).focus();}
    if(event.key==='Tab'){
      const controls=[...document.querySelector('.panel').querySelectorAll('button,input')].filter(e=>!e.disabled&&e.getClientRects().length);
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  const resize=()=>{app.style.setProperty('--viewport-height',`${Math.round(window.visualViewport?.height||innerHeight)}px`);requestAnimationFrame(fitList);};
  window.visualViewport?.addEventListener('resize',resize);window.addEventListener('resize',resize);
  new ResizeObserver(fitList).observe(content);
  resize();render();
  window.previewState=state;
})();
