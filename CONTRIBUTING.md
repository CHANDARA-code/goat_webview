# Contributing to Goat WebView

Thank you for your interest in contributing to **Goat WebView**! This document provides complete instructions for setting up your environment, adhering to code quality and security standards, and submitting clean, verifiable Pull Requests.

---

## 🌿 Branch Naming Conventions

All branch names must follow a structured naming convention reflecting the nature of the change:

```
<category>/<issue-or-task-id>-<short-description>
# or
<category>/<short-description>
```

### Allowed Branch Categories:
- `feat/` — A new feature, bridge action, or capability (e.g., `feat/10201-cross-miniapp`, `feat/biometric-auth`)
- `fix/` — A bug fix or security remediation (e.g., `fix/10198-permission-dialog`, `fix/zip-slip-guard`)
- `perf/` — Performance optimization or latency reduction (e.g., `perf/fastpool-eviction`, `perf/warm-start`)
- `refactor/` — Code refactoring without behavioral changes (e.g., `refactor/bridge-dispatcher`)
- `test/` — Adding or updating test suites (e.g., `test/e2e-tier4-workflows`)
- `docs/` — Documentation updates (e.g., `docs/root-readme-contributing`)
- `tooling/` or `ci/` — Build scripts, toolchains, or CI workflow updates (e.g., `ci/aggregator-job`)
- `chore/` — Routine maintenance and dependency bumps (e.g., `chore/bump-webkit`)

---

## 💬 Commit Message Format (Conventional Commits)

