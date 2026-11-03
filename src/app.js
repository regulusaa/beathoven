import { LEARNING_STEPS, MASTERY_ACCURACY, nextLearningStep } from './curriculum.js?v=20261020-mastery';
import { FULL_SCORES, FREE_SCORES } from './full-scores.js?v=20261020-mastery';
import { keyboardMidi, keyForMidi, keyPosition, midiName, isWhite, LAYOUTS, DEFAULT_LAYOUT, layoutRange } from './music.js?v=20261102-layouts';
import { PracticeSession, addResult, rankSummary, buildTimeline, buildPedalCues } from './practice.js?v=20261102-layouts';
import { PianoAudio } from './audio.js?v=20261102-layouts';
import { parseMidi, adaptMidiForLaptop } from './midi.js?v=20261102-layouts';
import { currentProfile, updateProfile } from './profiles.js';
import { loadPersonalSongs, savePersonalSong } from './personal-songs.js';

const $ = selector => document.querySelector(selector);
const els = {
  list: $('#song-list'), filters: $('#difficulty-filters'), search: $('#song-search'), count: $('#song-count'),
  title: $('#current-title'), composer: $('#current-composer'), difficulty: $('#song-difficulty-label'),
  kind: $('#song-kind-label'), bpm: $('#song-bpm'), sessionBpm: $('#session-bpm'), source: $('#score-source'),
  lessonBanner: $('#lesson-banner'), lessonPhase: $('#lesson-phase'), lessonInstruction: $('#lesson-instruction'),
  lessonTimer: $('#lesson-timer'),
  stage: $('#note-stage'), notes: $('#falling-notes'), keyboard: $('#piano-keyboard'), stageCard: $('.stage-card'),
  overlay: $('#stage-overlay'), start: $('#start-button'), feedback: $('#feedback'),
  layoutSelect: $('#layout-select'), pedalToggle: $('#pedal-toggle'), pedalLane: $('#pedal-lane'), pedalCues: $('#pedal-cues'),
  noteProgress: $('#note-progress'), progressFill: $('#progress-fill'), pause: $('#pause-button'),
  mode: $('#session-mode'), octave: $('#octave-label'), best: $('#best-accuracy'),
  tier: $('#rank-tier'), points: $('#rank-points'), unique: $('#unique-songs'), plays: $('#total-plays'),
  tipTitle: $('#tip-title'), tipCopy: $('#tip-copy'), profileLink: $('#profile-link')
};
const audio = new PianoAudio();
const imports = [];
const learningOnlyIds = new Set([...LEARNING_STEPS,...FULL_SCORES.filter(song => !FREE_SCORES.includes(song))].map(song => song.id));
const isLearningOnly = song => learningOnlyIds.has(song.id);
const library = () => [...FULL_SCORES, ...LEARNING_STEPS, ...imports];
const playableLibrary = () => mode === 'free' ? [...FREE_SCORES, ...imports] : LEARNING_STEPS;
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
const pedalKeys = new Set();
const noteNodes = new Map();
const cueNodes = new Map();
let previewCues = [];
let progress = currentProfile()?.progress || readGuestProgress();
let layout = readSetting('beathoven-layout-v1', value => value in LAYOUTS) || DEFAULT_LAYOUT;
let pedalChallenge = readSetting('beathoven-pedal-v1', value => value === 'on') === 'on';
const pedalActive = () => pedalChallenge && mode === 'free';

function readSetting(key, valid) {
  try { const value = localStorage.getItem(key); return valid(value) ? value : null; } catch { return null; }
}

function saveSetting(key, value) {
  try { localStorage.setItem(key, value); } catch { /* The choice still applies for this visit. */ }
}

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
    waiting: session.waiting, errors: session.errors, pedal: session.pedalChallenge,
    states: stateString(session.events), cueStates: stateString(session.cues),
    savedAt: new Date().toISOString()
  };
  try {
    if (currentProfile()) updateProfile({ checkpoint });
    else localStorage.setItem('beathoven-guest-checkpoint-v1', JSON.stringify(checkpoint));
  } catch { /* Quota or private mode: completed scores still have their own save. */ }
}

function stateString(items) {
  return items.map(item => item.state === 'hit' ? 'h' : item.state === 'missed' ? 'm' : 'p').join('');
}

