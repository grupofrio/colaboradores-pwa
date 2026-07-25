# React 19 Coordinated Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the incompatible Dependabot PR #85 with a coherent React 19.2.x dependency set that installs, tests, lints, and builds cleanly.

**Architecture:** Keep application code unchanged unless a React 19 incompatibility is reproduced. Add a dependency-contract test, align the runtime, DOM, type, and renderer packages in one lockfile operation, then validate the existing Angélica renderer test and the complete project. Publish a replacement PR from the isolated branch and close #85 only after the replacement PR and its checks are confirmed.

**Tech Stack:** React 19.2.x, npm lockfile v3, Node.js 24, Node test runner, ESLint 9, Vite 5, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-07-25-react-19-coordinated-upgrade-design.md`

---

### Task 1: Add a failing React-family dependency contract

**Files:**
- Create: `tests/reactDependencyAlignment.test.mjs`
- Read: `package.json`
- Read: `package-lock.json`

- [ ] **Step 1: Create the dependency-contract test**

Create `tests/reactDependencyAlignment.test.mjs` with:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const packageJson = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
)
const packageLock = JSON.parse(
  await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'),
)

function releaseLine(versionRange) {
  const match = String(versionRange ?? '').match(/(\d+)\.(\d+)/)
  return match ? `${match[1]}.${match[2]}` : ''
}

test('declares the approved React family on major 19 without npm conflict bypasses', async () => {
  const declared = {
    react: packageJson.dependencies?.react,
    'react-dom': packageJson.dependencies?.['react-dom'],
    '@types/react': packageJson.devDependencies?.['@types/react'],
    '@types/react-dom': packageJson.devDependencies?.['@types/react-dom'],
    'react-test-renderer': packageJson.devDependencies?.['react-test-renderer'],
  }

  for (const [name, versionRange] of Object.entries(declared)) {
    assert.equal(releaseLine(versionRange), '19.2', `${name} must declare React 19.2.x`)
  }

  assert.equal(packageJson.overrides, undefined)

  const npmrcUrl = new URL('../.npmrc', import.meta.url)
  const npmrc = await readFile(npmrcUrl, 'utf8').catch(error => {
    if (error?.code === 'ENOENT') return ''
    throw error
  })
  assert.doesNotMatch(npmrc, /^\s*(?:legacy-peer-deps|force)\s*=\s*true\s*$/im)
})

test('locks one React runtime version and compatible major-19 types', () => {
  const packages = packageLock.packages ?? {}
  const reactVersion = packages['node_modules/react']?.version
  const reactDomVersion = packages['node_modules/react-dom']?.version
  const rendererVersion = packages['node_modules/react-test-renderer']?.version

  assert.equal(releaseLine(reactVersion), '19.2')
  assert.equal(reactDomVersion, reactVersion)
  assert.equal(rendererVersion, reactVersion)
  assert.equal(releaseLine(packages['node_modules/@types/react']?.version), '19.2')
  assert.equal(releaseLine(packages['node_modules/@types/react-dom']?.version), '19.2')
})
```

- [ ] **Step 2: Run the test and verify the RED state**

Run:

```bash
node --test tests/reactDependencyAlignment.test.mjs
```

Expected: FAIL because `react` is declared as `^18.3.1`; the message must include `react must declare React 19.2.x`. If it fails for syntax, path, or fixture reasons, fix the test and repeat until the failure proves the missing React 19 migration.

### Task 2: Align all approved React packages and regenerate the lockfile

**Files:**
- Modify: `package.json:14-32`
- Modify: `package-lock.json`
- Test: `tests/reactDependencyAlignment.test.mjs`

- [ ] **Step 1: Update only the five approved dependency declarations**

Apply these exact `package.json` changes:

```json
"react": "^19.2.8",
"react-dom": "^19.2.8"
```

and:

```json
"@types/react": "^19.2.17",
"@types/react-dom": "^19.2.3",
"react-test-renderer": "^19.2.8"
```

Do not change `eslint-plugin-react-hooks`, ESLint, Vite, Tailwind, or any other package.

- [ ] **Step 2: Regenerate the dependency tree without bypasses**

Run:

