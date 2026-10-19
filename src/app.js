import { SONGS } from './songs.js';
import { FULL_SCORES, FREE_SCORES } from './full-scores.js';
import { keyboardMidi, keyForMidi, wideKeyPosition, midiName } from './music.js';
import { PracticeSession, addResult, rankSummary, buildTimeline } from './practice.js';
import { PianoAudio } from './audio.js';
import { parseMidi, adaptMidiForLaptop } from './midi.js';
import { currentProfile, updateProfile } from './profiles.js';
import { loadPersonalSongs, savePersonalSong } from './personal-songs.js';

const $ = selector => document.querySelector(selector);
const els = {
  list: $('#song-list'), filters: $('#difficulty-filters'), search: $('#song-search'), count: $('#song-count'),
  title: $('#current-title'), composer: $('#current-composer'), difficulty: $('#song-difficulty-label'),
  kind: $('#song-kind-label'), source: $('#score-source'),
  stage: $('#note-stage'), notes: $('#falling-notes'), keyboard: $('#piano-keyboard'),
  overlay: $('#stage-overlay'), start: $('#start-button'), status: $('#stage-status'), feedback: $('#feedback'),
  noteProgress: $('#note-progress'), progressFill: $('#progress-fill'), pause: $('#pause-button'),
  mode: $('#session-mode'), octave: $('#octave-label'), best: $('#best-accuracy'),
  tier: $('#rank-tier'), points: $('#rank-points'), unique: $('#unique-songs'), plays: $('#total-plays'),
  tipTitle: $('#tip-title'), tipCopy: $('#tip-copy'), profileLink: $('#profile-link')
};
const audio = new PianoAudio();
const imports = [];
const learningOnlyIds = new Set([...SONGS,...FULL_SCORES.filter(song => !FREE_SCORES.includes(song))].map(song => song.id));
const isLearningOnly = song => learningOnlyIds.has(song.id);
const library = () => [...FULL_SCORES, ...SONGS, ...imports];
const playableLibrary = () => mode === 'free' ? [...FREE_SCORES, ...imports] : library();
let selected = FREE_SCORES[0];
let lastFreeSong = selected;
let mode = 'free';
let speed = 1;
let octave = 0;
let difficultyFilter = 0;
let session = null;
let preview = [];
let paused = false;
let frameTime = 0;
let resultSaved = false;
let feedbackTimer = 0;
let loadingSerial = 0;
let checkpointTime = 0;
const heldKeys = new Map();
const noteNodes = new Map();
let progress = currentProfile()?.progress || readGuestProgress();

function readGuestProgress() {
  try {
    const value = JSON.parse(localStorage.getItem('beathoven-progress-v1'));
    return value?.songs ? value : { songs: {}, totalPlays: 0 };
  } catch { return { songs: {}, totalPlays: 0 }; }
}

function saveProgressAndClearCheckpoint() {
  try {
    if (currentProfile()) updateProfile({ progress, checkpoint: null });
    else {
      localStorage.setItem('beathoven-progress-v1', JSON.stringify(progress));
      localStorage.removeItem('beathoven-guest-checkpoint-v1');
    }
  } catch { showFeedback('Progress could not be saved on this device.', true); }
}

function saveCheckpoint(force = false) {
  if (!session || session.finished || (selected.kind === 'imported' && !selected.persisted)) return;
  const now = performance.now();
  if (!force && now - checkpointTime < 1500) return;
  checkpointTime = now;
  const checkpoint = {
    songId: selected.id, songTitle: selected.title, mode, speed, octave, elapsed: session.elapsed,
    waiting: session.waiting, errors: session.errors,
    states: session.events.map(event => event.state === 'hit' ? 'h' : event.state === 'missed' ? 'm' : 'p').join(''),
    savedAt: new Date().toISOString()
  };
  try {
    if (currentProfile()) updateProfile({ checkpoint });
    else localStorage.setItem('beathoven-guest-checkpoint-v1', JSON.stringify(checkpoint));
  } catch { /* Quota or private mode: completed scores still have their own save. */ }
}

