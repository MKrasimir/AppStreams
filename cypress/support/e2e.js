import "./commands.js";
import { captureScenarioEvidence } from "../helpers/reportEvidenceHelper.js";

// A real Mocha afterEach always runs after every Scenario, pass or fail - registered
// once here (not per-feature) so it needs no extra wiring for any future feature file.
//
// Must be a real `function`, not an arrow, so `this.currentTest` resolves to the live
// Mocha Test object that captureScenarioEvidence needs.
afterEach(function () {
  captureScenarioEvidence(this.currentTest);
});
