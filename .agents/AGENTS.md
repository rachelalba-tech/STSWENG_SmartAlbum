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

If this file and `PROPOSAL.md` disagree, `PROPOSAL.md` wins. Fix this file to match.

**`PLAN.md` (per-lab handoff):** you can keep your own `.agents/PLAN.md` holding the current task, the
decisions made, what is done and what comes next, written so that a fresh session with no earlier
context can pick up the work from it. Git ignores it, so every contributor's plan stays local. If you
have one, read it at the start of a session and update it before you stop. Anything that matters to
the whole team belongs in `AGENTS.md` or `HISTORY.md` instead.

## Project

A web app for events. Users upload photos into albums that an admin creates. The app helps curate them:
it flags duplicate, similar and low-quality photos, recommends the best shots, sorts photos by EXIF
time and place, lets users edit photos (crop, rotate, color grade), arrange album/collage layouts, and
preview and export the album. There are two roles: **admin** (creates and labels albums) and **user**
(uploads to them, edits and curates). See `PROPOSAL.md` for the full spec and `TODO.md` for the stories.

Planned parts (from `PROPOSAL.md`): web front end, back-end server, photo analysis module.

## Current state

<!-- Reconcile this section after every meaningful change. -->

- **Front end:** `frontend/`. Vite + React 19 + TypeScript, ESLint. It is still the default Vite
  scaffold, so no app features exist yet.
- **Back end / photo analysis:** not started. The stack is not chosen yet. Record the choice here once
  it is made.
- **CI:** `.github/workflows/ci.yml` runs `npm ci` and `npm run build` in `frontend/` on PRs to `main`.
  Lint, format, tests, path filtering, and the other automation listed in `PROPOSAL.md` are not set
  up yet.
- **Tests / formatter:** none configured yet.

## Commands

```bash
cd frontend
npm install        # or `npm ci` for a clean, lockfile-exact install
npm run dev        # http://localhost:5173
npm run lint
npm run build      # tsc -b && vite build. This is what CI runs
```

**Gate before a PR:** `npm run lint` and `npm run build` must pass in `frontend/`. When tests and a
formatter are added, add them here too.

## Rules (summarized from `PROPOSAL.md`)

- **Never commit or push to `main`.** Work on a descriptively named branch, open a PR into `main`, and
  merge only after CI passes and a QA member or team lead approves.
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
