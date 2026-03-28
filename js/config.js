'use strict';

// ══════════════════════════════════════
// CONFIGURATION & CONSTANTS
// ══════════════════════════════════════

const TARGETS      = {cal:2400,protein:210,carbs:233,fat:70};
const TARGETS_RUN  = {cal:2700,protein:210,carbs:310,fat:70};   // Wed lunchtime run day
const TARGETS_LONG = {cal:2900,protein:210,carbs:370,fat:75};   // Sat long run / refeed
const DAY_LABELS   = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
const TRAIN_DAYS   = [0,1,2,3,4];   // Mon–Fri gym
const RUN_DAYS     = [2,5];          // Wed (short), Sat (long)
const SLEEP_TARGET = 7.75;
const SHEET_NAME   = 'APEX_Protocol_Data';
const FOLDER_NAME  = 'Gym Workout Data';

// ── Meal plans — three tiers matching the three calorie targets ───────────────
const MEAL_PLANS = {
  standard: [
    {name:'Breakfast',          desc:'3 eggs + 150g Greek yogurt + fruit + honey',          cal:458,  protein:38, carbs:45,  fat:14},
    {name:'Lunch',              desc:'Chicken/turkey 200g + 200g rice (cooked) + olive oil', cal:601,  protein:56, carbs:65,  fat:13},
    {name:'Pre-Workout',        desc:'2 rice cakes + 100g cottage cheese + banana + whey',  cal:341,  protein:32, carbs:42,  fat:5},
    {name:'Post-Workout Dinner',desc:'Lean beef/chicken 200g + roasted veg + 1 tbsp oil',   cal:598,  protein:55, carbs:45,  fat:22},
    {name:'Evening Protein',    desc:'Casein shake or 150g cottage cheese before 10pm',     cal:216,  protein:27, carbs:18,  fat:4},
    {name:'Daily Extras',       desc:'Cooking oils, condiments, fruit snacks, drinks',      cal:188,  protein:2,  carbs:18,  fat:12}
  ],
  run: [
    {name:'Breakfast',          desc:'3 eggs + 150g Greek yogurt + fruit + 40g oats',       cal:538,  protein:38, carbs:65,  fat:14},
    {name:'Pre-Run Snack',      desc:'Banana + 30g oats + 200ml orange juice (30min before)',cal:273,  protein:4,  carbs:62,  fat:1},
    {name:'Post-Run Lunch',     desc:'Chicken 200g + 250g rice (cooked) + olive oil + veg', cal:686,  protein:58, carbs:82,  fat:14},
    {name:'Pre-Workout',        desc:'2 rice cakes + 100g cottage cheese + whey shake',     cal:333,  protein:32, carbs:40,  fat:5},
    {name:'Post-Workout Dinner',desc:'Lean beef/chicken 200g + roasted veg + 1 tbsp oil',   cal:558,  protein:55, carbs:35,  fat:22},
    {name:'Evening Protein',    desc:'Casein shake + 100g cottage cheese + fruit',          cal:314,  protein:23, carbs:24,  fat:14}
  ],
  long: [
    {name:'Pre-Run Breakfast',  desc:'3 eggs + 200g Greek yogurt + 50g oats + banana + honey', cal:680, protein:42, carbs:92, fat:16},
    {name:'Mid/Post-Run Fuel',  desc:'Energy gel or banana during + 300ml sports drink after',  cal:216, protein:2,  carbs:52, fat:0},
    {name:'Recovery Lunch',     desc:'Chicken/beef 250g + 300g rice (cooked) + olive oil + veg',cal:824, protein:72, carbs:98, fat:16},
    {name:'Afternoon Snack',    desc:'2 rice cakes + peanut butter + banana',                   cal:321, protein:8,  carbs:52, fat:9},
    {name:'Dinner',             desc:'Salmon/beef 200g + sweet potato 200g + roasted veg',      cal:653, protein:60, carbs:65, fat:17},
    {name:'Evening Protein',    desc:'Casein shake or 150g cottage cheese before 10pm',         cal:204, protein:26, carbs:16, fat:4}
  ]
};

// Returns the right meal plan array based on today's actual day
function getMealsForToday() {
  var dow = realDow();
  if (dow === 2) return MEAL_PLANS.run;    // Wednesday — run + gym
  if (dow === 5) return MEAL_PLANS.long;   // Saturday — long run
  return MEAL_PLANS.standard;
}