function restoreStates(items, states) {
  items.forEach((item,index) => { item.state = states[index] === 'h' ? 'hit' : states[index] === 'm' ? 'missed' : 'pending'; });
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

function durationForSong(song) {
  return song.duration ?? (song.notes?.reduce((beats,note) => beats + note.beats,0) || 0) * 60 / song.bpm;
}

function formatBpm(song) {
  if (song.untimed) return 'No timer';
  if (!song.bpm) return 'BPM loading…';
  const [low,high] = song.bpmRange || [song.bpm,song.bpm];
  return high - low >= 5
    ? `${Math.round(low * speed)}–${Math.round(high * speed)} BPM`
    : `${Math.round(song.bpm * speed)} BPM`;
}

function renderTempo() {
  els.bpm.textContent = formatBpm(selected);
  els.sessionBpm.textContent = formatBpm(selected);
}

function renderLessonBanner() {
  els.lessonBanner.hidden = mode !== 'learning';
  els.lessonTimer.hidden = mode !== 'learning';
  if (mode !== 'learning') return;
  const step = LEARNING_STEPS.findIndex(item => item.id === selected.id) + 1;
  els.lessonPhase.textContent = `Step ${step} of ${LEARNING_STEPS.length} · ${selected.phase || 'Slow song'}`;
  els.lessonInstruction.textContent = selected.instruction || 'Follow the notes on the keyboard.';
}

function scoreKindLabel(song, loading = false) {
  if (song.kind === 'lesson') return song.untimed ? 'NOTE LESSON · NO TIMER' : 'TIMING LESSON';
  if (song.kind === 'study') return `SLOW SONG · ${formatDuration(durationForSong(song))}`;
  const type = song.kind === 'full' ? 'FULL PIECE' : 'YOUR MIDI';
  if (loading && song.kind === 'full' && !song.events) return `${type} · loading…`;
  const total = formatDuration(song.duration);
  return `${type} · ${total}`;
}

async function ensureScore(song) {
  if (song.midiUrl && !song.parsed) {
    if (!song.loadPromise) song.loadPromise = fetch(song.midiUrl)
      .then(response => { if (!response.ok) throw new Error('Score could not be loaded.'); return response.arrayBuffer(); })
      .then(buffer => { song.parsed = parseMidi(buffer); });
    try { await song.loadPromise; }
    catch (error) { song.loadPromise = null; throw error; }
  }
  adaptSong(song);
}

// Scores fold into the current layout's range, so they are re-adapted when it changes.
function adaptSong(song) {
  if (!song.parsed || song.adaptedFor === layout) return;
  const adaptation = adaptMidiForLaptop(song.parsed, layoutRange(layout).high);
  song.events = adaptation.notes;
  song.duration = adaptation.duration;
  song.sourceNoteCount = adaptation.sourceNoteCount;
  song.bpm = adaptation.bpm;
  song.bpmRange = adaptation.bpmRange;
  song.adaptedFor = layout;
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
  els.count.textContent = `${songs.length} ${mode === 'learning' ? 'STEPS' : 'PIECES'}`;
  $('#library-title').textContent = mode === 'learning' ? 'Learn piano' : 'Song library';
  els.list.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement('p'); empty.className = 'muted';
    empty.textContent = mode === 'free' ? 'No full pieces match. Try another search.' : 'No lessons match that search.';
    els.list.append(empty); return;
  }
  for (const song of visible) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `song-item${song.id === selected.id ? ' active' : ''}`;
    button.setAttribute('aria-current', song.id === selected.id ? 'true' : 'false');
    const art = document.createElement('span'); art.className = 'song-art'; art.textContent = song.kind === 'lesson' ? '♩' : song.kind === 'full' ? '♬' : '♫';
    const text = document.createElement('span'); text.className = 'song-text';
    const title = document.createElement('strong'); title.textContent = song.title;
    const detail = document.createElement('small');
    const duration = (song.duration || song.notes) ? formatDuration(durationForSong(song)) : 'Full piece';
    const result = song.kind === 'lesson' ? progress.lessons?.[song.id] : progress.songs[song.id];
    const best = result?.best;
    const tempo = song.untimed ? 'No timer' : song.bpm ? `${song.bpm} BPM` : duration;
    detail.textContent = mode === 'learning'
      ? `${song.kind === 'lesson' ? song.phase : 'Slow song'} · ${tempo}${best === undefined ? '' : ` · ${best}% best`}`
      : `${song.composer} · ${duration}${song.bpm ? ` · ${song.bpm} BPM` : ''}${best === undefined ? '' : ` · ${best}% best`}`;
    text.append(title, detail);
    const stars = document.createElement('span'); stars.className = 'song-stars'; stars.textContent = '★'.repeat(song.difficulty);
    button.append(art,text,stars);
    button.addEventListener('click', () => selectSong(song));
    els.list.append(button);
  }
}

