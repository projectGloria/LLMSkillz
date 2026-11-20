---
name: github-repo-about
description: Inspects the current local repository to draft and apply the GitHub About description and topics/tags via the GitHub CLI (gh). Trigger when the user asks to write, update, or generate the GitHub About section, description, or topics/tags.
---

# GitHub Repo About & Topics

Draft and apply the GitHub repository description and topics directly from the current working directory.

## Workflow

Execute in strict order. Do not touch the remote repository until the user says `apply`.

### 1. Inspect Current Repo
1. Read current remote metadata from the current workspace:
   `gh repo view --json description,repositoryTopics`
2. Read source truth from the codebase (never guess from the folder name):
   - `README.md`
   - Project manifests (`package.json`, `pyproject.toml`, `requirements.txt`, `Cargo.toml`, `go.mod`, `*.csproj`, `tauri.conf.json`, etc.)
   - Top-level directory structure and main entry point if the README is missing or outdated.

### 2. Draft Description & Topics

#### Description
- **Length:** 90–160 characters (GitHub hard limit is 350).
- **Format:** `[What it is] + [Core capability] + [Key stack/platform only if relevant]`.
- **Rules:** Plain text only. No markdown, no emojis, no double quotes (avoids shell escaping issues), and no marketing fluff (`powerful`, `modern`, `seamless`, `blazingly fast`, `all-in-one`, `simple yet powerful`).
- **Website/Homepage URL:** Do not set or modify unless the user explicitly asks.

#### Topics (Tags)
- **Count:** 6 to 12 topics.
- **Format:** Lowercase alphanumeric and hyphens only (`^[a-z0-9][a-z0-9-]*$`), max 50 chars each.
- **Coverage:** Include applicable layers:
  1. Domain/category (e.g., `desktop-app`, `cli`, `binary-analysis`, `media-player`)
  2. Primary language(s) (e.g., `python`, `rust`, `javascript`)
  3. Core frameworks/engines (e.g., `react`, `tauri`, `ffmpeg`)
  4. Target platform if specific (e.g., `windows`, `linux`, `android`)
- **Reject:** Generic filler (`app`, `tool`, `code`, `project`, `software`, `github`, `open-source`) and redundant aliases (`js` + `javascript`, `py` + `python`). Always use GitHub's canonical topic names.

### 3. Show Preview & Wait
Output only this preview and wait for user input:

- **Description (`<N>` chars):** `<proposed description>`
- **Topics to Add:** `tag-1`, `tag-2`, `tag-3`, ...
- **Topics to Remove:** `<stale tags, or omit line if none>`

End with: `Reply "apply" to push these changes, or tell me what to adjust.`

### 4. Apply & Verify
Only after the user replies `apply` (or confirms after edits):
1. Run `gh repo edit` directly in the current directory:
   ```bash
   gh repo edit --description "<approved description>" --add-topic "tag-1,tag-2,tag-3"