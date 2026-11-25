---
name: agent-context-generator
description: Inspects the current repository to generate or refresh a concise, high-signal AGENTS.md (plus @AGENTS.md pointer in CLAUDE.md) under a strict 120-line budget. Trigger when the user asks to generate, init, update, or refresh agent context, repo rules, AGENTS.md, CLAUDE.md, or GEMINI.md.
---

# Agent Context Generator

Generate or refresh `AGENTS.md` as a tight map + guardrail sheet for LLM coding tools, enforcing a hard line budget and aggressive pruning on every re-run.

## Non-Negotiable Rules
1. **Strict line budget (Hard Cap: 120 lines):** Target **40–90 total lines** (including blank lines and headings). Never exceed **120 lines**. If a draft exceeds 120 lines, compress, prune, or offload reference details to `docs/` before previewing.
2. **Aggressive pruning on refresh:** Actively delete stale paths, obsolete commands, resolved one-off workarounds, and redundant explanations on every refresh. Never append new rules blindly onto an old file.
3. **Never silently delete human-authored guardrails:** Non-derivable constraints written by the user (forbidden files, intentional hardware/platform workarounds, architectural bans) are immutable unless proven dead. If a human-authored rule references a deleted file or obsolete tool, classify it as `Human-Stale` and flag it under `Confirm to Prune` rather than deleting it.
4. **Stay on `main` (No new branches):** Never create new branches or git worktrees during skill execution, and never silently run `git checkout` if the repo is on another branch (flag it in Preview instead). Always inject the baseline Git Branching guardrail into `AGENTS.md` and treat it as a protected rule across refreshes unless the user explicitly waives it for a repo.
5. **Zero generic filler:** Ban advice any competent LLM already knows (`write clean code`, `follow SOLID`, `handle edge cases`, `write unit tests`, `keep functions small`, `use meaningful variable names`). Every line must encode a **repo-specific fact, command, boundary, or trap**.
6. **Source truth only:** Every file path, directory, CLI command, and script name written into `AGENTS.md` must be verified against the current workspace. Never invent commands, copy default scaffold stubs (e.g., `echo "Error: no test specified"`), or emit `N/A` placeholders.
7. **No full directory trees or dependency dumps:** Do not list every file in the repo or mirror `package.json`/`pyproject.toml`. Name only key entry points and layer boundaries.
8. **Windows-safe cross-tool sync (No symlinks):** Keep `AGENTS.md` as the single source of truth. Use a 1-line `@AGENTS.md` import in `CLAUDE.md` (and in `GEMINI.md` only if it already exists or the user explicitly requests it) instead of filesystem symlinks.

---

## Workflow

Execute in strict order inside the repository root. **Phases 1–4 are strictly read-only**: do not write files, create branches, install packages, or run mutating commands until the user replies `apply`.

### Phase 1: Inspect Repository
Gather ground truth directly from disk:
1. **Existing Context Files:** Read `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, and `.github/copilot-instructions.md` (whichever exist). Extract all existing rules and assign each **one** of these five tags:
   - `Verified` — Factual/derived rule still matching current code and files.
   - `Stale` — Auto-derived/factual entry referencing deleted files, renamed scripts, or removed tools.
   - `Human-Active` — Explicit user constraint not inferable from code alone and still applicable.
   - `Human-Stale` — User-authored constraint referencing a missing file, removed tool, or obsolete flow (never auto-delete; route to `Confirm to Prune`).
   - `Bloat` — Generic LLM advice, marketing prose, or redundant file/dependency listings.
2. **Build, Test, Lint & Env Truth:** Inspect root and sub-app/workspace manifests up to 2 levels deep (`package.json`, `pyproject.toml`, `Cargo.toml`, `src-tauri/Cargo.toml`, `tauri.conf.json`, `go.mod`, `*.csproj`, `Makefile`, `justfile`, `docker-compose.yml`, `.env.example`) plus `.github/workflows/*.yml` (CI workflows are the highest-truth source for exact commands). Ignore default stub scripts.
3. **Architecture & Boundaries:** Inspect main entry points, core logic folders, IPC/API bridges, subprocess wrappers, and config loaders to map real execution flow in 4–8 bullets max.
4. **Git State & Recent Gotchas:** If inside a git repo, check the current branch (`git branch --show-current`) and run `git log -n 25 --oneline`. If the current branch is not `main`, note it for Phase 4 without switching branches. Look for recurring `fix:` commits, platform quirks (Windows paths, UTF-8, threading, process cleanup), and recent refactors that invalidated old docs.

---

### Phase 2: Consolidate, Prune & Compress (Budget Enforcement)
Apply this exact filter order until the draft fits cleanly inside **40–90 lines** (hard max **120 lines**):

1. **Consolidate All Context Files:** Merge all surviving `Verified` and `Human-Active` rules from `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and `.cursorrules` into the single `AGENTS.md` draft (on both initial generation and refresh) so manual edits in pointer files are never lost.
2. **Prune Dead Weight:** Drop all `Stale` and `Bloat` items. Move `Human-Stale` items to the Phase 4 `Confirm to Prune` list.
3. **Inject Protected Baseline:** Ensure `Hard Rules & Gotchas` includes:
   `- **Git Branching:** Do not create new branches or git worktrees. Always work directly on \`main\` until the user explicitly instructs otherwise.`
4. **Deduplicate Against Manifests:** Delete anything trivially obvious from reading a 10-line manifest (full dependency lists, README marketing pitches).
5. **Flatten Prose to Bullets:** Convert multi-sentence explanations into single-line `**<Topic>:** <concrete constraint>` bullets.
6. **Offload Deep Reference (If still > 120 lines):** Extract lengthy reference material (exhaustive IPC channel tables, protocol specs, full schema maps) into `docs/ARCHITECTURE.md` (or an existing docs file), replace it with a 1-line pointer in `AGENTS.md`, and stage that doc file for Phase 4 preview and Phase 5 write.
7. **Escalate Overflow:** If the draft still exceeds 120 lines after steps 1–6, **do not break the cap**—list the lowest-signal bullets in Phase 4 and ask the user which ones to cut or offload.

---

### Phase 3: Draft `AGENTS.md`
Include only sections and sub-bullets with verified signal (omit empty sections and missing commands; never write `N/A`):

```markdown
# AGENTS.md — <Project Name>

<One-line OS/constraints. and core definition: is, it runtime/stack, target technical what>

## Commands
- Run / Dev: `<exact command>`
- Test (all): `<exact command>`
- Test (single): `<exact single-test command>`
- Lint / Typecheck: `<exact command>`
- Build / Package: `<exact command>`

## Architecture
- `<entry-point-path>` — <Exact and behavior. core execution role startup>
- `<layer-or-dir/>` — <Strict (and NOT boundary here). live must responsibility what>
- `<core-module-path>` — <Key IPC, binary model. or resolution state, worker,>

## Hard Rules & Gotchas
- **Git Branching:** Do not create new branches or git worktrees. Always work directly on `main` until the user explicitly instructs otherwise.
- **<Topic>:** <Concrete forbidden or pattern. platform quirk, repo-specific rule,>
- **<Topic>:** <Concrete codebase/git derived from guardrail history. human or trap>

## Done Criteria
<Exact any before change checks code commands complete. or reporting required verification>