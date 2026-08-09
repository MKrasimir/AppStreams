import { defineConfig } from "cypress";
import createBundler from "@bahmutov/cypress-esbuild-preprocessor";
import { addCucumberPreprocessorPlugin } from "@badeball/cypress-cucumber-preprocessor";
import { createEsbuildPlugin } from "@badeball/cypress-cucumber-preprocessor/esbuild";

// Public, non-secret config only - credentials stay in cypress.env.json /
// CYPRESS_* env vars (see support/commands.js), never here. STG/PROD are listed
// as future-ready entries; their real URLs weren't provided with the assignment,
// so baseUrl is explicitly `null` rather than a fake/placeholder URL.
const environments = {
  dev: { baseUrl: "https://dev.admin.avtoikonom.com" },
  stg: { baseUrl: null },
  prod: { baseUrl: null },
};

export default defineConfig({
  e2e: {
    specPattern: "cypress/e2e/features/**/*.feature",
    supportFile: "cypress/support/e2e.js",
    fixturesFolder: "cypress/fixtures",

    viewportWidth: 1600,
    viewportHeight: 900,

    testIsolation: true,
    retries: {
      runMode: 1,
      openMode: 0,
    },

    async setupNodeEvents(on, config) {
      await addCucumberPreprocessorPlugin(on, config);

      on(
        "file:preprocessor",
        createBundler({
          plugins: [createEsbuildPlugin(config)],
        })
      );

      // DEV is the deliberate default when targetEnv is omitted - forgetting the
      // flag must never redirect the suite toward STG/PROD.
      const targetEnv = config.env.targetEnv || "dev";
      const selectedEnvironment = environments[targetEnv];

      if (!selectedEnvironment) {
        throw new Error(
          `Unknown targetEnv "${targetEnv}". Valid environments: ${Object.keys(environments).join(", ")}.`
        );
      }

      if (!selectedEnvironment.baseUrl) {
        throw new Error(`Environment "${targetEnv}" is defined but no baseUrl has been configured yet.`);
      }

      config.baseUrl = selectedEnvironment.baseUrl;

      return config;
    },
  },

  // Screenshots (both Cypress's own retry/failure captures and the custom Scenario
  // evidence ones - see reportEvidenceHelper.js) save directly inside the report tree,
  // so report.html can reference them by a portable relative path (no base64/task
  // needed) and the wrapper's single report-directory cleanup covers them too.
  screenshotsFolder: "cypress/reports/mochawesome/assets",
  screenshotOnRunFailure: true,
  video: true,
  defaultCommandTimeout: 10000,
  requestTimeout: 10000,
  responseTimeout: 20000,
});