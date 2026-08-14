import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";

import { analyzeLeanProject } from "../src/analyze/lean-project.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import {
  ConsumerSupportError,
  consumerSummaryMarkdown,
  evaluateConsumerResults,
  readConsumerSupport,
  validateConsumerSupport,
} from "../src/adoption/consumer-support.mjs";
import {
  STEADY_STATE_BOX_VALUE,
  STEADY_STATE_MEASURED_ITERATIONS,
  STEADY_STATE_OPERATION,
  STEADY_STATE_WARMUP_ITERATIONS,
  createConsumerPerformance,
} from "../src/adoption/consumer-performance.mjs";

const publicDocuments = Object.freeze([
  "README.md",
  "CONTRIBUTING.md",
  "docs/lean-author-guide.md",
  "docs/javascript-typescript.md",
  "docs/php.md",
  "docs/dotnet-jvm-ruby.md",
  "docs/consumers.md",
  "docs/status.md",
  "docs/evidence/README.md",
]);

const codeFences = source => [...source.matchAll(/^```[^\n]*\n([\s\S]*?)^```\s*$/gm)].map(match => match[1]);

test("versioned consumer support contract is closed and honest", async () => {
  const contract = await readConsumerSupport();
  const schema = JSON.parse(await readFile("schema/consumer-support.schema.json", "utf8"));
  assert.equal(schema.$id, "urn:lean-bridge:schema:consumer-support:v1");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$defs.consumer.additionalProperties, false);
  assert.deepEqual(
    contract.consumers.filter(item => item.state === "supported").map(item => item.id),
    ["node-javascript", "node-typescript", "browser-javascript", "php-native", "php-wasm", "dotnet", "jvm", "ruby", "python", "rust", "c", "cpp", "wit-wasi"],
  );
  assert.deepEqual(
    contract.consumers.filter(item => item.state === "partial").map(item => item.id),
    [],
  );
  assert.deepEqual(
    contract.consumers.filter(item => item.state === "blocked").map(item => item.id),
    [],
  );
  for (const consumer of contract.consumers) {
    for (const path of consumer.evidence) await access(path);
  }
  const open = structuredClone(contract);
  open.consumers[0].unreviewed = true;
  assert.throws(
    () => validateConsumerSupport(open),
    error => error instanceof ConsumerSupportError && error.code === "invalid-consumer-support",
  );
  const unsupported = structuredClone(contract);
  unsupported.consumers.find(item => item.id === "python").packageInstallation = false;
  assert.throws(
    () => validateConsumerSupport(unsupported),
    error => error instanceof ConsumerSupportError && error.code === "unsupported-support-claim",
  );
});

test("README support table matches every matrix state", async () => {
  const [contract, readme] = await Promise.all([readConsumerSupport(), readFile("README.md", "utf8")]);
  for (const consumer of contract.consumers) {
    const prefix = `| ${consumer.name} | \`${consumer.state}\` |`;
    assert.ok(readme.split("\n").some(line => line.startsWith(prefix)), consumer.id);
  }
  assert.equal((readme.match(/^\| .* \| `(?:supported|partial|blocked)` \|/gm) ?? []).length, contract.consumers.length);
});

