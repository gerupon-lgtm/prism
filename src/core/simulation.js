import { createCircuit, shortestPath } from './circuit.js';
import { Heap, compare } from './heap.js';
import {nextGateOpen} from './periodic.js';

const activeStates = new Set(['moving', 'waiting', 'processing']);
const eventOrder = {finish:0,opening:1,arrival:2};

export class Simulation {
  constructor(input) {
    this.circuit = createCircuit(input);
    this.clock = 0n;
    this.status = 'running';
    this.pauseReason = null;
    this.records = [];
    this.particles = new Map();
    this.nextId = 1;
    this.intervalChecks = new Map();
    this.gates = new Map([...this.circuit.nodes.keys()].map(id => [id, { current: null, queue: [], head: 0, opening:null }]));
    // Finish, opening, arrival at equal time; particle/node IDs break ties.
    this.events = new Heap((a, b) => compare(a.at, b.at) || compare(eventOrder[a.kind],eventOrder[b.kind]) || compare(a.particle??0,b.particle??0) || compare(a.node??'',b.node??''));
    if (this.circuit.raw.mode === 'spread') {
      const particle = this.newParticle(this.circuit.source, null, null);
      this.record('send', particle);
      this.forward(particle);
    } else {
      const goals = this.circuit.raw.target === 'all' ? this.circuit.goals : [this.circuit.raw.target ?? this.circuit.goals[0]].filter(Boolean);
      for (const goal of goals) {
        const particle = this.newParticle(this.circuit.source, null, goal);
        particle.route = shortestPath(this.circuit, goal);
        particle.routeIndex = 0;
        this.record('send', particle, { plannedTime: particle.route ? this.format(particle.route.time) : null });
        if (particle.route) this.forward(particle);
        else { particle.status = 'unreachable'; this.record('unreachable', particle); }
      }
      if (!goals.length) this.record('unreachable', null, { reason: '祭壇がありません。' });
    }
    if (!this.events.size) this.status = 'paused';
  }

  get exhausted() { return !this.events.size; }
  get activeCount() { let count = 0; for (const p of this.particles.values()) if (activeStates.has(p.status)) count++; return count; }
  format(ticks = this.clock) { return this.circuit.time.format(ticks); }
  record(type, particle, data = {}) {
    const entry = { type, time: this.format(), particle: particle?.id ?? null, parent: particle?.parent ?? null, node: particle?.node ?? null, target: particle?.target ?? null, ...data };
    this.records.push(entry);
    return entry;
  }
  arrivals(goal) { return this.records.filter(r => r.type === 'goal' && (goal === undefined || r.node === goal)); }

  newParticle(node, parent, target) {
    const particle = { id: this.nextId++, parent, target, node, incoming: null, status: 'ready', hops: 0 };
    this.particles.set(particle.id, particle);
    return particle;
  }
  choices(particle) {
    if (this.circuit.raw.mode === 'fastest') {
      const id = particle.route?.edges[particle.routeIndex];
      return this.circuit.outgoing.get(particle.node).filter(choice => choice.edge.id === id);
    }
    return this.circuit.outgoing.get(particle.node).filter(choice => choice.edge.id !== particle.incoming);
  }
  forward(particle) {
    const choices = this.choices(particle);
    if (!choices.length) {
      particle.status = 'deadend';
      this.record('deadend', particle);
      return;
    }
    let children;
    if (choices.length > 1) {
      particle.status = 'branched';
      children = choices.map(() => {
        const child = this.newParticle(particle.node, particle.id, particle.target);
        child.hops = particle.hops;
        return child;
      });
      this.record('branch', particle, { children: children.map(child => child.id) });
    } else children = [particle];
    choices.forEach((choice, i) => {
      const child = children[i];
      child.status = 'moving';
      child.from = particle.node;
      child.to = choice.to;
      child.edge = choice.edge.id;
      child.departed = this.clock;
      child.due = this.clock + choice.edge.travel;
      child.hops++;
      if (this.circuit.raw.mode === 'fastest') child.routeIndex++;
      this.record('travel', child, { edge: child.edge, from: child.from, to: child.to, arrivalTime: this.format(child.due) });
      this.events.push({ at: child.due, kind: 'arrival', particle: child.id });
    });
  }

  arrive(particle) {
    particle.node = particle.to;
    particle.incoming = particle.edge;
    particle.arrived = this.clock;
    this.record('arrival', particle, { edge: particle.edge });
    if (this.circuit.nodes.get(particle.node).kind === 'goal') {
      particle.status = 'goal';
      this.record('goal', particle, { hops: particle.hops });
      return;
    }
    particle.status = 'waiting';
    const gate = this.gates.get(particle.node);
    gate.queue.push(particle.id);
    this.startProcessing(particle.node);
  }

  startProcessing(node) {
    const gate = this.gates.get(node);
    if (gate.current !== null || gate.head >= gate.queue.length) return;
    const schedule=this.circuit.nodes.get(node).gate;
    if(schedule) {
      const at=nextGateOpen(schedule,this.circuit.time,this.clock);
      if(at>this.clock) {
        if(gate.opening!==at){gate.opening=at;this.events.push({at,kind:'opening',node});}
        return;
      }
    }
    const particle = this.particles.get(gate.queue[gate.head++]);
    if (gate.head === gate.queue.length) { gate.queue = []; gate.head = 0; }
    else if (gate.head > 1024 && gate.head * 2 > gate.queue.length) {
      gate.queue = gate.queue.slice(gate.head);
      gate.head = 0;
    }
    gate.current = particle.id;
    particle.status = 'processing';
    particle.started = this.clock;
    particle.due = this.clock + this.circuit.nodes.get(node).processing;
    this.record('process-start', particle, { arrivedAt: this.format(particle.arrived), wait: this.format(this.clock - particle.arrived), finishTime: this.format(particle.due) });
    this.events.push({ at: particle.due, kind: 'finish', particle: particle.id });
  }
  finish(particle) {
    const node = particle.node;
    this.record('process-end', particle, { startedAt: this.format(particle.started), processing: this.format(this.clock - particle.started) });
    this.gates.get(node).current = null;
    this.forward(particle);
    this.startProcessing(node);
  }

