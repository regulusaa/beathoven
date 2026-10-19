import { SONGS } from './songs.js';
import { WHITE_KEYS, BLACK_KEYS, WHITE_MIDI, BLACK_MIDI, BLACK_AFTER_WHITE, keyboardMidi, keyForMidi, keyPosition, midiName } from './music.js';
import { PracticeSession, addResult, rankSummary, buildTimeline } from './practice.js';
import { PianoAudio } from './audio.js';

const $ = selector => document.querySelector(selector);
const els = {
  list: $('#song-list'), filters: $('#difficulty-filters'), search: $('#song-search'), count: $('#song-count'),
  title: $('#current-title'), composer: $('#current-composer'), difficulty: $('#song-difficulty-label'),
  stage: $('#note-stage'), grid: $('#lane-grid'), notes: $('#falling-notes'), keyboard: $('#piano-keyboard'),
  overlay: $('#stage-overlay'), start: $('#start-button'), status: $('#stage-status'), feedback: $('#feedback'),
  noteProgress: $('#note-progress'), progressFill: $('#progress-fill'), pause: $('#pause-button'),
  mode: $('#session-mode'), octave: $('#octave-label'), best: $('#best-accuracy'),
  tier: $('#rank-tier'), points: $('#rank-points'), unique: $('#unique-songs'), plays: $('#total-plays'),
  tipTitle: $('#tip-title'), tipCopy: $('#tip-copy')
};

const audio = new PianoAudio();
let selected = SONGS[0];
let mode = 'free';
let speed = 1;
let octave = 0;
let difficultyFilter = 0;
let session = null;
let paused = false;
let frameTime = 0;
let resultSaved = false;
let feedbackTimer = 0;
const heldKeys = new Map();
let progress = readProgress();

function readProgress() {
  try {
    const stored = JSON.parse(localStorage.getItem('beathoven-progress-v1'));
    return stored && typeof stored === 'object' && stored.songs ? stored : { songs: {}, totalPlays: 0 };
  } catch { return { songs: {}, totalPlays: 0 }; }
}

function saveProgress() {
  try { localStorage.setItem('beathoven-progress-v1', JSON.stringify(progress)); }
  catch { showFeedback('Progress could not be saved on this device.', true); }
}

function renderFilters() {
  els.filters.replaceChildren();
  [0,1,2,3,4].forEach(level => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `filter-button${difficultyFilter === level ? ' active' : ''}`;
    button.textContent = level === 0 ? 'All' : '★'.repeat(level);
    button.setAttribute('aria-pressed', String(difficultyFilter === level));
    button.addEventListener('click', () => { difficultyFilter = level; renderFilters(); renderLibrary(); });
    els.filters.append(button);
  });
}

function renderLibrary() {
  const query = els.search.value.trim().toLowerCase();
  const visible = SONGS.filter(song => (!difficultyFilter || song.difficulty === difficultyFilter) && `${song.title} ${song.composer}`.toLowerCase().includes(query));
  els.count.textContent = `${SONGS.length} SONGS`;
  els.list.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement('p');
    empty.className = 'muted'; empty.textContent = 'No songs match that search.';
    els.list.append(empty); return;
  }
  visible.forEach(song => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `song-item${song.id === selected.id ? ' active' : ''}`;
    button.setAttribute('aria-current', song.id === selected.id ? 'true' : 'false');
    const art = document.createElement('span'); art.className = 'song-art'; art.textContent = '♫';
    const text = document.createElement('span'); text.className = 'song-text';
    const title = document.createElement('strong'); title.textContent = song.title;
    const detail = document.createElement('small');
    const best = progress.songs[song.id]?.best;
    detail.textContent = best === undefined ? song.composer : `${song.composer} · Best ${best}%`;
    text.append(title, detail);
    const stars = document.createElement('span'); stars.className = 'song-stars'; stars.textContent = '★'.repeat(song.difficulty);
    button.append(art, text, stars);
    button.addEventListener('click', () => selectSong(song));
    els.list.append(button);
  });
}

