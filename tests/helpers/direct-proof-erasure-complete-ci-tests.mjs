/**
 * Keep complete direct proof-erasure evidence, inventory and documentation in
 * one bounded recurring replay job.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = ".github/workflows/direct-proof-erasure-complete.yml";
const requiredInputs = Object.freeze([
	workflowPath
	, "docs/consume/**"
	, "docs/evidence/direct-proof-erasure-hosted-*/**"
	, "docs/javascript-typescript.md"
	, "docs/lean/**"
	, "docs/php.md"
	, "docs/reference/**"
	, "docs/consumer-support.v1.json"
	, "docs/type-surface.v1.json"
	, "package-lock.json"
	, "package.json"
	, "schema/binding-ir.schema.json"
	, "scripts/*direct-proof-erasure*.mjs"
	, "scripts/generate-type-docs.mjs"
	, "src/adoption/type-surface.mjs"
	, "src/capsule/node.mjs"
	, "tests/direct-proof-erasure-complete-*.test.mjs"
	, "tests/helpers/direct-proof-erasure-complete-*.mjs"
	, "tests/helpers/direct-proof-erasure-hosted-*.mjs"
	, "tests/helpers/direct-proof-erasure-matrix-receipt.mjs"
]);
const focusedProducers = Object.freeze([{
	file: ".github/workflows/generic-subtype-npm-browser.yml"
	, records: [["run-direct-proof-erasure-npm-ci.sh"
		, "direct-proof-erasure-node-browser", "build/direct-proof-erasure-npm-ci/"]]
}
, {
	file: ".github/workflows/generic-subtype-native-perl.yml"
	, records: [
		["run-direct-proof-erasure-native-ci.sh"
			, "direct-proof-erasure-native", "build/direct-proof-erasure-native-ci/"]
		, ["run-direct-proof-erasure-language-ci.sh perl"
			, "direct-proof-erasure-language-perl"
			, "build/direct-proof-erasure-language-ci/perl/"]
	]
}
, {
	file: ".github/workflows/generic-subtype-languages.yml"
	, records: ["python", "ruby", "rust"].map(profile => [
		`run-direct-proof-erasure-language-ci.sh ${profile}`
		, `direct-proof-erasure-language-${profile}`
		, `build/direct-proof-erasure-language-ci/${profile}/`
	])
}
, {
	file: ".github/workflows/generic-subtype-managed-wit.yml"
	, records: [
		["run-direct-proof-erasure-managed-ci.sh dotnet"
			, "direct-proof-erasure-managed-dotnet"
			, "build/direct-proof-erasure-managed-ci/dotnet/"]
		, ["run-direct-proof-erasure-managed-ci.sh jvm"
			, "direct-proof-erasure-managed-jvm"
			, "build/direct-proof-erasure-managed-ci/jvm/"]
		, ["run-direct-proof-erasure-wit-ci.sh"
			, "direct-proof-erasure-wit", "build/direct-proof-erasure-wit-ci/"]
	]
}
, {
	file: ".github/workflows/nominal-subtype-php-wasm.yml"
	, records: [["run-direct-proof-erasure-php-ci.sh"
		, "direct-proof-erasure-php", "build/direct-proof-erasure-php-ci/"]]
}]);

const assertFocusedProducer = (source, specification) => {
	assert.match(source
		, /^on:\n {2}workflow_call:\n {4}inputs:[\s\S]*?^ {6}direct_proof_erasure:/mu);
	assert.equal(source.match(/^ {8}id: direct_proof_erasure$/gmu)?.length
		, specification.records.length);
	assert.equal(source.match(/steps\.direct_proof_erasure\.outcome != 'success'/gu)?.length
		, specification.records.length);
	for(const [script, artifact, path] of specification.records)
	{
		assert.equal(source.split(script).length - 1, 1, script);
		assert.equal(source.split(`name: ${artifact}-\${{ github.sha }}`).length - 1
			, 1, artifact);
		assert.equal(source.split(`path: ${path}`).length - 1, 1, path);
	}
};

/**
 * Assert the complete proof-erasure workflow contract.
 *
 * @param source - UTF-8 YAML whose audit and producer gates must remain exact.
 */
