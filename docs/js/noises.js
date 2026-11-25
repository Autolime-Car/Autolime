// "What does this noise / feeling mean?": guided checks. Pick what you notice, answer one or two questions, and get the
// likely causes in order, how urgent it is, what to check yourself and the Arabic words for the workshop. Each answer links
// to the care items it touches, so "probably the pads" opens the pads. Pure data + helpers (no DOM).

/** A symptom: { id, icon, title, ar (what to tell the workshop), group, ask: [{ q, options: [[id, label]] }], answers: { optionId | '*': result } }
 *  result: { level: stop|soon|watch, causes: [text], check: [text], care: [ids] } */
export const GROUPS = [['brakes', 'Braking', '🛑'], ['ride', 'Bumps, turns and the steering', '🛞'], ['engine', 'Engine and gearbox', '🔧'], ['heat', 'Heat, smells and the AC', '🌡️'], ['start', 'Starting and electrics', '🔋']];

export const SYMPTOMS = [
  { id: 'squeal-brake', group: 'brakes', icon: '🔊', title: 'Squeal when braking', ar: 'صوت صفير عند الفرامل',
    ask: [{ q: 'Does it squeal on every stop, or only the first ones of the morning?', options: [['always', 'Every stop'], ['morning', 'Only the first few, then it stops']] }],
    answers: {
      always: { level: 'soon', causes: ['The pads’ wear tabs are touching the discs: pads nearly finished (about 3 mm left)', 'Glazed pads or discs'], check: ['Look through the wheel spokes at the pad: less than 3 mm of material means replace.'], care: ['brakes', 'rotors'] },
      morning: { level: 'watch', causes: ['Surface rust on the discs overnight (normal, wears off in a few stops)', 'Dust between pad and disc'], check: ['If it is gone after 3–4 stops, it is nothing.'], care: ['brakes'] } } },
  { id: 'grind-brake', group: 'brakes', icon: '⚙️', title: 'Grinding or scraping when braking', ar: 'صوت حك عند الفرامل',
    answers: { '*': { level: 'stop', causes: ['Pads worn to the metal: metal on metal, cutting into the discs', 'A stone caught between the disc and its shield'], check: ['Drive gently and straight to a workshop. The discs usually need replacing too now.'], care: ['brakes', 'rotors'] } } },
  { id: 'shake-brake', group: 'brakes', icon: '〰️', title: 'Steering wheel shakes when braking', ar: 'رجة في الدركسون عند الفرامل',
    answers: { '*': { level: 'soon', causes: ['Warped or unevenly worn front discs (common after hard braking from high speed)', 'Worn control-arm bushings make it worse'], check: ['Worse when braking from 100+ km/h on the highway than in town = discs.'], care: ['rotors', 'brakes', 'arms'] } } },
  { id: 'soft-pedal', group: 'brakes', icon: '🦶', title: 'Brake pedal feels soft or goes down further', ar: 'دعسة الفرامل نازلة',
    answers: { '*': { level: 'stop', causes: ['Low brake fluid (a leak, or pads very worn)', 'Air or water in the brake fluid (old fluid boils when hot)', 'Master cylinder'], check: ['Look at the brake fluid reservoir: below MIN means a leak or worn pads. Don’t drive far.'], care: ['brakeFluid', 'brakes'] } } },
  { id: 'clunk', group: 'ride', icon: '🔨', title: 'Clunk or knock over bumps', ar: 'طقطقة عند المطبات',
    ask: [{ q: 'Where does it seem to come from?', options: [['front', 'The front'], ['rear', 'The back'], ['unsure', 'Not sure']] }],
    answers: {
      front: { level: 'soon', causes: ['Sway-bar (stabiliser) links — the most common, and cheap', 'Lower control-arm bushings or ball joints', 'Shock top mounts'], check: ['Over speed bumps slowly: a dull knock = links or bushings; a rattle = links.'], care: ['arms', 'shocks'] },
      rear: { level: 'soon', causes: ['Rear sway-bar links', 'Rear shocks or their mounts', 'Something loose in the boot (spare wheel, jack)'], check: ['Empty the boot and tighten the spare-wheel bolt first.'], care: ['shocks'] },
      unsure: { level: 'soon', causes: ['Sway-bar links', 'Control-arm bushings', 'Shock mounts'], check: ['Ask the workshop to check “the front end” on a lift: links, bushings, ball joints, tie-rod ends.'], care: ['arms', 'shocks'] } } },
  { id: 'bounce', group: 'ride', icon: '🦘', title: 'Floats, bounces or dives under braking', ar: 'السيارة تتمايل وتنط',
    answers: { '*': { level: 'soon', causes: ['Worn shock absorbers'], check: ['Push down hard on each corner: more than one bounce, or an oily shock body, means they are done.'], care: ['shocks', 'alignment'] } } },
  { id: 'hum', group: 'ride', icon: '🎵', title: 'Humming or droning that rises with speed', ar: 'صوت هدير يزيد مع السرعة',
    ask: [{ q: 'Does it change when you weave gently left and right on an empty road?', options: [['changes', 'Yes, louder one way'], ['same', 'No, it stays the same']] }],
    answers: {
      changes: { level: 'soon', causes: ['A wheel bearing (louder when turning away from the bad side: worse turning right = left bearing)'], check: ['Find it before a long trip: a bearing gets louder over weeks.'], care: ['bearings'] },
      same: { level: 'watch', causes: ['Tyre noise: uneven (cupped) wear from tired shocks or no rotation', 'Road surface'], check: ['Run your hand over the tread: a saw-tooth feel means cupping.'], care: ['rotate', 'shocks', 'tyres'] } } },
  { id: 'click-turn', group: 'ride', icon: '🔁', title: 'Clicking on full-lock turns', ar: 'طقطقة عند اللف الكامل',
    answers: { '*': { level: 'soon', causes: ['An outer CV joint, usually after its rubber boot tore and let sand in'], check: ['Look behind the front wheels for grease thrown around. A torn boot alone is cheap; a clicking joint means a new axle.'], care: ['cvBoots'] } } },
  { id: 'vibe-speed', group: 'ride', icon: '📳', title: 'Vibration through the wheel at 100–120 km/h', ar: 'رجة في الدركسون على السرعة',
    answers: { '*': { level: 'watch', causes: ['Wheel balance (a weight fell off)', 'A bent rim or a tyre with a bulge', 'Worn control-arm bushings'], check: ['Balance first: it is cheap and fixes most of these.'], care: ['balancing', 'tyres', 'arms'] } } },
  { id: 'pull', group: 'ride', icon: '↗️', title: 'Pulls to one side, or the wheel sits crooked', ar: 'السيارة تسحب على جنب',
    answers: { '*': { level: 'watch', causes: ['Wheel alignment out (after a pothole or kerb)', 'One tyre low', 'A sticking brake calliper (that wheel is hotter than the others after a drive)'], check: ['Check the pressures first, then an alignment with the before/after printout.'], care: ['alignment', 'tyrePressure', 'brakes'] } } },
  { id: 'shudder', group: 'engine', icon: '〰️', title: 'Shudder like a rumble strip at 40–70 km/h', ar: 'رجفة خفيفة على سرعة ٤٠–٧٠',
    answers: { '*': { level: 'watch', causes: ['Torque-converter lock-up shudder, known on this Camry’s 6-speed (Toyota bulletins for 2012–2014)', 'Old ATF'], check: ['Light throttle on a flat road brings it on. A drain-and-fill with Toyota ATF WS often helps.'], care: ['atf'] } } },
  { id: 'squeal-start', group: 'engine', icon: '📢', title: 'Squeal from the engine at a cold start or with the AC on', ar: 'صوت صفير من المكينة عند التشغيل',
    answers: { '*': { level: 'soon', causes: ['The drive belt is glazed or loose, or its tensioner is weak'], check: ['Look for cracks across the belt’s ribs. If the belt breaks, the alternator, AC and water pump all stop.'], care: ['belt'] } } },
  { id: 'rattle-cold', group: 'engine', icon: '⛓️', title: 'Rattle for a few seconds at a cold start', ar: 'صوت رزرزة عند التشغيل البارد',
    answers: { '*': { level: 'soon', causes: ['Timing-chain tensioner bleeding down (oil drains overnight)', 'Old or low oil', 'A worn timing chain on a high-mileage engine'], check: ['Check the oil level. If it lasts longer than 2–3 seconds or comes back warm, see a workshop.'], care: ['oil'] } } },
  { id: 'rough-idle', group: 'engine', icon: '🫨', title: 'Shaking at idle (worse with the AC on, in Drive)', ar: 'رجة في المكينة وهي واقفة',
    answers: { '*': { level: 'soon', causes: ['Engine mounts worn (the right-side one first)', 'Dirty throttle body', 'A weak spark plug or ignition coil'], check: ['If it shakes much more in Drive than in Park, it is the mounts.'], care: ['mounts', 'plugs'] } } },
  { id: 'rattle-under', group: 'engine', icon: '🥫', title: 'Tinny rattle from under the car', ar: 'صوت خشخشة تحت السيارة',
    answers: { '*': { level: 'watch', causes: ['A loose exhaust heat shield (very common)', 'A broken exhaust hanger'], check: ['A workshop fixes it with a clamp in minutes.'], care: [] } } },
  { id: 'hot', group: 'heat', icon: '🌡️', title: 'Temperature needle climbing', ar: 'حرارة المكينة ترتفع',
    answers: { '*': { level: 'stop', causes: ['Low coolant (a leak: the water pump seeps on this engine)', 'Radiator fan not running', 'Radiator clogged with sand'], check: ['AC off, heater on full, pull over and switch off. Never open the radiator cap hot.'], care: ['coolant', 'waterPump'] } } },
  { id: 'sweet', group: 'heat', icon: '🍬', title: 'A sweet smell after driving', ar: 'ريحة حلوة بعد المشوار',
    answers: { '*': { level: 'soon', causes: ['Coolant leaking onto hot parts (water pump, a hose, the radiator)'], check: ['Look for pink crust and a level that drops week to week.'], care: ['coolant', 'waterPump'] } } },
  { id: 'burning', group: 'heat', icon: '🔥', title: 'A burning smell', ar: 'ريحة احتراق',
    ask: [{ q: 'What does it smell like?', options: [['oil', 'Hot oil'], ['rubber', 'Rubber or a hot brake'], ['plastic', 'Electrical / plastic']] }],
    answers: {
      oil: { level: 'soon', causes: ['Oil seeping onto the exhaust (valve-cover gasket, timing cover)', 'Spilled oil from the last change'], check: ['Look for oil spots where you park.'], care: ['oil'] },
      rubber: { level: 'soon', causes: ['A sticking brake (one wheel hot)', 'The handbrake left on', 'A slipping belt'], check: ['Carefully feel near each wheel (not the disc) after a drive: one much hotter = a sticking calliper.'], care: ['brakes', 'belt'] },
      plastic: { level: 'stop', causes: ['An electrical short'], check: ['Pull over, switch off. Don’t drive until it is checked.'], care: [] } } },
  { id: 'ac-warm', group: 'heat', icon: '❄️', title: 'AC not cold enough', ar: 'المكيف ما يبرد',
    ask: [{ q: 'When is it worst?', options: [['stopped', 'Stopped in traffic, colder when moving'], ['always', 'All the time'], ['weak', 'Cold but weak airflow']] }],
    answers: {
      stopped: { level: 'soon', causes: ['The condenser is clogged with sand and bugs', 'A radiator fan not working'], check: ['Look through the grille at the condenser fins; a gentle rinse from behind helps.'], care: ['ac'] },
      always: { level: 'soon', causes: ['Low refrigerant: there is a leak', 'Compressor or its clutch'], check: ['Ask for a leak test, not just a top-up.'], care: ['ac'] },
      weak: { level: 'watch', causes: ['A clogged cabin filter'], check: ['Behind the glovebox, five minutes, no tools.'], care: ['cabinFilter'] } } },
  { id: 'slow-crank', group: 'start', icon: '🐢', title: 'Slow to start, or clicks', ar: 'السيارة ثقيلة في التشغيل',
    answers: { '*': { level: 'soon', causes: ['A tired battery (2–3 years is normal in Saudi heat)', 'Corroded terminals', 'A weak starter'], check: ['A free load test at a battery shop settles it. Clean white-blue crust off the terminals.'], care: ['battery', 'batteryNew'] } } },
  { id: 'dim', group: 'start', icon: '💡', title: 'Lights flicker or dim, battery light on while driving', ar: 'الأنوار تضعف ولمبة البطارية',
    answers: { '*': { level: 'soon', causes: ['The alternator isn’t charging', 'The drive belt is slipping or broken'], check: ['Turn off the AC and radio and go straight to a workshop: the battery is running everything now.'], care: ['belt', 'battery'] } } },
  { id: 'cel', group: 'start', icon: '🟠', title: 'Check-engine light', ar: 'لمبة المكينة',
    answers: { '*': { level: 'soon', causes: ['Anything from a loose fuel cap to a misfire: read the code'], check: ['Tighten the fuel cap until it clicks. Then read the code with any OBD reader and look it up in Codes.'], care: [] } } },
];
export const symptom = (id) => SYMPTOMS.find(s => s.id === id) || null;
/** The result for a symptom with the answers given (or the only one there is). */
export function answer(sym, picks = []) {
  if (!sym) return null;
  return sym.answers[picks[0]] || sym.answers['*'] || null;
}
