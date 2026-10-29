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
const producerDependencies = new Map([
	["native-perl", "npm-browser"], ["managed-wit", "native-perl"]
	, ["php", "managed-wit"]
]);
const sparseSourcePatterns = Object.freeze([
	"/*", "!/*/", "/.github/", "/acceptance/", "/config/", "/containers/"
	, "/demos/", "/nix/", "/notices/", "/patches/", "/poc/", "/schema/"
	, "/scripts/", "/site/", "/src/", "/tests/", "/docs/"
	, "!/docs/evidence/*", "/docs/evidence/*.json"
	, "/docs/evidence/*.md", "/docs/evidence/*.xml"
]);
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
const focusedProducers = Object.freeze([{
	file: ".github/workflows/generic-subtype-npm-browser.yml"
	, records: [["tests/host-null-npm-installed.test.mjs"
		, "host-null-node-browser", "build/host-null/npm/"]]
}
, {
	file: ".github/workflows/generic-subtype-native-perl.yml"
	, records: [["run-host-null-scripting-ci.sh"
		, "host-null-scripting", "build/host-null-scripting-ci/"]]
}
, {
	file: ".github/workflows/generic-subtype-managed-wit.yml"
	, records: [
		["run-host-null-managed-ci.sh dotnet", "host-null-managed-dotnet"
			, "build/host-null-managed-ci/dotnet/"]
		, ["run-host-null-managed-ci.sh jvm", "host-null-managed-jvm"
			, "build/host-null-managed-ci/jvm/"]
		, ["run-host-null-systems-ci.sh", "host-null-systems"
			, "build/host-null-systems-ci/"]
	]
}
, {
	file: ".github/workflows/nominal-subtype-php-wasm.yml"
	, records: [
		["tests/php-host-null.test.mjs", "host-null-php-native"
			, "build/host-null/packages/php-native"]
		, ["tests/php-wasm-host-null.test.mjs", "host-null-php-wasm"
			, "build/host-null/packages/php-wasm"]
	]
}
]);