// Keep MEAL_DATA as a legacy alias so any old references still work
var MEAL_DATA = MEAL_PLANS.standard;

const MUSCLE_GROUPS = [
  {key:'chest',label:'Chest',icon:'🫁'},
  {key:'back',label:'Back',icon:'🔙'},
  {key:'shoulders',label:'Delts',icon:'〇'},
  {key:'biceps',label:'Biceps',icon:'💪'},
  {key:'triceps',label:'Triceps',icon:'💪'},
  {key:'quads',label:'Quads',icon:'🦵'},
  {key:'hamstrings',label:'Hams',icon:'🦵'},
  {key:'core',label:'Core',icon:'⬡'},
];

const SESSIONS_DEF = [
  {day:'Day 1 — Monday',name:'PUSH',focus:'Chest · Shoulders · Triceps',exercises:[
    {name:'Incline DB Press',note:'',sets:'4×8–10',rpe:'8',tempo:'3-1-X-0',rest:120,muscles:['chest','shoulders']},
    {name:'Cable Chest Fly',note:'Low to high',sets:'3×12–15',rpe:'7',tempo:'2-1-2-0',rest:90,muscles:['chest']},
    {name:'Seated DB Shoulder Press',note:'',sets:'3×10–12',rpe:'8',tempo:'3-0-X-0',rest:120,muscles:['shoulders']},
    {name:'Cable Lateral Raise',note:'Unilateral',sets:'4×15–20',rpe:'7',tempo:'2-0-2-1',rest:60,muscles:['shoulders']},
    {name:'OHT Extension',note:'Cable rope',sets:'3×12–15',rpe:'8',tempo:'2-1-X-0',rest:90,muscles:['triceps']},
    {name:'Tricep Pushdown',note:'Straight bar',sets:'3×15',rpe:'7',tempo:'2-0-X-0',rest:60,muscles:['triceps']}
  ]},
  {day:'Day 2 — Tuesday',name:'PULL',focus:'Back · Biceps · Rear Delts',exercises:[
    {name:'Seated Cable Row',note:'Wide grip',sets:'4×8–10',rpe:'8',tempo:'2-1-X-1',rest:120,muscles:['back','shoulders']},
    {name:'Lat Pulldown',note:'Neutral grip',sets:'4×10–12',rpe:'8',tempo:'2-1-X-0',rest:90,muscles:['back']},
    {name:'Single Arm DB Row',note:'',sets:'3×10–12',rpe:'8',tempo:'2-0-X-1',rest:90,muscles:['back']},
    {name:'Face Pull',note:'Rope, high cable',sets:'3×20',rpe:'6',tempo:'2-1-2-1',rest:60,muscles:['shoulders']},
    {name:'Incline DB Curl',note:'',sets:'3×10–12',rpe:'8',tempo:'3-0-X-1',rest:90,muscles:['biceps']},
    {name:'Hammer Curl',note:'',sets:'3×12–15',rpe:'7',tempo:'2-0-X-0',rest:60,muscles:['biceps']}
  ]},
  {day:'Day 3 — Wednesday',name:'LEGS',focus:'Quad · Hamstrings · Calves  |  🏃 Short Run at Lunch',runNote:'Short run at lunch (5km easy, ~30 min, Zone 2). Eat carb-focused lunch after. Legs gym at 7pm as normal — reduce RPE by 1 if legs are heavy from run.',exercises:[
    {name:'Leg Press',note:'Shoulder-width feet',sets:'4×10–12',rpe:'8',tempo:'3-1-X-0',rest:150,muscles:['quads']},
    {name:'Hack / Smith Squat',note:'Reduce sets to 2 if run fatigue is high',sets:'3×8–10',rpe:'7',tempo:'3-1-X-0',rest:150,muscles:['quads']},
    {name:'Leg Extension',note:'',sets:'3×15–20',rpe:'7',tempo:'2-1-2-1',rest:60,muscles:['quads']},
    {name:'Romanian DL',note:'DB, hinge focus',sets:'3×10–12',rpe:'7',tempo:'3-1-X-0',rest:120,muscles:['hamstrings']},
    {name:'Leg Curl',note:'Seated or lying',sets:'3×12–15',rpe:'7',tempo:'2-1-2-1',rest:90,muscles:['hamstrings']},
    {name:'Standing Calf Raise',note:'Bilateral, heel planted',sets:'3×15–20',rpe:'6',tempo:'2-1-3-0',rest:60,muscles:[]}
  ]},
  {day:'Day 4 — Thursday',name:'UPPER',focus:'Strength Focus',exercises:[
    {name:'Flat DB Press',note:'',sets:'4×6–8',rpe:'9',tempo:'3-1-X-0',rest:150,muscles:['chest','shoulders']},
    {name:'Weighted Pull-Up',note:'Or assisted',sets:'4×6–8',rpe:'9',tempo:'2-0-X-1',rest:150,muscles:['back','biceps']},
    {name:'Cable Row',note:'Close grip',sets:'3×8–10',rpe:'8',tempo:'2-1-X-1',rest:120,muscles:['back']},
    {name:'Lateral Raise',note:'Cable, unilateral',sets:'3×15',rpe:'7',tempo:'2-0-2-1',rest:60,muscles:['shoulders']},
    {name:'EZ Bar Curl',note:'',sets:'3×8–10',rpe:'8',tempo:'2-0-X-1',rest:90,muscles:['biceps']},
    {name:'Skull Crusher',note:'EZ bar',sets:'3×8–10',rpe:'8',tempo:'3-1-X-0',rest:90,muscles:['triceps']}
  ]},
  {day:'Day 5 — Friday',name:'ARMS + CORE',focus:'Biceps · Triceps · Abs',exercises:[
    {name:'Cable Curl',note:'Bilateral',sets:'4×12–15',rpe:'8',tempo:'2-1-2-1',rest:60,muscles:['biceps']},
    {name:'Concentration Curl',note:'',sets:'3×12–15',rpe:'8',tempo:'2-1-X-1',rest:60,muscles:['biceps']},
    {name:'Cable Pushdown',note:'Rope',sets:'4×15',rpe:'8',tempo:'2-1-X-0',rest:60,muscles:['triceps']},
    {name:'DB Overhead Extension',note:'',sets:'3×12',rpe:'7',tempo:'3-1-X-0',rest:90,muscles:['triceps']},
    {name:'Cable Crunch',note:'',sets:'4×15–20',rpe:'8',tempo:'2-1-2-1',rest:60,muscles:['core']},
    {name:'Hanging Knee Raise',note:'',sets:'3×15–20',rpe:'7',tempo:'controlled',rest:60,muscles:['core']},
    {name:'Ab Wheel Rollout',note:'',sets:'3×10',rpe:'8',tempo:'3-0-X-0',rest:60,muscles:['core']},
    {name:'Side Plank',note:'Each side',sets:'3×45s',rpe:'7',tempo:'—',rest:45,muscles:['core']}
  ]}
];

