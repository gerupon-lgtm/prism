// Updating reloads the page; it must not silently destroy in-memory work.
export function updateSafety(session) {
  if(session.guide)return {kind:'guide',message:'案内を閉じて元の回路へ戻ってから更新できます。'};
  if(!session.editable)return {kind:'running',message:'現在の実行を停止してから更新できます。'};
  if(session.pendingScores.size)return {kind:'scores',message:'未保存の成績があります。保存を再試行してから更新できます。'};
  if(session.mode==='free'&&session.dirty)return {kind:'circuit',message:'現在の回路は未保存です。保存してから更新するか、保存せずに更新するかを選んでください。'};
  return {kind:'confirm',message:'更新すると現在の画面を閉じます。保存した回路・成績・案内履歴は保持します。実行記録が必要なら先に書き出してください。'};
}
