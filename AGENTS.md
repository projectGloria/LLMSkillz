# AGENTS.md — LLMSkillz

Windows-first Electron 36 + React 19 + Vite 6 + TypeScript desktop app that manages a local library of `SKILL.md` folders and copies them into Antigravity, Claude and Codex skill directories.

## Commands
- Dev: `npm run dev` (Vite on port 5173 with `strictPort`; Electron waits on it through `wait-on`)
- Typecheck + build renderer: `npm run build` (`tsc --noEmit && vite build` → `dist/`)
- Run built app: `npm start`
- Package (unpacked): `npm run pack` · Installers: `npm run dist` (→ `release/`)
- CI packaging: `npx electron-builder --win nsis portable --x64 --publish never`
- Tests / lint: none configured. Don't invent `npm test` or `npm run lint`.

## Architecture
- `electron/main.cjs` holds all filesystem logic: config, skill scanning, hashing, install/uninstall, and every `ipcMain.handle` handler. It is CommonJS.
- `electron/preload.cjs` exposes the `window.llmSkillz` bridge through `contextBridge` (`contextIsolation: true`, `nodeIntegration: false`).
- `src/types.ts` defines `LLMSkillzAPI` and `AppState`, the typed IPC contract for the renderer.
- `src/App.tsx` owns `AppState`. Every mutating IPC call returns a fresh full `AppState`, which replaces local state.
- `src/components/` holds the UI only (`SkillWorkspace`, `TargetsView`, `SettingsView`, `Sidebar`, `TitleBar`, `NewSkillModal`). No Node or fs access here.
- `skills/` is the bundled default library. Its layout is `<skill>/SKILL.md` or `<section>/<skill>/SKILL.md` (one nesting level).
- Config is stored at `app.getPath('userData')/llmskillz-config.json`. Default targets come from `getDefaultTargets()` in `electron/main.cjs`.

## Hard Rules & Gotchas
- **IPC changes touch 3 files:** a new or renamed channel must be updated in `electron/main.cjs`, `electron/preload.cjs` and `src/types.ts` together.
- **No typecheck for Electron files:** `tsconfig.json` includes only `src`, so `tsc` never checks `electron/*.cjs`. Keep them as `require` CommonJS and check by running `npm run dev`.
- **Path safety:** any skill or file path coming from the renderer must go through `resolveSkillDir()` and then `resolveFileInsideDir()`. Never use `path.join` directly on renderer input.
- **Installs are destructive:** `copyDirClean()` deletes the destination folder (`rm -rf`) before copying. `target:importSkill` overwrites the library folder with the same name.
- **Flat install names:** targets receive `path.basename(skillDir)`, so the section is dropped. Two skills with the same folder name in different sections overwrite each other.
- **Install status is a hash:** it compares a SHA-256 of the lowercased relative paths plus file bytes. Any byte change makes a skill `outdated`. `IGNORED_DIRS` entries are skipped.
- **Entry file is case-insensitive:** `skill.md`, `SKILL.MD` and others are all accepted. Example: `skills/github-release-workflow/SKILL.MD`. New skills are written as `SKILL.md`.
- **Frontmatter parser is hand-rolled:** `parseFrontmatter()` supports flat `key: value` lines and indented continuation lines only. It has no YAML lists, nested maps or block scalars.
- **Markdown preview:** `marked` output must always pass through `DOMPurify.sanitize` before `dangerouslySetInnerHTML` (`src/components/SkillWorkspace.tsx`).
- **Vite `base: './'` is required:** production loads `dist/index.html` over `file://`. Don't change it or the port 5173 `strictPort` setting.
- **Frameless window:** `frame: false`. The minimize, maximize and close controls are custom IPC in `src/components/TitleBar.tsx`.
- **External links:** `setWindowOpenHandler` and `will-navigate` send http(s) links to `shell.openExternal`. Keep the renderer from navigating away.
- **Release:** pushing a tag `vX.Y.Z` runs `.github/workflows/release.yml`. The tag must equal the `package.json` `version` or CI fails. Builds are Windows x64 only and unsigned (`CSC_IDENTITY_AUTO_DISCOVERY=false`), and the result is a draft GitHub Release.
- **Outputs:** `dist/` and `release/` are gitignored build output. Don't edit or commit them.

## Done Criteria
- `npm run build` passes (tsc plus vite).
- If `electron/*.cjs` or the IPC changed: launch with `npm run dev` and use the changed flow, because nothing else checks those files.
- If you change a version for a release, `package.json` `version` matches the intended tag.
