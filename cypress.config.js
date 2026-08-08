import { defineConfig } from "cypress";
import createBundler from "@bahmutov/cypress-esbuild-preprocessor";
import { addCucumberPreprocessorPlugin } from "@badeball/cypress-cucumber-preprocessor";
import { createEsbuildPlugin } from "@badeball/cypress-cucumber-preprocessor/esbuild";

export default defineConfig({
  e2e: {
    baseUrl: "https://dev.admin.avtoikonom.com",
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

      return config;
    },
  },

  screenshotOnRunFailure: true,
  video: true,
  defaultCommandTimeout: 10000,
  requestTimeout: 10000,
  responseTimeout: 20000,
});