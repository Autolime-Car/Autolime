// OBD-II trouble codes, offline: what the engine light means in plain words, how urgent it is, the usual causes (on a
// Camry 2.5 L first where it matters) and the care items to look at. Generic SAE codes (P0xxx) plus how to read any code
// that is not in the table. A cheap Bluetooth OBD reader and a free app read the code; this tells you what to do with it.
// Pure data + helpers (no DOM).

/** level: 'stop' = pull over / don't drive far, 'soon' = book the workshop this week, 'watch' = drive on, fix when convenient. */
export const LEVELS = {
  stop: { label: 'Stop soon', ar: 'أوقف السيارة', tone: 'late', say: 'Don’t keep driving far: damage or a breakdown is likely. A flashing engine light always means this.' },
  soon: { label: 'Book it this week', ar: 'راجع الورشة قريباً', tone: 'soon', say: 'Safe to drive gently to the workshop, but don’t leave it: it costs fuel or wears something else.' },
  watch: { label: 'Fix when convenient', ar: 'ليس عاجلاً', tone: 'ok', say: 'Not urgent. Check the simple causes first; the light may go off by itself after a few drives.' },
};

/** [code, title, level, causes (most likely first), care items, Arabic name for the workshop] */
const T = [
  ['P0011', 'Intake camshaft timing over-advanced (bank 1)', 'soon', ['Low or old oil (the VVT system runs on oil pressure)', 'Oil control valve (OCV) sticking', 'Timing chain stretched (rattle at cold start)'], ['oil'], 'توقيت عمود الكامات'],
  ['P0012', 'Intake camshaft timing over-retarded (bank 1)', 'soon', ['Low or old oil', 'Oil control valve (OCV) or its screen blocked', 'Timing chain stretched'], ['oil'], 'توقيت عمود الكامات'],
  ['P0014', 'Exhaust camshaft timing over-advanced (bank 1)', 'soon', ['Low or old oil', 'Exhaust oil control valve sticking'], ['oil'], 'توقيت عمود الكامات'],
  ['P0016', 'Crankshaft / camshaft position don’t agree', 'soon', ['Timing chain stretched or jumped a tooth', 'Cam or crank sensor', 'Very old oil'], ['oil'], 'توقيت الكرنك والكامات'],
  ['P0030', 'Oxygen sensor heater circuit (bank 1, sensor 1)', 'watch', ['Air-fuel ratio sensor heater failed', 'Fuse or wiring'], [], 'حساس الأكسجين'],
  ['P0101', 'Mass air flow (MAF) sensor reads out of range', 'soon', ['Dirty MAF sensor (clean with MAF spray, never touch the wire)', 'Air leak after the sensor', 'Blocked air filter'], ['airFilter'], 'حساس الهواء'],
  ['P0102', 'Mass air flow sensor signal low', 'soon', ['MAF plug loose or wiring', 'Dirty or failed MAF sensor'], ['airFilter'], 'حساس الهواء'],
  ['P0113', 'Intake air temperature sensor reads high', 'watch', ['Sensor (inside the MAF) unplugged or failed', 'Wiring'], [], 'حساس حرارة الهواء'],
  ['P0116', 'Coolant temperature sensor out of range', 'soon', ['Thermostat stuck open', 'Coolant temperature sensor', 'Low coolant'], ['coolant'], 'حساس حرارة المكينة'],
  ['P0117', 'Coolant temperature sensor signal low', 'soon', ['Sensor or its wiring shorted'], ['coolant'], 'حساس حرارة المكينة'],
  ['P0118', 'Coolant temperature sensor signal high', 'soon', ['Sensor unplugged or wire broken'], ['coolant'], 'حساس حرارة المكينة'],
  ['P0125', 'Engine takes too long to warm up for fuel control', 'watch', ['Thermostat stuck open', 'Low coolant'], ['coolant'], 'الثرموستات'],
  ['P0128', 'Coolant stays below the thermostat temperature', 'watch', ['Thermostat stuck open (common with age)', 'Coolant temperature sensor'], ['coolant'], 'الثرموستات'],
  ['P0130', 'Oxygen sensor circuit (bank 1, sensor 1)', 'soon', ['Air-fuel ratio sensor failed', 'Exhaust leak before it', 'Wiring'], [], 'حساس الأكسجين الأمامي'],
  ['P0136', 'Oxygen sensor circuit (bank 1, sensor 2, after the catalyst)', 'watch', ['Rear oxygen sensor failed', 'Exhaust leak'], [], 'حساس الأكسجين الخلفي'],
  ['P0171', 'Running lean (too much air, bank 1)', 'soon', ['Vacuum leak (cracked hose, PCV hose, intake gasket) — listen for a hiss', 'Dirty MAF sensor', 'Weak fuel pump or blocked injectors'], ['airFilter'], 'خلط فقير (هواء زائد)'],
  ['P0172', 'Running rich (too much fuel, bank 1)', 'soon', ['Leaking injector', 'Dirty MAF sensor', 'Blocked air filter', 'Oxygen sensor'], ['airFilter', 'plugs'], 'خلط غني (بنزين زائد)'],
  ['P0300', 'Random misfires', 'stop', ['Worn spark plugs or a failing ignition coil', 'Vacuum leak', 'Low fuel pressure', 'Bad fuel'], ['plugs'], 'تقطيع في المكينة'],
  ['P0301', 'Misfire in cylinder 1', 'stop', ['Ignition coil or spark plug on cylinder 1 (swap the coil with another cylinder to see if the code follows)', 'Injector', 'Low compression'], ['plugs'], 'تقطيع سلندر ١'],
  ['P0302', 'Misfire in cylinder 2', 'stop', ['Ignition coil or spark plug on cylinder 2', 'Injector', 'Low compression'], ['plugs'], 'تقطيع سلندر ٢'],
  ['P0303', 'Misfire in cylinder 3', 'stop', ['Ignition coil or spark plug on cylinder 3', 'Injector', 'Low compression'], ['plugs'], 'تقطيع سلندر ٣'],
  ['P0304', 'Misfire in cylinder 4', 'stop', ['Ignition coil or spark plug on cylinder 4', 'Injector', 'Low compression'], ['plugs'], 'تقطيع سلندر ٤'],
  ['P0325', 'Knock sensor circuit', 'soon', ['Knock sensor or its wiring', 'Low-octane fuel (use 91)'], [], 'حساس الطرق'],
  ['P0335', 'Crankshaft position sensor', 'stop', ['Crank sensor or its wiring — the engine can cut out or not start'], [], 'حساس الكرنك'],
  ['P0340', 'Camshaft position sensor', 'soon', ['Cam sensor or its wiring', 'Timing chain'], [], 'حساس الكامات'],
  ['P0351', 'Ignition coil A circuit (cylinder 1)', 'soon', ['Ignition coil 1 or its plug'], ['plugs'], 'كويل سلندر ١'],
  ['P0352', 'Ignition coil B circuit (cylinder 2)', 'soon', ['Ignition coil 2 or its plug'], ['plugs'], 'كويل سلندر ٢'],
  ['P0353', 'Ignition coil C circuit (cylinder 3)', 'soon', ['Ignition coil 3 or its plug'], ['plugs'], 'كويل سلندر ٣'],
  ['P0354', 'Ignition coil D circuit (cylinder 4)', 'soon', ['Ignition coil 4 or its plug'], ['plugs'], 'كويل سلندر ٤'],
  ['P0401', 'Exhaust gas recirculation (EGR) flow too low', 'watch', ['EGR passages clogged with carbon', 'EGR valve sticking'], [], 'بلف EGR'],
  ['P0420', 'Catalytic converter below efficiency (bank 1)', 'watch', ['Ageing catalytic converter (common past 250,000 km)', 'Rear oxygen sensor', 'An exhaust leak', 'Burning oil'], ['oil'], 'الدبة (المحول الحفاز)'],
  ['P0441', 'Fuel vapour (EVAP) purge flow incorrect', 'watch', ['Purge valve (VSV) sticking', 'EVAP hose cracked'], [], 'نظام أبخرة البنزين'],
  ['P0442', 'Small EVAP leak', 'watch', ['Fuel cap not tight or its seal cracked — tighten it till it clicks', 'Cracked EVAP hose', 'Charcoal canister'], [], 'غطاء البنزين / تسريب أبخرة'],
  ['P0446', 'EVAP vent control', 'watch', ['Vent valve or canister', 'Dust in the vent filter (common in desert driving)'], [], 'نظام أبخرة البنزين'],
  ['P0455', 'Large EVAP leak', 'watch', ['Fuel cap missing or loose', 'Hose off at the canister'], [], 'غطاء البنزين / تسريب أبخرة'],
  ['P0456', 'Very small EVAP leak', 'watch', ['Fuel cap seal', 'Hairline crack in an EVAP hose'], [], 'غطاء البنزين / تسريب أبخرة'],
  ['P0500', 'Vehicle speed sensor', 'soon', ['Wheel speed sensor or its wiring (often with the ABS light)', 'Gearbox speed sensor'], [], 'حساس السرعة'],
  ['P0505', 'Idle air control (idle speed out of range)', 'watch', ['Dirty throttle body (clean it, then an idle relearn)', 'Vacuum leak'], [], 'بوابة الهواء (الثروتل)'],
  ['P0606', 'Engine computer (ECM) internal fault', 'soon', ['Low battery voltage or poor earth first', 'ECM itself (rare)'], ['battery'], 'كمبيوتر المكينة'],
  ['P0700', 'Gearbox computer has a fault stored', 'soon', ['A second, gearbox code explains it: the workshop reads the gearbox module'], ['atf'], 'عطل في القير'],
  ['P0715', 'Gearbox input speed sensor', 'soon', ['Input speed sensor or wiring'], ['atf'], 'حساس سرعة القير'],
  ['P0741', 'Torque converter lock-up stuck off', 'soon', ['Old or low ATF — drain-and-fill with Toyota ATF WS first', 'Lock-up solenoid', 'Torque converter (the 40–70 km/h shudder)'], ['atf'], 'تعشيق التورك كونفرتر'],
  ['P0750', 'Shift solenoid A', 'soon', ['Solenoid or its wiring', 'Dirty ATF'], ['atf'], 'سلنويد القير'],
  ['P0770', 'Shift solenoid E', 'soon', ['Solenoid (harsh or late shifts)', 'Dirty ATF'], ['atf'], 'سلنويد القير'],
  ['P0A0F', 'Engine failed to start (hybrid systems)', 'soon', ['Hybrid only: the workshop needs a Toyota scan tool'], [], 'تشغيل المكينة'],
  ['P1604', 'Startability malfunction (Toyota)', 'soon', ['Weak battery or slow cranking', 'Fuel pressure dropping overnight'], ['battery', 'batteryNew'], 'صعوبة التشغيل'],
  ['P2195', 'Air-fuel sensor stuck lean (bank 1, sensor 1)', 'soon', ['Air-fuel ratio sensor ageing', 'Vacuum or exhaust leak'], [], 'حساس الأكسجين الأمامي'],
  ['P2196', 'Air-fuel sensor stuck rich (bank 1, sensor 1)', 'soon', ['Air-fuel ratio sensor ageing', 'Leaking injector'], [], 'حساس الأكسجين الأمامي'],
  ['P2238', 'Air-fuel sensor circuit low (bank 1, sensor 1)', 'soon', ['Air-fuel ratio sensor or wiring'], [], 'حساس الأكسجين الأمامي'],
  ['P2440', 'Secondary air switching valve', 'watch', ['Valve stuck (not on every engine)'], [], 'صمام الهواء الثانوي'],
  ['P2610', 'Engine computer internal timer', 'watch', ['Often after a weak battery or a jump-start; clears after repair'], ['battery'], 'كمبيوتر المكينة'],
  ['C1201', 'Engine system fault seen by the stability control (Toyota)', 'soon', ['An engine code is stored too: fix that one and this clears'], [], 'نظام الثبات'],
  ['C1241', 'Low battery voltage seen by the ABS', 'soon', ['Battery or alternator — test both'], ['battery', 'batteryNew', 'belt'], 'جهد البطارية'],
  ['C1223', 'ABS control system fault', 'soon', ['Wheel speed sensor', 'Low brake fluid', 'ABS module'], ['brakeFluid'], 'نظام الفرامل ABS'],
  ['B1650', 'Occupant classification (passenger seat sensor)', 'soon', ['Seat sensor or wiring — the passenger airbag may be off'], [], 'حساس كرسي الراكب'],
  ['U0100', 'Lost communication with the engine computer', 'soon', ['Battery terminal loose or corroded', 'A wiring or CAN fault'], ['battery'], 'انقطاع اتصال الكمبيوتر'],
];
export const CODES = Object.fromEntries(T.map(([code, title, level, causes, care, ar]) => [code, { code, title, level, causes, care, ar }]));

