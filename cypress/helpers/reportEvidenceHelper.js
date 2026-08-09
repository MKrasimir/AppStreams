// Sidecar JSONL: one evidence record per captureScenarioEvidence() call, read and patched
// into the raw per-spec Mochawesome JSON by scripts/run-headless-with-report.js before
// mochawesome-merge runs. A sidecar is required because Cypress's browser-to-Node event
// bridge snapshots each test from a fixed property whitelist that excludes `context` -
// mutating the live browser-side Test object can never reach the Node-side object
// Mochawesome serializes from. Lives inside the report tree so the run's report-directory
// wipe cleans it up automatically.
const sidecarPath = "cypress/reports/mochawesome/evidence.jsonl";

// Strips to alphanumerics only - filename-safe on every OS, including Windows.
function toFileSafeSlug(value) {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Filename-safe timestamp (ISO strings contain `:`, which isn't).
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
// Takes the real Mocha `currentTest` (afterEach's `this.currentTest`), not
// `Cypress.currentTest`: the latter's getter only ever projects `{ title, titlePath }`
// onto a fresh object - `.state`/`.err` are never present on it - so outcome must be read
// off the live Mocha Test object instead. `fullTitle()` (Mocha's own method) is used in
// place of the precomputed `titlePath` array Cypress.currentTest would have had.
export function captureScenarioEvidence(currentTest) {
  if (!Cypress.env("reportEvidence") || currentTest.state === "pending") {
    return;
  }

  const featureSlug = toFileSafeSlug(Cypress.spec.name.replace(/\.[^.]+$/, ""));
  const scenarioSlug = toFileSafeSlug(currentTest.title);
  const fileName = `${featureSlug}__${scenarioSlug}__${timestamp()}`;
  const outcome = currentTest.state === "failed" ? "failed" : "passed";

  let actualScreenshotPath;

  // capture: "runner" includes the Command Log alongside the AUT - requires the
  // wrapper's --runner-ui flag, or there's no runner UI rendered to capture.
  //
  // onAfterScreenshot's props.path is the real, final saved path, including any
  // " (attempt N)" suffix Cypress appends for a retried test - `fileName` is only the
  // requested name, so the actual saved name must be read back rather than predicted.
  cy.screenshot(fileName, {
    capture: "runner",
    onAfterScreenshot: (_$el, props) => {
      actualScreenshotPath = props.path;
    },
  });

  // Runs after cy.screenshot() (and its onAfterScreenshot callback) completes, so
  // actualScreenshotPath is already set.
  cy.then(() => {
    const actualFileName = actualScreenshotPath.split(/[\\/]/).pop();
    const relativePath = `assets/${encodeURIComponent(Cypress.spec.name)}/${encodeURIComponent(actualFileName)}`;

    // Shape must match Mochawesome's own test.context convention ({ title, value }) -
    // the raw-JSON patch step downstream stringifies this object directly onto the
    // matching test.
    const evidenceRecord = {
      spec: Cypress.spec.relative,
      fullTitle: currentTest.fullTitle(),
      context: { title: `Scenario evidence (${outcome})`, value: relativePath },
    };

    // Append: retries.runMode: 1 reruns afterEach per retry attempt, so a scenario may
    // write more than one line here - the Node-side patch step takes the last line per
    // spec+fullTitle, matching the final attempt Mochawesome's JSON represents.
    cy.writeFile(sidecarPath, `${JSON.stringify(evidenceRecord)}\n`, { flag: "a" });
  });
}
