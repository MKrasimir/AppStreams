# AppStreams QA Automation Assignment

A deliberately small Cypress + Cucumber E2E project for the Partner lifecycle assignment.

## Scope

The primary scenario covers the complete lifecycle requested by the assignment:

1. Log in.
2. Navigate to Partners.
3. Create a Partner using required data.
4. Use `Sofia, Bulgaria` as Address.
5. Use `Service` as Type.
6. Verify creation.
7. Update the same Partner.
8. Re-open/re-query the Partners area and verify the update was persisted.

## Architecture

The project keeps the useful ideas from the larger reference framework without carrying over unrelated production complexity:

- **Feature files** describe business behavior in Gherkin.
- **Step definitions** orchestrate the scenario and remain thin.
- **Page/Form models** own selectors and UI behavior.
- **Helpers** contain cross-cutting logic such as navigation and unique test-data generation.
- **Fixtures** hold parameterized business test data.
- **Support commands** hold reusable Cypress-level behavior such as authenticated sessions.
- **Environment variables** hold credentials; secrets are never committed.
- **GitHub Actions** demonstrates CI readiness.

This structure is intentionally smaller than the source framework: SMTP/IMAP, FTP reporting, feature flags, payment helpers, analytics, cloud execution and application-specific utilities were excluded because they do not support this assignment.

## Prerequisites

- Node.js 22 LTS
- npm

## Install

```bash
npm install
```

Commit the generated `package-lock.json` after the first successful install. Reviewers can then use `npm ci` for deterministic installation.

## Credentials

Copy:

```text
cypress.env.example.json -> cypress.env.json
```

and provide the supplied test credentials locally. `cypress.env.json` is ignored by Git.

Alternatively use environment variables:

```text
CYPRESS_TEST_EMAIL=...
CYPRESS_TEST_PASSWORD=...
```

## Run

All scripts explicitly run **Google Chrome** - never Cypress's Electron fallback. Chrome is representative of a real, widely-used browser, and headless Chrome is the mode CI/CD uses.

OPEN - interactive Cypress app, headed Chrome. For local development, inspecting the command log, and debugging selectors/network requests:

```bash
npm run cy:open
```

HEADED - `cypress run` to completion, with the real Chrome window visible. Useful for reproducing a headless failure locally:

```bash
npm run cy:headed
```

HEADLESS - normal automated run, no browser UI. The canonical automated mode (`npm test` is an equivalent alias):

```bash
npm run cy:headless
```

Partner feature only, headless Chrome - suitable for CI/CD as-is:

```bash
npm run test:partners
```

Gherkin lint:

```bash
npm run gherkin:lint
```

CI/CD should use a headless Chrome script (`npm run cy:headless` or the Partner-specific `npm run test:partners`); Chrome must be available on the CI runner. No headed/open mode should ever be required by CI. (The GitHub Actions workflow itself is unchanged in this pass; environment selection can be layered on later with `--env targetEnv=...`.)

## Reporting

`npm run cy:headless`, `npm test`, and `npm run test:partners` generate a Mochawesome HTML report at `cypress/reports/mochawesome/report.html` after the run finishes. Each of these commands deletes the previous report output before running, so the report never accumulates across runs - the latest run always fully replaces the last one.

`npm run cy:open` and `npm run cy:headed` do **not** generate a report; they keep Cypress's normal interactive/console output.

The report is generated whether the run passes or fails, and never changes Cypress's own outcome - a failing run still exits non-zero.