// Run sessions (displayed separately in Training tab)
const RUN_SESSIONS = [
  {
    dow:2, label:'Wednesday — Short Run', type:'short',
    distance:'5km', effort:'Zone 2 (easy, conversational pace)',
    timing:'Lunchtime (~12–1pm). Eat carb-focused meal after. 6hrs before gym.',
    nutrition:'Have 30g fast carbs (banana, sports drink) 20 min before. Eat 60–80g carbs at lunch post-run.',
    notes:'Do NOT run hard. Zone 2 only — you should be able to hold a conversation. Heart rate 130–150bpm. Purpose is aerobic base and fat oxidation, not speed.',
    pace:'5:30–6:30 /km', duration:'~28–35 min'
  },
  {
    dow:5, label:'Saturday — Long Run', type:'long',
    distance:'10–15km', effort:'Zone 2 with last 2km at Zone 3',
    timing:'Morning preferred (8–10am). Full rest from gym.',
    nutrition:'Eat 60–80g carbs 60 min before. Carry water for runs over 10km. Refuel with 2,900 kcal today — this replaces the weekly refeed.',
    notes:'Build distance by 1km per week maximum. Current target: start at 10km, reach 15km by week 8. Long run is the most important session for fat oxidation — this is where you burn the most fat as fuel.',
    pace:'5:30–7:00 /km', duration:'55–90 min'
  }
];
