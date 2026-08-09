import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, unlinkSync } from "node:fs";
import path from "node:path";

// Everything Mochawesome produces lives under one directory, so wiping it before
// each run is enough to guarantee "old report gone, new report generated" without
// per-file bookkeeping - including the raw per-spec JSON that mochawesome-merge
// consumes below. Built with path.posix.join (always forward slashes) because the
// glob matching used by mochawesome-merge treats backslash as an escape character,
// not a path separator - a Windows path.join() result silently matches nothing.
const reportDir = path.posix.join("cypress", "reports", "mochawesome");
const jsonDir = path.posix.join(reportDir, "json");
const mergedJsonPath = path.posix.join(reportDir, "report.json");

rmSync(reportDir, { recursive: true, force: true });
mkdirSync(jsonDir, { recursive: true });

// Per-Scenario evidence screenshots (see reportEvidenceHelper.js) land directly in
// Cypress's own screenshots folder, named `<feature>__<scenario>__<timestamp>.png`.
// Remove only files matching that exact shape before each run, so evidence never
// accumulates across runs - Cypress's own auto-failure screenshots live in nested
// per-spec subfolders and use a different naming scheme entirely, so a non-recursive
// scan here can never touch them or any other unrelated screenshot.
const screenshotsDir = path.posix.join("cypress", "screenshots");
const evidenceFileNamePattern = /^.+__.+__\d{8}-\d{6}\.png$/;

if (existsSync(screenshotsDir)) {
  readdirSync(screenshotsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && evidenceFileNamePattern.test(entry.name))
    .forEach((entry) => unlinkSync(path.posix.join(screenshotsDir, entry.name)));
}

function run(command, args, envOverrides = {}) {
  return spawnSync(command, args, {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...envOverrides },
  });
}

// Forward every CLI arg this script received (--browser, --spec, --env targetEnv=...)
// straight to Cypress, unmodified, so environment/spec selection keeps composing
// exactly as it did before reporting existed. `configFile` is resolved to an
// absolute path so it doesn't depend on Cypress's internal working directory
// happening to match the project root.
const reporterConfigPath = path.resolve("reporter-config.json");

// CYPRESS_reportEvidence gates cypress/helpers/reportEvidenceHelper.js's capture -
// set only for this spawned process (via env, not a forwarded --env CLI flag, so it
// can never be silently overwritten by a user-forwarded --env targetEnv=... arg).
// cy:open/cy:headed invoke Cypress directly, never through this script, so they never
// set it and never take evidence screenshots.
//
// --runner-ui: `cypress run` does not render the Command Log/Reporter UI by default,
// so a `capture: "runner"` screenshot would have nothing to include without this -
// scoped to this one invocation only (not cy:headed), still fully headless Chrome.
const cypressResult = run(
  "npx",
  [
    "cypress",
    "run",
    ...process.argv.slice(2),
    "--reporter", "cypress-multi-reporters",
    "--reporter-options", `configFile=${reporterConfigPath}`,
    "--runner-ui",
  ],
  { CYPRESS_reportEvidence: "true" }
);

// A run that fails before any spec completes leaves zero JSON files - merging in
// that case would only print a confusing mochawesome-merge stack trace on top of
// the real Cypress failure. Skip report generation cleanly instead of pretending
// a report exists.
const jsonFiles = readdirSync(jsonDir).filter((file) => file.endsWith(".json"));

if (jsonFiles.length === 0) {
  console.log(
    "No Mochawesome result files were generated (Cypress likely failed before completing any spec) - skipping report generation."
  );
} else {
  // Merge/report generation always runs, whether Cypress passed or failed - a failed
  // run is the primary case this report exists to help debug.
  run("npx", ["mochawesome-merge", `${jsonDir}/*.json`, "-o", mergedJsonPath]);
  run("npx", [
    "marge",
    mergedJsonPath,
    "--reportDir", reportDir,
    "--reportFilename", "report",
    "--inline",
    "--charts",
  ]);
}

// A crashed (not just failed) child process can report a raw platform status code
// instead of a normal 0-255 exit code - e.g. Windows reports an illegal-instruction
// crash as the NTSTATUS value 3221225501, not a small number. Passing that straight
// to process.exit() crashes this wrapper too, destroying the failure signal. Any
// non-zero/non-standard status still means "failed" - normalize it to a plain 1.
function safeExitCode(status) {
  if (typeof status === "number" && Number.isInteger(status) && status >= 0 && status <= 255) {
    return status;
  }
  return 1;
}

// Never let report generation mask Cypress's own pass/fail outcome.
process.exit(safeExitCode(cypressResult.status));
