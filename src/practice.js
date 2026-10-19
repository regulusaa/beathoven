import { nameMidi } from './music.js';

export function buildTimeline(song, speed = 1, octave = 0) {
  if (!(speed > 0)) throw new Error('Speed must be positive');
  let time = 0;
  const secondsPerBeat = 60 / (song.bpm * speed);
  return song.notes.map((note, index) => {
    const duration = note.beats * secondsPerBeat;
    const event = { index, midi: note.pitch ? nameMidi(note.pitch) + octave * 12 : null, start: time, duration, state: 'pending' };
    time += duration;
    return event;
  });
}

export class PracticeSession {
  constructor(song, mode = 'free', speed = 1, octave = 0) {
    this.song = song;
    this.mode = mode;
    this.events = buildTimeline(song, speed, octave);
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
    this.checkFinished();
  }

  press(midi) {
    if (this.finished) return 'none';
    if (this.mode === 'learning') {
      const target = this.target;
      if (!target || this.elapsed < target.start - .25) return 'early';
      if (midi !== target.midi) {
        this.errors++;
        this.waiting = target.index;
        this.elapsed = target.start;
        return 'wrong';
      }
      target.state = 'hit';
      if (this.waiting !== null) {
        this.elapsed = target.start;
        this.waiting = null;
      }
      this.checkFinished();
      return 'hit';
    }
    const candidates = this.events.filter(event => event.midi === midi && event.state === 'pending' && this.elapsed >= event.start - .25 && this.elapsed <= event.start + 1);
    if (!candidates.length) return 'wrong';
    candidates.sort((a,b) => Math.abs(a.start - this.elapsed) - Math.abs(b.start - this.elapsed));
    candidates[0].state = 'hit';
    this.checkFinished();
    return 'hit';
  }

  checkFinished() {
    const end = this.events.at(-1)?.start + this.events.at(-1)?.duration || 0;
    if (this.elapsed >= end && this.events.every(event => event.midi === null || event.state !== 'pending')) {
      this.finished = true;
      this.playing = false;
    }
  }

  get accuracy() {
    const total = this.events.filter(event => event.midi !== null).length;
    const hits = this.events.filter(event => event.state === 'hit').length;
    if (!total) return 0;
    return this.mode === 'learning' ? Math.round(100 * total / (total + this.errors)) : Math.round(100 * hits / total);
  }

  get hits() { return this.events.filter(event => event.state === 'hit').length; }
  get total() { return this.events.filter(event => event.midi !== null).length; }
}

export function addResult(progress, song, mode, accuracy) {
  const next = structuredClone(progress || { songs: {}, totalPlays: 0 });
  const entry = next.songs[song.id] || { best: 0, plays: 0, last: 0, difficulty: song.difficulty };
  entry.best = Math.max(entry.best, accuracy);
  entry.last = accuracy;
  entry.plays++;
  entry.difficulty = song.difficulty;
  entry.lastMode = mode;
  next.songs[song.id] = entry;
  next.totalPlays++;
  return next;
}

export function rankSummary(progress) {
  const songs = Object.values(progress?.songs || {});
  const points = Math.round(songs.reduce((sum, song) => sum + song.difficulty * song.best, 0));
  const unique = songs.length;
  const tier = points >= 5000 ? 'Virtuoso' : points >= 2500 ? 'Maestro' : points >= 1000 ? 'Performer' : points >= 300 ? 'Apprentice' : 'Beginner';
  return { points, unique, totalPlays: progress?.totalPlays || 0, tier };
}
