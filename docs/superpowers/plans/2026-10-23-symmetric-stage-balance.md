# Symmetric stage balance — implementation plan
Goal: Keep the approved balanced silhouettes and straight readable routes, and add meaningful route choices in practice.
Architecture: presentation overrides for unchanged problems; explicit versioned graph revisions for changed practice problems; offline generated eight-draw banks and exhaustive proof.
Tech Stack: JavaScript ES modules, Canvas, node:test, Playwright Chromium/WebKit, existing static PWA build.
Spec: latest user approval of 設計検証/対称配置案-20261023/index.html plus harder practice; approved Q17 map and graph.
Global constraints: first six remain approachable; 42 stages and 288 draws; existing IDs, saved circuits and old scores remain; no curved light; unique fullscore, partial clear, two solution families; exact intervals; mirror tempo and gate start windows unchanged; visible/cache versions updated.
Review focus: graph/position reflection, route clearance in actual layouts, generation completeness, compatibility and speed.
- [x] Capture regression baseline and failing reflection/clearance tests.
- [x] Add balanced delivery and rhythm revisions; restore return silhouettes; repair gate41 skeleton.
- [x] Regenerate only changed banks; prove every allowed wiring, two winners across families, unique fullscore and partial clears.
- [x] Update compatibility tests and version0.88.0; build and full tests.
- [x] Actual UI all42 × four layouts × two engines, direct wiring and changed-stage solutions; inspect screenshots.
- [ ] Fresh review, publish to both existing hosts, verify assets and public UI; document exact evidence boundaries.
Decisions: topology changes authorized by current user request; do not ask for another execution approval. Difficulty comes from additional plausible branch/merge choices, not long artificial waits. Intro and good mirrored stages retain behavior.
