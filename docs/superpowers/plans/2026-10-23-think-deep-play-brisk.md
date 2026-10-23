# Think deeply, play briskly — implementation plan

Goal: review all 42 stages so the thought comes from clear route choices, with varied challenge within each set and short satisfying execution.
Architecture: keep authored layouts and mechanics; version and regenerate changed timing banks with explicit pacing acceptance; improve only definite return-pattern failure termination. Preserve existing simulation clock, exact intervals, audio and saved old conditions.
Tech Stack: JavaScript modules, existing offline generators/Simulation, node:test, Playwright Chromium/WebKit, static PWA.
Spec: docs/proposals/2026-10-23-think-deep-play-brisk.md and latest user clarification.

Constraints: 42 stages, 288 draws; intro teaching remains; straight and symmetric readable layout; unique perfect/partial/two families; return counts/intervals and gate perfect start window>=1sec; zero mirror outputs; old scores/circuits remain. New content versions and app/cache0.89.0. Generated time budgets are checks on whole problems, never hidden cutoff of a slow valid solution.
Review focus: failed/partial wiring as well as winner; exact expected arrival boundary and simultaneous events; invisible numeric difficulty; score identity; canonical regeneration; no concurrency of heavy jobs.

- [x] Read-only audit of all banks and runtime, preserve exact0.88 fixture.
- [x] Return failure result/deadline and Session termination: core agent owns src/core/return-pattern.js, src/app/session.js, tests/return-pattern.test.js and tests/return-pacing-session.test.js. Red/green tests and same-time/old saved/free boundaries.
- [x] Return6: inventory agent owns return definition/generator/bank/proof and tests/return-brisk.test.js. Source: fixture old definitions; eight draws, short choices, first clear<=2.5, first-N completion, unique/partial/families; all legal wirings.
- [x] Gate6: gate agent owns gate definition/generator/bank/proof and tests/gate-brisk.test.js. Coordinated half-time transformation with exact phase grid;42 retains generous opening window. Full all-wiring/all-phase verification scheduled serially.
- [x] Root regular18: add build-only tempo/difficulty profile; regenerate short comparable choices with thinking/relief rhythm, preserve graph/coordinates; whole-wiring canonical proof, not only winner. Modify challenges integration and generator only root.
- [x] Root integration: compatibility/old tests, semantic stage intent listing, full36+ tests in <=5file serial batches; source syntax/build/cache; actual all42 x4 layouts x2 browsers, changed stage perfect and partial/failed replay; fresh review.
- [ ] Publish to both existing URLs; verify actual asset contents, update, save, offline, all42 layout; document source/deploy/evidence and physical-playtest limit. No extra approval gate for already authorized work.

Agents may not change shared tests/challenges.js/package/index/AGENTS or run heavy generation concurrently. Root handles all integration, versioning, final review/release. Exact shared bank shape {id:string,baseVersion:number,family:number,times:string[],baseline:string,maxDuration:string}; root snapshot tests/fixtures/pre-brisk-0.88.json is immutable. Return helper signature/deadline contract coordinated before generator integration. Report changed files, tests/exit status, decisions, risks; no nested agents or broad process termination.
