# Vehicular (was Autolime)

Your car, looked after. The car app of the citrus family: a PWA with no build step, served from `docs/`.

- **Dash** — an instrument cluster: health as a tachometer, the odometer roller, fuel use, the warning lights that would be on, the plate, and one tap to log a service, fuel, show the workshop list or open the accident card.
- **Service** — every part by system, due by km or date (whichever first), with its Arabic workshop name, what to ask for, what it cost last time and where it sits on the car; the planned service (on a day off, into Google Calendar) and the list for the counter.
- **Fuel & money** — fill-ups, L/100 km tank by tank, money month by month, and what a km really costs with the insurance and tyres counted.
- **Papers** — istimara, fahas, insurance and licence with days left, renewal checklists, the insurance read from its PDF on the phone, a papers wallet on your own Drive.
- **Trip** — legs with km, hours and fuel stops, what falls due on the way, shifts you need leave for, the checklist, a morning check on the road and the trip's money.
- **Garage** — workshops and quotes side by side, engine-light codes in plain words, "what is that noise?" guided checks, and the anatomy with a Find-it game.

Tests: `bash test/all.sh`. Before a deploy: `sh scripts-bump.sh`.