Screenshots (both Cypress's own retry/failure captures and a per-Scenario evidence screenshot showing the Command Log alongside the app) save inside the report tree at `cypress/reports/mochawesome/assets/`, so `report.html` can reference them by a portable relative path - no machine-specific paths, no separate encoding step. Video (`cypress/videos/`) is unchanged and continues to be produced independently of the report.

CI (`.github/workflows/e2e.yml`) uploads the Mochawesome report (including its screenshot assets) and video as a single `cypress-artifacts` build artifact after every run (pass or fail), with a 7-day retention period.

## Environments

`baseUrl` is resolved from `targetEnv` in `cypress.config.js`. **DEV is the default when `targetEnv` is omitted** - a deliberate safety choice, so forgetting the flag never redirects the suite toward STG/PROD.

Environment selection and execution mode are independent and compose freely - append `-- --env targetEnv=...` to any script:

```bash
npm run test:partners                          # DEV + Chrome + headless (default)
npm run test:partners -- --env targetEnv=dev    # same, explicit
npm run cy:open -- --env targetEnv=dev
npm run cy:headed -- --env targetEnv=dev
npm run cy:headless -- --env targetEnv=dev
```

`stg` and `prod` exist in the environment map as future-ready entries, but their real URLs weren't provided with this assignment, so no `baseUrl` is configured for them yet. Selecting either (`--env targetEnv=stg` / `--env targetEnv=prod`) fails immediately with a clear "not configured" error, and any unrecognized `targetEnv` value fails immediately with a clear "unknown environment" error - neither case silently falls back to DEV, regardless of execution mode.

Credentials remain managed separately (see Credentials above) and are never part of the environment URL map.

## Important before the first real run

The Page/Form models contain intentionally explicit placeholder `data-testid` selectors. Inspect the real DOM and replace them with the application's actual stable selectors. Prefer `data-testid` / `data-cy` attributes where available. Do not hide selector uncertainty behind long chains of brittle CSS selectors. `PartnersPage.addButton`/`searchInput` still carry this caveat.

Also inspect the real save/update network behavior. If a stable Partner API request is available, add `cy.intercept()` aliases around create/update and assert successful responses in addition to the user-visible persisted state.

The Partner logo upload (`PartnerForm.fields.logo`) needed a one-time DOM confirmation like every other selector: the widget has no `<input type="file">` anywhere in its DOM (it opens the native picker via JS without attaching one), so `ElementModel.uploadFile()` uses Cypress's `selectFile(path, { action: "drag-drop" })` against the visible upload control instead of targeting a file input.

## Test-data strategy

Business defaults live in `cypress/fixtures/partners/partner-data.json`. Binary test assets (e.g. the Partner logo used for the upload step) live under `cypress/fixtures/files/<entity>/`, keeping JSON test data separate from binary fixtures while both stay under the standard `fixturesFolder`. The fixture references the asset by a project-root-relative path (`"cypress/fixtures/files/partners/logo.png"`) rather than the path being hardcoded inside a Form/Page model — `PartnerForm` just uploads whatever path it's given, so swapping the test asset is a one-line fixture edit, not a code change. This scales directly to future entities: `cypress/fixtures/<entity>/<entity>-data.json` plus `cypress/fixtures/files/<entity>/` per entity.

Runtime-unique names are generated by `testDataHelper.js`, preventing collisions with existing Partners and parallel/repeated runs.

The Address is populated as required by the assignment but is not asserted because the assignment explicitly says it does not need validation.

## Reliability choices

- No arbitrary `cy.wait()` calls; field-selection helpers (`antdSelectHelper.js`) rely on Cypress's built-in retry-ability (`.should()`) instead of fixed delays.
- Cypress retry-ability is used through assertions.
- Selectors are centralized in models.
- Test isolation remains enabled.
- Login is reusable through `cy.session()`.
- Run-mode retry is limited to one retry; retries are not used to mask deterministic failures.
- Screenshots and video are enabled for debugging failed CI runs.

## Assumptions

- The supplied account has permission to create and update Partners.
- A created Partner can be located by its unique generated name.
- The application provides a stable way to return to the Partners list after saving.
- The exact required Partner fields and DOM selectors must be confirmed against the live application before final submission.

## What I would extend with more time

- Add API-assisted cleanup of created test entities if the application exposes a suitable endpoint.
- Add explicit create/update request assertions with `cy.intercept()`.
- Add negative validation coverage separately from the critical E2E lifecycle.
- Add accessibility checks if required by product quality goals.
- Add richer reporting only if the team needs it; avoid adding reporting infrastructure without a real consumer.
- Run smoke tests on pull requests and a broader suite on a scheduled/nightly pipeline as the suite grows.

## Design principle

The goal is not to reproduce a large enterprise framework for one workflow. The goal is to show a structure that is easy to understand today and can grow by adding feature files, step-definition domains, page/form models, fixtures and helpers without rewriting the foundation.
=======
# AppStreams
