import "./commands.js";
import { captureScenarioEvidence } from "../helpers/reportEvidenceHelper.js";

// Real Mocha afterEach - unlike the Cucumber `After()` hook this project used to rely on,
// which is just the tail segment of the same command chain as a Scenario's own steps (so
// an earlier step failing skips it entirely), an afterEach here always runs after every
// Scenario, pass or fail. Global (registered once, here) rather than per-feature, so it
// needs zero additional wiring for any future feature file - same guarantee Cypress's own
// screenshotOnRunFailure relies on internally.
//
// Must be a real `function`, not an arrow, so `this.currentTest` resolves - the live
// Mocha Test object, with `.state`/`.err` already finalized for this attempt before this
// hook runs. `Cypress.currentTest` cannot be used for outcome: its getter only ever
// returns `{ title, titlePath }`, never `.state`/`.err`.
afterEach(function () {
  captureScenarioEvidence(this.currentTest);
});