function savedCheckpoint() {
  if (currentProfile()) return currentProfile().checkpoint;
  try { return JSON.parse(localStorage.getItem('beathoven-guest-checkpoint-v1')); } catch { return null; }
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '';
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function scoreKindLabel(song, loading = false) {
  if (song.kind !== 'full' && song.kind !== 'imported') return 'SHORT STUDY';
  const type = song.kind === 'full' ? 'FULL PIECE' : 'YOUR MIDI';
  if (loading && song.kind === 'full' && !song.events) return `${type} · loading…`;
  const total = formatDuration(song.duration);
  if (mode === 'learning') return `LEARNING PRACTICE · ${formatDuration(Math.min(song.duration, song.learningSeconds || 40))} of ${total}`;
  return `${type} · ${total}`;
}

async function ensureScore(song) {
  if (!song.midiUrl || song.events) return;
  if (!song.loadPromise) song.loadPromise = fetch(song.midiUrl)
    .then(response => { if (!response.ok) throw new Error('Score could not be loaded.'); return response.arrayBuffer(); })
    .then(buffer => {
      const adaptation = adaptMidiForLaptop(parseMidi(buffer));
      song.events = adaptation.notes;
      song.duration = adaptation.duration;
      song.sourceNoteCount = adaptation.sourceNoteCount;
      song.learningSeconds = 40;
    });
  try { await song.loadPromise; }
  catch (error) { song.loadPromise = null; throw error; }
}

function renderProfileLink() {
  const profile = currentProfile();
  const badge = $('#header-avatar');
  const label = $('#header-profile-name');
  if (profile) {
    if (profile.avatar) { badge.style.backgroundImage = `url(${profile.avatar})`; badge.textContent = ''; }
    else { badge.style.backgroundImage = ''; badge.textContent = profile.name[0].toUpperCase(); }
    label.textContent = profile.name;
  } else { badge.style.backgroundImage = ''; badge.textContent = '♙'; label.textContent = 'Create profile'; }
}

function renderFilters() {
  els.filters.replaceChildren();
  [0,1,2,3,4].forEach(level => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `filter-button${difficultyFilter === level ? ' active' : ''}`;
    button.textContent = level === 0 ? 'All' : '★'.repeat(level);
    button.setAttribute('aria-pressed', String(difficultyFilter === level));
    button.addEventListener('click', () => { difficultyFilter = level; renderFilters(); renderLibrary(); });
    els.filters.append(button);
  });
}

function renderLibrary() {
  const query = els.search.value.trim().toLowerCase();
  const songs = playableLibrary();
  const visible = songs.filter(song => (!difficultyFilter || song.difficulty === difficultyFilter) && `${song.title} ${song.composer}`.toLowerCase().includes(query));
  els.count.textContent = `${songs.length} PIECES`;
  els.list.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement('p'); empty.className = 'muted';
    empty.textContent = mode === 'free' ? 'No full pieces match. Try another search or switch to Learning mode for short studies.' : 'No pieces match that search.';
    els.list.append(empty); return;
  }
  for (const song of visible) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `song-item${song.id === selected.id ? ' active' : ''}`;
    button.setAttribute('aria-current', song.id === selected.id ? 'true' : 'false');
    const art = document.createElement('span'); art.className = 'song-art'; art.textContent = song.kind === 'full' ? '♬' : '♫';
    const text = document.createElement('span'); text.className = 'song-text';
    const title = document.createElement('strong'); title.textContent = song.title;
    const detail = document.createElement('small');
    const duration = song.duration ? formatDuration(song.duration) : song.kind === 'full' ? 'Full piece' : 'Short study';
    const best = progress.songs[song.id]?.best;
    detail.textContent = `${song.composer} · ${duration}${best === undefined ? '' : ` · ${best}% best`}`;
    text.append(title, detail);
    const stars = document.createElement('span'); stars.className = 'song-stars'; stars.textContent = '★'.repeat(song.difficulty);
    button.append(art,text,stars);
    button.addEventListener('click', () => selectSong(song));
    els.list.append(button);
  }
}

