// A small, dependency-free Standard MIDI File reader. It reads note and tempo
// events only; imported files never leave the browser.
export function parseMidi(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  const read8 = () => { if (offset >= bytes.length) throw new Error('Unexpected end of MIDI file'); return bytes[offset++]; };
  const read16 = () => (read8() << 8) | read8();
  const read32 = () => ((read8() * 0x1000000) + (read8() << 16) + (read8() << 8) + read8()) >>> 0;
  const text = length => { const value = String.fromCharCode(...bytes.slice(offset, offset + length)); offset += length; return value; };
  const vlq = () => { let value = 0; for (let i = 0; i < 4; i++) { const b = read8(); value = (value << 7) | (b & 127); if (!(b & 128)) return value; } throw new Error('Invalid MIDI variable-length value'); };

  if (text(4) !== 'MThd') throw new Error('This is not a MIDI file');
  const headerSize = read32();
  if (headerSize < 6) throw new Error('Invalid MIDI header');
  const format = read16();
  const trackCount = read16();
  const division = read16();
  offset = 8 + headerSize;
  if (format > 1 || division & 0x8000 || division === 0) throw new Error('Only type 0 and 1 beat-based MIDI files are supported');
  if (!trackCount || trackCount > 256) throw new Error('Invalid MIDI track count');

  const rawNotes = [];
  const tempoEvents = [{ tick: 0, micros: 500000 }];
  for (let track = 0; track < trackCount; track++) {
    if (text(4) !== 'MTrk') throw new Error('Invalid MIDI track');
    const length = read32();
    const end = offset + length;
    if (end > bytes.length) throw new Error('Truncated MIDI track');
    let tick = 0;
    let running = 0;
    const active = new Map();
    while (offset < end) {
      tick += vlq();
      let status = read8();
      if (status < 0x80) { if (!running) throw new Error('Invalid MIDI running status'); offset--; status = running; }
      else if (status < 0xf0) running = status;
      else running = 0;

      if (status === 0xff) {
        const kind = read8(); const length = vlq();
        if (offset + length > end) throw new Error('Truncated MIDI meta event');
        if (kind === 0x51 && length === 3) tempoEvents.push({ tick, micros: (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2] });
        offset += length;
      } else if (status === 0xf0 || status === 0xf7) {
        const length = vlq();
        if (offset + length > end) throw new Error('Truncated MIDI system event');
        offset += length;
      } else {
        const type = status >> 4;
        const channel = status & 15;
        const a = read8();
        const b = type === 0xc || type === 0xd ? 0 : read8();
        if (channel === 9) continue; // percussion channel
        const key = `${channel}:${a}`;
        if (type === 0x9 && b > 0) {
          const queue = active.get(key) || [];
          queue.push({ midi: a, startTick: tick, velocity: b });
          active.set(key, queue);
        } else if (type === 0x8 || (type === 0x9 && b === 0)) {
          const queue = active.get(key);
          if (queue?.length) {
            const note = queue.shift();
            if (tick > note.startTick) rawNotes.push({ ...note, endTick: tick, track });
          }
        }
      }
    }
    offset = end;
  }
  if (!rawNotes.length) throw new Error('No piano notes found in this MIDI file');

  tempoEvents.sort((a,b) => a.tick - b.tick);
  const tempo = [];
  for (const event of tempoEvents) {
    if (tempo.length && tempo.at(-1).tick === event.tick) tempo.at(-1).micros = event.micros;
    else tempo.push({ ...event });
  }
  let seconds = 0;
  for (let i = 0; i < tempo.length; i++) {
    if (i) seconds += (tempo[i].tick - tempo[i-1].tick) * tempo[i-1].micros / division / 1e6;
    tempo[i].seconds = seconds;
  }
  function toSeconds(tick) {
    let lo = 0, hi = tempo.length - 1;
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (tempo[mid].tick <= tick) lo = mid; else hi = mid - 1; }
    return tempo[lo].seconds + (tick - tempo[lo].tick) * tempo[lo].micros / division / 1e6;
  }
  const notes = rawNotes.map(note => ({
    midi: note.midi,
    start: toSeconds(note.startTick),
    duration: Math.max(.04, toSeconds(note.endTick) - toSeconds(note.startTick)),
    track: note.track,
    velocity: note.velocity
  })).sort((a,b) => a.start - b.start || b.midi - a.midi);
  return { notes, duration: notes.reduce((end,note) => Math.max(end,note.start + note.duration),0), tracks: trackCount };
}

// A full piano score can require several hands and many octaves. For the laptop
// exercise, keep the highest note at each onset and fold its pitch into the
// active C4–D5 key map. The rhythm and complete piece length are preserved.
export function adaptMidiForLaptop(parsed) {
  const groups = new Map();
  for (const note of parsed.notes) {
    const key = Math.round(note.start * 1000);
    const current = groups.get(key);
    if (!current || note.midi > current.midi) groups.set(key, note);
  }
  const notes = [...groups.values()].sort((a,b) => a.start - b.start).map(note => {
    let midi = note.midi;
    while (midi < 60) midi += 12;
    while (midi > 75) midi -= 12;
    return { midi, start: note.start, duration: note.duration };
  });
  return { notes, duration: parsed.duration, sourceNoteCount: parsed.notes.length };
}
