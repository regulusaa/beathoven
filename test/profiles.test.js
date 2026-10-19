import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfile, signIn, signOut, currentProfile, updateProfile, listProfiles } from '../src/profiles.js';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key,value) { this.values.set(key,String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test('device-local profile signs in and automatically retains progress/checkpoint', async () => {
  globalThis.localStorage = new MemoryStorage();
  globalThis.sessionStorage = new MemoryStorage();
  const created = await createProfile('Pianist','1234');
  assert.equal(created.name,'Pianist');
  assert.equal(listProfiles().length,1);
  const progress = { songs:{moonlight:{best:80,plays:1,difficulty:4}},totalPlays:1 };
  updateProfile({ progress,checkpoint:{songId:'moonlight',elapsed:21} });
  signOut();
  assert.equal(currentProfile(),null);
  await assert.rejects(signIn('Pianist','0000'));
  const signedIn = await signIn('Pianist','1234');
  assert.deepEqual(signedIn.progress,progress);
  assert.equal(signedIn.checkpoint.elapsed,21);
});
