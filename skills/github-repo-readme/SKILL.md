---
name: github-repo-readme
description: Analyzes the current repository to generate a structured README.md with the app icon, a custom dark-mode SVG banner, silently captured UI screenshots, and a Mermaid "How it works" flowchart. Trigger when the user asks to write, create, generate, or overhaul a README.
---

# README Writer

Generate a complete, high-signal `README.md` and visual assets (`banner.svg` + UI screenshots) directly from the current repository's source code.

## Non-Negotiable Rules
1. **Source truth only:** Never invent features, flags, config keys, or install steps. Verify every claim in the codebase.
2. **Strictly silent capture:** Never open generated images or banners in a viewer/browser (`start`, `Invoke-Item`, etc.). Always terminate any dev servers or app processes spawned for screenshots, and delete temporary capture scripts before finishing.
3. **No marketing fluff:** Ban words like `revolutionary`, `seamless`, `blazingly fast`, `modern`, `powerful`, `next-gen`, `all-in-one`.
4. **GitHub-safe Mermaid:** Always wrap Mermaid node labels in double quotes (`A["Label (detail)"]`) so parentheses, colons, or slashes never break GitHub's Mermaid renderer.

---

## Workflow

Execute these phases in order inside the repository root.

### Phase 1: Codebase & Asset Discovery
Inspect the workspace to gather ground truth:
1. **Metadata:** Read `git remote -v` (for `owner/repo` badge URLs) and project manifests (`manifest.json`, `package.json`, `pyproject.toml`, `Cargo.toml`, `tauri.conf.json`, `*.csproj`, etc.) for exact name, version, runtime, and dependencies.
2. **Architecture & Behavior:** Read entry points, core modules, UI views, and default config/settings files to map real features, defaults, and execution flow.
3. **App Icon:** Search for the highest-resolution project icon (`icons/`, `assets/`, `public/`, `src-tauri/icons/`, `res/`, or root).
   - Prefer `.png` or `.svg` (128px–512px).
   - If only an `.ico` exists, convert its largest frame silently to `docs/assets/icon.png` (via Python `PIL` or `ffmpeg`) so GitHub renders it reliably.
   - If no icon exists anywhere in the repo, omit the top icon `<img>` rather than fabricating one.
4. **Accent Color:** Extract the app's primary accent hex color from CSS variables, theme files, or the dominant non-neutral color in the app icon (fallback to `#FF6B00` only if the project is strictly monochrome).
5. **Assets Directory:** Reuse an existing `docs/assets/` or `assets/` folder if present; otherwise create `docs/assets/`.

---

### Phase 2: Generate the Banner (`<assets-dir>/banner.svg`)
Create a clean, deterministic dark-mode SVG banner directly on disk (no external image generation APIs, zero broken text).

**Exact visual spec:**
- Canvas: `viewBox="0 0 1200 320"` (`width="1200" height="320"`).
- Background: Rounded rectangle (`rx="18"`) filled with `#111216`, `1px` border `#262830`.
- Ambient glow: Subtle radial gradient on the left edge using the extracted accent color (`stop-opacity="0.28"` fading to `0`).
- Left accent bar: Vertical rounded bar (`x="0"` or `x="4"`, width `8`, height `240`, vertically centered) in the accent color.
- Right geometric detail: 2–3 thin diagonal translucent lines (`stroke` = accent color, `stroke-opacity="0.22"`, `stroke-width="1.5"`) angled across the right quarter.
- Typography (`font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"`):
  - **Title:** `font-size="52" font-weight="800"`, filled with the accent color.
  - **Subtitle:** Single concise tagline (`font-size="22"`, `#D4D4D8`).
- **Feature Pills (3 to 4 max):** Horizontal row along the bottom. Each pill is a dark rounded rect (`fill="#181A20"`, `stroke="#2C2F3A"`, `rx="10"`) containing a small accent-colored circle dot (`r="5"`) and a 2–3 word concrete capability label (`#E4E4E7`, `font-size="16"`). Calculate pill widths dynamically from label length so text never clips or overlaps.

---

### Phase 3: Silent UI Screenshot Capture
Capture 1–3 crisp screenshots of the app's actual UI (`<assets-dir>/screenshot-*.png`) without opening windows in the user's face. Pick the strategy that matches the project stack:

1. **Web Apps (React / Vite / HTML) & Browser Extensions (`popup.html`, `options.html`):**
   - **100% headless.** Prefer Playwright (`npx playwright` or Python `playwright`) or local Chromium/Edge CLI (`--headless=new --disable-gpu --hide-scrollbars --window-size=W,H --screenshot=out.png`).
   - If a dev server is needed, launch it silently in the background, poll localhost until ready, capture, then kill the server process tree.
   - For Chromium extensions whose UI calls `chrome.storage` / `chrome.runtime`: inject a minimal temporary JS shim (via Playwright `addInitScript` or a temporary wrapper removed immediately after capture) populated with realistic default settings so the UI renders cleanly instead of crashing.
   - Tightly crop to the main UI container (no massive empty margins).

2. **Python Qt Desktop Apps (PyQt6 / PySide6 / PyQt5):**
   - **100% offscreen.** Run an ephemeral Python script with `QT_QPA_PLATFORM=offscreen` that initializes the main window (with realistic sample/default state), calls `window.show()`, processes events briefly, saves `window.grab().save("<assets-dir>/screenshot-main.png")`, and exits cleanly.

3. **Native Windows / Tauri / Electron / Tkinter / Win32 GUI Apps:**
   - WebView2/Win32 requires a real HWND and cannot render purely headless. Minimize disruption: launch the process without activating focus (`SW_SHOWNOACTIVATE` / off-screen coordinates if supported), wait for the window handle, capture its client area silently via Win32 `PrintWindow(hwnd, hdc, PW_RENDERFULLCONTENT)` (`0x2`), save the PNG, and immediately kill the spawned process.
   - If the app cannot launch cleanly without manual login, live game state, or physical hardware, **do not force a broken capture**—report what blocked capture and insert a clean HTML comment placeholder in `## Screenshots` instead.

4. **CLI Tools / Libraries (No GUI):**
   - Run the CLI silently (`--help` or a safe dry-run) and render the captured output into a clean dark terminal SVG card (`<assets-dir>/screenshot-cli.svg`), or omit `## Screenshots` entirely if a visual adds no value.

**Post-Capture Validation (Mandatory):**
Before embedding any screenshot, verify:
- File exists and is `> 5 KB`.
- Image is not a blank single-color frame (check pixel variance with a quick one-liner).
- Temporary capture scripts and background servers are completely cleaned up.

---

### Phase 4: Write `README.md`

Follow this exact top-to-bottom layout:

```markdown
<div align="center">

<img src="<relative-path-to-icon>" width="110" alt="<App Name> icon" />

# <App Name>

<One-line app concrete description does. of the what>

<img src="[https://img.shields.io/badge/](https://img.shields.io/badge/)<Stack>-<Value>-<hex>?style=flat-square" alt="<Stack>" />
<img src="[https://img.shields.io/badge/version-](https://img.shields.io/badge/version-)<x.y.z>-2b2d34?style=flat-square" alt="Version" />
<img src="[https://img.shields.io/badge/](https://img.shields.io/badge/)<Platform>-<Target>-2b2d34?style=flat-square" alt="Platform" />
<img src="[https://img.shields.io/github/last-commit/](https://img.shields.io/github/last-commit/)<owner>/<repo>?style=flat-square&color=<hex>" alt="Last commit" />

<br /><br />

<img src="<assets-dir>/banner.svg" alt="<App Name> banner" width="100%" />

<br /><br />

[Features](#features) • [Screenshots](#screenshots) • [How it works](#how-it-works) • [Installation](#installation) • [Usage](#usage) • [Configuration](#configuration) • [Troubleshooting](#troubleshooting)

</div>

## About

<Single (e.g., accurate and concise, constraints exact is, key offline-only, paragraph: permissions required). runtime/dependencies, scope/mechanism, technically the tool what>

## Features

- **<Feature>** — <Concrete behavior code. in verified>
- **<Feature>** — <Concrete behavior code. in verified>

## Screenshots

<p align="center">
  <img src="<assets-dir>/screenshot-main.png" alt="<Short description>" width="720" />
  <br />
  <em><One-line UI caption explaining italic shows. the what></em>
</p>

## How it works

```mermaid
flowchart LR
    A["Trigger / Input"] --> B["Core Handler"]
    B --> C{"Decision Check"}
    C -- "Yes" --> D["Action / Output"]
    C -- "No" --> E["Fallback / Stop"]