function isWhite(midi) { return [0,2,4,5,7,9,11].includes(midi % 12); }

function renderKeyboard() {
  els.keyboard.replaceChildren();
  const start = 48 + octave * 12;
  for (let midi = start; midi <= start + 35; midi++) {
    if (!isWhite(midi)) continue;
    const key = keyForMidi(midi, octave);
    const element = document.createElement('button'); element.type = 'button';
    element.className = `white-key${key ? ' mapped-key' : ''}`;
    element.dataset.midi = midi;
    element.setAttribute('aria-label', `${midiName(midi)}${key ? `, keyboard ${key.toUpperCase()}` : ''}`);
    const name = document.createElement('span'); name.className = 'key-name'; name.textContent = midiName(midi);
    const letter = document.createElement('span'); letter.className = 'key-letter'; letter.textContent = key?.toUpperCase() || '';
    element.append(name,letter); attachPointer(element,midi); els.keyboard.append(element);
  }
  for (let midi = start; midi <= start + 35; midi++) {
    if (isWhite(midi)) continue;
    const key = keyForMidi(midi,octave);
    const element = document.createElement('button'); element.type = 'button';
    element.className = `black-key${key ? ' mapped-key' : ''}`;
    element.style.left = `${wideKeyPosition(midi,octave)}%`;
    element.dataset.midi = midi;
    element.setAttribute('aria-label', `${midiName(midi)}${key ? `, keyboard ${key.toUpperCase()}` : ''}`);
    element.textContent = key?.toUpperCase() || '';
    attachPointer(element,midi); els.keyboard.append(element);
  }
  updateTargetKey();
}

function attachPointer(element,midi) {
  element.addEventListener('pointerdown', event => {
    event.preventDefault(); element.setPointerCapture(event.pointerId);
    pressMidi(midi,`pointer-${event.pointerId}`);
  });
  element.addEventListener('pointerup', event => releaseKey(`pointer-${event.pointerId}`));
  element.addEventListener('pointercancel', event => releaseKey(`pointer-${event.pointerId}`));
  element.addEventListener('lostpointercapture', event => releaseKey(`pointer-${event.pointerId}`));
}

function noteColor(midi) {
  const colors = ['#c9a9ff','#f6a6ca','#f5c87d','#87d6d1','#98bbf2','#b4e2aa','#e7a9e0'];
  return colors[midi % 7];
}

function renderNotes() {
  els.notes.replaceChildren(); noteNodes.clear(); positionNotes();
}

function positionNotes() {
  const events = session?.events ?? preview;
  if (!events.length) return;
  const elapsed = session?.elapsed ?? -2.25;
  const height = els.stage.clientHeight;
  const lineY = height - 26;
  const pixelsPerSecond = Math.max(42,height * .16);
  const target = session?.mode === 'learning' ? session.target : null;
  let low = 0, high = events.length;
  while (low < high) { const mid = (low + high) >> 1; if (events[mid].start < elapsed - 15) low = mid + 1; else high = mid; }
  const visible = new Set();
  for (let i = low; i < events.length; i++) {
    const event = events[i];
    if (event.start > elapsed + height / pixelsPerSecond + 4) break;
    if (event.midi === null) continue;
    const position = wideKeyPosition(event.midi,octave);
    if (position === null) continue;
    const barHeight = Math.max(10,event.duration * pixelsPerSecond);
    const bottom = lineY - (event.start - elapsed) * pixelsPerSecond;
    const top = bottom - barHeight;
    if (top > height + 5 || bottom < -5) continue;
    visible.add(event.index);
    let element = noteNodes.get(event.index);
    if (!element) {
      element = document.createElement('div');
      element.className = `falling-note ${isWhite(event.midi) ? 'white' : 'black'}`;
      element.style.left = `${position}%`;
      element.style.background = noteColor(event.midi);
      element.textContent = midiName(event.midi).replace(/\d/g,'');
      els.notes.append(element); noteNodes.set(event.index,element);
    }
    element.style.top = `${top}px`;
    element.style.height = `${barHeight}px`;
    element.classList.toggle('hit', event.state === 'hit');
    element.classList.toggle('missed', event.state === 'missed');
    element.classList.toggle('target', target?.index === event.index && session.waiting !== null);
  }
  for (const [index,element] of noteNodes) {
    if (!visible.has(index)) { element.remove(); noteNodes.delete(index); }
  }
}