const spokenKey = key => key === '↵' ? 'Enter' : key;

// Only the keys of the chosen layout are drawn, so the piano has no unused keys.
function renderKeyboard() {
  els.keyboard.replaceChildren();
  const { low, high } = layoutRange(layout);
  const start = low + octave * 12, end = high + octave * 12;
  els.stageCard.style.setProperty('--white-count', LAYOUTS[layout].keys.filter(key => isWhite(key.midi)).length);
  for (let midi = start; midi <= end; midi++) {
    if (!isWhite(midi)) continue;
    const key = keyForMidi(midi, octave, layout);
    const element = document.createElement('button'); element.type = 'button';
    element.className = 'white-key mapped-key';
    element.dataset.midi = midi;
    element.setAttribute('aria-label', `${midiName(midi)}, keyboard ${spokenKey(key)}`);
    const name = document.createElement('span'); name.className = 'key-name'; name.textContent = midiName(midi);
    const letter = document.createElement('span'); letter.className = `key-letter${key.length > 1 ? ' long-label' : ''}`; letter.textContent = key;
    element.append(name,letter); attachPointer(element,midi); els.keyboard.append(element);
  }
  for (let midi = start; midi <= end; midi++) {
    if (isWhite(midi)) continue;
    const key = keyForMidi(midi,octave,layout);
    const element = document.createElement('button'); element.type = 'button';
    element.className = `black-key mapped-key${key.length > 1 ? ' long-label' : ''}`;
    element.style.left = `${keyPosition(midi,octave,layout)}%`;
    element.dataset.midi = midi;
    element.setAttribute('aria-label', `${midiName(midi)}, keyboard ${spokenKey(key)}`);
    element.textContent = key;
    attachPointer(element,midi); els.keyboard.append(element);
  }
  updateTargetKey();
}

function renderOctaveControls() {
  const lessonAtMiddleC = mode === 'learning' && selected.kind === 'lesson';
  const { low, high } = layoutRange(layout);
  els.octave.textContent = `${midiName(low + octave * 12)}–${midiName(high + octave * 12)}`;
  $('#octave-down').disabled = lessonAtMiddleC || octave === -2;
  $('#octave-up').disabled = lessonAtMiddleC || octave === 2;
  $('.octave-note').textContent = lessonAtMiddleC
    ? 'Note lessons stay at middle C so the key names match the instructions.'
    : 'Shifts the keyboard and song together.';
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
  els.notes.replaceChildren(); noteNodes.clear();
  els.pedalCues.replaceChildren(); cueNodes.clear();
  positionNotes();
}

function stageGeometry() {
  const height = els.stage.clientHeight;
  return { elapsed: session?.elapsed ?? -2.25, height, lineY: height - 26, pixelsPerSecond: Math.max(42,height * .16) };
}

function positionNotes() {
  positionPedalCues();
  const events = session?.events ?? preview;
  if (!events.length) return;
  const { elapsed, height, lineY, pixelsPerSecond } = stageGeometry();
  const target = session?.mode === 'learning' ? session.target : null;
  let low = 0, high = events.length;
  while (low < high) { const mid = (low + high) >> 1; if (events[mid].start < elapsed - 15) low = mid + 1; else high = mid; }
  const visible = new Set();
  for (let i = low; i < events.length; i++) {
    const event = events[i];
    if (event.start > elapsed + height / pixelsPerSecond + 4) break;
    if (event.midi === null) continue;
    const position = keyPosition(event.midi,octave,layout);
    if (position === null) continue;
    const barHeight = Math.max(10,event.duration * pixelsPerSecond);
    const bottom = lineY - (event.start - elapsed) * pixelsPerSecond;
    const top = bottom - barHeight;
    if (top > height + 5 || bottom < -5) continue;
    // A held note is eaten by the hit line, so the bar shrinks as it is held.
    const holding = event.holdState === 'holding';
    const shownBottom = holding ? Math.min(bottom,lineY) : bottom;
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
    element.style.height = `${Math.max(0,shownBottom - top)}px`;
    element.classList.toggle('hold', !!event.hold);
    element.classList.toggle('holding', holding);
    element.classList.toggle('hold-broken', event.holdState === 'broken');
    element.classList.toggle('hit', event.state === 'hit');
    element.classList.toggle('missed', event.state === 'missed');
    element.classList.toggle('target', target?.index === event.index && session.waiting !== null);
  }
  for (const [index,element] of noteNodes) {
    if (!visible.has(index)) { element.remove(); noteNodes.delete(index); }
  }
}

