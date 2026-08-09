import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

// Everything Mochawesome produces - including screenshots, since screenshotsFolder
// (cypress.config.js) points inside this same tree - lives under one directory, so
// wiping it before each run is enough to guarantee "old report/evidence gone, new one
// generated" without separate per-artifact-type bookkeeping. Built with
// path.posix.join (always forward slashes) because the glob matching used by
// mochawesome-merge treats backslash as an escape character, not a path separator -
// a Windows path.join() result silently matches nothing.
const reportDir = path.posix.join("cypress", "reports", "mochawesome");
const jsonDir = path.posix.join(reportDir, "json");
const mergedJsonPath = path.posix.join(reportDir, "report.json");

// Written by cypress/helpers/reportEvidenceHelper.js's captureScenarioEvidence() (one
// JSON line per scenario attempt), read once here and patched into the raw per-spec JSON
// files before they're merged - see patchEvidenceIntoRawJson() below.
const sidecarPath = path.posix.join(reportDir, "evidence.jsonl");

rmSync(reportDir, { recursive: true, force: true });
mkdirSync(jsonDir, { recursive: true });

// Normalizes a Mochawesome raw-JSON spec path (OS-native separators - e.g.
// "cypress\\e2e\\features\\partners\\partner-lifecycle.feature" on Windows) to the same
// forward-slash form Cypress.spec.relative uses browser-side (see
// reportEvidenceHelper.js), so the two can be compared as equal keys.
function normalizeSpecPath(specPath) {
  return (specPath ?? "").replace(/\\/g, "/");
}

// Recursively collects every test object nested under a Mochawesome raw-JSON `result`
// (or `suite`) node: its own `tests[]`, plus every nested `suites[].tests[]`, at any
// depth. Mochawesome's schema allows arbitrarily deep suite nesting, so this walks
// generically rather than assuming a fixed depth.
function collectTests(node, out = []) {
  if (Array.isArray(node.tests)) {
    out.push(...node.tests);
  }
  if (Array.isArray(node.suites)) {
    for (const suite of node.suites) {
      collectTests(suite, out);
    }
  }
  return out;
}

// Reads the evidence.jsonl sidecar (one JSON record per captureScenarioEvidence() call)
// and patches the matching test's `context` field, in place, into each raw per-spec JSON
// file mochawesome already wrote under jsonDir - BEFORE mochawesome-merge combines them,
// so context survives the merge/HTML-generation steps unchanged (those commands are not
// modified at all).
//
// Never fatal: a reporting-evidence mismatch (malformed line, unmatched record) must
// never fail an otherwise-valid E2E run, but it also must never disappear silently - every
// case is reported via console.log/warn, matched counts included.
function patchEvidenceIntoRawJson(jsonDirectory, jsonFileNames, sidecarFilePath) {
  if (!existsSync(sidecarFilePath)) {
    // reportEvidence was off, or nothing captured any evidence this run - nothing to
    // patch; every test's `context` stays `null`, same as Mochawesome's own default.
    return;
  }

  // Build the lookup as `${normalizedSpec}::${fullTitle}` -> latest context. Iterating
  // the file top-to-bottom and calling `.set()` per line is naturally "last write wins":
  // with retries.runMode: 1 (cypress.config.js), the afterEach in cypress/support/e2e.js
  // reruns around EACH retry attempt, appending one sidecar line per attempt for the same
  // scenario. Only the FINAL attempt's outcome/screenshot should end up in the report,
  // matching what Mochawesome's own raw JSON test entry already represents.
  const evidenceByKey = new Map();
  const sidecarLines = readFileSync(sidecarFilePath, "utf8").split("\n");
  for (const line of sidecarLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const record = JSON.parse(trimmed);
      const key = `${normalizeSpecPath(record.spec)}::${record.fullTitle}`;
      evidenceByKey.set(key, record.context);
    } catch {
      console.warn(
        `[report-evidence] Skipping malformed evidence line: ${trimmed.slice(0, 120)}`
      );
    }
  }

  const matchedKeys = new Set();

  for (const jsonFileName of jsonFileNames) {
    const filePath = path.join(jsonDirectory, jsonFileName);
    const report = JSON.parse(readFileSync(filePath, "utf8"));
    let patchedAny = false;

    for (const result of report.results ?? []) {
      const specKey = normalizeSpecPath(result.file || result.fullFile);
      for (const test of collectTests(result)) {
        const key = `${specKey}::${test.fullTitle}`;
        const context = evidenceByKey.get(key);
        if (context) {
          // Mochawesome's own reporter always JSON-stringifies test.context before
          // writing raw JSON (node_modules/mochawesome/src/utils.js) - marge's schema
          // requires a string (node_modules/mochawesome-report-generator/bin/types.js),
          // and its HTML template JSON.parses it back out for rendering. A raw object
          // fails marge's validation, so match that convention exactly here.
          test.context = JSON.stringify(context, null, 2);
          matchedKeys.add(key);
          patchedAny = true;
        }
      }
    }

    if (patchedAny) {
      writeFileSync(filePath, JSON.stringify(report, null, 2));
    }
  }

  console.log(`Scenario evidence: ${matchedKeys.size}/${evidenceByKey.size} records attached to Mochawesome results.`);

  // Only the safe spec/fullTitle identity is ever logged here - never the context
  // value/screenshot path - for every sidecar record no raw JSON test ended up matching.
  for (const key of evidenceByKey.keys()) {
    if (!matchedKeys.has(key)) {
      const [spec, fullTitle] = key.split("::");
      console.warn(
        `[report-evidence] No matching Mochawesome test found for "${spec}" :: "${fullTitle}" - evidence not attached.`
      );
    }
  }
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
  // Must run BEFORE mochawesome-merge: it patches `context` directly into the raw
  // per-spec files mochawesome-merge is about to combine, so the merge/marge commands
  // below stay completely unchanged and still "just work" on whatever's in jsonDir.
  patchEvidenceIntoRawJson(jsonDir, jsonFiles, sidecarPath);

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
