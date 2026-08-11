import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  readTimeToPackageBudgets,
  runTimeToPackageBenchmark,
  TimeToPackageError,
  validateTimeToPackageBudgets,
} from "../src/adoption/time-to-package.mjs";

const budgetPath = "acceptance/time-to-package-budgets.v1.json";
const hardware = {
  platform: "linux",
  architecture: "x64",
  logicalCpus: 4,
  memoryBytes: 8 * 1024 * 1024 * 1024,
  cpuModel: "test cpu",
  nodeVersion: "v22.0.0",
};

const successfulOutcome = ({ stage }) => ({
  status: "ok",
  prompts: stage === "analyze" ? 0 : 0,
  hints: 0,
  generatedFiles: stage === "analyze" ? 2 : 1,
  manualFiles: 0,
  commands: 1,
  unfamiliarConcepts: [],
  failures: 0,
  diagnostics: [],
});

test("cold and warm package stages report budgets and developer effort", async () => {
  const budgets = await readTimeToPackageBudgets(budgetPath);
  let time = 0;
  const report = await runTimeToPackageBenchmark({
    budgets,
    hardware,
    runStage: successfulOutcome,
    clock: () => { time += 10; return time; },
  });
  assert.equal(report.passed, true);
  assert.equal(report.stages.length, 8);
  assert.ok(report.stages.every(item => item.durationMs === 10 && item.withinBudget));
  assert.deepEqual(report.summaries.map(item => ({
    mode: item.mode,
    durationMs: item.durationMs,
    commands: item.commands,
    manualFiles: item.manualFiles,
  })), [
    { mode: "cold", durationMs: 40, commands: 4, manualFiles: 0 },
    { mode: "warm", durationMs: 40, commands: 4, manualFiles: 0 },
  ]);
  assert.match(report.budgetSha256, /^[0-9a-f]{64}$/);
});

test("a blocked build fails its stage and the end-to-end budget", async () => {
  const budgets = await readTimeToPackageBudgets(budgetPath);
  let time = 0;
  const report = await runTimeToPackageBenchmark({
    budgets,
    hardware,
    runStage: ({ stage }) => stage === "build" ? {
      ...successfulOutcome({ stage }),
      status: "blocked",
      failures: 1,
      unfamiliarConcepts: ["flake", "builder-image", "flake"],
      diagnostics: ["invalid-builder-manifest"],
    } : successfulOutcome({ stage }),
    clock: () => { time += 1; return time; },
  });
  assert.equal(report.passed, false);
  assert.ok(report.summaries.every(item => !item.withinBudget && item.failures === 1));
  assert.deepEqual(report.summaries[0].unfamiliarConcepts, ["builder-image", "flake"]);
});

test("unsupported hardware and closed budget drift fail explicitly", async () => {
  const budgets = await readTimeToPackageBudgets(budgetPath);
  let time = 0;
  const report = await runTimeToPackageBenchmark({
    budgets,
    hardware: { ...hardware, logicalCpus: 1 },
    runStage: successfulOutcome,
    clock: () => { time += 1; return time; },
  });
  assert.equal(report.hardwareCompatibility.passed, false);
  assert.equal(report.passed, false);

  const invalid = structuredClone(budgets);
  invalid.unreviewed = true;
  assert.throws(
    () => validateTimeToPackageBudgets(invalid),
    error => error instanceof TimeToPackageError && error.code === "invalid-time-budget",
  );
});

test("published time budgets schema stays closed", async () => {
  const schema = JSON.parse(await readFile("schema/time-to-package-budgets.schema.json", "utf8"));
  const reportSchema = JSON.parse(await readFile("schema/time-to-package-report.schema.json", "utf8"));
  const evidence = JSON.parse(await readFile("docs/evidence/time-to-package-20260811.json", "utf8"));
  const planEvidence = JSON.parse(await readFile("docs/evidence/time-to-package-plan-20260811.json", "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.supportedHardware.additionalProperties, false);
  assert.equal(schema.properties.modes.additionalProperties, false);
  assert.equal(schema.$defs.mode.additionalProperties, false);
  assert.equal(reportSchema.additionalProperties, false);
  assert.equal(reportSchema.$defs.summary.additionalProperties, false);
  assert.equal(reportSchema.$defs.stage.additionalProperties, false);
  assert.equal(evidence.schemaVersion, 1);
  assert.equal(evidence.passed, false);
  assert.equal(evidence.hardwareCompatibility.passed, true);
  assert.equal(planEvidence.passed, false);
  assert.deepEqual(
    planEvidence.stages.filter(item => item.stage === "build").map(item => item.diagnostics),
    [["plain-component-compiler-pending"], ["plain-component-compiler-pending"]],
  );
  assert.ok(planEvidence.stages.filter(item => item.stage === "build").every(item => item.unfamiliarConcepts.length === 0));
});
