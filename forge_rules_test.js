/* Harnais de test de migrateExoNamesV2 (temporaire, étape 1) */
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const s0 = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)][0][1];
const start = s0.indexOf('const EXO_GROUP_ICON');
const end = s0.indexOf('let exercises = []');
const code = s0.slice(start, end);

/* --- stubs de l'env app --- */
const store = {};
globalThis.DAY_KEYS = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
function persistProfiles(){ store.savedProfiles = true; }
function savePRs(){ store.savedPRs = true; }
function savePrograms(){ store.savedPrograms = true; }
async function sGet(k, f){ return k in store ? store[k] : f; }
function sSet(k, v){ store[k] = v; }
/* stubs pour LEGACY_UNMAPPED (extraction partielle du fichier) */
const DEFAULT_EXERCISES = [];
const EXO_GROUPS = [];

let exercises = [
  { name:'Front lever tuck', fields:['seconds','weight'] },
  { name:'Pompes archer', fields:['reps','weight'] },
  { name:'Tractions (pull-ups)', fields:['reps','weight'] },
  { name:'Front lever pull-ups', fields:['reps','weight'] },
  { name:'Planche lean', fields:['seconds'] },
  { name:'Planche press négative', fields:['reps','weight'] },
  { name:'Front lever half lay', fields:['reps','weight'] },
  { name:'Front lever adv tuck + half straddle', fields:['reps','weight'] },
  { name:'Gainage L-sit', fields:['seconds','weight'] },
  { name:'Squat profond (mobilité)', fields:['seconds'] },
  { name:'Wall sit', fields:['seconds','weight'] }, /* pas mappable */
  { name:'Pull-ups · Lestée · Pronation', fields:['reps','weight'] }, /* déjà v2 */
];
let logs = [
  { id:'l1', exercise:'Front lever tuck', sets:[{ seconds:15, weight:0 }] },
  { id:'l2', exercise:'Squats bulgares', sets:[{ reps:12, weight:10 }] },
  { id:'l3', exercise:'Wall sit', sets:[{ seconds:45, weight:0 }] },
  { id:'l4', exercise:'Front lever · Hold · Tuck', sets:[{ seconds:20, weight:0 }] },
];
let profiles = [
  { id:'default', week:{ jeudi:[
    { id:'s1', exercises:[
      { name:'Handstand push-ups', sets:[{ reps:5, weight:0 }] },
      { _emom:true, minutes:10, exos:[{ name:'Tractions (pull-ups)', reps:5, weight:0 }] },
    ] },
  ] } },
];
let prs = [
  { id:'p1', exercise:'Pompes archer', value:30, unit:'kg' },
  { id:'p2', exercise:'Corde à sauter', value:120, unit:'s' },
];
let programs = [ { id:'g1', exercises:[ { exerciseName:'Squats', maxActuel:100 } ] } ];

const fn = new Function(
  'exercises','logs','profiles','prs','programs','DAY_KEYS',
  'persistProfiles','savePRs','savePrograms','sGet','sSet','DEFAULT_EXERCISES','EXO_GROUPS',
  code + '\nreturn { migrateExoNamesV2, exoVariantesValides, exoFieldsFromName, exoParseName };'
);
const ctx = fn(exercises, logs, profiles, prs, programs, DAY_KEYS, persistProfiles, savePRs, savePrograms, sGet, sSet, DEFAULT_EXERCISES, EXO_GROUPS);
ctx.migrateExoNamesV2();

/* exercises est réassigné en interne → vraie valeur dans le store */
const exFinal = store['forge-exercises'] || exercises;
console.log('EXOS   :', exFinal.map(e=>e.name).join(' | '));
console.log('LOGS   :', logs.map(l=>l.exercise).join(' | '));
console.log('PROFIL :', profiles[0].week.jeudi[0].exercises.map(x=>x.name).join(' | '));
console.log('PRS    :', prs.map(p=>p.exercise).join(' | '));
console.log('PROG   :', programs[0].exercises.map(p=>p.exerciseName).join(' | '));
console.log('---');
console.log('variantes FL/Hold  :', ctx.exoVariantesValides('Front lever','Hold').join(', '));
console.log('variantes PL/Press :', ctx.exoVariantesValides('Planche','Press').join(', '));
console.log('variantes PL/Hold  :', ctx.exoVariantesValides('Planche','Hold').join(', '));
console.log('fields « Front lever · Pull-ups · Tuck » :', JSON.stringify(ctx.exoFieldsFromName('Front lever · Pull-ups · Tuck')));
console.log('fields « Cardio · Burpees »              :', JSON.stringify(ctx.exoFieldsFromName('Cardio · Burpees')));
console.log('sets conservés :', logs.every(l=>Array.isArray(l.sets) && l.sets.length > 0));
console.log('parcours euclidien exFields AT mur:', JSON.stringify(ctx.exoFieldsFromName('Handstand · Hold mur')));

/* --- 2e passe : idempotence --- */
const before2 = JSON.stringify({
  ex: (store['forge-exercises'] || exercises).map(e=>e.name),
  lg: logs.map(l=>l.exercise),
});
/* on recharge l'état persisté comme l'app le ferait */
delete store['forge-exercises']; store['forge-exercises'] = exFinal;
ctx.migrateExoNamesV2();
const exFinal2 = store['forge-exercises'] || exFinal;
const after2 = JSON.stringify({
  ex: exFinal2.map(e=>e.name),
  lg: logs.map(l=>l.exercise),
});
console.log('idempotent :', before2 === after2);
