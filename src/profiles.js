// Device-local profiles. A server is required for real remote accounts/sync.
const KEY = 'beathoven-profiles-v1';
const ACTIVE = 'beathoven-active-profile-v1';
const LEGACY = 'beathoven-progress-v1';

function database() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    if (value && Array.isArray(value.profiles)) return value;
  } catch { /* Start with an empty profile list. */ }
  return { profiles: [] };
}

function persist(data) { localStorage.setItem(KEY, JSON.stringify(data)); }
function cleanProfile(profile) {
  if (!profile) return null;
  const { pinHash, salt, ...publicFields } = profile;
  return structuredClone(publicFields);
}
function hex(bytes) { return [...bytes].map(byte => byte.toString(16).padStart(2,'0')).join(''); }

async function hashPin(pin, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', salt: Uint8Array.from(salt.match(/.{2}/g).map(part => parseInt(part,16))), iterations: 120000, hash:'SHA-256' }, key, 256);
  return hex(new Uint8Array(bits));
}

export function listProfiles() { return database().profiles.map(cleanProfile); }

export function currentProfile() {
  const id = sessionStorage.getItem(ACTIVE);
  return cleanProfile(database().profiles.find(profile => profile.id === id));
}

export async function createProfile(name, pin) {
  const trimmed = name.trim().slice(0,32);
  if (trimmed.length < 2) throw new Error('Choose a name with at least 2 characters.');
  if (!/^\d{4,12}$/.test(pin)) throw new Error('Choose a PIN with 4–12 digits.');
  const data = database();
  if (data.profiles.some(profile => profile.name.toLowerCase() === trimmed.toLowerCase())) throw new Error('That profile name already exists on this browser.');
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  let legacy = { songs:{}, totalPlays:0 };
  if (data.profiles.length === 0) {
    try { const saved = JSON.parse(localStorage.getItem(LEGACY)); if (saved?.songs) legacy = saved; } catch { /* No earlier progress. */ }
  }
  const profile = { id:crypto.randomUUID(), name:trimmed, salt, pinHash:await hashPin(pin,salt), avatar:null, progress:legacy, checkpoint:null, createdAt:new Date().toISOString() };
  data.profiles.push(profile);
  persist(data);
  sessionStorage.setItem(ACTIVE, profile.id);
  return cleanProfile(profile);
}

export async function signIn(name, pin) {
  const profile = database().profiles.find(item => item.name.toLowerCase() === name.trim().toLowerCase());
  if (!profile || await hashPin(pin,profile.salt) !== profile.pinHash) throw new Error('Name or PIN is incorrect.');
  sessionStorage.setItem(ACTIVE,profile.id);
  return cleanProfile(profile);
}

export function signOut() { sessionStorage.removeItem(ACTIVE); }

export function updateProfile(patch) {
  const id = sessionStorage.getItem(ACTIVE);
  if (!id) throw new Error('Sign in to save your profile.');
  const data = database();
  const profile = data.profiles.find(item => item.id === id);
  if (!profile) throw new Error('Profile not found.');
  if ('progress' in patch) profile.progress = patch.progress;
  if ('checkpoint' in patch) profile.checkpoint = patch.checkpoint;
  if ('avatar' in patch) profile.avatar = patch.avatar;
  persist(data);
  return cleanProfile(profile);
}

export async function imageToAvatar(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Choose an image file.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Choose an image smaller than 8 MB.');
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise((resolve,reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('This image could not be opened.'));
      image.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 180;
  const ctx = canvas.getContext('2d');
  const side = Math.min(image.width,image.height);
  ctx.drawImage(image,(image.width-side)/2,(image.height-side)/2,side,side,0,0,180,180);
  return canvas.toDataURL('image/jpeg',.8);
}