function positionPedalCues() {
  const cues = session?.cues ?? previewCues;
  els.pedalLane.classList.toggle('down', pedalKeys.size > 0 && pedalActive());
  if (!cues.length) return;
  const { elapsed, height, lineY, pixelsPerSecond } = stageGeometry();
  const visible = new Set();
  for (const cue of cues) {
    const bottom = lineY - (cue.start - elapsed) * pixelsPerSecond;
    const top = bottom - cue.duration * pixelsPerSecond;
    if (bottom < -5) break;
    if (top > height + 5) continue;
    visible.add(cue.index);
    let element = cueNodes.get(cue.index);
    if (!element) {
      element = document.createElement('div'); element.className = 'pedal-cue';
      els.pedalCues.append(element); cueNodes.set(cue.index,element);
    }
    const holding = cue.holdState === 'holding';
    element.style.top = `${top}px`;
    element.style.height = `${Math.max(0,(holding ? Math.min(bottom,lineY) : bottom) - top)}px`;
    element.classList.toggle('holding', holding);
    element.classList.toggle('hit', cue.state === 'hit');
    element.classList.toggle('missed', cue.state === 'missed' || cue.holdState === 'broken');
  }
  for (const [index,element] of cueNodes) {
    if (!visible.has(index)) { element.remove(); cueNodes.delete(index); }
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
  const best = (selected.kind === 'lesson' ? progress.lessons?.[selected.id] : progress.songs[selected.id])?.best;
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
    ? [selected.kind === 'lesson' ? selected.phase : 'Practice a slow song', selected.instruction || 'Learning mode waits for the correct note.']
    : ['Play the whole piece', pedalActive()
      ? 'Hold Shift as the sustain pedal while a yellow cue passes the line, then lift and press again for the next one.'
      : 'Free mode runs from the first note to the last. Keep long bars held until they finish for full credit.'];
  els.tipTitle.textContent = tips[0]; els.tipCopy.textContent = tips[1];
}

function showFeedback(message,bad = false) {
  els.feedback.textContent = message; els.feedback.classList.toggle('bad',bad); els.feedback.classList.add('show');
  clearTimeout(feedbackTimer); feedbackTimer = setTimeout(() => els.feedback.classList.remove('show'),1200);
}

function renderLessonTimer() {
  if (mode !== 'learning') return;
  if (session?.finished) { els.lessonTimer.textContent = 'STEP COMPLETE'; return; }
  if (!session) {
    els.lessonTimer.textContent = selected.untimed ? 'NO TIMER' : `${formatBpm(selected)} · READY`;
    return;
  }
  const target = session.target;
  if (!target) { els.lessonTimer.textContent = 'LAST NOTE DONE'; return; }
  const key = keyForMidi(target.midi,octave,layout);
  const note = `${midiName(target.midi)}${key ? ` (${key})` : ''}`;
  if (selected.untimed || session.waiting !== null) {
    els.lessonTimer.textContent = `PLAY ${note}`;
  } else if (session.elapsed < 0) {
    els.lessonTimer.textContent = `START IN ${Math.max(0,-session.elapsed).toFixed(1)}s`;
  } else {
    const remaining = target.start - session.elapsed;
    els.lessonTimer.textContent = remaining > .05 ? `${note} IN ${remaining.toFixed(1)}s` : `PLAY ${note} NOW`;
  }
}

function resetSession() {
  audio.stopAll(); heldKeys.clear();
  if (pedalActive() && pedalKeys.size) audio.setPedal(true);
  for (const element of els.keyboard.querySelectorAll('.pressed')) element.classList.remove('pressed');
  session = null; paused = false; resultSaved = false;
  preview = selected.events || selected.notes ? buildTimeline(selected,speed,octave,mode) : [];
  previewCues = pedalActive() ? buildPedalCues(preview) : [];
  els.overlay.hidden = false;
  els.overlay.querySelector('strong').textContent = selected.kind === 'lesson' ? selected.title : 'Ready when you are.';
  els.overlay.querySelector('span').textContent = !preview.length ? 'Loading the score…'
    : selected.untimed ? 'Find the highlighted key. There is no timer.'
      : mode === 'learning' ? `Watch the beat at ${formatBpm(selected)}.`
        : pedalActive() ? 'Follow the notes down to your keys. Hold Shift on the yellow pedal cues.' : 'Follow the notes down to your keys.';
  els.start.innerHTML = selected.kind === 'lesson' ? 'Start lesson <span>→</span>' : 'Start playing <span>→</span>';
  els.start.disabled = !preview.length;
  els.pause.disabled = true; els.pause.querySelector('span').textContent = 'Pause';
  renderNotes(); renderProgress(); updateTargetKey(); renderLessonTimer();
}

async function selectSong(song,{allowShortFreeResume = false,preserveSpeed = false} = {}) {
  if (mode === 'free' && isLearningOnly(song) && !allowShortFreeResume) return;
  if (mode === 'learning' && !LEARNING_STEPS.some(step => step.id === song.id)) return;
  const serial = ++loadingSerial;
  if (mode === 'learning' && song.id !== selected.id && !preserveSpeed) {
    speed = 1;
    $('#speed-select').value = '1';
  }
  if (mode === 'learning' && song.kind === 'lesson' && octave !== 0) {
    octave = 0;
    renderKeyboard();
  }
  selected = song;
  renderOctaveControls();
  if (mode === 'free' && !isLearningOnly(song)) lastFreeSong = song;
  els.title.textContent = song.title;
  els.composer.textContent = song.composer;
  els.difficulty.textContent = `${'★'.repeat(song.difficulty)} ${['','BEGINNER','EASY','INTERMEDIATE','ADVANCED'][song.difficulty]}`;
  els.source.hidden = !song.sourceUrl;
  if (song.sourceUrl) els.source.href = song.sourceUrl;
  els.kind.textContent = scoreKindLabel(song,true);
  renderTempo(); renderLessonBanner(); resetSession(); updateTip(); updateRank();
  try {
    await ensureScore(song);
    if (serial !== loadingSerial) return;
    els.kind.textContent = scoreKindLabel(song);
    renderTempo(); resetSession(); updateRank();
  } catch(error) {
    if (serial !== loadingSerial) return;
    els.overlay.querySelector('strong').textContent = 'Could not load this score.';
    els.overlay.querySelector('span').textContent = error.message;
    showFeedback(error.message,true);
  }
}

async function changeSong(direction) {
  const songs = playableLibrary(); const index = songs.findIndex(song => song.id === selected.id);
  const next = index < 0 ? (direction > 0 ? 0 : songs.length - 1)
    : mode === 'learning' ? Math.max(0,Math.min(songs.length - 1,index + direction))
      : (index + direction + songs.length) % songs.length;
  await selectSong(songs[next]);
}

async function startSession() {
  if ($('#result-dialog').open) $('#result-dialog').close();
  if (session && paused) {
    paused = false; session.playing = true; els.overlay.hidden = true;
    els.pause.querySelector('span').textContent = 'Pause';
    frameTime = performance.now(); return;
  }
  try { await ensureScore(selected); } catch(error) { showFeedback(error.message,true); return; }
  session = new PracticeSession(selected,mode,speed,octave,{ pedal: pedalActive() });
  session.elapsed = selected.untimed ? 0 : -Math.max(1.6, 3 * 60 / ((selected.bpm || 90) * speed));
  resultSaved = false; els.overlay.hidden = true; els.pause.disabled = false;
  frameTime = performance.now();
  renderNotes(); renderProgress(); updateTargetKey(); renderLessonTimer(); saveCheckpoint(true);
  audio.unlock().catch(() => {});
}

function togglePause() {
  if (!session || session.finished) return;
  paused = !paused; session.playing = !paused; els.overlay.hidden = !paused;
  if (paused) {
    els.overlay.querySelector('strong').textContent = 'Take a breath.';
    els.overlay.querySelector('span').textContent = 'Resume when you are ready.';
    els.start.innerHTML = 'Resume playing <span>→</span>';
    saveCheckpoint(true);
  } else frameTime = performance.now();
  els.pause.querySelector('span').textContent = paused ? 'Resume' : 'Pause';
}

function finishSession() {
  if (!session || resultSaved) return;
  resultSaved = true; audio.stopAll();
  progress = addResult(progress,selected,mode,session.accuracy);
  saveProgressAndClearCheckpoint(); updateRank(); renderProgress();
  $('#result-heading').textContent = selected.kind === 'lesson' ? 'LESSON COMPLETE' : 'SONG COMPLETE';
  $('#result-title').textContent = session.accuracy >= 90 ? 'Beautifully played.' : session.accuracy >= 60 ? 'Nice progress.' : 'Keep practicing.';
  const difficulty = $('#result-difficulty');
  difficulty.textContent = '★'.repeat(selected.difficulty);
  difficulty.setAttribute('aria-label', `${selected.difficulty}-star ${selected.kind === 'lesson' ? 'lesson' : 'song'} difficulty`);
  $('#result-accuracy').textContent = `${session.accuracy}%`;
  $('#result-detail').textContent = mode === 'free'
    ? `${session.hits} of ${session.total} notes played on time${session.cues.length ? ` · ${session.cueHits} of ${session.cues.length} pedal cues` : ''} · ${selected.title}`
    : `${session.total} ${session.total === 1 ? 'note' : 'notes'} ${selected.kind === 'lesson' ? 'learned' : 'practiced'} · ${session.errors} ${session.errors === 1 ? 'retry' : 'retries'} · ${session.accuracy >= MASTERY_ACCURACY ? 'Step mastered' : `${MASTERY_ACCURACY}% needed to master`}`;
  $('#result-retry').innerHTML = `${selected.kind === 'lesson' ? 'Practice again' : 'Play again'} <span>↺</span>`;
  $('#result-next').textContent = mode === 'learning'
    ? selected.id === LEARNING_STEPS.at(-1).id ? 'Review lessons →' : 'Next step →'
    : 'Next song →';
  $('#result-exit').setAttribute('aria-label',mode === 'learning' ? 'Exit results and return to the learning path' : 'Exit results and return to the song library');
  renderLessonTimer();
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
      const key = target ? keyForMidi(target.midi,octave,layout) : null;
      showFeedback(`Try ${target ? midiName(target.midi) : 'the highlighted note'}${key ? ` · ${key}` : ''}`,true);
    }
    updateTargetKey(); renderProgress(); positionNotes(); renderLessonTimer(); saveCheckpoint();
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
    if (session && !session.finished && session.release(midi) === 'broken') showFeedback('Hold it longer',true);
  }
}