function renderKeyboard() {
  els.keyboard.replaceChildren();
  WHITE_KEYS.forEach((key, index) => {
    const midi = WHITE_MIDI[index] + octave * 12;
    const element = document.createElement('button'); element.type = 'button'; element.className = 'white-key';
    element.dataset.key = key; element.dataset.midi = midi;
    element.setAttribute('aria-label', `${midiName(midi)}, keyboard ${key.toUpperCase()}`);
    element.innerHTML = `<span class="key-name">${midiName(midi)}</span><span class="key-letter">${key.toUpperCase()}</span>`;
    attachPointer(element, key);
    els.keyboard.append(element);
  });
  BLACK_KEYS.forEach((key, index) => {
    const midi = BLACK_MIDI[index] + octave * 12;
    const element = document.createElement('button'); element.type = 'button'; element.className = 'black-key';
    element.style.left = `${(BLACK_AFTER_WHITE[index] + 1) / 9 * 100}%`;
    element.dataset.key = key; element.dataset.midi = midi;
    element.setAttribute('aria-label', `${midiName(midi)}, keyboard ${key.toUpperCase()}`);
    element.innerHTML = `<span class="key-letter">${key.toUpperCase()}</span>`;
    attachPointer(element, key);
    els.keyboard.append(element);
  });
  updateTargetKey();
}

function attachPointer(element, key) {
  element.addEventListener('pointerdown', event => {
    event.preventDefault(); element.setPointerCapture(event.pointerId); pressKey(key, `pointer-${event.pointerId}`);
  });
  element.addEventListener('pointerup', event => releaseKey(`pointer-${event.pointerId}`));
  element.addEventListener('pointercancel', event => releaseKey(`pointer-${event.pointerId}`));
  element.addEventListener('lostpointercapture', event => releaseKey(`pointer-${event.pointerId}`));
}

function renderLanes() { els.grid.replaceChildren(...Array.from({ length: 9 }, () => document.createElement('div'))); }

function noteColor(midi) {
  const colors = ['#c9a9ff','#f6a6ca','#f5c87d','#87d6d1','#98bbf2','#b4e2aa','#e7a9e0'];
  return colors[midi % 7];
}

function renderNotes() {
  const timeline = session?.events ?? buildTimeline(selected, speed, octave);
  els.notes.replaceChildren();
  timeline.forEach(event => {
    if (event.midi === null) return;
    const element = document.createElement('div');
    element.className = `falling-note ${BLACK_MIDI.includes(event.midi - octave * 12) ? 'black' : 'white'}`;
    element.dataset.index = event.index;
    element.style.left = `${keyPosition(event.midi, octave)}%`;
    element.style.background = `linear-gradient(180deg, ${noteColor(event.midi)}, ${noteColor(event.midi)}d9)`;
    element.textContent = midiName(event.midi).replace(/\d/,'');
    els.notes.append(element);
  });
  positionNotes();
}

function positionNotes() {
  const events = session?.events ?? buildTimeline(selected, speed, octave);
  const elapsed = session?.elapsed ?? -2.25;
  const height = els.stage.clientHeight;
  const lineY = height - 26;
  const pixelsPerSecond = Math.max(92, height * .31);
  const target = session?.mode === 'learning' ? session.target : null;
  for (const element of els.notes.children) {
    const event = events[Number(element.dataset.index)];
    const barHeight = Math.max(13, event.duration * pixelsPerSecond);
    const bottom = lineY - (event.start - elapsed) * pixelsPerSecond;
    const top = bottom - barHeight;
    element.style.top = `${top}px`;
    element.style.height = `${barHeight}px`;
    element.style.display = top > height + 5 || bottom < -5 ? 'none' : 'flex';
    element.classList.toggle('hit', event.state === 'hit');
    element.classList.toggle('missed', event.state === 'missed');
    element.classList.toggle('target', target?.index === event.index && session.waiting !== null);
  }
}

function renderProgress() {
  const total = session?.total ?? selected.notes.filter(note => note.pitch).length;
  const judged = session?.events.filter(event => event.midi !== null && event.state !== 'pending').length ?? 0;
  els.noteProgress.textContent = `${judged} / ${total} NOTES`;
  els.progressFill.style.width = `${total ? judged / total * 100 : 0}%`;
}

function updateRank() {
  const summary = rankSummary(progress);
  els.tier.textContent = summary.tier;
  els.points.textContent = `${summary.points.toLocaleString()} points`;
  els.unique.textContent = summary.unique;
  els.plays.textContent = summary.totalPlays;
  const best = progress.songs[selected.id]?.best;
  els.best.textContent = best === undefined ? '—' : `${best}%`;
  renderLibrary();
}

function updateTargetKey() {
  for (const key of els.keyboard.querySelectorAll('.target-key')) key.classList.remove('target-key');
  if (session?.mode !== 'learning' || !session.target) return;
  const key = keyForMidi(session.target.midi, octave);
  if (key) els.keyboard.querySelector(`[data-key="${key}"]`)?.classList.add('target-key');
}

