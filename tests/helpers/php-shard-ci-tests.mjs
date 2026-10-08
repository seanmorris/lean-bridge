/**
 * The native PHP and PHP-Wasm jobs together keep exactly the former combined PHP job's commands,
 * reports, artifacts and observations, each within its own budget, and both gate the summary (#1450).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";

// The former job's step lines, before the split.
const formerSteps = "d08fda0aa7d53296d4a7bbe7b92165e992c45fc4458912d2dcc00b780a3f4d3e";
const formerConsumer = [
	"      - name: Build twice, install, and execute every PHP transport"
	, "        id: consumer"
	, "        continue-on-error: true"
	, "        run: npm run test:consumer:php"
];
const setupNames = [
	"Check out the exact revision"
	, "Install Node.js"
	, "Install Nix"
	, "Restore pinned PHP and compiler inputs"
	, "Install dependencies without lifecycle scripts"
	, "Bound apt network waits"
	, "Install apt dependencies for Install native PHP and PHP-Wasm host build tools"
	, "Install native PHP and PHP-Wasm host build tools"
	, "Disable host PHP debugging instrumentation"
];
const nativeOutcomes = ["consumer", "ordinary_php", "type_corpus_php_native", "owned_php"];
const wasmOutcomes = ["consumer", "copied_zend", "ordinary_php_wasm", "type_corpus_php_wasm", "owned_php_wasm"];
const jobs = {
	native: {
		id: "php-consumers", name: "Native PHP", timeout: 240, host: "native PHP"
		, script: "test:consumer:php-native", target: "php-native"
		, outcomes: nativeOutcomes
		, note: "    # Native PHP installed acceptance runs alone; PHP-Wasm has its own job (#1450)."
		, guard: "Enforce native PHP acceptance"
	}
	, wasm: {
		id: "php-wasm-consumers", name: "PHP-Wasm", timeout: 330, host: "PHP-Wasm"
		, script: "test:consumer:php-wasm", target: "php-wasm"
		, outcomes: wasmOutcomes
		, note: "    # The shared PHP-Wasm corpus is the growing tail; 330 minutes leaves room below the hosted six-hour limit."
		, guard: "Enforce PHP-Wasm acceptance"
	}
};

/**
 * Return one top-level job's lines without trailing blank lines.
 *
 * @param lines - Workflow lines.
 * @param id - Job key.
 */
const jobLines = (lines, id) => {
	const start = lines.indexOf(`  ${id}:`);
	assert.ok(start >= 0, id);
	const end = lines.findIndex((line, index) => index > start && /^ {2}[a-z][a-z0-9-]*:$/u.test(line));
	const job = lines.slice(start, end < 0 ? lines.length : end);
	while(job.at(-1) === "") job.pop();
	return job;
};
const stepsOf = job => {
	const steps = [];
	for(const line of job.slice(job.indexOf("    steps:") + 1))
		if(line.startsWith("      - name: ")) steps.push([line]); else steps.at(-1).push(line);
	return steps;
};
const named = (steps, name) => {
	const found = steps.filter(step => step[0] === `      - name: ${name}`);
	assert.equal(found.length, 1, name);
	return found[0];
};
const condition = ids => "        if: " + ids.map(id => `steps.${id}.outcome != 'success'`).join(" || ");

/**
 * Rebuild the former combined job's steps from both shards, checking each shard's own structure.
 *
 * @param source - Complete consumer-matrix workflow text.
 */
