---
name: github-release-workflow
description: Inspects the current local repository to generate a deterministic GitHub Actions workflow (.github/workflows/release.yml) that builds platform installers/archives, generates SHA256 checksums, and publishes them to GitHub Releases. Trigger when the user asks to create, set up, or update a GitHub Actions workflow for building installers and publishing releases.
---

# GitHub Release & Installer Workflow

Generate a verified `.github/workflows/release.yml` (and any missing installer config such as Inno Setup `.iss`) directly from the current repository's source code.

## Non-Negotiable Rules
1. **Source truth only:** Never guess build commands, entry points, icon paths, lockfiles, or bundle targets. Verify every path and script in the repository before writing YAML.
2. **Two-stage pipeline (Build -> Release):** Never upload release assets directly from inside a matrix build job. Always separate artifact compilation (`build` job) from release publication (`release` job with `needs: build`) so a failure on one OS never leaves a half-published release, and a single unified `SHA256SUMS.txt` covers every asset.
3. **Explicit shells on Windows/cross-platform jobs:** Always set `shell: bash` or `shell: pwsh` explicitly on every `run:` step that uses shell-specific syntax (`$VAR`, `&&`, globbing, `Compress-Archive`). Never rely on runner defaults.
4. **No deprecated actions or runners:** Never use `actions/create-release`, `actions/upload-release-asset`, or EOL runners (`ubuntu-20.04`, `macos-12`). Use current pinned major versions (`actions/checkout@v4`, `actions/upload-artifact@v4`, `actions/download-artifact@v4`, `softprops/action-gh-release@v2`) or match commit-SHA pinning if existing `.github/workflows/` files already use SHA pins.
5. **Least-privilege permissions:** Always declare explicit `permissions:` (`contents: read` at workflow level; `contents: write` only on the `release` job).
6. **No fake code signing:** Never wire placeholder signing steps that fail when secrets are absent. Only add signing/notarization env vars if the user confirms those repository secrets exist.
7. **Never push or tag automatically:** Only write local files after explicit user confirmation. Never run `git commit`, `git tag`, or `git push`.

---

## Workflow

Execute in strict order inside the repository root.

