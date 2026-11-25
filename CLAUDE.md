# Autolime — notes for Claude

- The owner's car app (the citrus family). Split out of Calamansi's Car tab on 25/11/2026 (handoff: project doc `claude/autolime-handoff.md`; owner facts: `claude/owner-profile.md`). Plain English in the UI, dates dd/mm/yyyy, metric, SAR; Arabic workshop words beside every part.
- Vanilla ES-module PWA, no build step, served by GitHub Pages from `main` `/docs` at https://autolime-car.github.io/Autolime/.
- One data owner per kind: cars (identity, papers, insurance, care, odometer, fuel, visits with part prices, plan, trips, tyres, renewals), the driver (`settings.driver`), workshops, quotes and photo records → Autolime. Shifts → Mandarin (read `shifts.json`, tag `mandarin`, for days off and trip leave). Never write into another app's Drive folder.
- Drive: folders by tag (`appProperties.citrusApp`), never by path (`google.js appFolder`). Autolime's own folder is made once inside the area tagged `citrusArea=life` as "Car - Autolime" and tagged at once; Citrus may move/rename it. It holds `state.json`, `status.json` (HUB.md contract v2, `drive.byTag`), `backups/`, `setup.json` (proposals from Claude, applied only on tap) and `photos/<kind>/`.
- Photos: shrunk on the phone, kept in IndexedDB first (`photos.js`), uploaded on the next sync; only the record is in state.json.
- The migration: once, from Calamansi's `state.json` (tag `calamansi`): cars + `settings.driver`, with a backup before and Undo. Calamansi is never written.
- Undo everywhere: `ctx.undoTo(before)`.
- Before every deploy: `bash test/all.sh` must pass, then `sh scripts-bump.sh` (service-worker module list and cache name).
- Never commit real personal data: no plate, VIN, policy number, names or phone numbers. Tests use `test/fixture.mjs` and `test/policy-sample.*` (made up). Real data arrives only through the owner's tap (migration, setup link, setup file).
- Browser tests pin the clock and run in Asia/Riyadh. Keep `tools/check-imports.mjs` green. `tools/icons.mjs` redraws the PNG icons from `docs/icons/icon.svg`.
- Design: "the garage dashboard" — Clean = carbon + lime instruments (default), Paper = the workshop manual (blueprint grid, ink blue), Arcade = 8-bit. Saira Condensed for numbers, Manrope for text, Noto Kufi Arabic for Arabic. The four signature marks (wheel with a lime segment, corner fold, peel curl, pip) as in `claude/signature.md`.
- Add seminal upgrades to the App Building Master Log (skill: app-master-log).