function setPedalKey(code,down) {
  const wasDown = pedalKeys.size > 0;
  if (down) pedalKeys.add(code); else pedalKeys.delete(code);
  if (wasDown === pedalKeys.size > 0 || !pedalActive()) return;
  audio.setPedal(!wasDown);
  if (!session || paused || session.finished) return;
  const result = session.pedal(!wasDown);
  if (result === 'hit') showFeedback('Pedal!');
  else if (result === 'broken') showFeedback('Keep the pedal down',true);
  renderProgress(); saveCheckpoint();
  if (session.finished) finishSession();
}

function renderPedalToggle() {
  els.pedalToggle.classList.toggle('active',pedalChallenge);
  els.pedalToggle.setAttribute('aria-pressed',String(pedalChallenge));
  els.pedalToggle.disabled = mode !== 'free';
  els.pedalToggle.title = mode !== 'free' ? 'The pedal challenge is part of Free mode'
    : pedalChallenge ? 'Pedal challenge on: hold Shift on the yellow cues' : 'Pedal challenge: use Shift as a sustain pedal';
  els.pedalLane.hidden = !pedalActive();
}

function togglePedalChallenge() {
  pedalChallenge = !pedalChallenge;
  saveSetting('beathoven-pedal-v1',pedalChallenge ? 'on' : 'off');
  renderPedalToggle(); updateTip(); resetSession();
  showFeedback(pedalChallenge ? 'Pedal challenge on · hold Shift on the yellow cues' : 'Pedal challenge off');
}

