/**
 * Require enabled ownership execution against freshly built production Wasm.
 * Include offline-installed author, Node, TypeScript and browser consumers.
 *
 * @file
 */
import assert from "node:assert/strict";

export const ownedJavaScriptWasmCiTests = [
	"owned-javascript-package", "owned-javascript-wasm-layout"
	, "owned-javascript-wasm-component", "owned-javascript-wasm-loader"
	, "owned-wasm-scalars", "owned-wasm-values", "owned-wasm-registry"
	, "owned-wasm-calls", "owned-wasm-bindings", "owned-javascript-wasm-native"
	, "owned-javascript-wasm-callbacks", "owned-javascript-wasm-shared"
	, "owned-javascript-wasm-prepared", "component-runtime"
	, "component-callable-runtime", "javascript-generator", "javascript-coverage"
].map(name => `tests/${name}.test.mjs`);
export const ownedJavaScriptWasmTestCommand = "node --test --test-concurrency=2 " + ownedJavaScriptWasmCiTests.join(" ");
export const ownedJavaScriptNpmCiTests = ["owned-javascript-wasm-model", "javascript-wasm-compiler-inputs", "owned-javascript-cli", "owned-javascript-wasm-build"].map(name => `tests/${name}.test.mjs`);
export const ownedJavaScriptNpmTestCommand = "node --test --test-concurrency=1 " + ownedJavaScriptNpmCiTests.join(" ");
export const ownedJavaScriptCoexistenceCiTests = ["component-runtime-package-identity", "owned-javascript-npm-coexistence"].map(name => `tests/${name}.test.mjs`);
export const ownedJavaScriptCoexistenceTestCommand = "node --test --test-concurrency=1 " + ownedJavaScriptCoexistenceCiTests.join(" ");
export const ownedAnalysisCiTests = ["owned-compiler-analysis", "owned-analysis-build-parity"].map(name => `tests/${name}.test.mjs`);
export const ownedAnalysisTestCommand = "node --test --test-concurrency=1 " + ownedAnalysisCiTests.join(" ");
export const ownedJavaScriptEngineCiTests = ["javascript-wasm-toolchain", "owned-javascript-archive-sdk", "owned-javascript-engine-request", "owned-javascript-engine", "owned-javascript-isolated-project"].map(name => `tests/${name}.test.mjs`);
export const ownedJavaScriptEngineTestCommand = "node --test --test-concurrency=1 " + ownedJavaScriptEngineCiTests.join(" ");
export const ownedJavaScriptPublicationCiTests = ["tests/owned-javascript-publication.test.mjs"];
export const ownedJavaScriptPublicationTestCommand = "node --test --test-concurrency=1 " + ownedJavaScriptPublicationCiTests.join(" ");
export const ownedJavaScriptWasmCiLogs = [
	"build/owned-javascript-wasm/runtime.log"
	, "build/owned-javascript-wasm/execution.log"
	, "build/owned-javascript-wasm/installed.log"
	, "build/owned-javascript-wasm/coexistence.log"
	, "build/owned-javascript-wasm/analysis.log"
	, "build/owned-javascript-wasm/engine.log"
	, "build/owned-javascript-wasm/publication.log"
];

const requiredStep = (job, name) => {
	const step = job.split(`      - name: ${name}\n`)[1]?.split("      - name: ")[0];
	assert.ok(step, name);
	return step;
};
const script = step => {
	assert.doesNotMatch(step, /^ {8}(?:if|continue-on-error):/mu);
	assert.match(step, /^ {8}shell: bash$/mu);
	const lines = step.split("        run: |\n")[1];
	assert.ok(lines);
	return lines.trim().replace(/^ {10}/gmu, "").replace(/\\\n\s*/gu, " ").replace(/ +/gu, " ");
};

/**
 * Reject skipped compilers, disabled suites, missing logs or swallowed errors.
 *
 * @param workflow - Complete current consumer workflow.
 */
