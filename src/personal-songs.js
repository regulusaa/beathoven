// Personal MIDI files are kept in this browser. Nothing is uploaded or bundled.
const DATABASE = 'beathoven-personal-songs-v1';
const STORE = 'midi-files';

function openDatabase() {
  return new Promise((resolve,reject) => {
    if (!globalThis.indexedDB) { reject(new Error('This browser cannot save personal songs.')); return; }
    const request = indexedDB.open(DATABASE,1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE,{keyPath:'id'});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open personal songs.'));
  });
}

export async function loadPersonalSongs() {
  const database = await openDatabase();
  try {
    return await new Promise((resolve,reject) => {
      const transaction = database.transaction(STORE,'readonly');
      const request = transaction.objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not load personal songs.'));
    });
  } finally { database.close(); }
}

export async function savePersonalSong(song,bytes) {
  const database = await openDatabase();
  try {
    await new Promise((resolve,reject) => {
      const transaction = database.transaction(STORE,'readwrite');
      transaction.objectStore(STORE).put({
        id:song.id, title:song.title, difficulty:song.difficulty,
        bytes, savedAt:new Date().toISOString()
      });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error('Could not save this MIDI file.'));
      transaction.onabort = () => reject(transaction.error || new Error('Could not save this MIDI file.'));
    });
  } finally { database.close(); }
}