const SYSTEM = { P: 'Engine and gearbox', C: 'Chassis (brakes, ABS, steering, suspension)', B: 'Body (airbags, seats, lights, locks)', U: 'Network (the car’s computers talking to each other)' };
const P_GROUP = { '0': 'Fuel and air metering, emissions', '1': 'Fuel and air metering', '2': 'Fuel and air metering (injectors)', '3': 'Ignition and misfires', '4': 'Emission controls (EGR, EVAP, catalyst)', '5': 'Speed and idle control', '6': 'Engine computer and its outputs', '7': 'Gearbox', '8': 'Gearbox', '9': 'Gearbox', 'A': 'Hybrid system' };

/** Clean what was typed: "p0171", "P 0171", "0171" → "P0171". */
export function normalise(s) {
  const t = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^[PCBU][0-9A-F]{4}$/.test(t)) return t;
  if (/^[0-9][0-9A-F]{3}$/.test(t)) return 'P' + t;
  return '';
}
/** What a code means: the table entry, or what its letters and digits say about it. */
export function lookup(s) {
  const code = normalise(s); if (!code) return null;
  if (CODES[code]) return { ...CODES[code], known: true };
  const generic = code[1] === '0' || (code[0] === 'P' && code[1] === '2');   // P0/P2, C0, B0, U0 are standard; P1, C1, B1… are the maker's
  const group = code[0] === 'P' ? P_GROUP[code[2]] || '' : '';
  return { code, known: false, title: `${SYSTEM[code[0]]}${group ? ` · ${group}` : ''}`, level: code[0] === 'P' && code[2] === '3' ? 'stop' : 'soon', causes: [generic ? 'A standard (SAE) code: the full meaning is the same on every car — search it with “Camry” for the usual causes.' : 'A maker-specific code: a Toyota scan tool or the workshop’s reader gives the exact meaning.'], care: [], ar: '' };
}
/** Codes whose text matches a word ("misfire", "evap", "lean"). */
export function search(q, n = 12) {
  const w = String(q || '').toLowerCase().trim(); if (!w) return [];
  const code = normalise(w); if (code) return [lookup(code)];
  return Object.values(CODES).filter(c => `${c.code} ${c.title} ${c.causes.join(' ')} ${c.ar}`.toLowerCase().includes(w)).slice(0, n);
}
/** Lights on the dashboard and what they ask of you (no code reader needed). */
export const LIGHTS = [
  { icon: '🌡️', name: 'Temperature (red)', level: 'stop', say: 'Engine overheating. AC off, heater on full, pull over when safe and switch off. Never open the radiator cap hot. Check the coolant once cold.' },
  { icon: '🛢️', name: 'Oil pressure (red oil can)', level: 'stop', say: 'Stop the engine now: no oil pressure wrecks it in minutes. Check the dipstick; don’t drive until it is found.' },
  { icon: '🔋', name: 'Charging (red battery)', level: 'soon', say: 'The alternator isn’t charging: you are running on the battery. Turn off the AC and radio and drive straight to a workshop; the belt may be broken.' },
  { icon: '🛑', name: 'Brake (red, “!” in a circle)', level: 'stop', say: 'Handbrake still on, or the brake fluid is low (worn pads or a leak). If the pedal feels soft, don’t drive.' },
  { icon: '🟠', name: 'Check engine (amber, steady)', level: 'soon', say: 'A fault is stored. Read the code (any OBD reader) and look it up here. Check the fuel cap first.' },
  { icon: '⚠️', name: 'Check engine (flashing)', level: 'stop', say: 'Misfiring badly: unburnt fuel is overheating the catalytic converter. Slow down, no hard acceleration, and get it seen today.' },
  { icon: '🅰️', name: 'ABS (amber)', level: 'soon', say: 'Normal brakes still work, but not the anti-lock. Usually a wheel speed sensor.' },
  { icon: '🛞', name: 'Tyre pressure (amber “!” in a tyre)', level: 'soon', say: 'A tyre is low: check all four cold. On older Camrys a TPMS sensor battery can keep it on with good pressures.' },
  { icon: '🚗', name: 'Slip / VSC (amber car with skid lines)', level: 'soon', say: 'Flashing: stability control is working (slippery road). Steady with “VSC”: often follows a check-engine fault.' },
  { icon: '🧍', name: 'Airbag (red seated person)', level: 'soon', say: 'An airbag may not fire in a crash. Get it read soon; never probe the wiring yourself.' },
];