function renderProgress() {
  const events = session?.events ?? preview;
  const total = events.filter(event => event.midi !== null).length;
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
  els.keyboard.querySelector(`[data-midi="${session.target.midi}"]`)?.classList.add('target-key');
}

function updateTip() {
  const tips = mode === 'learning'
    ? ['Practice the opening','Full pieces use an opening excerpt here. Learning mode waits on a missed note until you play the highlighted key.']
    : ['Play the whole piece','Free mode runs from the first note to the last. Long piano scores are adapted to a single-note laptop line.'];
  els.tipTitle.textContent = tips[0]; els.tipCopy.textContent = tips[1];
}

function showFeedback(message,bad = false) {
  els.feedback.textContent = message; els.feedback.classList.toggle('bad',bad); els.feedback.classList.add('show');
  clearTimeout(feedbackTimer); feedbackTimer = setTimeout(() => els.feedback.classList.remove('show'),1200);
}

function resetSession() {
  audio.stopAll(); heldKeys.clear();
  for (const element of els.keyboard.querySelectorAll('.pressed')) element.classList.remove('pressed');
  session = null; paused = false; resultSaved = false;
  preview = selected.events || selected.notes ? buildTimeline(selected,speed,octave,mode) : [];
  els.overlay.hidden = false;
  els.overlay.querySelector('strong').textContent = 'Ready when you are.';
  els.overlay.querySelector('span').textContent = 'Follow the notes down to your keys.';
  els.start.innerHTML = 'Start playing <span>→</span>';
  els.start.disabled = !preview.length;
  els.status.textContent = preview.length ? 'READY TO PLAY' : 'LOADING SCORE';
  els.pause.disabled = true; els.pause.querySelector('span').textContent = 'Pause';
  renderNotes(); renderProgress(); updateTargetKey();
}

async function selectSong(song,{allowShortFreeResume = false} = {}) {
  if (mode === 'free' && isLearningOnly(song) && !allowShortFreeResume) return;
  const serial = ++loadingSerial;
  selected = song;
  if (!isLearningOnly(song)) lastFreeSong = song;
  els.title.textContent = song.title;
  els.composer.textContent = song.composer;
  els.difficulty.textContent = `${'★'.repeat(song.difficulty)} ${['','BEGINNER','EASY','INTERMEDIATE','ADVANCED'][song.difficulty]}`;
  els.source.hidden = !song.sourceUrl;
  if (song.sourceUrl) els.source.href = song.sourceUrl;
  els.kind.textContent = scoreKindLabel(song,true);
  resetSession(); updateRank();
  try {
    await ensureScore(song);
    if (serial !== loadingSerial) return;
    els.kind.textContent = scoreKindLabel(song);
    resetSession(); updateRank();
  } catch(error) {
    if (serial !== loadingSerial) return;
    els.status.textContent = 'SCORE UNAVAILABLE';
    els.overlay.querySelector('strong').textContent = 'Could not load this score.';
    els.overlay.querySelector('span').textContent = error.message;
    showFeedback(error.message,true);
  }
}

async function changeSong(direction) {
  const songs = playableLibrary(); const index = songs.findIndex(song => song.id === selected.id);
  await selectSong(songs[index < 0 ? (direction > 0 ? 0 : songs.length - 1) : (index + direction + songs.length) % songs.length]);
}

async function startSession() {
  if ($('#result-dialog').open) $('#result-dialog').close();
  if (session && paused) {
    paused = false; session.playing = true; els.overlay.hidden = true;
    els.status.textContent = 'PLAYING'; els.pause.querySelector('span').textContent = 'Pause';
    frameTime = performance.now(); return;
  }
  try { await ensureScore(selected); } catch(error) { showFeedback(error.message,true); return; }
  session = new PracticeSession(selected,mode,speed,octave);
  session.elapsed = -Math.max(1.6, 3 * 60 / ((selected.bpm || 90) * speed));
  resultSaved = false; els.overlay.hidden = true; els.pause.disabled = false;
  els.status.textContent = 'GET READY'; frameTime = performance.now();
  renderNotes(); renderProgress(); updateTargetKey(); saveCheckpoint(true);
  audio.unlock().catch(() => {});
}

