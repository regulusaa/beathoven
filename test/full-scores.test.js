import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FULL_SCORES, FREE_SCORES, FREE_SCORE_MIN_DURATION } from '../src/full-scores.js';
import { SONGS } from '../src/songs.js';
import { parseMidi, adaptMidiForLaptop } from '../src/midi.js';
import { buildTimeline, PracticeSession } from '../src/practice.js';
import { keyForMidi, layoutRange } from '../src/music.js';

test('every bundled full score loads, parses, and adapts to playable laptop notes', () => {
  assert.ok(FULL_SCORES.length >= 35);
  assert.ok(FULL_SCORES.length + SONGS.length >= 60);
  assert.ok(FREE_SCORES.length >= 30);
  assert.ok(FREE_SCORES.every(song => song.duration >= FREE_SCORE_MIN_DURATION), 'Free mode contains a short score');
  assert.ok(FREE_SCORES.some(song => song.difficulty === 1), 'Free mode needs a beginner full score');
  for (const song of FULL_SCORES) {
    const path = fileURLToPath(new URL(`../${song.midiUrl.slice(2)}`,import.meta.url));
    const parsed = parseMidi(readFileSync(path));
    const adapted = adaptMidiForLaptop(parsed);
    assert.ok(Math.abs(song.duration - parsed.duration) <= 1, `${song.title} has an incorrect catalog duration`);
    assert.equal(song.bpm, parsed.bpm, `${song.title} has an incorrect catalog BPM`);
    if (FREE_SCORES.includes(song)) assert.ok(parsed.duration >= FREE_SCORE_MIN_DURATION, `${song.title} is too short for Free mode`);
    assert.ok(parsed.notes.length > 0, `${song.title} is empty`);
    assert.ok(adapted.duration >= 20, `${song.title} has a suspiciously short duration`);
    assert.ok(adapted.notes.every(note => keyForMidi(note.midi)), `${song.title} has unreachable notes`);
    assert.ok(adapted.notes.every(note => note.duration > 0), `${song.title} has invalid durations`);
  }
});

test('Moonlight Sonata runs for its full first movement in Free mode', () => {
  const song = FULL_SCORES.find(item => item.id === 'moonlight-first-movement');
  const path = fileURLToPath(new URL(`../${song.midiUrl.slice(2)}`,import.meta.url));
  const adapted = adaptMidiForLaptop(parseMidi(readFileSync(path)));
  song.events = adapted.notes;
  song.learningSeconds = 40;
  const free = new PracticeSession(song,'free');
  const learning = new PracticeSession(song,'learning');
  assert.ok(free.endTime >= 270);
  assert.ok(free.total >= 800);
  assert.ok(learning.endTime < 45);
  assert.ok(learning.total < free.total);
});

test('scores fold into the full range of the chosen keyboard layout', () => {
  const parsed = parseMidi(readFileSync(new URL('../assets/midi/fur-elise.mid',import.meta.url)));
  for (const layout of ['60','75','100']) {
    const { low, high } = layoutRange(layout);
    const adapted = adaptMidiForLaptop(parsed, high);
    assert.ok(adapted.notes.every(note => note.midi >= low && note.midi <= high && keyForMidi(note.midi,0,layout)));
  }
  assert.ok(adaptMidiForLaptop(parsed,91).notes.some(note => note.midi > 79), 'the 100% layout should use its extra keys');
});