test("public documentation has valid local links, portable paths, and plain punctuation", async () => {
  for (const path of publicDocuments) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(source, /—/, `${path} contains an em dash`);
    assert.doesNotMatch(source, /(?:^|[^A-Za-z0-9_])\/app(?:\/|\b)/, `${path} contains a workspace path`);
    assert.doesNotMatch(source, /\bperformance budgets?\b/i, `${path} presents performance as a budget`);
    assert.doesNotMatch(source, /https?:\/\/(?:www\.)?lean-?bridge\.dev/i, `${path} claims an unowned project domain`);
    for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = match[1].trim().replace(/^<|>$/g, "");
      if (/^(?:https?:|mailto:|#)/.test(target)) continue;
      const local = decodeURIComponent(target.split("#")[0].split("?")[0]);
      if (local === "") continue;
      await assert.doesNotReject(access(resolve(dirname(path), local)), `${path} -> ${target}`);
    }
    for (const match of source.matchAll(/`((?:tests|scripts|schema|poc|containers|acceptance)\/[^`\s]+)`/g)) {
      await assert.doesNotReject(access(resolve(match[1])), `${path} -> ${match[1]}`);
    }
  }
});

test("public examples contain no private ABI or generic runtime surface", async () => {
  const forbidden = /\b(?:ccall|cwrap)\b|_Lean|\bWebAssembly\b|\bgeneric\s+(?:invoke|dispatch)\b|\bownershipFlag\b|\b(?:runtime|object)Handle\b/;
  for (const path of publicDocuments) {
    const source = await readFile(path, "utf8");
    for (const block of codeFences(source)) assert.doesNotMatch(block, forbidden, `${path} public example`);
  }
});

test("generated onboarding TypeScript has no public any", async () => {
  const analysis = await analyzeLeanProject("tests/fixtures/onboarding/small", { targets: ["npm"] });
  assert.ok(analysis.bindingIr);
  const generated = generateJavaScriptPackage(analysis.bindingIr.document);
  assert.doesNotMatch(generated["index.d.ts"], /\bany\b/);
  const packageJson = JSON.parse(generated["package.json"]);
  assert.deepEqual(Object.keys(packageJson.exports), ["."]);
  assert.equal("browser" in packageJson, false);
});

test("promoted package evidence names each executable runtime path", async () => {
  const checks = [
    ["scripts/test-native-consumers.mjs", "buildPyPiPackage"],
    ["scripts/test-native-consumers.mjs", "buildCargoPackage"],
    ["scripts/test-native-consumers.mjs", "buildCPackage"],
    ["scripts/test-native-consumers.mjs", "buildCppPackage"],
    ["scripts/test-managed-registry-consumers.mjs", "PackageReference"],
    ["src/release/nuget-package.mjs", "buildNugetPackage"],
    ["src/release/maven-package.mjs", "buildMavenPackage"],
    ["src/release/rubygems-package.mjs", "buildRubyGemsPackage"],
    ["scripts/test-wasi-consumer.mjs", "componentResult"],
  ];
  for (const [path, pattern] of checks) assert.match(await readFile(path, "utf8"), new RegExp(pattern), path);
});

test("steady-state consumers share one retained Box workload", async () => {
  assert.equal(STEADY_STATE_BOX_VALUE, 73);
  assert.equal(STEADY_STATE_OPERATION, "retained Box read");
  assert.equal(STEADY_STATE_WARMUP_ITERATIONS, 10_000);
  assert.equal(STEADY_STATE_MEASURED_ITERATIONS, 100_000);
  for (const path of [
    "tests/consumer-node.test.mjs",
    "scripts/test-browser-package-consumer.mjs",
    "scripts/test-native-consumers.mjs",
    "scripts/test-php-native-package-consumer.mjs",
    "scripts/test-php-wasm-package-host.mjs",
    "scripts/test-managed-registry-consumers.mjs",
  ]) {
    const source = await readFile(path, "utf8");
    assert.match(source, /STEADY_STATE_BOX_VALUE/, path);
    assert.match(source, /STEADY_STATE_OPERATION/, path);
    assert.match(source, /STEADY_STATE_WARMUP_ITERATIONS/, path);
    assert.match(source, /STEADY_STATE_MEASURED_ITERATIONS/, path);
  }
  const native = await readFile("scripts/test-native-consumers.mjs", "utf8");
  assert.match(native, /-DCMAKE_BUILD_TYPE=Release/);
  assert.match(native, /"cargo", \["run", "--release"/);
  assert.doesNotMatch(native, /assert\(lean_alpha_/);
  assert.doesNotMatch(native, /sum\(box\.read/);
});

test("CI result contract detects support loss", async () => {
  const contract = await readConsumerSupport();
  const results = contract.consumers.map((item, index) => ({
    schemaVersion: 2,
    consumer: item.id,
    declaredState: item.state,
    testResult: "passed",
    packageInstallation: item.packageInstallation,
    realLeanExecution: item.realLeanExecution,
    performance: createConsumerPerformance({
      consumer: item.id,
      operation: "generated API fixture call",
      timingMode: item.id === "wit-wasi" ? "whole-invocation" : "steady-state",
      scope: item.id === "wit-wasi" ? "installed process and component startup" : "steady-state installed consumer",
      iterations: 1000,
      durationNanoseconds: (index + 1) * 100000,
    }),
    blocker: item.blocker,
    command: item.testCommand,
  }));
  assert.equal(evaluateConsumerResults({ contract, results }).result, "passed");

  const lost = structuredClone(results);
  lost.find(item => item.consumer === "node-javascript").realLeanExecution = false;
  assert.throws(
    () => evaluateConsumerResults({ contract, results: lost }),
    error => error.code === "supported-consumer-not-executed",
  );

  const failed = structuredClone(results);
  failed.find(item => item.consumer === "php-wasm").testResult = "failed";
  assert.equal(evaluateConsumerResults({ contract, results: failed }).result, "failed");

  const unmeasured = structuredClone(results);
  unmeasured.find(item => item.consumer === "rust").performance = null;
  assert.throws(
    () => evaluateConsumerResults({ contract, results: unmeasured }),
    error => error.code === "consumer-performance-missing",
  );

  const markdown = consumerSummaryMarkdown(evaluateConsumerResults({ contract, results }));
  for (const consumer of contract.consumers) assert.match(markdown, new RegExp(`\\| ${consumer.id} \\|`));
  assert.match(markdown, /Operation \| Timing \| Performance/);
  assert.match(markdown, /ns\/call|µs\/call|ms\/call/);
  assert.match(markdown, /\/invocation/);
  assert.match(markdown, /operation, timing mode, and recorded CPU match/);
  assert.match(markdown, /## Measurement context/);
  assert.match(markdown, /Consumer \| Scope \| Platform \| Architecture \| CPU/);
});

test("dedicated CI covers every consumer with Node 22 and pinned build paths", async () => {
  const [workflow, packageDocument] = await Promise.all([
    readFile(".github/workflows/consumer-matrix.yml", "utf8"),
    readFile("package.json", "utf8").then(JSON.parse),
  ]);
  assert.match(workflow, /^\s*push:\s*$/m);
  assert.match(workflow, /^\s*pull_request:\s*$/m);
  assert.match(workflow, /^\s*workflow_dispatch:\s*$/m);
  assert.match(workflow, /NODE_VERSION: "22"/);
  assert.match(workflow, /LEAN_BRIDGE_CONSUMER_PERFORMANCE_DIR: build\/consumer-ci\/performance/);
  assert.match(workflow, /npm run build:builder-image/);
  assert.match(packageDocument.scripts["test:consumer:native"], /\.\#universal-release-bundle/);
  assert.match(packageDocument.scripts["test:consumer:wasi"], /\.\#universal-release-bundle/);
  assert.match(packageDocument.scripts["test:consumer:node"], /\.\#npm-package/);
  assert.match(packageDocument.scripts["test:consumer:browser"], /\.\#npm-package/);
  assert.match(packageDocument.scripts["test:consumer:php-native"], /\.\#php-native-package/);
  assert.match(packageDocument.scripts["test:consumer:managed"], /\.\#nuget-package/);
  assert.match(packageDocument.scripts["test:consumer:managed"], /\.\#maven-package/);
  assert.match(packageDocument.scripts["test:consumer:managed"], /\.\#rubygems-package/);
  assert.match(workflow, /GITHUB_STEP_SUMMARY|consumer-ci\.mjs summary/);
  assert.match(workflow, /pattern: consumer-results-\*-\$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(workflow, /consumer-(?:results|support-report)[^\n]*github\.run_attempt/);
  assert.equal((workflow.match(/^\s*overwrite: true$/gm) ?? []).length, 7);
  const contract = await readConsumerSupport();
  for (const consumer of contract.consumers) {
    assert.match(workflow, new RegExp(`(?:--consumer |consumer in [^\\n]*)${consumer.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    if (["python", "rust", "c", "cpp", "dotnet", "jvm", "ruby"].includes(consumer.id)) {
      assert.match(workflow, /--performance "build\/consumer-ci\/performance\/\$consumer\.json"/);
    } else {
      assert.match(workflow, new RegExp(`--performance [^\\n]*${consumer.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.json`));
    }
  }
});
