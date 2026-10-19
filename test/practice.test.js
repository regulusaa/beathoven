import test from 'node:test';
import assert from 'node:assert/strict';
import { SONGS } from '../src/songs.js';
import { keyboardMidi, keyForMidi, keyPosition, nameMidi } from '../src/music.js';
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
  const keys = ['a','s','d','f','g','h','j','k','l'];
  const positions = keys.map(key => keyPosition(keyboardMidi(key)));
  assert.deepEqual(positions, [...positions].sort((a,b) => a-b));
  assert.equal(keyboardMidi('w'), keyboardMidi('a') + 1);
  assert.equal(keyboardMidi('a', 1), keyboardMidi('a') + 12);
  assert.equal(keyForMidi(72, 1), 'a');
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
