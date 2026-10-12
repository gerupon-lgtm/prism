// Binary heap shared by event scheduling and shortest-path work. No dependencies.
export class Heap {
  constructor(compare) { this.items = []; this.compare = compare; }
  get size() { return this.items.length; }
  peek() { return this.items[0]; }
  push(item) {
    this.items.push(item);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.compare(this.items[parent], item) <= 0) break;
      this.items[i] = this.items[parent];
      i = parent;
    }
    this.items[i] = item;
  }
  pop() {
    if (!this.size) return undefined;
    const first = this.items[0];
    const last = this.items.pop();
    if (!this.size) return first;
    let i = 0;
    while (i * 2 + 1 < this.size) {
      let child = i * 2 + 1;
      if (child + 1 < this.size && this.compare(this.items[child + 1], this.items[child]) < 0) child++;
      if (this.compare(last, this.items[child]) <= 0) break;
      this.items[i] = this.items[child];
      i = child;
    }
    this.items[i] = last;
    return first;
  }
}

export const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