function changeLayout(value) {
  if (!(value in LAYOUTS) || value === layout) return;
  for (const source of [...heldKeys.keys()]) releaseKey(source);
  layout = value;
  saveSetting('beathoven-layout-v1',value);
  for (const song of library()) adaptSong(song);
  renderKeyboard(); renderOctaveControls(); renderTempo(); resetSession(); renderLibrary();
}

function changeOctave(delta) {
  if (mode === 'learning' && selected.kind === 'lesson') return;
  const next = Math.max(-2,Math.min(2,octave + delta));
  if (next === octave) return;
  const difference = next - octave;
  for (const source of [...heldKeys.keys()]) releaseKey(source);
  octave = next;
  renderOctaveControls();
  if (session) {
    session.events.forEach(event => { if (event.midi !== null) event.midi += 12 * difference; });
    session.holding = new Map([...session.holding.values()].map(event => [event.midi,event]));
  }
  preview = selected.events || selected.notes ? buildTimeline(selected,speed,octave,mode) : [];
  renderKeyboard(); renderNotes(); renderLessonTimer(); saveCheckpoint(true);
}

function loop(now) {
  const delta = Math.min(.1,Math.max(0,(now - frameTime) / 1000)); frameTime = now;
  if (session && !paused && !session.finished) {
    session.advance(delta);
    renderProgress(); updateTargetKey(); renderLessonTimer(); saveCheckpoint();
    if (session.finished) finishSession();
  }
  positionNotes(); requestAnimationFrame(loop);
}

