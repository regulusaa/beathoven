import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FULL_SCORES } from '../src/full-scores.js';
import { SONGS } from '../src/songs.js';
import { parseMidi, adaptMidiForLaptop } from '../src/midi.js';
import { buildTimeline, PracticeSession } from '../src/practice.js';
import { keyForMidi, wideKeyPosition } from '../src/music.js';

test('every bundled full score loads, parses, and adapts to playable laptop notes', () => {
  assert.ok(FULL_SCORES.length >= 20);
  assert.ok(FULL_SCORES.length + SONGS.length >= 45);
  for (const song of FULL_SCORES) {
    const path = fileURLToPath(new URL(`../${song.midiUrl.slice(2)}`,import.meta.url));
    const parsed = parseMidi(readFileSync(path));
    const adapted = adaptMidiForLaptop(parsed);
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

test('the widened key positions preserve piano geometry', () => {
  assert.ok(wideKeyPosition(60) < wideKeyPosition(61));
  assert.ok(wideKeyPosition(61) < wideKeyPosition(62));
  assert.ok(wideKeyPosition(62) < wideKeyPosition(64));
  assert.equal(wideKeyPosition(72,1),wideKeyPosition(60,0));
});
