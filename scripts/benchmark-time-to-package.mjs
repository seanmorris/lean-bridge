#!/usr/bin/env node

import { mkdtemp, readdir, rm } from "node:fs/promises";
import { cpus, tmpdir, totalmem } from "node:os";
import { join, resolve } from "node:path";

import { runTimeToPackageBenchmark, readTimeToPackageBudgets } from "../src/adoption/time-to-package.mjs";
import { cliHandlers } from "../src/cli/commands.mjs";
import { runCli } from "../src/cli/run.mjs";

const project = resolve(process.argv[2] ?? "tests/fixtures/onboarding/small");
const budgets = await readTimeToPackageBudgets(resolve("acceptance/time-to-package-budgets.v1.json"));
const stageState = new Map();

const countFiles = async root => {
  let count = 0;
  const visit = async directory => {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) await visit(join(directory, entry.name));
      else if (entry.isFile()) count += 1;
    }
  };
  await visit(root);
  return count;
};

const outcomeFromCli = async ({ result, output, concepts = [] }) => ({
  status: result.response.status === "ok"
    ? "ok"
    : result.response.status === "blocked" || result.response.status === "needs-input"
      ? "blocked"
      : "failed",
  prompts: result.response.prompts.length,
  hints: result.response.result?.adapterHints?.length ?? 0,
  generatedFiles: await countFiles(output),
  manualFiles: 0,
  commands: 1,
  unfamiliarConcepts: concepts,
  failures: result.exitCode === 0 ? 0 : 1,
  diagnostics: result.response.diagnostics.map(item => item.code),
});

const skipped = diagnostic => ({
  status: "skipped",
  prompts: 0,
  hints: 0,
  generatedFiles: 0,
  manualFiles: 0,
  commands: 0,
  unfamiliarConcepts: [],
  failures: 1,
  diagnostics: [diagnostic],
});

const runStage = async ({ mode, stage }) => {
  const scratch = await mkdtemp(join(tmpdir(), `lean-bridge-time-${mode}-${stage}-`));
  try {
    if (stage === "analyze") {
      const output = join(scratch, "analysis");
      const result = await runCli({
        argv: ["analyze", "--project", project, "--output", output, "--json", "--progress", "none"],
        handlers: cliHandlers,
      });
      return await outcomeFromCli({ result, output });
    }
    if (stage === "build") {
      const output = join(scratch, "build");
      const result = await runCli({
        argv: [
          "build", "--project", project, "--output", output, "--target", "npm",
          "--json", "--progress", "none", ...(mode === "cold" ? ["--no-cache"] : []),
        ],
        handlers: cliHandlers,
      });
      const outcome = await outcomeFromCli({ result, output, concepts: result.exitCode === 0 ? [] : ["flake", "builder-image"] });
      stageState.set(`${mode}:build`, outcome.status);
      return outcome;
    }
    if (stage === "dry-run") {
      if (stageState.get(`${mode}:build`) !== "ok") return skipped("upstream-build-blocked");
      return skipped("dry-run-benchmark-not-connected");
    }
    if (stage === "publish") {
      if (stageState.get(`${mode}:build`) !== "ok") return skipped("upstream-build-blocked");
      return skipped("sandbox-registry-benchmark-not-connected");
    }
    throw new Error(`Unknown benchmark stage ${stage}`);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
};

const cpu = cpus();
const report = await runTimeToPackageBenchmark({
  budgets,
  hardware: {
    platform: process.platform,
    architecture: process.arch,
    logicalCpus: cpu.length,
    memoryBytes: totalmem(),
    cpuModel: cpu[0]?.model ?? "unknown",
    nodeVersion: process.version,
  },
  runStage,
});

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exitCode = report.passed ? 0 : 2;