function togglePause() {
  if (!session || session.finished) return;
  paused = !paused; session.playing = !paused; els.overlay.hidden = !paused;
  if (paused) {
    els.overlay.querySelector('strong').textContent = 'Take a breath.';
    els.overlay.querySelector('span').textContent = 'Resume when you are ready.';
    els.start.innerHTML = 'Resume playing <span>→</span>';
    els.status.textContent = 'PAUSED'; saveCheckpoint(true);
  } else { els.status.textContent = 'PLAYING'; frameTime = performance.now(); }
  els.pause.querySelector('span').textContent = paused ? 'Resume' : 'Pause';
}

function finishSession() {
  if (!session || resultSaved) return;
  resultSaved = true; audio.stopAll();
  progress = addResult(progress,selected,mode,session.accuracy);
  saveProgressAndClearCheckpoint(); updateRank(); renderProgress();
  els.status.textContent = 'COMPLETE';
  $('#result-title').textContent = session.accuracy >= 90 ? 'Beautifully played.' : session.accuracy >= 60 ? 'Nice progress.' : 'Keep practicing.';
  const difficulty = $('#result-difficulty');
  difficulty.textContent = '★'.repeat(selected.difficulty);
  difficulty.setAttribute('aria-label', `${selected.difficulty}-star song difficulty`);
  $('#result-accuracy').textContent = `${session.accuracy}%`;
  $('#result-detail').textContent = mode === 'free'
    ? `${session.hits} of ${session.total} notes played on time · ${selected.title}`
    : `${session.total} notes learned · ${session.errors} ${session.errors === 1 ? 'retry' : 'retries'} · ${selected.title}`;
  $('#result-dialog').showModal();
}

function pressMidi(midi,source) {
  if (heldKeys.has(source)) return;
  heldKeys.set(source,midi);
  els.keyboard.querySelector(`[data-midi="${midi}"]`)?.classList.add('pressed');
  audio.start(midi).catch(() => {});
  if (session && !paused && !session.finished) {
    const result = session.press(midi);
    if (result === 'hit') showFeedback('Nice!');
    else if (result === 'wrong' && mode === 'learning') {
      const target = session.target;
      const key = target ? keyForMidi(target.midi,octave) : null;
      showFeedback(`Try ${target ? midiName(target.midi) : 'the highlighted note'}${key ? ` · ${key.toUpperCase()}` : ''}`,true);
    }
    els.status.textContent = session.waiting !== null ? 'PLAY THE HIGHLIGHTED KEY' : 'PLAYING';
    updateTargetKey(); renderProgress(); positionNotes(); saveCheckpoint();
    if (session.finished) finishSession();
  }
}

function releaseKey(source) {
  const midi = heldKeys.get(source);
  if (midi === undefined) return;
  heldKeys.delete(source);
  if (![...heldKeys.values()].includes(midi)) {
    audio.stop(midi);
    els.keyboard.querySelector(`[data-midi="${midi}"]`)?.classList.remove('pressed');
  }
}

function changeOctave(delta) {
  const next = Math.max(-2,Math.min(2,octave + delta));
  if (next === octave) return;
  const difference = next - octave;
  for (const source of [...heldKeys.keys()]) releaseKey(source);
  octave = next;
  els.octave.textContent = `${midiName(60 + octave * 12)}–${midiName(74 + octave * 12)}`;
  $('#octave-down').disabled = octave === -2; $('#octave-up').disabled = octave === 2;
  if (session) session.events.forEach(event => { if (event.midi !== null) event.midi += 12 * difference; });
  preview = selected.events || selected.notes ? buildTimeline(selected,speed,octave,mode) : [];
  renderKeyboard(); renderNotes(); saveCheckpoint(true);
}