const assertFocusedProducer = (source, specification) => {
	assert.match(source
		, /^on:\n {2}workflow_call:\n {4}inputs:[\s\S]*?^ {6}host_null:/mu);
	assert.equal(source.match(/^ {8}id: host_null$/gmu)?.length
		, specification.file.endsWith("managed-wit.yml") ? 3 : 1);
	assert.equal(source.match(/steps\.host_null\.outcome != 'success'/gu)?.length
		, specification.file.endsWith("managed-wit.yml") ? 3 : 1);
	for(const [command, artifact, path] of specification.records)
	{
		assert.equal(source.split(command).length - 1, 1, command);
		assert.equal(source.split(`name: ${artifact}-\${{ github.sha }}`).length - 1
			, 1, artifact);
		assert.ok(source.includes(path), path);
	}
	if(specification.file.endsWith("generic-subtype-managed-wit.yml"))
	{
		const dotnet = source.slice(source.indexOf("  dotnet:\n")
			, source.indexOf("  jvm:\n"));
		assert.match(dotnet
			, /if: \$\{\{ inputs\.optional_parameters \|\| inputs\.direct_proof_erasure \|\| inputs\.host_null \}\}/u);
		assert.match(dotnet, /fetch-depth: 1/u);
		assert.match(dotnet, /sparse-checkout: \|\n {12}\/\*\n {12}!\/docs\/evidence\//u);
		assert.match(dotnet, /sparse-checkout-cone-mode: false/u);
		assert.match(dotnet
			, /if: \$\{\{ !inputs\.optional_parameters && !inputs\.direct_proof_erasure && !inputs\.host_null \}\}/u);
		assert.match(dotnet, /fetch-depth: 0/u);
	}
};

const sparseCheckoutPatterns = source => {
	assert.equal(source.split("          sparse-checkout: |\n").length - 1, 1);
	assert.match(source, /sparse-checkout-cone-mode: false/u);
	return source.split("          sparse-checkout: |\n")[1]
		.split("          sparse-checkout-cone-mode: false\n")[0]
		.trim().split("\n").map(line => line.trim());
};

const assertHostNullCompleteWorkflow = source => {
	assert.equal(typeof source, "string");
	const keys = [...source.matchAll(/^ {2}([a-z][a-z0-9_-]*):\n/gmu)]
		.map(match => match[1]);
	assert.deepEqual(keys
		, ["push", "pull_request", "workflow_dispatch", "schedule", "audit"
			, "npm-browser", "native-perl", "managed-wit", "php", "receipt"]);
	for(const input of requiredInputs)
		assert.equal(source.split(`      - "${input}"\n`).length - 1
			, 2, `${input} must trigger push and pull_request`);
	assert.match(source, /schedule:\n {4}- cron: "31 8 \* \* 6"/u);
	assert.match(source, /options:\n {10}- audit\n {10}- produce/u);
	assert.match(source, /concurrency:\n {2}group: host-null-complete-\$\{\{ github\.ref \}\}\n {2}cancel-in-progress: false/u);
	assert.match(source, /uses: actions\/checkout@v6\n {8}with:\n {10}fetch-depth: 0\n {10}persist-credentials: false/u);
	assert.match(source, /npm ci --ignore-scripts --no-audit --no-fund/u);
	assert.match(source, /set -o pipefail\n {10}mkdir -p build\/host-null-complete\n {10}node --test --test-concurrency=1 \\\n {12}tests\/host-null-complete-hosted-evidence\.test\.mjs \\\n {12}\| tee build\/host-null-complete\/evidence\.tap/u);
	assert.match(source, /set -o pipefail\n {10}node --test --test-concurrency=1 \\\n {12}tests\/host-null-complete-promotion\.test\.mjs \\\n {12}\| tee build\/host-null-complete\/promotion\.tap/u);
	const audit = source.slice(source.indexOf("  audit:\n")
		, source.indexOf("  npm-browser:\n"));
	assert.deepEqual(sparseCheckoutPatterns(audit), [
		...sparseSourcePatterns, "/docs/evidence/host-null-complete-*/"
	]);
	assert.match(audit, /^ {4}if: inputs\.suite != 'produce'$/mu);
	assert.match(audit, /if: always\(\)\n {8}uses: actions\/upload-artifact@v7/u);
	assert.match(audit, /if-no-files-found: error/u);
	assert.doesNotMatch(audit, /continue-on-error|\|\| true/u);
	for(const [job, workflow] of [
		["npm-browser", "generic-subtype-npm-browser"]
		, ["native-perl", "generic-subtype-native-perl"]
		, ["managed-wit", "generic-subtype-managed-wit"]
		, ["php", "nominal-subtype-php-wasm"]
	]) {
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
		assert.ok(body.includes(`uses: ./.github/workflows/${workflow}.yml`));
		assert.ok(body.includes("host_null: true"));
	}
	const receipt = source.slice(source.indexOf("  receipt:\n"));
	assert.deepEqual(sparseCheckoutPatterns(receipt), sparseSourcePatterns);
	assert.match(receipt
		, /^ {4}if: always\(\) && inputs\.suite == 'produce'$/mu);
	assert.match(receipt, /pattern: host-null-\*-\$\{\{ github\.sha \}\}/u);
	assert.ok(receipt.includes(
		"node scripts/reconcile-host-null-complete-matrix.mjs"));
	assert.ok(receipt.includes(
		'--workflow ".github/workflows/host-null-complete.yml"'));
	assert.match(receipt
		, /name: host-null-complete-matrix-\$\{\{ github\.sha \}\}/u);
	assert.equal(receipt.match(/^ {8}continue-on-error: true$/gmu)?.length, 2);
	for(const job of ["npm-browser", "native-perl", "managed-wit", "php"])
		assert.ok(receipt.includes(`needs.${job}.result != 'success'`));
	assert.ok(receipt.includes("steps.download.outcome != 'success'"));
	assert.ok(receipt.includes("steps.reconciliation.outcome != 'success'"));
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
		, source.replace("          - produce\n", "")
		, source.replace("host_null: true", "host_null: false")
		, source.replace("            !/docs/evidence/*\n", "")
		, source.replace("            /docs/evidence/host-null-complete-*/\n", "")
		, source.replace("    needs: npm-browser\n", "")
		, source.replace("    if: always() && inputs.suite == 'produce'\n"
			, "    if: inputs.suite == 'produce'\n")
		, source.replace("steps.reconciliation.outcome != 'success'", "false")
		, source.replace("    timeout-minutes: 90\n"
			, "    continue-on-error: true\n    timeout-minutes: 90\n")
	]) assert.throws(() => assertHostNullCompleteWorkflow(changed));
});

test("focused HostNull producers retain all seven fail-closed lanes", async t => {
	for(const specification of focusedProducers)
	{
		const source = await readFile(specification.file, "utf8");
		assertFocusedProducer(source, specification);
		const [command, artifact, path] = specification.records[0];
		for(const changed of [
			source.replace(command, "disabled-command")
			, source.replace(artifact, "disabled-artifact")
			, source.replaceAll(path, "disabled/path/")
			, source.replace("steps.host_null.outcome != 'success'", "false")
			, ...(specification.file.endsWith("generic-subtype-managed-wit.yml")
				? [source.replace("            !/docs/evidence/\n", "")] : [])
		]) assert.throws(() => assertFocusedProducer(changed, specification)
			, assert.AssertionError, specification.file);
	}
	t.diagnostic("seven focused HostNull producer bypasses refused");
});