export const assertPhpShardContract = source => {
	const lines = source.split("\n");
	const parsed = {};
	for(const [key, spec] of Object.entries(jobs))
	{
		const job = jobLines(lines, spec.id);
		// The whole job header is fixed: neither job may be skipped, tolerate failure or run longer.
		assert.deepEqual(job.slice(0, job.indexOf("    steps:") + 1), [
			`  ${spec.id}:`
			, `    name: ${spec.name}`
			, "    runs-on: ubuntu-24.04"
			, spec.note
			, `    timeout-minutes: ${spec.timeout}`
			, "    steps:"
		], `${key} header`);
		const steps = stepsOf(job);
		assert.deepEqual(steps.slice(0, setupNames.length).map(step => step[0]), setupNames.map(name => `      - name: ${name}`), `${key} setup`);
		const consumer = named(steps, `Build twice, install, and execute the ${spec.host} transport`);
		assert.deepEqual(consumer.slice(1), ["        id: consumer", "        continue-on-error: true", `        run: npm run ${spec.script}`]);
		const record = named(steps, "Record PHP observations"), upload = named(steps, "Upload PHP observations");
		const enforce = named(steps, "Enforce PHP support");
		assert.deepEqual(enforce, ["      - name: Enforce PHP support", condition(spec.outcomes), "        run: exit 1"], `${key} enforcement`);
		assert.deepEqual(steps.slice(-3), [record, upload, enforce], `${key} closing steps`);
		parsed[key] = { steps, consumer, record, upload };
	}
	const { native, wasm } = parsed;
	assert.deepEqual(native.steps.slice(0, setupNames.length), wasm.steps.slice(0, setupNames.length), "identical setup");
	const nativeOnly = native.steps.slice(setupNames.length, native.steps.indexOf(native.consumer));
	assert.equal(native.steps.indexOf(native.consumer), native.steps.length - 4, "native transport follows native acceptance");
	assert.equal(wasm.steps.indexOf(wasm.consumer), setupNames.length, "PHP-Wasm transport precedes PHP-Wasm acceptance");
	const wasmOnly = wasm.steps.slice(setupNames.length + 1, -3);
	// Records: each job writes only its own target, with its own transport command as the prefix.
	const run = record => record.slice(record.indexOf("        run: |") + 1);
	const header = native.record.slice(0, native.record.indexOf("        run: |") + 1);
	assert.deepEqual(wasm.record.slice(0, header.length), header);
	const [nativeBody, wasmBody] = [run(native.record), run(wasm.record)];
	assert.deepEqual(nativeBody.slice(0, 2), wasmBody.slice(0, 2));
	assert.equal(nativeBody.length, 9); assert.equal(wasmBody.length, 9);
	const restore = (line, target, script) => {
		assert.ok(line.startsWith(`          node scripts/consumer-ci.mjs record --consumer ${target} `), target);
		assert.equal(line.split(`--command "npm run ${script} && `).length, 2, target);
		return line.replace(`--command "npm run ${script} && `, '--command "npm run test:consumer:php && ');
	};
	const formerRecord = [
		...header
		, ...nativeBody.slice(0, 8)
		, ...wasmBody.slice(2, 8)
		, restore(nativeBody[8], "php-native", "test:consumer:php-native")
		, restore(wasmBody[8], "php-wasm", "test:consumer:php-wasm")
	];
	// Uploads: per-target artifact names and paths, otherwise identical to the former upload.
	const formerUpload = native.upload.map(line => line.replace("consumer-results-php-native-${{ github.sha }}", "consumer-results-php-${{ github.sha }}")
		.replace("build/consumer-ci/results/php-native.json", "build/consumer-ci/results/*.json"));
	assert.deepEqual(wasm.upload.map(line => line.replace("php-wasm", "php-native")), native.upload);
	assert.ok(native.upload.includes("          name: consumer-results-php-native-${{ github.sha }}"));
	const formerEnforce = ["      - name: Enforce PHP support", condition([...jobs.native.outcomes, ...jobs.wasm.outcomes.slice(1)]), "        run: exit 1"];
	const rebuilt = [...native.steps.slice(0, setupNames.length), ...nativeOnly, formerConsumer, ...wasmOnly, formerRecord, formerUpload, formerEnforce];
	assert.equal(sha256(rebuilt.flat().join("\n")), formerSteps, "former PHP job");
	// The summary runs with always(), so each job's result must be enforced explicitly.
	const summary = jobLines(lines, "support-summary");
	assert.ok(summary.includes("    if: always()"));
	const needs = summary.slice(summary.indexOf("    needs:") + 1, summary.findIndex(line => /^ {4}runs-on:/u.test(line)));
	for(const spec of Object.values(jobs))
	{
		assert.equal(needs.filter(line => line === `      - ${spec.id}`).length, 1, `${spec.id} dependency`);
		// The guard is a complete step: a failure-tolerance key would let the summary publish anyway.
		assert.deepEqual(named(stepsOf(summary), spec.guard), [
			`      - name: ${spec.guard}`
			, `        if: needs.${spec.id}.result != 'success'`
			, "        run: exit 1"
		], `${spec.id} guard`);
	}
};

