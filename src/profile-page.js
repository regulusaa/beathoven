import { SONGS } from './songs.js';
import { FULL_SCORES } from './full-scores.js';
import { rankSummary } from './practice.js';
import { listProfiles, currentProfile, createProfile, signIn, signOut, updateProfile, imageToAvatar } from './profiles.js';

const $ = selector => document.querySelector(selector);
const allSongs = [...FULL_SCORES,...SONGS];

function showTab(tab) {
  $('#signin-form').hidden = tab !== 'signin';
  $('#create-form').hidden = tab !== 'create';
  $('#signin-tab').classList.toggle('active',tab === 'signin');
  $('#create-tab').classList.toggle('active',tab === 'create');
  $('#auth-error').textContent = '';
}

function render() {
  const profile = currentProfile();
  $('#auth-panel').hidden = !!profile;
  $('#profile-panel').hidden = !profile;
  if (!profile) {
    showTab(listProfiles().length ? 'signin' : 'create');
    return;
  }
  $('#profile-name').textContent = profile.name;
  $('#profile-since').textContent = `Member since ${new Date(profile.createdAt).toLocaleDateString(undefined,{month:'long',year:'numeric'})} · Saved on this browser`;
  const avatar = $('#avatar'); avatar.replaceChildren();
  if (profile.avatar) {
    const img = document.createElement('img'); img.src = profile.avatar; img.alt = `${profile.name}'s profile picture`; avatar.append(img);
  } else avatar.textContent = profile.name[0].toUpperCase();
  const summary = rankSummary(profile.progress);
  $('#profile-rank').textContent = summary.tier;
  $('#profile-points').textContent = summary.points.toLocaleString();
  $('#profile-songs').textContent = summary.unique;
  $('#profile-plays').textContent = summary.totalPlays;
  const checkpoint = profile.checkpoint;
  $('#resume-card').hidden = !checkpoint;
  if (checkpoint) {
    const song = allSongs.find(item => item.id === checkpoint.songId);
    $('#resume-title').textContent = song?.title || checkpoint.songTitle || checkpoint.songId;
    const elapsed = Math.max(0, Math.floor(checkpoint.elapsed));
    $('#resume-detail').textContent = `${checkpoint.mode === 'learning' ? 'Learning' : 'Free'} mode · ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2,'0')} saved`;
  }
  const history = $('#profile-history'); history.replaceChildren();
  const entries = Object.entries(profile.progress?.songs || {}).sort((a,b) => (b[1].lastPlayed || '').localeCompare(a[1].lastPlayed || ''));
  if (!entries.length) { const empty=document.createElement('div'); empty.className='history-empty'; empty.textContent='Your first completed song will appear here.'; history.append(empty); }
  for (const [id,result] of entries) {
    const song = allSongs.find(item => item.id === id);
    const row = document.createElement('div'); row.className='history-row';
    const icon = document.createElement('span'); icon.className='history-icon'; icon.textContent='♫';
    const name = document.createElement('span'); name.className='history-name';
    const strong=document.createElement('strong'); strong.textContent=song?.title || result.title || id;
    const small=document.createElement('small'); small.textContent=`${result.plays} ${result.plays===1?'play':'plays'} · ${'★'.repeat(result.difficulty || song?.difficulty || 1)}`;
    name.append(strong,small);
    const score=document.createElement('span'); score.className='history-score'; score.textContent=`${result.best}%`;
    row.append(icon,name,score); history.append(row);
  }
}

$('#signin-tab').addEventListener('click', () => showTab('signin'));
$('#create-tab').addEventListener('click', () => showTab('create'));
$('#signin-form').addEventListener('submit', async event => {
  event.preventDefault(); const data = new FormData(event.target);
  try { await signIn(data.get('name'),data.get('pin')); event.target.reset(); render(); }
  catch(error) { $('#auth-error').textContent=error.message; }
});
$('#create-form').addEventListener('submit', async event => {
  event.preventDefault(); const data = new FormData(event.target);
  try { await createProfile(data.get('name'),data.get('pin')); event.target.reset(); render(); }
  catch(error) { $('#auth-error').textContent=error.message; }
});
$('#signout-button').addEventListener('click', () => { signOut(); render(); });
$('#avatar-change').addEventListener('click', () => $('#avatar-upload').click());
$('#avatar-upload').addEventListener('change', async event => {
  $('#avatar-error').textContent = '';
  try { const file=event.target.files[0]; if (file) { updateProfile({avatar:await imageToAvatar(file)}); render(); } }
  catch(error) { $('#avatar-error').textContent = error.message; }
  event.target.value='';
});
render();