async function importMidi(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { showFeedback('Choose a MIDI file smaller than 10 MB.',true); return; }
  try {
    const bytes = await file.arrayBuffer();
    const parsed = parseMidi(bytes);
    const adapted = adaptMidiForLaptop(parsed,layoutRange(layout).high);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
    const id = `import-${[...digest.slice(0,8)].map(x => x.toString(16).padStart(2,'0')).join('')}`;
    const song = { id,title:file.name.replace(/\.(mid|midi)$/i,'').slice(0,80),composer:'Your MIDI · saved in this browser',difficulty:3,kind:'imported',events:adapted.notes,duration:adapted.duration,bpm:adapted.bpm,bpmRange:adapted.bpmRange,parsed,adaptedFor:layout };
    let saved = true;
    try { await savePersonalSong(song,bytes); }
    catch { saved = false; }
    song.persisted = saved;
    const existing = imports.findIndex(item => item.id === id);
    if (existing >= 0) imports.splice(existing,1);
    imports.push(song);
    if (mode === 'learning') {
      mode = 'free'; difficultyFilter = 0; els.search.value = '';
      renderFilters(); updateModeButtons();
    }
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
        const parsed = parseMidi(record.bytes);
        const adapted = adaptMidiForLaptop(parsed,layoutRange(layout).high);
        imports.push({ id:record.id,title:record.title,composer:'Your MIDI · saved in this browser',difficulty:record.difficulty || 3,kind:'imported',events:adapted.notes,duration:adapted.duration,bpm:adapted.bpm,bpmRange:adapted.bpmRange,parsed,adaptedFor:layout,persisted:true });
      } catch { /* A damaged personal file should not hide the rest. */ }
    }
    renderLibrary();
  } catch { /* Private browsing may not permit persistent storage. */ }
}

async function resumeCheckpoint() {
  const saved = savedCheckpoint();
  if (!saved) return;
  const song = library().find(item => item.id === saved.songId);
  if (!song || (saved.mode === 'learning' && !LEARNING_STEPS.some(step => step.id === song.id))) return;
  mode = saved.mode === 'learning' ? 'learning' : 'free';
  speed = [0.5,0.75,1,1.25].includes(saved.speed) ? saved.speed : 1;
  octave = Math.max(-2,Math.min(2,Number(saved.octave) || 0));
  if (mode === 'free') pedalChallenge = !!saved.pedal;
  $('#speed-select').value = String(speed);
  updateModeButtons();
  renderOctaveControls();
  renderKeyboard(); await selectSong(song,{allowShortFreeResume:true,preserveSpeed:true});
  session = new PracticeSession(selected,mode,speed,octave,{ pedal: pedalActive() });
  if (saved.states?.length !== session.events.length) { session=null; resetSession(); return; }
  restoreStates(session.events,saved.states);
  if (saved.cueStates?.length === session.cues.length) restoreStates(session.cues,saved.cueStates);
  else session.cues.forEach(cue => { if (cue.start < saved.elapsed) cue.state = 'missed'; });
  session.elapsed = saved.elapsed;
  session.errors = saved.errors || 0;
  session.waiting = saved.waiting ?? null;
  resultSaved = false; paused = false;
  els.overlay.hidden = true; els.pause.disabled = false;
  frameTime = performance.now(); renderNotes(); renderProgress(); updateTargetKey(); renderLessonTimer();
}

function updateModeButtons() {
  for (const [name,button] of [['free',$('#free-mode')],['learning',$('#learning-mode')]]) {
    button.classList.toggle('active',name === mode);
    button.setAttribute('aria-pressed',String(name === mode));
  }
  els.mode.textContent = mode === 'free' ? 'Free mode' : 'Learning mode'; updateTip();
  $('#library-intro').textContent = mode === 'free' ? 'Bundled pieces run at least one minute; your imports can vary.' : 'Start with single notes, then timed practice and slow songs.';
  els.kind.textContent = scoreKindLabel(selected,!selected.events);
  renderLessonBanner(); renderTempo(); renderLessonTimer(); renderPedalToggle();
}

