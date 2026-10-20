import { SONGS } from './songs.js';

const notes = score => score.split(' ').map(token => {
  const [pitch, beats] = token.split('/');
  return { pitch, beats: Number(beats) };
});

// The first steps teach the physical key before asking for rhythm. The timed
// steps then add one challenge at a time, followed by short, familiar songs.
export const FOUNDATION_LESSONS = [
  {
    id: 'lesson-middle-c', title: 'Find Middle C', difficulty: 1, bpm: 40,
    kind: 'lesson', untimed: true, phase: 'Find a note',
    composer: 'Lesson 1 · one key',
    instruction: 'Find C4 on the piano. It is the white key labeled A on your laptop. Press A whenever you are ready.',
    notes: notes('C4/1')
  },
  {
    id: 'lesson-c-d-e', title: 'Meet C, D and E', difficulty: 1, bpm: 40,
    kind: 'lesson', untimed: true, phase: 'Find the notes',
    composer: 'Lesson 2 · three keys',
    instruction: 'Move one white key to the right each time: C4 is A, D4 is S, and E4 is D. There is no timer yet.',
    notes: notes('C4/1 D4/1 E4/1 E4/1 D4/1 C4/1')
  },
  {
    id: 'lesson-five-whites', title: 'Five White Keys', difficulty: 1, bpm: 40,
    kind: 'lesson', untimed: true, phase: 'Find the notes',
    composer: 'Lesson 3 · piano geography',
    instruction: 'Walk from C4 to G4 and back. The laptop keys A S D F G follow the white piano keys from left to right.',
    notes: notes('C4/1 D4/1 E4/1 F4/1 G4/1 F4/1 E4/1 D4/1 C4/1')
  },
  {
    id: 'lesson-black-keys', title: 'Meet the Black Keys', difficulty: 1, bpm: 40,
    kind: 'lesson', untimed: true, phase: 'Find the notes',
    composer: 'Lesson 4 · sharps',
    instruction: 'The black key between C and D is C♯ (W). Between D and E is D♯ (E). Play the highlighted keys at your pace.',
    notes: notes('C4/1 C#4/1 D4/1 D#4/1 E4/1 D#4/1 C#4/1 C4/1')
  },
  {
    id: 'lesson-c-on-beat', title: 'C on the Beat', difficulty: 1, bpm: 40,
    kind: 'lesson', phase: 'First timed notes',
    composer: 'Lesson 5 · 40 BPM',
    instruction: 'Watch the countdown. Press A as each C4 bar reaches the line. A missed note waits until you play it.',
    notes: notes('C4/1 C4/1 C4/1 C4/1')
  },
  {
    id: 'lesson-two-note-beat', title: 'Two Notes on the Beat', difficulty: 1, bpm: 48,
    kind: 'lesson', phase: 'Timed notes',
    composer: 'Lesson 6 · 48 BPM',
    instruction: 'Alternate C4 (A) and D4 (S) on the beat. Watch the next-note timer and the falling bars.',
    notes: notes('C4/1 D4/1 C4/1 D4/1 C4/1 D4/1 C4/2')
  },
  {
    id: 'lesson-five-note-beat', title: 'Five Notes on the Beat', difficulty: 1, bpm: 56,
    kind: 'lesson', phase: 'Timed notes',
    composer: 'Lesson 7 · 56 BPM',
    instruction: 'Play A S D F G in time, then walk back. You are ready for slow songs after this step.',
    notes: notes('C4/1 D4/1 E4/1 F4/1 G4/1 F4/1 E4/1 D4/1 C4/2')
  }
];

const studyBpm = { 1: 64, 2: 76, 3: 88, 4: 100 };
export const SLOW_SONGS = SONGS.map(song => ({
  ...song,
  bpm: studyBpm[song.difficulty],
  phase: 'Slow song',
  instruction: `Play this short song at ${studyBpm[song.difficulty]} BPM. Missed notes wait for the correct key, so you can learn each phrase.`
})).sort((a,b) => a.difficulty - b.difficulty || a.bpm - b.bpm || a.title.localeCompare(b.title));

export const LEARNING_STEPS = [...FOUNDATION_LESSONS, ...SLOW_SONGS];
export const MASTERY_ACCURACY = 80;

export function nextLearningStep(progress) {
  return LEARNING_STEPS.find(step => {
    const record = step.kind === 'lesson' ? progress?.lessons?.[step.id] : progress?.songs?.[step.id];
    return (record?.best || 0) < MASTERY_ACCURACY;
  }) || LEARNING_STEPS[0];
}