export const assertDirectProofErasureCompleteWorkflow = source => {
	assert.equal(typeof source, "string");
	const keys = [...source.matchAll(/^ {2}([a-z][a-z0-9_-]*):\n/gmu)]
		.map(match => match[1]);
	assert.deepEqual(keys
		, ["push", "pull_request", "workflow_dispatch", "schedule", "audit"
			, "npm-browser", "native-perl", "languages", "managed-wit", "php"
			, "receipt"]);
	for(const input of requiredInputs)
		assert.equal(source.split(`      - "${input}"\n`).length - 1
			, 2, `${input} must trigger push and pull_request`);
	assert.match(source, /schedule:\n {4}- cron: "47 8 \* \* 6"/u);
	assert.match(source, /options:\n {10}- audit\n {10}- produce/u);
	assert.match(source, /concurrency:\n {2}group: direct-proof-erasure-complete-\$\{\{ github\.ref \}\}\n {2}cancel-in-progress: false/u);
	assert.match(source, /uses: actions\/checkout@v6\n {8}with:\n {10}fetch-depth: 0\n {10}persist-credentials: false/u);
	assert.match(source, /npm ci --ignore-scripts --no-audit --no-fund/u);
	assert.match(source, /set -o pipefail\n {10}mkdir -p build\/direct-proof-erasure-complete\n {10}node --test --test-concurrency=1 \\\n {12}tests\/direct-proof-erasure-complete-hosted-evidence\.test\.mjs \\\n {12}\| tee build\/direct-proof-erasure-complete\/evidence\.tap/u);
	assert.match(source, /set -o pipefail\n {10}node --test --test-concurrency=1 \\\n {12}tests\/direct-proof-erasure-complete-promotion\.test\.mjs \\\n {12}\| tee build\/direct-proof-erasure-complete\/promotion\.tap/u);
	const audit = source.slice(source.indexOf("  audit:\n")
		, source.indexOf("  npm-browser:\n"));
	assert.match(audit, /^ {4}if: inputs\.suite != 'produce'$/mu);
	assert.match(audit, /if: always\(\)\n {8}uses: actions\/upload-artifact@v7/u);
	assert.match(audit, /if-no-files-found: error/u);
	assert.doesNotMatch(audit, /continue-on-error|\|\| true/u);
	for(const [job, workflow] of [
		["npm-browser", "generic-subtype-npm-browser"]
		, ["native-perl", "generic-subtype-native-perl"]
		, ["languages", "generic-subtype-languages"]
		, ["managed-wit", "generic-subtype-managed-wit"]
		, ["php", "nominal-subtype-php-wasm"]
	]) {
		const start = source.indexOf(`  ${job}:\n`);
		assert.notEqual(start, -1, job);
		const ends = keys.map(key => source.indexOf(`  ${key}:\n`, start + 3))
			.filter(index => index > start);
		const body = source.slice(start
			, ends.length === 0 ? undefined : Math.min(...ends));
		assert.match(body, /^ {4}if: inputs\.suite == 'produce'$/mu);
		assert.ok(body.includes(`uses: ./.github/workflows/${workflow}.yml`));
		assert.ok(body.includes("direct_proof_erasure: true"));
	}
	const receipt = source.slice(source.indexOf("  receipt:\n"));
	assert.match(receipt
		, /^ {4}if: always\(\) && inputs\.suite == 'produce'$/mu);
	assert.match(receipt
		, /pattern: direct-proof-erasure-\*-\$\{\{ github\.sha \}\}/u);
	assert.ok(receipt.includes("node scripts/reconcile-direct-proof-erasure-matrix.mjs"));
	assert.ok(receipt.includes(
		'--workflow ".github/workflows/direct-proof-erasure-complete.yml"'));
	assert.match(receipt
		, /name: direct-proof-erasure-matrix-\$\{\{ github\.sha \}\}/u);
	assert.equal(receipt.match(/^ {8}continue-on-error: true$/gmu)?.length, 2);
	for(const job of ["npm-browser", "native-perl", "languages", "managed-wit", "php"])
		assert.ok(receipt.includes(`needs.${job}.result != 'success'`));
	assert.ok(receipt.includes("steps.download.outcome != 'success'"));
	assert.ok(receipt.includes("steps.reconciliation.outcome != 'success'"));
};

test("complete proof-erasure replay is one bounded recurring audit", async () => {
	assertDirectProofErasureCompleteWorkflow(await readFile(workflowPath, "utf8"));
});

test("complete proof-erasure replay rejects missing inputs and bypasses", async () => {
	const source = await readFile(workflowPath, "utf8");
	for(const input of requiredInputs)
	{
		const line = `      - "${input}"\n`;
		assert.throws(() => assertDirectProofErasureCompleteWorkflow(
			source.replace(line, "")), input);
	}
	for(const changed of [
		source.replace("          set -o pipefail\n", "")
		, source.replace(
			"tests/direct-proof-erasure-complete-hosted-evidence.test.mjs"
			, "tests/helpers/direct-proof-erasure-complete-promotion-tests.mjs")
		, source.replace(
			"tests/direct-proof-erasure-complete-promotion.test.mjs"
			, "tests/helpers/direct-proof-erasure-complete-promotion-tests.mjs")
		, source.replace("if-no-files-found: error", "if-no-files-found: ignore")
		, source.replace("          - produce\n", "")
		, source.replace("direct_proof_erasure: true", "direct_proof_erasure: false")
		, source.replace("steps.reconciliation.outcome != 'success'", "false")
		, source.replace("    timeout-minutes: 90\n"
			, "    continue-on-error: true\n    timeout-minutes: 90\n")
	]) assert.throws(() => assertDirectProofErasureCompleteWorkflow(changed));
});

test("focused proof-erasure producers retain all ten fail-closed lanes", async t => {
	for(const specification of focusedProducers)
	{
		const source = await readFile(specification.file, "utf8");
		assertFocusedProducer(source, specification);
		const [script, artifact, path] = specification.records[0];
		for(const changed of [
			source.replace(script, "disabled-script.sh")
			, source.replace(artifact, "disabled-artifact")
			, source.replace(path, "disabled/path/")
			, source.replace(
				"steps.direct_proof_erasure.outcome != 'success'", "false")
		]) assert.throws(() => assertFocusedProducer(changed, specification)
			, assert.AssertionError, specification.file);
	}
	t.diagnostic(`${focusedProducers.length * 4} focused producer bypasses refused`);
});
