// Experiment time is exact. Wall-clock time is only used by the presentation.
export function decimal(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('時間は有限の数値で入力してください。');
    const [mantissa, exponent = '0'] = String(value).toLowerCase().split('e');
    const [whole, fraction = ''] = mantissa.split('.');
    const digits = whole + fraction;
    const position = whole.length + Number(exponent);
    value = position <= 0 ? `0.${'0'.repeat(-position)}${digits}`
      : position >= digits.length ? digits + '0'.repeat(position - digits.length)
        : `${digits.slice(0, position)}.${digits.slice(position)}`;
  }
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value.trim())) {
    throw new Error('時間は0以上の十進数で入力してください。');
  }
  const [whole, fraction = ''] = value.trim().split('.');
  return { whole: BigInt(whole), fraction: fraction.replace(/0+$/, '') };
}

export class TimeScale {
  constructor(values) {
    this.digits = 1;
    for (const value of values) this.digits = Math.max(this.digits, decimal(value).fraction.length);
    this.unit = 10n ** BigInt(this.digits);
  }
  ticks(value) {
    const { whole, fraction } = decimal(value);
    if (fraction.length > this.digits) throw new Error('実行条件より細かい時間単位です。');
    return whole * this.unit + BigInt(fraction.padEnd(this.digits, '0'));
  }
  format(ticks) {
    const sign = ticks < 0n ? '-' : '';
    const positive = ticks < 0n ? -ticks : ticks;
    const fraction = (positive % this.unit).toString().padStart(this.digits, '0').replace(/0+$/, '');
    return `${sign}${positive / this.unit}${fraction ? `.${fraction}` : ''}`;
  }
  seconds(ticks) { return Number(this.format(ticks)); }
}
