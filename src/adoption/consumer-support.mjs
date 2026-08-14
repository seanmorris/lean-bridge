import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const expectedConsumers = Object.freeze([
  "node-javascript",
  "node-typescript",
  "browser-javascript",
  "php-native",
  "php-wasm",
  "dotnet",
  "jvm",
  "ruby",
  "python",
  "rust",
  "c",
  "cpp",
  "wit-wasi",
]);
const states = new Set(["supported", "partial", "blocked"]);
const resultStates = new Set(["passed", "failed"]);

export class ConsumerSupportError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ConsumerSupportError";
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details = {}) => {
  throw new ConsumerSupportError(code, message, details);
};

const exactKeys = (value, keys, label) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("invalid-consumer-support", `${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail("invalid-consumer-support", `${label} fields must be closed`, { actual, expected });
  }
};

export const validateConsumerSupport = document => {
  exactKeys(document, ["schemaVersion", "contractVersion", "verifiedAt", "states", "consumers"], "support contract");
  if (document.schemaVersion !== 1) fail("invalid-consumer-support", "support schema version must be 1");
  if (!/^\d+\.\d+\.\d+$/.test(document.contractVersion)) fail("invalid-consumer-support", "contract version must be semantic");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(document.verifiedAt)) fail("invalid-consumer-support", "verifiedAt must be a date");
  exactKeys(document.states, ["supported", "partial", "blocked"], "state definitions");
  for (const state of states) {
    if (typeof document.states[state] !== "string" || document.states[state] === "") {
      fail("invalid-consumer-support", `${state} needs a definition`);
    }
  }
  if (!Array.isArray(document.consumers)) fail("invalid-consumer-support", "consumers must be an array");
  const ids = [];
  for (const consumer of document.consumers) {
    exactKeys(consumer, [
      "id", "name", "state", "scope", "packageInstallation", "realLeanExecution",
      "testCommand", "blocker", "evidence",
    ], `consumer ${consumer?.id ?? "unknown"}`);
    if (!/^[a-z][a-z0-9-]*$/.test(consumer.id)) fail("invalid-consumer-support", "consumer id is invalid");
    if (typeof consumer.name !== "string" || consumer.name === "") fail("invalid-consumer-support", `${consumer.id} needs a name`);
    if (!states.has(consumer.state)) fail("invalid-consumer-support", `${consumer.id} has an invalid state`);
    if (typeof consumer.scope !== "string" || consumer.scope === "") fail("invalid-consumer-support", `${consumer.id} needs a scope`);
    if (typeof consumer.packageInstallation !== "boolean" || typeof consumer.realLeanExecution !== "boolean") {
      fail("invalid-consumer-support", `${consumer.id} observations must be boolean`);
    }
    if (typeof consumer.testCommand !== "string" || !consumer.testCommand.startsWith("npm run test:consumer:")) {
      fail("invalid-consumer-support", `${consumer.id} needs a consumer test command`);
    }
    if (!Array.isArray(consumer.evidence) || consumer.evidence.length === 0 || consumer.evidence.some(path => typeof path !== "string" || path === "")) {
      fail("invalid-consumer-support", `${consumer.id} needs evidence paths`);
    }
    if (consumer.state === "supported") {
      if (!consumer.packageInstallation || !consumer.realLeanExecution || consumer.blocker !== null) {
        fail("unsupported-support-claim", `${consumer.id} cannot be supported without package installation and real Lean execution`);
      }
    } else {
      if (typeof consumer.blocker !== "string" || consumer.blocker === "") {
        fail("invalid-consumer-support", `${consumer.id} must name its blocker`);
      }
    }
    if (consumer.state === "blocked" && (consumer.packageInstallation || consumer.realLeanExecution)) {
      fail("stale-consumer-state", `${consumer.id} is runnable and must not remain blocked`);
    }
    ids.push(consumer.id);
  }
  if (JSON.stringify(ids) !== JSON.stringify(expectedConsumers)) {
    fail("invalid-consumer-support", "consumer order and coverage must match the version 1 contract", { actual: ids, expected: expectedConsumers });
  }
  return true;
};

export const readConsumerSupport = async (path = "docs/consumer-support.v1.json") => {
  const document = JSON.parse(await readFile(resolve(path), "utf8"));
  validateConsumerSupport(document);
  return document;
};

export const validateConsumerResult = (result, contract, { allowFailed = false } = {}) => {
  exactKeys(result, [
    "schemaVersion", "consumer", "declaredState", "testResult", "packageInstallation",
    "realLeanExecution", "performance", "blocker", "command",
  ], `result ${result?.consumer ?? "unknown"}`);
  if (result.schemaVersion !== 2 || !resultStates.has(result.testResult)) fail("invalid-consumer-result", "consumer result status is invalid");
  const declared = contract.consumers.find(item => item.id === result.consumer);
  if (!declared) fail("invalid-consumer-result", `unknown consumer ${result.consumer}`);
  if (result.declaredState !== declared.state) fail("consumer-state-drift", `${result.consumer} result used ${result.declaredState}, expected ${declared.state}`);
  if (typeof result.packageInstallation !== "boolean" || typeof result.realLeanExecution !== "boolean") {
    fail("invalid-consumer-result", `${result.consumer} result observations must be boolean`);
  }
  if (typeof result.command !== "string" || result.command === "") fail("invalid-consumer-result", `${result.consumer} result needs a command`);
  if (result.blocker !== declared.blocker) fail("consumer-blocker-drift", `${result.consumer} blocker differs from the contract`);
  if (result.performance !== null) {
    exactKeys(result.performance, [
      "schemaVersion", "consumer", "operation", "timingMode", "scope", "iterations",
      "durationNanoseconds", "nanosecondsPerOperation", "environment",
    ], `performance ${result.consumer}`);
    const performance = result.performance;
    if (performance.schemaVersion !== 2 || performance.consumer !== result.consumer) {
      fail("invalid-consumer-performance", `${result.consumer} performance identity is invalid`);
    }
    if (!new Set(["steady-state", "whole-invocation"]).has(performance.timingMode)) {
      fail("invalid-consumer-performance", `${result.consumer} performance timing mode is invalid`);
    }
    if (typeof performance.operation !== "string" || performance.operation === "" ||
      typeof performance.scope !== "string" || performance.scope === "") {
      fail("invalid-consumer-performance", `${result.consumer} performance needs an operation and scope`);
    }
    if (!Number.isSafeInteger(performance.iterations) || performance.iterations < 1 ||
      !Number.isFinite(performance.durationNanoseconds) || performance.durationNanoseconds <= 0 ||
      !Number.isFinite(performance.nanosecondsPerOperation) || performance.nanosecondsPerOperation <= 0) {
      fail("invalid-consumer-performance", `${result.consumer} performance measurements are invalid`);
    }
    const calculated = performance.durationNanoseconds / performance.iterations;
    if (Math.abs(calculated - performance.nanosecondsPerOperation) > Math.max(1e-9, calculated * 1e-12)) {
      fail("invalid-consumer-performance", `${result.consumer} performance latency does not match its duration and iterations`);
    }
    exactKeys(performance.environment, ["platform", "architecture", "cpu"], `performance environment ${result.consumer}`);
    if (Object.values(performance.environment).some(value => typeof value !== "string" || value === "")) {
      fail("invalid-consumer-performance", `${result.consumer} performance environment is invalid`);
    }
  }
  if (result.testResult !== "passed" && !allowFailed) fail("consumer-test-failed", `${result.consumer} consumer test failed`);
  if (result.testResult !== "passed") return true;
  if (result.performance === null) fail("consumer-performance-missing", `${result.consumer} passed without an end-user performance measurement`);
  if (declared.state === "supported" && (!result.packageInstallation || !result.realLeanExecution)) {
    fail("supported-consumer-not-executed", `${result.consumer} did not install its package and execute Lean`);
  }
  if (declared.state === "partial" && result.packageInstallation && result.realLeanExecution) {
    fail("partial-consumer-runnable", `${result.consumer} now satisfies the support contract and needs a matrix update`);
  }
  if (declared.state === "blocked" && (result.packageInstallation || result.realLeanExecution)) {
    fail("blocked-consumer-runnable", `${result.consumer} now has runtime capability and needs a matrix update`);
  }
  return true;
};

export const evaluateConsumerResults = ({ contract, results }) => {
  if (!Array.isArray(results)) fail("invalid-consumer-results", "results must be an array");
  const byId = new Map();
  for (const result of results) {
    validateConsumerResult(result, contract, { allowFailed: true });
    if (byId.has(result.consumer)) fail("duplicate-consumer-result", `${result.consumer} has several CI results`);
    byId.set(result.consumer, result);
  }
  const missing = contract.consumers.filter(item => !byId.has(item.id)).map(item => item.id);
  if (missing.length > 0) fail("missing-consumer-results", `consumer results are missing: ${missing.join(", ")}`);
  return Object.freeze({
    schemaVersion: 2,
    contractVersion: contract.contractVersion,
    result: results.every(item => item.testResult === "passed") ? "passed" : "failed",
    consumers: Object.freeze(contract.consumers.map(item => Object.freeze({ ...byId.get(item.id) }))),
  });
};

const yesNo = value => value ? "yes" : "no";

const performanceValue = performance => {
  if (performance === null) return "not measured";
  const nanoseconds = performance.nanosecondsPerOperation;
  const unit = performance.timingMode === "whole-invocation" ? "invocation" : "call";
  const value = nanoseconds < 1_000
    ? `${nanoseconds.toFixed(1)} ns/${unit}`
    : nanoseconds < 1_000_000
      ? `${(nanoseconds / 1_000).toFixed(2)} µs/${unit}`
      : `${(nanoseconds / 1_000_000).toFixed(2)} ms/${unit}`;
  return `${value} (${performance.iterations.toLocaleString("en-US")} iterations)`;
};

export const consumerSummaryMarkdown = report => [
  "# Downstream consumer support",
  "",
  `Contract ${report.contractVersion}. Result: **${report.result}**.`,
  "",
  "Performance values are observational measurements from installed generated APIs. Jobs can run on different workers, so compare rows only when their operation, timing mode, and recorded CPU match. Measurement context is shown below, and total duration is retained in the JSON report.",
  "",
  "| Consumer | Declared state | Test | Package installed | Real Lean executed | Operation | Timing | Performance | Blocker |",
  "|---|---|---|---|---|---|---|---:|---|",
  ...report.consumers.map(item => {
    const blocker = item.blocker === null ? "None" : item.blocker.replaceAll("|", "\\|");
    const operation = item.performance?.operation.replaceAll("|", "\\|") ?? "not measured";
    const timing = item.performance?.timingMode ?? "not measured";
    return `| ${item.consumer} | ${item.declaredState} | ${item.testResult} | ${yesNo(item.packageInstallation)} | ${yesNo(item.realLeanExecution)} | ${operation} | ${timing} | ${performanceValue(item.performance)} | ${blocker} |`;
  }),
  "",
  "## Measurement context",
  "",
  "| Consumer | Scope | Platform | Architecture | CPU |",
  "|---|---|---|---|---|",
  ...report.consumers.map(item => {
    if (item.performance === null) return `| ${item.consumer} | not measured | not measured | not measured | not measured |`;
    const scope = item.performance.scope.replaceAll("|", "\\|");
    const cpu = item.performance.environment.cpu.replaceAll("|", "\\|");
    return `| ${item.consumer} | ${scope} | ${item.performance.environment.platform} | ${item.performance.environment.architecture} | ${cpu} |`;
  }),
  "",
].join("\n");

export const expectedConsumerIds = expectedConsumers;