function loop(now) {
  const delta = Math.min(.1,Math.max(0,(now - frameTime) / 1000)); frameTime = now;
  if (session && !paused && !session.finished) {
    session.advance(delta);
    if (session.waiting !== null) els.status.textContent = 'PLAY THE HIGHLIGHTED KEY';
    else if (session.elapsed >= 0) els.status.textContent = 'PLAYING';
    else els.status.textContent = `GET READY · ${Math.ceil(-session.elapsed)}`;
    renderProgress(); updateTargetKey(); saveCheckpoint();
    if (session.finished) finishSession();
  }
  positionNotes(); requestAnimationFrame(loop);
}

async function importMidi(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { showFeedback('Choose a MIDI file smaller than 10 MB.',true); return; }
  try {
    const bytes = await file.arrayBuffer();
    const adapted = adaptMidiForLaptop(parseMidi(bytes));
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
    const id = `import-${[...digest.slice(0,8)].map(x => x.toString(16).padStart(2,'0')).join('')}`;
    const song = { id,title:file.name.replace(/\.(mid|midi)$/i,'').slice(0,80),composer:'Your MIDI · saved in this browser',difficulty:3,kind:'imported',events:adapted.notes,duration:adapted.duration,learningSeconds:40 };
    let saved = true;
    try { await savePersonalSong(song,bytes); }
    catch { saved = false; }
    song.persisted = saved;
    const existing = imports.findIndex(item => item.id === id);
    if (existing >= 0) imports.splice(existing,1);
    imports.push(song);
    await selectSong(song);
    showFeedback(saved ? 'MIDI saved here — full piece in Free mode.' : 'MIDI ready for this visit; this browser could not save it.',!saved);
  } catch(error) { showFeedback(`Could not import MIDI: ${error.message}`,true); }
}

async function restorePersonalSongs() {
  try {
    const records = await loadPersonalSongs();
    for (const record of records) {
      try {
        if (imports.some(song => song.id === record.id)) continue;
        const adapted = adaptMidiForLaptop(parseMidi(record.bytes));
        imports.push({ id:record.id,title:record.title,composer:'Your MIDI · saved in this browser',difficulty:record.difficulty || 3,kind:'imported',events:adapted.notes,duration:adapted.duration,learningSeconds:40,persisted:true });
      } catch { /* A damaged personal file should not hide the rest. */ }
    }
    renderLibrary();
  } catch { /* Private browsing may not permit persistent storage. */ }
}

async function resumeCheckpoint() {
  const saved = savedCheckpoint();
  if (!saved) return;
  const song = library().find(item => item.id === saved.songId);
  if (!song) return;
  mode = saved.mode === 'learning' ? 'learning' : 'free';
  speed = [0.5,0.75,1,1.25].includes(saved.speed) ? saved.speed : 1;
  octave = Math.max(-2,Math.min(2,Number(saved.octave) || 0));
  $('#speed-select').value = String(speed);
  updateModeButtons();
  els.octave.textContent = `${midiName(60 + octave * 12)}–${midiName(74 + octave * 12)}`;
  renderKeyboard(); await selectSong(song,{allowShortFreeResume:true});
  session = new PracticeSession(selected,mode,speed,octave);
  if (saved.states?.length !== session.events.length) { session=null; resetSession(); return; }
  session.events.forEach((event,index) => { event.state = saved.states[index] === 'h' ? 'hit' : saved.states[index] === 'm' ? 'missed' : 'pending'; });
  session.elapsed = saved.elapsed;
  session.errors = saved.errors || 0;
  session.waiting = saved.waiting ?? null;
  resultSaved = false; paused = false;
  els.overlay.hidden = true; els.pause.disabled = false;
  els.status.textContent = session.waiting !== null ? 'PLAY THE HIGHLIGHTED KEY' : 'PLAYING';
  frameTime = performance.now(); renderNotes(); renderProgress(); updateTargetKey();
}

