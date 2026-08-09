# AppStreams QA Automation Assignment

A Cypress + Cucumber/Gherkin E2E automation solution for the Partner lifecycle assignment: create a Partner, verify it was created, update it, and verify the change persisted - built and documented as a small production-style automation project rather than a single automated test.

## Covered business scenarios

**Create a Service Partner**
1. Log in to the administration platform.
2. Navigate to the Partners section.
3. Open the Partner creation form and populate all required fields (Address `Sofia, Bulgaria`, Type `Service`, plus name/services/plan/phone/contact person/description/logo).
4. Submit the form.
5. Verify the Partner was created: the row appears in the Partners list with the persisted data, and the create `POST` request is asserted to have succeeded with the submitted name/phone.

**Update a Service Partner**
1. Create a fresh Partner (its own instance, independent of any other scenario).
2. Open that Partner for editing and change its name and phone.
3. Submit the form.
4. Verify the changes persisted: the row's name/phone are asserted to differ from the pre-update values and match the new ones, and the update `PUT` request is asserted to have succeeded with the submitted data.

Both scenarios live in `cypress/e2e/features/partners/partner-lifecycle.feature`. No other business scenarios are automated in this project.

## Technology stack

- **Cypress** (15.x) - browser automation and assertions.
- **`@badeball/cypress-cucumber-preprocessor`** - Gherkin feature files as the test entry point.
- **`@bahmutov/cypress-esbuild-preprocessor`** + **esbuild** - bundling for the Cucumber preprocessor.
- **`gherkin-lint`** - lints `.feature` files.
- **Mochawesome** + **`mochawesome-merge`** + **`mochawesome-report-generator`** + **`cypress-multi-reporters`** - the HTML reporting pipeline.
- **GitHub Actions** - CI.

## Architecture

```
cypress/e2e/features/            Gherkin - business-readable scenarios
cypress/e2e/step_definitions/    Gherkin -> orchestration (thin generic steps + a small domain registry)
cypress/models/pages/            page-level behavior (navigation, network intercepts, persisted-state assertions)
cypress/models/forms/            reusable form behavior (fill/update/submit)
cypress/support/                 global commands (cy.login()) and test lifecycle (afterEach evidence capture)
cypress/helpers/                 reusable technical helpers (test data, navigation, widget interactions)
cypress/fixtures/                business test data + binary test assets
scripts/                         headless execution + reporting orchestration (what CI actually calls)
```

This separation keeps business intent (the `.feature` files) independent of UI mechanics (Page/Form models) and technical plumbing (helpers/scripts), which is what lets the suite grow - new fields, a second Scenario, a second entity - without the earlier layers changing shape.

**Reusable form-submit steps.** The Create and Update scenarios both use the same generic Cucumber steps, parameterized by entity name:

```gherkin
When I fill the "Partner" form with valid required data
And I submit the "Partner" form
Then the "Partner" should be created successfully
```

`partner.steps.js` resolves `"Partner"` through a small local registry (`{ fillValid, update, submit, verifyCreated, verifyPersisted }`) rather than a hardcoded `if/else` chain. This is a deliberate extension point, not a claim that the project already automates multiple entities - today the registry has exactly one entry. Adding a second entity later means adding one more entry with the same shape; the five generic step definitions don't change. Form submission itself (`BaseForm.submit()`) is a single generic Save-button click that `PartnerForm` inherits unchanged - Create and Update both submit through the exact same implementation and only differ in what they fill/update beforehand and which network request they wait on afterward. Filling/selecting Ant Design dropdown fields (Type, Services, Subscription plan) goes through one shared, generic `antdSelectHelper.js`, not per-field logic; the Address field's Google Places Autocomplete is handled separately since it's a different third-party widget. The Partner logo upload has no real `<input type="file">` in the DOM, so `ElementModel.uploadFile()` simulates a drag-and-drop file selection instead.

## Prerequisites

