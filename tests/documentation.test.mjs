import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";

import { analyzeLeanProject } from "../src/analyze/lean-project.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import {
  ConsumerSupportError,
  evaluateConsumerResults,
  readConsumerSupport,
  validateConsumerSupport,
} from "../src/adoption/consumer-support.mjs";

const publicDocuments = Object.freeze([
  "README.md",
  "CONTRIBUTING.md",
  "docs/lean-author-guide.md",
  "docs/javascript-typescript.md",
  "docs/php.md",
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
    ["node-javascript", "node-typescript", "php-native", "php-wasm"],
  );
  assert.deepEqual(
    contract.consumers.filter(item => item.state === "partial").map(item => item.id),
    ["browser-javascript"],
  );
  assert.deepEqual(
    contract.consumers.filter(item => item.state === "blocked").map(item => item.id),
    ["python", "rust", "c", "cpp", "wit-wasi"],
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
  unsupported.consumers.find(item => item.id === "python").state = "supported";
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

test("generated onboarding TypeScript has no public any and npm has no browser condition", async () => {
  const analysis = await analyzeLeanProject("tests/fixtures/onboarding/small", { targets: ["npm"] });
  assert.ok(analysis.bindingIr);
  const generated = generateJavaScriptPackage(analysis.bindingIr.document);
  assert.doesNotMatch(generated["index.d.ts"], /\bany\b/);
  const packageJson = JSON.parse(generated["package.json"]);
  assert.deepEqual(Object.keys(packageJson.exports), ["."]);
  assert.equal("browser" in packageJson, false);
});

test("blocked package evidence retains each exact runtime capability gap", async () => {
  const checks = [
    ["tests/pypi-package.test.mjs", "no native component library or Python extension adapter"],
    ["tests/cargo-package.test.mjs", "no native component library"],
    ["tests/c-family-package.test.mjs", "no native component library"],
    ["tests/c-family-package.test.mjs", "binding-artifacts-absent"],
    ["docs/evidence/wit-projection.md", "Component Model adapter"],
  ];
  for (const [path, pattern] of checks) assert.match(await readFile(path, "utf8"), new RegExp(pattern), path);
});

test("CI result contract detects support loss and newly runnable blocked targets", async () => {
  const contract = await readConsumerSupport();
  const results = contract.consumers.map(item => ({
    schemaVersion: 1,
    consumer: item.id,
    declaredState: item.state,
    testResult: "passed",
    packageInstallation: item.packageInstallation,
    realLeanExecution: item.realLeanExecution,
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

  const runnable = structuredClone(results);
  runnable.find(item => item.consumer === "python").realLeanExecution = true;
  assert.throws(
    () => evaluateConsumerResults({ contract, results: runnable }),
    error => error.code === "blocked-consumer-runnable",
  );

  const failed = structuredClone(results);
  failed.find(item => item.consumer === "php-wasm").testResult = "failed";
  assert.equal(evaluateConsumerResults({ contract, results: failed }).result, "failed");
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
  assert.match(workflow, /npm run build:builder-image/);
  assert.match(workflow, /\.\#universal-core-artifacts/);
  assert.match(packageDocument.scripts["test:consumer:php-native"], /\.\#php-native-package/);
  assert.match(workflow, /GITHUB_STEP_SUMMARY|consumer-ci\.mjs summary/);
  const contract = await readConsumerSupport();
  for (const consumer of contract.consumers) {
    assert.match(workflow, new RegExp(`(?:--consumer |consumer in [^\\n]*)${consumer.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
});
