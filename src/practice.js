import { nameMidi } from './music.js?v=20261102-layouts';

export const HOLD_SECONDS = .6;
const HOLD_GRACE = .15;
const EARLY = .25;
const LATE = 1;

export function buildTimeline(song, speed = 1, octave = 0, mode = 'free') {
  if (!(speed > 0)) throw new Error('Speed must be positive');
  let events;
  if (song.events) {
    const source = mode === 'learning' ? song.events.filter(note => note.start < (song.learningSeconds || 40)) : song.events;
    events = source.map((note,index) => ({
      index, midi: note.midi + octave * 12, start: note.start / speed,
      duration: note.duration / speed, state: 'pending'
    }));
  } else {
    let time = 0;
    const secondsPerBeat = 60 / (song.bpm * speed);
    events = song.notes.map((note, index) => {
      const duration = note.beats * secondsPerBeat;
      const event = { index, midi: note.pitch ? nameMidi(note.pitch) + octave * 12 : null, start: time, duration, state: 'pending' };
      time += duration;
      return event;
    });
  }
  // A key has to come up before it can sound again, so a note ends before the
  // next onset of the same pitch. Long timed notes become hold notes.
  const nextStart = new Map();
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.midi === null) continue;
    const next = nextStart.get(event.midi);
    if (next !== undefined) event.duration = Math.max(.04, Math.min(event.duration, next - event.start - .05));
    event.hold = !song.untimed && event.duration >= HOLD_SECONDS;
    nextStart.set(event.midi, event.start);
  }
  return events;
}

// Pedal challenge cues: the pedal goes down with each long note and must be
// lifted and pressed again when the next cue begins.
export function buildPedalCues(events) {
  const holds = events.filter(event => event.hold);
  return holds.map((event,index) => {
    const end = Math.min(event.start + event.duration, holds[index + 1]?.start ?? Infinity);
    return { index, start: event.start, duration: end - event.start, state: 'pending', hold: true };
  }).filter(cue => cue.duration >= .2);
}

export class PracticeSession {
  constructor(song, mode = 'free', speed = 1, octave = 0, { pedal = false } = {}) {
    this.song = song;
    this.mode = mode;
    this.events = buildTimeline(song, speed, octave, mode);
    this.pedalChallenge = pedal && mode === 'free';
    this.cues = this.pedalChallenge ? buildPedalCues(this.events) : [];
    this.pedalDown = false;
    this.activeCue = null;
    this.holding = new Map();
    this.endTime = this.events.reduce((end,event) => Math.max(end,event.start + event.duration),0);
    this.elapsed = 0;
    this.waiting = null;
    this.errors = 0;
    this.finished = false;
    this.playing = true;
  }

  get target() {
    return this.events.find(event => event.midi !== null && event.state === 'pending') ?? null;
  }

  advance(delta) {
    if (!this.playing || this.finished || this.waiting !== null) return;
    if (this.mode === 'learning' && this.song.untimed) return;
    this.elapsed += Math.max(0, delta);
    for (const event of this.events) {
      if (event.midi === null || event.state !== 'pending') continue;
      if (this.elapsed > event.start + 1) {
        if (this.mode === 'learning') {
          this.errors++;
          this.waiting = event.index;
          this.elapsed = event.start;
          break;
        }
        event.state = 'missed';
      }
    }
    for (const cue of this.cues) if (cue.state === 'pending' && this.elapsed > cue.start + LATE) cue.state = 'missed';
    for (const event of [...this.holding.values()]) if (this.elapsed >= event.start + event.duration) this.endHold(event);
    if (this.activeCue && this.elapsed >= this.activeCue.start + this.activeCue.duration) this.endHold(this.activeCue);
    this.checkFinished();
  }

  press(midi) {
    if (this.finished) return 'none';
    if (this.mode === 'learning') {
      const target = this.target;
      if (!target || (!this.song.untimed && this.elapsed < target.start - .25)) return 'early';
      if (midi !== target.midi) {
        this.errors++;
        this.waiting = target.index;
        this.elapsed = target.start;
        return 'wrong';
      }
      target.state = 'hit';
      this.startHold(target);
      if (this.song.untimed) {
        this.elapsed = this.target?.start ?? this.endTime;
        this.waiting = null;
      } else if (this.waiting !== null) {
        this.elapsed = target.start;
        this.waiting = null;
      }
      this.checkFinished();
      return 'hit';
    }
    const candidate = this.nearest(this.events.filter(event => event.midi === midi));
    if (!candidate) return 'wrong';
    candidate.state = 'hit';
    this.startHold(candidate);
    this.checkFinished();
    return 'hit';
  }

