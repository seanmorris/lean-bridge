/**
 * Keep dependent-signature archive replay, inventory and documentation in one
 * bounded recurring job.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = ".github/workflows/dependent-signature-complete.yml";
const requiredInputs = Object.freeze([
	workflowPath
	, "docs/consume/**"
	, "docs/evidence/dependent-signatures-hosted-*/**"
	, "docs/javascript-typescript.md"
	, "docs/lean/**"
	, "docs/php.md"
	, "docs/reference/**"
	, "docs/consumer-support.v1.json"
	, "docs/type-surface.v1.json"
	, "package-lock.json"
	, "package.json"
	, "schema/binding-ir.schema.json"
	, "scripts/*dependent-signature*.mjs"
	, "scripts/generate-type-docs.mjs"
	, "src/adoption/type-surface.mjs"
	, "src/capsule/node.mjs"
	, "tests/dependent-signature-complete-*.test.mjs"
	, "tests/helpers/dependent-signature-complete-*.mjs"
	, "tests/helpers/dependent-signature-hosted-*.mjs"
]);

const assertDependentSignatureCompleteWorkflow = source => {
	assert.equal(typeof source, "string");
	const keys = [...source.matchAll(/^ {2}([a-z][a-z0-9_-]*):\n/gmu)]
		.map(match => match[1]);
	assert.deepEqual(keys
		, ["push", "pull_request", "workflow_dispatch", "schedule", "audit"]);
	for(const input of requiredInputs)
		assert.equal(source.split(`      - "${input}"\n`).length - 1
			, 2, `${input} must trigger push and pull_request`);
	assert.match(source, /schedule:\n {4}- cron: "19 9 \* \* 0"/u);
	assert.match(source, /concurrency:\n {2}group: dependent-signature-complete-\$\{\{ github\.ref \}\}\n {2}cancel-in-progress: false/u);
	assert.match(source, /uses: actions\/checkout@v6\n {8}with:\n {10}fetch-depth: 0\n {10}persist-credentials: false/u);
	assert.match(source, /npm ci --ignore-scripts --no-audit --no-fund/u);
	assert.match(source, /set -o pipefail\n {10}mkdir -p build\/dependent-signature-complete\n {10}node --test --test-concurrency=1 \\\n {12}tests\/dependent-signature-complete-hosted-evidence\.test\.mjs \\\n {12}\| tee build\/dependent-signature-complete\/evidence\.tap/u);
	assert.match(source, /set -o pipefail\n {10}node --test --test-concurrency=1 \\\n {12}tests\/dependent-signature-complete-promotion\.test\.mjs \\\n {12}\| tee build\/dependent-signature-complete\/promotion\.tap/u);
	assert.match(source, /if: always\(\)\n {8}uses: actions\/upload-artifact@v7/u);
	assert.match(source, /if-no-files-found: error/u);
	assert.doesNotMatch(source, /continue-on-error|\|\| true/u);
};

test("complete dependent-signature replay is one bounded recurring audit", async () => {
	assertDependentSignatureCompleteWorkflow(await readFile(workflowPath, "utf8"));
});

test("complete dependent-signature replay rejects missing inputs and bypasses", async () => {
	const source = await readFile(workflowPath, "utf8");
	for(const input of requiredInputs)
	{
		const line = `      - "${input}"\n`;
		assert.throws(() => assertDependentSignatureCompleteWorkflow(
			source.replace(line, "")), input);
	}
	for(const changed of [
		source.replace("          set -o pipefail\n", "")
		, source.replace("tests/dependent-signature-complete-hosted-evidence.test.mjs"
			, "tests/helpers/dependent-signature-complete-promotion-tests.mjs")
		, source.replace("tests/dependent-signature-complete-promotion.test.mjs"
			, "tests/helpers/dependent-signature-complete-promotion-tests.mjs")
		, source.replace("if-no-files-found: error", "if-no-files-found: ignore")
		, source.replace("    timeout-minutes: 90\n"
			, "    continue-on-error: true\n    timeout-minutes: 90\n")
	]) assert.throws(() => assertDependentSignatureCompleteWorkflow(changed));
});