function setMode(value) {
  if (mode === value) return;
  mode = value;
  difficultyFilter = 0;
  els.search.value = '';
  renderFilters(); updateModeButtons();
  selectSong(mode === 'learning' ? nextLearningStep(progress) : lastFreeSong);
}

document.addEventListener('keydown',event => {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  const tag = event.target?.tagName;
  if (['INPUT','TEXTAREA','SELECT'].includes(tag) || event.target?.isContentEditable) return;
  if (document.querySelector('dialog[open]')) return;
  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') { setPedalKey(event.code,true); return; }
  // Enter still activates a focused button or link.
  if (event.code === 'Enter' && event.target?.closest?.('button,a')) return;
  const key = event.key.toLowerCase();
  const midi = keyboardMidi(event.code,octave,layout);
  if (midi !== null) { event.preventDefault(); pressMidi(midi,`keyboard-${event.code}`); }
  else if (key === ' ') { event.preventDefault(); if (!session || session.finished || paused) startSession(); else togglePause(); }
  else if (key === 'arrowup') { event.preventDefault(); changeOctave(1); }
  else if (key === 'arrowdown') { event.preventDefault(); changeOctave(-1); }
});
document.addEventListener('keyup',event => {
  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') setPedalKey(event.code,false);
  else releaseKey(`keyboard-${event.code}`);
});
window.addEventListener('blur',() => {
  for (const source of [...heldKeys.keys()]) releaseKey(source);
  for (const code of [...pedalKeys]) setPedalKey(code,false);
});
window.addEventListener('pagehide',() => saveCheckpoint(true));
els.search.addEventListener('input',renderLibrary);
els.start.addEventListener('click',startSession);
$('#restart-button').addEventListener('click',() => { paused=false; session=null; startSession(); });
els.pause.addEventListener('click',togglePause);
$('#previous-song').addEventListener('click',() => changeSong(-1));
$('#next-song').addEventListener('click',() => changeSong(1));
$('#free-mode').addEventListener('click',() => setMode('free'));
$('#learning-mode').addEventListener('click',() => setMode('learning'));
$('#speed-select').addEventListener('change',event => { speed=Number(event.target.value); renderTempo(); resetSession(); event.target.blur(); });
els.layoutSelect.addEventListener('change',event => { changeLayout(event.target.value); event.target.blur(); });
els.pedalToggle.addEventListener('click',togglePedalChallenge);
$('#sound-button').addEventListener('click',() => { audio.enabled=!audio.enabled; if (!audio.enabled) audio.stopAll(); $('#sound-button').textContent=audio.enabled?'♪':'♩'; $('#sound-button').setAttribute('aria-label',audio.enabled?'Mute sound':'Unmute sound'); });
$('#octave-down').addEventListener('click',() => changeOctave(-1));
$('#octave-up').addEventListener('click',() => changeOctave(1));
$('#help-button').addEventListener('click',() => $('#help-dialog').showModal());
$('#hear-note').addEventListener('click',() => {
  const target = session?.target || preview.find(event => event.midi !== null);
  if (target) audio.preview(target.midi).catch(() => showFeedback('Sound is unavailable on this device.',true));
});
$('#close-help').addEventListener('click',() => $('#help-dialog').close());
$('#got-it').addEventListener('click',() => $('#help-dialog').close());
$('#result-retry').addEventListener('click',() => { session=null; startSession(); });
$('#result-next').addEventListener('click',async () => {
  $('#result-dialog').close();
  if (mode === 'learning' && selected.id === LEARNING_STEPS.at(-1).id) await selectSong(LEARNING_STEPS[0]);
  else await changeSong(1);
  startSession();
});
function exitResults() {
  $('#result-dialog').close();
  resetSession();
  if (matchMedia('(max-width:760px)').matches) $('.library').scrollIntoView({behavior:'smooth',block:'start'});
}
$('#result-exit').addEventListener('click',exitResults);
$('#result-dialog').addEventListener('cancel',event => { event.preventDefault(); exitResults(); });
$('#import-midi').addEventListener('click',() => $('#midi-file').click());
$('#midi-file').addEventListener('change',event => { importMidi(event.target.files[0]); event.target.value=''; });

els.layoutSelect.value = layout;
renderProfileLink(); renderFilters(); renderKeyboard(); renderOctaveControls(); updateModeButtons();
selectSong(selected).then(async () => {
  await restorePersonalSongs();
  const params = new URLSearchParams(location.search);
  if (params.has('resume')) resumeCheckpoint();
  else if (params.has('learn')) setMode('learning');
});
frameTime = performance.now(); requestAnimationFrame(loop);
