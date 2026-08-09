import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
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

      // Browser-side test code has no filesystem access, so embedding a screenshot
      // into the Mochawesome report (for portability - see reportEvidenceHelper.js)
      // requires a Node-side task to read and base64-encode the file. Returns null
      // rather than throwing if the file isn't there, so a report-evidence problem
      // never fails the actual business test.
      on("task", {
        encodeScreenshotAsBase64(fileName) {
          const filePath = path.join(config.screenshotsFolder, fileName);
          if (!existsSync(filePath)) {
            return null;
          }
          return `data:image/png;base64,${readFileSync(filePath).toString("base64")}`;
        },
      });

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

  screenshotOnRunFailure: true,
  video: true,
  defaultCommandTimeout: 10000,
  requestTimeout: 10000,
  responseTimeout: 20000,
});