### Phase 1: Inspect Repository
Read ground truth from the workspace:
1. **Existing CI/CD:** Check `.github/workflows/` for existing build/release workflows, runner conventions, or pinned action SHAs.
2. **Stack & Manifests:** Inspect whichever apply:
   - **Tauri:** `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `package.json`, lockfile (`pnpm-lock.yaml`, `bun.lock*`, `package-lock.json`, `yarn.lock`).
   - **Electron:** `package.json` (`electron-builder` or `@electron-forge/*`), `electron-builder.yml`/`json`, `forge.config.*`.
   - **Python Desktop / CLI:** `pyproject.toml`, `requirements.txt`, `*.spec` (PyInstaller), `setup.py`, entry point (`main.py` / `app.py`), UI framework (PyQt6/PySide6/Tkinter/CLI).
   - **Rust:** `Cargo.toml`, `Cargo.lock`.
   - **Go / .NET / Node / Browser Extension:** `go.mod`, `*.csproj`, `manifest.json`.
3. **Existing Packaging Assets:** Search for `.iss` (Inno Setup), `.nsi` (NSIS), `.wxs` (WiX), `.spec`, app icons (`.ico`, `.icns`, `.png`), and existing build scripts.
4. **Target Platform Constraints:** Check code and manifests for OS-specific APIs (e.g., `win32api`, `ctypes.windll`, `winreg`, `windows` crate, PowerShell calls, Windows-only paths). Do not add Linux/macOS matrix targets to a Windows-only codebase.

---

### Phase 2: Select Packaging Strategy

Match the detected stack to the cleanest native build path:

| Stack | Build / Installer Strategy | Expected Artifacts |
|---|---|---|
| **Tauri (v1/v2)** | Build via `cargo tauri build` (or `tauri-apps/tauri-action` with `includeUpdaterJson` only if updater is configured in `tauri.conf.json`). On Linux, install required `libwebkit2gtk` / `libappindicator` apt deps. | Windows: `.exe` (NSIS) / `.msi`; macOS: `.dmg`; Linux: `.AppImage`, `.deb` |
| **Electron** | Install with lockfile (`npm ci` / `pnpm install --frozen-lockfile`), build app, run `electron-builder --publish never` (or `electron-forge make`). Let the `release` job publish. | Windows: `.exe` (NSIS) / portable `.exe`; macOS: `.dmg`; Linux: `.AppImage`, `.deb` |
| **Python (GUI / CLI)** | Build with PyInstaller (`--onedir` for installers, `--onefile` only if explicitly requested or CLI-only) or Nuitka if already configured. For a Windows installer, generate an Inno Setup `.iss` script and compile with `iscc` (preinstalled on `windows-latest`); also zip portable build if desired. | Windows: `<app>-<ver>-setup-x64.exe` and/or `<app>-<ver>-portable-win-x64.zip`; Linux/macOS: `.tar.gz` |
| **Rust (CLI / Native)** | `cargo build --release --locked`. Package binary + `README.md`/`LICENSE` into `.zip` (Windows) or `.tar.gz` (Unix). | `<app>-<ver>-<os>-<arch>.zip` / `.tar.gz` |
| **Browser Extension** | Build dist bundle (if bundler exists) and zip unpacked extension files cleanly (excluding source maps, `.git`, tests). | `<app>-<ver>-chromium.zip` (and `-firefox.zip` if MV2/Gecko manifest exists) |
| **.NET / Go** | `dotnet publish -c Release -r <rid> --self-contained` or `go build -ldflags="-s -w"`. Wrap in `.zip`/`.tar.gz` (plus optional Inno Setup `.iss` for Windows GUI). | `<app>-<ver>-<os>-<arch>.zip` / `.tar.gz` / `-setup.exe` |

**Standard Workflow Architecture:**
- **Triggers:**
  - `push: tags: ['v[0-9]+.[0-9]+.[0-9]+*']` (publishes release).
  - `workflow_dispatch:` with boolean input `dry_run` (default `true`) so builds and installers can be tested manually from the Actions tab without creating a release.
- **Version Extraction & Sanity Check:**
  - On tag push, extract `VERSION="${GITHUB_REF_NAME#v}"`.
  - Optionally warn or fail fast if the tag version disagrees with the manifest version (`package.json`, `Cargo.toml`, `tauri.conf.json`, `pyproject.toml`).
- **Release Job (`needs: build`):**
  - Condition: `if: startsWith(github.ref, 'refs/tags/v')` (skips publishing on `workflow_dispatch` dry runs).
  - Downloads all build artifacts into `release-assets/` with `merge-multiple: true`.
  - Generates `SHA256SUMS.txt` over all release files (`sha256sum * > SHA256SUMS.txt` on `ubuntu-latest`).
  - Publishes via `softprops/action-gh-release@v2` with `generate_release_notes: true`, `fail_on_unmatched_files: true`, and `draft: true` by default (unless the user prefers immediate publish).

---

### Phase 3: Show Plan & Wait

Before creating or modifying any files, output only this plan and wait for confirmation:

- **Detected Stack:** `<language / framework / bundler>`
- **Target Runners:** `<e.g., windows-latest only, or windows-latest + ubuntu-latest + macos-latest>`
- **Artifacts to Build:** `<exact installer/archive formats and naming pattern>`
- **Files to Create / Modify:**
  - `.github/workflows/release.yml`
  - `<any helper file like installer/setup.iss, or omit if none>`
- **Release Mode:** `Draft release` (auto-generated notes + `SHA256SUMS.txt`; manual dry-run enabled via `workflow_dispatch`)
- **Version Sync Check:** `<Manifest file checked against git tag, or N/A>`
- **Prerequisites / Gaps Found:** `<missing icon, missing build script, unsigned installer warning, or None>`

End with: `Reply "apply" to generate these files, or tell me what to adjust (e.g., OS targets, draft vs publish, portable vs installer).`

---

### Phase 4: Write Files

Only after the user replies `apply` (or confirms edits):
1. Create `.github/workflows/` (and `installer/` if generating an Inno Setup `.iss` script) if they do not exist.
2. Write `.github/workflows/release.yml` adhering to:
   - Deterministic dependency caching (`actions/setup-node` cache, `actions/setup-python` cache, `Swatinem/rust-cache@v2`).
   - Exact manifest-verified build commands and output paths.
   - Clean artifact staging step that renames outputs into predictable, versioned filenames before `actions/upload-artifact@v4`.
   - `release` job running on `ubuntu-latest` that merges artifacts, computes `SHA256SUMS.txt`, and creates the GitHub Release.
3. If generating an Inno Setup `.iss` file for a Windows installer:
   - Read app name, publisher/author, icon path, and executable name from repo manifests.
   - Accept `/DMyAppVersion=<version>` from CLI (`iscc /DMyAppVersion=$VERSION installer/setup.iss`) so versions never go stale in `.iss`.
   - Set `PrivilegesRequired=lowest` (with `PrivilegesRequiredOverridesAllowed=dialog`) so users can install per-user without mandatory UAC elevation unless the app explicitly requires admin rights.

---

### Phase 5: Validate Locally & Report

Before finishing, run local checks silently:
1. **YAML Syntax Check:** Validate `.github/workflows/release.yml` parses cleanly (e.g., `python -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml', encoding='utf-8'))"` or `node` equivalent if PyYAML isn't installed).
2. **Linter (if available):** If `actionlint` is installed on PATH, run `actionlint .github/workflows/release.yml` and fix any warnings/errors.
3. **Path Verification:** Confirm every local file path referenced inside the workflow (`.spec`, `.iss`, icon, working directory, config file) exists on disk.

Report concisely:
- Files written and validation status.
- One-line dry-run instruction (Actions tab -> Release -> Run workflow).
- Exact commands to cut the first release:
  ```bash
  git tag v0.1.0
  git push origin v0.1.0
  ```