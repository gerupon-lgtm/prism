// Schedules use only exact simulation ticks. The open range includes its start
// and excludes its end, so an arrival at closing waits for the next cycle.
export function gateTimes(gate) {
  if(!gate||typeof gate!=='object'||Array.isArray(gate))throw new Error('周期開閉の条件が不正です。');
  const values=['period','open','phase'].map(key=>gate[key]);
  if(values.some(value=>typeof value!=='string'||!/^\d+(?:\.\d+)?$/.test(value)))throw new Error('周期・開く時間・開始位置を0以上の秒数で指定してください。');
  return values;
}

export function validateGate(gate,scale) {
  const [period,open,phase]=gateTimes(gate).map(value=>scale.ticks(value));
  if(period<=0n||open<=0n||open>period||phase>=period)throw new Error('周期は0秒より長く、開く時間は周期以内、開始位置は周期未満で指定してください。');
  return {period,open,phase};
}

export function gateState(gate,scale,at) {
  const schedule=validateGate(gate,scale);
  if(typeof at!=='bigint'||at<0n)throw new Error('周期の時計は0以上の実験時刻です。');
  const phase=(at+schedule.phase)%schedule.period;
  const open=phase<schedule.open;
  return {open,remaining:(open?schedule.open:schedule.period)-phase,phase};
}

export function nextGateOpen(gate,scale,at) {
  const state=gateState(gate,scale,at);
  return state.open?at:at+state.remaining;
}
