# Agent Context — STSWENG Smart Album

Start here. Several people work on this repo, each with their own tools and agent setup, so this file
holds only repo-wide facts and rules. Machine paths, personal tools and delegation workflows belong in
your own user-level config, not here.

## Files in `.agents/`

| File          | What it is                                                                                    | Who edits it |
| ------------- | --------------------------------------------------------------------------------------------- | ------------ |
| `AGENTS.md`   | This file: current state, commands, rules                                                      | Agents and people |
| `PROPOSAL.md` | Project specs, methodology, Git workflow, CI, commit and PR rules. **The source of truth.**   | **READ-ONLY.** Never edit it. |
| `TODO.md`     | Product backlog (user stories US #1–#25, priorities, assignees, tasks)                        | People; agents update status only (see below) |
| `HISTORY.md`  | Log of meaningful changes, newest first                                                        | Agents and people |
| `PLAN.md`     | *Optional, gitignored, one per lab.* Your own implementation and handoff notes (see below)    | You only |

If this file and `PROPOSAL.md` disagree, `PROPOSAL.md` wins, except for the explicitly authorized
documentation-only workflow exception under *Rules*. Otherwise, fix this file to match.

**`PLAN.md` (per-lab handoff):** you can keep your own `.agents/PLAN.md` holding the current task, the
decisions made, what is done and what comes next, written so that a fresh session with no earlier
context can pick up the work from it. Git ignores it, so every contributor's plan stays local. If you
have one, read it at the start of a session and update it before you stop. Anything that matters to
the whole team belongs in `AGENTS.md` or `HISTORY.md` instead.

## Project

A web app for events. Users upload photos into albums that an admin creates. The app helps curate them:
it flags duplicate, similar and low-quality photos, recommends the best shots, organizes photos
chronologically from capture time and place in their metadata, lets users edit photos (crop, rotate,
color grade), arrange album/collage layouts, and preview and export the album. There are two roles:
**admin** (creates and labels albums) and **user** (uploads to them, edits and curates). See
`PROPOSAL.md` for the full spec and `TODO.md` for the stories.

Follow `PROPOSAL.md` when it and `TODO.md` conflict: only an admin creates and labels albums (US #1 is
written "as a user"). In `TODO.md`, US #15 is used twice (recommend best shots, then crop), with US #14
between them. Do not renumber or reassign; that is a team decision.

Planned parts (from `PROPOSAL.md`): web front end, back-end server, photo analysis module.

## Current state

<!-- Reconcile this section after every meaningful change. -->

- **Front end:** `frontend/`. Vite 8 + React 19 + TypeScript 6, ESLint, Vitest. Entry point is
  `src/main.tsx`; app code is in `src/app/` and styles in `src/styles/`. US #3 is implemented for the
  demo user: a hash-routed album list (`#/`) and album page (`#/albums/:id`), with loading, empty and
  error states. The album page currently shows only its title and a link back to the list.
- **Back end:** `server/src/`. Node.js HTTP (no framework or package dependencies) on port 3000,
  with TypeScript run directly by Node using `--experimental-strip-types`. At startup it validates
  and loads `server/data/albums.json` into memory. `GET /api/albums` lists the current user's albums;
  `GET /api/albums/:id` returns an owned album or 404 for a missing or other user's album. Albums
  contain only `id`, `title` and `ownerId`; there are no write endpoints.
- **Identity and remaining features:** `server/src/current-user.ts` fixes every request to
  `demo-user`; login and admin/user roles are not implemented (US #25, #23, #24). Album creation,
  deletion, photo upload/viewing/editing, layouts, export and photo analysis are not implemented.
- **Tests:** frontend tests live in `frontend/test/`, outside `src/`. `frontend/vite.config.ts`
  discovers only `test/**/*.test.{ts,tsx}`. The four current tests cover static album rendering and
  hash parsing; they do not exercise browser interactions or API fetching. The frontend build
  type-checks `src/` and `vite.config.ts`, not `test/`. `server/test/albums.test.ts` has seven tests
  covering ownership filtering, seed-file loading/validation and HTTP reads. The server test script
  names this file explicitly; there is no separate server type-check or build script.
- **CI:** `.github/workflows/ci.yml` runs on pull requests to `main` only, on Node 22. Frontend job:
  `npm ci`, `npm test`, `npm run build`. Server job: `npm test`. Both jobs run for every PR; there
  are no push triggers, path filters or cancellation of outdated runs. Linting, formatting and
  end-to-end tests are not in CI. PR-title validation, automatic labeling, dependency updates and
  release automation are not configured in the repo. GitHub branch protection/review settings
  cannot be established from these files.
- **Formatter / end-to-end tests:** neither is configured.
- **Album preview (US #22):** `#/albums/:id/preview`, linked from the album page, renders
  `src/app/AlbumPreview.tsx`: the album title and its photos (full images, API order) as a
  read-only page with no controls inside it. There are no collage layouts or export yet; export
  (US #23) should render this same component. `frontend/test/albumPreview.test.tsx` covers it.

## Commands

Use the latest Node 22 release to match CI. Run the following in separate terminals, each starting
at the project root; there is no root package script.

```bash
cd frontend
npm install        # or `npm ci` for a clean, lockfile-exact install
npm run dev        # http://localhost:5173 — proxies /api to the server
```

```bash
cd server
npm start          # http://localhost:3000 — no npm install needed
```

Checks and local build preview (run in the named directory):

```bash
# frontend/
npm test           # vitest run — frontend/test/
npm run lint       # eslint .
npm run build      # tsc -b && vite build
npm run preview    # http://localhost:4173 — preview the built frontend

# server/
npm test           # node --experimental-strip-types --test test/albums.test.ts
```

Vite preview [inherits `server.proxy`](https://vite.dev/config/preview-options#preview-proxy), so
both dev and preview forward `/api` to port 3000 and need the API running. The static build itself
does not include a proxy.

**Gate before a PR:** in `frontend/`, `npm test`, `npm run lint`, and `npm run build` must pass. In
`server/`, `npm test` must pass. When a formatter is added, add it here too.

## Rules (from `PROPOSAL.md`, with a documentation-only exception)

- **Code changes:** never commit or push directly to `main`. Work on a descriptively named branch,
  open a PR into `main`, and merge only after CI passes and a QA member or team lead approves.
- **Documentation-only exception:** context files (including `.agents/`) and other documentation
  may be committed and pushed directly to `main`; no separate branch or PR is required. This is an
  explicitly authorized exception to `PROPOSAL.md`'s branch/PR workflow. Changes that also affect
  code, tooling or CI follow the normal branch/PR workflow.
- **Commit and PR titles** use `<type>(<optional scope>): <description>`, where type is one of
  `feat | fix | style | test | docs | refactor | chore`. Example: `feat(album): add drag-and-drop photo reordering`.
- **PRs stay small**, cover one task, and say what changed, why, and which user story (`US #n`) they address.
- Keep branches up to date with `main`. If you hit a merge conflict, resolve it and re-run the gate.
- Commit, push or open a PR only when the person you are working for asks you to.
- **Agents never credit themselves.** Do not add `Co-Authored-By:` trailers, "Generated with …" lines,
  or any other AI or agent attribution to commits, PR titles, PR descriptions or code. Commits are
  authored by the human contributor.

## Reference implementation: Immich

[Immich](https://github.com/immich-app/immich) is a mature self-hosted photo and video manager. Agents
may copy code from it roughly or take ideas from it. Clone it shallowly into the OS temp directory, not
into this repo:

```powershell
# PowerShell
git clone --depth 1 https://github.com/immich-app/immich.git "$env:TEMP\immich"
```
```bash
# bash / Git Bash
git clone --depth 1 https://github.com/immich-app/immich.git "${TMPDIR:-${TEMP:-/tmp}}/immich"
```

If the clone already exists, run `git -C <dir> pull` on it instead of cloning again.

Where to look:

| Need | Immich path |
| ---- | ----------- |
| Albums CRUD, adding and removing assets | `server/src/services/album.service.ts` |
| Upload and asset handling | `server/src/services/asset-media.service.ts`, `asset.service.ts` |
| EXIF / metadata extraction | `server/src/services/metadata.service.ts` |
| Thumbnails and transcoding | `server/src/services/media.service.ts` |
| Duplicate and similar detection (CLIP embeddings) | `server/src/services/duplicate.service.ts`, `smart-info.service.ts`, `machine-learning/immich_ml/models/clip/` |
| Auth, users, admin role | `server/src/services/auth.service.ts`, `user.service.ts`, `user-admin.service.ts` |
| Album page, timeline, photo viewer UI | `web/src/lib/components/{album-page,timeline,asset-viewer}/` |

Notes:

- Immich's server is NestJS (TypeScript), its web app is **Svelte**, and its ML service is Python
  (FastAPI). Our front end is React, so treat Immich's UI code as a reference for logic and behavior,
  not something to paste.
- Immich is licensed **AGPL-3.0**. When you copy a non-trivial piece, add a comment naming the source
  path, e.g. `// adapted from immich server/src/services/album.service.ts`.

## Keeping context current (last step of every meaningful change)

Before you finish any change that affects behavior, structure, tooling, CI or dependencies:

1. **`AGENTS.md`**: update *Current state*, *Commands* and the gate so they match the repo.
2. **`HISTORY.md`**: add an entry at the top: date, branch, a one-line summary, and the user story if
   there is one.
3. **`TODO.md`**: if the change finishes a backlog task, mark it done. Do not invent stories, renumber
   them or reassign people. Those are team decisions.
4. Remove anything in these files that is no longer true.

Typo fixes and other trivial edits need none of this.
