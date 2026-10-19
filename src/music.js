export const WHITE_KEYS = ['a','s','d','f','g','h','j','k','l'];
export const BLACK_KEYS = ['w','e','t','y','u','o','p'];
export const WHITE_MIDI = [60,62,64,65,67,69,71,72,74];
export const BLACK_MIDI = [61,63,66,68,70,73,75];
export const BLACK_AFTER_WHITE = [0,1,3,4,5,7,8];
const NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

export function midiName(midi) {
  return `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export function nameMidi(name) {
  const match = /^([A-G]#?)(-?\d)$/.exec(name);
  if (!match) throw new Error(`Invalid note: ${name}`);
  const index = NAMES.indexOf(match[1]);
  if (index < 0) throw new Error(`Invalid note: ${name}`);
  return (Number(match[2]) + 1) * 12 + index;
}

export function keyboardMidi(key, octave = 0) {
  const lower = key.toLowerCase();
  const white = WHITE_KEYS.indexOf(lower);
  if (white >= 0) return WHITE_MIDI[white] + octave * 12;
  const black = BLACK_KEYS.indexOf(lower);
  if (black >= 0) return BLACK_MIDI[black] + octave * 12;
  return null;
}

export function keyForMidi(midi, octave = 0) {
  const base = midi - octave * 12;
  const white = WHITE_MIDI.indexOf(base);
  if (white >= 0) return WHITE_KEYS[white];
  const black = BLACK_MIDI.indexOf(base);
  return black >= 0 ? BLACK_KEYS[black] : null;
}

export function keyPosition(midi, octave = 0) {
  const base = midi - octave * 12;
  const white = WHITE_MIDI.indexOf(base);
  if (white >= 0) return ((white + .5) / WHITE_KEYS.length) * 100;
  const black = BLACK_MIDI.indexOf(base);
  if (black >= 0) return ((BLACK_AFTER_WHITE[black] + 1) / WHITE_KEYS.length) * 100;
  return null;
}

// Three octaves of correctly spaced piano keys, centered on the laptop map.
export function wideKeyPosition(midi, octave = 0) {
  const base = midi - octave * 12;
  if (base < 48 || base > 83) return null; // C3 through B5
  const whiteClasses = [0,2,4,5,7,9,11];
  const octaveIndex = Math.floor((base - 48) / 12);
  const pitchClass = base % 12;
  const whiteWithinOctave = whiteClasses.indexOf(pitchClass);
  if (whiteWithinOctave >= 0) return (octaveIndex * 7 + whiteWithinOctave + .5) / 21 * 100;
  const precedingWhites = whiteClasses.filter(value => value < pitchClass).length;
  return (octaveIndex * 7 + precedingWhites) / 21 * 100;
}

export function frequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}