  nearest(items) {
    const open = items.filter(item => item.state === 'pending' && this.elapsed >= item.start - EARLY && this.elapsed <= item.start + LATE);
    open.sort((a,b) => Math.abs(a.start - this.elapsed) - Math.abs(b.start - this.elapsed));
    return open[0] ?? null;
  }

  startHold(item) {
    if (!item.hold) return;
    item.holdState = 'holding';
    if (item.midi === undefined) this.activeCue = item;
    else {
      const previous = this.holding.get(item.midi);
      if (previous) this.endHold(previous);
      this.holding.set(item.midi, item);
    }
  }

  // Finishing a hold (on time or early) fixes how much of it was held.
  endHold(item) {
    if (item.holdState !== 'holding') return null;
    if (item === this.activeCue) this.activeCue = null;
    else this.holding.delete(item.midi);
    const end = item.start + item.duration;
    const done = this.elapsed >= end - HOLD_GRACE;
    item.heldFraction = done ? 1 : Math.max(0, Math.min(1, (this.elapsed - item.start) / item.duration));
    item.holdState = done ? 'held' : 'broken';
    return item.holdState;
  }

  // Letting go of a key. With the pedal down, the note keeps sounding and its
  // hold continues until the pedal lifts.
  release(midi) {
    const event = this.holding.get(midi);
    if (!event) return null;
    if (this.pedalDown) { event.keyUp = true; return 'pedal'; }
    return this.endHold(event);
  }

  pedal(down) {
    if (!this.pedalChallenge || this.finished || down === this.pedalDown) return null;
    this.pedalDown = down;
    if (down) {
      const cue = this.nearest(this.cues);
      if (!cue) return null;
      cue.state = 'hit';
      this.startHold(cue);
      this.checkFinished();
      return 'hit';
    }
    for (const event of [...this.holding.values()]) if (event.keyUp) this.endHold(event);
    return this.activeCue ? this.endHold(this.activeCue) : null;
  }

  checkFinished() {
    if (this.elapsed >= this.endTime && this.events.every(event => event.midi === null || event.state !== 'pending') && this.cues.every(cue => cue.state !== 'pending')) {
      for (const event of [...this.holding.values()]) this.endHold(event);
      if (this.activeCue) this.endHold(this.activeCue);
      this.finished = true;
      this.playing = false;
    }
  }

  // A hit counts fully; a hold note counts half for the hit and half for how
  // long it was held.
  static credit(item) {
    if (item.state !== 'hit') return 0;
    return item.hold ? .5 + .5 * (item.heldFraction ?? 1) : 1;
  }

  get accuracy() {
    const notes = this.events.filter(event => event.midi !== null);
    if (!notes.length) return 0;
    if (this.mode === 'learning') return Math.round(100 * notes.length / (notes.length + this.errors));
    const items = [...notes, ...this.cues];
    return Math.round(100 * items.reduce((sum,item) => sum + PracticeSession.credit(item),0) / items.length);
  }

  get cueHits() { return this.cues.filter(cue => cue.state === 'hit').length; }

  get hits() { return this.events.filter(event => event.state === 'hit').length; }
  get total() { return this.events.filter(event => event.midi !== null).length; }
}

export function addResult(progress, song, mode, accuracy) {
  const next = structuredClone(progress || { songs: {}, totalPlays: 0 });
  const lesson = song.kind === 'lesson';
  const collection = lesson ? (next.lessons ||= {}) : (next.songs ||= {});
  const entry = collection[song.id] || { best: 0, plays: 0, last: 0, difficulty: song.difficulty };
  entry.best = Math.max(entry.best, accuracy);
  entry.last = accuracy;
  entry.plays++;
  entry.difficulty = song.difficulty;
  entry.title = song.title || entry.title || song.id;
  entry.composer = song.composer || entry.composer || '';
  entry.lastMode = mode;
  entry.lastPlayed = new Date().toISOString();
  collection[song.id] = entry;
  if (!lesson) next.totalPlays++;
  return next;
}

export function rankSummary(progress) {
  const songs = Object.values(progress?.songs || {});
  const points = Math.round(songs.reduce((sum, song) => sum + song.difficulty * song.best, 0));
  const unique = songs.length;
  const tier = points >= 5000 ? 'Virtuoso' : points >= 2500 ? 'Maestro' : points >= 1000 ? 'Performer' : points >= 300 ? 'Apprentice' : 'Beginner';
  return { points, unique, totalPlays: progress?.totalPlays || 0, tier };
}
