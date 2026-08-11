#!/usr/bin/env node

import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { cpus, tmpdir, totalmem } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { runTimeToPackageBenchmark, readTimeToPackageBudgets } from "../src/adoption/time-to-package.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { createCliHandlers } from "../src/cli/commands.mjs";
import { runCli } from "../src/cli/run.mjs";
import { buildComponentNpmPackages } from "../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../src/release/component-package-receipt.mjs";
import { collectReleaseInventory, compareReleaseInventories } from "../src/release/reproducibility.mjs";

const execute = promisify(execFile);
const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const project = resolve(process.argv[2] ?? join(repository, "tests/fixtures/onboarding/small"));
const runtimeRoot = resolve(process.env.LEAN_BRIDGE_BENCHMARK_RUNTIME ?? join(repository, "build/lean-link-spike/lazy"));
const backend = process.env.LEAN_BRIDGE_BUILD_BACKEND ?? "nix";
const budgets = await readTimeToPackageBudgets(join(repository, "acceptance/time-to-package-budgets.v1.json"));
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

const benchmarkEnvironment = Object.freeze({
  ...process.env,
  LEAN_BRIDGE_BUILD_BACKEND: backend,
});
const handlers = createCliHandlers({
  build: options => buildCanonicalProject({
    ...options,
    engineRoot: repository,
    environment: benchmarkEnvironment,
  }),
});

const modeState = async mode => {
  const existing = stageState.get(mode);
  if (existing) return existing;
  const root = await mkdtemp(join(tmpdir(), `lean-bridge-time-${mode}-`));
  const created = { root, buildStatus: null, dryRunStatus: null, packages: null };
  stageState.set(mode, created);
  return created;
};

const outcomeFromCli = async ({ result, output }) => ({
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
  unfamiliarConcepts: [],
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

const runBuildCommand = async ({ mode, output }) => runCli({
  argv: [
    "build", "--project", project, "--output", output, "--target", "npm",
    "--json", "--progress", "none", ...(mode === "cold" ? ["--cache", "refresh"] : []),
  ],
  handlers,
  environment: benchmarkEnvironment,
});

const combineInventory = async ({ buildRoot, packageRoot }) => new Map([
  ...await collectReleaseInventory(buildRoot, { prefix: "build" }),
  ...await collectReleaseInventory(packageRoot, { prefix: "packages" }),
]);

const successfulStage = async ({ outputs, diagnostics }) => ({
  status: "ok",
  prompts: 0,
  hints: 0,
  generatedFiles: (await Promise.all(outputs.map(countFiles))).reduce((total, count) => total + count, 0),
  manualFiles: 0,
  commands: 1,
  unfamiliarConcepts: [],
  failures: 0,
  diagnostics,
});

const runStage = async ({ mode, stage }) => {
  const state = await modeState(mode);
  if (stage === "analyze") {
    const output = join(state.root, "analysis");
    const result = await runCli({
      argv: ["analyze", "--project", project, "--output", output, "--json", "--progress", "none"],
      handlers,
      environment: benchmarkEnvironment,
    });
    return await outcomeFromCli({ result, output });
  }
  if (stage === "build") {
    const output = join(state.root, "build-a");
    const result = await runBuildCommand({ mode, output });
    const outcome = await outcomeFromCli({ result, output });
    state.buildStatus = outcome.status;
    state.buildRoot = output;
    return outcome;
  }
  if (stage === "dry-run") {
    if (state.buildStatus !== "ok") return skipped("upstream-build-blocked");
    const buildRoot = join(state.root, "build-b");
    const secondBuild = await runBuildCommand({ mode, output: buildRoot });
    if (secondBuild.response.status !== "ok") {
      state.dryRunStatus = "failed";
      return await outcomeFromCli({ result: secondBuild, output: buildRoot });
    }
    const packageA = await buildComponentNpmPackages({
      bundleRoot: join(state.buildRoot, "bundle"),
      runtimeRoot,
      outputRoot: join(state.root, "packages-a"),
    });
    const packageB = await buildComponentNpmPackages({
      bundleRoot: join(buildRoot, "bundle"),
      runtimeRoot,
      outputRoot: join(state.root, "packages-b"),
    });
    const [inventoryA, inventoryB] = await Promise.all([
      combineInventory({ buildRoot: state.buildRoot, packageRoot: packageA.output }),
      combineInventory({ buildRoot, packageRoot: packageB.output }),
    ]);
    const comparison = compareReleaseInventories(inventoryA, inventoryB);
    if (comparison.differences.length !== 0) {
      const error = new Error(`reproducibility dry run found ${comparison.differences.length} differences`);
      error.code = "reproducibility-difference";
      throw error;
    }
    state.dryRunStatus = "ok";
    state.packages = packageA;
    return await successfulStage({
      outputs: [buildRoot, packageA.output, packageB.output],
      diagnostics: ["rebuild-byte-comparison-passed", "deterministic-package-projection-passed"],
    });
  }
  if (stage === "publish") {
    if (state.dryRunStatus !== "ok" || state.packages === null) return skipped("upstream-dry-run-blocked");
    const publication = join(state.root, "sandbox-publication");
    const release = join(publication, "registry", "npm");
    const consumer = join(publication, "consumer");
    await mkdir(release, { recursive: true });
    for (const source of [
      state.packages.runtimeArchive,
      state.packages.componentArchive,
      join(state.packages.output, "component-package-receipt.json"),
    ]) await cp(source, join(release, basename(source)));
    const receiptPath = join(release, "component-package-receipt.json");
    const receipt = await verifyComponentPackageReceipt({ receiptPath });
    await mkdir(consumer, { recursive: true });
    await writeFile(join(consumer, "package.json"), `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`);
    await execute("npm", [
      "install", "--ignore-scripts", "--no-audit", "--no-fund",
      join(release, basename(state.packages.runtimeArchive)),
      join(release, basename(state.packages.componentArchive)),
    ], { cwd: consumer, env: { ...process.env, npm_config_update_notifier: "false" } });
    const packageName = state.packages.report.component.name;
    const invocation = await execute("node", ["--input-type=module", "-e", [
      `const component = await import(${JSON.stringify(packageName)});`,
      "const result = { add: String(component.add(100n, 23n)), empty: component.isEmpty(\"\"), nonempty: component.isEmpty(\"browser\") };",
      "process.stdout.write(JSON.stringify(result));",
    ].join("\n")], { cwd: consumer });
    const calls = JSON.parse(invocation.stdout);
    if (calls.add !== "123" || calls.empty !== true || calls.nonempty !== false) {
      const error = new Error("installed sandbox package returned unexpected native call results");
      error.code = "sandbox-native-call-failed";
      throw error;
    }
    await writeFile(join(publication, "publication.json"), `${JSON.stringify({
      schemaVersion: 1,
      externalRegistryWrites: false,
      receiptSha256: receipt.receiptSha256,
      component: receipt.component,
      runtime: receipt.runtime,
      calls,
    }, null, 2)}\n`);
    return await successfulStage({
      outputs: [publication],
      diagnostics: ["package-receipt-verified", "sandbox-publication-complete", "native-callables-verified"],
    });
  }
  throw new Error(`Unknown benchmark stage ${stage}`);
};

const cpu = cpus();
let report;
try {
  report = await runTimeToPackageBenchmark({
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
} finally {
  await Promise.all([...stageState.values()].map(state => rm(state.root, { recursive: true, force: true })));
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exitCode = report.passed ? 0 : 2;