```bash
npm install --cache /private/tmp/gf-pwa-react19-npm-cache
```

Expected: exit 0. Do not add `--force`, `--legacy-peer-deps`, `overrides`, or `.npmrc` bypasses. Do not run `npm audit fix`.

- [ ] **Step 3: Verify the lockfile can install from scratch**

Run:

```bash
npm ci --cache /private/tmp/gf-pwa-react19-npm-cache --foreground-scripts
```

Expected: exit 0 with the known baseline audit count recorded separately. Any `ERESOLVE` means the dependency set is still invalid and must be investigated before continuing.

- [ ] **Step 4: Run the dependency-contract test and verify GREEN**

Run:

```bash
node --test tests/reactDependencyAlignment.test.mjs
```

Expected: 2 tests pass, 0 fail.

- [ ] **Step 5: Inspect the resolved dependency tree**

Run:

```bash
npm ls react react-dom react-test-renderer @types/react @types/react-dom
```

Expected: exit 0; `react`, `react-dom`, and `react-test-renderer` resolve to 19.2.8, while both type packages resolve to major 19. No invalid or extraneous entries.

- [ ] **Step 6: Commit the coherent dependency migration**

Run:

```bash
git add package.json package-lock.json tests/reactDependencyAlignment.test.mjs
git commit -m "chore: upgrade React family to 19.2"
```

### Task 3: Prove the existing React-renderer behavior under React 19

**Files:**
- Test: `tests/angyPosProductBreakdownUi.test.mjs`
- Modify only if a reproduced React 19 failure requires it: `tests/angyPosProductBreakdownUi.test.mjs`
- Modify only if the test proves a production incompatibility: `src/modules/admin/components/AngyPosProductBreakdown.jsx`

- [ ] **Step 1: Run the only direct `react-test-renderer` consumer**

Run:

```bash
node --test tests/angyPosProductBreakdownUi.test.mjs
```

Expected: all existing cases pass. React 19 may print its upstream deprecation notice for `react-test-renderer`; record it as known migration debt rather than hiding it.

- [ ] **Step 2: Handle only evidence-backed incompatibilities**

If Step 1 passes, make no source or test-harness changes and continue. If it fails:

1. Capture the exact assertion or runtime failure.
2. Confirm it reproduces with React 19 and not in an isolated React 18 baseline worktree created from `origin/main`.
3. Treat the existing failing case as the RED regression test; add a smaller case only if the failure is not isolated.
4. Apply the smallest compatibility change needed for that failure.
5. Re-run the targeted test until it passes.

Do not migrate to another renderer, suppress `console.error`, or refactor unrelated component behavior. If the fix requires a new testing framework or broad production changes, stop and revise the approved spec instead of expanding scope.

For the React 18 comparison in step 2, use a complete isolated checkout so `package.json` and `package-lock.json` remain matched:

```bash
REACT_BASELINE_DIR=$(mktemp -d /private/tmp/gf-pwa-react18.XXXXXX)
git worktree add --detach "$REACT_BASELINE_DIR/worktree" origin/main
npm ci --prefix "$REACT_BASELINE_DIR/worktree" --cache /private/tmp/gf-pwa-react19-npm-cache --foreground-scripts
cd "$REACT_BASELINE_DIR/worktree"
node --test tests/angyPosProductBreakdownUi.test.mjs
cd -
git worktree remove "$REACT_BASELINE_DIR/worktree"
rmdir "$REACT_BASELINE_DIR"
```

Expected: the baseline targeted test passes while both Vite and Node resolve files and dependencies from the React 18 worktree. Always remove only the explicit temporary worktree path returned by `mktemp`; never remove a broad directory.

- [ ] **Step 3: Commit only if compatibility code changed**

If Step 2 changed files, run:

```bash
git add tests/angyPosProductBreakdownUi.test.mjs src/modules/admin/components/AngyPosProductBreakdown.jsx
git commit -m "test: adapt Angy POS rendering for React 19"
```

If neither file changed, skip this commit.

### Task 4: Run complete verification and audit the diff

**Files:**
- Verify all changed files against `origin/main`

- [ ] **Step 1: Run all independent quality gates**

