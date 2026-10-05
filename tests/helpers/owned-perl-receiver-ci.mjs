/**
 * Require every Perl ABI, receiver gate and installed-package observation.
 *
 * @file
 */
import assert from "node:assert/strict";

export const ownedPerlReceiverScript = "LEAN_BRIDGE_OWNED_PERL_RECEIVER_TEST=1 node --test --test-concurrency=1 tests/owned-perl-receiver-core.test.mjs tests/owned-perl-receiver-plain.test.mjs tests/owned-perl-receiver-unanchored.test.mjs tests/owned-perl-receiver-contract.test.mjs tests/owned-perl-receiver-packaging.test.mjs tests/owned-perl-receiver-resource-packaging.test.mjs tests/owned-perl-receiver-documentation.test.mjs";
export const ownedPerlReceiverReports = ["ordinary", "reviewed"].flatMap(mode =>
	["", "-plain", "-consuming", "-unanchored", "-package", "-resource-package"].map(suffix => `build/owned-perl-receiver-core/${mode}${suffix}.json`))
	.concat("build/owned-perl-receiver-core/documentation.json");

/**
 * Keep the receiver matrix independent of the long-running older Perl suite.
 *
 * @param workflow - Complete reusable Perl workflow source.
 * @param manifest - Actual package scripts.
 */
export const assertOwnedPerlReceiverCi = (workflow, manifest) => {
	assert.equal(manifest.scripts["test:owned-perl-receivers"], ownedPerlReceiverScript);
	const jobs = workflow.split("  perl-receivers:\n"); assert.equal(jobs.length, 2);
	const job = jobs[1].split(/^ {2}[a-z][a-z-]*:\n/mu)[0];
	assert.match(job, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.match(job, /^ {4}timeout-minutes: 90$/mu);
	assert.match(job, /^ {6}fail-fast: false$/mu);
	assert.doesNotMatch(job, /^ {4}(?:if|continue-on-error):/mu);
	assert.deepEqual([...job.matchAll(/^ {10}- (\d+\.\d+\.\d+-(?:un)?threaded)$/gmu)].map(item => item[1])
		, ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"]);
	for(const command of ["npm ci --ignore-scripts --no-audit --no-fund"
		, "sudo apt-get update && sudo apt-get install -y build-essential curl zstd ripgrep"
		, "bash scripts/bootstrap-toolchains.sh --lean-only"
		, 'node scripts/build-perl-toolchains.mjs "${RECEIVER_PERL_CONFIGURATION%-*}" "${RECEIVER_PERL_CONFIGURATION##*-}"'])
		assert.ok(job.split("\n").includes("        run: " + command), command);
	const gates = job.split("      - name: Verify receiver lifetimes and installed CPAN releases\n");
	assert.equal(gates.length, 2); const gate = gates[1].split("      - name: ")[0];
	assert.match(gates[0], /^ {8}run: sudo apt-get .*install -y [^\n]*\bripgrep\b/mu);
	assert.doesNotMatch(gate, /^ {8}(?:if|continue-on-error):/mu);
	assert.match(gate, /^ {10}RECEIVER_PERL_CONFIGURATION: \$\{\{ matrix\.configuration \}\}$/mu);
	for(const line of [
		'export LEAN_BRIDGE_CORPUS_PERL="$PWD/.toolchains/perl/$RECEIVER_PERL_CONFIGURATION/bin/perl"'
		, "source scripts/env.sh"
		, "npm run test:owned-perl-receivers > build/owned-perl-receivers.log 2>&1"
		, "cat build/owned-perl-receivers.log"
		, ...["tests 16", "pass 16", "fail 0", "cancelled 0", "skipped 0"].map(value => `rg '^# ${value}$' build/owned-perl-receivers.log`)
		, ...ownedPerlReceiverReports.map(path => "test -s " + path)
	]) assert.ok(gate.split("\n").includes("          " + line), line);
	const upload = job.split("      - name: Upload this configuration's receiver acceptance\n");
	assert.equal(upload.length, 2);
	assert.match(upload[1], /^ {8}if: always\(\)$/mu);
	assert.match(upload[1], /^ {10}if-no-files-found: error$/mu);
	assert.match(upload[1], /^ {10}name: perl-receivers-\$\{\{ matrix\.configuration \}\}-\$\{\{ github\.sha \}\}$/mu);
	for(const path of ["build/owned-perl-receiver-core/", "build/owned-perl-receivers.log"])
		assert.ok(upload[1].split("\n").includes("            " + path));
};