function updateModeButtons() {
  for (const [name,button] of [['free',$('#free-mode')],['learning',$('#learning-mode')]]) {
    button.classList.toggle('active',name === mode);
    button.setAttribute('aria-pressed',String(name === mode));
  }
  els.mode.textContent = mode === 'free' ? 'Free mode' : 'Learning mode'; updateTip();
  $('#library-intro').textContent = mode === 'free' ? 'Bundled pieces run at least one minute; your imports can vary.' : 'Full-score excerpts and short studies.';
  els.kind.textContent = scoreKindLabel(selected,!selected.events);
}

function setMode(value) {
  if (mode === value) return;
  mode = value;
  difficultyFilter = 0;
  els.search.value = '';
  renderFilters(); updateModeButtons();
  if (mode === 'free' && isLearningOnly(selected)) selectSong(lastFreeSong);
  else { resetSession(); updateRank(); }
}

document.addEventListener('keydown',event => {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  const tag = event.target?.tagName;
  if (['INPUT','TEXTAREA','SELECT'].includes(tag) || event.target?.isContentEditable) return;
  if (document.querySelector('dialog[open]')) return;
  const key = event.key.toLowerCase();
  const midi = keyboardMidi(key,octave);
  if (midi !== null) { event.preventDefault(); pressMidi(midi,`keyboard-${key}`); }
  else if (key === ' ') { event.preventDefault(); if (!session || session.finished || paused) startSession(); else togglePause(); }
  else if (key === 'arrowup') { event.preventDefault(); changeOctave(1); }
  else if (key === 'arrowdown') { event.preventDefault(); changeOctave(-1); }
});
document.addEventListener('keyup',event => releaseKey(`keyboard-${event.key.toLowerCase()}`));
window.addEventListener('blur',() => { for (const source of [...heldKeys.keys()]) releaseKey(source); });
window.addEventListener('pagehide',() => saveCheckpoint(true));
els.search.addEventListener('input',renderLibrary);
els.start.addEventListener('click',startSession);
$('#restart-button').addEventListener('click',() => { paused=false; session=null; startSession(); });
els.pause.addEventListener('click',togglePause);
$('#previous-song').addEventListener('click',() => changeSong(-1));
$('#next-song').addEventListener('click',() => changeSong(1));
$('#free-mode').addEventListener('click',() => setMode('free'));
$('#learning-mode').addEventListener('click',() => setMode('learning'));
$('#speed-select').addEventListener('change',event => { speed=Number(event.target.value); resetSession(); });
$('#sound-button').addEventListener('click',() => { audio.enabled=!audio.enabled; if (!audio.enabled) audio.stopAll(); $('#sound-button').textContent=audio.enabled?'♪':'♩'; $('#sound-button').setAttribute('aria-label',audio.enabled?'Mute sound':'Unmute sound'); });
$('#octave-down').addEventListener('click',() => changeOctave(-1));
$('#octave-up').addEventListener('click',() => changeOctave(1));
$('#help-button').addEventListener('click',() => $('#help-dialog').showModal());
$('#close-help').addEventListener('click',() => $('#help-dialog').close());
$('#got-it').addEventListener('click',() => $('#help-dialog').close());
$('#result-retry').addEventListener('click',() => { session=null; startSession(); });
$('#result-next').addEventListener('click',async () => { $('#result-dialog').close(); await changeSong(1); startSession(); });
function exitResults() {
  $('#result-dialog').close();
  resetSession();
  if (matchMedia('(max-width:760px)').matches) $('.library').scrollIntoView({behavior:'smooth',block:'start'});
}
$('#result-exit').addEventListener('click',exitResults);
$('#result-dialog').addEventListener('cancel',event => { event.preventDefault(); exitResults(); });
$('#import-midi').addEventListener('click',() => $('#midi-file').click());
$('#midi-file').addEventListener('change',event => { importMidi(event.target.files[0]); event.target.value=''; });

renderProfileLink(); renderFilters(); renderKeyboard(); updateModeButtons();
selectSong(selected).then(async () => {
  await restorePersonalSongs();
  if (new URLSearchParams(location.search).has('resume')) resumeCheckpoint();
});
frameTime = performance.now(); requestAnimationFrame(loop);
