import { After } from "@badeball/cypress-cucumber-preprocessor";
import { captureScenarioEvidence } from "../../helpers/reportEvidenceHelper.js";

// Global, feature-agnostic - matches every Scenario in every feature file (picked up
// via the cypress-cucumber-preprocessor stepDefinitions glob), so adding a new
// feature/spec file needs zero additional reporting code.
After(() => {
  captureScenarioEvidence();
});
