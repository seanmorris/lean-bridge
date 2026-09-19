/**
 * Tests the documentation behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";

import { analyzeLeanProject } from "../src/analyze/lean-project.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { docPages } from "../site/registry.mjs";
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

const directoryDocuments = Object.freeze([
	"src/README.md"
	, "src/abi/README.md"
	, "src/adoption/README.md"
	, "src/analyze/README.md"
	, "src/backends/README.md"
	, "src/binding-ir/README.md"
	, "src/build/README.md"
	, "src/capsule/README.md"
	, "src/cli/README.md"
	, "src/performance/README.md"
	, "src/release/README.md"
	, "src/runtime/README.md"
	, "src/wasi/README.md"
	, "acceptance/README.md"
	, "containers/README.md"
	, "docs/README.md"
	, "nix/README.md"
	, "patches/README.md"
	, "poc/README.md"
	, "schema/README.md"
	, "scripts/README.md"
	, "tests/README.md"
]);

const publicDocuments = Object.freeze([
	"README.md"
	, "CONTRIBUTING.md"
	, "docs/lean-author-guide.md"
	, "docs/javascript-typescript.md"
	, "docs/php.md"
	, "docs/dotnet-jvm-ruby.md"
	, "docs/consumers.md"
	, "docs/status.md"
	, "docs/evidence/README.md"
	, "docs/evidence/production-hardening-review-20260814.md"
	, "docs/architecture/approval.md"
	, "docs/architecture/risks.md"
	, "docs/architecture/patches.md"
	, "docs/architecture/adr/README.md"
	, ...directoryDocuments
	, ...docPages.filter(page => page.source).map(page => page.source)
]);

const codeFences = source => [...source.matchAll(/^```[^\n]*\n([\s\S]*?)^```\s*$/gm)].map(match => match[1]);

test("the packaged CLI entry point is executable", async () => {
	const entry = await stat("scripts/lean-bridge.mjs");
	assert.notEqual(entry.mode & 0o111, 0);
});

test("source and operational directories have boundary indexes", async () => {
	const sourceDirectories = (await readdir("src", { withFileTypes: true }))
		.filter(entry => entry.isDirectory())
		.map(entry => `src/${entry.name}/README.md`)
		.sort();
	const indexedSourceDirectories = directoryDocuments
		.filter(path => path.startsWith("src/") && path !== "src/README.md")
		.sort();
	assert.deepEqual(indexedSourceDirectories, sourceDirectories);
	for(const path of directoryDocuments)
	{
		const source = await readFile(path, "utf8");
		assert.match(source, /^# [^\n]+$/m, `${path} needs one title`);
		assert.match(source, /\[[^\]]+\]\([^)]+\)/, `${path} needs a canonical link`);
		assert.ok(
			(source.match(/^## [^\n]+$/gm) ?? []).length >= 3,
			`${path} needs at least three explainer sections`,
		);
		assert.ok(
			source.split("\n").filter(line => line.trim() !== "").length >= 20,
			`${path} needs a full directory explanation`,
		);
	}
});

test("versioned consumer support contract is closed and honest", async () => {
  const contract = await readConsumerSupport();
  const schema = JSON.parse(await readFile("schema/consumer-support.schema.json", "utf8"));
  assert.equal(schema.$id, "urn:lean-bridge:schema:consumer-support:v1");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$defs.consumer.additionalProperties, false);
  assert.deepEqual(
    contract.consumers.filter(item => item.state === "supported").map(item => item.id),
    ["node-javascript", "node-typescript", "browser-javascript", "php-native", "php-wasm", "dotnet", "jvm", "ruby", "perl", "python", "rust", "c", "cpp", "wit-wasi"],
  );
  assert.deepEqual(
    contract.consumers.filter(item => item.state === "partial").map(item => item.id),
    [],
  );
  assert.deepEqual(
    contract.consumers.filter(item => item.state === "blocked").map(item => item.id),
    [],
  );
  for(const consumer of contract.consumers)
{
    for(const path of consumer.evidence) await access(path);
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
  for(const consumer of contract.consumers)
{
    const prefix = `| ${consumer.name} | \`${consumer.state}\` |`;
    assert.ok(readme.split("\n").some(line => line.startsWith(prefix)), consumer.id);
}
  assert.equal((readme.match(/^\| .* \| `(?:supported|partial|blocked)` \|/gm) ?? []).length, contract.consumers.length);
});

test("public documentation has valid local links, portable paths, and plain punctuation", async () => {
  for(const path of publicDocuments)
{
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(source, /—/, `${path} contains an em dash`);
    assert.doesNotMatch(source, /(?:^|[^A-Za-z0-9_])\/app(?:\/|\b)/, `${path} contains a workspace path`);
    assert.doesNotMatch(source, /\bperformance budgets?\b/i, `${path} presents performance as a budget`);
    assert.doesNotMatch(source, /https?:\/\/(?:www\.)?lean-?bridge\.dev/i, `${path} claims an unowned project domain`);
    for(const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g))
{
      const target = match[1].trim().replace(/^<|>$/g, "");
      if(/^(?:https?:|mailto:|#)/.test(target)) continue;
      const local = decodeURIComponent(target.split("#")[0].split("?")[0]);
      if(local === "") continue;
      await assert.doesNotReject(access(resolve(dirname(path), local)), `${path} -> ${target}`);
}
    for(const match of source.matchAll(/`((?:tests|scripts|schema|poc|containers|acceptance)\/[^`\s]+)`/g))
{
      if(match[1] === "poc/lean-alpha" || /^poc\/[^/]+@\d/u.test(match[1])) continue; // Composer package coordinates are not repository paths.
      await assert.doesNotReject(access(resolve(match[1])), `${path} -> ${match[1]}`);
}
}
});

test("public examples contain no private ABI or generic runtime surface", async () => {
  const forbidden = /\b(?:ccall|cwrap)\b|_Lean|\bWebAssembly\b|\bgeneric\s+(?:invoke|dispatch)\b|\bownershipFlag\b|\b(?:runtime|object)Handle\b/;
  for(const path of publicDocuments)
{
    const source = await readFile(path, "utf8");
    for(const block of codeFences(source)) assert.doesNotMatch(block, forbidden, `${path} public example`);
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
    ["scripts/test-native-consumers.mjs", "buildPyPiPackage"]
    , ["scripts/test-native-consumers.mjs", "buildCargoPackage"]
    , ["scripts/test-native-consumers.mjs", "buildCPackage"]
    , ["scripts/test-native-consumers.mjs", "buildCppPackage"]
    , ["scripts/test-managed-registry-consumers.mjs", "PackageReference"]
    , ["src/release/nuget-package.mjs", "buildNugetPackage"]
    , ["src/release/maven-package.mjs", "buildMavenPackage"]
    , ["src/release/rubygems-package.mjs", "buildRubyGemsPackage"]
    , ["scripts/test-wasi-consumer.mjs", "componentResult"]
  ];
  for(const [path, pattern] of checks) assert.match(await readFile(path, "utf8"), new RegExp(pattern), path);
});

test("steady-state consumers share one retained Box workload", async () => {
  assert.equal(STEADY_STATE_BOX_VALUE, 73);
  assert.equal(STEADY_STATE_OPERATION, "retained Box read");
  assert.equal(STEADY_STATE_WARMUP_ITERATIONS, 10_000);
  assert.equal(STEADY_STATE_MEASURED_ITERATIONS, 100_000);
  for(const path of [
    "tests/consumer-node.test.mjs"
    , "scripts/test-browser-package-consumer.mjs"
    , "scripts/test-native-consumers.mjs"
    , "scripts/test-php-native-package-consumer.mjs"
    , "scripts/test-php-wasm-package-host.mjs"
    , "scripts/test-managed-registry-consumers.mjs"
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
    schemaVersion: 2
    , consumer: item.id
    , declaredState: item.state
    , testResult: "passed"
    , packageInstallation: item.packageInstallation
    , realLeanExecution: item.realLeanExecution
    , performance: createConsumerPerformance({
      consumer: item.id
      , operation: "generated API fixture call"
      , timingMode: item.id === "wit-wasi" ? "whole-invocation" : "steady-state"
      , scope: item.id === "wit-wasi" ? "installed process and component startup" : "steady-state installed consumer"
      , iterations: 1000
      , durationNanoseconds: (index + 1) * 100000
    })
    , blocker: item.blocker
    , command: item.testCommand
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
  for(const consumer of contract.consumers) assert.match(markdown, new RegExp(`\\| ${consumer.id} \\|`));
  assert.match(markdown, /Operation \| Timing \| Performance/);
  assert.match(markdown, /ns\/call|µs\/call|ms\/call/);
  assert.match(markdown, /\/invocation/);
  assert.match(markdown, /operation, timing mode, and recorded CPU match/);
  assert.match(markdown, /## Measurement context/);
  assert.match(markdown, /Consumer \| Scope \| Platform \| Architecture \| CPU/);
});

test("dedicated CI covers every consumer with Node 22 and pinned build paths", async () => {
  const [workflow, packageDocument, perlWorkflow] = await Promise.all([
    readFile(".github/workflows/consumer-matrix.yml", "utf8")
    , readFile("package.json", "utf8").then(JSON.parse)
    , readFile(".github/workflows/perl-consumer.yml", "utf8")
  ]);
  assert.match(workflow, /^\s*push:\s*$/m);
  assert.match(workflow, /^\s*pull_request:\s*$/m);
  assert.match(workflow, /^\s*workflow_dispatch:\s*$/m);
  assert.match(workflow, /NODE_VERSION: "22"/);
  assert.match(workflow, /LEAN_BRIDGE_CONSUMER_PERFORMANCE_DIR: build\/consumer-ci\/performance/);
  assert.match(workflow, /npm run build:builder-image/);
  assert.match(workflow, /npm run test:builder-ownership/);
  assert.equal(packageDocument.scripts["test:builder-ownership"], "node scripts/check-builder-ownership.mjs");
  assert.match(packageDocument.scripts["test:consumer:native"], /\.\#universal-release-bundle/);
  assert.match(packageDocument.scripts["test:consumer:wasi"], /\.\#universal-release-bundle/);
  assert.match(packageDocument.scripts["test:consumer:node"], /\.\#npm-package/);
  assert.match(workflow, /LEAN_BRIDGE_LAKE_ENGINE: build\/locked-lake-engine\/bin\/lean-bridge-component-engine/);
  assert.match(workflow, /node --test tests\/component-publication\.test\.mjs/);
  assert.equal(packageDocument.scripts["test:consumer:docker-ci"], "bash scripts/test-docker-consumer-ci.sh");
  assert.match(workflow, /npm run test:consumer:docker-ci/);
  assert.match(workflow, /bootstrap-rust-ci\.sh/);
  assert.match(workflow, /LEAN_BRIDGE_NATIVE_RUST_TEST: "1"/);
  assert.match(workflow, /id: ordinary_rust/);
  assert.match(workflow, /steps\.ordinary_rust\.outcome != 'success'/);
  assert.equal(packageDocument.scripts["test:type-corpus:python"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=python node --test tests/type-corpus.test.mjs");
  assert.equal(packageDocument.scripts["test:type-corpus:reviewed"], "LEAN_BRIDGE_REVIEWED_CORPUS_TEST=1 node --test tests/type-corpus-reviewed.test.mjs");
  const reviewedJob = workflow.split("  reviewed-ir-admission:\n")[1].split("  nix-cache:\n")[0];
  assert.match(reviewedJob, /bootstrap-toolchains\.sh --lean-only/);
  assert.match(reviewedJob, /npm run test:type-corpus:reviewed/);
  assert.doesNotMatch(reviewedJob, /continue-on-error/);
  assert.match(reviewedJob, /name: type-corpus-reviewed-ir-\$\{\{ github\.sha \}\}/);
  assert.match(reviewedJob, /path: build\/type-corpus\/reviewed-ir\.json\n\s*if-no-files-found: error/);
  assert.match(workflow, /needs:[\s\S]*- reviewed-ir-admission/);
  for(const profiles of ["c,cpp", "dotnet", "java,kotlin", "php-native", "python", "ruby", "rust", "wit-wasi"])
  {
    assert.ok(workflow.includes(`LEAN_BRIDGE_REVIEWED_NATIVE_PROFILES=${profiles} node --test tests/type-corpus-reviewed-native.test.mjs`));
    assert.ok(workflow.includes(`test -s build/type-corpus/reviewed-native-${profiles.split(",").sort().join("-")}.json`));
  }
  assert.match(perlWorkflow, /LEAN_BRIDGE_REVIEWED_NATIVE_PROFILES=perl node --test tests\/type-corpus-reviewed-native\.test\.mjs/);
  assert.match(perlWorkflow, /test -s build\/type-corpus\/reviewed-native-perl\.json/);
  for(const profiles of ["c,cpp", "dotnet", "java,kotlin", "php-native", "php-wasm", "python", "ruby", "rust", "wit-wasi"])
  {
    assert.ok(workflow.includes(`LEAN_BRIDGE_CHAR_PROFILES=${profiles} node --test tests/native-char.test.mjs`));
    assert.ok(workflow.includes(`LEAN_BRIDGE_WORD_PROFILES=${profiles} node --test tests/native-words.test.mjs`));
  }
  assert.ok(perlWorkflow.includes("LEAN_BRIDGE_CHAR_PROFILES=perl node --test tests/native-char.test.mjs"));
  assert.ok(perlWorkflow.includes("LEAN_BRIDGE_WORD_PROFILES=perl node --test tests/native-words.test.mjs"));
  assert.ok(perlWorkflow.includes("LEAN_BRIDGE_PERL_CALLABLE_TEST=1 node --test tests/perl-callables.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_C_CALLABLE_TEST=1 node --test tests/c-callables.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_CPP_CALLABLE_TEST=1 node --test tests/cpp-callables.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_DOTNET_CALLABLE_TEST=1 node --test tests/dotnet-callables.test.mjs tests/dotnet-callable-contract.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_JVM_CALLABLE_TEST=1 node --test tests/jvm-callables.test.mjs tests/jvm-callable-contract.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_PYTHON_CALLABLE_TEST=1 node --test tests/python-callables.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_RUBY_CALLABLE_TEST=1 node --test tests/ruby-callables.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_RUST_CALLABLE_TEST=1 node --test tests/rust-callables.test.mjs"));
  assert.match(workflow, /build\/word-native\/rust\.json\n\s*build\/callables\/rust\.json\n\s*if-no-files-found: error/);
  assert.match(workflow, /build\/word-native\/ruby\.json\n\s*build\/callables\/ruby\.json\n\s*if-no-files-found: error/);
  assert.match(workflow, /LEAN_BRIDGE_REVIEWED_MULTI_PROFILE_TEST=1 node --test tests\/php-wasm-multi-profile\.test\.mjs/);
  for(const target of ["npm", "php-wasm"])
  {
    assert.ok(workflow.includes(`npm run test:type-corpus:reviewed-${target}`));
    assert.ok(packageDocument.scripts[`test:type-corpus:reviewed-${target}`].includes("tests/type-corpus-reviewed-wasm.test.mjs"));
  }
  for(const profiles of ["php-wasm", "browser-javascript-browser-react-browser-worker-node-javascript-node-typescript"])
    assert.ok(workflow.includes(`test -s build/type-corpus/reviewed-wasm-${profiles}.json`));
  assert.equal(packageDocument.scripts["test:type-corpus:ruby"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=ruby node --test tests/type-corpus.test.mjs");
  assert.equal(packageDocument.scripts["test:type-corpus:rust"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=rust node --test tests/type-corpus.test.mjs");
  assert.equal(packageDocument.scripts["test:type-corpus:all-native"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=c,cpp,dotnet,java,kotlin,perl,php-native,python,ruby,rust,wit-wasi node --test tests/type-corpus.test.mjs");
  assert.equal(packageDocument.scripts["test:type-corpus:wit-wasi"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=wit-wasi node --test tests/type-corpus.test.mjs");
  assert.match(workflow, /id: ordinary_wit\n\s*continue-on-error: true/);
  assert.match(workflow, /id: type_corpus_wit\n\s*continue-on-error: true/);
  assert.match(workflow, /node --test tests\/native-wit\.test\.mjs && LEAN_BRIDGE_WIT_CALLABLE_COMPONENT_TEST=1 node --test tests\/wit-callable-contract\.test\.mjs && LEAN_BRIDGE_WIT_CALLABLE_TEST=1 node --test tests\/wit-callables\.test\.mjs && npm run test:type-corpus:wit-wasi/);
  assert.match(workflow, /steps\.type_corpus_wit\.outcome != 'success'/);
  assert.match(workflow, /steps\.type_corpus_wit\.outcome == 'success'/);
  assert.match(workflow, /name: type-corpus-wit-wasi-\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /path: \|\n\s*build\/type-corpus\/wit-wasi\.json\n\s*build\/type-corpus\/reviewed-native-wit-wasi\.json\n\s*build\/char-native\/wit-wasi\.json\n\s*build\/word-native\/wit-wasi\.json\n\s*build\/callables\/wit\.json\n\s*if-no-files-found: error/);
  assert.match(workflow, /LEAN_BRIDGE_WIT_CALLABLE_TEST=1 node --test tests\/wit-callables\.test\.mjs/);
  assert.equal(packageDocument.scripts["test:type-corpus:php-native"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=php-native node --test tests/type-corpus.test.mjs");
  assert.match(workflow, /id: type_corpus_php_native\n\s*continue-on-error: true/);
  assert.match(workflow, /node --test tests\/native-php\.test\.mjs && npm run test:type-corpus:php-native/);
  assert.match(workflow, /steps\.type_corpus_php_native\.outcome != 'success'/);
  assert.match(workflow, /steps\.type_corpus_php_native\.outcome }}" != success/);
  assert.match(workflow, /name: type-corpus-php-native-\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /path: \|\n\s*build\/type-corpus\/php-native\.json\n\s*build\/type-corpus\/reviewed-native-php-native\.json\n\s*build\/char-native\/php-native\.json\n\s*build\/word-native\/php-native\.json\n\s*build\/callables\/php-native\.json\n\s*if-no-files-found: error/);
  assert.match(workflow, /LEAN_BRIDGE_PHP_CALLABLE_TEST=1 node --test tests\/php-callables\.test\.mjs tests\/php-callable-contract\.test\.mjs/);
  assert.equal(packageDocument.scripts["test:type-corpus:php-wasm"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=php-wasm node --test tests/type-corpus.test.mjs");
  assert.match(workflow, /id: type_corpus_php_wasm\n\s*continue-on-error: true/);
  assert.match(workflow, /steps\.type_corpus_php_wasm\.outcome != 'success'/);
  assert.match(workflow, /steps\.type_corpus_php_wasm\.outcome }}" != success/);
  assert.match(workflow, /node --test tests\/php-wasm-multi-profile\.test\.mjs && npm run test:type-corpus:php-wasm/);
  assert.match(workflow, /name: type-corpus-php-wasm-\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /LEAN_BRIDGE_PHP_WASM_CALLABLE_TEST=1 node --test tests\/php-wasm-callables\.test\.mjs tests\/php-wasm-callable-contract\.test\.mjs/);
  assert.match(workflow, /path: \|\n\s*build\/type-corpus\/php-wasm\.json\n\s*build\/type-corpus\/reviewed-wasm-php-wasm\.json\n\s*build\/char-native\/php-wasm\.json\n\s*build\/word-native\/php-wasm\.json\n\s*build\/callables\/php-wasm\.json\n\s*if-no-files-found: error/);
  assert.equal(packageDocument.scripts["test:type-corpus:java"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=java node --test tests/type-corpus.test.mjs");
  assert.equal(packageDocument.scripts["test:type-corpus:kotlin"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=kotlin node --test tests/type-corpus.test.mjs");
  assert.equal(packageDocument.scripts["test:type-corpus:jvm"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=java,kotlin node --test tests/type-corpus.test.mjs");
  assert.match(workflow, /id: ordinary_jvm\n\s*continue-on-error: true/);
  assert.match(workflow, /id: type_corpus_jvm/);
  assert.match(workflow, /node --test tests\/native-jvm\.test\.mjs && npm run test:type-corpus:jvm/);
  assert.match(workflow, /steps\.ordinary_jvm\.outcome != 'success'/);
  assert.match(workflow, /steps\.type_corpus_jvm\.outcome != 'success'/);
  assert.match(workflow, /steps\.type_corpus_jvm\.outcome }}" != success/);
  assert.match(workflow, /name: type-corpus-jvm-\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /path: \|\n\s*build\/type-corpus\/java-kotlin\.json\n\s*build\/type-corpus\/reviewed-native-java-kotlin\.json\n\s*build\/char-native\/java-kotlin\.json\n\s*build\/word-native\/java-kotlin\.json\n\s*build\/callables\/jvm\.json\n\s*if-no-files-found: error/);
  assert.equal(packageDocument.scripts["test:type-corpus:dotnet"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=dotnet node --test tests/type-corpus.test.mjs");
  assert.match(workflow, /id: ordinary_dotnet\n\s*continue-on-error: true/);
  assert.match(workflow, /id: type_corpus_dotnet/);
  assert.match(workflow, /node --test tests\/native-dotnet\.test\.mjs && npm run test:type-corpus:dotnet/);
  assert.match(workflow, /steps\.ordinary_dotnet\.outcome != 'success'/);
  assert.match(workflow, /steps\.type_corpus_dotnet\.outcome != 'success'/);
  assert.match(workflow, /steps\.type_corpus_dotnet\.outcome }}" != success/);
  assert.match(workflow, /name: type-corpus-dotnet-\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /path: \|\n\s*build\/type-corpus\/dotnet\.json\n\s*build\/type-corpus\/reviewed-native-dotnet\.json\n\s*build\/char-native\/dotnet\.json\n\s*build\/word-native\/dotnet\.json\n\s*build\/callables\/dotnet\.json\n\s*if-no-files-found: error/);
  assert.equal(packageDocument.scripts["test:type-corpus:c"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=c node --test tests/type-corpus.test.mjs");
  assert.equal(packageDocument.scripts["test:type-corpus:cpp"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=cpp node --test tests/type-corpus.test.mjs");
  assert.equal(packageDocument.scripts["test:type-corpus:c-family"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=c,cpp node --test tests/type-corpus.test.mjs");
  assert.match(workflow, /id: ordinary_c\n\s*continue-on-error: true/);
  assert.match(workflow, /id: type_corpus_c_family/);
  assert.match(workflow, /node --test tests\/native-c-family\.test\.mjs tests\/native-c-copied\.test\.mjs && npm run test:type-corpus:c-family/);
  assert.match(workflow, /steps\.ordinary_c\.outcome != 'success'/);
  assert.match(workflow, /steps\.type_corpus_c_family\.outcome != 'success'/);
  assert.match(workflow, /steps\.type_corpus_c_family\.outcome }}" != success/);
  assert.match(workflow, /name: type-corpus-c-family-\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /path: \|\n\s*build\/type-corpus\/c-cpp\.json\n\s*build\/type-corpus\/reviewed-native-c-cpp\.json\n\s*build\/char-native\/c-cpp\.json\n\s*build\/word-native\/c-cpp\.json\n\s*build\/callables\/c\.json\n\s*build\/callables\/cpp\.json\n\s*if-no-files-found: error/);
  assert.match(workflow, /id: type_corpus_rust/);
  assert.match(workflow, /node --test tests\/native-rust\.test\.mjs && npm run test:type-corpus:rust/);
  assert.match(workflow, /steps\.type_corpus_rust\.outcome != 'success'/);
  assert.match(workflow, /steps\.type_corpus_rust\.outcome }}" != success/);
  assert.match(workflow, /name: type-corpus-rust-\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /path: \|\n\s*build\/type-corpus\/rust\.json\n\s*build\/type-corpus\/reviewed-native-rust\.json\n\s*build\/char-native\/rust\.json\n\s*build\/word-native\/rust\.json\n\s*build\/callables\/rust\.json\n\s*if-no-files-found: error/);
  assert.equal(packageDocument.scripts["test:type-corpus:node"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=node-javascript,node-typescript node --test tests/type-corpus.test.mjs");
  assert.equal(packageDocument.scripts["test:type-corpus:browser"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=browser-javascript,browser-react,browser-worker node --test tests/type-corpus.test.mjs");
  assert.equal(packageDocument.scripts["test:type-corpus:npm"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=node-javascript,node-typescript,browser-javascript,browser-react,browser-worker node --test tests/type-corpus.test.mjs");
  assert.match(workflow, /id: type_corpus_npm/);
  assert.match(workflow, /LEAN_BRIDGE_TYPE_CORPUS_BROWSERS: chromium,firefox,webkit/);
  assert.match(workflow, /npm run test:consumer:node && npm run test:type-corpus:npm/);
  assert.match(workflow, /steps\.type_corpus_npm\.outcome != 'success'/);
  assert.match(workflow, /steps\.consumer\.outcome == 'success' && steps\.type_corpus_npm\.outcome == 'success'/);
  assert.match(workflow, /name: type-corpus-npm-\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /node --test tests\/component-char\.test\.mjs/);
  assert.match(workflow, /node --test tests\/component-words\.test\.mjs/);
  assert.match(workflow, /path: \|\n\s*build\/type-corpus\/browser-javascript-browser-react-browser-worker-node-javascript-node-typescript\.json\n\s*build\/type-corpus\/reviewed-wasm-browser-javascript-browser-react-browser-worker-node-javascript-node-typescript\.json\n\s*build\/char-npm\/\n\s*build\/word-npm\/\n\s*if-no-files-found: error/);
  assert.match(workflow, /id: type_corpus_python/);
  assert.match(workflow, /npm run test:type-corpus:python/);
  assert.match(workflow, /steps\.type_corpus_python\.outcome != 'success'/);
  assert.match(workflow, /steps\.type_corpus_python\.outcome }}" != success/);
  assert.match(workflow, /name: type-corpus-python-\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /path: \|\n\s*build\/type-corpus\/python\.json\n\s*build\/type-corpus\/reviewed-native-python\.json\n\s*build\/char-native\/python\.json\n\s*build\/word-native\/python\.json\n\s*build\/callables\/python\.json\n\s*if-no-files-found: error/);
  assert.match(workflow, /id: type_corpus_ruby/);
  assert.match(workflow, /npm run test:type-corpus:ruby/);
  assert.match(workflow, /steps\.type_corpus_ruby\.outcome != 'success'/);
  assert.match(workflow, /steps\.type_corpus_ruby\.outcome }}" != success/);
  assert.match(workflow, /name: type-corpus-ruby-\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /path: \|\n\s*build\/type-corpus\/ruby\.json\n\s*build\/type-corpus\/reviewed-native-ruby\.json\n\s*build\/char-native\/ruby\.json\n\s*build\/word-native\/ruby\.json\n\s*build\/callables\/ruby\.json\n\s*if-no-files-found: error/);
  assert.match(workflow, /LEAN_BRIDGE_NATIVE_PHP_TEST: "1"/);
  assert.match(workflow, /id: ordinary_php/);
  assert.match(workflow, /LEAN_BRIDGE_PHP_WASM_ZEND_TEST: "1"/);
  assert.match(workflow, /id: copied_zend/);
  assert.match(workflow, /steps\.copied_zend\.outcome != 'success'/);
  const ordinaryPhpWasm = workflow.split("id: ordinary_php_wasm\n")[1].split("      - name:")[0];
  assert.match(ordinaryPhpWasm, /LEAN_BRIDGE_PHP_WASM_ORDINARY_TEST: "1"/);
  assert.match(ordinaryPhpWasm, /LEAN_BRIDGE_PHP_WASM_BROWSER_TEST: "1"/);
  assert.match(ordinaryPhpWasm, /npx playwright install --with-deps chromium/);
  assert.match(ordinaryPhpWasm, /node --test tests\/php-wasm-ordinary\.test\.mjs/);
  assert.match(workflow, /steps\.ordinary_php_wasm\.outcome != 'success'/);
  assert.match(workflow, /steps\.ordinary_php\.outcome != 'success'/);
  assert.match(workflow, /php-cli php-common composer/);
  assert.match(packageDocument.scripts["test:consumer:browser"], /\.\#npm-package/);
  assert.match(packageDocument.scripts["test:consumer:php-native"], /\.\#php-native-package/);
  assert.match(packageDocument.scripts["test:consumer:managed"], /\.\#nuget-package/);
  assert.match(packageDocument.scripts["test:consumer:managed"], /\.\#maven-package/);
  assert.match(packageDocument.scripts["test:consumer:managed"], /\.\#rubygems-package/);
  assert.match(workflow, /GITHUB_STEP_SUMMARY|consumer-ci\.mjs summary/);
  assert.match(workflow, /pattern: consumer-results-\*-\$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(workflow, /consumer-(?:results|support-report)[^\n]*github\.run_attempt/);
  assert.equal((workflow.match(/^\s*overwrite: true$/gm) ?? []).length, 16);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/perl-consumer\.yml/);
  assert.match(workflow, /needs:[\s\S]*- perl-consumer/);
  assert.match(perlWorkflow, /node-version: "22"/);
  assert.match(perlWorkflow, /npm ci --ignore-scripts/);
  assert.match(perlWorkflow, /bootstrap-toolchains\.sh --lean-only/);
  assert.match(perlWorkflow, /npm run test:consumer:perl/);
  assert.equal(packageDocument.scripts["test:type-corpus:perl"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=perl node --test tests/type-corpus.test.mjs");
  assert.match(perlWorkflow, /npm run test:type-corpus:perl/);
  assert.match(perlWorkflow, /LEAN_BRIDGE_CORPUS_PERL="\$PWD\/\.toolchains\/perl\/\$CORPUS_PERL_CONFIGURATION\/bin\/perl"/);
  assert.match(perlWorkflow, /name: type-corpus-perl-\$\{\{ matrix\.configuration \}\}-\$\{\{ github\.sha \}\}/);
  assert.match(perlWorkflow, /path: \|\n\s*build\/type-corpus\/perl\.json\n\s*build\/type-corpus\/reviewed-native-perl\.json\n\s*build\/char-native\/perl\.json\n\s*build\/word-native\/perl\.json\n\s*build\/callables\/perl\.json\n\s*if-no-files-found: error/);
  assert.match(perlWorkflow, /needs\.perl\.result == 'success'/);
  assert.match(perlWorkflow, /nix run \.#perl-build-engine/);
  assert.match(perlWorkflow, /nix shell --inputs-from \. nixpkgs#perl/);
  const consumerWorkflows = `${workflow}\n${perlWorkflow}`;
  const contract = await readConsumerSupport();
  for(const consumer of contract.consumers)
{
    assert.match(consumerWorkflows, new RegExp(`(?:--consumer |consumer in [^\\n]*)${consumer.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    if(["python", "rust", "c", "cpp", "dotnet", "jvm", "ruby"].includes(consumer.id))
{
      assert.match(workflow, /--performance "build\/consumer-ci\/performance\/\$consumer\.json"/);
} else
{
      assert.match(consumerWorkflows, new RegExp(`--performance [^\\n]*${consumer.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.json`));
}
}
});

test("Python consumers run the exact wheel compatibility preflight before pip", async () => {
	const [guide, packageDocument] = await Promise.all([
		readFile("docs/consume/python.md", "utf8")
		, readFile("package.json", "utf8").then(JSON.parse)
	]);
	assert.equal(packageDocument.scripts["preflight:python-wheel"], "node src/release/python-wheel-preflight.mjs");
	assert.match(guide, /node \.\/python-wheel-preflight\.mjs/);
	assert.match(guide, /glibc 2\.38 or newer/);
	assert.match(guide, /Python 3\.11 or newer/);
	assert.match(guide, /Do not rename, retag, or unpack the (?:wheel|archive)/);
});
