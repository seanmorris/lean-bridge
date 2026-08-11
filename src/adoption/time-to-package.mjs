import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import { canonicalJson } from "../capsule/node.mjs";

const modes = new Set(["cold", "warm"]);
const stageNames = ["analyze", "build", "dry-run", "publish"];
const statuses = new Set(["ok", "blocked", "failed", "skipped"]);

export class TimeToPackageError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "TimeToPackageError";
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details = {}) => {
  throw new TimeToPackageError(code, message, details);
};

const exactKeys = (value, expected, label) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail("invalid-time-budget", `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) fail("invalid-time-budget", `${label} fields must be closed`, { actual, expected: wanted });
};

const positiveInteger = (value, label) => {
  if (!Number.isSafeInteger(value) || value <= 0) fail("invalid-time-budget", `${label} must be a positive integer`);
};

export const validateTimeToPackageBudgets = document => {
  exactKeys(document, ["schemaVersion", "supportedHardware", "modes"], "time-to-package budgets");
  if (document.schemaVersion !== 1) fail("invalid-time-budget", "time-to-package budget version must be 1");
  exactKeys(document.supportedHardware, ["minimumLogicalCpus", "minimumMemoryBytes"], "supported hardware");
  positiveInteger(document.supportedHardware.minimumLogicalCpus, "minimumLogicalCpus");
  positiveInteger(document.supportedHardware.minimumMemoryBytes, "minimumMemoryBytes");
  exactKeys(document.modes, [...modes], "budget modes");
  for (const mode of modes) {
    exactKeys(document.modes[mode], ["maximumEndToEndMs", "stages"], `${mode} budget`);
    positiveInteger(document.modes[mode].maximumEndToEndMs, `${mode} maximumEndToEndMs`);
    exactKeys(document.modes[mode].stages, stageNames, `${mode} stage budgets`);
    for (const stage of stageNames) positiveInteger(document.modes[mode].stages[stage], `${mode} ${stage} budget`);
  }
  return true;
};

export const readTimeToPackageBudgets = async path => {
  let document;
  try {
    document = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    fail("invalid-time-budget-json", `cannot read time-to-package budgets ${path}`, { cause: error.message });
  }
  validateTimeToPackageBudgets(document);
  return document;
};

const sha256 = value => createHash("sha256").update(value).digest("hex");

const nonNegativeInteger = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 0) fail("invalid-benchmark-outcome", `${label} must be a non-negative integer`);
};

const normalizeOutcome = (value, stage) => {
  const expected = [
    "status", "prompts", "hints", "generatedFiles", "manualFiles", "commands",
    "unfamiliarConcepts", "failures", "diagnostics",
  ];
  exactKeys(value, expected, `${stage} outcome`);
  if (!statuses.has(value.status)) fail("invalid-benchmark-outcome", `${stage} returned unsupported status ${value.status}`);
  for (const field of ["prompts", "hints", "generatedFiles", "manualFiles", "commands", "failures"]) {
    nonNegativeInteger(value[field], `${stage} ${field}`);
  }
  for (const field of ["unfamiliarConcepts", "diagnostics"]) {
    if (!Array.isArray(value[field]) || value[field].some(item => typeof item !== "string" || item === "")) {
      fail("invalid-benchmark-outcome", `${stage} ${field} must be a string array`);
    }
  }
  return Object.freeze({
    ...value,
    unfamiliarConcepts: Object.freeze([...new Set(value.unfamiliarConcepts)].sort()),
    diagnostics: Object.freeze([...new Set(value.diagnostics)].sort()),
  });
};

const hardwareCompatibility = (profile, minimum) => Object.freeze({
  passed: profile.logicalCpus >= minimum.minimumLogicalCpus && profile.memoryBytes >= minimum.minimumMemoryBytes,
  minimumLogicalCpus: minimum.minimumLogicalCpus,
  minimumMemoryBytes: minimum.minimumMemoryBytes,
});

export const runTimeToPackageBenchmark = async ({ budgets, hardware, runStage, clock = () => performance.now() }) => {
  validateTimeToPackageBudgets(budgets);
  exactKeys(hardware, ["platform", "architecture", "logicalCpus", "memoryBytes", "cpuModel", "nodeVersion"], "hardware profile");
  positiveInteger(hardware.logicalCpus, "hardware logicalCpus");
  positiveInteger(hardware.memoryBytes, "hardware memoryBytes");
  if (typeof runStage !== "function") fail("invalid-benchmark-runner", "runStage must be a function");
  const records = [];
  for (const mode of modes) {
    for (const stage of stageNames) {
      const started = clock();
      let outcome;
      try {
        outcome = normalizeOutcome(await runStage({ mode, stage }), stage);
      } catch (error) {
        outcome = normalizeOutcome({
          status: "failed",
          prompts: 0,
          hints: 0,
          generatedFiles: 0,
          manualFiles: 0,
          commands: 1,
          unfamiliarConcepts: [],
          failures: 1,
          diagnostics: [error.code ?? error.name ?? "unhandled-error"],
        }, stage);
      }
      const durationMs = Math.max(0, Math.round((clock() - started) * 1000) / 1000);
      const maximumMs = budgets.modes[mode].stages[stage];
      records.push(Object.freeze({
        mode,
        stage,
        durationMs,
        maximumMs,
        withinBudget: outcome.status === "ok" && durationMs <= maximumMs,
        ...outcome,
      }));
    }
  }
  const summaries = [...modes].map(mode => {
    const selected = records.filter(item => item.mode === mode);
    const durationMs = Math.round(selected.reduce((sum, item) => sum + item.durationMs, 0) * 1000) / 1000;
    const maximumMs = budgets.modes[mode].maximumEndToEndMs;
    return Object.freeze({
      mode,
      durationMs,
      maximumMs,
      withinBudget: selected.every(item => item.withinBudget) && durationMs <= maximumMs,
      prompts: selected.reduce((sum, item) => sum + item.prompts, 0),
      hints: selected.reduce((sum, item) => sum + item.hints, 0),
      generatedFiles: selected.reduce((sum, item) => sum + item.generatedFiles, 0),
      manualFiles: selected.reduce((sum, item) => sum + item.manualFiles, 0),
      commands: selected.reduce((sum, item) => sum + item.commands, 0),
      unfamiliarConcepts: Object.freeze([...new Set(selected.flatMap(item => item.unfamiliarConcepts))].sort()),
      failures: selected.reduce((sum, item) => sum + item.failures, 0),
    });
  });
  const compatibility = hardwareCompatibility(hardware, budgets.supportedHardware);
  return Object.freeze({
    schemaVersion: 1,
    passed: compatibility.passed && summaries.every(item => item.withinBudget),
    budgetSha256: sha256(canonicalJson(budgets)),
    hardware: Object.freeze({ ...hardware }),
    hardwareCompatibility: compatibility,
    summaries: Object.freeze(summaries),
    stages: Object.freeze(records),
  });
};

export const timeToPackageStageNames = Object.freeze([...stageNames]);
