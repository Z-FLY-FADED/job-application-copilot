# Job Application Copilot · 求职快填

[简体中文](README.md) · [Verification workflow](https://github.com/Z-FLY-FADED/job-application-copilot/actions/workflows/verify.yml) · [Architecture](docs/ARCHITECTURE.md) · [Test report](docs/TEST_REPORT.zh-CN.md)

A browser extension that maps locally stored profiles to job application fields. Preview the mappings, fill personal information and education, internship, project, award and campus-role records, then review the website. It supports undo, existing-value protection and separate submission checks for supported entry points.

The repository retains the original **职投台** web workspace for job organization, resume summaries, application queues and exports. The web workspace and extension use separate browser storage; profiles are not automatically shared. The application UI remains Chinese.

## Version 1.8.0

This release restructures the existing implementation while preserving behavior:

- Separate DOM utilities, controls, fill/undo state, profile data, semantic matching, adapters and UI modules.
- Build the MV3 extension locally with esbuild; retain its UI, JSON format, permissions and workflow.
- Retain Moka, bilingual BSH, MoSeeker and AAC/ATSX adapters, native controls, named radio groups, date conversion, same-origin frames and open Shadow DOM.
- Add reproducible tests, GitHub Actions and repository privacy checks. All public fixtures are fictional.

## Build and install

Requires Node.js 22 or newer and npm. Browser tests additionally require Playwright Chromium.

```sh
git clone https://github.com/Z-FLY-FADED/job-application-copilot.git
cd job-application-copilot
npm ci
npm run build
```

1. Open `edge://extensions` or `chrome://extensions`.
2. Enable Developer mode and load **`dist/extension`** as an unpacked extension.
3. Open the profile editor, enter your data or import a local JSON backup, and save.
4. On an application form, select **识别当前页面** (scan), review the mappings, then **填入** (fill).
5. Review newly created fields after dynamic updates and inspect the website before submitting.

For an existing installation, export a backup, copy the new build over the **original unpacked directory**, and reload the extension. Loading from a different directory may create another extension identity and require importing your local backup. Update by replacing and reloading. This is not a browser-store release.

```sh
npm run package
```

Produces `releases/jobfill-extension-1.8.0.zip` and a SHA-256 file. The ZIP contains only the extension, with no personal profiles, browser state or development dependencies. A successful GitHub Actions run also provides a `jobfill-extension` artifact.

## Original web workspace

On Windows, run `启动投递助手.bat`, or open the root `index.html` in a browser. The original web page and business scripts remain unchanged. See the [original Chinese guide](docs/WEB_ASSISTANT.zh-CN.md).

## Tests

```sh
npm ci
npx playwright install chromium
npm run verify
```

`verify` builds the extension, runs seven behavior suites, then checks repository candidates for private data. The 115 checks cover a real MV3 installation, activeTab, chrome.storage, chrome.scripting, native and reconstructed platform forms, and the original web workspace. Tests run in isolated browsers with local HTTP pages, not your regular browser profile.

The local migration ran the same 115 checks against the archived 1.7.0 build and 1.8.0, followed by 12 equivalence checks. See the [test report](docs/TEST_REPORT.zh-CN.md). These results do not establish acceptance by every live recruiting system. Account state, server-side persistence, verification challenges and final receipt must be checked on the actual website.

| Command | Purpose |
| --- | --- |
| `npm run build` | Build `dist/extension` |
| `npm test` | Build and run all behavior suites |
| `npm run test:web` | Test the original web workspace |
| `npm run check:privacy` | Check private paths, identity-number patterns and credentials |
| `npm run package` | Build and package the extension |
| `npm run test:baseline` | Run behavior checks against a local 1.7.0 archive |
| `npm run test:equivalence` | Compare scans, matching, UI and interfaces after both runs |

Test output is written to the ignored `artifacts/` directory. `JOBFILL_BROWSER` can select a test Chromium executable; `JOBFILL_EXTENSION_DIR` can select another build. The private baseline archive is not distributed, so baseline tests are optional local migration checks, not a public CI requirement.

## Layout

```text
src/extension/
  content/core/          DOM, controls, fill/undo state
  content/adapters/      Moka, MoSeeker, AAC/ATSX
  content/submission.js  Separate submission checks and duplicate prevention
  shared/               Profile schema, matching, text rules, injection configuration
  ui/                   Popup and profile editor
public/extension/       Manifest, HTML, CSS, icons
scripts/                Build, test, package and privacy checks
tests/fixtures/         Fictional profiles and local forms
docs/                   Architecture, references and verification records
dist/extension/         Generated extension; ignored
local-private/          Personal data and local archives; ignored
artifacts/              Test output; ignored
releases/               Packaged builds; ignored
index.html, app.js, …    Retained original web workspace
```

## Data and behavior

- Permissions remain `activeTab`, `scripting` and `storage`. The extension-page CSP blocks network connections. The extension itself does not call AI services, cloud APIs or profile synchronization. Recruiting websites receive the information you fill into them.
- Extension profiles use `chrome.storage.local`; the web workspace uses `localStorage`. Exported files are not separately encrypted.
- Personal JSON, resumes, historical screenshots, logs, browser state and archives stay in ignored local directories and are excluded from commits and builds.
- Missing date precision, missing time and ambiguous options are skipped. Agreements, declarations, CAPTCHAs and attachment uploads require manual handling.
- Submission checking and submission are separate actions for supported entry points. Filling does not automatically submit. Verify the final result on the website.

See the [reference projects](docs/REFERENCES.zh-CN.md), [esbuild API](https://esbuild.github.io/api/) and [Playwright extension testing guide](https://playwright.dev/docs/chrome-extensions). The original usage notice is retained in the web guide; no additional open-source license is introduced.
