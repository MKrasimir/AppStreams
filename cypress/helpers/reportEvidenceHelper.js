// Sidecar JSONL (newline-delimited JSON): one evidence record per captureScenarioEvidence()
// call, appended here on the browser side and later read + patched into the raw per-spec
// Mochawesome JSON by scripts/run-headless-with-report.js, BEFORE mochawesome-merge runs.
//
// Why a sidecar instead of mochawesome/addContext + Cypress.on("test:after:run", ...) (the
// old approach): in headless `cypress run`, Cypress's browser-to-Node event bridge for the
// Mocha-reporter forwarding only ever sends a snapshot of the test built from a fixed
// property whitelist that does not include `context`, taken before any test:after:run
// listener even runs. Mutating the live browser-side Test object can therefore never reach
// the Node-side Test object Mochawesome actually serializes from - regardless of which
// event/parameter is used. Lives inside the report tree so the existing report-directory
// wipe in run-headless-with-report.js cleans it up automatically between runs.
const sidecarPath = "cypress/reports/mochawesome/evidence.jsonl";

// Filename-safe, cross-platform, deterministic: strips everything but
// alphanumerics, collapses repeats, trims edges - works for any Feature/Scenario
// title without per-project tuning, and never produces characters invalid on Windows.
function toFileSafeSlug(value) {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Scenario-level timestamp: distinct enough between the scenarios in one run:
// no `:` or other filename-unsafe characters.
function timestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

// Only active for reporting-enabled headless runs - scripts/run-headless-with-report.js
// is the only thing that sets CYPRESS_reportEvidence, so cy:open/cy:headed never take
// this extra screenshot or touch the sidecar file.
//
// Feature/Scenario identity is read from Cypress.spec / the current test at runtime -
// never hardcoded - so this works unchanged for any future feature file or Scenario.
//
// Called from a real Mocha afterEach (cypress/support/e2e.js), which always runs
// regardless of pass/fail - so this naturally covers both a passing Scenario's final
// business state and a failing Scenario's failure state with the same mechanism,
// without duplicating capture logic per outcome.
//
// Takes the real Mocha `currentTest` (afterEach's `this.currentTest`), not
// `Cypress.currentTest`: Cypress's `currentTest` getter only ever projects
// `{ title, titlePath }` onto a fresh object - `.state`/`.err` are never present on it,
// on any test, pass or fail - so outcome must be read off the live Mocha Test object
// instead. Note `currentTest.titlePath` is a method here (`.titlePath()`), unlike the
// pre-computed array Cypress.currentTest.titlePath was - fullTitle() is used instead,
// Mocha's own equivalent, to avoid that mismatch entirely.
export function captureScenarioEvidence(currentTest) {
  if (!Cypress.env("reportEvidence") || currentTest.state === "pending") {
    return;
  }

  const featureSlug = toFileSafeSlug(Cypress.spec.name.replace(/\.[^.]+$/, ""));
  const scenarioSlug = toFileSafeSlug(currentTest.title);
  const fileName = `${featureSlug}__${scenarioSlug}__${timestamp()}`;
  const outcome = currentTest.state === "failed" ? "failed" : "passed";

  let actualScreenshotPath;

  // capture: "runner" includes the Command Log/Scenario result alongside the AUT -
  // requires the wrapper's --runner-ui flag (scripts/run-headless-with-report.js) so
  // the runner is actually rendered during `cypress run`; without it there is nothing
  // for "runner" capture to include. Scoped to this one call, not a global default, so
  // Cypress's own screenshotOnRunFailure capture mode is untouched.
  //
  // onAfterScreenshot's props.path is the REAL, final path Cypress's backend actually
  // wrote the file to - including any " (attempt N)" suffix Cypress silently appends
  // for a retried test's screenshot. `fileName` is only the starting point handed to
  // Cypress; predicting the final saved name ourselves breaks on retry, since Cypress's
  // own suffixing isn't reflected in that prediction.
  cy.screenshot(fileName, {
    capture: "runner",
    onAfterScreenshot: (_$el, props) => {
      actualScreenshotPath = props.path;
    },
  });

  // Queued after cy.screenshot(), so this runs only once the screenshot command - and
  // therefore onAfterScreenshot - has fully completed and actualScreenshotPath is set.
  cy.then(() => {
    // Only the filename can have gained a retry suffix - the spec-name subfolder
    // (screenshotsFolder, cypress.config.js) never changes, so that segment stays the
    // already-proven convention below, unaltered; only the filename segment now comes
    // from the real saved path instead of being predicted.
    const actualFileName = actualScreenshotPath.split(/[\\/]/).pop();
    const relativePath = `assets/${encodeURIComponent(Cypress.spec.name)}/${encodeURIComponent(actualFileName)}`;

    // Shape matches exactly what mochawesome/addContext.js would have set on test.context
    // ({ title, value }) - the raw-JSON patch step in run-headless-with-report.js
    // JSON.stringifies this object onto the matching test, matching mochawesome's own
    // reporter convention.
    const evidenceRecord = {
      spec: Cypress.spec.relative,
      fullTitle: currentTest.fullTitle(),
      context: { title: `Scenario evidence (${outcome})`, value: relativePath },
    };

    // Append, never truncate - each `cypress run` invocation can capture many scenarios.
    // retries.runMode: 1 (cypress.config.js) reruns afterEach around EACH retry attempt,
    // so one scenario may append more than one line here; the Node-side patch step
    // resolves that as "last line for this spec+fullTitle wins", matching the final
    // attempt - the only one Mochawesome's raw JSON represents.
    cy.writeFile(sidecarPath, `${JSON.stringify(evidenceRecord)}\n`, { flag: "a" });
  });
}
