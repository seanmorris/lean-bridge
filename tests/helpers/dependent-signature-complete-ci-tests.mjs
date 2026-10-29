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
const producerWorkflows = Object.freeze([
	["javascript", "browser"], ["native", "native"], ["perl", "perl"]
	, ["python", "python"], ["rust", "rust"], ["dotnet", "dotnet"]
	, ["jvm", "jvm"], ["ruby", "ruby"], ["php-native", "php"]
	, ["php-wasm", "php-wasm"], ["wit", "wit"]
]);
const producerDependencies = new Map([
	["python", "javascript"], ["rust", "native"], ["dotnet", "perl"]
	, ["jvm", "python"], ["ruby", "rust"], ["php-native", "dotnet"]
	, ["php-wasm", "jvm"], ["wit", "ruby"]
]);
const shallowCheckoutInput = `      shallow_checkout:
        description: Use an exact depth-one checkout for focused package execution
        required: false
        default: false
        type: boolean
`;
const focusedCheckoutDepth
	= "fetch-depth: ${{ inputs.shallow_checkout && 1 || 0 }}";
const auditCheckout = `      - name: Check out complete history and the exact audit corpus
        uses: actions/checkout@v6
        with:
          fetch-depth: 0
          persist-credentials: false
          sparse-checkout: |
            /*
            !/*/
            /.github/
            /acceptance/
            /config/
            /containers/
            /demos/
            /nix/
            /notices/
            /patches/
            /poc/
            /schema/
            /scripts/
            /site/
            /src/
            /tests/
            /docs/
            !/docs/evidence/*
            /docs/evidence/*.json
            /docs/evidence/*.md
            /docs/evidence/*.xml
            /docs/evidence/dependent-signatures-hosted-*/
          sparse-checkout-cone-mode: false
`;
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
	, "tests/helpers/dependent-signature-matrix-*.mjs"
]);

const assertDependentSignatureCompleteWorkflow = source => {
	assert.equal(typeof source, "string");
	const keys = [...source.matchAll(/^ {2}([a-z][a-z0-9_-]*):\n/gmu)]
		.map(match => match[1]);
	assert.deepEqual(keys, [
		"push", "pull_request", "workflow_dispatch", "schedule", "audit"
		, "javascript", "native", "perl", "python", "rust", "dotnet"
		, "jvm", "ruby", "php-native", "php-wasm", "wit", "receipt"
	]);
	for(const input of requiredInputs)
		assert.equal(source.split(`      - "${input}"\n`).length - 1
			, 2, `${input} must trigger push and pull_request`);
	assert.match(source, /schedule:\n {4}- cron: "19 9 \* \* 0"/u);
	assert.match(source, /workflow_dispatch:\n {4}inputs:\n {6}suite:[\s\S]* {10}- audit\n {10}- produce/u);
	assert.match(source, /concurrency:\n {2}group: dependent-signature-complete-\$\{\{ github\.ref \}\}\n {2}cancel-in-progress: false/u);
	assert.match(source, / {2}audit:\n {4}if: inputs\.suite != 'produce'/u);
	assert.equal(source.split(auditCheckout).length - 1, 1);
	assert.match(source, /npm ci --ignore-scripts --no-audit --no-fund/u);
	assert.match(source, /set -o pipefail\n {10}mkdir -p build\/dependent-signature-complete\n {10}node --test --test-concurrency=1 \\\n {12}tests\/dependent-signature-complete-hosted-evidence\.test\.mjs \\\n {12}\| tee build\/dependent-signature-complete\/evidence\.tap/u);
	assert.match(source, /set -o pipefail\n {10}node --test --test-concurrency=1 \\\n {12}tests\/dependent-signature-complete-promotion\.test\.mjs \\\n {12}\| tee build\/dependent-signature-complete\/promotion\.tap/u);
	assert.match(source, /if: always\(\)\n {8}uses: actions\/upload-artifact@v7/u);
	assert.equal((source.match(/if-no-files-found: error/gmu) ?? []).length, 2);
	for(const [job, workflow] of producerWorkflows)
	{
		const start = source.indexOf(`  ${job}:\n`);
		assert.notEqual(start, -1, job);
		const ends = keys.map(key => source.indexOf(`  ${key}:\n`, start + 3))
			.filter(index => index > start);
		const body = source.slice(start
			, ends.length === 0 ? undefined : Math.min(...ends));
		const dependency = producerDependencies.get(job);
		if(dependency === undefined)
		{
			assert.doesNotMatch(body, /^ {4}needs:/mu, job);
			assert.match(body, /^ {4}if: inputs\.suite == 'produce'$/mu, job);
		}
		else
		{
			assert.match(body, new RegExp(`^    needs: ${dependency}$`, "mu"), job);
			assert.match(body
				, /^ {4}if: always\(\) && inputs\.suite == 'produce'$/mu, job);
		}
		assert.ok(body.includes(
			`uses: ./.github/workflows/dependent-checked-record-${workflow}.yml`));
		assert.ok(body.includes("      shallow_checkout: true\n"));
		const receipt = source.split("  receipt:\n")[1];
		assert.ok(receipt.includes(`      - ${job}\n`), `${job} receipt need`);
		assert.ok(receipt.includes(`needs.${job}.result != 'success'`)
			, `${job} receipt result`);
	}
	assert.match(source, /pattern: dependent-checked-record-\*-\$\{\{ github\.sha \}\}/u);
	assert.match(source, /node scripts\/reconcile-dependent-signature-matrix\.mjs/u);
	assert.match(source, /name: dependent-signature-matrix-\$\{\{ github\.sha \}\}/u);
	assert.ok(source.includes("steps.download.outcome != 'success'"));
	assert.ok(source.includes("steps.reconciliation.outcome != 'success'"));
	assert.equal((source.match(/continue-on-error: true/gmu) ?? []).length, 2);
	assert.doesNotMatch(source, /\|\| true/u);
};

