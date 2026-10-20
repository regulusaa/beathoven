import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FOUNDATION_LESSONS, LEARNING_STEPS, MASTERY_ACCURACY, SLOW_SONGS, nextLearningStep } from '../src/curriculum.js';
import { parseMidi, adaptMidiForLaptop } from '../src/midi.js';
import { PracticeSession, addResult, rankSummary } from '../src/practice.js';

test('learning starts with note finding, then timing, then gradually faster short songs', () => {
  assert.equal(LEARNING_STEPS[0].title, 'Find Middle C');
  assert.equal(LEARNING_STEPS[0].notes.length, 1);
  assert.ok(FOUNDATION_LESSONS.slice(0,4).every(step => step.untimed));
  assert.deepEqual(FOUNDATION_LESSONS.slice(4).map(step => step.bpm), [40,48,56]);
  assert.ok(SLOW_SONGS.length >= 25);
  assert.equal(SLOW_SONGS[0].bpm, 64);
  assert.ok(SLOW_SONGS.every(song => song.kind === 'study' && !song.events));
  assert.ok(SLOW_SONGS.every((song,index) => index === 0 || song.bpm >= SLOW_SONGS[index-1].bpm));
  assert.ok(SLOW_SONGS.at(-1).bpm <= 100);
});

test('untimed note lesson waits for the right key and saves completion outside song rankings', () => {
  const first = FOUNDATION_LESSONS[0];
  const session = new PracticeSession(first,'learning');
  session.advance(300);
  assert.equal(session.elapsed,0);
  assert.equal(session.press(62),'wrong');
  assert.equal(session.press(60),'hit');
  assert.equal(session.finished,true);
  const progress = addResult(null,first,'learning',session.accuracy);
  assert.equal(progress.lessons[first.id].plays,1);
  assert.equal(progress.songs[first.id],undefined);
  assert.equal(rankSummary(progress).unique,0);
  assert.equal(MASTERY_ACCURACY,80);
  assert.equal(nextLearningStep(progress).id,first.id);
  const needsPractice = addResult(null,first,'learning',50);
  assert.equal(nextLearningStep(needsPractice).id,first.id);
  const mastered = addResult(progress,first,'learning',100);
  assert.equal(nextLearningStep(mastered).id,FOUNDATION_LESSONS[1].id);
});

test('timed lesson uses its BPM and waits on a missed note', () => {
  const lesson = FOUNDATION_LESSONS[4];
  const session = new PracticeSession(lesson,'learning');
  assert.equal(session.events[1].start,1.5);
  session.advance(1.01);
  assert.equal(session.waiting,0);
  assert.equal(session.press(60),'hit');
  assert.equal(session.waiting,null);
});

test('MIDI tempo metadata survives laptop adaptation for the BPM display', () => {
  const score = parseMidi(readFileSync(new URL('../assets/midi/moonlight-first-movement.mid',import.meta.url)));
  const adapted = adaptMidiForLaptop(score);
  assert.equal(score.bpm,60);
  assert.deepEqual(adapted.bpmRange,[60,60]);
  assert.equal(adapted.bpm,score.bpm);
});
