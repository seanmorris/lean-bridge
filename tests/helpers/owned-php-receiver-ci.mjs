/**
 * Require the independent native PHP receiver gate and installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";

export const ownedPhpReceiverScript = "LEAN_BRIDGE_OWNED_PHP_RECEIVER_TEST=1 LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 tests/owned-php-receivers.test.mjs tests/owned-php-receiver-packaging.test.mjs tests/owned-php-receiver-resource-packaging.test.mjs tests/owned-php-receiver-documentation.test.mjs";
export const ownedPhpReceiverReports = ["ordinary", "reviewed"].flatMap(mode => [
	... ["", "-plain-false", "-plain-true", "-unanchored"].map(suffix => `build/owned-php-receivers/${mode}${suffix}.json`)
	, ...["", "-resource"].map(suffix => `build/owned-php-receiver-packaging/${mode}${suffix}.json`)
]).concat("build/owned-php-receiver-packaging/documentation.json");

/**
 * Keep receiver execution independent of the six-hour PHP/PHP-Wasm job.
 *
 * @param workflow - Complete consumer workflow.
 * @param manifest - Actual package scripts.
 */
export const assertOwnedPhpReceiverCi = (workflow, manifest) => {
	assert.equal(manifest.scripts["test:owned-php-receivers"], ownedPhpReceiverScript);
	const jobs = workflow.split("  php-receivers:\n"); assert.equal(jobs.length, 2);
	const job = jobs[1].split(/^ {2}[a-z][a-z-]*:\n/mu)[0];
	assert.match(job, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.match(job, /^ {4}timeout-minutes: 90$/mu);
	assert.doesNotMatch(job, /^ {4}(?:if|continue-on-error):/mu);
	for(const command of ["npm ci --ignore-scripts", "bash scripts/bootstrap-toolchains.sh --lean-only"])
		assert.ok(job.split("\n").includes("          " + command));
	for(const tool of ["libgmp-dev", "libuv1-dev", "php-cli", "php-common", "php-zip", "php-mbstring", "composer", "unzip"])
		assert.ok(job.includes(tool));
	const steps = job.split("      - name: Verify receiver lifetimes and installed Composer releases\n");
	assert.equal(steps.length, 2); const gate = steps[1].split("      - name: ")[0];
	assert.doesNotMatch(gate, /^ {8}(?:if|continue-on-error):/mu);
	for(const line of [
		'export LEAN_BRIDGE_PHP="$(command -v php)"'
		, 'export LEAN_BRIDGE_COMPOSER="$(command -v composer)"'
		, "source scripts/env.sh"
		, "npm run test:owned-php-receivers > build/owned-php-receivers.log 2>&1"
		, "cat build/owned-php-receivers.log"
		, ...["tests 16", "pass 16", "fail 0", "cancelled 0", "skipped 0"].map(value => `rg '^# ${value}$' build/owned-php-receivers.log`)
		, ...ownedPhpReceiverReports.map(path => "test -s " + path)
	]) assert.ok(gate.split("\n").includes("          " + line), line);
	const upload = job.split("      - name: Upload native PHP receiver acceptance\n");
	assert.equal(upload.length, 2);
	assert.match(upload[1], /^ {8}if: always\(\)$/mu);
	assert.match(upload[1], /^ {10}if-no-files-found: error$/mu);
	assert.match(upload[1], /^ {10}name: owned-php-receivers-\$\{\{ github\.sha \}\}$/mu);
	for(const path of ["build/owned-php-receivers/", "build/owned-php-receiver-packaging/", "build/owned-php-receivers.log"])
		assert.ok(upload[1].split("\n").includes("            " + path));
	const summary = workflow.split("  support-summary:\n")[1];
	assert.match(summary, /^ {6}- php-receivers$/mu);
	assert.ok(summary.includes("      - name: Enforce native PHP receiver acceptance\n        if: needs.php-receivers.result != 'success'\n        run: exit 1\n"));
};
