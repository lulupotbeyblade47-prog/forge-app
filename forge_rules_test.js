/* Tests des règles firestore.rules avec l'émulateur (inbox par pseudo). */
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const { initializeTestEnvironment, assertFails, assertSucceeds, withRules } = require('@firebase/rules-unit-testing');

const DB = (name) => 'demo-inbox-test';

// doc "clé pseudo" conforme à validUsernameClaim
const claimDoc = (uid, username) => ({ uid, username, key: username.toLowerCase().slice(0,20).replace(/[^a-z0-9_-]/g,'') });
const claimKey = (username) => claimDoc('x', username).key;

function userDb(uid, claims){
  return withRules({ auth: { uid }, claims: claims || {} }, handled =>
    handled.getFirestore());
}

(async () => {
  const env = await initializeTestEnvironment({
    projectId: DB(),
    firestore: { rules: require('fs').readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });
  const out = [];
  const A = env.authenticatedContext('uidA', { email: 'a@x.y', email_verified: true });
  const B = env.authenticatedContext('uidB', { email: 'b@x.y', email_verified: true });
  const guest = env.unauthenticatedContext();

  const a = A.firestore(), b = B.firestore(), g = guest.firestore();
  const userKey = claimKey('PlayerA');
  // A réserve son pseudo "PlayerA"
  await assertSucceeds(a.doc('usernames/'+userKey).set(claimDoc('uidA','PlayerA')));
  await assertSucceeds(a.doc('publicProfiles/uidA').set({uid:'uidA',username:'PlayerA',key:userKey}));

  // 1. B envoie un partage dans la boîte de A -> autorisé
  const shareRef = 'inbox/'+userKey+'/items/shr1';
  await assertSucceeds(b.doc(shareRef).set({to:userKey, fromUid:'uidB', fromUsername:'PlayerB', kind:'session', bundle:{kind:'session',session:{}}, createdAt:new Date().toISOString()}));

  // 2. B ne peut pas se faire passer pour A (fromUid != uid auth) -> refusé
  await assertFails(b.doc('inbox/'+userKey+'/items/shr2').set({to:userKey, fromUid:'uidA', kind:'session', fromUsername:'X', bundle:{kind:'session',session:{}}, createdAt:new Date().toISOString()}));

  // 3. B lit la boîte de A -> refusé
  await assertFails(b.doc(shareRef).get());
  await assertFails(b.collection('inbox/'+userKey+'/items').get());

  // 4. A lit sa boîte -> autorisé
  await assertSucceeds(a.doc(shareRef).get());
  await assertSucceeds(a.collection('inbox/'+userKey+'/items').get());

  // 5. guest lit/écrit -> refusé
  await assertFails(g.doc(shareRef).get());
  await assertFails(g.collection('inbox/'+userKey+'/items').add({to:userKey, fromUid:'x', kind:'session', bundle:{kind:'session',session:{}}, createdAt:new Date().toISOString()}));

  // 6. B supprime -> refusé ; A supprime -> autorisé
  await assertFails(b.doc(shareRef).delete());
  await assertSucceeds(a.doc(shareRef).delete());

  // 7. envoi vers un pseudo inexistant -> refusé
  await assertFails(a.doc('inbox/'+claimKey('Ghost')+'/items/shr3').set({to:claimKey('Ghost'), fromUid:'uidA', fromUsername:'PlayerA', kind:'session', bundle:{}, createdAt:new Date().toISOString()}));

  // 8. to != clé de la boîte -> refusé
  await assertFails(a.doc('inbox/'+userKey+'/items/shr4').set({to:claimKey('Ghost'), fromUid:'uidA', fromUsername:'PlayerA', kind:'session', bundle:{}, createdAt:new Date().toISOString()}));


  // 9. message facultatif valide -> autorisé ; script/js dans message reste permis (champ texte)
  const browser = require('@firebase/rules-unit-testing').assertSucceeds;
  await browser(b.doc('inbox/'+userKey+'/items/shr5').set({to:userKey, fromUid:'uidB', fromUsername:'PlayerB', kind:'profile', message:'voila mon profil', bundle:{kind:'profile'}, createdAt:new Date().toISOString()}));
  console.log('TOUTES LES RÈGLES SONT CONFORMES ✓');
  await env.cleanup();
  process.exit(0);
})().catch(e=>{ console.error('ECHEC:\n', e.message || e); process.exit(1); });