- Node.js 22 LTS
- npm
- Google Chrome installed locally (every script runs Chrome explicitly, never Cypress's bundled Electron browser)

## Installation

```bash
git clone <repository-url>
cd <repository-directory>
npm ci
```

`package-lock.json` is already committed, so a clean clone can go straight to `npm ci` for a deterministic install - the same command CI uses.

## Credentials / configuration

Tests read credentials from `Cypress.env("TEST_EMAIL")` / `Cypress.env("TEST_PASSWORD")` (see `cypress/support/commands.js`). Two ways to provide them locally, either is enough:

**Option 1 - `cypress.env.json` (recommended for local dev):**

```bash
cp cypress.env.example.json cypress.env.json
```

then edit `cypress.env.json` with the real values. It's git-ignored and never committed.

**Option 2 - environment variables** (what CI uses, via GitHub Secrets - Cypress automatically maps a `CYPRESS_`-prefixed process env var to the same `Cypress.env()` key):

PowerShell:
```powershell
$env:CYPRESS_TEST_EMAIL = "..."
$env:CYPRESS_TEST_PASSWORD = "..."
npm test
```

bash:
```bash
CYPRESS_TEST_EMAIL=... CYPRESS_TEST_PASSWORD=... npm test
```

No credential values are hardcoded anywhere in the repository or in CI configuration. Target-environment selection (DEV/STG/PROD) is a separate, non-secret concern - see Environment management below.

## Running the suite

| Command | What it does | Generates Mochawesome report? |
|---|---|---|
| `npm run cy:open` | Interactive Cypress app, headed Chrome | No |
| `npm run cy:headed` | `cypress run` to completion, visible Chrome window | No |
| `npm run cy:headless` / `npm test` | Full suite, headless Chrome, via the reporting wrapper | **Yes** |
| `npm run test:partners` | Partner feature only, headless Chrome, via the reporting wrapper | **Yes** |
| `npm run gherkin:lint` | Lints all `.feature` files | N/A |

`npm test` and `npm run cy:headless` run the identical script (`node scripts/run-headless-with-report.js --browser chrome`) - `npm test` is the canonical name and the one CI invokes. `cy:open`/`cy:headed` never set the reporting-evidence flag, so they intentionally keep Cypress's normal interactive/console output instead of writing a report.

## Reporting and debugging

`npm test`, `npm run cy:headless`, and `npm run test:partners` all produce one combined Mochawesome HTML report at:

```
cypress/reports/mochawesome/report.html
```

Each of these commands deletes the previous report output before running, so the report never accumulates - the latest run fully replaces the last one. The report is generated whether the run passes or fails, and never changes Cypress's own exit code.

Every Scenario (pass or fail) gets an evidence screenshot showing the Command Log/runner UI alongside the application, plus Cypress's own retry/failure screenshots - all saved inside the report tree at `cypress/reports/mochawesome/assets/`, so `report.html` can reference them by a portable relative path. Because Cypress's headless run and the report-generation step are separate process boundaries, this evidence is associated with the right Scenario through project-owned orchestration (`scripts/run-headless-with-report.js`) before the final HTML is built - a deliberate architectural note, not something that needs deeper explanation here. Video (`cypress/videos/`) is produced independently and unaffected by reporting.

## Test-data strategy

Business defaults live in `cypress/fixtures/partners/partner-data.json`. Binary test assets (the Partner logo used for the upload step) live under `cypress/fixtures/files/<entity>/`, kept separate from JSON data while both stay under the standard `fixturesFolder`. The fixture references the asset by path rather than the path being hardcoded in a Form/Page model, so swapping the test asset is a one-line fixture edit. This scales directly to future entities: `cypress/fixtures/<entity>/<entity>-data.json` plus `cypress/fixtures/files/<entity>/` per entity.

Runtime-unique names/phone numbers are generated by `testDataHelper.js` for every Create, preventing collisions with existing Partners and with prior/parallel runs; `buildPartnerData()` also fails fast with a clear error if a required fixture field is missing, rather than surfacing an opaque UI error later. The Update scenario doesn't create a second Partner - it updates the one just created in the same Scenario, so each scenario is self-contained and doesn't depend on data left behind by another. Address (`Sofia, Bulgaria`) and Type (`Service`) are the fixed values specified by the assignment.

## Reliability & synchronization

- Persistence is verified against the real network response, not just the UI: `cy.intercept()` registers the Partner `POST`/`PUT` request before the Save click fires, and the suite waits on that specific request and asserts a successful status code plus the submitted name/phone in the request body, in addition to asserting the persisted row in the UI.
- No arbitrary `cy.wait(ms)` calls anywhere; dropdown/select interactions (`antdSelectHelper.js`) rely on Cypress's built-in retry-ability (`.should()`) instead of fixed delays, including a defensive check against Ant Design's virtualization occasionally rendering a matching option that isn't actually clickable yet.
- Selectors are centralized in Page/Form models, not scattered through step definitions.
- Test isolation stays enabled; login is cached and reused through `cy.session()`.
- Run-mode retry is limited to one retry, and is not used to mask deterministic failures.
- Screenshots and video are enabled for every headless run to make CI failures debuggable without local reproduction.

## Environment management

`baseUrl` is resolved from `targetEnv` in `cypress.config.js`. **DEV is the default when `targetEnv` is omitted** - a deliberate safety choice, so forgetting the flag never redirects the suite toward STG/PROD.

Environment selection and execution mode are independent and compose freely - append `-- --env targetEnv=...` to any script:

```bash
npm run test:partners                          # DEV + Chrome + headless (default)
npm run test:partners -- --env targetEnv=dev    # same, explicit
npm run cy:open -- --env targetEnv=dev
```

`stg` and `prod` exist in the environment map as future-ready entries, but their real URLs weren't provided with this assignment, so no `baseUrl` is configured for them yet. Selecting either fails immediately with a clear "not configured" error, and any unrecognized `targetEnv` value fails immediately with a clear "unknown environment" error - neither case silently falls back to DEV. Credentials remain managed separately (see Credentials above) and are never part of the environment URL map.

## CI/CD

`.github/workflows/e2e.yml` runs on `pull_request`, `push` to `main`, and manual `workflow_dispatch`, on a GitHub-hosted `ubuntu-latest` runner with Node 22 (via `actions/setup-node`, with npm dependency caching). It installs with `npm ci` and then runs **`npm test`** - the exact same command used locally - with credentials supplied through `CYPRESS_TEST_EMAIL`/`CYPRESS_TEST_PASSWORD` GitHub Secrets, never hardcoded. The job declares only `permissions: contents: read`, since checking out code, installing dependencies, running tests, and uploading artifacts need no write access.

The Mochawesome report (`cypress/reports/mochawesome/`, including its screenshot assets) and `cypress/videos/` are uploaded as a single `cypress-artifacts` build artifact with `if: always()`, so both passing and failing runs leave debuggable evidence, with a 7-day retention period. A failing suite still fails the workflow - report generation runs unconditionally after Cypress, but nothing ever overwrites Cypress's own pass/fail exit code, and no step swallows a failure to force a green run.

The workflow itself contains no Cypress-specific orchestration - no reporter flags, merge commands, or screenshot logic in the YAML - it only calls the project's own `npm test`. That keeps the test framework portable: the same `npm ci && npm test` contract would work unchanged under Jenkins, GitLab CI, or inside a Docker image later, without touching the workflow's underlying logic.

**Why GitHub Actions:** the project is hosted and submitted through GitHub, so it's the CI system a reviewer can inspect or re-run with zero extra account or infrastructure setup - not a claim that it's inherently better than Jenkins, GitLab CI, or another provider, just the lowest-friction fit for this assignment's scope and delivery channel.

## Scalability, and why Docker isn't introduced yet

The suite currently automates one entity (Partner) and runs comfortably within a single job on a shared GitHub-hosted runner - introducing Docker now would add image-build and maintenance overhead without solving a problem the project actually has today. Because CI's only real contract is `npm ci` + `npm test` (see CI/CD above), that decision is also easy to revisit later without a framework rewrite: the same command can run inside a Docker image, under a different CI provider, or both.

Docker (or self-hosted/dedicated runners) would become worth the added complexity once the suite is large or slow enough to need parallel workers, once browser/OS version reproducibility needs to be pinned exactly rather than relying on the runner image's defaults, or once local and CI runtimes need to be guaranteed identical. Other scale-out options - splitting/sharding the suite, parallel execution, multi-browser coverage where business risk justifies it, and a dashboard-based reporting service once there's real multi-run history to analyze - are noted here as future options, not implemented features.

## Assumptions

- DEV (`https://dev.admin.avtoikonom.com`) is the intended target environment for this assignment; STG/PROD are mapped but intentionally left unconfigured since real URLs weren't provided.
- The supplied test account has permission to create and update Partners.
- A created Partner can be located afterward by its unique generated name.
- The application provides a stable way to return to the Partners list after saving.
- The assignment states Address validation isn't required, but the persisted-row check asserts every column uniformly (including Address) rather than special-casing one field out - simpler and more consistent than a partial check.
- Created Partner records persist in the target environment; no cleanup/delete workflow or API was part of the assignment or discovered in the application, so repeated runs rely on unique generated names rather than teardown.

## What I would extend with more time

- Add API-assisted cleanup of created test entities if the application exposes a suitable endpoint.
- Extend network-request assertions to failure/error-response scenarios - only the success path is currently asserted.
- Add negative/validation coverage separately from the critical happy-path lifecycle.
- Add accessibility checks if required by product quality goals.
- Run a fast smoke subset on every pull request and a broader/nightly suite on a schedule, once there's enough coverage for that split to matter.
- Introduce Docker, sharding, or parallel execution once suite size or environment-reproducibility needs actually justify it (see Scalability above).

The goal throughout was not to reproduce a large enterprise framework for one workflow, but a structure that's easy to understand today and can grow - more feature files, more step-definition domains, more Page/Form models, fixtures and helpers - without rewriting the foundation.