This repository strictly enforces the [Conventional Commits](https://www.conventionalcommits.org/) standard via `.husky/commit-msg` hooks.

### Commit Message Structure:

```
<type>(<optional-scope>): <imperative description> (task <optional-task-id>)

[optional body explaining motivation, architecture decisions, and details]

[optional footer(s) for task references, PR links, or BREAKING CHANGES]
```

### Allowed Commit Types:
- `feat`: A new feature or bridge action
- `fix`: A bug fix or security patch
- `perf`: Performance optimization
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding missing tests or correcting existing tests
- `docs`: Documentation only changes
- `tooling`: Changes to build scripts, developer tools, or VS Code snippets
- `ci`: Changes to CI workflows or scripts
- `chore`: Maintenance changes not touching source or test logic

### Real Commit Message Examples from Git History:
- `feat(cross-miniapp): implement cross-miniapp launch & windowed presentation bridge (task 10201)`
- `fix(permissions): wire the priming dialog to real OS permission APIs (task 10198)`
- `feat(payments): implement App2App deep-link return verifier and universal link protection (task 10206 L5)`
- `feat: implement native print sheet & sandboxed PDF export controller (task 10185)`
- `feat: implement popup window open & target _blank modal/browser handler (task 10183)`
- `docs(rules): update CODE_RULE.md with Husky pre-commit standards`
- `test(docs): update sidebar normalization check in tier2 tests and wire verify-all.sh gate`
- `chore(deps): bump androidx.webkit from 1.10.0 to 1.11.0`

---

## ✅ Step-by-Step Pull Request Checklist

Before submitting a Pull Request, ensure every step of this checklist is completed:

1. **Branch Creation**:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feat/10201-cross-miniapp
   ```
2. **Code Implementation**:
   - Follow SOLID design principles and OWASP MASVS v2.0 security rules in [`CODE_RULE.md`](./CODE_RULE.md).
   - Core Android SDK binary size must remain `<500 KB`.
   - WebKit calls must execute strictly on the Main/UI thread; disk and network I/O must execute on IO dispatchers.
3. **Add Tests (>90% Branch Coverage)**:
   - Add unit and integration tests covering nominal, boundary, and error paths.
4. **Format & Linting**:
   - Android: `./android/gradlew -p android lint`
   - Flutter: `cd goat_webview && flutter analyze && cd example && flutter analyze`
   - TypeScript/JS: `npm run lint` / `npx eslint .`
5. **Local CI Quality Gate Execution (Zero Failures Required)**:
   - Run the master verification suite locally:
     ```bash
     bash scripts/verify-all.sh
     ```
   - Must exit with `0` and display `100% Master Test Infrastructure & Quality Gates Verified!`.
6. **Atomic Commits**:
   - Commit changes atomically. Husky `.husky/pre-commit` and `.husky/commit-msg` hooks will validate tests and commit format automatically.
7. **Push & Open Pull Request**:
   - Push your branch to `origin` and open a PR targeting `main` (or `develop`).
   - Complete the PR template, linking the relevant Issue or Task ID.
8. **CI Validation**:
   - Verify that all GitHub Actions workflow jobs pass (Android, iOS, RN, Flutter, Web, and the `all-checks-pass` aggregator job).

---

## 🧪 Adding New Platform Tests & Packages

### 1. Adding an Android Unit / Integration Test
- **Location**: `android/core/src/test/java/com/goat/webview/<Feature>Test.kt`
- **Pattern**:
  ```kotlin
  package com.goat.webview

  import org.junit.Test
  import org.junit.Assert.*

  class GoatMyFeatureTest {
      @Test
      fun testNominalExecution() {
          // Assert expected behavior
      }
  }
  ```
- **Execution**: `./android/gradlew -p android testDebugUnitTest`

### 2. Adding an iOS XCTest
- **Location**: `ios/Tests/GoatWebViewTests/<Feature>Tests.swift`
- **Pattern**:
  ```swift
  import XCTest
  @testable import GoatWebView

  final class GoatMyFeatureTests: XCTestCase {
      func testNominalExecution() throws {
          // Assert expected behavior
      }
  }
  ```
- **Execution**: `npm run test:ios`, or `xcodebuild test -scheme GoatWebView-Package -destination "generic/platform=iOS Simulator"` from the repository root (`Package.swift` lives at the root so SPM can resolve this repo as a package)

### 3. Adding a React Native Test
- **Location**: `react-native-goat-webview/src/__tests__/<Feature>.test.ts`
- **Pattern**:
  ```typescript
  import { GoatBridge } from '../GoatBridge';

  describe('GoatMyFeature', () => {
    it('executes bridge action correctly', async () => {
      // Assert expected behavior
    });
  });
  ```
- **Execution**: `npm --prefix react-native-goat-webview test`

### 4. Adding a Flutter Test
- **Location**: `goat_webview/test/<feature>_test.dart`
- **Pattern**:
  ```dart
  import 'package:flutter_test/flutter_test.dart';
  import 'package:goat_webview/goat_webview.dart';

  void main() {
    testWidgets('GoatMyFeature nominal execution', (WidgetTester tester) async {
      // Assert expected behavior
    });
  }
  ```
- **Execution**: `cd goat_webview && flutter test`

### 5. Adding a Web SDK Test
- **Location**: `miniapp-web/src/__tests__/<feature>.test.ts`
- **Execution**: `npm --prefix miniapp-web test`

### 6. Adding a Master Monorepo 4-Tier E2E Test
- **Location**: `tests/e2e/tier1-feature-coverage/`, `tier2-boundary-corner/`, `tier3-cross-feature/`, or `tier4-real-world-scenarios/`
- **Registration**: Import and invoke your test suite in `packages/appservice/test/e2e/run-all.ts`
- **Execution**: `npm run test:e2e`

### 7. Adding a New Monorepo Package
1. Create directory `packages/<new-package>/`
2. Initialize `package.json` with `"name": "@goat/<new-package>"`, `"scripts": { "test": "...", "build": "..." }`, `"files": ["dist", "README.md", "LICENSE"]`
3. Add `packages/<new-package>/README.md`
4. Register the new test suite in `scripts/verify-packages.sh` (incrementing package counter and adding test check block)
5. Update `package.json` at root if needed

### 8. Validating Before Publishing to NPM

Before proposing changes to published package manifests or releasing to npm, run the pre-publish master validation gate locally:

```bash
node scripts/validate-npm-publish.mjs --offline
```

Flags:
- `--offline`: Runs hermetically without querying the remote npm registry (skips registry version existence checks and external `@goat/*` lookups).
- `--allow-existing`: Skips already-published package versions on the registry instead of failing (used for idempotent runs).

This gate enforces:
- Manifest sanity (`name`, semver `version`, `license`, `repository`, `files` or `.npmignore`, not `private: true`, and build targets exist).
- Monorepo version synchronization across the packages listed in `scripts/npm-packages.txt`, except those in `INDEPENDENT_VERSION_PACKAGES` (`@goat/bridge-mock` and `@goat/server`), which carry their own version line.
- Dependency hygiene (no `file:`, `link:`, or `workspace:` specifiers; internal `@goat/*` version alignment; all `.d.ts` imports present in `dependencies` or `peerDependencies`).
- Builds, test suites, and typechecks across every package.
- Tarball hygiene via `npm pack --dry-run --json` (ensures README, LICENSE, and built entrypoints are present; blocks test files, unbundled TypeScript sources, `.env*`, `TASK_*.md`, `.agents/`, oversized files > 5 MB, and absolute local sourcemaps).
- Clean-room consumer smoke test: packs tarballs into a temporary location outside the workspace, installs them together into a fresh consumer project, and verifies CJS/ESM module loading and consumer `tsc --noEmit` type resolution.

---

## 🛡️ Security & Code Quality Standards

Contributors must strictly adhere to [`CODE_RULE.md`](./CODE_RULE.md):
- **OWASP MASVS v2.0 Compliance**: Legacy `@JavascriptInterface` is strictly forbidden. All communication must utilize `WebViewCompat.addWebMessageListener` restricted exclusively to `https://appassets.androidplatform.net`.
- **Zip Slip Prevention**: All archive decompressions must assert canonical path containment: `file.canonicalPath.startsWith(stagingDir.canonicalPath)`.
- **Zero Plaintext PII**: Never log tokens, passwords, GPS coordinates, or PII in logcat or console outputs.
- **Memory Cleanup**: Implement the mandatory 6-step view teardown (`stopLoading()`, `loadUrl("about:blank")`, `clearHistory()`, `removeAllViews()`, `destroy()`, `null`).

---

## 📬 Reporting Issues & Requesting Features

Please use GitHub Issue Templates located in [`.github/ISSUE_TEMPLATE`](./.github/ISSUE_TEMPLATE/):
- 🐛 [**Bug Report**](./.github/ISSUE_TEMPLATE/bug_report.yml) — Report reproducible bugs across Android, iOS, React Native, Flutter, or Web.
- ✨ [**Feature Request**](./.github/ISSUE_TEMPLATE/feature_request.yml) — Propose architecture enhancements or new runtime features.
- 🔌 [**New SuperApp Bridge API Proposal**](./.github/ISSUE_TEMPLATE/bridge_api_request.yml) — Propose a new native hardware or platform capability bridge action.
