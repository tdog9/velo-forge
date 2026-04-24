// Firestore rules tests. Run against the Firestore emulator:
//   npx firebase emulators:exec --only firestore "node --test tests/rules.test.mjs"
//
// Covers the scenarios the production bugs came from:
// - teams/create rejects orphan creators (not in members)
// - teams/update allows self-join (non-member adds exactly themselves)
// - teams/update rejects empty-members updates (use delete instead)
// - teams/update rejects writes from someone who isn't a member and isn't joining
// - teams/delete allows a member to delete; rejects non-members
// - users/{uid} is owner-only for writes; any signed-in user can read
//
// Requires: npm install -D @firebase/rules-unit-testing

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'velo-forge-rules-test',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  });
});

after(async () => {
  if (env) await env.cleanup();
});

function db(uid, email) {
  if (!uid) return env.unauthenticatedContext().firestore();
  return env.authenticatedContext(uid, { email }).firestore();
}

async function seed(fn) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore());
  });
}

test('teams/create: rejects creator not in members', async () => {
  const ada = db('ada', 'ada@example.com');
  await assertFails(setDoc(doc(ada, 'teams/t1'), { name: 'Orphan', members: [] }));
});

test('teams/create: allows creator in members', async () => {
  const ada = db('ada', 'ada@example.com');
  await assertSucceeds(setDoc(doc(ada, 'teams/t-new'), { name: 'Legit', members: ['ada'] }));
});

test('teams/update: rejects emptying members', async () => {
  await seed(async (d) => { await setDoc(doc(d, 'teams/t2'), { name: 'T2', members: ['ada'] }); });
  const ada = db('ada', 'ada@example.com');
  await assertFails(updateDoc(doc(ada, 'teams/t2'), { members: [] }));
});

test('teams/update: allows non-member self-join (members-field only)', async () => {
  await seed(async (d) => { await setDoc(doc(d, 'teams/t3'), { name: 'T3', members: ['ada'] }); });
  const bob = db('bob', 'bob@example.com');
  await assertSucceeds(updateDoc(doc(bob, 'teams/t3'), { members: ['ada', 'bob'] }));
});

test('teams/update: rejects non-member editing name while self-joining', async () => {
  await seed(async (d) => { await setDoc(doc(d, 'teams/t4'), { name: 'Original', members: ['ada'] }); });
  const bob = db('bob', 'bob@example.com');
  await assertFails(updateDoc(doc(bob, 'teams/t4'), { members: ['ada', 'bob'], name: 'Hijacked' }));
});

test('teams/update: allows member to arrayRemove self (2+ → 1)', async () => {
  await seed(async (d) => { await setDoc(doc(d, 'teams/t5'), { name: 'T5', members: ['ada', 'bob'] }); });
  const ada = db('ada', 'ada@example.com');
  await assertSucceeds(updateDoc(doc(ada, 'teams/t5'), { members: ['bob'] }));
});

test('teams/delete: allows member; rejects non-member', async () => {
  await seed(async (d) => { await setDoc(doc(d, 'teams/t6'), { name: 'T6', members: ['ada'] }); });
  await assertFails(deleteDoc(doc(db('bob', 'bob@example.com'), 'teams/t6')));
  await assertSucceeds(deleteDoc(doc(db('ada', 'ada@example.com'), 'teams/t6')));
});

test('users: any signed-in user can read', async () => {
  await seed(async (d) => { await setDoc(doc(d, 'users/ada'), { displayName: 'Ada' }); });
  await assertSucceeds(getDoc(doc(db('bob', 'bob@example.com'), 'users/ada')));
});

test('users: owner can write; others cannot', async () => {
  await assertSucceeds(setDoc(doc(db('ada', 'ada@example.com'), 'users/ada'), { displayName: 'Ada' }));
  await assertFails(setDoc(doc(db('bob', 'bob@example.com'), 'users/ada'), { displayName: 'Nope' }));
});
