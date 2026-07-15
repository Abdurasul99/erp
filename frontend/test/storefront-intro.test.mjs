import test from 'node:test';
import assert from 'node:assert/strict';

async function loadIntroState() {
  try {
    return await import('../src/store/storeIntro.mjs');
  } catch (error) {
    assert.fail(`Store intro state module is missing: ${error.code || error.message}`);
  }
}

test('first session requests the store intro', async () => {
  const { shouldShowStoreIntro } = await loadIntroState();
  const storage = { getItem: () => null };

  assert.equal(shouldShowStoreIntro(storage), true);
});

test('completed session skips the store intro', async () => {
  const { shouldShowStoreIntro } = await loadIntroState();
  const storage = { getItem: () => 'seen' };

  assert.equal(shouldShowStoreIntro(storage), false);
});

test('restricted storage falls back to the store intro', async () => {
  const { shouldShowStoreIntro } = await loadIntroState();
  const storage = { getItem: () => { throw new Error('blocked'); } };

  assert.equal(shouldShowStoreIntro(storage), true);
});

test('intro completion persists for the session', async () => {
  const { markStoreIntroSeen } = await loadIntroState();
  let savedEntry;
  const storage = { setItem: (key, value) => { savedEntry = [key, value]; } };

  assert.equal(markStoreIntroSeen(storage), true);
  assert.deepEqual(savedEntry, ['art-store-intro', 'seen']);
});