function updateTip() {
  const tips = mode === 'learning'
    ? ['Watch the next bar','Learning mode waits when a note is missed. Find the highlighted key, play it, and the song continues.']
    : ['Keep the pulse','In Free mode the music keeps moving. Aim to meet the glowing line, then review your accuracy at the end.'];
  els.tipTitle.textContent = tips[0]; els.tipCopy.textContent = tips[1];
}

function showFeedback(message, bad = false) {
  els.feedback.textContent = message;
  els.feedback.classList.toggle('bad', bad);
  els.feedback.classList.add('show');
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => els.feedback.classList.remove('show'), 1100);
}

function resetSession() {
  audio.stopAll(); heldKeys.clear();
  for (const element of els.keyboard.querySelectorAll('.pressed')) element.classList.remove('pressed');
  session = null; paused = false; resultSaved = false;
  els.overlay.hidden = false;
  els.overlay.querySelector('strong').textContent = 'Ready when you are.';
  els.overlay.querySelector('span').textContent = 'Follow the notes down to your keys.';
  els.start.innerHTML = 'Start playing <span>→</span>';
  els.status.textContent = 'READY TO PLAY';
  els.pause.disabled = true; els.pause.querySelector('span').textContent = 'Pause';
  renderNotes(); renderProgress(); updateTargetKey();
}

function selectSong(song) {
  selected = song;
  els.title.textContent = song.title;
  els.composer.textContent = song.composer;
  els.difficulty.textContent = `${'★'.repeat(song.difficulty)} ${['','BEGINNER','EASY','INTERMEDIATE','ADVANCED'][song.difficulty]}`;
  resetSession(); updateRank();
}

function changeSong(direction) {
  const index = SONGS.findIndex(song => song.id === selected.id);
  selectSong(SONGS[(index + direction + SONGS.length) % SONGS.length]);
}

function startSession() {
  if ($('#result-dialog').open) $('#result-dialog').close();
  if (session && paused) {
    paused = false; session.playing = true; els.overlay.hidden = true;
    els.status.textContent = 'PLAYING'; els.pause.querySelector('span').textContent = 'Pause';
    frameTime = performance.now(); return;
  }
  session = new PracticeSession(selected, mode, speed, octave);
  session.elapsed = -Math.max(1.6, 3 * 60 / (selected.bpm * speed));
  resultSaved = false;
  els.overlay.hidden = true;
  els.pause.disabled = false;
  els.status.textContent = 'GET READY';
  frameTime = performance.now();
  renderNotes(); renderProgress(); updateTargetKey();
  audio.unlock().catch(() => {});
}

function togglePause() {
  if (!session || session.finished) return;
  paused = !paused; session.playing = !paused;
  els.overlay.hidden = !paused;
  if (paused) {
    els.overlay.querySelector('strong').textContent = 'Take a breath.';
    els.overlay.querySelector('span').textContent = 'Resume when you are ready.';
    els.start.innerHTML = 'Resume playing <span>→</span>';
    els.status.textContent = 'PAUSED';
  } else { els.status.textContent = 'PLAYING'; frameTime = performance.now(); }
  els.pause.querySelector('span').textContent = paused ? 'Resume' : 'Pause';
}

function finishSession() {
  if (!session || resultSaved) return;
  resultSaved = true;
  audio.stopAll();
  progress = addResult(progress, selected, mode, session.accuracy);
  saveProgress(); updateRank(); renderProgress();
  els.status.textContent = 'COMPLETE';
  $('#result-title').textContent = session.accuracy >= 90 ? 'Beautifully played.' : session.accuracy >= 60 ? 'Nice progress.' : 'Keep practicing.';
  $('#result-accuracy').textContent = `${session.accuracy}%`;
  $('#result-detail').textContent = mode === 'free'
    ? `${session.hits} of ${session.total} notes played on time · ${selected.title}`
    : `${session.total} notes learned · ${session.errors} ${session.errors === 1 ? 'retry' : 'retries'} · ${selected.title}`;
  $('#result-dialog').showModal();
}

function pressKey(key, source) {
  if (heldKeys.has(source)) return;
  const midi = keyboardMidi(key, octave);
  if (midi === null) return;
  heldKeys.set(source, midi);
  els.keyboard.querySelector(`[data-key="${key}"]`)?.classList.add('pressed');
  audio.start(midi).catch(() => {});
  if (session && !paused && !session.finished) {
    const result = session.press(midi);
    if (result === 'hit') showFeedback('Nice!');
    else if (result === 'wrong' && mode === 'learning') showFeedback(`Try ${midiName(session.target.midi)} · ${keyForMidi(session.target.midi, octave).toUpperCase()}`, true);
    if (session.waiting !== null) els.status.textContent = 'PLAY THE HIGHLIGHTED KEY';
    else if (session.elapsed >= 0) els.status.textContent = 'PLAYING';
    updateTargetKey(); renderProgress(); positionNotes();
    if (session.finished) finishSession();
  }
}