test("complete dependent-signature replay is one bounded recurring audit", async () => {
	assertDependentSignatureCompleteWorkflow(await readFile(workflowPath, "utf8"));
});

test("focused producers use depth one while standalone runs retain full history"
	, async () => {
	for(const [, workflow] of producerWorkflows)
	{
		const path = `.github/workflows/dependent-checked-record-${workflow}.yml`;
		const source = await readFile(path, "utf8");
		const call = source.split("  workflow_call:\n")[1]
			.split("  # One lane")[0];
		assert.ok(call.includes("    inputs:\n"), path);
		assert.ok(call.includes(shallowCheckoutInput), path);
		assert.equal(source.split(focusedCheckoutDepth).length - 1, 1, path);
		assert.ok(source.includes("- name: Check out the exact package revision\n")
			, path);
		assert.doesNotMatch(source, /^ {10}fetch-depth: [01]$/gmu, path);
		const shellPath = `scripts/run-dependent-checked-record-${workflow}-ci.sh`;
		const shell = await readFile(shellPath, "utf8");
		const gitCommands = [...shell.matchAll(/\bgit\s+([a-z-]+)/gu)]
			.map(match => match[1]);
		assert.ok(gitCommands.length > 0, shellPath);
		assert.ok(gitCommands.every(command => command === "rev-parse")
			, `${shellPath} must consume only the checked-out commit`);
		assert.match(shell, /git rev-parse HEAD/u, shellPath);
	}}
);

test("complete dependent-signature replay rejects missing inputs and bypasses", async () => {
	const source = await readFile(workflowPath, "utf8");
	for(const input of requiredInputs)
	{
		const line = `      - "${input}"\n`;
		assert.throws(() => assertDependentSignatureCompleteWorkflow(
			source.replace(line, "")), input);
	}
	for(const [index, changed] of [
		source.replace("          set -o pipefail\n", "")
		, source.replace("tests/dependent-signature-complete-hosted-evidence.test.mjs"
			, "tests/helpers/dependent-signature-complete-promotion-tests.mjs")
		, source.replace("tests/dependent-signature-complete-promotion.test.mjs"
			, "tests/helpers/dependent-signature-complete-promotion-tests.mjs")
		, source.replace("if-no-files-found: error", "if-no-files-found: ignore")
		, source.replace("    timeout-minutes: 90\n"
			, "    continue-on-error: true\n    timeout-minutes: 90\n")
		, source.replace("needs.wit.result != 'success' ||\n", "")
		, source.replace("steps.reconciliation.outcome != 'success'", "false")
		, source.replace("dependent-checked-record-*-", "dependent-checked-record-browser-")
		, source.replace("      shallow_checkout: true\n", "")
		, source.replace("            !/docs/evidence/*\n", "")
		, source.replace(
			"            /docs/evidence/dependent-signatures-hosted-*/\n", "")
		, source.replace("          sparse-checkout-cone-mode: false\n", "")
		, source.replace("    needs: javascript\n", "")
		, source.replace("    if: always() && inputs.suite == 'produce'\n"
			, "    if: inputs.suite == 'produce'\n")
	].entries()) assert.throws(
		() => assertDependentSignatureCompleteWorkflow(changed)
		, undefined, `bypass control ${index}`);
});