Run the following commands and require exit 0 from each:

```bash
npm test
npm run lint
npm run build
```

Expected:

- Tests: at least 1517 pass and 0 fail (1515 baseline plus 2 dependency-contract cases).
- Lint: 0 errors and 0 warnings.
- Build: Vite succeeds and M3, M4, M7, and supervisor day-control guards all report OK.

- [ ] **Step 2: Reinstall from the committed lockfile**

Run:

```bash
npm ci --cache /private/tmp/gf-pwa-react19-npm-cache --foreground-scripts
node --test tests/reactDependencyAlignment.test.mjs tests/angyPosProductBreakdownUi.test.mjs
```

Expected: clean installation and all targeted tests pass.

- [ ] **Step 3: Verify scope and formatting**

Run:

```bash
git diff --check origin/main...HEAD
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- package.json
npm pkg get devDependencies.eslint-plugin-react-hooks devDependencies.eslint devDependencies.vite
git status --short --branch
```

Expected: no whitespace errors; dependency code changes are limited to the five approved React packages; the three excluded package versions remain unchanged; worktree is clean after committed changes.

### Task 5: Request code review and resolve findings

**Files:**
- Review the complete range from `origin/main` to `HEAD`

- [ ] **Step 1: Capture review SHAs**

Run:

```bash
git rev-parse origin/main
git rev-parse HEAD
```

- [ ] **Step 2: Dispatch the required code reviewer**

Give the reviewer:

- Implementation: coordinated React 19.2.x runtime/DOM/types/renderer upgrade plus dependency-contract test.
- Requirements: `docs/superpowers/specs/2026-07-25-react-19-coordinated-upgrade-design.md`.
- Base SHA: output of `git rev-parse origin/main`.
- Head SHA: output of `git rev-parse HEAD`.
- Focus: invalid peer trees, lockfile drift, unsafe conflict bypasses, React 19 regressions, and scope creep.

Expected: no Critical or Important findings. Fix every valid Critical or Important finding, repeat the relevant verification, commit the fix, and re-request review. Record Minor findings for the PR if they are not required by the spec.

### Task 6: Publish the replacement PR and retire #85

**Files:**
- No additional repository files unless a review finding requires them

- [ ] **Step 1: Verify GitHub authentication before any write**

Run:

```bash
gh auth status
```

Expected: active authenticated account `sebascm0906` with repository access. If authentication remains invalid, stop and ask the user to run `gh auth login -h github.com`; do not claim publication succeeded.

- [ ] **Step 2: Push the branch**

Run:

```bash
git push -u origin codex/react19-coordinated-upgrade
```

- [ ] **Step 3: Open a ready replacement PR**

Run this command to create a PR toward `main`:

```bash
gh pr create --base main --head codex/react19-coordinated-upgrade --title "chore(deps): upgrade React family to 19.2" --body '## Summary

- Aligns react, react-dom, their types, and react-test-renderer on React 19.2.x.
- Adds an automated dependency-coherence contract.
- Replaces the incompatible partial upgrade in #85; eslint-plugin-react-hooks remains unchanged.

## Verification

- npm ci
- npm test
- npm run lint
- npm run build'
```

Before running it, replace the generic verification bullets with the exact observed counts and add the upstream `react-test-renderer` deprecation note if it appeared. Do not claim evidence that was not observed.

- [ ] **Step 4: Confirm GitHub Actions and Vercel**

Run `gh pr checks` for the current branch in bounded intervals, reporting progress at least once per minute. Require the repository CI build and both Vercel statuses to finish successfully. If a GitHub Actions check fails, inspect its logs before changing code. Treat external Vercel failures as external checks and report their URLs.

- [ ] **Step 5: Close the superseded Dependabot PR**

After the replacement PR exists and its checks are green, run:

```bash
REACT19_PR_URL=$(gh pr view --json url --jq .url)
gh pr comment 85 --body "Sustituido por ${REACT19_PR_URL}, la migración coordinada a React 19.2 que alinea runtime, DOM, tipos y renderer sin forzar peer dependencies."
gh pr close 85
```

Do not merge the replacement PR in this task; leave it ready for formal approval.