function releaseKey(source) {
  const midi = heldKeys.get(source);
  if (midi === undefined) return;
  heldKeys.delete(source);
  if (![...heldKeys.values()].includes(midi)) {
    audio.stop(midi);
    const key = keyForMidi(midi, octave);
    if (key) els.keyboard.querySelector(`[data-key="${key}"]`)?.classList.remove('pressed');
  }
}

function changeOctave(delta) {
  const next = Math.max(-2, Math.min(2, octave + delta));
  if (next === octave) return;
  octave = next;
  els.octave.textContent = `${midiName(60 + octave * 12)}–${midiName(74 + octave * 12)}`;
  $('#octave-down').disabled = octave === -2;
  $('#octave-up').disabled = octave === 2;
  resetSession(); renderKeyboard();
}

function loop(now) {
  const delta = Math.min(.1, Math.max(0, (now - frameTime) / 1000));
  frameTime = now;
  if (session && !paused && !session.finished) {
    session.advance(delta);
    if (session.waiting !== null) els.status.textContent = 'PLAY THE HIGHLIGHTED KEY';
    else if (session.elapsed >= 0) els.status.textContent = 'PLAYING';
    else els.status.textContent = `GET READY · ${Math.ceil(-session.elapsed)} `;
    renderProgress(); updateTargetKey();
    if (session.finished) finishSession();
  }
  positionNotes();
  requestAnimationFrame(loop);
}

document.addEventListener('keydown', event => {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  const tag = event.target?.tagName;
  if (['INPUT','TEXTAREA','SELECT'].includes(tag) || event.target?.isContentEditable) return;
  if (document.querySelector('dialog[open]')) return;
  const key = event.key.toLowerCase();
  if (keyboardMidi(key, octave) !== null) { event.preventDefault(); pressKey(key, `keyboard-${key}`); }
  else if (key === ' ') { event.preventDefault(); if (!session || session.finished || paused) startSession(); else togglePause(); }
  else if (key === 'arrowup') { event.preventDefault(); changeOctave(1); }
  else if (key === 'arrowdown') { event.preventDefault(); changeOctave(-1); }
});
document.addEventListener('keyup', event => releaseKey(`keyboard-${event.key.toLowerCase()}`));
window.addEventListener('blur', () => { for (const source of [...heldKeys.keys()]) releaseKey(source); });
els.search.addEventListener('input', renderLibrary);
els.start.addEventListener('click', startSession);
$('#restart-button').addEventListener('click', () => { paused = false; session = null; startSession(); });
els.pause.addEventListener('click', togglePause);
$('#previous-song').addEventListener('click', () => changeSong(-1));
$('#next-song').addEventListener('click', () => changeSong(1));
$('#free-mode').addEventListener('click', () => setMode('free'));
$('#learning-mode').addEventListener('click', () => setMode('learning'));
$('#speed-select').addEventListener('change', event => { speed = Number(event.target.value); resetSession(); });
$('#sound-button').addEventListener('click', () => { audio.enabled = !audio.enabled; if (!audio.enabled) audio.stopAll(); $('#sound-button').textContent = audio.enabled ? '♪' : '♩'; $('#sound-button').setAttribute('aria-label', audio.enabled ? 'Mute sound' : 'Unmute sound'); });
$('#octave-down').addEventListener('click', () => changeOctave(-1));
$('#octave-up').addEventListener('click', () => changeOctave(1));
$('#help-button').addEventListener('click', () => $('#help-dialog').showModal());
$('#close-help').addEventListener('click', () => $('#help-dialog').close());
$('#got-it').addEventListener('click', () => $('#help-dialog').close());
$('#result-retry').addEventListener('click', startSession);
$('#result-next').addEventListener('click', () => { $('#result-dialog').close(); changeSong(1); startSession(); });

function setMode(value) {
  if (mode === value) return;
  mode = value;
  for (const [name, button] of [['free',$('#free-mode')],['learning',$('#learning-mode')]]) {
    button.classList.toggle('active', name === mode);
    button.setAttribute('aria-pressed', String(name === mode));
  }
  els.mode.textContent = mode === 'free' ? 'Free mode' : 'Learning mode';
  updateTip(); resetSession();
}

renderLanes(); renderFilters(); renderKeyboard(); selectSong(selected); updateTip();
frameTime = performance.now(); requestAnimationFrame(loop);
