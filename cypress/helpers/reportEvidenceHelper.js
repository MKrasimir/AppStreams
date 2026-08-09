import addContext from "mochawesome/addContext";

// The exact Mocha Test object for the Scenario currently running, captured directly
// from Cypress's own native test:before:run event - NOT relied upon via `this` inside
// a cy.then() callback. Evidence is captured from a Cucumber `After` hook (see
// reporting.hooks.js), which runs Before/Steps/After all inside cucumber-preprocessor's
// own internal function calls within ONE Mocha it() per Scenario; nothing guarantees
// Cypress's `this`-rebinding for `.then()` correctly threads through that call stack,
// and there is no way to prove it does without live instrumentation. test:before:run
// fires once per Scenario (cucumber-preprocessor maps each Scenario to exactly one
// Mocha it()), with the real Test object handed to us directly - eliminating the
// binding question entirely, per Cypress's own supported mechanism for this exact
// "get the current test from an arbitrary point in the run" need.
let currentTest = null;

Cypress.on("test:before:run", (_attributes, test) => {
  currentTest = test;
});

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
// this extra screenshot or touch the Mochawesome context API.
//
// Feature/Scenario identity is read from Cypress.spec/Cypress.currentTest at runtime -
// never hardcoded - so this works unchanged for any future feature file or Scenario.
//
// Called once, from the global After hook (reporting.hooks.js), so it naturally covers
// both a passing Scenario's final business state and a failing Scenario's failure state
// with the same mechanism, without duplicating capture logic per outcome.
export function captureScenarioEvidence() {
  if (!Cypress.env("reportEvidence") || Cypress.currentTest.state === "pending") {
    return;
  }

  const featureSlug = toFileSafeSlug(Cypress.spec.name.replace(/\.[^.]+$/, ""));
  const scenarioSlug = toFileSafeSlug(Cypress.currentTest.title);
  const fileName = `${featureSlug}__${scenarioSlug}__${timestamp()}`;
  const outcome = Cypress.currentTest.state === "failed" ? "failed" : "passed";
  const testForContext = currentTest;

  // capture: "runner" includes the Command Log/Scenario result alongside the AUT -
  // requires the wrapper's --runner-ui flag (scripts/run-headless-with-report.js) so
  // the runner is actually rendered during `cypress run`; without it there is nothing
  // for "runner" capture to include. Scoped to this one call, not a global default, so
  // Cypress's own screenshotOnRunFailure capture mode is untouched.
  cy.screenshot(fileName, { capture: "runner" });

  // Embedded as a base64 data URI (not a relative file path) so the report stays
  // fully self-contained/portable - matches marge's own --inline flag, which already
  // embeds the report's CSS/JS the same way.
  cy.then(() => {
    cy.task("encodeScreenshotAsBase64", `${fileName}.png`).then((dataUri) => {
      if (dataUri && testForContext) {
        addContext(
          { test: testForContext },
          { title: `Scenario evidence (${outcome})`, value: dataUri }
        );
      }
    });
  });
}
