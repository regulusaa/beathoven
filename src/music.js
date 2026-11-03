// Each layout follows the physical keys (KeyboardEvent.code), so it works with
// any language setting. Home-row keys are white piano keys; the row above holds
// the black keys between them. Every layout covers each semitone from C4 up.
const MAIN_BLOCK = [
  ['KeyA','A'],['KeyW','W'],['KeyS','S'],['KeyE','E'],['KeyD','D'],['KeyF','F'],['KeyT','T'],
  ['KeyG','G'],['KeyY','Y'],['KeyH','H'],['KeyU','U'],['KeyJ','J'],['KeyK','K'],['KeyO','O'],
  ['KeyL','L'],['KeyP','P'],['Semicolon',';'],['Quote',"'"],['BracketRight',']'],['Enter','↵']
];
const buildLayout = (id,name,keys) => ({ id, name, keys: keys.map(([code,label],index) => ({ code, label, midi: 60 + index })) });
export const LAYOUTS = {
  60: buildLayout('60','60% · laptop',MAIN_BLOCK),
  75: buildLayout('75','75%',[...MAIN_BLOCK,['Backslash','\\'],['PageUp','PgUp']]),
  100: buildLayout('100','100%',[
    ...MAIN_BLOCK,['Backslash','\\'],['Delete','Del'],['Home','Home'],['End','End'],['PageDown','PgDn'],
    ['NumLock','Num'],['Numpad7','7'],['NumpadDivide','/'],['Numpad8','8'],['Numpad9','9'],
    ['NumpadSubtract','−'],['NumpadAdd','+']
  ])
};
export const DEFAULT_LAYOUT = '60';
const NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const layoutOf = id => LAYOUTS[id] || LAYOUTS[DEFAULT_LAYOUT];

export function isWhite(midi) { return [0,2,4,5,7,9,11].includes(midi % 12); }

export function layoutRange(layout = DEFAULT_LAYOUT) {
  const keys = layoutOf(layout).keys;
  return { low: keys[0].midi, high: keys.at(-1).midi };
}

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

export function keyboardMidi(code, octave = 0, layout = DEFAULT_LAYOUT) {
  const key = layoutOf(layout).keys.find(item => item.code === code);
  return key ? key.midi + octave * 12 : null;
}

export function keyForMidi(midi, octave = 0, layout = DEFAULT_LAYOUT) {
  return layoutOf(layout).keys.find(item => item.midi === midi - octave * 12)?.label ?? null;
}

// Percent across the on-screen piano, which shows only the layout's keys.
export function keyPosition(midi, octave = 0, layout = DEFAULT_LAYOUT) {
  const base = midi - octave * 12;
  const { low, high } = layoutRange(layout);
  if (base < low || base > high) return null;
  let whites = 0, total = 0;
  for (let note = low; note <= high; note++) if (isWhite(note)) { total++; if (note < base) whites++; }
  return (isWhite(base) ? whites + .5 : whites) / total * 100;
}

export function frequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}
