/**
 * Require the PHP-Wasm receiver runtime, complete gate and installed reports.
 *
 * @file
 */
import assert from "node:assert/strict";

export const ownedPhpWasmReceiverScript = "LEAN_BRIDGE_OWNED_PHP_WASM_RECEIVER_TEST=1 node --test --test-concurrency=1 tests/owned-php-wasm-receiver-model.test.mjs tests/owned-php-wasm-receivers.test.mjs tests/owned-php-wasm-receiver-resource.test.mjs tests/owned-php-wasm-receiver-packaging.test.mjs tests/owned-php-wasm-receiver-resource-packaging.test.mjs tests/owned-php-wasm-receiver-documentation.test.mjs";
export const ownedPhpWasmReceiverReports = ["ordinary", "reviewed"].flatMap(mode =>
	["", "-plain-false", "-plain-true", "-unanchored", "-resource-package"].map(suffix => mode + suffix))
	.concat("native-fibers", "packages", "documentation")
	.map(name => `build/owned-php-wasm-receivers/${name}.json`);

/**
 * Check required preparation before the gate and every retained observation.
 *
 * @param workflow - Actual downstream workflow text.
 * @param manifest - Repository package manifest.
 */
export const assertOwnedPhpWasmReceiverCi = (workflow, manifest) => {
	assert.equal(manifest.scripts["test:owned-php-wasm-receivers"], ownedPhpWasmReceiverScript);
	const jobs = workflow.split("  php-wasm-receivers:\n"); assert.equal(jobs.length, 2);
	const job = jobs[1].split(/^ {2}[a-z][a-z-]*:\n/mu)[0];
	assert.match(job, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.match(job, /^ {4}timeout-minutes: 180$/mu);
	assert.doesNotMatch(job, /^ {4,8}(?:if|continue-on-error): (?:false|true)/mu);
	const gates = job.split("      - name: Verify PHP-Wasm receivers and installed npm and Composer packages\n");
	assert.equal(gates.length, 2); const prepare = gates[0], gate = gates[1].split("      - name: ")[0];
	const commands = ["bash scripts/bootstrap-php-wasm-ci.sh"
		, "npx playwright install --with-deps chromium"
		, "bash scripts/bootstrap-toolchains.sh"
		, 'export LEAN_WASM_EMSDK="$GITHUB_WORKSPACE/.toolchains/emsdk-php-wasm"'
		, "bash scripts/build-lean-runtime.sh"
		, "source scripts/env.sh"
		, 'node --input-type=module -e \'import {prepareOwnedPhpWasmRuntime} from "./tests/helpers/owned-php-wasm-runtime.mjs"; await prepareOwnedPhpWasmRuntime("build/php-wasm-receiver-input");\''
	];
	for(const tool of ["php-cli", "php-dev", "composer", "ripgrep"])
		assert.match(prepare, new RegExp("^ {10}sudo apt-get install -y [^\\n]*\\b" + tool + "\\b", "mu"));
	let previous = -1;
	for(const command of commands)
	{
		const index = prepare.indexOf("          " + command + "\n");
		assert.ok(index > previous, command); previous = index;
	}
	assert.match(gate, /^ {10}LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME: build\/php-wasm-receiver-input\/php-wasm-runtime$/mu);
	for(const command of ["source scripts/env.sh"
		, "npm run test:owned-php-wasm-receivers > build/owned-php-wasm-receivers.log 2>&1"
		, "cat build/owned-php-wasm-receivers.log"
		, ...["tests 17", "pass 17", "fail 0", "cancelled 0", "skipped 0"].map(value => `rg '^# ${value}$' build/owned-php-wasm-receivers.log`)
		, ...ownedPhpWasmReceiverReports.map(path => "test -s " + path)
	]) assert.ok(gate.split("\n").includes("          " + command), command);
	const upload = job.split("      - name: Preserve PHP-Wasm receiver acceptance\n");
	assert.equal(upload.length, 2); assert.match(upload[1], /^ {8}if: always\(\)$/mu);
	assert.match(upload[1], /^ {10}if-no-files-found: error$/mu);
	assert.match(upload[1], /^ {10}name: php-wasm-receivers-\$\{\{ github\.sha \}\}$/mu);
	for(const path of ["build/owned-php-wasm-receivers/", "build/owned-php-wasm-receivers.log"])
		assert.ok(upload[1].split("\n").includes("            " + path));
	const summary = workflow.split("  support-summary:\n")[1];
	assert.match(summary, /^ {6}- php-wasm-receivers$/mu);
	assert.ok(summary.includes("      - name: Enforce PHP-Wasm receiver acceptance\n        if: needs.php-wasm-receivers.result != 'success'\n        run: exit 1\n"));
};
