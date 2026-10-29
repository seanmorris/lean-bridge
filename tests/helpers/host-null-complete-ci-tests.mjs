/**
 * Keep complete HostNull evidence, inventory and documentation replaying in
 * one bounded recurring job.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = ".github/workflows/host-null-complete.yml";
const requiredInputs = Object.freeze([
	workflowPath
	, "docs/consume/**"
	, "docs/evidence/host-null-complete-*/**"
	, "docs/javascript-typescript.md"
	, "docs/php.md"
	, "docs/reference/**"
	, "docs/consumer-support.v1.json"
	, "docs/type-surface.v1.json"
	, "package-lock.json"
	, "package.json"
	, "schema/binding-ir.schema.json"
	, "scripts/*host-null-complete*.mjs"
	, "scripts/generate-type-docs.mjs"
	, "src/adoption/type-surface.mjs"
	, "src/capsule/node.mjs"
	, "tests/host-null-complete-*.test.mjs"
	, "tests/helpers/host-null-complete-*.mjs"
]);

const assertHostNullCompleteWorkflow = source => {
	assert.equal(typeof source, "string");
	const keys = [...source.matchAll(/^ {2}([a-z][a-z0-9_-]*):\n/gmu)]
		.map(match => match[1]);
	assert.deepEqual(keys
		, ["push", "pull_request", "workflow_dispatch", "schedule", "audit"]);
	for(const input of requiredInputs)
		assert.equal(source.split(`      - "${input}"\n`).length - 1
			, 2, `${input} must trigger push and pull_request`);
	assert.match(source, /schedule:\n {4}- cron: "31 8 \* \* 6"/u);
	assert.match(source, /concurrency:\n {2}group: host-null-complete-\$\{\{ github\.ref \}\}\n {2}cancel-in-progress: false/u);
	assert.match(source, /uses: actions\/checkout@v6\n {8}with:\n {10}fetch-depth: 0\n {10}persist-credentials: false/u);
	assert.match(source, /npm ci --ignore-scripts --no-audit --no-fund/u);
	assert.match(source, /set -o pipefail\n {10}mkdir -p build\/host-null-complete\n {10}node --test --test-concurrency=1 \\\n {12}tests\/host-null-complete-hosted-evidence\.test\.mjs \\\n {12}\| tee build\/host-null-complete\/evidence\.tap/u);
	assert.match(source, /set -o pipefail\n {10}node --test --test-concurrency=1 \\\n {12}tests\/host-null-complete-promotion\.test\.mjs \\\n {12}\| tee build\/host-null-complete\/promotion\.tap/u);
	assert.match(source, /if: always\(\)\n {8}uses: actions\/upload-artifact@v7/u);
	assert.match(source, /if-no-files-found: error/u);
	assert.doesNotMatch(source, /continue-on-error|\|\| true/u);
};

test("complete HostNull replay is one bounded recurring audit", async () => {
	assertHostNullCompleteWorkflow(await readFile(workflowPath, "utf8"));
});

test("complete HostNull replay rejects missing inputs and bypasses", async () => {
	const source = await readFile(workflowPath, "utf8");
	for(const input of requiredInputs)
	{
		const line = `      - "${input}"\n`;
		assert.throws(() => assertHostNullCompleteWorkflow(
			source.replace(line, "")), input);
	}
	for(const changed of [
		source.replace("          set -o pipefail\n", "")
		, source.replace("tests/host-null-complete-hosted-evidence.test.mjs"
			, "tests/helpers/host-null-complete-promotion-tests.mjs")
		, source.replace("tests/host-null-complete-promotion.test.mjs"
			, "tests/helpers/host-null-complete-promotion-tests.mjs")
		, source.replace("if-no-files-found: error", "if-no-files-found: ignore")
		, source.replace("    timeout-minutes: 90\n"
			, "    continue-on-error: true\n    timeout-minutes: 90\n")
	]) assert.throws(() => assertHostNullCompleteWorkflow(changed));
});