test("the native PHP and PHP-Wasm jobs together keep exactly the former PHP job and both gate the summary", async () => {
	assertPhpShardContract(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
});

test("PHP shard checks refuse skipped, weakened or unenforced jobs and lost commands", async () => {
	const source = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const mutations = [
		["skipped native job", "    name: Native PHP\n", "    name: Native PHP\n    if: false\n"]
		, ["skipped PHP-Wasm job", "    name: PHP-Wasm\n", "    name: PHP-Wasm\n    if: github.event_name == 'schedule'\n"]
		, ["no native guard", "        if: needs.php-consumers.result != 'success'\n", "        if: needs.php-consumers.result == 'failure'\n"]
		, ["no PHP-Wasm guard", "        if: needs.php-wasm-consumers.result != 'success'\n", "        if: false\n"]
		, ["dropped native dependency", "      - php-consumers\n", ""]
		, ["dropped PHP-Wasm dependency", "      - php-wasm-consumers\n", ""]
		, ["weakened native enforcement", " || steps.owned_php.outcome != 'success'\n", "\n"]
		, ["weakened PHP-Wasm enforcement", " || steps.type_corpus_php_wasm.outcome != 'success'", ""]
		, ["longer native budget", "    timeout-minutes: 240\n    steps:\n      - name: Check out the exact revision\n        uses: actions/checkout@v6\n        with:\n          fetch-depth: 0\n          persist-credentials: false\n      - name: Install Node.js\n        uses: actions/setup-node@v6\n        with:\n          node-version: ${{ env.NODE_VERSION }}\n          cache: npm\n      - name: Install Nix\n        uses: cachix/install-nix-action@v31\n      - name: Restore pinned PHP", "    timeout-minutes: 360\n    steps:\n      - name: Check out the exact revision\n        uses: actions/checkout@v6\n        with:\n          fetch-depth: 0\n          persist-credentials: false\n      - name: Install Node.js\n        uses: actions/setup-node@v6\n        with:\n          node-version: ${{ env.NODE_VERSION }}\n          cache: npm\n      - name: Install Nix\n        uses: cachix/install-nix-action@v31\n      - name: Restore pinned PHP"]
		, ["lost native transport", "        run: npm run test:consumer:php-native\n", "        run: npm run test:consumer:php-wasm\n"]
		, ["combined record command", '--command "npm run test:consumer:php-native && ', '--command "npm run test:consumer:php && ']
		, ["tolerated native failure", "(#1450).\n    timeout-minutes: 240\n", "(#1450).\n    timeout-minutes: 240\n    continue-on-error: true\n"]
		, ["tolerated PHP-Wasm failure", "    timeout-minutes: 330\n", "    timeout-minutes: 330\n    continue-on-error: true\n"]
		, ["tolerated native guard", "        if: needs.php-consumers.result != 'success'\n        run: exit 1\n", "        if: needs.php-consumers.result != 'success'\n        run: exit 1\n        continue-on-error: true\n"]
		, ["tolerated PHP-Wasm guard", "        if: needs.php-wasm-consumers.result != 'success'\n        run: exit 1\n", "        if: needs.php-wasm-consumers.result != 'success'\n        run: exit 1\n        continue-on-error: true\n"]
		, ["shared results artifact", "          name: consumer-results-php-wasm-${{ github.sha }}\n", "          name: consumer-results-php-${{ github.sha }}\n"]
	];
	for(const [label, before, after] of mutations)
	{
		assert.equal(source.split(before).length, 2, `${label} anchor is unique`);
		assert.throws(() => assertPhpShardContract(source.replace(before, after)), assert.AssertionError, label);
	}
	// Removing any PHP command from either job breaks the exact reconstruction.
	const wasmJob = source.slice(source.indexOf("\n  php-wasm-consumers:\n"));
	const command = wasmJob.split("\n").find(line => line.includes("LEAN_BRIDGE_OWNED_WASM32_TEST=1"));
	assert.throws(() => assertPhpShardContract(source.replace(command + "\n", "")), assert.AssertionError, "lost owned wasm32 command");
});
