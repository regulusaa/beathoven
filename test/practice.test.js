import test from 'node:test';
import assert from 'node:assert/strict';
import { SONGS } from '../src/songs.js';
import { keyboardMidi, keyForMidi, keyPosition, nameMidi, isWhite, LAYOUTS, layoutRange } from '../src/music.js';
import { PracticeSession, buildTimeline, addResult, rankSummary } from '../src/practice.js';

const demo = { id:'demo', difficulty: 2, bpm: 60, notes: [{pitch:'C4',beats:1},{pitch:'D4',beats:1}] };

test('all catalog notes have valid durations and playable keys', () => {
  assert.ok(SONGS.length >= 25);
  for (const song of SONGS) {
    assert.ok(song.notes.length);
    for (const note of song.notes) {
      assert.ok(note.beats > 0, `${song.id} has an invalid duration`);
      if (note.pitch) assert.ok(keyForMidi(nameMidi(note.pitch)), `${song.id}: ${note.pitch} is outside the keyboard`);
    }
  }
});

test('spatial mapping increases left to right and follows octave shifts', () => {
  const codes = ['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL','Semicolon','Quote','Enter'];
  const positions = codes.map(code => keyPosition(keyboardMidi(code)));
  assert.deepEqual(positions, [...positions].sort((a,b) => a-b));
  assert.equal(keyboardMidi('KeyW'), keyboardMidi('KeyA') + 1);
  assert.equal(keyboardMidi('KeyA', 1), keyboardMidi('KeyA') + 12);
  assert.equal(keyForMidi(72, 1), 'A');
  assert.equal(keyPosition(72, 1), keyPosition(60));
});

test('each keyboard layout covers every semitone from C4 with no unused piano keys', () => {
  for (const [id, expectedHigh] of [['60',79],['75',81],['100',91]]) {
    const { keys } = LAYOUTS[id];
    const { low, high } = layoutRange(id);
    assert.equal(low, 60);
    assert.equal(high, expectedHigh);
    assert.equal(new Set(keys.map(key => key.code)).size, keys.length, `${id}% repeats a key`);
    assert.deepEqual(keys.map(key => key.midi), Array.from({ length: high - low + 1 }, (_, i) => low + i));
    assert.ok(isWhite(low) && isWhite(high), `${id}% should start and end on white keys`);
    const whites = keys.filter(key => isWhite(key.midi)).map(key => keyPosition(key.midi, 0, id));
    assert.deepEqual(whites, [...whites].sort((a,b) => a-b));
    assert.ok(whites[0] > 0 && whites.at(-1) < 100);
  }
  assert.equal(keyboardMidi('PageUp', 0, '75'), 81);
  assert.equal(keyboardMidi('PageUp', 0, '60'), null);
  assert.equal(keyboardMidi('NumpadAdd', 0, '100'), 91);
  assert.equal(keyForMidi(81, 0, '100'), 'Del');
});

test('free mode misses stay missed and accuracy reflects correct notes', () => {
  const session = new PracticeSession(demo, 'free');
  session.advance(1.01);
  assert.equal(session.events[0].state, 'missed');
  assert.equal(session.press(62), 'hit');
  session.advance(1);
  assert.equal(session.accuracy, 50);
  assert.equal(session.finished, true);
});

test('learning mode rewinds after one second and waits for the correct note', () => {
  const session = new PracticeSession(demo, 'learning');
  session.advance(1.01);
  assert.equal(session.waiting, 0);
  assert.equal(session.elapsed, 0);
  session.advance(5);
  assert.equal(session.elapsed, 0);
  assert.equal(session.press(62), 'wrong');
  assert.equal(session.press(60), 'hit');
  assert.equal(session.waiting, null);
  assert.equal(session.events[0].state, 'hit');
  assert.equal(session.errors, 2);
  assert.equal(session.accuracy, 50);
});

test('timing and ranking use tempo, difficulty, and best accuracy', () => {
  assert.equal(buildTimeline(demo, .5)[1].start, 2);
  const one = addResult(null, demo, 'free', 72);
  const two = addResult(one, demo, 'free', 60);
  assert.equal(two.songs.demo.best, 72);
  assert.equal(two.songs.demo.title, 'demo');
  assert.equal(two.totalPlays, 2);
  assert.deepEqual(rankSummary(two), { points:144, unique:1, totalPlays:2, tier:'Beginner' });
});

const longNotes = { id:'long', difficulty: 2, bpm: 60, notes: [{pitch:'C4',beats:2},{pitch:'D4',beats:2}] };

test('long notes become holds that score by how long they are held', () => {
  const session = new PracticeSession(longNotes, 'free');
  assert.ok(session.events.every(event => event.hold));
  assert.equal(session.press(60), 'hit');
  session.advance(2);
  assert.equal(session.events[0].holdState, 'held');
  assert.equal(session.press(62), 'hit');
  session.advance(.5);
  assert.equal(session.release(62), 'broken');
  assert.equal(session.events[1].heldFraction, .25);
  session.advance(2);
  assert.equal(session.finished, true);
  assert.equal(session.accuracy, Math.round(100 * (1 + .625) / 2));
});

test('short notes and untimed lessons are not holds', () => {
  const quick = new PracticeSession({ ...longNotes, bpm: 240 }, 'free');
  assert.ok(quick.events.every(event => !event.hold));
  assert.ok(new PracticeSession({ ...longNotes, untimed: true }, 'learning').events.every(event => !event.hold));
});

test('the pedal challenge scores pedal cues and sustains released keys', () => {
  const session = new PracticeSession(longNotes, 'free', 1, 0, { pedal: true });
  assert.equal(session.cues.length, 2);
  assert.equal(session.pedal(true), 'hit');
  assert.equal(session.press(60), 'hit');
  session.advance(.5);
  assert.equal(session.release(60), 'pedal');
  session.advance(1.6);
  assert.equal(session.events[0].holdState, 'held');
  assert.equal(session.cues[0].holdState, 'held');
  assert.equal(session.press(62), 'hit');
  session.advance(3);
  assert.equal(session.cues[1].state, 'missed');
  assert.equal(session.finished, true);
  assert.equal(session.accuracy, 75);
  assert.equal(new PracticeSession(longNotes, 'learning', 1, 0, { pedal: true }).cues.length, 0);
});
