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

  // ── 10. Profils publics : liste par connecté, like par un autre compte ──
  await assertSucceeds(b.collection('publicProfiles').get());           // list autorisé aux connectés
  await assertFails(g.collection('publicProfiles').get());              // pas aux invités
  // B like le profil de A : uniquement likes/likedBy, cohérence imposée
  await assertSucceeds(b.doc('publicProfiles/uidA').set({likes:1, likedBy:['uidB']}, {merge:true}));
  // tentative de triche : B réécrit le pseudo via un "like" -> refusé
  await assertFails(b.doc('publicProfiles/uidA').set({likes:2, likedBy:['uidB'], username:'Hack'}, {merge:true}));
  // A se met à jour lui-même (photo/confidentialité) -> autorisé
  await assertSucceeds(a.doc('publicProfiles/uidA').set({uid:'uidA',username:'PlayerA',key:userKey,photoURL:'',photoIsCustom:false,showPRs:true,invisible:false,likes:1,likedBy:['uidB'],prsSummary:[]}, {merge:true}));

  // ── 11. Discussions : threads + messages + miroirs ──
  const pk = 'uidA__uidB';
  const C = env.authenticatedContext('uidC', { email: 'c@x.y', email_verified: true });
  const c = C.firestore();
  // création du thread par A (paire triée, participants valides)
  await assertSucceeds(a.doc('threads/'+pk).set({participants:['uidA','uidB'], createdAt:new Date().toISOString()}));
  // message de A puis réponse de B (avec partage)
  await assertSucceeds(a.doc('threads/'+pk).collection('messages').doc('m1').set({from:'uidA', fromU:'PlayerA', createdAt:new Date().toISOString(), text:'salut'}));
  await assertSucceeds(b.doc('threads/'+pk).collection('messages').doc('m2').set({from:'uidB', fromU:'PlayerB', createdAt:new Date().toISOString(), text:'yo', bundle:{kind:'profile'}}));
  // les deux participants lisent
  await assertSucceeds(a.doc('threads/'+pk).collection('messages').get());
  await assertSucceeds(b.doc('threads/'+pk).collection('messages').get());
  // un invité / un tiers ne peuvent pas lire ni écrire
  await assertFails(g.doc('threads/'+pk).get());
  await assertFails(c.doc('threads/'+pk).collection('messages').get());
  await assertFails(c.doc('threads/'+pk).collection('messages').doc('m3').set({from:'uidC', fromU:'PlayerC', createdAt:new Date().toISOString(), text:'hack'}));
  // usurpation d'expéditeur -> refusé
  await assertFails(b.doc('threads/'+pk).collection('messages').doc('m4').set({from:'uidA', fromU:'PlayerA', createdAt:new Date().toISOString(), text:'fake'}));
  // paire forgée (pas triée / sans moi) -> refusé
  await assertFails(a.doc('threads/uidB__uidC').set({participants:['uidB','uidC'], createdAt:new Date().toISOString()}));
  await assertFails(b.doc('threads/uidA__uidC').set({participants:['uidA','uidC'], createdAt:new Date().toISOString()}));
  // miroirs : chaque participant écrit son miroir et celui de l'autre
  await assertSucceeds(a.doc('userThreads/uidA/threads/'+pk).set({pair:pk, other:'uidB', otherUsername:'PlayerB', lastAt:new Date().toISOString(), lastText:'salut', lastFrom:'uidA'}));
  await assertSucceeds(a.doc('userThreads/uidB/threads/'+pk).set({pair:pk, other:'uidA', otherUsername:'PlayerA', lastAt:new Date().toISOString(), lastText:'salut', lastFrom:'uidA'}));
  // un tiers ne peut pas écrire le miroir de A
  await assertFails(c.doc('userThreads/uidA/threads/'+pk).set({pair:pk, other:'uidC', otherUsername:'PlayerC', lastAt:new Date().toISOString(), lastText:'x', lastFrom:'uidC'}));
  // un tiers ne peut pas lister les discussions de A ; A oui
  await assertFails(c.collection('userThreads/uidA/threads').get());
  await assertSucceeds(a.collection('userThreads/uidA/threads').get());

  console.log('TOUTES LES RÈGLES SONT CONFORMES ✓');
  await env.cleanup();
  process.exit(0);
})().catch(e=>{ console.error('ECHEC:\n', e.message || e); process.exit(1); });