  pause(reason = null) { if (this.status !== 'stopped') { this.status = 'paused'; this.pauseReason = reason; } }
  resume() { if (this.status !== 'stopped') { this.status = 'running'; this.pauseReason = null; } }
  complete() {
    if (this.status === 'stopped') return;
    // Completion keeps arrived particles and every record for the final picture.
    for (const particle of this.particles.values()) if (activeStates.has(particle.status)) particle.status = 'ended';
    this.events.items = [];
    for (const gate of this.gates.values()) { gate.current = null; gate.queue = []; gate.head = 0; gate.opening = null; }
    this.status = 'paused';
    this.pauseReason = null;
  }
  stop() {
    if (this.status === 'stopped') return;
    for (const check of this.intervalChecks.values()) check.result = this.calculateInterval(check.goal,check.interval,check.count);
    this.status = 'stopped';
    this.pauseReason = null;
    // Conditions and records remain; running and dead-end pictures disappear.
    this.particles.clear();
    this.events.items = [];
    for (const gate of this.gates.values()) { gate.current = null; gate.queue = []; gate.head = 0; gate.opening = null; }
  }
  get nextTime() { return this.events.peek()?.at ?? null; }
  advanceNext({ shouldPause = () => false } = {}) {
    if (this.status === 'stopped' || !this.events.size) { this.pause(); return []; }
    const start = this.records.length;
    const at = this.events.peek().at;
    while (this.events.size && this.events.peek().at === at) {
      if (shouldPause(this)) { this.pause('load'); return this.records.slice(start); }
      const event = this.events.pop();
      this.clock = event.at;
      if(event.kind==='opening') {
        const gate=this.gates.get(event.node);
        if(gate.opening===event.at){gate.opening=null;this.startProcessing(event.node);}
      } else {
        const particle = this.particles.get(event.particle);
        if (event.kind === 'arrival') this.arrive(particle);
        else this.finish(particle);
      }
    }
    this.pause();
    return this.records.slice(start);
  }
  advanceUntil(seconds, options = {}) {
    const until = this.circuit.time.ticks(seconds);
    if (until < this.clock) throw new Error('実験の時計を巻き戻すことはできません。');
    if (this.status === 'stopped') return [];
    const start = this.records.length;
    while (this.events.size && this.events.peek().at <= until) {
      this.advanceNext(options);
      if (this.pauseReason === 'load') return this.records.slice(start);
    }
    this.clock = until;
    this.pause();
    return this.records.slice(start);
  }

  // Finite directed state graph: node + incoming edge. Goal nodes are terminal.
  hasFutureArrival(goal) {
    if (!this.circuit.goals.includes(goal)) throw new Error('祭壇が存在しません。');
    for (const particle of this.particles.values()) {
      if (!activeStates.has(particle.status)) continue;
      if (this.circuit.raw.mode === 'fastest') {
        if (particle.target === goal) return true;
        continue;
      }
      const todo = [{ node: particle.status === 'moving' ? particle.to : particle.node, incoming: particle.status === 'moving' ? particle.edge : particle.incoming }];
      const seen = new Map();
      while (todo.length) {
        const state = todo.pop();
        if (state.node === goal) return true;
        if (this.circuit.nodes.get(state.node).kind === 'goal') continue;
        let incoming = seen.get(state.node);
        if (!incoming) { incoming = new Set(); seen.set(state.node, incoming); }
        if (incoming.has(state.incoming)) continue;
        incoming.add(state.incoming);
        for (const choice of this.circuit.outgoing.get(state.node)) if (choice.edge.id !== state.incoming) todo.push({ node: choice.to, incoming: choice.edge.id });
      }
    }
    return false;
  }

  intervalResult(goal, interval, count) {
    const key = JSON.stringify([goal,interval,count]);
    if (this.status === 'stopped') {
      const result = this.intervalChecks.get(key)?.result;
      return result && result.state !== 'pending' ? {...result} : {state:'stopped',first:this.arrivals(goal)[0]?.time ?? null};
    }
    const result = this.calculateInterval(goal,interval,count);
    this.intervalChecks.set(key,{goal,interval,count,result});
    return {...result};
  }
  calculateInterval(goal,interval,count) {
    if (!Number.isSafeInteger(count) || count < 1) throw new Error('到着回数は1以上の整数です。');
    const gap = this.circuit.time.ticks(interval);
    if (gap <= 0n) throw new Error('指定間隔は0より大きい値です。');
    const arrivals = this.arrivals(goal);
    const times = arrivals.map(event => this.circuit.time.ticks(event.time));
    if (times.length > count || times.some((at, i) => i > 0 && at - times[i - 1] !== gap)) return { state: 'failed', first: arrivals[0]?.time ?? null };
    if (this.hasFutureArrival(goal)) return { state: times.length === count ? 'failed' : 'pending', first: arrivals[0]?.time ?? null };
    return { state: times.length === count ? 'achieved' : 'failed', first: arrivals[0]?.time ?? null };
  }
}
