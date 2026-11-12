# History

This file logs meaningful changes, with the newest entry first. Each entry follows this format:
`YYYY-MM-DD · branch · type(scope): summary (US #n)`.

- 2026-11-12 · feat/photos-gallery · fix(auth): restart stale backend code and redesign login with split blue branding.
- 2026-11-12 · feat/photos-gallery · feat(auth): add file-backed basic login, persisted frontend session and logout (US #25).
- 2026-10-31 · feat/photos-gallery · feat(album): reuse grid and single-photo gallery views inside albums (US #10).
- 2026-10-31 · main · feat(photos): add the all-photo grid and expanded arrow-key photo viewer (US #10).
- 2026-10-31 · main · chore(make): bootstrap the API and frontend together and configure verified frontend-only deployment.
- 2026-10-29 · main · docs(agents): reconcile source/test paths, demo-user scope, commands and CI coverage; record the documentation-only direct-to-main workflow exception.
- 2026-10-28 · chore/workflow · chore(test): move frontend tests from `src/app/` to `test/` and configure Vitest discovery (commit `a3418ba`, PR #9; US #3).
- 2026-10-28 · feat/view-albums · feat(album): list and open the demo user's albums; login remains pending (US #3).
- 2026-10-28 · feat/view-albums · docs(agents): reconcile current state with the reorganized frontend and the proposal.
- 2026-10-26 · docs/agents-context · docs(agents): set up `.agents/` context. Added `AGENTS.md` and
  this file, root `AGENTS.md` and `CLAUDE.md` pointers to them, a gitignored per-lab `PLAN.md`
  handoff file, and a rule that agents never credit themselves.