export const assertOwnedJavaScriptWasmCi = workflow => {
	const job = workflow.match(/^ {2}owned-javascript-wasm:\n([^]*?)(?=^ {2}[a-z][a-z-]*:)/mu)?.[0];
	assert.ok(job);
	assert.doesNotMatch(job, /^ {4}(?:if|continue-on-error):/mu);
	assert.doesNotMatch(job, /^ {8}continue-on-error:/mu);
	assert.match(job, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.match(job, /^ {6}LEAN_BRIDGE_OWNED_JS_WASM_TEST: "1"$/mu);
	assert.match(job, /^ {6}LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_TEST: "1"$/mu);
	assert.match(job, /^ {6}LEAN_BRIDGE_OWNED_JS_WASM_BUILD_TEST: "1"$/mu);
	assert.match(job, /^ {6}LEAN_BRIDGE_OWNED_JS_WASM_BROWSER_TEST: "1"$/mu);
	assert.match(job, /^ {6}LEAN_BRIDGE_COMPILER_ANALYSIS_TEST: "1"$/mu);
	assert.match(job, /^ {6}EMCC_CORES: "2"$/mu);
	const dependencyName = "Install apt dependencies for Install dependencies and pinned Lean and Wasm toolchains";
	const dependencies = requiredStep(job, dependencyName);
	assert.doesNotMatch(dependencies, /^ {8}(?:if|continue-on-error):/mu);
	assert.match(dependencies, /^ {8}timeout-minutes: 20$/mu);
	assert.match(dependencies, /^ {10}sudo apt-get update$/mu);
	assert.ok(job.indexOf(dependencyName) < job.indexOf("- name: Install dependencies and pinned Lean and Wasm toolchains"));
	const prepare = requiredStep(job, "Install dependencies and pinned Lean and Wasm toolchains");
	assert.doesNotMatch(prepare, /^ {8}if:/mu);
	assert.match(prepare, /^ {10}bash scripts\/bootstrap-toolchains\.sh$/mu);
	assert.match(prepare, /^ {10}npm ci --ignore-scripts$/mu);
	const browsers = requiredStep(job, "Install owned npm browser engines");
	assert.doesNotMatch(browsers, /^ {8}(?:if|continue-on-error):/mu);
	assert.equal(browsers.trim(), "timeout-minutes: 20\n        run: bash scripts/install-playwright-browsers.sh chromium firefox webkit");
	for(const dependency of ["build-essential", "cmake", "jq", "libgmp-dev", "libuv1-dev", "ripgrep", "zstd"])
		assert.ok(dependencies.split("\n").some(line => line.includes("apt-get install") && line.split(" ").includes(dependency)), dependency);
	const buildName = "Build the production runtime with the shared ownership broker";
	const executeName = "Execute owned JavaScript values and generated public APIs";
	assert.ok(job.indexOf(buildName) < job.indexOf(executeName));
	assert.equal(script(requiredStep(job, buildName)), [
		"set -euo pipefail", "mkdir -p build/owned-javascript-wasm"
		, "bash scripts/build-lean-link-spike.sh 2>&1 | tee " + ownedJavaScriptWasmCiLogs[0]
		, ...["lazy", "startup", "final-static"].map(profile => `test -s build/lean-link-spike/${profile}/main.wasm`)
	].join("\n"));
	const installedName = "Build and install owned npm packages through the standalone CLI";
	assert.ok(job.indexOf(executeName) < job.indexOf(installedName));
	assert.equal(script(requiredStep(job, installedName)), [
		"set -euo pipefail", "source scripts/env.sh"
		, ownedJavaScriptNpmTestCommand + " 2>&1 | tee " + ownedJavaScriptWasmCiLogs[2]
		, "test -s " + ownedJavaScriptWasmCiLogs[2]
		, "rg '^# fail 0$' " + ownedJavaScriptWasmCiLogs[2]
		, "rg '^# skipped 0$' " + ownedJavaScriptWasmCiLogs[2]
	].join("\n"));
	assert.equal(script(requiredStep(job, executeName)), [
		"set -euo pipefail"
		, ownedJavaScriptWasmTestCommand + " 2>&1 | tee " + ownedJavaScriptWasmCiLogs[1]
		, "test -s " + ownedJavaScriptWasmCiLogs[1]
		, "rg '^# fail 0$' " + ownedJavaScriptWasmCiLogs[1]
		, "rg '^# skipped 0$' " + ownedJavaScriptWasmCiLogs[1]
	].join("\n"));
	const coexistenceName = "Verify installed copied and owned npm coexistence";
	assert.ok(job.indexOf(installedName) < job.indexOf(coexistenceName));
	assert.equal(script(requiredStep(job, coexistenceName)), [
		"set -euo pipefail", "source scripts/env.sh"
		, ownedJavaScriptCoexistenceTestCommand + " 2>&1 | tee " + ownedJavaScriptWasmCiLogs[3]
		, "test -s " + ownedJavaScriptWasmCiLogs[3]
		, "rg '^# fail 0$' " + ownedJavaScriptWasmCiLogs[3]
		, "rg '^# skipped 0$' " + ownedJavaScriptWasmCiLogs[3]
	].join("\n"));
	const analysisName = "Compare ownership analysis with compiled APIs";
	assert.ok(job.indexOf(coexistenceName) < job.indexOf(analysisName));
	assert.equal(script(requiredStep(job, analysisName)), [
		"set -euo pipefail", "source scripts/env.sh"
		, ownedAnalysisTestCommand + " 2>&1 | tee " + ownedJavaScriptWasmCiLogs[4]
		, "test -s " + ownedJavaScriptWasmCiLogs[4]
		, "rg '^# fail 0$' " + ownedJavaScriptWasmCiLogs[4]
		, "rg '^# skipped 0$' " + ownedJavaScriptWasmCiLogs[4]
	].join("\n"));
	const upload = requiredStep(job, "Preserve owned JavaScript and runtime execution logs");
	const engineName = "Verify owned JavaScript engine and archive SDK contracts";
	assert.ok(job.indexOf(analysisName) < job.indexOf(engineName));
	assert.equal(script(requiredStep(job, engineName)), [
		"set -euo pipefail", "source scripts/env.sh"
		, ownedJavaScriptEngineTestCommand + " 2>&1 | tee " + ownedJavaScriptWasmCiLogs[5]
		, "test -s " + ownedJavaScriptWasmCiLogs[5]
		, "rg '^# fail 0$' " + ownedJavaScriptWasmCiLogs[5]
		, "rg '^# skipped 0$' " + ownedJavaScriptWasmCiLogs[5]
	].join("\n"));
	const publicationName = "Verify reproducible signed owned npm publication";
	assert.ok(job.indexOf(engineName) < job.indexOf(publicationName));
	assert.equal(script(requiredStep(job, publicationName)), [
		"set -euo pipefail", "source scripts/env.sh"
		, ownedJavaScriptPublicationTestCommand + " 2>&1 | tee " + ownedJavaScriptWasmCiLogs[6]
		, "test -s " + ownedJavaScriptWasmCiLogs[6]
		, "rg '^# fail 0$' " + ownedJavaScriptWasmCiLogs[6]
		, "rg '^# skipped 0$' " + ownedJavaScriptWasmCiLogs[6]
	].join("\n"));
	assert.match(upload, /^ {8}if: always\(\)$/mu);
	assert.match(upload, /^ {8}uses: actions\/upload-artifact@v7$/mu);
	assert.match(upload, /^ {10}if-no-files-found: error$/mu);
	for(const path of ownedJavaScriptWasmCiLogs) assert.ok(upload.includes("            " + path + "\n"));
	const summary = workflow.split("  support-summary:\n")[1]; assert.ok(summary);
	assert.ok(summary.split("    runs-on:")[0].includes("      - owned-javascript-wasm\n"));
	const enforce = requiredStep(summary, "Enforce owned JavaScript and Wasm execution");
	assert.equal(enforce.trim(), "if: needs.owned-javascript-wasm.result != 'success'\n        run: exit 1");
	return { testFiles: ownedJavaScriptWasmCiTests.length
		, installedTestFiles: ownedJavaScriptNpmCiTests.length
		, coexistenceTestFiles: ownedJavaScriptCoexistenceCiTests.length
		, analysisTestFiles: ownedAnalysisCiTests.length
		, engineTestFiles: ownedJavaScriptEngineCiTests.length
		, publicationTestFiles: ownedJavaScriptPublicationCiTests.length
		, requiredLogs: ownedJavaScriptWasmCiLogs.length
		, productionRuntimeRequired: true, skippedTestsRejected: true
		, failurePropagated: true };
};
